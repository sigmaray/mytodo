import type { Comment, Project, ProjectId, Section, SectionId, Task, TaskNode } from "@todoist-clone/domain";

/**
 * Данные комментария, которые frontend передаёт API при обновлении задачи.
 *
 * @typedef {Object} TaskCommentInput
 * @property {string} [id] - Идентификатор сущности, с которой работает модуль.
 * @property {string} body - Данные «body», используемые типом «TaskCommentInput».
 * @property {Comment["attachments"]} [attachments] - Данные «вложения», используемые типом «TaskCommentInput».
 */
export type TaskCommentInput = {
  id?: string;

  body: string;

  attachments?: Comment["attachments"];
};

/**
 * Загружает дерево задач текущего пользователя.
 *
 * @callback TaskApiListTasks
 * @returns {Promise<Array<TaskNode>>}
 */

/**
 * Загружает проекты пользователя.
 *
 * @callback TaskApiListProjects
 * @returns {Promise<Array<Project>>}
 */

/**
 * Создаёт проект верхнего уровня или подпроект.
 *
 * @callback TaskApiCreateProject
 * @param {string} title
 * @param {ProjectId | null} [parentId]
 * @returns {Promise<Project>}
 */

/**
 * Меняет родителя проекта или переносит его в корень.
 *
 * @callback TaskApiMoveProject
 * @param {ProjectId} id
 * @param {ProjectId | null} parentId
 * @returns {Promise<Project>}
 */

/**
 * Переставляет проект между соседями.
 *
 * @callback TaskApiReorderProject
 * @param {ProjectId} id
 * @param {ProjectId | null} beforeId
 * @param {ProjectId | null} afterId
 * @returns {Promise<Project>}
 */

/**
 * Обновляет название и/или описание проекта.
 *
 * @callback TaskApiUpdateProject
 * @param {ProjectId} id
 * @param {{ title?: string; description?: string }} patch
 * @param {string} patch.title - Новое название.
 * @param {string} patch.description - Новое описание.
 * @returns {Promise<Project>}
 */

/**
 * Загружает описание списка Входящие.
 *
 * @callback TaskApiGetInboxDescription
 * @returns {Promise<string>}
 */

/**
 * Сохраняет описание списка Входящие.
 *
 * @callback TaskApiUpdateInboxDescription
 * @param {string} description
 * @returns {Promise<void>}
 */

/**
 * Создаёт копию проекта вместе с его содержимым.
 *
 * @callback TaskApiDuplicateProject
 * @param {ProjectId} id
 * @returns {Promise<Project>}
 */

/**
 * Меняет архивное состояние проекта.
 *
 * @callback TaskApiArchiveProject
 * @param {ProjectId} id
 * @param {boolean} archived
 * @returns {Promise<Project>}
 */

/**
 * Удаляет проект.
 *
 * @callback TaskApiDeleteProject
 * @param {ProjectId} id
 * @returns {Promise<void>}
 */

/**
 * Загружает секции пользователя.
 *
 * @callback TaskApiListSections
 * @returns {Promise<Array<Section>>}
 */

/**
 * Создаёт секцию во Входящих или выбранном проекте.
 *
 * @callback TaskApiCreateSection
 * @param {string} title
 * @param {ProjectId | null} projectId
 * @returns {Promise<Section>}
 */

/**
 * Переставляет секцию относительно соседних секций.
 *
 * @callback TaskApiReorderSection
 * @param {SectionId} id
 * @param {SectionId | null} beforeId
 * @param {SectionId | null} afterId
 * @returns {Promise<Section>}
 */

/**
 * Переименовывает секцию.
 *
 * @callback TaskApiUpdateSection
 * @param {SectionId} id
 * @param {string} title
 * @returns {Promise<Section>}
 */

/**
 * Удаляет секцию.
 *
 * @callback TaskApiDeleteSection
 * @param {SectionId} id
 * @returns {Promise<void>}
 */

