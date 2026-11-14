import type { Comment, Project, ProjectId, Section, SectionId, Task, TaskNode } from "@todoist-clone/domain";

/** Данные комментария, которые frontend передаёт API при обновлении задачи. */
export type TaskCommentInput = {
  /** Идентификатор сохранённого комментария; для нового сообщения не задаётся. */
  id?: string;
  /** Текст комментария. */
  body: string;
  /** Метаданные уже загруженных файлов, если они есть. */
  attachments?: Comment["attachments"];
};

/** Набор HTTP-операций задач, проектов и секций. */
export type TaskApi = {
  /** Загружает дерево задач текущего пользователя. */
  listTasks: () => Promise<Array<TaskNode>>;
  /** Загружает проекты пользователя. */
  listProjects: () => Promise<Array<Project>>;
  /** Создаёт проект верхнего уровня или подпроект. */
  createProject: (title: string, parentId?: ProjectId | null) => Promise<Project>;
  /** Меняет родителя проекта или переносит его в корень. */
  moveProject: (id: ProjectId, parentId: ProjectId | null) => Promise<Project>;
  /** Переставляет проект между соседями. */
  reorderProject: (id: ProjectId, beforeId: ProjectId | null, afterId: ProjectId | null) => Promise<Project>;
  /** Обновляет название и/или описание проекта. */
  updateProject: (id: ProjectId, patch: { title?: string; description?: string }) => Promise<Project>;
  /** Загружает описание списка Входящие. */
  getInboxDescription: () => Promise<string>;
  /** Сохраняет описание списка Входящие. */
  updateInboxDescription: (description: string) => Promise<void>;
  /** Создаёт копию проекта вместе с его содержимым. */
  duplicateProject: (id: ProjectId) => Promise<Project>;
  /** Меняет архивное состояние проекта. */
  archiveProject: (id: ProjectId, archived: boolean) => Promise<Project>;
  /** Удаляет проект. */
  deleteProject: (id: ProjectId) => Promise<void>;
  /** Загружает секции пользователя. */
  listSections: () => Promise<Array<Section>>;
  /** Создаёт секцию во Входящих или выбранном проекте. */
  createSection: (title: string, projectId: ProjectId | null) => Promise<Section>;
  /** Переставляет секцию относительно соседних секций. */
  reorderSection: (id: SectionId, beforeId: SectionId | null, afterId: SectionId | null) => Promise<Section>;
  /** Переименовывает секцию. */
  updateSection: (id: SectionId, title: string) => Promise<Section>;
  /** Удаляет секцию. */
  deleteSection: (id: SectionId) => Promise<void>;
  /** Создаёт задачу с указанным проектом, секцией и родителем. */
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
  /** Добавляет комментарий и выбранные файлы к задаче. */
  createComment: (taskId: string, body: string, files: Array<File>) => Promise<void>;
  /** Меняет состояние завершения задачи. */
  patchTask: (id: string, completed: boolean) => Promise<Task>;
  /** Обновляет текст, срок, метки или комментарии задачи. */
  updateTask: (
    /** Идентификатор обновляемой задачи. */
    id: string,
    /** Поля задачи, которые требуется сохранить. */
    patch: {
      /** Новое название задачи. */
      title?: string;
      /** Новое описание задачи. */
      description?: string;
      /** Новый срок или `null` для удаления срока. */
      dueDate?: string | null;
      /** Новый полный список меток. */
      labels?: Array<string>;
      /** Новый упорядоченный список комментариев. */
      comments?: Array<TaskCommentInput>;
    },
  ) => Promise<Task>;
  /** Перемещает задачу в проект/секцию и задаёт нового родителя или соседей. */
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
  /** Удаляет задачу и её потомков. */
  deleteTask: (id: string) => Promise<void>;
};

/** Набор запросов административной страницы инструментов БД. */
export type ToolsApi = {
  /** Возвращает список доступных таблиц. */
  listTables: () => Promise<Array<string>>;
  /** Загружает ограниченное число записей из выбранной таблицы. */
  listRecords: (table: string, limit: "10" | "100" | "all") => Promise<unknown>;
  /** Удаляет записи выбранной таблицы. */
  clearTable: (table: string) => Promise<unknown>;
  /** Удаляет таблицы базы данных. */
  dropAllTables: () => Promise<unknown>;
  /** Применяет миграции базы данных. */
  migrate: () => Promise<unknown>;
  /** Очищает данные таблиц. */
  clearAllTables: () => Promise<unknown>;
  /** Заполняет базу демонстрационными данными. */
  seed: () => Promise<unknown>;
  /** Выполняет SQL-запрос, доступный только администратору. */
  runQuery: (sql: string) => Promise<unknown>;
};

