/** Stable UUID for the built-in default administrator account. */
export const defaultAdminUserId = "00000000-0000-4000-8000-000000000001";

/**
 * Full internal user record, including secrets and personal settings.
 *
 * @typedef {Object} UserRecord
 * @property {string} id - Unique user identifier.
 * @property {string} username - Account username.
 * @property {string | null} passwordHash - Password hash; the plaintext password is never stored.
 * @property {boolean} isAdmin - Whether the user is an administrator.
 * @property {boolean} confirmDelete - Whether to ask for confirmation before deleting.
 * @property {string} inboxDescription - Description of the Inbox.
 */
export type UserRecord = {
  id: string;

  username: string;

  passwordHash: string | null;

  isAdmin: boolean;

  confirmDelete: boolean;

  inboxDescription: string;
};

/**
 * Public user fields that can be returned to the client.
 *
 * @typedef {Object} PublicUser
 * @property {string} id - Unique user identifier.
 * @property {string} username - Account username.
 * @property {boolean} isAdmin - Whether the user is an administrator.
 */
export type PublicUser = { id: string; username: string; isAdmin: boolean };

/**
 * Finds a user by login name, ignoring letter case.
 *
 * @callback UserRepositoryGetByUsername
 * @param {string} username
 * @returns {Promise<UserRecord | null>}
 */

/**
 * Finds a user by UUID.
 *
 * @callback UserRepositoryGetById
 * @param {string} id
 * @returns {Promise<UserRecord | null>}
 */

/**
 * Returns the public user list without passwords or settings.
 *
 * @callback UserRepositoryList
 * @returns {Promise<Array<PublicUser>>}
 */

/**
 * Creates a user account with a previously hashed password.
 *
 * @callback UserRepositoryCreate
 * @param {string} username
 * @param {string} passwordHash
 * @param {boolean} isAdmin
 * @returns {Promise<PublicUser>}
 */

/**
 * Updates the supplied account fields.
 *
 * @callback UserRepositoryUpdate
 * @param {string} id
 * @param {{ username?: string; passwordHash?: string; isAdmin?: boolean; }} patch
 * @param {string} patch.username - New username.
 * @param {string} patch.passwordHash - New password hash.
 * @param {boolean} patch.isAdmin - Whether the user is an administrator.
 * @returns {Promise<PublicUser | null>}
 */

/**
 * Changes the password and revokes the user's active sessions.
 *
 * @callback UserRepositorySetPassword
 * @param {string} id
 * @param {string} passwordHash
 * @returns {Promise<boolean>}
 */

/**
 * Deletes a user and their sessions.
 *
 * @callback UserRepositoryDelete
 * @param {string} id
 * @returns {Promise<boolean>}
 */

/**
 * Checks whether any account has a configured password.
 *
 * @callback UserRepositoryHasPasswordUsers
 * @returns {Promise<boolean>}
 */

/**
 * Stores a session token hash and its expiration time.
 *
 * @callback UserRepositorySaveSession
 * @param {string} tokenHash
 * @param {string} userId
 * @param {Date} expiresAt
 * @returns {Promise<void>}
 */

/**
 * Returns the user for an active session, or `null`.
 *
 * @callback UserRepositoryGetSessionUserId
 * @param {string} tokenHash
 * @param {Date} now
 * @returns {Promise<string | null>}
 */

/**
 * Deletes one session by its token hash.
 *
 * @callback UserRepositoryDeleteSession
 * @param {string} tokenHash
 * @returns {Promise<void>}
 */

/**
 * Revokes all sessions belonging to a user.
 *
 * @callback UserRepositoryDeleteAllSessions
 * @param {string} userId
 * @returns {Promise<void>}
 */

/**
 * Saves deletion confirmation settings and/or the Inbox description.
 *
 * @callback UserRepositorySavePreferences
 * @param {string} id
 * @param {boolean} confirmDelete
 * @param {string} [inboxDescription]
 * @returns {Promise<void>}
 */

/**
 * Releases repository connections and resources.
 *
 * @callback UserRepositoryClose
 * @returns {Promise<void>}
 */
/**
 * Operations for storing users, their settings, passwords, and sessions.
 *
 * @typedef {Object} UserRepository
 * @property {UserRepositoryGetByUsername} getByUsername - Finds an account by login name.
 * @property {UserRepositoryGetById} getById - Finds an account by ID.
 * @property {UserRepositoryList} list - Returns all accounts.
 * @property {UserRepositoryCreate} create - Creates an account.
 * @property {UserRepositoryUpdate} update - Updates the login name and administrator privileges.
 * @property {UserRepositorySetPassword} setPassword - Stores a new password hash.
 * @property {UserRepositoryDelete} delete - Deletes an account and its related data.
 * @property {UserRepositoryHasPasswordUsers} hasPasswordUsers - Checks whether any account has a configured password.
 * @property {UserRepositorySaveSession} saveSession - Stores a user session.
 * @property {UserRepositoryGetSessionUserId} getSessionUserId - Returns the owner of an active session.
 * @property {UserRepositoryDeleteSession} deleteSession - Ends one user session.
 * @property {UserRepositoryDeleteAllSessions} deleteAllSessions - Ends all user sessions.
 * @property {UserRepositorySavePreferences} savePreferences - Saves user settings.
 * @property {UserRepositoryClose} close - Releases user repository resources.
 */
