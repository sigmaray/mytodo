import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Comment, Project, Section, Task, TaskNode } from "@todoist-clone/domain";
import { BrowserRouter } from "react-router-dom";
import { createQueryClient, TaskApp } from "./App";
import type { ApplicationApi, TaskCommentInput } from "./api";

/** Создаёт задачу для тестов с полным набором безопасных значений по умолчанию. */
export const task = (values: Partial<TaskNode> & Pick<TaskNode, "id" | "title">): TaskNode => ({
  description: "",
  dueDate: null,
  labels: [],
  comments: [],
  completed: false,
  parentId: null,
  projectId: null,
  sectionId: null,
  lexicalOrder: "U",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  children: [],
  ...values,
});

/** Имитирует комментарии, сохранённые сервером, включая выданные им идентификаторы. */
export const savedComments = (comments: Array<TaskCommentInput> = []): Array<Comment> =>
  comments.map((comment, index) => ({
    id: comment.id ?? `server-comment-${index}`,
    body: comment.body,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...(comment.attachments === undefined ? {} : { attachments: comment.attachments }),
  }));

/** Создаёт проектную фикстуру с полями, общими для frontend-тестов. */
export const project = (values: Partial<Project> & Pick<Project, "id" | "title">): Project => ({
  description: "",
  archived: false,
  parentId: null,
  lexicalOrder: "U",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...values,
});

/** Создаёт секцию для тестов и позволяет переопределить её исходные поля. */
export const section = (values: Partial<Section> & Pick<Section, "id" | "title">): Section => ({
  projectId: null,
  lexicalOrder: "U",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...values,
});

/** Рендерит приложение с роутером и отдельным клиентом запросов для теста. */
export const renderApp = (api: ApplicationApi, attachmentsEnabled = false) =>
  render(
    <QueryClientProvider client={createQueryClient()}>
      <BrowserRouter>
        <TaskApp api={api} attachmentsEnabled={attachmentsEnabled} />
      </BrowserRouter>
    </QueryClientProvider>,
  );

/** Создаёт API-заглушку с переданными задачами и рабочими ответами по умолчанию. */
export const baseApi = (tasks: Array<TaskNode>): ApplicationApi => ({
  getSettings: async () => ({ confirmDelete: true, accessMode: "password" as const, username: "admin" }),
  updateSettings: async (settings) => ({
    confirmDelete: settings.confirmDelete,
    accessMode: "password" as const,
    username: "admin",
  }),
  getAuthStatus: async () => ({
    accessMode: "password" as const,
    authenticated: true,
    user: { id: "admin", username: "admin", isAdmin: true },
  }),
  createComment: async () => undefined,
  login: async () => undefined,
  logout: async () => undefined,
  updateOwnAccount: async (account) => ({ id: "admin", username: account.username, isAdmin: true }),
  listUsers: async () => [{ id: "admin", username: "admin", isAdmin: true }],
  createUser: async (user) => ({ id: "created-user", username: user.username, isAdmin: user.isAdmin }),
  updateUser: async (id, user) => ({ id, username: user.username ?? "admin", isAdmin: user.isAdmin ?? true }),
  deleteUser: async () => undefined,
  listTasks: async () => tasks,
  listProjects: async () => [],
  createProject: async (title) => ({
    id: "project",
    title,
    description: "",
    archived: false,
    parentId: null,
    lexicalOrder: "U",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  }),
  reorderProject: async (id) => project({ id, title: "Reordered" }),
  moveProject: async (id, parentId) => project({ id, title: "Project", parentId }),
  updateProject: async (id, patch) =>
    project({ id, title: patch.title ?? "Project", description: patch.description ?? "" }),
  getInboxDescription: async () => "",
  updateInboxDescription: async () => undefined,
  duplicateProject: async (id) => project({ id: `${id}-copy`, title: "Project copy" }),
  archiveProject: async (id, archived) => project({ id, title: "Project", archived }),
  deleteProject: async () => undefined,
  listSections: async () => [],
  createSection: async (title, projectId) => ({
    id: "section",
    title,
    projectId,
    lexicalOrder: "U",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  }),
  reorderSection: async (id, beforeId, afterId) => ({
    id,
    title: "Reordered",
    projectId: null,
    lexicalOrder: beforeId ?? afterId ?? "U",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  }),
  updateSection: async (id, title) => ({
    id,
    title,
    projectId: null,
    lexicalOrder: "U",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  }),
  deleteSection: async () => undefined,
  createTask: async (title, projectId, sectionId, parentId): Promise<Task> =>
    task({ id: "created", title, projectId, sectionId, parentId }),
  patchTask: async (id, completed): Promise<Task> => task({ id, title: "Plan MVP", completed }),
  updateTask: async (id, patch): Promise<Task> => task({ id, title: patch.title ?? "Plan MVP" }),
  moveTask: async (id, projectId, sectionId, parentId): Promise<Task> =>
    task({ id, title: "Moved", projectId, sectionId, parentId }),
  deleteTask: async () => undefined,
});

/** Перетаскивает строку задачи через синтетические HTML Drag and Drop события. */
export const dragTask = (title: string) => {
  const data = new Map<string, string>();
  const dataTransfer = {
    setData: (type: string, value: string) => data.set(type, value),
    getData: (type: string) => data.get(type) ?? "",
  };
  const row = screen.getByText(title).closest(".task-row");

  if (row === null) {
    throw new Error(`Unable to find row for ${title}`);
  }

  fireEvent.dragStart(row, { dataTransfer });

  return dataTransfer;
};

/** Находит строку задачи по точному заголовку для последующих проверок и действий. */
export const taskRow = (title: string) => {
  const row = screen.getByText(title).closest(".task-row");

  if (row === null) {
    throw new Error(`Unable to find row for ${title}`);
  }

  return row;
};

/** Размещает указатель над выбранной строкой для проверки drag-and-drop зон. */
export const placePointer = (row: Element, top = 0) => {
  Object.defineProperty(row, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      x: 0,
      y: top,
      top,
      right: 400,
      bottom: top + 100,
      left: 0,
      width: 400,
      height: 100,
      toJSON: () => ({}),
    }),
  });
};
