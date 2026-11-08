import type { Project, ProjectId, Section, SectionId, Task, TaskNode } from "@todoist-clone/domain";

export type TaskApi = Readonly<{
  listTasks: () => Promise<ReadonlyArray<TaskNode>>;
  listProjects: () => Promise<ReadonlyArray<Project>>;
  createProject: (title: string, parentId?: ProjectId | null) => Promise<Project>;
  moveProject: (id: ProjectId, parentId: ProjectId | null) => Promise<Project>;
  reorderProject: (id: ProjectId, beforeId: ProjectId | null, afterId: ProjectId | null) => Promise<Project>;
  updateProject: (
    id: ProjectId,
    patch: Readonly<{ title?: string; description?: string }>,
  ) => Promise<Project>;
  getInboxDescription: () => Promise<string>;
  updateInboxDescription: (description: string) => Promise<void>;
  duplicateProject: (id: ProjectId) => Promise<Project>;
  archiveProject: (id: ProjectId, archived: boolean) => Promise<Project>;
  deleteProject: (id: ProjectId) => Promise<void>;
  listSections: () => Promise<ReadonlyArray<Section>>;
  createSection: (title: string, projectId: ProjectId | null) => Promise<Section>;
  reorderSection: (id: SectionId, beforeId: SectionId | null, afterId: SectionId | null) => Promise<Section>;
  updateSection: (id: SectionId, title: string) => Promise<Section>;
  deleteSection: (id: SectionId) => Promise<void>;
  createTask: (
    title: string,
    projectId: ProjectId | null,
    sectionId: SectionId | null,
    parentId: string | null,
  ) => Promise<Task>;
  createComment: (taskId: string, body: string, files: ReadonlyArray<File>) => Promise<void>;
  patchTask: (id: string, completed: boolean) => Promise<Task>;
  updateTask: (
    id: string,
    patch: Readonly<{
      title?: string;
      description?: string;
      dueDate?: string | null;
      labels?: ReadonlyArray<string>;
      comments?: Task["comments"];
    }>,
  ) => Promise<Task>;
  moveTask: (
    id: string,
    projectId: ProjectId | null,
    sectionId: SectionId | null,
    parentId: string | null,
    beforeId?: string | null,
    afterId?: string | null,
  ) => Promise<Task>;
  deleteTask: (id: string) => Promise<void>;
}>;

export type ToolsApi = Readonly<{
  listTables: () => Promise<ReadonlyArray<string>>;
  listRecords: (table: string, limit: "10" | "100" | "all") => Promise<unknown>;
  clearTable: (table: string) => Promise<unknown>;
  dropAllTables: () => Promise<unknown>;
  migrate: () => Promise<unknown>;
  clearAllTables: () => Promise<unknown>;
  seed: () => Promise<unknown>;
  runQuery: (sql: string) => Promise<unknown>;
}>;

export type AppSettings = Readonly<{
  confirmDelete: boolean;
  accessMode: "password";
  username: string;
}>;

export type ManagedUser = Readonly<{ id: string; username: string; isAdmin: boolean }>;

export type AuthStatus = Readonly<{
  accessMode: "anonymous" | "password";
  authenticated: boolean;
  user: ManagedUser | null;
  attachmentsEnabled?: boolean;
  projectArchivingEnabled?: boolean;
}>;

export type SettingsUpdate = Readonly<{
  confirmDelete: boolean;
}>;

export type ApplicationApi = TaskApi &
  Readonly<{
    getSettings: () => Promise<AppSettings>;
    updateSettings: (settings: SettingsUpdate) => Promise<AppSettings>;
    getAuthStatus: () => Promise<AuthStatus>;
    login: (username: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    updateOwnAccount: (account: Readonly<{ username: string; password?: string }>) => Promise<ManagedUser>;
    listUsers: () => Promise<ReadonlyArray<ManagedUser>>;
    createUser: (
      user: Readonly<{ username: string; password: string; isAdmin: boolean }>,
    ) => Promise<ManagedUser>;
    updateUser: (
      id: string,
      user: Readonly<{ username?: string; password?: string; isAdmin?: boolean }>,
    ) => Promise<ManagedUser>;
    deleteUser: (id: string) => Promise<void>;
  }>;

const readJson = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
};

export const createTaskApi = (baseUrl = ""): ApplicationApi =>
  Object.freeze({
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
      (await readJson<{ users: ReadonlyArray<ManagedUser> }>(await fetch(`${baseUrl}/users`))).users,
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
      const data = await readJson<{ tree: ReadonlyArray<TaskNode> }>(await fetch(`${baseUrl}/tasks`));

      return data.tree;
    },
    listProjects: async () => {
      const data = await readJson<{ projects: ReadonlyArray<Project> }>(await fetch(`${baseUrl}/projects`));

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
      const data = await readJson<{ sections: ReadonlyArray<Section> }>(await fetch(`${baseUrl}/sections`));

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

const postJson = async <T>(url: string, body: unknown = Object.freeze({})): Promise<T> =>
  readJson<T>(
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

export const createToolsApi = (baseUrl = ""): ToolsApi =>
  Object.freeze({
    listTables: async () => {
      const data = await readJson<{ tables: ReadonlyArray<string> }>(
        await fetch(`${baseUrl}/tools-api/tables`),
      );

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
