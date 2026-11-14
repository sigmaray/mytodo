/** Постоянный UUID встроенной учётной записи администратора по умолчанию. */
export const defaultAdminUserId = "00000000-0000-4000-8000-000000000001";

/** Полная внутренняя запись пользователя с секретами и личными настройками. */
export type UserRecord = {
  /** UUID для связей задач, сессий и других пользовательских данных. */
  id: string;
  /** Имя, используемое при входе. */
  username: string;
  /** Хеш пароля или `null`, если пароль ещё не настроен. */
  passwordHash: string | null;
  /** Признак права управлять учётными записями. */
  isAdmin: boolean;
  /** Настройка подтверждения удаления. */
  confirmDelete: boolean;
  /** Описание личного списка Входящие. */
  inboxDescription: string;
};

/** Публичные поля пользователя, которые можно возвращать клиенту. */
export type PublicUser = { id: string; username: string; isAdmin: boolean };

/** Операции для хранения пользователей, их настроек, паролей и сессий. */
export type UserRepository = {
  /** Ищет пользователя по имени входа без учёта регистра. */
  getByUsername: (username: string) => Promise<UserRecord | null>;
  /** Ищет пользователя по UUID. */
  getById: (id: string) => Promise<UserRecord | null>;
  /** Возвращает публичный список пользователей без паролей и настроек. */
  list: () => Promise<Array<PublicUser>>;
  /** Создаёт аккаунт пользователя с заранее захешированным паролем. */
  create: (username: string, passwordHash: string, isAdmin: boolean) => Promise<PublicUser>;
  /** Обновляет переданные поля аккаунта. */
  update: (
    /** Идентификатор пользователя. */
    id: string,
    /** Новые значения аккаунта; поля, которых нет, остаются без изменений. */
    patch: {
      /** Новое имя входа пользователя. */
      username?: string;
      /** Новый хеш пароля, уже рассчитанный auth-модулем. */
      passwordHash?: string;
      /** Новое значение административной роли. */
      isAdmin?: boolean;
    },
  ) => Promise<PublicUser | null>;
  /** Меняет пароль и отзывает активные сессии пользователя. */
  setPassword: (id: string, passwordHash: string) => Promise<boolean>;
  /** Удаляет пользователя и его сессии. */
  delete: (id: string) => Promise<boolean>;
  /** Проверяет, существует ли аккаунт с настроенным паролем. */
  hasPasswordUsers: () => Promise<boolean>;
  /** Сохраняет хеш токена и срок действия сессии. */
  saveSession: (tokenHash: string, userId: string, expiresAt: Date) => Promise<void>;
  /** Возвращает пользователя действующей сессии или `null`. */
  getSessionUserId: (tokenHash: string, now: Date) => Promise<string | null>;
  /** Удаляет одну сессию по хешу токена. */
  deleteSession: (tokenHash: string) => Promise<void>;
  /** Отзывает все сессии пользователя. */
  deleteAllSessions: (userId: string) => Promise<void>;
  /** Сохраняет настройки подтверждения удаления и/или описание Входящих. */
  savePreferences: (id: string, confirmDelete: boolean, inboxDescription?: string) => Promise<void>;
  /** Освобождает соединения и ресурсы репозитория. */
  close: () => Promise<void>;
};

/** Создаёт изолированное in-memory хранилище пользователей для разработки и тестов. */
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
  // Копируем исходные записи, чтобы последующие изменения не меняли аргумент вызова.
  let users = initial.map((user) => ({ ...user }));
  // В памяти хранятся только хеши токенов сессий, не исходные секреты.
  let sessions = [] as Array<{ tokenHash: string; userId: string; expiresAt: Date }>;

  return {
    getByUsername: async (username) =>
      users.find((user) => user.username.toLowerCase() === username.toLowerCase()) ?? null,
    getById: async (id) => users.find((user) => user.id === id) ?? null,
    list: async () => users.map(({ id, username, isAdmin }) => ({ id, username, isAdmin })),
    create: async (username, passwordHash, isAdmin) => {
      // Сравнение без учёта регистра повторяет уникальность имён в базе данных.
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
      // Не меняем учётную запись, если пользователь отсутствует или имя уже занято.
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
      // Смена пароля отзывает все активные сессии пользователя.
      if (patch.passwordHash !== undefined) sessions = sessions.filter((session) => session.userId !== id);
      return { id: updated.id, username: updated.username, isAdmin: updated.isAdmin };
    },
    setPassword: async (id, passwordHash) => {
      // Смена пароля должна немедленно завершить прежние сессии пользователя.
      if (!users.some((user) => user.id === id)) return false;
      users = users.map((user) => (user.id === id ? { ...user, passwordHash } : user));
      sessions = sessions.filter((session) => session.userId !== id);
      return true;
    },
    delete: async (id) => {
      // Вместе с пользователем удаляем связанные с ним сессии.
      const exists = users.some((user) => user.id === id);
      users = users.filter((user) => user.id !== id);
      sessions = sessions.filter((session) => session.userId !== id);
      return exists;
    },
    hasPasswordUsers: async () => users.some((user) => user.passwordHash !== null),
    saveSession: async (tokenHash, userId, expiresAt) => {
      // Повторная запись того же токена заменяет его прежнюю привязку и срок действия.
      sessions = [
        ...sessions.filter((session) => session.tokenHash !== tokenHash),
        { tokenHash, userId, expiresAt },
      ];
    },
    // Просроченные сессии не удостоверяют личность пользователя.
    getSessionUserId: async (tokenHash, now) =>
      sessions.find((session) => session.tokenHash === tokenHash && session.expiresAt > now)?.userId ?? null,
    deleteSession: async (tokenHash) => {
      sessions = sessions.filter((session) => session.tokenHash !== tokenHash);
    },
    deleteAllSessions: async (userId) => {
      sessions = sessions.filter((session) => session.userId !== userId);
    },
    savePreferences: async (id, confirmDelete, inboxDescription) => {
      // Не переданное описание оставляет прежнее значение без изменений.
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
