/** Постоянный UUID встроенной учётной записи администратора по умолчанию. */
export const defaultAdminUserId = "00000000-0000-4000-8000-000000000001";

/**
 * Полная внутренняя запись пользователя с секретами и личными настройками.
 *
 * @typedef {Object} UserRecord
 * @property {string} id - Идентификатор сущности, с которой работает модуль.
 * @property {string} username - Данные «имя пользователя», используемые типом «UserRecord».
 * @property {string | null} passwordHash - Хеш пароля; сам пароль не хранится.
 * @property {boolean} isAdmin - Признак: is административный.
 * @property {boolean} confirmDelete - Настройка подтверждения перед удалением.
 * @property {string} inboxDescription - Описание списка Входящие.
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
 * Публичные поля пользователя, которые можно возвращать клиенту.
 *
 * @typedef {Object} PublicUser
 * @property {string} id - Идентификатор сущности, с которой работает модуль.
 * @property {string} username - Данные «имя пользователя», используемые типом «PublicUser».
 * @property {boolean} isAdmin - Признак: is административный.
 */
export type PublicUser = { id: string; username: string; isAdmin: boolean };

/**
 * Ищет пользователя по имени входа без учёта регистра.
 *
 * @callback UserRepositoryGetByUsername
 * @param {string} username
 * @returns {Promise<UserRecord | null>}
 */

/**
 * Ищет пользователя по UUID.
 *
 * @callback UserRepositoryGetById
 * @param {string} id
 * @returns {Promise<UserRecord | null>}
 */

/**
 * Возвращает публичный список пользователей без паролей и настроек.
 *
 * @callback UserRepositoryList
 * @returns {Promise<Array<PublicUser>>}
 */

/**
 * Создаёт аккаунт пользователя с заранее захешированным паролем.
 *
 * @callback UserRepositoryCreate
 * @param {string} username
 * @param {string} passwordHash
 * @param {boolean} isAdmin
 * @returns {Promise<PublicUser>}
 */

/**
 * Обновляет переданные поля аккаунта.
 *
 * @callback UserRepositoryUpdate
 * @param {string} id
 * @param {{ username?: string; passwordHash?: string; isAdmin?: boolean; }} patch
 * @param {string} patch.username - Значение поля «username».
 * @param {string} patch.passwordHash - Значение поля «password hash».
 * @param {boolean} patch.isAdmin - Признак «is admin».
 * @returns {Promise<PublicUser | null>}
 */

/**
 * Меняет пароль и отзывает активные сессии пользователя.
 *
 * @callback UserRepositorySetPassword
 * @param {string} id
 * @param {string} passwordHash
 * @returns {Promise<boolean>}
 */

/**
 * Удаляет пользователя и его сессии.
 *
 * @callback UserRepositoryDelete
 * @param {string} id
 * @returns {Promise<boolean>}
 */

/**
 * Проверяет, существует ли аккаунт с настроенным паролем.
 *
 * @callback UserRepositoryHasPasswordUsers
 * @returns {Promise<boolean>}
 */

/**
 * Сохраняет хеш токена и срок действия сессии.
 *
 * @callback UserRepositorySaveSession
 * @param {string} tokenHash
 * @param {string} userId
 * @param {Date} expiresAt
 * @returns {Promise<void>}
 */

/**
 * Возвращает пользователя действующей сессии или `null`.
 *
 * @callback UserRepositoryGetSessionUserId
 * @param {string} tokenHash
 * @param {Date} now
 * @returns {Promise<string | null>}
 */

/**
 * Удаляет одну сессию по хешу токена.
 *
 * @callback UserRepositoryDeleteSession
 * @param {string} tokenHash
 * @returns {Promise<void>}
 */

/**
 * Отзывает все сессии пользователя.
 *
 * @callback UserRepositoryDeleteAllSessions
 * @param {string} userId
 * @returns {Promise<void>}
 */

/**
 * Сохраняет настройки подтверждения удаления и/или описание Входящих.
 *
 * @callback UserRepositorySavePreferences
 * @param {string} id
 * @param {boolean} confirmDelete
 * @param {string} [inboxDescription]
 * @returns {Promise<void>}
 */

/**
 * Освобождает соединения и ресурсы репозитория.
 *
 * @callback UserRepositoryClose
 * @returns {Promise<void>}
 */
