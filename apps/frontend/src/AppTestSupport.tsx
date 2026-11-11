import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Comment, Project, Section, Task, TaskNode } from "@todoist-clone/domain";
import { BrowserRouter } from "react-router-dom";
import { createQueryClient, TaskApp } from "./App";
import type { ApplicationApi, TaskCommentInput } from "./api";

export const task = (values: Partial<TaskNode> & Pick<TaskNode, "id" | "title">): TaskNode =>
  Object.freeze({
    description: "",
    dueDate: null,
    labels: Object.freeze([]),
    comments: Object.freeze([]),
    completed: false,
    parentId: null,
    projectId: null,
    sectionId: null,
    lexicalOrder: "U",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    children: Object.freeze([]),
    ...values,
  });

export const savedComments = (comments: ReadonlyArray<TaskCommentInput> = []): ReadonlyArray<Comment> =>
  Object.freeze(
    comments.map((comment, index) =>
      Object.freeze({
        id: comment.id ?? `server-comment-${index}`,
        body: comment.body,
        createdAt: "2026-01-01T00:00:00.000Z",
        ...(comment.attachments === undefined ? {} : { attachments: comment.attachments }),
      }),
    ),
  );

export const project = (values: Partial<Project> & Pick<Project, "id" | "title">): Project =>
  Object.freeze({
    description: "",
    archived: false,
    parentId: null,
    lexicalOrder: "U",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...values,
  });

export const section = (values: Partial<Section> & Pick<Section, "id" | "title">): Section =>
  Object.freeze({
    projectId: null,
    lexicalOrder: "U",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...values,
  });

export const renderApp = (api: ApplicationApi, attachmentsEnabled = false) =>
  render(
    <QueryClientProvider client={createQueryClient()}>
      <BrowserRouter>
        <TaskApp api={api} attachmentsEnabled={attachmentsEnabled} />
      </BrowserRouter>
    </QueryClientProvider>,
  );

export const baseApi = (tasks: ReadonlyArray<TaskNode>): ApplicationApi =>
  Object.freeze({
    getSettings: async () =>
      Object.freeze({ confirmDelete: true, accessMode: "password" as const, username: "admin" }),
    updateSettings: async (settings) =>
      Object.freeze({
        confirmDelete: settings.confirmDelete,
        accessMode: "password" as const,
        username: "admin",
      }),
    getAuthStatus: async () =>
      Object.freeze({
        accessMode: "password" as const,
        authenticated: true,
        user: Object.freeze({ id: "admin", username: "admin", isAdmin: true }),
      }),
    createComment: async () => undefined,
    login: async () => undefined,
    logout: async () => undefined,
    updateOwnAccount: async (account) =>
      Object.freeze({ id: "admin", username: account.username, isAdmin: true }),
    listUsers: async () => Object.freeze([Object.freeze({ id: "admin", username: "admin", isAdmin: true })]),
    createUser: async (user) =>
      Object.freeze({ id: "created-user", username: user.username, isAdmin: user.isAdmin }),
    updateUser: async (id, user) =>
      Object.freeze({ id, username: user.username ?? "admin", isAdmin: user.isAdmin ?? true }),
    deleteUser: async () => undefined,
    listTasks: async () => tasks,
    listProjects: async () => Object.freeze([]),
    createProject: async (title) =>
      Object.freeze({
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
    listSections: async () => Object.freeze([]),
    createSection: async (title, projectId) =>
      Object.freeze({
        id: "section",
        title,
        projectId,
        lexicalOrder: "U",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
    reorderSection: async (id, beforeId, afterId) =>
      Object.freeze({
        id,
        title: "Reordered",
        projectId: null,
        lexicalOrder: beforeId ?? afterId ?? "U",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
    updateSection: async (id, title) =>
      Object.freeze({
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

export const dragTask = (title: string) => {
  const data = new Map<string, string>();
  const dataTransfer = Object.freeze({
    setData: (type: string, value: string) => data.set(type, value),
    getData: (type: string) => data.get(type) ?? "",
  });
  const row = screen.getByText(title).closest(".task-row");

  if (row === null) {
    throw new Error(`Unable to find row for ${title}`);
  }

  fireEvent.dragStart(row, { dataTransfer });

  return dataTransfer;
};

export const taskRow = (title: string) => {
  const row = screen.getByText(title).closest(".task-row");

  if (row === null) {
    throw new Error(`Unable to find row for ${title}`);
  }

  return row;
};

export const placePointer = (row: Element, top = 0) => {
  Object.defineProperty(row, "getBoundingClientRect", {
    configurable: true,
    value: () =>
      Object.freeze({
        x: 0,
        y: top,
        top,
        right: 400,
        bottom: top + 100,
        left: 0,
        width: 400,
        height: 100,
        toJSON: () => Object.freeze({}),
      }),
  });
};
