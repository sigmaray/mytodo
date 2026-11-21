import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { cors } from "hono/cors";
import postgres from "postgres";
import { parseJson } from "./appSchemas";
import { registerAttachmentRoutes } from "./attachmentRoutes";
import { createAttachmentStorage } from "./attachmentStorage";
import { hashSessionToken, sessionCookieName } from "./auth";
import { registerAuthRoutes } from "./authRoutes";
import { registerPlaywrightRoutes } from "./playwrightRoutes";
import type { TaskRepository } from "./repository";
import { createMemoryTaskRepository } from "./repository";
import { registerTaskRoutes } from "./taskRoutes";
import { createToolsRouter } from "./tools";
import type { UserRepository } from "./users";
import { createMemoryUserRepository } from "./users";

/**
 * Builds the Hono API with authentication and application routes.
 *
 * @param {TaskRepository | ((userId: string) => TaskRepository)} [repository]
 * @param {{ databaseUrl?: string; mode?: string; secureCookies?: boolean; userRepository?: UserRepository; attachmentsDir?: string; attachmentsEnabled?: boolean; projectArchivingEnabled?: boolean; playwrightApiEnabled?: boolean; }} [options]
 * @param {string} options.databaseUrl - PostgreSQL URL for the production repository and database tools.
 * @param {string} options.mode - Runtime mode; production enables secure defaults.
 * @param {boolean} options.secureCookies - Explicit override for the session cookie Secure flag.
 * @param {UserRepository} options.userRepository - Account store; defaults to the in-memory implementation.
 * @param {string} options.attachmentsDir - Directory for private comment attachment storage.
 * @param {boolean} options.attachmentsEnabled - Enables attachments when storage is configured.
 * @param {boolean} options.projectArchivingEnabled - Enables project archive operations.
 * @param {boolean} options.playwrightApiEnabled - Enables helper APIs used to prepare Playwright tests.
 * @returns The configured Hono application.
 */