/**
 * Операции для хранения пользователей, их настроек, паролей и сессий.
 *
 * @typedef {Object} UserRepository
 * @property {UserRepositoryGetByUsername} getByUsername - Ищет аккаунт по имени для входа.
 * @property {UserRepositoryGetById} getById - Ищет аккаунт по идентификатору.
 * @property {UserRepositoryList} list - Возвращает все аккаунты.
 * @property {UserRepositoryCreate} create - Создаёт новый аккаунт.
 * @property {UserRepositoryUpdate} update - Обновляет имя входа и административные права.
 * @property {UserRepositorySetPassword} setPassword - Сохраняет хеш нового пароля.
 * @property {UserRepositoryDelete} delete - Удаляет аккаунт вместе со связанными данными.
 * @property {UserRepositoryHasPasswordUsers} hasPasswordUsers - Проверяет, есть ли аккаунты с настроенным паролем.
 * @property {UserRepositorySaveSession} saveSession - Сохраняет сессию пользователя.
 * @property {UserRepositoryGetSessionUserId} getSessionUserId - Возвращает владельца действующей сессии.
 * @property {UserRepositoryDeleteSession} deleteSession - Завершает одну сессию пользователя.
 * @property {UserRepositoryDeleteAllSessions} deleteAllSessions - Завершает все сессии пользователя.
 * @property {UserRepositorySavePreferences} savePreferences - Сохраняет настройки пользователя.
 * @property {UserRepositoryClose} close - Освобождает ресурсы хранилища пользователей.
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
 * Создаёт изолированное in-memory хранилище пользователей для разработки и тестов.
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
  /** Копируем исходные записи, чтобы последующие изменения не меняли аргумент вызова. */
  let users = initial.map((user) => ({ ...user }));
  /** В памяти хранятся только хеши токенов сессий, не исходные секреты. */
  let sessions = [] as Array<{ tokenHash: string; userId: string; expiresAt: Date }>;

  return {
    getByUsername: async (username) =>
      users.find((user) => user.username.toLowerCase() === username.toLowerCase()) ?? null,
    getById: async (id) => users.find((user) => user.id === id) ?? null,
    list: async () => users.map(({ id, username, isAdmin }) => ({ id, username, isAdmin })),
    create: async (username, passwordHash, isAdmin) => {
      /** Сравнение без учёта регистра повторяет уникальность имён в базе данных. */
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
      /** Не меняем учётную запись, если пользователь отсутствует или имя уже занято. */
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
      /** Смена пароля отзывает все активные сессии пользователя. */
      if (patch.passwordHash !== undefined) sessions = sessions.filter((session) => session.userId !== id);
      return { id: updated.id, username: updated.username, isAdmin: updated.isAdmin };
    },
    setPassword: async (id, passwordHash) => {
      /** Смена пароля должна немедленно завершить прежние сессии пользователя. */
      if (!users.some((user) => user.id === id)) return false;
      users = users.map((user) => (user.id === id ? { ...user, passwordHash } : user));
      sessions = sessions.filter((session) => session.userId !== id);
      return true;
    },
    delete: async (id) => {
      /** Вместе с пользователем удаляем связанные с ним сессии. */
      const exists = users.some((user) => user.id === id);
      users = users.filter((user) => user.id !== id);
      sessions = sessions.filter((session) => session.userId !== id);
      return exists;
    },
    hasPasswordUsers: async () => users.some((user) => user.passwordHash !== null),
    saveSession: async (tokenHash, userId, expiresAt) => {
      /** Повторная запись того же токена заменяет его прежнюю привязку и срок действия. */
      sessions = [
        ...sessions.filter((session) => session.tokenHash !== tokenHash),
        { tokenHash, userId, expiresAt },
      ];
    },
    /** Просроченные сессии не удостоверяют личность пользователя. */
    getSessionUserId: async (tokenHash, now) =>
      sessions.find((session) => session.tokenHash === tokenHash && session.expiresAt > now)?.userId ?? null,
    deleteSession: async (tokenHash) => {
      sessions = sessions.filter((session) => session.tokenHash !== tokenHash);
    },
    deleteAllSessions: async (userId) => {
      sessions = sessions.filter((session) => session.userId !== userId);
    },
    savePreferences: async (id, confirmDelete, inboxDescription) => {
      /** Не переданное описание оставляет прежнее значение без изменений. */
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
