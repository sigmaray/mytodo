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
 * Registers login, account settings, and administrative user routes.
 *
 * @param {AppHono} app
 * @param {{ userRepository: UserRepository; repositoryFor: RepositoryForUser; secureCookies: boolean; attachmentsEnabled: boolean; projectArchivingEnabled: boolean; attachmentStorageAvailable: boolean; attachmentStorage: AttachmentStorage; requireAdmin: (userId: string) => Promise<boolean>; }} dependencies
 * @param {UserRepository} dependencies.userRepository - Store for accounts and user sessions.
 * @param {RepositoryForUser} dependencies.repositoryFor - Returns the data repository owned by the specified user.
 * @param {boolean} dependencies.secureCookies - Enables the Secure flag on issued session cookies.
 * @param {boolean} dependencies.attachmentsEnabled - Tells the client whether file uploads are available.
 * @param {boolean} dependencies.projectArchivingEnabled - Tells the client whether project archiving is available.
 * @param {boolean} dependencies.attachmentStorageAvailable - Whether the file backend is ready to handle attachments.
 * @param {AttachmentStorage} dependencies.attachmentStorage - Performs file operations for comment attachments.
 * @param {(userId: string) => Promise<boolean>} dependencies.requireAdmin - Checks the user's administrator privileges.
 */
export const registerAuthRoutes = (
  app: AppHono,
  dependencies: {
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
  /** Shared dependencies give routes access to users and their data without direct database access. */
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
    /** Return the authentication status and safe details about the current user. */
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
    /** Validate the submitted credentials and create a session only after the password is verified. */
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
    /** Revoke the server session and clear the browser cookie. */
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
    /** Read settings only from the authenticated user's record. */
    const user = await userRepository.getById(context.get("userId"));
    if (user === null) return context.json({ error: "User not found" }, 404);
    context.header("Cache-Control", "no-store");
    return context.json({
      settings: { confirmDelete: user.confirmDelete, accessMode: "password", username: user.username },
      currentUser: { id: user.id, username: user.username, isAdmin: user.isAdmin },
    });
  });

  app.put("/settings", async (context) => {
    /** Validate settings before writing them to the user store. */
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
    /** Users do not need administrator privileges to change their own credentials. */
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
    /** Only administrators can list users. */
    if (!context.get("authenticated") || !(await requireAdmin(context.get("userId"))))
      return context.json({ error: "Administrator access required" }, 403);
    return context.json({ users: await userRepository.list() });
  });
  app.post("/users", async (context) => {
    /** An administrator creates a user with validated data and a hashed password. */
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
    /** Allow changes only to fields defined by the user update schema. */
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
    /** Prevent an administrator from deleting their own current account. */
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
    /** Store the Inbox description separately from the user's task list. */
    const result = inboxDescriptionSchema.safeParse(await parseJson(context.req.raw));
    if (!result.success) return context.json({ error: "Invalid Inbox description" }, 400);
    const user = await userRepository.getById(context.get("userId"));
    if (user === null) return context.json({ error: "User not found" }, 404);
    await userRepository.savePreferences(user.id, user.confirmDelete, result.data.description);
    return context.json({ description: result.data.description });
  });
};