export type UserRepository = {
  getByUsername: (username: string) => Promise<UserRecord | null>;

  getById: (id: string) => Promise<UserRecord | null>;

  list: () => Promise<Array<PublicUser>>;

  create: (username: string, passwordHash: string, isAdmin: boolean) => Promise<PublicUser>;

  update: (
    id: string,

    patch: {
      username?: string;

      passwordHash?: string;

      isAdmin?: boolean;
    },
  ) => Promise<PublicUser | null>;

  setPassword: (id: string, passwordHash: string) => Promise<boolean>;

  delete: (id: string) => Promise<boolean>;

  hasPasswordUsers: () => Promise<boolean>;

  saveSession: (tokenHash: string, userId: string, expiresAt: Date) => Promise<void>;

  getSessionUserId: (tokenHash: string, now: Date) => Promise<string | null>;

  deleteSession: (tokenHash: string) => Promise<void>;

  deleteAllSessions: (userId: string) => Promise<void>;

  savePreferences: (id: string, confirmDelete: boolean, inboxDescription?: string) => Promise<void>;

  close: () => Promise<void>;
};

/**
 * Creates an isolated in-memory user store for development and tests.
 *
 * @param {Array<UserRecord>} [initial]
 * @returns {UserRepository}
 */
export const createMemoryUserRepository = (
  initial: Array<UserRecord> = [
    {
      id: defaultAdminUserId,
      username: "admin",
      passwordHash: null,
      isAdmin: true,
      confirmDelete: true,
      inboxDescription: "",
    },
  ],
): UserRepository => {
  /** Copy the initial records so later updates do not mutate the argument. */
  let users = initial.map((user) => ({ ...user }));
  /** Store only session token hashes in memory, never the original secrets. */
  let sessions = [] as Array<{ tokenHash: string; userId: string; expiresAt: Date }>;

  return {
    getByUsername: async (username) =>
      users.find((user) => user.username.toLowerCase() === username.toLowerCase()) ?? null,
    getById: async (id) => users.find((user) => user.id === id) ?? null,
    list: async () => users.map(({ id, username, isAdmin }) => ({ id, username, isAdmin })),
    create: async (username, passwordHash, isAdmin) => {
      /** Case-insensitive comparison matches the database username constraint. */
      if (users.some((user) => user.username.toLowerCase() === username.toLowerCase()))
        throw new Error("Username already exists");
      const user = {
        id: crypto.randomUUID(),
        username,
        passwordHash,
        isAdmin,
        confirmDelete: true,
        inboxDescription: "",
      };
      users = [...users, user];
      return { id: user.id, username: user.username, isAdmin: user.isAdmin };
    },
    update: async (id, patch) => {
      /** Do not update the account if the user is missing or the name is already taken. */
      const existing = users.find((user) => user.id === id);
      const nextUsername = patch.username;
      if (
        existing === undefined ||
        (nextUsername !== undefined &&
          users.some((user) => user.id !== id && user.username.toLowerCase() === nextUsername.toLowerCase()))
      )
        return null;
      const updated = { ...existing, ...patch };
      users = users.map((user) => (user.id === id ? updated : user));
      /** Changing a password revokes all active sessions for that user. */
      if (patch.passwordHash !== undefined) sessions = sessions.filter((session) => session.userId !== id);
      return { id: updated.id, username: updated.username, isAdmin: updated.isAdmin };
    },
    setPassword: async (id, passwordHash) => {
      /** Password changes must immediately end the user's existing sessions. */
      if (!users.some((user) => user.id === id)) return false;
      users = users.map((user) => (user.id === id ? { ...user, passwordHash } : user));
      sessions = sessions.filter((session) => session.userId !== id);
      return true;
    },
    delete: async (id) => {
      /** Delete the user's sessions along with the account. */
      const exists = users.some((user) => user.id === id);
      users = users.filter((user) => user.id !== id);
      sessions = sessions.filter((session) => session.userId !== id);
      return exists;
    },
    hasPasswordUsers: async () => users.some((user) => user.passwordHash !== null),
    saveSession: async (tokenHash, userId, expiresAt) => {
      /** Saving the same token again replaces its previous user mapping and expiration. */
      sessions = [
        ...sessions.filter((session) => session.tokenHash !== tokenHash),
        { tokenHash, userId, expiresAt },
      ];
    },
    /** Expired sessions cannot authenticate a user. */
    getSessionUserId: async (tokenHash, now) =>
      sessions.find((session) => session.tokenHash === tokenHash && session.expiresAt > now)?.userId ?? null,
    deleteSession: async (tokenHash) => {
      sessions = sessions.filter((session) => session.tokenHash !== tokenHash);
    },
    deleteAllSessions: async (userId) => {
      sessions = sessions.filter((session) => session.userId !== userId);
    },
    savePreferences: async (id, confirmDelete, inboxDescription) => {
      /** An omitted description leaves the existing value unchanged. */
      users = users.map((user) =>
        user.id === id
          ? {
              ...user,
              confirmDelete,
              inboxDescription: inboxDescription ?? user.inboxDescription,
            }
          : user,
      );
    },
    close: async () => undefined,
  };
};
