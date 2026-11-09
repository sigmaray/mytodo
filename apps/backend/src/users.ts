export const defaultAdminUserId = "00000000-0000-4000-8000-000000000001";

export type UserRecord = Readonly<{
  id: string;
  username: string;
  passwordHash: string | null;
  isAdmin: boolean;
  confirmDelete: boolean;
  inboxDescription: string;
}>;

export type PublicUser = Readonly<{ id: string; username: string; isAdmin: boolean }>;

export type UserRepository = Readonly<{
  getByUsername: (username: string) => Promise<UserRecord | null>;
  getById: (id: string) => Promise<UserRecord | null>;
  list: () => Promise<ReadonlyArray<PublicUser>>;
  create: (username: string, passwordHash: string, isAdmin: boolean) => Promise<PublicUser>;
  update: (
    id: string,
    patch: Readonly<{ username?: string; passwordHash?: string; isAdmin?: boolean }>,
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
}>;

export const createMemoryUserRepository = (
  initial: ReadonlyArray<UserRecord> = Object.freeze([
    Object.freeze({
      id: defaultAdminUserId,
      username: "admin",
      passwordHash: null,
      isAdmin: true,
      confirmDelete: true,
      inboxDescription: "",
    }),
  ]),
): UserRepository => {
  let users = Object.freeze(initial.map((user) => Object.freeze({ ...user })));
  let sessions = Object.freeze(
    [] as ReadonlyArray<Readonly<{ tokenHash: string; userId: string; expiresAt: Date }>>,
  );

  return Object.freeze({
    getByUsername: async (username) =>
      users.find((user) => user.username.toLowerCase() === username.toLowerCase()) ?? null,
    getById: async (id) => users.find((user) => user.id === id) ?? null,
    list: async () =>
      Object.freeze(users.map(({ id, username, isAdmin }) => Object.freeze({ id, username, isAdmin }))),
    create: async (username, passwordHash, isAdmin) => {
      if (users.some((user) => user.username.toLowerCase() === username.toLowerCase()))
        throw new Error("Username already exists");
      const user = Object.freeze({
        id: crypto.randomUUID(),
        username,
        passwordHash,
        isAdmin,
        confirmDelete: true,
        inboxDescription: "",
      });
      users = Object.freeze([...users, user]);
      return Object.freeze({ id: user.id, username: user.username, isAdmin: user.isAdmin });
    },
    update: async (id, patch) => {
      const existing = users.find((user) => user.id === id);
      const nextUsername = patch.username;
      if (
        existing === undefined ||
        (nextUsername !== undefined &&
          users.some((user) => user.id !== id && user.username.toLowerCase() === nextUsername.toLowerCase()))
      )
        return null;
      const updated = Object.freeze({ ...existing, ...patch });
      users = Object.freeze(users.map((user) => (user.id === id ? updated : user)));
      if (patch.passwordHash !== undefined)
        sessions = Object.freeze(sessions.filter((session) => session.userId !== id));
      return Object.freeze({ id: updated.id, username: updated.username, isAdmin: updated.isAdmin });
    },
    setPassword: async (id, passwordHash) => {
      if (!users.some((user) => user.id === id)) return false;
      users = Object.freeze(
        users.map((user) => (user.id === id ? Object.freeze({ ...user, passwordHash }) : user)),
      );
      sessions = Object.freeze(sessions.filter((session) => session.userId !== id));
      return true;
    },
    delete: async (id) => {
      const exists = users.some((user) => user.id === id);
      users = Object.freeze(users.filter((user) => user.id !== id));
      sessions = Object.freeze(sessions.filter((session) => session.userId !== id));
      return exists;
    },
    hasPasswordUsers: async () => users.some((user) => user.passwordHash !== null),
    saveSession: async (tokenHash, userId, expiresAt) => {
      sessions = Object.freeze([
        ...sessions.filter((session) => session.tokenHash !== tokenHash),
        Object.freeze({ tokenHash, userId, expiresAt }),
      ]);
    },
    getSessionUserId: async (tokenHash, now) =>
      sessions.find((session) => session.tokenHash === tokenHash && session.expiresAt > now)?.userId ?? null,
    deleteSession: async (tokenHash) => {
      sessions = Object.freeze(sessions.filter((session) => session.tokenHash !== tokenHash));
    },
    deleteAllSessions: async (userId) => {
      sessions = Object.freeze(sessions.filter((session) => session.userId !== userId));
    },
    savePreferences: async (id, confirmDelete, inboxDescription) => {
      users = Object.freeze(
        users.map((user) =>
          user.id === id
            ? Object.freeze({
                ...user,
                confirmDelete,
                inboxDescription: inboxDescription ?? user.inboxDescription,
              })
            : user,
        ),
      );
    },
    close: async () => undefined,
  });
};
