import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { cors } from "hono/cors";
import postgres from "postgres";
import { z } from "zod";
import type { AttachmentMetadata } from "./attachmentStorage";
import {
  createAttachmentStorage,
  detectSafeImageMimeType,
  validateAttachmentFiles,
} from "./attachmentStorage";
import {
  createSessionToken,
  hashPassword,
  hashSessionToken,
  sessionCookieName,
  sessionLifetimeSeconds,
  verifyPassword,
} from "./auth";
import type { TaskRepository } from "./repository";
import { createMemoryTaskRepository } from "./repository";
import { registerTaskRoutes } from "./taskRoutes";
import { createToolsRouter } from "./tools";
import type { UserRepository } from "./users";
import { createMemoryUserRepository, defaultAdminUserId } from "./users";

const createTaskSchema = z.object({
  title: z.string().trim().min(1),
  parentId: z.string().nullable().default(null),
  projectId: z.string().nullable().default(null),
  sectionId: z.string().nullable().default(null),
});

const createProjectSchema = z.object({
  title: z.string().trim().min(1),
  parentId: z.string().nullable().default(null),
});
const createSectionSchema = z.object({
  title: z.string().trim().min(1),
  projectId: z.string().nullable().default(null),
});

const loginSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1),
});

const updateSettingsSchema = z.object({
  confirmDelete: z.boolean(),
});
const updateAccountSchema = z
  .object({ username: z.string().trim().min(1).max(64).optional(), password: z.string().min(1).optional() })
  .refine((patch) => Object.keys(patch).length > 0);
const createUserSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1),
  isAdmin: z.boolean().default(false),
});
const updateUserSchema = z
  .object({
    username: z.string().trim().min(1).max(64).optional(),
    password: z.string().min(1).optional(),
    isAdmin: z.boolean().optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0);
const inboxDescriptionSchema = z.object({ description: z.string().max(20000) });

const parseJson = async (request: Request) => {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return {};
  }

  return request.json();
};

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

  app.get("/auth/status", async (context) => {
    const token = getCookie(context, sessionCookieName);
    const requiresLogin = await userRepository.hasPasswordUsers();
    const userId =
      token === undefined ? null : await userRepository.getSessionUserId(hashSessionToken(token), new Date());
    const activeUser = userId === null ? null : await userRepository.getById(userId);
    const effectiveUser =
      activeUser ?? (requiresLogin ? null : await userRepository.getById(defaultAdminUserId));
    const authenticated = activeUser !== null;

    context.header("Cache-Control", "no-store");
    return context.json({
      accessMode: "password",
      authenticated,
      attachmentsEnabled,
      projectArchivingEnabled,
      user:
        effectiveUser === null
          ? null
          : { id: effectiveUser.id, username: effectiveUser.username, isAdmin: effectiveUser.isAdmin },
    });
  });

  app.get("/features", (context) => context.json({ attachmentsEnabled, projectArchivingEnabled }));

  if (playwrightApiEnabled && playwrightDatabase !== null) {
    const testTables = Object.freeze({
      tasks: "tasks",
      task_comments: "task_comments",
      sections: "sections",
      projects: "projects",
    } as const);
    const clearTestTable = async (table: keyof typeof testTables, userId: string) => {
      const attachmentRows =
        table === "tasks" || table === "task_comments"
          ? await playwrightDatabase<
              { attachments: unknown }[]
            >`SELECT attachments FROM task_comments WHERE user_id = ${userId}`
          : [];
      const result = await playwrightDatabase.unsafe(`DELETE FROM ${testTables[table]} WHERE user_id = $1`, [
        userId,
      ]);
      if (attachmentStorage.enabled) {
        const attachmentIds = attachmentRows.flatMap((row) =>
          Array.isArray(row.attachments)
            ? row.attachments.flatMap((attachment) =>
                typeof attachment === "object" &&
                attachment !== null &&
                "id" in attachment &&
                typeof attachment.id === "string" &&
                /^[0-9a-f-]{36}$/i.test(attachment.id)
                  ? [attachment.id]
                  : [],
              )
            : [],
        );
        await attachmentStorage.removeMany(attachmentIds);
      }
      return result.count;
    };

    app.post("/api/playwright/reset", async (context) => {
      const userId = context.get("userId");
      if (attachmentStorage.enabled) await clearTestTable("task_comments", userId);
      await playwrightDatabase.begin(async (transaction) => {
        await transaction`DELETE FROM tasks`;
        await transaction`DELETE FROM sections`;
        await transaction`DELETE FROM projects`;
        await transaction`DELETE FROM sessions WHERE user_id <> ${userId}`;
        await transaction`DELETE FROM users WHERE id <> ${userId}`;
        await transaction`UPDATE users SET confirm_delete = true, inbox_description = '' WHERE id = ${userId}`;
      });
      return context.json({ reset: true });
    });

    app.delete("/api/playwright/tables/:table", async (context) => {
      const table = context.req.param("table");
      if (!Object.hasOwn(testTables, table)) return context.json({ error: "Unsupported test table" }, 400);
      const deleted = await clearTestTable(table as keyof typeof testTables, context.get("userId"));
      return context.json({ table, deleted });
    });

    app.post("/api/playwright/entities/:entity", async (context) => {
      const entity = context.req.param("entity");
      const taskRepository = repositoryFor(context.get("userId"));
      if (entity === "task") {
        const result = createTaskSchema.safeParse(await parseJson(context.req.raw));
        if (!result.success) return context.json({ error: "Invalid task payload" }, 400);
        if (
          result.data.parentId !== null &&
          !(await taskRepository.list()).some((task) => task.id === result.data.parentId)
        )
          return context.json({ error: "Parent task not found" }, 404);
        if (
          result.data.projectId !== null &&
          !(await taskRepository.listProjects()).some((project) => project.id === result.data.projectId)
        )
          return context.json({ error: "Project not found" }, 404);
        if (
          result.data.sectionId !== null &&
          !(await taskRepository.listSections()).some((section) => section.id === result.data.sectionId)
        )
          return context.json({ error: "Section not found" }, 404);
        const task = await taskRepository.create(
          result.data.title,
          result.data.parentId,
          result.data.projectId,
          result.data.sectionId,
        );
        return context.json({ task }, 201);
      }
      if (entity === "project") {
        const result = createProjectSchema.safeParse(await parseJson(context.req.raw));
        if (!result.success) return context.json({ error: "Invalid project payload" }, 400);
        if (
          result.data.parentId !== null &&
          !(await taskRepository.listProjects()).some((project) => project.id === result.data.parentId)
        )
          return context.json({ error: "Parent project not found" }, 404);
        const project =
          result.data.parentId === null
            ? await taskRepository.createProject(result.data.title)
            : await taskRepository.createSubproject(result.data.title, result.data.parentId);
        return context.json({ project }, 201);
      }
      if (entity === "section") {
        const result = createSectionSchema.safeParse(await parseJson(context.req.raw));
        if (!result.success) return context.json({ error: "Invalid section payload" }, 400);
        if (
          result.data.projectId !== null &&
          !(await taskRepository.listProjects()).some((project) => project.id === result.data.projectId)
        )
          return context.json({ error: "Project not found" }, 404);
        const section = await taskRepository.createSection(result.data.title, result.data.projectId);
        return context.json({ section }, 201);
      }
      if (entity === "comment") {
        const result = z
          .object({ taskId: z.string().min(1), body: z.string().max(5000).default("") })
          .refine((value) => value.body.trim().length > 0)
          .safeParse(await parseJson(context.req.raw));
        if (!result.success) return context.json({ error: "Invalid comment payload" }, 400);
        const task = (await taskRepository.list()).find((item) => item.id === result.data.taskId);
        if (task === undefined) return context.json({ error: "Task not found" }, 404);
        const comment = Object.freeze({
          id: crypto.randomUUID(),
          body: result.data.body,
          createdAt: new Date().toISOString(),
        });
        if (!(await taskRepository.addComment(task.id, comment)))
          return context.json({ error: "Task not found" }, 404);
        return context.json({ comment }, 201);
      }
      if (entity === "attachment") {
        if (!attachmentStorageAvailable) return context.json({ error: "Attachments are disabled" }, 503);
        let form: FormData;
        try {
          form = await context.req.formData();
        } catch {
          return context.json({ error: "Invalid multipart form" }, 400);
        }
        const taskId = String(form.get("taskId") ?? "");
        const body = String(form.get("body") ?? "").trim();
        const task = (await taskRepository.list()).find((item) => item.id === taskId);
        if (task === undefined) return context.json({ error: "Task not found" }, 404);
        const files = form
          .getAll("files")
          .filter((entry): entry is File => entry instanceof File && entry.size > 0);
        if (files.length !== 1 || body.length > 5000 || files[0]!.size > 10 * 1024 * 1024)
          return context.json({ error: "One attachment up to 10 MB is required" }, 400);
        const file = files[0]!;
        const [attachment] = await attachmentStorage.saveMany([file]);
        const comment = Object.freeze({
          id: crypto.randomUUID(),
          body,
          createdAt: new Date().toISOString(),
          attachments: Object.freeze([attachment]),
        });
        try {
          if (!(await taskRepository.addComment(task.id, comment))) throw new Error("Task not found");
          return context.json({ comment, attachment }, 201);
        } catch {
          await attachmentStorage.remove(attachment.id);
          return context.json({ error: "Could not create test attachment" }, 500);
        }
      }
      return context.json({ error: "Unsupported test entity" }, 400);
    });
  }

  app.post("/tasks/:id/comments", bodyLimit({ maxSize: 26 * 1024 * 1024 }), async (context) => {
    if (!attachmentStorageAvailable) return context.json({ error: "Attachments are disabled" }, 503);
    const taskRepository = repositoryFor(context.get("userId"));
    const taskId = context.req.param("id");
    const task = (await taskRepository.list()).find((item) => item.id === taskId);
    if (task === undefined) return context.json({ error: "Task not found" }, 404);
    let form: FormData;
    try {
      form = await context.req.formData();
    } catch {
      return context.json({ error: "Invalid multipart form" }, 400);
    }
    const body = String(form.get("body") ?? "").trim();
    const files = form
      .getAll("files")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);
    if (body.length > 5000 || (!body && files.length === 0))
      return context.json({ error: "Comment text or at least one attachment is required" }, 400);
    const fileValidation = validateAttachmentFiles(files);
    if (fileValidation === "invalid-file")
      return context.json({ error: "Unsupported filename or MIME type" }, 400);
    if (fileValidation === "limits-exceeded")
      return context.json({ error: "Attachment limits exceeded (10 files, 10 MB each, 25 MB total)" }, 413);
    let attachments: ReadonlyArray<AttachmentMetadata> | undefined;
    try {
      attachments = await attachmentStorage.saveMany(files);
      const comment = Object.freeze({
        id: crypto.randomUUID(),
        body,
        createdAt: new Date().toISOString(),
        ...(attachments.length ? { attachments: Object.freeze(attachments) } : {}),
      });
      if (!(await taskRepository.addComment(taskId, comment))) throw new Error("Task not found");
      return context.json({ comment }, 201);
    } catch {
      await attachmentStorage.removeMany(attachments?.map((attachment) => attachment.id) ?? []);
      return context.json({ error: "Could not save comment and attachments" }, 500);
    }
  });

  app.get("/attachments/:id", async (context) => {
    if (!attachmentStorageAvailable) return context.json({ error: "Attachments are disabled" }, 503);
    const id = context.req.param("id");
    const uuid = /^[0-9a-f-]{36}$/i.test(id);
    if (!uuid) return context.json({ error: "Attachment not found" }, 404);
    const tasks = await repositoryFor(context.get("userId")).list();
    const attachment = tasks
      .flatMap((task) =>
        task.comments.flatMap((comment) =>
          (comment.attachments ?? [])
            .filter((item) => item.id === id)
            .map((item) => ({ item, taskId: task.id })),
        ),
      )
      .at(0);
    if (attachment === undefined) return context.json({ error: "Attachment not found" }, 404);
    const contents = await attachmentStorage.read(id);
    if (contents === null) return context.json({ error: "Attachment not found" }, 404);
    const safeName = attachment.item.name.replace(/[\r\n\"\\]/g, "_");
    const safeImageType = detectSafeImageMimeType(contents);
    context.header("Content-Type", safeImageType ?? "application/octet-stream");
    context.header(
      "Content-Disposition",
      `${safeImageType === null ? "attachment" : "inline"}; filename="${safeName}"`,
    );
    context.header("X-Content-Type-Options", "nosniff");
    context.header("Content-Security-Policy", "default-src 'none'; sandbox");
    context.header("Cache-Control", "private, no-store");
    return context.body(new Uint8Array(contents));
  });

  app.post("/auth/login", async (context) => {
    const result = loginSchema.safeParse(await parseJson(context.req.raw));
    if (!result.success) {
      return context.json({ error: "Invalid username or password" }, 401);
    }

    const user = await userRepository.getByUsername(result.data.username.trim().toLowerCase());
    if (
      user === null ||
      user.passwordHash === null ||
      !(await verifyPassword(result.data.password, user.passwordHash))
    ) {
      return context.json({ error: "Invalid username or password" }, 401);
    }

    const token = createSessionToken();
    const tokenHash = hashSessionToken(token);
    const expiresAt = new Date(Date.now() + sessionLifetimeSeconds * 1000);

    await userRepository.saveSession(tokenHash, user.id, expiresAt);
    setCookie(context, sessionCookieName, token, {
      httpOnly: true,
      secure: secureCookies,
      sameSite: "Lax",
      path: "/",
      maxAge: sessionLifetimeSeconds,
    });
    context.header("Cache-Control", "no-store");

    return context.json({ authenticated: true });
  });

  app.post("/auth/logout", async (context) => {
    const token = getCookie(context, sessionCookieName);

    if (token !== undefined) {
      await userRepository.deleteSession(hashSessionToken(token));
    }

    deleteCookie(context, sessionCookieName, {
      httpOnly: true,
      secure: secureCookies,
      sameSite: "Lax",
      path: "/",
    });
    return context.json({ authenticated: false });
  });

  app.get("/settings", async (context) => {
    const user = await userRepository.getById(context.get("userId"));
    if (user === null) return context.json({ error: "User not found" }, 404);
    context.header("Cache-Control", "no-store");
    return context.json({
      settings: { confirmDelete: user.confirmDelete, accessMode: "password", username: user.username },
      currentUser: { id: user.id, username: user.username, isAdmin: user.isAdmin },
    });
  });

  app.put("/settings", async (context) => {
    const result = updateSettingsSchema.safeParse(await parseJson(context.req.raw));

    if (!result.success) {
      return context.json({ error: "Invalid settings" }, 400);
    }

    const userId = context.get("userId");
    const user = await userRepository.getById(userId);
    if (user === null) return context.json({ error: "User not found" }, 404);
    await userRepository.savePreferences(userId, result.data.confirmDelete);
    context.header("Cache-Control", "no-store");
    return context.json({
      settings: { confirmDelete: result.data.confirmDelete, accessMode: "password", username: user.username },
    });
  });

  app.patch("/auth/account", async (context) => {
    const result = updateAccountSchema.safeParse(await parseJson(context.req.raw));
    if (!result.success) return context.json({ error: "Invalid account payload" }, 400);
    const userId = context.get("userId");
    try {
      const updated = await userRepository.update(userId, {
        ...(result.data.username === undefined ? {} : { username: result.data.username.toLowerCase() }),
        ...(result.data.password === undefined
          ? {}
          : { passwordHash: await hashPassword(result.data.password) }),
      });
      if (updated === null) return context.json({ error: "Username already exists" }, 409);
      return context.json({ user: updated });
    } catch {
      return context.json({ error: "Username already exists" }, 409);
    }
  });

  app.get("/users", async (context) => {
    if (!context.get("authenticated") || !(await requireAdmin(context.get("userId"))))
      return context.json({ error: "Administrator access required" }, 403);
    return context.json({ users: await userRepository.list() });
  });
  app.post("/users", async (context) => {
    const administrator = await userRepository.getById(context.get("userId"));
    if (!context.get("authenticated") || administrator?.isAdmin !== true)
      return context.json({ error: "Administrator access required" }, 403);
    if (administrator.passwordHash === null)
      return context.json({ error: "Set a password for this administrator before creating users" }, 409);
    const result = createUserSchema.safeParse(await parseJson(context.req.raw));
    if (!result.success) return context.json({ error: "Invalid user payload" }, 400);
    try {
      const user = await userRepository.create(
        result.data.username.toLowerCase(),
        await hashPassword(result.data.password),
        result.data.isAdmin,
      );
      return context.json({ user }, 201);
    } catch {
      return context.json({ error: "Username already exists" }, 409);
    }
  });
  app.patch("/users/:id", async (context) => {
    if (!context.get("authenticated") || !(await requireAdmin(context.get("userId"))))
      return context.json({ error: "Administrator access required" }, 403);
    const result = updateUserSchema.safeParse(await parseJson(context.req.raw));
    if (!result.success) return context.json({ error: "Invalid user payload" }, 400);
    const userId = context.req.param("id");
    const target = await userRepository.getById(userId);
    if (target === null) return context.json({ error: "User not found" }, 404);
    if (
      target.isAdmin &&
      result.data.isAdmin === false &&
      (await userRepository.list()).filter((user) => user.isAdmin).length < 2
    )
      return context.json({ error: "At least one administrator is required" }, 409);
    try {
      const updated = await userRepository.update(userId, {
        ...(result.data.username === undefined ? {} : { username: result.data.username.toLowerCase() }),
        ...(result.data.password === undefined
          ? {}
          : { passwordHash: await hashPassword(result.data.password) }),
        ...(result.data.isAdmin === undefined ? {} : { isAdmin: result.data.isAdmin }),
      });
      return updated === null
        ? context.json({ error: "Username already exists" }, 409)
        : context.json({ user: updated });
    } catch {
      return context.json({ error: "Username already exists" }, 409);
    }
  });
  app.delete("/users/:id", async (context) => {
    if (!context.get("authenticated") || !(await requireAdmin(context.get("userId"))))
      return context.json({ error: "Administrator access required" }, 403);
    const userId = context.req.param("id");
    const target = await userRepository.getById(userId);
    if (target === null) return context.json({ error: "User not found" }, 404);
    if (target.isAdmin && (await userRepository.list()).filter((user) => user.isAdmin).length < 2)
      return context.json({ error: "At least one administrator is required" }, 409);
    if (attachmentStorageAvailable) {
      const attachmentIds = (await repositoryFor(userId).list()).flatMap((task) =>
        task.comments.flatMap((comment) => comment.attachments?.map((attachment) => attachment.id) ?? []),
      );
      await attachmentStorage.removeMany(attachmentIds);
    }
    await userRepository.delete(userId);
    return context.json({ deleted: true });
  });

  app.get("/inbox/description", async (context) =>
    context.json({
      description: (await userRepository.getById(context.get("userId")))?.inboxDescription ?? "",
    }),
  );
  app.put("/inbox/description", async (context) => {
    const result = inboxDescriptionSchema.safeParse(await parseJson(context.req.raw));
    if (!result.success) return context.json({ error: "Invalid Inbox description" }, 400);
    const user = await userRepository.getById(context.get("userId"));
    if (user === null) return context.json({ error: "User not found" }, 404);
    await userRepository.savePreferences(user.id, user.confirmDelete, result.data.description);
    return context.json({ description: result.data.description });
  });

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