/** Настройки пользователя, отображаемые на странице настроек. */
export type AppSettings = {
  /** Требовать подтверждение перед удалением. */
  confirmDelete: boolean;
  /** Способ входа, объявленный сервером. */
  accessMode: "password";
  /** Имя вошедшего пользователя. */
  username: string;
};

/** Публичная запись аккаунта для управления пользователями. */
export type ManagedUser = {
  /** Идентификатор аккаунта. */
  id: string;
  /** Имя, используемое для входа. */
  username: string;
  /** Признак административных прав. */
  isAdmin: boolean;
};

/** Текущий статус входа и возможности, включённые на сервере. */
export type AuthStatus = {
  /** Режим аутентификации приложения. */
  accessMode: "anonymous" | "password";
  /** Признак действующей сессии браузера. */
  authenticated: boolean;
  /** Текущий пользователь либо `null`, если сессии нет. */
  user: ManagedUser | null;
  /** Может ли приложение сохранять и выдавать вложения. */
  attachmentsEnabled?: boolean;
  /** Разрешено ли архивирование проектов. */
  projectArchivingEnabled?: boolean;
};

/** Поля настроек, которые клиент отправляет для сохранения. */
export type SettingsUpdate = {
  /** Новое значение подтверждения удаления. */
  confirmDelete: boolean;
};

/** Полный контракт API клиентского приложения и административных аккаунтов. */
export type ApplicationApi = TaskApi & {
  /** Загружает настройки текущего пользователя. */
  getSettings: () => Promise<AppSettings>;
  /** Сохраняет настройки и возвращает результат сервера. */
  updateSettings: (settings: SettingsUpdate) => Promise<AppSettings>;
  /** Проверяет состояние сессии и доступные возможности приложения. */
  getAuthStatus: () => Promise<AuthStatus>;
  /** Входит в аккаунт и сохраняет сессионную cookie на сервере. */
  login: (username: string, password: string) => Promise<void>;
  /** Завершает текущую сессию. */
  logout: () => Promise<void>;
  /** Меняет собственное имя пользователя или пароль. */
  updateOwnAccount: (account: {
    /** Новое имя входа пользователя. */
    username: string;
    /** Новый пароль; отсутствие сохраняет текущий пароль. */
    password?: string;
  }) => Promise<ManagedUser>;
  /** Получает пользователей, доступных администратору. */
  listUsers: () => Promise<Array<ManagedUser>>;
  /** Создаёт аккаунт пользователя. */
  createUser: (user: {
    /** Имя входа нового пользователя. */
    username: string;
    /** Пароль, который сервер захеширует перед сохранением. */
    password: string;
    /** Нужно ли выдать пользователю права администратора. */
    isAdmin: boolean;
  }) => Promise<ManagedUser>;
  /** Меняет имя, пароль или административные права пользователя. */
  updateUser: (
    /** Идентификатор редактируемого аккаунта. */
    id: string,
    /** Переданные поля аккаунта; отсутствующие значения не меняются. */
    user: {
      /** Новое имя входа, если оно меняется. */
      username?: string;
      /** Новый пароль; отсутствие сохраняет текущий хеш. */
      password?: string;
      /** Новая административная роль, если она меняется. */
      isAdmin?: boolean;
    },
  ) => Promise<ManagedUser>;
  /** Удаляет аккаунт пользователя. */
  deleteUser: (id: string) => Promise<void>;
};

/** Проверяет HTTP-ответ и преобразует его JSON-тело в ожидаемый тип. */
const readJson = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
};

/** Создаёт HTTP-клиент приложения с необязательным префиксом API. */
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

/** Отправляет JSON POST и проверяет ответ по общим правилам клиента. */
const postJson = async <T>(url: string, body: unknown = {}): Promise<T> =>
  readJson<T>(
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

/** Создаёт HTTP-клиент административных инструментов базы данных. */
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
