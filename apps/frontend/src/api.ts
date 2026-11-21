import type { Comment, Project, ProjectId, Section, SectionId, Task, TaskNode } from "@todoist-clone/domain";

/**
 * Comment data sent by the frontend API when updating a task.
 *
 * @typedef {Object} TaskCommentInput
 * @property {string} [id] - Identifier of the entity handled by this module.
 * @property {string} body - Comment text provided to the API.
 * @property {Comment["attachments"]} [attachments] - Attachments included with the comment.
 */
export type TaskCommentInput = {
  id?: string;

  body: string;

  attachments?: Comment["attachments"];
};

/**
 * HTTP operations for tasks, projects, and sections.
 *
 * @typedef {Object} TaskApi
 * @property listTasks - Lists tasks in the selected list.
 * @property listProjects - Lists projects in the selected list.
 * @property createProject - Calls the corresponding API operation.
 * @property moveProject - Calls the corresponding API operation.
 * @property reorderProject - Calls the corresponding API operation.
 * @property updateProject - Calls the corresponding API operation.
 * @property getInboxDescription - Calls the corresponding API operation.
 * @property updateInboxDescription - Calls the corresponding API operation.
 * @property duplicateProject - Calls the corresponding API operation.
 * @property archiveProject - Calls the corresponding API operation.
 * @property deleteProject - Calls the corresponding API operation.
 * @property listSections - Lists sections in the selected list.
 * @property createSection - Calls the corresponding API operation.
 * @property reorderSection - Calls the corresponding API operation.
 * @property updateSection - Calls the corresponding API operation.
 * @property deleteSection - Calls the corresponding API operation.
 * @property createTask - Calls the corresponding API operation.
 * @property createComment - Calls the corresponding API operation.
 * @property patchTask - Calls the corresponding API operation.
 * @property updateTask - Calls the corresponding API operation.
 * @property moveTask - Calls the corresponding API operation.
 * @property deleteTask - Calls the corresponding API operation.
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
    /** The new task’s title. */
    title: string,
    /** The destination project, or `null` for the Inbox. */
    projectId: ProjectId | null,
    /** The destination section, or `null` for the list root. */
    sectionId: SectionId | null,
    /** The parent task, or `null` for a top-level task. */
    parentId: string | null,
  ) => Promise<Task>;

  createComment: (taskId: string, body: string, files: Array<File>) => Promise<void>;

  patchTask: (id: string, completed: boolean) => Promise<Task>;

  updateTask: (
    /** ID of the task to update. */
    id: string,
    /** Task fields to save. */
    patch: {
      title?: string;

      description?: string;

      dueDate?: string | null;

      labels?: Array<string>;

      comments?: Array<TaskCommentInput>;
    },
  ) => Promise<Task>;

  moveTask: (
    /** The task to move. */
    id: string,
    /** The destination project, or `null` for the Inbox. */
    projectId: ProjectId | null,
    /** The destination section, or `null` for the list root. */
    sectionId: SectionId | null,
    /** The new parent, or `null` to move the task to the root. */
    parentId: string | null,
    /** The neighboring task before which to place this task. */
    beforeId?: string | null,
    /** The neighboring task after which to place this task. */
    afterId?: string | null,
  ) => Promise<Task>;

  deleteTask: (id: string) => Promise<void>;
};

/**
 * Requests used by the database tools administration page.
 *
 * @typedef {Object} ToolsApi
 * @property listTables - Returns the tables available for administration.
 * @property listRecords - Loads records from the selected table, up to the requested limit.
 * @property clearTable - Deletes records from the selected table.
 * @property dropAllTables - Drops the database tables.
 * @property migrate - Applies database migrations.
 * @property clearAllTables - Clears all tables.
 * @property seed - Seeds the database with sample data.
 * @property runQuery - Runs an administrator-provided SQL query.
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
 * User settings shown on the settings page.
 *
 * @typedef {Object} AppSettings
 * @property {boolean} confirmDelete - Whether to ask for confirmation before deleting.
 * @property {"password"} accessMode - The authentication mode configured for the application.
 * @property {string} username - The account username.
 */
export type AppSettings = {
  confirmDelete: boolean;

  accessMode: "password";

  username: string;
};

/**
 * Public account details used by user management.
 *
 * @typedef {Object} ManagedUser
 * @property {string} id - Identifier of the entity handled by this module.
 * @property {string} username - The account username.
 * @property {boolean} isAdmin - Whether the user is an administrator.
 */
export type ManagedUser = {
  id: string;

  username: string;

  isAdmin: boolean;
};

/**
 * Current authentication status and capabilities enabled by the server.
 *
 * @typedef {Object} AuthStatus
 * @property {"anonymous" | "password"} accessMode - The authentication mode configured for the application.
 * @property {boolean} authenticated - Whether the user has an active session.
 * @property {ManagedUser | null} user - The current user, or `null` when no session exists.
 * @property {boolean} [attachmentsEnabled] - Whether the application can upload and serve attachments.
 * @property {boolean} [projectArchivingEnabled] - Whether project archiving is enabled.
 */
export type AuthStatus = {
  accessMode: "anonymous" | "password";

  authenticated: boolean;

  user: ManagedUser | null;

  attachmentsEnabled?: boolean;

  projectArchivingEnabled?: boolean;
};

/**
 * Settings fields sent by the client to be saved.
 *
 * @typedef {Object} SettingsUpdate
 * @property {boolean} confirmDelete - Whether to ask for confirmation before deleting.
 */
export type SettingsUpdate = {
  confirmDelete: boolean;
};

/**
 * Complete API contract for the client application and account administration.
 *
 * @typedef {Object} ApplicationApi
 * @property getSettings - Calls the corresponding API operation.
 * @property updateSettings - Calls the corresponding API operation.
 * @property getAuthStatus - Calls the corresponding API operation.
 * @property login - Calls the corresponding API operation.
 * @property logout - Calls the corresponding API operation.
 * @property updateOwnAccount - Calls the corresponding API operation.
 * @property listUsers - Calls the corresponding API operation.
 * @property createUser - Calls the corresponding API operation.
 * @property updateUser - Calls the corresponding API operation.
 * @property deleteUser - Calls the corresponding API operation.
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
    /** ID of the account to update. */
    id: string,
    /** Account fields to update; omitted fields remain unchanged. */
    user: {
      username?: string;

      password?: string;

      isAdmin?: boolean;
    },
  ) => Promise<ManagedUser>;

  deleteUser: (id: string) => Promise<void>;
};

/**
 * Checks an HTTP response and converts its JSON body to the expected type.
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
 * Creates an application HTTP client with an optional API prefix.
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
 * Sends a JSON POST request and validates the response using the client’s common rules.
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
 * Creates an HTTP client for database administration tools.
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