/**
 * Создаёт задачу с указанным проектом, секцией и родителем.
 *
 * @callback TaskApiCreateTask
 * @param {string} title - Заголовок новой задачи.
 * @param {ProjectId | null} projectId - Проект назначения либо `null` для Входящих.
 * @param {SectionId | null} sectionId - Секция назначения либо `null` для корня списка.
 * @param {string | null} parentId - Родительская задача либо `null` для корневой задачи.
 * @returns {Promise<Task>}
 */

/**
 * Добавляет комментарий и выбранные файлы к задаче.
 *
 * @callback TaskApiCreateComment
 * @param {string} taskId
 * @param {string} body
 * @param {Array<File>} files
 * @returns {Promise<void>}
 */

/**
 * Меняет состояние завершения задачи.
 *
 * @callback TaskApiPatchTask
 * @param {string} id
 * @param {boolean} completed
 * @returns {Promise<Task>}
 */

/**
 * Обновляет текст, срок, метки или комментарии задачи.
 *
 * @callback TaskApiUpdateTask
 * @param {string} id - Идентификатор обновляемой задачи.
 * @param {{ title?: string; description?: string; dueDate?: string | null; labels?: Array<string>; comments?: Array<TaskCommentInput>; }} patch - Поля задачи, которые требуется сохранить.
 * @param {string} patch.title - Новое название.
 * @param {string} patch.description - Новое описание.
 * @param {string | null} patch.dueDate - Новый срок или null для сброса срока.
 * @param {Array<string>} patch.labels - Полный список меток.
 * @param {Array<TaskCommentInput>} patch.comments - Упорядоченный список комментариев.
 * @returns {Promise<Task>}
 */

/**
 * Перемещает задачу в проект/секцию и задаёт нового родителя или соседей.
 *
 * @callback TaskApiMoveTask
 * @param {string} id - Перемещаемая задача.
 * @param {ProjectId | null} projectId - Целевой проект или `null` для Входящих.
 * @param {SectionId | null} sectionId - Целевая секция либо `null` для корня списка.
 * @param {string | null} parentId - Новый родитель либо `null` для корневого уровня.
 * @param {string | null} [beforeId] - Сосед, перед которым нужно поставить задачу.
 * @param {string | null} [afterId] - Сосед, после которого нужно поставить задачу.
 * @returns {Promise<Task>}
 */

/**
 * Удаляет задачу и её потомков.
 *
 * @callback TaskApiDeleteTask
 * @param {string} id
 * @returns {Promise<void>}
 */
/**
 * Набор HTTP-операций задач, проектов и секций.
 *
 * @typedef {Object} TaskApi
 * @property {TaskApiListTasks} listTasks - Список задач, относящихся к список.
 * @property {TaskApiListProjects} listProjects - Список проектов для список.
 * @property {TaskApiCreateProject} createProject - Вызывает соответствующую операцию API.
 * @property {TaskApiMoveProject} moveProject - Вызывает соответствующую операцию API.
 * @property {TaskApiReorderProject} reorderProject - Вызывает соответствующую операцию API.
 * @property {TaskApiUpdateProject} updateProject - Вызывает соответствующую операцию API.
 * @property {TaskApiGetInboxDescription} getInboxDescription - Вызывает соответствующую операцию API.
 * @property {TaskApiUpdateInboxDescription} updateInboxDescription - Вызывает соответствующую операцию API.
 * @property {TaskApiDuplicateProject} duplicateProject - Вызывает соответствующую операцию API.
 * @property {TaskApiArchiveProject} archiveProject - Вызывает соответствующую операцию API.
 * @property {TaskApiDeleteProject} deleteProject - Вызывает соответствующую операцию API.
 * @property {TaskApiListSections} listSections - Список секций для список.
 * @property {TaskApiCreateSection} createSection - Вызывает соответствующую операцию API.
 * @property {TaskApiReorderSection} reorderSection - Вызывает соответствующую операцию API.
 * @property {TaskApiUpdateSection} updateSection - Вызывает соответствующую операцию API.
 * @property {TaskApiDeleteSection} deleteSection - Вызывает соответствующую операцию API.
 * @property {TaskApiCreateTask} createTask - Вызывает соответствующую операцию API.
 * @property {TaskApiCreateComment} createComment - Вызывает соответствующую операцию API.
 * @property {TaskApiPatchTask} patchTask - Вызывает соответствующую операцию API.
 * @property {TaskApiUpdateTask} updateTask - Вызывает соответствующую операцию API.
 * @property {TaskApiMoveTask} moveTask - Вызывает соответствующую операцию API.
 * @property {TaskApiDeleteTask} deleteTask - Вызывает соответствующую операцию API.
 */