export const createApp = (
  repository: TaskRepository | ((userId: string) => TaskRepository) = createMemoryTaskRepository(),
  options: {
    databaseUrl?: string;

    mode?: string;

    secureCookies?: boolean;

    userRepository?: UserRepository;

    attachmentsDir?: string;

    attachmentsEnabled?: boolean;

    projectArchivingEnabled?: boolean;

    playwrightApiEnabled?: boolean;
  } = {},
) => {
  /** Request context holds the user set by the authentication middleware below. */
  const app = new Hono<{ Variables: { userId: string; authenticated: boolean } }>();
  const userRepository = options.userRepository ?? createMemoryUserRepository();
  /** In production, cookies use the Secure flag unless explicitly overridden. */
  const secureCookies = options.secureCookies ?? options.mode === "production";
  const attachmentStorage = createAttachmentStorage(options.attachmentsDir ?? null);
  const attachmentsEnabled = (options.attachmentsEnabled ?? true) && attachmentStorage.enabled;
  const attachmentStorageAvailable = attachmentsEnabled;
  const projectArchivingEnabled = options.projectArchivingEnabled === true;
  const playwrightApiEnabled = options.playwrightApiEnabled === true;
  /** The Playwright API is available only for an isolated test database outside production. */
  if (playwrightApiEnabled && options.mode === "production")
    throw new Error("The Playwright API cannot be enabled in production");
  if (playwrightApiEnabled && options.databaseUrl === undefined)
    throw new Error("The Playwright API requires a database URL");
  const playwrightDatabase =
    playwrightApiEnabled && options.databaseUrl !== undefined
      ? postgres(options.databaseUrl, { max: 1 })
      : null;
  /**
   * A shared repository works for tests with common data; the factory scopes data by user.
   *
   * @param {string} userId
   */
  const repositoryFor = (userId: string) =>
    typeof repository === "function" ? repository(userId) : repository;
  /**
   * Checks administrator privileges for protected settings and tools.
   *
   * @param {string} userId
   * @returns Whether the user has administrator privileges.
   */
  const requireAdmin = async (userId: string) => {
    const user = await userRepository.getById(userId);
    return user?.isAdmin === true;
  };

  app.use("*", cors());

  app.use("*", async (context, next) => {
    /** Public authentication routes and preflight requests do not require an active session. */
    const path = context.req.path;
    const method = context.req.method;
    const publicRoute =
      (path === "/auth/status" && method === "GET") ||
      (path === "/features" && method === "GET") ||
      (path === "/auth/login" && method === "POST") ||
      (path === "/auth/logout" && method === "POST");

    if (publicRoute || method === "OPTIONS") {
      await next();
      return;
    }

    /** Until the administrator sets the first password, block the API except for login routes. */
    if (!(await userRepository.hasPasswordUsers())) {
      return context.json({ error: "Administrator password must be configured before using the API" }, 503);
    }

    /** Look up the token hash in storage instead of storing the raw cookie value. */
    const token = getCookie(context, sessionCookieName);
    const userId =
      token === undefined ? null : await userRepository.getSessionUserId(hashSessionToken(token), new Date());

    if (userId === null || (await userRepository.getById(userId)) === null) {
      return context.json({ error: "Authentication required" }, 401);
    }

    /** After validating the session, pass the user ID to downstream routes. */
    context.set("userId", userId);
    context.set("authenticated", true);
    await next();
  });

  registerAuthRoutes(app, {
    userRepository,
    repositoryFor,
    secureCookies,
    attachmentsEnabled,
    projectArchivingEnabled,
    attachmentStorageAvailable,
    attachmentStorage,
    requireAdmin,
  });

  if (playwrightApiEnabled && playwrightDatabase !== null) {
    registerPlaywrightRoutes(app, {
      database: playwrightDatabase,
      attachmentStorage,
      attachmentStorageAvailable,
      repositoryFor,
    });
  }

  registerAttachmentRoutes(app, { repositoryFor, attachmentStorage, attachmentStorageAvailable });

  if (options.databaseUrl !== undefined) {
    app.use("/tools-api/*", async (context, next) => {
      /** Database tools are available only to an authenticated administrator. */
      const administrator = await requireAdmin(context.get("userId"));
      if (!context.get("authenticated") || !administrator)
        return context.json({ error: "Administrator access required" }, 403);
      await next();
    });
    app.route("/tools-api", createToolsRouter(options.databaseUrl, options.mode ?? "development"));
  }

  registerTaskRoutes(
    app,
    repositoryFor,
    parseJson,
    projectArchivingEnabled,
    attachmentStorageAvailable,
    attachmentStorage.removeMany,
  );

  app.delete("/tasks/:id", async (context) => {
    const taskRepository = repositoryFor(context.get("userId"));
    const allTasks = await taskRepository.list();
    /** Collects a task and all of its descendants from the current task list.
     * @param id ID of the task whose subtree should be collected.
     * @returns IDs for the task and every nested descendant.
     */
    const collect = (id: string): Array<string> => [
      id,
      ...allTasks.filter((task) => task.parentId === id).flatMap((task) => collect(task.id)),
    ];
    /** The repository deletes the task and descendants; collect their attachments beforehand. */
    const descendantIds = new Set(collect(context.req.param("id")));
    const removedAttachmentIds = allTasks
      .filter((task) => descendantIds.has(task.id))
      .flatMap((task) =>
        task.comments.flatMap((comment) => comment.attachments?.map((attachment) => attachment.id) ?? []),
      );
    /** Delete files only after the records are removed successfully so valid attachments remain available on failure. */
    const deleted = await taskRepository.delete(context.req.param("id"));
    if (deleted && attachmentStorageAvailable) await attachmentStorage.removeMany(removedAttachmentIds);

    return deleted ? context.json({ deleted: true }) : context.json({ error: "Task not found" }, 404);
  });

  return app;
};
