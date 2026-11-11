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

export const createApp = (
  repository: TaskRepository | ((userId: string) => TaskRepository) = createMemoryTaskRepository(),
  options: Readonly<{
    databaseUrl?: string;
    mode?: string;
    secureCookies?: boolean;
    userRepository?: UserRepository;
    attachmentsDir?: string;
    attachmentsEnabled?: boolean;
    projectArchivingEnabled?: boolean;
    playwrightApiEnabled?: boolean;
  }> = Object.freeze({}),
) => {
  const app = new Hono<{ Variables: { userId: string; authenticated: boolean } }>();
  const userRepository = options.userRepository ?? createMemoryUserRepository();
  const secureCookies = options.secureCookies ?? options.mode === "production";
  const attachmentStorage = createAttachmentStorage(options.attachmentsDir ?? null);
  const attachmentsEnabled = (options.attachmentsEnabled ?? true) && attachmentStorage.enabled;
  const attachmentStorageAvailable = attachmentsEnabled;
  const projectArchivingEnabled = options.projectArchivingEnabled === true;
  const playwrightApiEnabled = options.playwrightApiEnabled === true;
  if (playwrightApiEnabled && options.mode === "production")
    throw new Error("The Playwright API cannot be enabled in production");
  if (playwrightApiEnabled && options.databaseUrl === undefined)
    throw new Error("The Playwright API requires a database URL");
  const playwrightDatabase =
    playwrightApiEnabled && options.databaseUrl !== undefined
      ? postgres(options.databaseUrl, { max: 1 })
      : null;
  const repositoryFor = (userId: string) =>
    typeof repository === "function" ? repository(userId) : repository;
  const requireAdmin = async (userId: string) => {
    const user = await userRepository.getById(userId);
    return user?.isAdmin === true;
  };

  app.use("*", cors());

  app.use("*", async (context, next) => {
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

    if (!(await userRepository.hasPasswordUsers())) {
      return context.json({ error: "Administrator password must be configured before using the API" }, 503);
    }

    const token = getCookie(context, sessionCookieName);
    const userId =
      token === undefined ? null : await userRepository.getSessionUserId(hashSessionToken(token), new Date());

    if (userId === null || (await userRepository.getById(userId)) === null) {
      return context.json({ error: "Authentication required" }, 401);
    }

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
    const collect = (id: string): ReadonlyArray<string> => [
      id,
      ...allTasks.filter((task) => task.parentId === id).flatMap((task) => collect(task.id)),
    ];
    const descendantIds = new Set(collect(context.req.param("id")));
    const removedAttachmentIds = allTasks
      .filter((task) => descendantIds.has(task.id))
      .flatMap((task) =>
        task.comments.flatMap((comment) => comment.attachments?.map((attachment) => attachment.id) ?? []),
      );
    const deleted = await taskRepository.delete(context.req.param("id"));
    if (deleted && attachmentStorageAvailable) await attachmentStorage.removeMany(removedAttachmentIds);

    return deleted ? context.json({ deleted: true }) : context.json({ error: "Task not found" }, 404);
  });

  return app;
};
