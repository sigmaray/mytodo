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

/** Собирает Hono API, подключая аутентификацию и маршруты приложения. */
export const createApp = (
  repository: TaskRepository | ((userId: string) => TaskRepository) = createMemoryTaskRepository(),
  options: {
    /** URL PostgreSQL для production-репозитория и административных инструментов. */
    databaseUrl?: string;
    /** Режим запуска; production включает защищённые настройки по умолчанию. */
    mode?: string;
    /** Явное переопределение Secure-флага сессионной cookie. */
    secureCookies?: boolean;
    /** Хранилище аккаунтов; по умолчанию используется реализация в памяти. */
    userRepository?: UserRepository;
    /** Каталог приватного хранения файлов комментариев. */
    attachmentsDir?: string;
    /** Разрешает работу с вложениями при настроенном хранилище. */
    attachmentsEnabled?: boolean;
    /** Разрешает операции архивирования проектов. */
    projectArchivingEnabled?: boolean;
    /** Включает вспомогательный API подготовки Playwright-тестов. */
    playwrightApiEnabled?: boolean;
  } = {},
) => {
  // Контекст запроса хранит пользователя, установленного ниже middleware аутентификации.
  const app = new Hono<{ Variables: { userId: string; authenticated: boolean } }>();
  const userRepository = options.userRepository ?? createMemoryUserRepository();
  // В production cookie защищена флагом Secure, если настройка явно не переопределена.
  const secureCookies = options.secureCookies ?? options.mode === "production";
  const attachmentStorage = createAttachmentStorage(options.attachmentsDir ?? null);
  const attachmentsEnabled = (options.attachmentsEnabled ?? true) && attachmentStorage.enabled;
  const attachmentStorageAvailable = attachmentsEnabled;
  const projectArchivingEnabled = options.projectArchivingEnabled === true;
  const playwrightApiEnabled = options.playwrightApiEnabled === true;
  // API Playwright доступен только для изолированной тестовой базы вне production-среды.
  if (playwrightApiEnabled && options.mode === "production")
    throw new Error("The Playwright API cannot be enabled in production");
  if (playwrightApiEnabled && options.databaseUrl === undefined)
    throw new Error("The Playwright API requires a database URL");
  const playwrightDatabase =
    playwrightApiEnabled && options.databaseUrl !== undefined
      ? postgres(options.databaseUrl, { max: 1 })
      : null;
  // Один репозиторий подходит тестам с общими данными; фабрика изолирует данные по пользователям.
  const repositoryFor = (userId: string) =>
    typeof repository === "function" ? repository(userId) : repository;
  /** Проверяет административные права для защищённых настроек и инструментов. */
  const requireAdmin = async (userId: string) => {
    const user = await userRepository.getById(userId);
    return user?.isAdmin === true;
  };

  app.use("*", cors());

  app.use("*", async (context, next) => {
    // Публичные auth-маршруты и preflight-запросы не требуют активной сессии.
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

    // До настройки первого пароля администратором API блокируется, кроме маршрутов входа.
    if (!(await userRepository.hasPasswordUsers())) {
      return context.json({ error: "Administrator password must be configured before using the API" }, 503);
    }

    // В хранилище проверяется хеш токена, а не значение cookie в открытом виде.
    const token = getCookie(context, sessionCookieName);
    const userId =
      token === undefined ? null : await userRepository.getSessionUserId(hashSessionToken(token), new Date());

    if (userId === null || (await userRepository.getById(userId)) === null) {
      return context.json({ error: "Authentication required" }, 401);
    }

    // После проверки сессии передаём идентификатор пользователя маршрутам ниже по цепочке.
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
      // Инструменты работы с базой доступны только вошедшему администратору.
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
    // Собираем дерево удаляемой задачи, чтобы после каскадного удаления очистить файлы потомков.
    const taskRepository = repositoryFor(context.get("userId"));
    const allTasks = await taskRepository.list();
    const collect = (id: string): Array<string> => [
      id,
      ...allTasks.filter((task) => task.parentId === id).flatMap((task) => collect(task.id)),
    ];
    // Репозиторий удаляет задачу вместе с потомками; здесь заранее запоминаем их вложения.
    const descendantIds = new Set(collect(context.req.param("id")));
    const removedAttachmentIds = allTasks
      .filter((task) => descendantIds.has(task.id))
      .flatMap((task) =>
        task.comments.flatMap((comment) => comment.attachments?.map((attachment) => attachment.id) ?? []),
      );
    // Файлы удаляются только после успешного удаления записей, чтобы не потерять доступные вложения.
    const deleted = await taskRepository.delete(context.req.param("id"));
    if (deleted && attachmentStorageAvailable) await attachmentStorage.removeMany(removedAttachmentIds);

    return deleted ? context.json({ deleted: true }) : context.json({ error: "Task not found" }, 404);
  });

  return app;
};