export type TaskApi = {
  listTasks: () => Promise<Array<TaskNode>>;

  listProjects: () => Promise<Array<Project>>;

  createProject: (title: string, parentId?: ProjectId | null) => Promise<Project>;

  moveProject: (id: ProjectId, parentId: ProjectId | null) => Promise<Project>;

  reorderProject: (id: ProjectId, beforeId: ProjectId | null, afterId: ProjectId | null) => Promise<Project>;

  updateProject: (id: ProjectId, patch: { title?: string; description?: string }) => Promise<Project>;

  getInboxDescription: () => Promise<string>;

  updateInboxDescription: (description: string) => Promise<void>;

  duplicateProject: (id: ProjectId) => Promise<Project>;

  archiveProject: (id: ProjectId, archived: boolean) => Promise<Project>;

  deleteProject: (id: ProjectId) => Promise<void>;

  listSections: () => Promise<Array<Section>>;

  createSection: (title: string, projectId: ProjectId | null) => Promise<Section>;

  reorderSection: (id: SectionId, beforeId: SectionId | null, afterId: SectionId | null) => Promise<Section>;

  updateSection: (id: SectionId, title: string) => Promise<Section>;

  deleteSection: (id: SectionId) => Promise<void>;

  createTask: (
    /** Заголовок новой задачи. */
    title: string,
    /** Проект назначения либо `null` для Входящих. */
    projectId: ProjectId | null,
    /** Секция назначения либо `null` для корня списка. */
    sectionId: SectionId | null,
    /** Родительская задача либо `null` для корневой задачи. */
    parentId: string | null,
  ) => Promise<Task>;

  createComment: (taskId: string, body: string, files: Array<File>) => Promise<void>;

  patchTask: (id: string, completed: boolean) => Promise<Task>;

  updateTask: (
    /** Идентификатор обновляемой задачи. */
    id: string,
    /** Поля задачи, которые требуется сохранить. */
    patch: {
      title?: string;

      description?: string;

      dueDate?: string | null;

      labels?: Array<string>;

      comments?: Array<TaskCommentInput>;
    },
  ) => Promise<Task>;

  moveTask: (
    /** Перемещаемая задача. */
    id: string,
    /** Целевой проект или `null` для Входящих. */
    projectId: ProjectId | null,
    /** Целевая секция либо `null` для корня списка. */
    sectionId: SectionId | null,
    /** Новый родитель либо `null` для корневого уровня. */
    parentId: string | null,
    /** Сосед, перед которым нужно поставить задачу. */
    beforeId?: string | null,
    /** Сосед, после которого нужно поставить задачу. */
    afterId?: string | null,
  ) => Promise<Task>;

  deleteTask: (id: string) => Promise<void>;
};

/**
 * @callback ToolsApiListTables
 * @returns {Promise<Array<string>>}
 */

/**
 * @callback ToolsApiListRecords
 * @param {string} table
 * @param {"10" | "100" | "all"} limit
 * @returns {Promise<unknown>}
 */

/**
 * @callback ToolsApiClearTable
 * @param {string} table
 * @returns {Promise<unknown>}
 */

/**
 * @callback ToolsApiDropAllTables
 * @returns {Promise<unknown>}
 */

/**
 * @callback ToolsApiMigrate
 * @returns {Promise<unknown>}
 */

