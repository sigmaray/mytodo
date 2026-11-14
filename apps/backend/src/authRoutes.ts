import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import {
  createUserSchema,
  inboxDescriptionSchema,
  loginSchema,
  parseJson,
  updateAccountSchema,
  updateSettingsSchema,
  updateUserSchema,
} from "./appSchemas";
import type { AppHono, RepositoryForUser } from "./appTypes";
import type { AttachmentStorage } from "./attachmentStorage";
import {
  createSessionToken,
  hashPassword,
  hashSessionToken,
  sessionCookieName,
  sessionLifetimeSeconds,
  verifyPassword,
} from "./auth";
import type { UserRepository } from "./users";
import { defaultAdminUserId } from "./users";

/**
 * Регистрирует вход, настройки аккаунта и административные маршруты пользователей.
 *
 * @param {AppHono} app
 * @param {{ userRepository: UserRepository; repositoryFor: RepositoryForUser; secureCookies: boolean; attachmentsEnabled: boolean; projectArchivingEnabled: boolean; attachmentStorageAvailable: boolean; attachmentStorage: AttachmentStorage; requireAdmin: (userId: string) => Promise<boolean>; }} dependencies
 * @param {UserRepository} dependencies.userRepository - Хранилище учётных записей и пользовательских сессий.
 * @param {RepositoryForUser} dependencies.repositoryFor - Возвращает репозиторий данных, принадлежащих указанному пользователю.
 * @param {boolean} dependencies.secureCookies - Включает Secure-флаг для выдаваемой сессионной cookie.
 * @param {boolean} dependencies.attachmentsEnabled - Показывает клиенту, доступна ли загрузка файлов.
 * @param {boolean} dependencies.projectArchivingEnabled - Показывает клиенту, доступно ли архивирование проектов.
 * @param {boolean} dependencies.attachmentStorageAvailable - Указывает, готов ли файловый backend к работе с вложениями.
 * @param {AttachmentStorage} dependencies.attachmentStorage - Выполняет файловые операции для вложений комментариев.
 * @param {(userId: string) => Promise<boolean>} dependencies.requireAdmin - Проверяет административные права пользователя.
 */
export const registerAuthRoutes = (
  app: AppHono,
  dependencies: /**
   * Поля этой структуры:
   * - `userRepository`: Хранилище учётных записей и пользовательских сессий.
   * - `repositoryFor`: Возвращает репозиторий данных, принадлежащих указанному пользователю.
   * - `secureCookies`: Включает Secure-флаг для выдаваемой сессионной cookie.
   * - `attachmentsEnabled`: Показывает клиенту, доступна ли загрузка файлов.
   * - `projectArchivingEnabled`: Показывает клиенту, доступно ли архивирование проектов.
   * - `attachmentStorageAvailable`: Указывает, готов ли файловый backend к работе с вложениями.
   * - `attachmentStorage`: Выполняет файловые операции для вложений комментариев.
   * - `requireAdmin`: Проверяет административные права пользователя.
   */
  {
    userRepository: UserRepository;

    repositoryFor: RepositoryForUser;

    secureCookies: boolean;

    attachmentsEnabled: boolean;

    projectArchivingEnabled: boolean;

    attachmentStorageAvailable: boolean;

    attachmentStorage: AttachmentStorage;

    requireAdmin: (userId: string) => Promise<boolean>;
  },
) => {
  /** Общие зависимости дают маршрутам доступ к пользователям и их данным без прямого доступа к БД. */
  const {
    userRepository,
    repositoryFor,
    secureCookies,
    attachmentsEnabled,
    projectArchivingEnabled,
    attachmentStorageAvailable,
    attachmentStorage,
    requireAdmin,
  } = dependencies;
  app.get("/auth/status", async (context) => {
    /** Возвращаем состояние входа и безопасные сведения о текущем пользователе. */
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

  app.post("/auth/login", async (context) => {
    /** Проверяем введённые данные и создаём сессию только после успешной проверки пароля. */
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
    /** Отзываем сессию на сервере и очищаем cookie в браузере. */
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
    /** Настройки читаются только из записи вошедшего пользователя. */
    const user = await userRepository.getById(context.get("userId"));
    if (user === null) return context.json({ error: "User not found" }, 404);
    context.header("Cache-Control", "no-store");
    return context.json({
      settings: { confirmDelete: user.confirmDelete, accessMode: "password", username: user.username },
      currentUser: { id: user.id, username: user.username, isAdmin: user.isAdmin },
    });
  });

  app.put("/settings", async (context) => {
    /** Валидируем обновление настроек до записи в пользовательское хранилище. */
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
    /** Изменение собственных учётных данных не требует административной роли. */
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
    /** Список пользователей доступен только администратору. */
    if (!context.get("authenticated") || !(await requireAdmin(context.get("userId"))))
      return context.json({ error: "Administrator access required" }, 403);
    return context.json({ users: await userRepository.list() });
  });
  app.post("/users", async (context) => {
    /** Администратор создаёт пользователя с проверенными данными и хешем пароля. */
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
    /** Разрешаем менять только поля, предусмотренные схемой обновления пользователя. */
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
    /** Не позволяем администратору удалить собственную текущую учётную запись. */
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
    /** Описание Входящих сохраняется отдельно от списка задач пользователя. */
    const result = inboxDescriptionSchema.safeParse(await parseJson(context.req.raw));
    if (!result.success) return context.json({ error: "Invalid Inbox description" }, 400);
    const user = await userRepository.getById(context.get("userId"));
    if (user === null) return context.json({ error: "User not found" }, 404);
    await userRepository.savePreferences(user.id, user.confirmDelete, result.data.description);
    return context.json({ description: result.data.description });
  });
};