/**
 * @callback ToolsApiClearAllTables
 * @returns {Promise<unknown>}
 */

/**
 * @callback ToolsApiSeed
 * @returns {Promise<unknown>}
 */

/**
 * @callback ToolsApiRunQuery
 * @param {string} sql
 * @returns {Promise<unknown>}
 */
/**
 * Набор запросов административной страницы инструментов БД.
 *
 * @typedef {Object} ToolsApi
 * @property {ToolsApiListTables} listTables - Возвращает список таблиц, доступных для администрирования.
 * @property {ToolsApiListRecords} listRecords - Загружает записи выбранной таблицы с ограничением по количеству.
 * @property {ToolsApiClearTable} clearTable - Удаляет записи выбранной таблицы.
 * @property {ToolsApiDropAllTables} dropAllTables - Удаляет таблицы базы данных.
 * @property {ToolsApiMigrate} migrate - Применяет миграции базы данных.
 * @property {ToolsApiClearAllTables} clearAllTables - Очищает все таблицы.
 * @property {ToolsApiSeed} seed - Заполняет базу демонстрационными данными.
 * @property {ToolsApiRunQuery} runQuery - Выполняет SQL-запрос администратора.
 */
export type ToolsApi = {
  listTables: () => Promise<Array<string>>;

  listRecords: (table: string, limit: "10" | "100" | "all") => Promise<unknown>;

  clearTable: (table: string) => Promise<unknown>;

  dropAllTables: () => Promise<unknown>;

  migrate: () => Promise<unknown>;

  clearAllTables: () => Promise<unknown>;

  seed: () => Promise<unknown>;

  runQuery: (sql: string) => Promise<unknown>;
};

/**
 * Настройки пользователя, отображаемые на странице настроек.
 *
 * @typedef {Object} AppSettings
 * @property {boolean} confirmDelete - Настройка подтверждения перед удалением.
 * @property {"password"} accessMode - Режим входа, настроенный для приложения.
 * @property {string} username - Данные «имя пользователя», используемые типом «AppSettings».
 */
export type AppSettings = {
  confirmDelete: boolean;

  accessMode: "password";

  username: string;
};

/**
 * Публичная запись аккаунта для управления пользователями.
 *
 * @typedef {Object} ManagedUser
 * @property {string} id - Идентификатор сущности, с которой работает модуль.
 * @property {string} username - Данные «имя пользователя», используемые типом «ManagedUser».
 * @property {boolean} isAdmin - Признак: is административный.
 */
export type ManagedUser = {
  id: string;

  username: string;

  isAdmin: boolean;
};

/**
 * Текущий статус входа и возможности, включённые на сервере.
 *
 * @typedef {Object} AuthStatus
 * @property {"anonymous" | "password"} accessMode - Режим входа, настроенный для приложения.
 * @property {boolean} authenticated - Признак действующей сессии пользователя.
 * @property {ManagedUser | null} user - Текущий пользователь или null, если сессия не создана.
 * @property {boolean} [attachmentsEnabled] - Разрешено ли приложению загружать и выдавать вложения.
 * @property {boolean} [projectArchivingEnabled] - Разрешено ли архивирование проектов.
 */
export type AuthStatus = {
  accessMode: "anonymous" | "password";

  authenticated: boolean;

  user: ManagedUser | null;

  attachmentsEnabled?: boolean;

  projectArchivingEnabled?: boolean;
};

/**
 * Поля настроек, которые клиент отправляет для сохранения.
 *
 * @typedef {Object} SettingsUpdate
 * @property {boolean} confirmDelete - Настройка подтверждения перед удалением.
 */
export type SettingsUpdate = {
  confirmDelete: boolean;
};

/**
 * Загружает настройки текущего пользователя.
 *
 * @callback ApplicationApiGetSettings
 * @returns {Promise<AppSettings>}
 */

/**
 * Сохраняет настройки и возвращает результат сервера.
 *
 * @callback ApplicationApiUpdateSettings
 * @param {SettingsUpdate} settings
 * @returns {Promise<AppSettings>}
 */

/**
 * Проверяет состояние сессии и доступные возможности приложения.
 *
 * @callback ApplicationApiGetAuthStatus
 * @returns {Promise<AuthStatus>}
 */

/**
 * Входит в аккаунт и сохраняет сессионную cookie на сервере.
 *
 * @callback ApplicationApiLogin
 * @param {string} username
 * @param {string} password
 * @returns {Promise<void>}
 */

/**
 * Завершает текущую сессию.
 *
 * @callback ApplicationApiLogout
 * @returns {Promise<void>}
 */

/**
 * Меняет собственное имя пользователя или пароль.
 *
 * @callback ApplicationApiUpdateOwnAccount
 * @param {{ username: string; password?: string; }} account
 * @param {string} account.username - Значение поля «username».
 * @param {string} account.password - Значение поля «password».
 * @returns {Promise<ManagedUser>}
 */

/**
 * Получает пользователей, доступных администратору.
 *
 * @callback ApplicationApiListUsers
 * @returns {Promise<Array<ManagedUser>>}
 */

/**
 * Создаёт аккаунт пользователя.
 *
 * @callback ApplicationApiCreateUser
 * @param {{ username: string; password: string; isAdmin: boolean; }} user
 * @param {string} user.username - Значение поля «username».
 * @param {string} user.password - Значение поля «password».
 * @param {boolean} user.isAdmin - Признак «is admin».
 * @returns {Promise<ManagedUser>}
 */

/**
 * Меняет имя, пароль или административные права пользователя.
 *
 * @callback ApplicationApiUpdateUser
 * @param {string} id - Идентификатор редактируемого аккаунта.
 * @param {{ username?: string; password?: string; isAdmin?: boolean; }} user - Переданные поля аккаунта; отсутствующие значения не меняются.
 * @param {string} user.username - Значение поля «username».
 * @param {string} user.password - Значение поля «password».
 * @param {boolean} user.isAdmin - Признак «is admin».
 * @returns {Promise<ManagedUser>}
 */

/**
 * Удаляет аккаунт пользователя.
 *
 * @callback ApplicationApiDeleteUser
 * @param {string} id
 * @returns {Promise<void>}
 */
/**
 * Полный контракт API клиентского приложения и административных аккаунтов.
 *
 * @typedef {Object} ApplicationApi
 * @property {ApplicationApiGetSettings} getSettings - Вызывает соответствующую операцию API.
 * @property {ApplicationApiUpdateSettings} updateSettings - Вызывает соответствующую операцию API.
 * @property {ApplicationApiGetAuthStatus} getAuthStatus - Вызывает соответствующую операцию API.
 * @property {ApplicationApiLogin} login - Вызывает соответствующую операцию API.
 * @property {ApplicationApiLogout} logout - Вызывает соответствующую операцию API.
 * @property {ApplicationApiUpdateOwnAccount} updateOwnAccount - Вызывает соответствующую операцию API.
 * @property {ApplicationApiListUsers} listUsers - Вызывает соответствующую операцию API.
 * @property {ApplicationApiCreateUser} createUser - Вызывает соответствующую операцию API.
 * @property {ApplicationApiUpdateUser} updateUser - Вызывает соответствующую операцию API.
 * @property {ApplicationApiDeleteUser} deleteUser - Вызывает соответствующую операцию API.
 */
export type ApplicationApi = TaskApi & {
  getSettings: () => Promise<AppSettings>;

  updateSettings: (settings: SettingsUpdate) => Promise<AppSettings>;

  getAuthStatus: () => Promise<AuthStatus>;

  login: (username: string, password: string) => Promise<void>;

  logout: () => Promise<void>;

  updateOwnAccount: (account: {
    username: string;

    password?: string;
  }) => Promise<ManagedUser>;

  listUsers: () => Promise<Array<ManagedUser>>;

  createUser: (user: {
    username: string;

    password: string;

    isAdmin: boolean;
  }) => Promise<ManagedUser>;

  updateUser: (
    /** Идентификатор редактируемого аккаунта. */
    id: string,
    /** Переданные поля аккаунта; отсутствующие значения не меняются. */
    user: {
      username?: string;

      password?: string;

      isAdmin?: boolean;
    },
  ) => Promise<ManagedUser>;

  deleteUser: (id: string) => Promise<void>;
};

/**
 * Проверяет HTTP-ответ и преобразует его JSON-тело в ожидаемый тип.
 *
 * @param {Response} response
 * @returns {Promise<T>}
 */
const readJson = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
};

/**
 * Создаёт HTTP-клиент приложения с необязательным префиксом API.
 *
 * @param [baseUrl]
 * @returns {ApplicationApi}
 */
export const createTaskApi = (baseUrl = ""): ApplicationApi => ({
  getSettings: async () => {
    const data = await readJson<{ settings: AppSettings }>(await fetch(`${baseUrl}/settings`));

    return data.settings;
  },
  updateSettings: async (settings) => {
    const data = await readJson<{ settings: AppSettings }>(
      await fetch(`${baseUrl}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      }),
    );

    return data.settings;
  },
  getAuthStatus: async () => readJson<AuthStatus>(await fetch(`${baseUrl}/auth/status`)),
  login: async (username, password) => {
    await postJson(`${baseUrl}/auth/login`, { username, password });
  },
  logout: async () => {
    await postJson(`${baseUrl}/auth/logout`);
  },
  updateOwnAccount: async (account) =>
    (
      await readJson<{ user: ManagedUser }>(
        await fetch(`${baseUrl}/auth/account`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(account),
        }),
      )
    ).user,
  listUsers: async () =>
    (await readJson<{ users: Array<ManagedUser> }>(await fetch(`${baseUrl}/users`))).users,
  createUser: async (user) => (await postJson<{ user: ManagedUser }>(`${baseUrl}/users`, user)).user,
  updateUser: async (id, user) =>
    (
      await readJson<{ user: ManagedUser }>(
        await fetch(`${baseUrl}/users/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(user),
        }),
      )
    ).user,
  deleteUser: async (id) => {
    await readJson<{ deleted: true }>(await fetch(`${baseUrl}/users/${id}`, { method: "DELETE" }));
  },
  listTasks: async () => {
    const data = await readJson<{ tree: Array<TaskNode> }>(await fetch(`${baseUrl}/tasks`));

    return data.tree;
  },
  listProjects: async () => {
    const data = await readJson<{ projects: Array<Project> }>(await fetch(`${baseUrl}/projects`));

    return data.projects;
  },
  createProject: async (title, parentId = null) => {
    const data = await postJson<{ project: Project }>(`${baseUrl}/projects`, { title, parentId });

    return data.project;
  },
  moveProject: async (id, parentId) => {
    const data = await readJson<{ project: Project }>(
      await fetch(`${baseUrl}/projects/${id}/parent`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentId }),
      }),
    );
    return data.project;
  },
  reorderProject: async (id, beforeId, afterId) => {
    const data = await readJson<{ project: Project }>(
      await fetch(`${baseUrl}/projects/${id}/order`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ beforeId, afterId }),
      }),
    );
    return data.project;
  },
  updateProject: async (id, patch) => {
    const data = await readJson<{ project: Project }>(
      await fetch(`${baseUrl}/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }),
    );

    return data.project;
  },
  getInboxDescription: async () =>
    (await readJson<{ description: string }>(await fetch(`${baseUrl}/inbox/description`))).description,
  updateInboxDescription: async (description) => {
    await readJson<{ description: string }>(
      await fetch(`${baseUrl}/inbox/description`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      }),
    );
  },
  duplicateProject: async (id) => {
    const data = await postJson<{ project: Project }>(`${baseUrl}/projects/${id}/duplicate`);
    return data.project;
  },
  archiveProject: async (id, archived) => {
    const data = await readJson<{ project: Project }>(
      await fetch(`${baseUrl}/projects/${id}/archive`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived }),
      }),
    );
    return data.project;
  },
  deleteProject: async (id) => {
    await readJson<{ deleted: true }>(
      await fetch(`${baseUrl}/projects/${id}`, {
        method: "DELETE",
      }),
    );
  },
  listSections: async () => {
    const data = await readJson<{ sections: Array<Section> }>(await fetch(`${baseUrl}/sections`));

    return data.sections;
  },
  createSection: async (title, projectId) => {
    const data = await postJson<{ section: Section }>(`${baseUrl}/sections`, { title, projectId });

    return data.section;
  },
  reorderSection: async (id, beforeId, afterId) => {
    const data = await readJson<{ section: Section }>(
      await fetch(`${baseUrl}/sections/${id}/order`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ beforeId, afterId }),
      }),
    );
    return data.section;
  },
  updateSection: async (id, title) => {
    const data = await readJson<{ section: Section }>(
      await fetch(`${baseUrl}/sections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      }),
    );

    return data.section;
  },
  deleteSection: async (id) => {
    await readJson<{ deleted: true }>(
      await fetch(`${baseUrl}/sections/${id}`, {
        method: "DELETE",
      }),
    );
  },
  createTask: async (title, projectId, sectionId, parentId) => {
    const data = await readJson<{ task: Task }>(
      await fetch(`${baseUrl}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, projectId, sectionId, parentId }),
      }),
    );

    return data.task;
  },
  createComment: async (taskId, body, files) => {
    const form = new FormData();
    form.set("body", body);
    files.forEach((file) => form.append("files", file, file.name));
    await readJson(await fetch(`${baseUrl}/tasks/${taskId}/comments`, { method: "POST", body: form }));
  },
  moveTask: async (id, projectId, sectionId, parentId, beforeId = null, afterId = null) => {
    const data = await readJson<{ task: Task }>(
      await fetch(`${baseUrl}/tasks/${id}/move`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentId,
          projectId,
          sectionId,
          beforeId,
          afterId,
        }),
      }),
    );

    return data.task;
  },
  patchTask: async (id, completed) => {
    const data = await readJson<{ task: Task }>(
      await fetch(`${baseUrl}/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      }),
    );

    return data.task;
  },
  updateTask: async (id, patch) => {
    const data = await readJson<{ task: Task }>(
      await fetch(`${baseUrl}/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }),
    );

    return data.task;
  },
  deleteTask: async (id) => {
    await readJson<{ deleted: true }>(
      await fetch(`${baseUrl}/tasks/${id}`, {
        method: "DELETE",
      }),
    );
  },
});

/**
 * Отправляет JSON POST и проверяет ответ по общим правилам клиента.
 *
 * @param {string} url
 * @param {unknown} [body]
 * @returns {Promise<T>}
 */
const postJson = async <T>(url: string, body: unknown = {}): Promise<T> =>
  readJson<T>(
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

/**
 * Создаёт HTTP-клиент административных инструментов базы данных.
 *
 * @param [baseUrl]
 * @returns {ToolsApi}
 */
export const createToolsApi = (baseUrl = ""): ToolsApi => ({
  listTables: async () => {
    const data = await readJson<{ tables: Array<string> }>(await fetch(`${baseUrl}/tools-api/tables`));

    return data.tables;
  },
  listRecords: async (table, limit) =>
    readJson(await fetch(`${baseUrl}/tools-api/records/${encodeURIComponent(table)}?limit=${limit}`)),
  clearTable: async (table) => postJson(`${baseUrl}/tools-api/clear-table`, { table }),
  dropAllTables: async () => postJson(`${baseUrl}/tools-api/drop-all`),
  migrate: async () => postJson(`${baseUrl}/tools-api/migrate`),
  clearAllTables: async () => postJson(`${baseUrl}/tools-api/clear-all`),
  seed: async () => postJson(`${baseUrl}/tools-api/seed`),
  runQuery: async (sql) => postJson(`${baseUrl}/tools-api/query`, { sql }),
});
