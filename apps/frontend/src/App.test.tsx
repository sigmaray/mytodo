import { QueryClientProvider } from "@tanstack/react-query";
import type { Project, Section, Task, TaskNode } from "@todoist-clone/domain";
import { BrowserRouter } from "react-router-dom";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryClient, TaskApp } from "./App";
import { AdminUsersPage } from "./pages/AdminUsersPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ToolsPage } from "./pages/ToolsPage";
import { createTaskApi } from "./api";
import type { ApplicationApi, ToolsApi } from "./api";

const task = (values: Partial<TaskNode> & Pick<TaskNode, "id" | "title">): TaskNode =>
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
    ...values
  });

const project = (values: Partial<Project> & Pick<Project, "id" | "title">): Project =>
  Object.freeze({
    description: "",
    archived: false,
    parentId: null,
    lexicalOrder: "U",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...values
  });

const section = (values: Partial<Section> & Pick<Section, "id" | "title">): Section =>
  Object.freeze({
    projectId: null,
    lexicalOrder: "U",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...values
  });

const renderApp = (api: ApplicationApi, attachmentsEnabled = false) =>
  render(
    <QueryClientProvider client={createQueryClient()}>
      <BrowserRouter><TaskApp api={api} attachmentsEnabled={attachmentsEnabled} /></BrowserRouter>
    </QueryClientProvider>
  );

const baseApi = (tasks: ReadonlyArray<TaskNode>): ApplicationApi =>
  Object.freeze({
    getSettings: async () => Object.freeze({ confirmDelete: true, accessMode: "password" as const, username: "admin" }),
    updateSettings: async (settings) => Object.freeze({ confirmDelete: settings.confirmDelete, accessMode: "password" as const, username: "admin" }),
    getAuthStatus: async () => Object.freeze({ accessMode: "password" as const, authenticated: true, user: Object.freeze({ id: "admin", username: "admin", isAdmin: true }) }),
    createComment: async () => undefined,
    login: async () => undefined,
    logout: async () => undefined,
    updateOwnAccount: async (account) => Object.freeze({ id: "admin", username: account.username, isAdmin: true }),
    listUsers: async () => Object.freeze([Object.freeze({ id: "admin", username: "admin", isAdmin: true })]),
    createUser: async (user) => Object.freeze({ id: "created-user", username: user.username, isAdmin: user.isAdmin }),
    updateUser: async (id, user) => Object.freeze({ id, username: user.username ?? "admin", isAdmin: user.isAdmin ?? true }),
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
        updatedAt: "2026-01-01T00:00:00.000Z"
      }),
    reorderProject: async (id) => project({ id, title: "Reordered" }),
    moveProject: async (id, parentId) => project({ id, title: "Project", parentId }),
    updateProject: async (id, patch) => project({ id, title: patch.title ?? "Project", description: patch.description ?? "" }),
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
        updatedAt: "2026-01-01T00:00:00.000Z"
      }),
    reorderSection: async (id, beforeId, afterId) => Object.freeze({ id, title: "Reordered", projectId: null, lexicalOrder: beforeId ?? afterId ?? "U", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }),
    updateSection: async (id, title) =>
      Object.freeze({
        id,
        title,
        projectId: null,
        lexicalOrder: "U",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z"
      }),
    deleteSection: async () => undefined,
    createTask: async (title, projectId, sectionId, parentId): Promise<Task> => task({ id: "created", title, projectId, sectionId, parentId }),
    patchTask: async (id, completed): Promise<Task> => task({ id, title: "Plan MVP", completed }),
    updateTask: async (id, patch): Promise<Task> => task({ id, title: patch.title ?? "Plan MVP" }),
    moveTask: async (id, projectId, sectionId, parentId): Promise<Task> => task({ id, title: "Moved", projectId, sectionId, parentId }),
    deleteTask: async () => undefined
  });

const dragTask = (title: string) => {
  const data = new Map<string, string>();
  const dataTransfer = Object.freeze({
    setData: (type: string, value: string) => data.set(type, value),
    getData: (type: string) => data.get(type) ?? ""
  });
  const row = screen.getByText(title).closest(".task-row");

  if (row === null) {
    throw new Error(`Unable to find row for ${title}`);
  }

  fireEvent.dragStart(row, { dataTransfer });

  return dataTransfer;
};

const taskRow = (title: string) => {
  const row = screen.getByText(title).closest(".task-row");

  if (row === null) {
    throw new Error(`Unable to find row for ${title}`);
  }

  return row;
};

const placePointer = (row: Element, top = 0) => {
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
      toJSON: () => Object.freeze({})
    })
  });
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

beforeEach(() => {
  window.history.replaceState({}, "", "/");
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

describe("TaskApp", () => {
  it("hides stored attachments in task details when attachments are disabled", async () => {
    const attachmentComment = Object.freeze({ id: "comment-attachment", body: "File", createdAt: "2026-01-01T00:00:00.000Z", attachments: Object.freeze([Object.freeze({ id: "attachment-1", name: "photo.png", mimeType: "image/png", size: 5 })]) });
    renderApp(baseApi(Object.freeze([task({ id: "task-1", title: "Plan MVP", comments: Object.freeze([attachmentComment]) })])));
    expect(within(screen.getByRole("complementary", { name: "Navigation" })).queryByRole("link", { name: "Attachments" })).not.toBeInTheDocument();
    await userEvent.click(await screen.findByRole("button", { name: "Plan MVP" }));
    const dialog = screen.getByRole("dialog", { name: "Task details: Plan MVP" });
    expect(within(dialog).queryByRole("img", { name: "photo.png" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("link", { name: /photo.png/ })).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Attach files to comment")).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Remove attachment photo.png" })).not.toBeInTheDocument();
  });

  it("does not render an empty Markdown block for an attachment-only comment", async () => {
    const attachmentComment = Object.freeze({ id: "comment-attachment", body: "", createdAt: "2026-01-01T00:00:00.000Z", attachments: Object.freeze([Object.freeze({ id: "attachment-1", name: "photo.png", mimeType: "image/png", size: 5 })]) });
    renderApp(baseApi(Object.freeze([task({ id: "task-1", title: "Plan MVP", comments: Object.freeze([attachmentComment]) })])), true);
    await userEvent.click(await screen.findByRole("button", { name: "Plan MVP" }));
    const dialog = screen.getByRole("dialog", { name: "Task details: Plan MVP" });
    expect(dialog.querySelector(".comment-markdown")).not.toBeInTheDocument();
    expect(dialog.querySelector(".comment-attachment a[download]")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Edit" }));
    expect(within(dialog).getByRole("textbox", { name: "Edit comment comment-attachment" })).toHaveFocus();
    expect(within(dialog).getByRole("img", { name: "photo.png" })).toBeVisible();
    expect(dialog.querySelector(".comment-attachment a[download]")).toBeVisible();
  });

  it("shows a paperclip on tasks that have attachments", async () => {
    const attachmentComment = Object.freeze({ id: "comment-attachment", body: "File", createdAt: "2026-01-01T00:00:00.000Z", attachments: Object.freeze([Object.freeze({ id: "attachment-1", name: "photo.png", mimeType: "image/png", size: 5 })]) });
    renderApp(baseApi(Object.freeze([task({ id: "task-1", title: "Plan MVP", comments: Object.freeze([attachmentComment]) })])), true);
    expect(await screen.findByLabelText("Task has attachments")).toBeVisible();
  });

  it("lists attachments with previews, task links, size, and upload date", async () => {
    window.history.replaceState({}, "", "/attachments");
    const attachmentComment = Object.freeze({ id: "comment-attachment", body: "", createdAt: "2026-01-01T00:00:00.000Z", attachments: Object.freeze([Object.freeze({ id: "attachment-1", name: "photo.png", mimeType: "image/png", size: 5 })]) });
    const api = Object.freeze({
      ...baseApi(Object.freeze([task({ id: "task-1", title: "Plan MVP", comments: Object.freeze([attachmentComment]) })])),
      getAuthStatus: async () => Object.freeze({ accessMode: "password" as const, authenticated: true, user: Object.freeze({ id: "admin", username: "admin", isAdmin: true }), attachmentsEnabled: true })
    });
    renderApp(api, true);
    expect(await screen.findByRole("heading", { name: "Attachments" })).toBeVisible();
    expect(await screen.findByRole("img", { name: "photo.png" })).toBeVisible();
    expect(document.querySelector('.attachment-library-file-link[href="/attachments/attachment-1"]')).toBeInTheDocument();
    const taskLink = screen.getByRole("link", { name: "Plan MVP" });
    expect(taskLink).toHaveAttribute("href", "/attachments");
    expect(screen.getByText("5 B")).toBeInTheDocument();
    expect(screen.getByText(new Date("2026-01-01T00:00:00.000Z").toLocaleString())).toBeInTheDocument();
    expect(within(screen.getByRole("complementary", { name: "Navigation" })).getByRole("link", { name: "Attachments" })).toBeVisible();
    await userEvent.click(taskLink);
    expect(await screen.findByRole("dialog", { name: "Task details: Plan MVP" })).toBeVisible();
    expect(window.location.pathname).toBe("/attachments");
    await userEvent.click(screen.getByRole("button", { name: "Close task details" }));
    expect(await screen.findByRole("heading", { name: "Attachments" })).toBeVisible();
    expect(window.location.pathname).toBe("/attachments");
  });

  it("removes individual attachments and deletes an empty attachment-only comment", async () => {
    const comments = Object.freeze([
      Object.freeze({ id: "comment-only", body: "", createdAt: "2026-01-01T00:00:00.000Z", attachments: Object.freeze([Object.freeze({ id: "attachment-only", name: "only.png", mimeType: "image/png", size: 5 })]) }),
      Object.freeze({ id: "comment-text", body: "Keep this note", createdAt: "2026-01-02T00:00:00.000Z", attachments: Object.freeze([Object.freeze({ id: "attachment-text", name: "note.png", mimeType: "image/png", size: 6 })]) })
    ]);
    const updateTask = vi.fn(async (id: string, patch: Parameters<ApplicationApi["updateTask"]>[1]): Promise<Task> => task({ id, title: "Plan MVP", comments: patch.comments ?? [] }));
    renderApp(Object.freeze({ ...baseApi(Object.freeze([task({ id: "task-1", title: "Plan MVP", comments })])), updateTask }), true);
    await userEvent.click(await screen.findByRole("button", { name: "Plan MVP" }));
    const dialog = screen.getByRole("dialog", { name: "Task details: Plan MVP" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Remove attachment only.png" }));
    await waitFor(() => expect(updateTask).toHaveBeenLastCalledWith("task-1", { comments: [comments[1]] }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Remove attachment note.png" }));
    await waitFor(() => expect(updateTask).toHaveBeenLastCalledWith("task-1", { comments: [expect.objectContaining({ id: "comment-text", body: "Keep this note", attachments: [] })] }));
  });

  it("allows submitting an attachment without comment text", async () => {
    const createComment = vi.fn(async () => undefined);
    renderApp(Object.freeze({ ...baseApi(Object.freeze([task({ id: "task-1", title: "Plan MVP" })])), createComment }), true);
    await userEvent.click(await screen.findByRole("button", { name: "Plan MVP" }));
    const dialog = screen.getByRole("dialog", { name: "Task details: Plan MVP" });
    expect(within(dialog).getByLabelText("Add comment").closest(".card")).toHaveClass("border", "p-3");
    const file = new File(["notes"], "notes.txt", { type: "text/plain" });
    const submit = within(dialog).getByRole("button", { name: "Add comment" });
    expect(submit).toBeDisabled();
    const fileInput = within(dialog).getByLabelText("Attach files to comment");
    await userEvent.upload(fileInput, file);
    const notification = await screen.findByText("Файл «notes.txt» прикреплён");
    expect(notification).toBeVisible();
    expect(notification.closest(".Toastify")?.parentElement).toBe(document.body);
    expect(fileInput).toHaveValue("");
    expect(createComment).not.toHaveBeenCalled();
    expect(submit).toBeEnabled();
    await userEvent.click(submit);
    await waitFor(() => expect(createComment).toHaveBeenCalledWith("task-1", "", [file]));
    expect(fileInput).toHaveValue("");
    expect(within(dialog).queryByText("notes.txt")).not.toBeInTheDocument();
  });

  it("immediately saves a pasted clipboard image as a comment on an existing task", async () => {
    const createComment = vi.fn(async () => undefined);
    renderApp(Object.freeze({ ...baseApi(Object.freeze([task({ id: "task-1", title: "Plan MVP" })])), createComment }), true);
    await userEvent.click(await screen.findByRole("button", { name: "Plan MVP" }));
    const dialog = screen.getByRole("dialog", { name: "Task details: Plan MVP" });
    const image = new File(["png data"], "pasted.png", { type: "image/png" });
    fireEvent.paste(document.body, { clipboardData: { items: [{ kind: "file", getAsFile: () => image }], files: [] } });
    await waitFor(() => expect(createComment).toHaveBeenCalledWith("task-1", "", [image]));
    expect(within(dialog).queryByText("pasted.png")).not.toBeInTheDocument();
    expect(await screen.findByText("Файл «pasted.png» прикреплён")).toBeVisible();
    expect(createComment).toHaveBeenCalledTimes(1);
  });

  it("pastes clipboard images into the task creation dialog without an initial comment field", async () => {
    const createComment = vi.fn(async () => undefined);
    renderApp(Object.freeze({ ...baseApi(Object.freeze([])), createComment }), true);
    await userEvent.click(await screen.findByRole("button", { name: "Add task Q" }));
    const dialog = screen.getByRole("dialog", { name: "Add task" });
    expect(within(dialog).queryByLabelText("Initial task comment")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Initial comment")).not.toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText("New task title"), "Task with pasted image");
    const image = new File(["png data"], "pasted.png", { type: "image/png" });
    fireEvent.paste(within(dialog).getByLabelText("New task title"), { clipboardData: { items: [{ kind: "file", getAsFile: () => image }], files: [] } });
    expect(within(dialog).getByText("pasted.png")).toBeInTheDocument();
    expect(await screen.findByText("Файл «pasted.png» прикреплён")).toBeVisible();
    await userEvent.click(within(dialog).getByRole("button", { name: "Add task" }));
    await waitFor(() => expect(createComment).toHaveBeenCalledWith("created", "", [image]));
  });

  it("reveals optional Add task fields from mobile shortcuts and focuses their inputs", async () => {
    renderApp(baseApi(Object.freeze([])));
    await userEvent.click(await screen.findByRole("button", { name: "Add task Q" }));
    const dialog = screen.getByRole("dialog", { name: "Add task" });
    const shortcuts = within(dialog.querySelector(".add-task-mobile-shortcuts") as HTMLElement);

    await userEvent.click(shortcuts.getByRole("button", { name: "Description" }));
    expect(within(dialog).getByLabelText("New task description")).toHaveFocus();
    await userEvent.click(within(dialog).getByRole("button", { name: "Clear description and hide section" }));
    expect(shortcuts.getByRole("button", { name: "Description" })).toBeInTheDocument();

    await userEvent.click(shortcuts.getByRole("button", { name: "Labels" }));
    expect(within(dialog).getByLabelText("New task labels")).toHaveFocus();
    await userEvent.click(within(dialog).getByRole("button", { name: "Remove labels and hide section" }));
    expect(shortcuts.getByRole("button", { name: "Labels" })).toBeInTheDocument();

    await userEvent.click(shortcuts.getByRole("button", { name: "Date" }));
    const dateDialog = within(dialog).getByRole("dialog", { name: "Add date" });
    expect(within(dateDialog).getByLabelText("New task date")).toHaveFocus();
    await userEvent.click(within(dateDialog).getByRole("button", { name: "Cancel" }));
    expect(shortcuts.getByRole("button", { name: "Date" })).toBeInTheDocument();
  });

  it("reveals and focuses the subtask editor from the Subtasks shortcut", async () => {
    renderApp(baseApi(Object.freeze([task({ id: "task-1", title: "Plan release" })])));
    await userEvent.click(await screen.findByRole("button", { name: "Plan release" }));
    const dialog = screen.getByRole("dialog", { name: "Task details: Plan release" });
    const shortcutButtons = within(dialog.querySelector(".task-details-mobile-shortcuts") as HTMLElement).getAllByRole("button");
    expect(shortcutButtons.slice(0, 3).map((button) => button.textContent?.trim())).toEqual(["Labels", "Date", "Subtasks"]);
    expect(shortcutButtons.slice(0, 3).every((button) => button.querySelector("svg") !== null)).toBe(true);
    expect(dialog.querySelector(".task-subtasks-card")).toHaveClass("task-subtasks-hidden");
    await userEvent.click(within(dialog).getByRole("button", { name: "Subtasks" }));
    expect(within(dialog).getByLabelText("New subtask title")).toHaveFocus();
    expect(dialog.querySelector(".task-subtasks-card")).toHaveClass("task-subtasks-open");
    expect(within(dialog).queryByRole("button", { name: "Subtasks" })).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete all subtasks and hide section" }));
    expect(within(dialog).getByRole("button", { name: "Subtasks" })).toBeInTheDocument();
  });

  it("deletes existing subtasks when their mobile section is closed", async () => {
    let childDeleted = false;
    const child = task({ id: "child-1", title: "Write tests", parentId: "task-1" });
    const parentWithChild = task({ id: "task-1", title: "Plan release", children: Object.freeze([child]) });
    const parentWithoutChild = task({ id: "task-1", title: "Plan release" });
    const deleteTask = vi.fn(async () => { childDeleted = true; });
    const api = Object.freeze({
      ...baseApi(Object.freeze([parentWithChild])),
      listTasks: async () => Object.freeze([childDeleted ? parentWithoutChild : parentWithChild]),
      deleteTask
    });
    renderApp(api);
    await userEvent.click(await screen.findByRole("button", { name: "Plan release" }));
    const dialog = screen.getByRole("dialog", { name: "Task details: Plan release" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete all subtasks and hide section" }));
    await waitFor(() => expect(deleteTask).toHaveBeenCalledWith("child-1"));
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Subtasks" })).toBeInTheDocument());
  });

  it("focuses the label input when Add labels reveals the editor", async () => {
    renderApp(baseApi(Object.freeze([task({ id: "task-1", title: "Plan release" })])));
    await userEvent.click(await screen.findByRole("button", { name: "Plan release" }));
    const dialog = screen.getByRole("dialog", { name: "Task details: Plan release" });
    await userEvent.click(within(dialog.querySelector(".task-details-mobile-shortcuts") as HTMLElement).getByRole("button", { name: "Labels" }));
    expect(within(dialog).getByLabelText("Labels")).toHaveFocus();
  });

  it("focuses the comment input when Add comments reveals the editor", async () => {
    renderApp(baseApi(Object.freeze([task({ id: "task-1", title: "Plan release" })])));
    await userEvent.click(await screen.findByRole("button", { name: "Plan release" }));
    const dialog = screen.getByRole("dialog", { name: "Task details: Plan release" });
    await userEvent.click(within(dialog.querySelector(".task-details-mobile-shortcuts") as HTMLElement).getByRole("button", { name: "Comments" }));
    expect(within(dialog).getByLabelText("Add comment")).toHaveFocus();
  });

  it("removes labels, comments, and date when their mobile sections are closed", async () => {
    const updateTask = vi.fn(async (id: string, patch: Parameters<ApplicationApi["updateTask"]>[1]): Promise<Task> => task({
      id,
      title: "Plan release",
      labels: patch.labels ?? ["work"],
      comments: patch.comments ?? [Object.freeze({ id: "comment-1", body: "Note", createdAt: "2026-01-01T00:00:00.000Z" })],
      dueDate: patch.dueDate === null ? null : "2026-01-03"
    }));
    renderApp(Object.freeze({ ...baseApi(Object.freeze([task({
      id: "task-1",
      title: "Plan release",
      labels: Object.freeze(["work"]),
      comments: Object.freeze([Object.freeze({ id: "comment-1", body: "Note", createdAt: "2026-01-01T00:00:00.000Z" })]),
      dueDate: "2026-01-03"
    })])), updateTask }));
    await userEvent.click(await screen.findByRole("button", { name: "Plan release" }));
    const dialog = screen.getByRole("dialog", { name: "Task details: Plan release" });

    await userEvent.click(within(dialog).getByRole("button", { name: "Remove all labels and hide section" }));
    await waitFor(() => expect(updateTask).toHaveBeenCalledWith("task-1", { labels: [] }));
    await waitFor(() => expect(within(dialog.querySelector(".task-details-mobile-shortcuts") as HTMLElement).getByRole("button", { name: "Labels" })).toBeInTheDocument());

    await userEvent.click(within(dialog).getByRole("button", { name: "Remove all comments and hide section" }));
    await waitFor(() => expect(updateTask).toHaveBeenCalledWith("task-1", { comments: [] }));
    await waitFor(() => expect(within(dialog.querySelector(".task-details-mobile-shortcuts") as HTMLElement).getByRole("button", { name: "Comments" })).toBeInTheDocument());

    await userEvent.click(within(dialog).getByRole("button", { name: "Remove date and hide section" }));
    await waitFor(() => expect(updateTask).toHaveBeenCalledWith("task-1", { dueDate: null }));
    await waitFor(() => expect(within(dialog.querySelector(".task-details-mobile-shortcuts") as HTMLElement).getByRole("button", { name: "Date" })).toBeInTheDocument());
  });

  it("asks before removing saved labels, comments, and subtasks from mobile sections", async () => {
    const updateTask = vi.fn(async (id: string, patch: Parameters<ApplicationApi["updateTask"]>[1]): Promise<Task> => task({ id, title: "Plan release", ...patch }));
    const deleteTask = vi.fn(async () => undefined);
    const child = task({ id: "child-1", title: "Write tests", parentId: "task-1" });
    const savedTask = task({
      id: "task-1",
      title: "Plan release",
      labels: Object.freeze(["work"]),
      comments: Object.freeze([Object.freeze({ id: "comment-1", body: "Saved note", createdAt: "2026-01-01T00:00:00.000Z" })]),
      children: Object.freeze([child])
    });
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderApp(Object.freeze({ ...baseApi(Object.freeze([savedTask])), updateTask, deleteTask }));
    await userEvent.click(await screen.findByRole("button", { name: "Plan release" }));
    const dialog = screen.getByRole("dialog", { name: "Task details: Plan release" });

    await userEvent.click(within(dialog).getByRole("button", { name: "Remove all labels and hide section" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Remove all comments and hide section" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete all subtasks and hide section" }));

    expect(window.confirm).toHaveBeenCalledTimes(3);
    expect(window.confirm).toHaveBeenNthCalledWith(1, "Remove all saved labels from this task?");
    expect(window.confirm).toHaveBeenNthCalledWith(2, "Remove all saved comments from this task?");
    expect(window.confirm).toHaveBeenNthCalledWith(3, "Delete all saved subtasks and their descendants?");
    expect(updateTask).not.toHaveBeenCalled();
    expect(deleteTask).not.toHaveBeenCalled();
  });

  it("closes the mobile sidebar after each route selection", async () => {
    const user = userEvent.setup();
    renderApp(baseApi(Object.freeze([])));
    const sidebar = screen.getByRole("complementary", { name: "Navigation" });
    const menuToggle = screen.getByRole("button", { name: "Open navigation" });

    await user.click(menuToggle);
    expect(sidebar).toHaveClass("mobile-sidebar-open");
    await user.click(within(sidebar).getByRole("link", { name: "Dates" }));
    await waitFor(() => expect(sidebar).not.toHaveClass("mobile-sidebar-open"));

    await user.click(menuToggle);
    expect(sidebar).toHaveClass("mobile-sidebar-open");
    await user.click(within(sidebar).getByRole("link", { name: "Settings" }));
    await waitFor(() => expect(sidebar).not.toHaveClass("mobile-sidebar-open"));
  });

  it("renders a task list", async () => {
    renderApp(baseApi(Object.freeze([task({ id: "1", title: "Plan MVP" })])));

    expect(await screen.findByText("Plan MVP")).toBeInTheDocument();
  });

  it("shows a task description and comment count in the task list", async () => {
    const description = "A detailed description that is available directly from the task list.";
    renderApp(baseApi(Object.freeze([task({
      id: "task-with-details",
      title: "Plan release",
      description,
      comments: Object.freeze([
        Object.freeze({ id: "comment-1", body: "First", createdAt: "2026-01-01T00:00:00.000Z" }),
        Object.freeze({ id: "comment-2", body: "Second", createdAt: "2026-01-02T00:00:00.000Z" })
      ])
    })])));

    const title = await screen.findByRole("button", { name: "Plan release" });
    const row = title.closest<HTMLElement>(".task-row");
    if (row === null) throw new Error("Unable to find task row");
    expect(within(row).getByText(description)).toHaveClass("task-description-preview");
    expect(within(row).getByLabelText("2 comments")).toHaveTextContent("2");
  });

  it("adds suggested labels and removes label chips in task details", async () => {
    const updateTask = vi.fn(async (id: string, patch: Parameters<ApplicationApi["updateTask"]>[1]): Promise<Task> => task({ id, title: "Plan release", labels: patch.labels ?? [] }));
    renderApp(Object.freeze({
      ...baseApi(Object.freeze([
        task({ id: "task-1", title: "Plan release", labels: Object.freeze(["work"]) }),
        task({ id: "task-2", title: "Review notes", labels: Object.freeze(["review"]) })
      ])),
      updateTask
    }));

    await userEvent.click(await screen.findByRole("button", { name: "Plan release" }));
    const dialog = screen.getByRole("dialog", { name: "Task details: Plan release" });
    const input = within(dialog).getByLabelText("Labels");
    await userEvent.click(input);
    await userEvent.click(within(dialog).getByRole("option", { name: "review" }));
    await waitFor(() => expect(updateTask).toHaveBeenCalledWith("task-1", { labels: ["work", "review"] }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Remove label work" }));
    await waitFor(() => expect(updateTask).toHaveBeenCalledWith("task-1", { labels: ["review"] }));
  });

  it("edits text on demand with Save, Cancel, Enter and Escape, and edits dates and labels", async () => {
    const updateTask = vi.fn(async (id: string, patch: Parameters<ApplicationApi["updateTask"]>[1]): Promise<Task> => task({ id, title: patch.title ?? "Plan MVP", description: patch.description ?? "", dueDate: patch.dueDate ?? null, labels: patch.labels ?? [], comments: patch.comments ?? [] }));
    renderApp(Object.freeze({ ...baseApi(Object.freeze([task({ id: "task-1", title: "Plan MVP" })])), updateTask }));
    await userEvent.click(await screen.findByRole("button", { name: "Plan MVP" }));
    const dialog = screen.getByRole("dialog", { name: "Task details: Plan MVP" });
    const editTitleButton = within(dialog).getByRole("button", { name: "Edit task title" });
    expect(editTitleButton.querySelector("svg")).not.toBeNull();
    await userEvent.click(editTitleButton);
    await userEvent.clear(within(dialog).getByRole("textbox", { name: "Edit task title" }));
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Edit task title" }), "Plan launch{Enter}");
    await waitFor(() => expect(updateTask).toHaveBeenCalledWith("task-1", { title: "Plan launch" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Edit task description" }));
    const descriptionField = within(dialog).getByRole("textbox", { name: "Edit task description" });
    await userEvent.type(descriptionField, "Ship release");
    fireEvent.keyDown(descriptionField, { key: "Enter", ctrlKey: true });
    await waitFor(() => expect(updateTask).toHaveBeenCalledWith("task-1", { description: "Ship release" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Edit task description" }));
    await userEvent.clear(within(dialog).getByRole("textbox", { name: "Edit task description" }));
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Edit task description" }), "discard{Escape}");
    expect(within(dialog).getByRole("button", { name: "Edit task description" })).toHaveTextContent("Ship release");
    await userEvent.click(within(dialog).getByRole("button", { name: "＋ Add date" }));
    fireEvent.change(screen.getByLabelText("New date"), { target: { value: "2026-11-01" } });
    await userEvent.click(within(screen.getByRole("dialog", { name: "Add date" })).getByRole("button", { name: "Save date" }));
    await waitFor(() => expect(updateTask).toHaveBeenCalledWith("task-1", { dueDate: "2026-11-01" }));
    expect(dialog.querySelector(".task-detail-date svg")).not.toBeNull();
    await userEvent.type(within(dialog).getByLabelText("Labels"), "work{Enter}");
    await waitFor(() => expect(updateTask).toHaveBeenCalledWith("task-1", { labels: ["work"] }));
    vi.stubGlobal("crypto", Object.freeze({}));
    await userEvent.type(within(dialog).getByLabelText("Add comment"), "Looks good");
    await userEvent.click(within(dialog).getByRole("button", { name: "Add comment" }));
    await waitFor(() => expect(updateTask).toHaveBeenCalledWith("task-1", expect.objectContaining({ comments: [expect.objectContaining({ body: "Looks good" })] })));
    expect(within(dialog).queryByRole("button", { name: "Save task" })).not.toBeInTheDocument();
  });

  it("shows task location and parent links, and moves tasks between Inbox and projects", async () => {
    const moveTask = vi.fn(async (id: string, projectId: string | null, sectionId: string | null): Promise<Task> => task({ id, title: "Child task", projectId, sectionId }));
    const parent = task({ id: "parent-1", title: "Parent task", children: Object.freeze([task({ id: "child-1", title: "Child task", parentId: "parent-1" })]) });
    renderApp(Object.freeze({
      ...baseApi(Object.freeze([parent])),
      listProjects: async () => Object.freeze([project({ id: "project-1", title: "Roadmap" }), project({ id: "project-2", title: "Alpha" })]),
      listSections: async () => Object.freeze([section({ id: "section-1", title: "Next", projectId: "project-1" }), section({ id: "section-2", title: "Back", projectId: "project-1" })]),
      moveTask
    }));

    await userEvent.click(await screen.findByRole("button", { name: "Child task" }));
    const dialog = screen.getByRole("dialog", { name: "Task details: Child task" });
    expect(within(dialog).getAllByRole("link", { name: "Inbox" })[0]).toHaveAttribute("href", "/");
    expect(within(dialog).getByRole("link", { name: "Parent task" })).toHaveAttribute("href", "/?task=parent-1");
    const locationPicker = within(dialog).getByLabelText("Project, section, or Inbox");
    expect(within(locationPicker).getAllByRole("option").map((option) => option.textContent)).toEqual(["Alpha", "Inbox", "Roadmap", "Roadmap / Back", "Roadmap / Next"]);
    await userEvent.selectOptions(locationPicker, "project:project-1");
    await waitFor(() => expect(moveTask).toHaveBeenCalledWith("child-1", "project-1", null, null, null, null));
    expect(locationPicker).toHaveValue("project:project-1");
    expect(within(dialog).getByRole("option", { name: "Roadmap / Next" })).toBeInTheDocument();
    await userEvent.selectOptions(locationPicker, "section:section-1");
    await waitFor(() => expect(moveTask).toHaveBeenCalledWith("child-1", "project-1", "section-1", null, null, null));
    expect(locationPicker).toHaveValue("section:section-1");
    expect(within(dialog).queryByRole("navigation", { name: "Task location" })).not.toBeInTheDocument();
  });

  it("calls the create handler when a task is submitted", async () => {
    const createTask = vi.fn(async (title: string): Promise<Task> => task({ id: "created", title }));

    renderApp(
      Object.freeze({
        ...baseApi(Object.freeze([])),
        createTask,
      })
    );

    await userEvent.click(screen.getByRole("button", { name: "Add task Q" }));
    await userEvent.type(screen.getByLabelText("New task title"), "Write tests");
    await userEvent.click(within(screen.getByRole("dialog", { name: "Add task" })).getByRole("button", { name: "Add task" }));

    await waitFor(() => expect(createTask).toHaveBeenCalledWith("Write tests", null, null, null));
  });

  it("creates projects and sends new tasks to the selected project", async () => {
    let projects = Object.freeze([] as ReadonlyArray<Project>);
    const createTask = vi.fn(async (title: string, projectId: string | null, sectionId: string | null, parentId: string | null): Promise<Task> =>
      task({ id: "created", title, projectId, sectionId, parentId })
    );
    const createProject = vi.fn(async (title: string): Promise<Project> => {
      const created = project({ id: "project-1", title });
      projects = Object.freeze([...projects, created]);

      return created;
    });

    renderApp(
      Object.freeze({
        ...baseApi(Object.freeze([])),
        listProjects: async () => projects,
        createProject,
        createTask
      })
    );

    await userEvent.click(screen.getByRole("button", { name: "Add project" }));
    await userEvent.type(screen.getByLabelText("Project title"), "Roadmap");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await userEvent.click(await screen.findByRole("button", { name: "Roadmap" }));
    await userEvent.click(screen.getByRole("button", { name: "Add task Q" }));
    await userEvent.type(screen.getByLabelText("New task title"), "Define milestones");
    await userEvent.click(within(screen.getByRole("dialog", { name: "Add task" })).getByRole("button", { name: "Add task" }));

    await waitFor(() => expect(createTask).toHaveBeenCalledWith("Define milestones", "project-1", null, null));
  });

  it("creates subtasks under an existing task", async () => {
    const createTask = vi.fn(
      async (title: string, projectId: string | null, sectionId: string | null, parentId: string | null): Promise<Task> =>
        task({ id: "subtask-1", title, projectId, sectionId, parentId })
    );

    renderApp(
      Object.freeze({
        ...baseApi(Object.freeze([task({ id: "task-1", title: "Plan MVP" })])),
        createTask
      })
    );

    await screen.findByText("Plan MVP");
    await userEvent.click(screen.getByRole("button", { name: "Add subtask to Plan MVP" }));
    expect(screen.getByLabelText("Subtask for Plan MVP")).toHaveFocus();
    await userEvent.type(screen.getByLabelText("Subtask for Plan MVP"), "Write outline");
    await userEvent.click(screen.getByRole("button", { name: "Add subtask" }));

    await waitFor(() => expect(createTask).toHaveBeenCalledWith("Write outline", null, null, "task-1"));
  });

  it("opens task actions from the right-click menu in Inbox", async () => {
    renderApp(Object.freeze({ ...baseApi(Object.freeze([task({ id: "1", title: "Plan MVP" })])) }));

    await screen.findByText("Plan MVP");
    fireEvent.contextMenu(taskRow("Plan MVP"), { clientX: 120, clientY: 90 });

    const menu = screen.getByRole("menu", { name: "Task actions for Plan MVP" });
    expect(within(menu).getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Open",
      "Quick edit",
      "Add subtask",
      "Delete"
    ]);

    await userEvent.click(within(menu).getByRole("menuitem", { name: "Quick edit" }));
    expect(screen.getByLabelText("Edit Plan MVP")).toHaveFocus();
  });

  it("selects the root task when clicking anywhere in its subtree", async () => {
    renderApp(Object.freeze({
      ...baseApi(Object.freeze([task({ id: "root", title: "Parent", children: Object.freeze([task({ id: "child", title: "Child", parentId: "root", children: Object.freeze([task({ id: "grandchild", title: "Grandchild", parentId: "child" })]) })]) })]))
    }));

    await screen.findByText("Parent");
    await userEvent.click(screen.getByRole("button", { name: "Select tasks" }));
    await userEvent.click(taskRow("Child"));
    expect(screen.getByRole("button", { name: "Parent" })).toHaveAttribute("aria-pressed", "true");
    expect(taskRow("Parent")).toHaveClass("selection-selected");
    expect(taskRow("Child")).toHaveClass("selection-selected");
    expect(taskRow("Grandchild")).toHaveClass("selection-selected");
    expect(taskRow("Parent")).toHaveClass("selection-mode");

    await userEvent.click(taskRow("Grandchild"));
    expect(screen.queryByRole("dialog", { name: "Task details: Child" })).not.toBeInTheDocument();
    expect(screen.getAllByText("0 selected")).toHaveLength(2);

    await userEvent.click(taskRow("Parent"));
    expect(taskRow("Child")).toHaveClass("selection-selected");
    await userEvent.click(taskRow("Parent"));
    expect(taskRow("Child")).not.toHaveClass("selection-selected");
  });

  it("toggles selection mode with the S key in any keyboard layout and exits with Escape", async () => {
    renderApp(Object.freeze({ ...baseApi(Object.freeze([task({ id: "root", title: "Parent" })])) }));

    await screen.findByText("Parent");
    fireEvent.keyDown(document, { key: "ы", code: "KeyS" });
    expect(taskRow("Parent")).toHaveClass("selection-mode");

    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
    expect(taskRow("Parent")).not.toHaveClass("selection-mode");

    fireEvent.keyDown(document, { key: "s", code: "KeyS" });
    expect(taskRow("Parent")).toHaveClass("selection-mode");
  });

  it("moves selected top-level tasks and cancels selection", async () => {
    const moveTask = vi.fn(async (id: string, projectId: string | null, sectionId: string | null, parentId: string | null): Promise<Task> => task({ id, title: "Moved", projectId, sectionId, parentId }));
    renderApp(Object.freeze({
      ...baseApi(Object.freeze([task({ id: "root", title: "Parent", children: Object.freeze([task({ id: "child", title: "Child", parentId: "root" })]) })])),
      listProjects: async () => Object.freeze([project({ id: "project-1", title: "Roadmap" })]),
      moveTask
    }));

    await screen.findByText("Parent");
    await userEvent.click(screen.getByRole("button", { name: "Select tasks" }));
    await userEvent.click(screen.getByRole("button", { name: "Parent" }));
    await userEvent.click(screen.getAllByRole("button", { name: "Move selected tasks" })[0]!);
    const dialog = screen.getByRole("dialog", { name: "Move selected tasks" });
    await userEvent.selectOptions(within(dialog).getByLabelText("Move selected tasks to"), "project:project-1");
    await userEvent.click(within(dialog).getByRole("button", { name: "Move selected tasks" }));

    await waitFor(() => expect(moveTask).toHaveBeenCalledTimes(1));
    expect(moveTask).toHaveBeenCalledWith("root", "project-1", null, null, null, null);
    expect(screen.queryByRole("group", { name: "Selected task actions" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Select tasks" }));
    await userEvent.click(screen.getByRole("button", { name: "Parent" }));
    await userEvent.click(screen.getAllByRole("button", { name: "Cancel selection" })[0]!);
    expect(screen.queryByRole("group", { name: "Selected task actions" })).not.toBeInTheDocument();
  });

  it("deletes selected roots with the existing confirmation and their subtasks", async () => {
    const deleteTask = vi.fn(async () => undefined);
    renderApp(Object.freeze({
      ...baseApi(Object.freeze([task({ id: "root", title: "Parent", children: Object.freeze([task({ id: "child", title: "Child", parentId: "root" })]) })])),
      deleteTask
    }));

    await screen.findByText("Parent");
    await userEvent.click(screen.getByRole("button", { name: "Select tasks" }));
    await userEvent.click(screen.getByRole("button", { name: "Parent" }));
    await userEvent.click(screen.getAllByRole("button", { name: "Delete selected tasks" })[0]!);

    expect(window.confirm).toHaveBeenCalledWith("Delete 1 selected task and all their subtasks?");
    await waitFor(() => expect(deleteTask).toHaveBeenCalledTimes(1));
    expect(deleteTask).toHaveBeenCalledWith("root");
  });

  it("shows a created project from the create response", async () => {
    const createProject = vi.fn(async (title: string): Promise<Project> => project({ id: "project-1", title }));

    renderApp(
      Object.freeze({
        ...baseApi(Object.freeze([])),
        listProjects: async () => Object.freeze([]),
        createProject
      })
    );

    await userEvent.click(screen.getByRole("button", { name: "Add project" }));
    await userEvent.type(screen.getByLabelText("Project title"), "Roadmap");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(createProject).toHaveBeenCalledWith("Roadmap", null));
    expect(await screen.findByRole("button", { name: "Roadmap" })).toBeInTheDocument();
  });

  it("updates and deletes projects from the sidebar", async () => {
    const updateProject = vi.fn(async (id: string, patch: Readonly<{ title?: string; description?: string }>): Promise<Project> => project({ id, title: patch.title ?? "Roadmap", description: patch.description ?? "" }));
    const deleteProject = vi.fn(async () => undefined);

    renderApp(
      Object.freeze({
        ...baseApi(Object.freeze([])),
        listProjects: async () => Object.freeze([project({ id: "project-1", title: "Roadmap" })]),
        updateProject,
        deleteProject
      })
    );

    await screen.findByRole("button", { name: "Roadmap" });
    await userEvent.click(screen.getByLabelText("Project menu Roadmap"));
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    await screen.findByRole("button", { name: "Save project" });
    const editInput = screen.getAllByLabelText("Project title").at(0);

    if (editInput === undefined) {
      throw new Error("Missing project edit input");
    }

    await userEvent.clear(editInput);
    await userEvent.type(editInput, "Launch plan");
    await userEvent.click(screen.getByRole("button", { name: "Save project" }));

    await waitFor(() => expect(updateProject).toHaveBeenCalledWith("project-1", { title: "Launch plan" }));

    await userEvent.click(screen.getByLabelText("Project menu Launch plan"));
    await userEvent.click(await screen.findByRole("button", { name: "Delete" }));

    await waitFor(() => expect(deleteProject).toHaveBeenCalledWith("project-1"));
  });

  it("saves, edits, and removes the Inbox description", async () => {
    let description = "";
    renderApp(Object.freeze({
      ...baseApi(Object.freeze([])),
      getInboxDescription: async () => description,
      updateInboxDescription: async (next) => { description = next; }
    }));

    await userEvent.click(await screen.findByRole("button", { name: "Add description" }));
    await userEvent.type(screen.getByLabelText("Scope description"), "Inbox notes");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Inbox notes")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Edit description" }));
    await userEvent.clear(screen.getByLabelText("Scope description"));
    await userEvent.type(screen.getByLabelText("Scope description"), "Updated notes");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Updated notes")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Delete description" }));
    expect(await screen.findByRole("button", { name: "Add description" })).toBeInTheDocument();
  });

  it("closes an open project menu with Escape and outside click", async () => {
    renderApp(Object.freeze({ ...baseApi(Object.freeze([])), listProjects: async () => Object.freeze([project({ id: "project-1", title: "Roadmap" })]) }));
    await screen.findByRole("button", { name: "Roadmap" });
    const menu = screen.getByLabelText("Project menu Roadmap").parentElement;
    if (menu === null) throw new Error("Missing project menu");

    await userEvent.click(screen.getByLabelText("Project menu Roadmap"));
    expect(within(menu).getByRole("button", { name: "Duplicate" })).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(menu).not.toHaveAttribute("open"));

    await userEvent.click(screen.getByLabelText("Project menu Roadmap"));
    expect(within(menu).getByRole("button", { name: "Duplicate" })).toBeVisible();
    await userEvent.click(screen.getByRole("heading", { name: "Inbox", level: 1 }));
    await waitFor(() => expect(menu).not.toHaveAttribute("open"));
  });

  it("hides project archiving controls by default and keeps archived projects visible", async () => {
    renderApp(Object.freeze({
      ...baseApi(Object.freeze([])),
      listProjects: async () => Object.freeze([project({ id: "archived-project", title: "Roadmap", archived: true })])
    }));
    const roadmap = await screen.findByRole("button", { name: "Roadmap" });
    const sidebar = screen.getByRole("complementary", { name: "Navigation" });
    expect(within(sidebar).queryByRole("link", { name: "Archived projects" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByLabelText("Project menu Roadmap"));
    expect(within(sidebar).queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
    expect(roadmap).toBeVisible();
  });

  it("opens a duplicated project and saves its description independently", async () => {
    let projects: ReadonlyArray<Project> = Object.freeze([project({ id: "source", title: "Source", description: "Original notes" })]);
    const updateProject = vi.fn(async (id: string, patch: Readonly<{ description?: string }>): Promise<Project> => {
      const existing = projects.find((item) => item.id === id);
      if (existing === undefined) throw new Error("Unknown project");
      const updated = project({ ...existing, ...patch });
      projects = Object.freeze(projects.map((item) => item.id === id ? updated : item));
      return updated;
    });
    const duplicateProject = vi.fn(async (id: string): Promise<Project> => {
      const source = projects.find((item) => item.id === id);
      if (source === undefined) throw new Error("Unknown project");
      const duplicate = project({ ...source, id: "source-copy", title: "Source copy" });
      projects = Object.freeze([...projects, duplicate]);
      return duplicate;
    });
    renderApp(Object.freeze({ ...baseApi(Object.freeze([])), listProjects: async () => projects, updateProject, duplicateProject }));

    await userEvent.click(await screen.findByRole("button", { name: /^Source$/ }));
    await userEvent.click(screen.getByLabelText("Project menu Source"));
    await userEvent.click(screen.getByRole("button", { name: /^Duplicate$/ }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Source copy" })).toBeInTheDocument());
    expect(screen.getByText("Original notes")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Edit description" }));
    await userEvent.clear(screen.getByLabelText("Scope description"));
    await userEvent.type(screen.getByLabelText("Scope description"), "Copy notes only");
    await userEvent.click(screen.getByRole("button", { name: /^Save$/ }));
    await waitFor(() => expect(screen.getByText("Copy notes only")).toBeInTheDocument());
    expect(updateProject).toHaveBeenCalledWith("source-copy", expect.objectContaining({ description: "Copy notes only" }));

    await userEvent.click(screen.getByRole("button", { name: /^Source$/ }));
    expect(await screen.findByText("Original notes")).toBeInTheDocument();
    expect(screen.queryByText("Copy notes only")).not.toBeInTheDocument();
  });

  it("creates inbox sections and moves inbox tasks into them", async () => {
    let sections = Object.freeze([] as ReadonlyArray<Section>);
    const moveTask = vi.fn(async (id: string, projectId: string | null, sectionId: string | null, parentId: string | null): Promise<Task> =>
      task({ id, title: "Sort receipts", projectId, sectionId, parentId })
    );

    renderApp(
      Object.freeze({
        ...baseApi(Object.freeze([task({ id: "task-1", title: "Sort receipts" })])),
        listSections: async () => sections,
        createSection: async (title) => {
          const created = section({ id: "section-1", title });
          sections = Object.freeze([...sections, created]);

          return created;
        },
        moveTask
      })
    );

    await userEvent.click(screen.getByRole("button", { name: "Add section" }));
    await userEvent.type(screen.getByLabelText("Section title"), "Later");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    const dataTransfer = dragTask("Sort receipts");
    fireEvent.drop(await screen.findByLabelText("Section Later"), { dataTransfer });

    await waitFor(() => expect(moveTask).toHaveBeenCalledWith("task-1", null, "section-1", null, null, null));
  });

  it("shows a created inbox section from the create response", async () => {
    const createSection = vi.fn(async (title: string): Promise<Section> => section({ id: "section-1", title }));

    renderApp(
      Object.freeze({
        ...baseApi(Object.freeze([])),
        listSections: async () => Object.freeze([]),
        createSection
      })
    );

    await userEvent.click(screen.getByRole("button", { name: "Add section" }));
    await userEvent.type(screen.getByLabelText("Section title"), "Someday");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(createSection).toHaveBeenCalledWith("Someday", null));
    expect(await screen.findByRole("heading", { name: "Someday" })).toBeInTheDocument();
  });

  it("moves tasks between inbox and projects with drag and drop", async () => {
    const moveTask = vi.fn(async (id: string, projectId: string | null, sectionId: string | null, parentId: string | null): Promise<Task> =>
      task({ id, title: "Plan launch", projectId, sectionId, parentId })
    );

    renderApp(
      Object.freeze({
        ...baseApi(Object.freeze([task({ id: "task-1", title: "Plan launch", projectId: "project-1" })])),
        listProjects: async () => Object.freeze([project({ id: "project-1", title: "Launch" })]),
        moveTask
      })
    );

    await userEvent.click(await screen.findByRole("button", { name: "Launch" }));

    const dataTransfer = dragTask("Plan launch");
    fireEvent.drop(screen.getByRole("button", { name: "Inbox" }), { dataTransfer });

    await waitFor(() => expect(moveTask).toHaveBeenCalledWith("task-1", null, null, null, null, null));
  });

  it("highlights a project while a task is dragged over it", async () => {
    renderApp(
      Object.freeze({
        ...baseApi(Object.freeze([task({ id: "task-1", title: "Plan launch" })])),
        listProjects: async () => Object.freeze([project({ id: "project-1", title: "Launch" })])
      })
    );

    await screen.findByText("Plan launch");
    const dataTransfer = dragTask("Plan launch");
    const projectButton = await screen.findByRole("button", { name: "Launch" });

    fireEvent.dragEnter(projectButton, { dataTransfer });

    expect(projectButton).toHaveClass("drop-active");
  });

  it("nests a project inside the mobile project drop target", async () => {
    const moveProject = vi.fn(async (id: string, parentId: string | null): Promise<Project> => project({ id, title: "Source", parentId }));
    renderApp(Object.freeze({
      ...baseApi(Object.freeze([])),
      listProjects: async () => Object.freeze([project({ id: "source", title: "Source" }), project({ id: "target", title: "Target" })]),
      moveProject
    }));

    const sourceHandle = await screen.findByRole("button", { name: "Drag project Source" });
    const targetButton = screen.getByRole("button", { name: "Target" });
    const elementFromPointDescriptor = Object.getOwnPropertyDescriptor(document, "elementFromPoint");
    Object.defineProperty(document, "elementFromPoint", { configurable: true, value: vi.fn(() => targetButton) });
    // This synthetic touch PointerEvent omits `button`; the drag must still start.
    const pointer = (clientY: number) => ({ pointerId: 1, pointerType: "touch", clientX: 100, clientY });

    try {
      fireEvent.pointerDown(sourceHandle, pointer(50));
      expect(sourceHandle.closest(".project-nav-row")).toHaveClass("project-dragging");
      fireEvent.pointerMove(sourceHandle, pointer(55));
      expect(targetButton.closest(".project-nav-row")).toHaveClass("project-drop-inside");
      fireEvent.pointerUp(sourceHandle, pointer(55));
      await waitFor(() => expect(moveProject).toHaveBeenCalledWith("source", "target"));
    } finally {
      if (elementFromPointDescriptor === undefined) Reflect.deleteProperty(document, "elementFromPoint");
      else Object.defineProperty(document, "elementFromPoint", elementFromPointDescriptor);
    }
  });

  it("moves a task inside another task with drag and drop", async () => {
    const moveTask = vi.fn(async (id: string, projectId: string | null, sectionId: string | null, parentId: string | null): Promise<Task> =>
      task({ id, title: "Child", projectId, sectionId, parentId })
    );

    renderApp(
      Object.freeze({
        ...baseApi(Object.freeze([
          task({ id: "parent", title: "Parent task" }),
          task({ id: "child", title: "Child task" })
        ])),
        moveTask
      })
    );

    await screen.findByText("Parent task");
    const dataTransfer = dragTask("Child task");
    const parentRow = taskRow("Parent task");

    placePointer(parentRow, -50);
    fireEvent.drop(parentRow, { dataTransfer });

    await waitFor(() => expect(moveTask).toHaveBeenCalledWith("child", null, null, "parent", null, null));
  });

  it("reorders sibling tasks with drag and drop insertion lines", async () => {
    const moveTask = vi.fn(async (id: string, projectId: string | null, sectionId: string | null, parentId: string | null): Promise<Task> =>
      task({ id, title: "Moved", projectId, sectionId, parentId })
    );

    renderApp(
      Object.freeze({
        ...baseApi(Object.freeze([
          task({ id: "a", title: "Alpha", lexicalOrder: "a" }),
          task({ id: "b", title: "Beta", lexicalOrder: "b" }),
          task({ id: "c", title: "Gamma", lexicalOrder: "c" })
        ])),
        moveTask
      })
    );

    await screen.findByText("Alpha");
    const dataTransfer = dragTask("Gamma");
    const alphaRow = taskRow("Alpha");

    placePointer(alphaRow, 0);
    fireEvent.dragEnter(alphaRow, { dataTransfer });

    expect(alphaRow).toHaveClass("drag-before");

    fireEvent.drop(alphaRow, { dataTransfer });

    await waitFor(() => expect(moveTask).toHaveBeenCalledWith("c", null, null, null, "a", null));
  });

  it("indents and outdents tasks with keyboard shortcuts", async () => {
    const moveTask = vi.fn(async (id: string, projectId: string | null, sectionId: string | null, parentId: string | null): Promise<Task> =>
      task({ id, title: "Moved", projectId, sectionId, parentId })
    );

    renderApp(
      Object.freeze({
        ...baseApi(Object.freeze([
          task({ id: "a", title: "Alpha", lexicalOrder: "a" }),
          task({ id: "b", title: "Beta", lexicalOrder: "b" }),
          task({ id: "parent", title: "Parent", lexicalOrder: "c", children: Object.freeze([
            task({ id: "child", title: "Child", parentId: "parent", lexicalOrder: "a" })
          ]) })
        ])),
        moveTask
      })
    );

    await screen.findByText("Beta");
    fireEvent.keyDown(taskRow("Beta"), { key: "ArrowRight", ctrlKey: true });

    await waitFor(() => expect(moveTask).toHaveBeenCalledWith("b", null, null, "a", null, null));

    fireEvent.keyDown(taskRow("Child"), { key: "ArrowLeft", ctrlKey: true });

    await waitFor(() => expect(moveTask).toHaveBeenCalledWith("child", null, null, null, null, "parent"));
  });

  it("outdents a nested task by dragging it left", async () => {
    const moveTask = vi.fn(async (id: string, projectId: string | null, sectionId: string | null, parentId: string | null): Promise<Task> =>
      task({ id, title: "Moved", projectId, sectionId, parentId })
    );

    renderApp(
      Object.freeze({
        ...baseApi(Object.freeze([
          task({ id: "parent", title: "Parent", lexicalOrder: "a", children: Object.freeze([
            task({ id: "child", title: "Child", parentId: "parent", lexicalOrder: "a" })
          ]) })
        ])),
        moveTask
      })
    );

    await screen.findByText("Child");
    const dataTransfer = dragTask("Child");
    const childRow = taskRow("Child");

    placePointer(childRow, 0);
    Object.defineProperty(childRow, "getBoundingClientRect", {
      configurable: true,
      value: () =>
        Object.freeze({
          x: 50,
          y: 0,
          top: 0,
          right: 450,
          bottom: 100,
          left: 50,
          width: 400,
          height: 100,
          toJSON: () => Object.freeze({})
        })
    });
    fireEvent.drop(childRow, { dataTransfer, clientX: -24 });

    await waitFor(() => expect(moveTask).toHaveBeenCalledWith("child", null, null, null, null, "parent"));
  });

  it("calls update and delete handlers", async () => {
    const updateTask = vi.fn(async (id: string, patch: Readonly<{ title?: string }>): Promise<Task> => task({ id, title: patch.title ?? "Plan MVP" }));
    const deleteTask = vi.fn(async () => undefined);

    renderApp(
      Object.freeze({
        ...baseApi(Object.freeze([task({ id: "1", title: "Plan MVP" })])),
        updateTask,
        deleteTask
      })
    );

    await screen.findByText("Plan MVP");
    await userEvent.click(screen.getByRole("button", { name: "Edit task Plan MVP" }));
    expect(screen.getByLabelText("Edit Plan MVP")).toHaveFocus();
    await userEvent.clear(screen.getByLabelText("Edit Plan MVP"));
    await userEvent.type(screen.getByLabelText("Edit Plan MVP"), "Plan MVP carefully");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(updateTask).toHaveBeenCalledWith("1", { title: "Plan MVP carefully" }));

    await userEvent.click(screen.getByRole("button", { name: "Delete task Plan MVP" }));

    expect(window.confirm).toHaveBeenCalledWith('Delete task “Plan MVP” and its subtasks?');
    await waitFor(() => expect(deleteTask).toHaveBeenCalledWith("1"));
  });

  it("does not delete when the confirmation is declined", async () => {
    const deleteTask = vi.fn(async () => undefined);
    vi.mocked(window.confirm).mockReturnValue(false);

    renderApp(Object.freeze({ ...baseApi(Object.freeze([task({ id: "1", title: "Plan MVP" })])), deleteTask }));
    await screen.findByText("Plan MVP");
    await userEvent.click(screen.getByRole("button", { name: "Delete task Plan MVP" }));

    expect(window.confirm).toHaveBeenCalled();
    expect(deleteTask).not.toHaveBeenCalled();
  });

  it("skips delete confirmation when the preference is disabled", async () => {
    const deleteTask = vi.fn(async () => undefined);
    const api = Object.freeze({
      ...baseApi(Object.freeze([task({ id: "1", title: "Plan MVP" })])),
      getSettings: async () => Object.freeze({ confirmDelete: false, accessMode: "password" as const, username: "admin" }),
      deleteTask
    });

    renderApp(api);
    await screen.findByText("Plan MVP");
    await userEvent.click(screen.getByRole("button", { name: "Delete task Plan MVP" }));

    expect(window.confirm).not.toHaveBeenCalled();
    await waitFor(() => expect(deleteTask).toHaveBeenCalledWith("1"));
  });

  it("assigns a task to a project while editing", async () => {
    const updateTask = vi.fn(async (id: string, patch: Readonly<{ title?: string }>): Promise<Task> => task({ id, title: patch.title ?? "Plan MVP" }));
    const moveTask = vi.fn(async (id: string, projectId: string | null, sectionId: string | null, parentId: string | null): Promise<Task> =>
      task({ id, title: "Plan MVP", projectId, sectionId, parentId })
    );

    renderApp(
      Object.freeze({
        ...baseApi(Object.freeze([task({ id: "1", title: "Plan MVP" })])),
        listProjects: async () => Object.freeze([project({ id: "project-1", title: "Roadmap" })]),
        updateTask,
        moveTask
      })
    );

    await screen.findByText("Plan MVP");
    await userEvent.click(screen.getByRole("button", { name: "Edit task Plan MVP" }));
    await userEvent.selectOptions(screen.getByLabelText("Move Plan MVP to"), "project:project-1");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(updateTask).toHaveBeenCalledWith("1", { title: "Plan MVP" }));
    await waitFor(() => expect(moveTask).toHaveBeenCalledWith("1", "project-1", null, null, null, null));
  });

  it("updates and deletes inbox sections", async () => {
    const updateSection = vi.fn(async (id: string, title: string): Promise<Section> => section({ id, title }));
    const deleteSection = vi.fn(async () => undefined);

    renderApp(
      Object.freeze({
        ...baseApi(Object.freeze([])),
        listSections: async () => Object.freeze([section({ id: "section-1", title: "Later" })]),
        updateSection,
        deleteSection
      })
    );

    await screen.findByRole("heading", { name: "Later" });
    await userEvent.click(screen.getByRole("button", { name: "Edit section Later" }));
    const editInput = screen.getAllByLabelText("Section title").at(-1);

    if (editInput === undefined) {
      throw new Error("Missing section edit input");
    }

    await userEvent.clear(editInput);
    await userEvent.type(editInput, "Soon");
    await userEvent.click(screen.getByRole("button", { name: "Save section" }));

    await waitFor(() => expect(updateSection).toHaveBeenCalledWith("section-1", "Soon"));

    await userEvent.click(await screen.findByRole("button", { name: "Delete section Soon" }));

    await waitFor(() => expect(deleteSection).toHaveBeenCalledWith("section-1"));
  });

  it("previews markdown for the current task list", async () => {
    renderApp(baseApi(Object.freeze([task({ id: "1", title: "Plan MVP", completed: true })])));

    await screen.findByText("Plan MVP");
    expect(screen.queryByText("P1")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^Export$/ }));
    expect(await screen.findByRole("dialog", { name: "Export options" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Preview markdown" }));

    expect(await screen.findByRole("dialog", { name: "Markdown preview" })).toBeInTheDocument();
    expect(screen.getByText(/- \[x\] Plan MVP/)).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("dialog", { name: "Markdown preview" }), { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Markdown preview" })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Export options" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Close export options" }));
  });

  it("previews JSON scoped to the currently open project with its complete task data", async () => {
    window.history.replaceState({}, "", "/?project=project-1");
    const projectTask = task({
      id: "project-task",
      title: "Project task",
      description: "Detailed project note",
      projectId: "project-1",
      sectionId: "section-1",
      dueDate: "2026-12-04",
      labels: Object.freeze(["planning"]),
      comments: Object.freeze([Object.freeze({ id: "project-comment", body: "Project comment", createdAt: "2026-10-22T10:00:00.000Z" })])
    });
    const api = Object.freeze({
      ...baseApi(Object.freeze([task({ id: "inbox-task", title: "Inbox only" }), projectTask])),
      listProjects: async () => Object.freeze([project({ id: "project-1", title: "Roadmap", description: "Roadmap details" })]),
      listSections: async () => Object.freeze([section({ id: "section-1", title: "Milestone", projectId: "project-1" })])
    });
    renderApp(api);

    await screen.findByText("Project task");
    await userEvent.click(screen.getByRole("button", { name: /^Export$/ }));
    expect(await screen.findByRole("dialog", { name: "Export options" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Preview JSON" }));
    const jsonDialog = await screen.findByRole("dialog", { name: "JSON preview" });
    const jsonText = jsonDialog.querySelector("pre")?.textContent;
    if (jsonText === null || jsonText === undefined) throw new Error("Missing scoped JSON preview");
    const exported = JSON.parse(jsonText) as { scope: { type: string; title: string }; project: { description: string; sections: ReadonlyArray<{ title: string }>; tasks: ReadonlyArray<{ description: string; dueDate: string; labels: ReadonlyArray<string>; comments: ReadonlyArray<{ body: string }> }> }; inbox: unknown; comments: ReadonlyArray<{ body: string }>; dates: ReadonlyArray<{ dueDate: string }> };
    expect(exported.scope).toEqual({ type: "project", id: "project-1", title: "Roadmap" });
    expect(exported.inbox).toBeNull();
    expect(exported.project).toMatchObject({ description: "Roadmap details", sections: [expect.objectContaining({ title: "Milestone" })], tasks: [expect.objectContaining({ description: "Detailed project note", dueDate: "2026-12-04", labels: ["planning"], comments: [expect.objectContaining({ body: "Project comment" })] })] });
    expect(exported.comments).toEqual([expect.objectContaining({ body: "Project comment" })]);
    expect(exported.dates).toEqual([expect.objectContaining({ dueDate: "2026-12-04" })]);
    expect(jsonText).not.toContain("Inbox only");
    fireEvent.keyDown(jsonDialog, { key: "Escape" });
    expect(screen.getByRole("dialog", { name: "Export options" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Preview advanced markdown" }));
    const advancedMarkdown = screen.getByRole("dialog", { name: "Advanced markdown preview" }).querySelector("pre")?.textContent ?? "";
    expect(advancedMarkdown).toContain("**Description:** Roadmap details");
    expect(advancedMarkdown).toContain("**Description:** Detailed project note");
    expect(advancedMarkdown).toContain("**Due date:** 2026-12-04");
    expect(advancedMarkdown).toContain("**Labels:** `planning`");
    expect(advancedMarkdown).toContain("Project comment");
  });

  it("exports a complete JSON document and previews all Markdown on the Export page", async () => {
    window.history.replaceState({}, "", "/export");
    const inboxTask = task({
      id: "inbox-task",
      title: "All tasks note",
      description: "Task description",
      dueDate: "2026-11-18",
      labels: Object.freeze(["important"]),
      comments: Object.freeze([Object.freeze({ id: "comment-1", body: "Task comment", createdAt: "2026-10-22T10:00:00.000Z" })])
    });
    const api = Object.freeze({
      ...baseApi(Object.freeze([inboxTask])),
      getInboxDescription: async () => "Inbox description",
      listProjects: async () => Object.freeze([project({ id: "project-1", title: "Roadmap", description: "Project description" })]),
      listSections: async () => Object.freeze([section({ id: "section-1", title: "Later", projectId: "project-1" })])
    });
    renderApp(api);

    expect(await screen.findByRole("heading", { name: "Export" })).toBeInTheDocument();
    const navigation = within(screen.getByLabelText("Navigation"));
    expect(navigation.queryByRole("button", { name: "Export all ZIP" })).not.toBeInTheDocument();
    expect(navigation.queryByRole("button", { name: "Export all markdown" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Preview all markdown" }));
    expect(await screen.findByRole("dialog", { name: "Markdown preview" })).toBeInTheDocument();
    expect(screen.getByText(/- \[ \] All tasks note/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    await userEvent.click(screen.getByRole("button", { name: "Preview all advanced markdown" }));
    const advancedDialog = await screen.findByRole("dialog", { name: "Advanced markdown preview" });
    const advancedText = advancedDialog.querySelector("pre")?.textContent ?? "";
    expect(advancedText).toContain("**Description:** Inbox description");
    expect(advancedText).toContain("**Description:** Task description");
    expect(advancedText).toContain("**Due date:** 2026-11-18");
    expect(advancedText).toContain("**Labels:** `important`");
    expect(advancedText).toContain("Task comment");
    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    await userEvent.click(screen.getByRole("button", { name: "Preview all JSON" }));
    const jsonDialog = await screen.findByRole("dialog", { name: "JSON preview" });
    const jsonText = jsonDialog.querySelector("pre")?.textContent;
    if (jsonText === null || jsonText === undefined) throw new Error("Missing JSON preview content");
    const exported = JSON.parse(jsonText) as { inbox: { description: string; tasks: ReadonlyArray<{ description: string; dueDate: string; comments: ReadonlyArray<{ body: string }> }> }; projects: ReadonlyArray<{ description: string; sections: ReadonlyArray<{ title: string }> }>; sections: ReadonlyArray<{ title: string }>; dates: ReadonlyArray<{ dueDate: string }>; comments: ReadonlyArray<{ body: string }> };
    expect(exported.inbox.description).toBe("Inbox description");
    expect(exported.inbox.tasks[0]).toMatchObject({ description: "Task description", dueDate: "2026-11-18", comments: [expect.objectContaining({ body: "Task comment" })] });
    expect(exported.projects[0]).toMatchObject({ description: "Project description", sections: [expect.objectContaining({ title: "Later" })] });
    expect(exported.sections).toEqual([expect.objectContaining({ title: "Later" })]);
    expect(exported.dates).toEqual([expect.objectContaining({ dueDate: "2026-11-18" })]);
    expect(exported.comments).toEqual([expect.objectContaining({ body: "Task comment" })]);
  });
});

describe("ToolsPage", () => {
  it("runs database tool actions", async () => {
    const clearTable = vi.fn(async () => Object.freeze({ cleared: true }));
    const runQuery = vi.fn(async () => Object.freeze({ rows: Object.freeze([{ id: "1" }]) }));
    const api: ToolsApi = Object.freeze({
      listTables: async () => Object.freeze(["tasks"]),
      listRecords: async (table, limit) => Object.freeze({ table, limit, rows: [Object.freeze({ id: 1 })] }),
      clearTable,
      dropAllTables: async () => Object.freeze({ dropped: true }),
      migrate: async () => Object.freeze({ migrated: true }),
      clearAllTables: async () => Object.freeze({ cleared: true }),
      seed: async () => Object.freeze({ seeded: true }),
      runQuery
    });

    render(
      <QueryClientProvider client={createQueryClient()}>
        <BrowserRouter><ToolsPage api={api} /></BrowserRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText("Database Tools")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "View records" }));
    await waitFor(() => expect(screen.getByText(/"limit": "10"/)).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Clear selected table" }));

    await waitFor(() => expect(clearTable).toHaveBeenCalledWith("tasks"));

    await userEvent.clear(screen.getByLabelText("PostgreSQL query"));
    await userEvent.type(screen.getByLabelText("PostgreSQL query"), "SELECT 1;");
    await userEvent.click(screen.getByRole("button", { name: "Run query" }));

    await waitFor(() => expect(runQuery).toHaveBeenCalledWith("SELECT 1;"));
  });

});

describe("Dates and Labels task views", () => {
  afterEach(() => window.history.replaceState({}, "", "/"));

  it("shows dated tasks and their labels with links into the label filter", async () => {
    window.history.replaceState({}, "", "/dates");
    const today = new Date();
    const isoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const overdueDate = isoDate(yesterday);
    const todayDate = isoDate(today);
    const upcomingDate = isoDate(tomorrow);
    const datedParent = task({ id: "dated", title: "Dated note", dueDate: overdueDate, labels: Object.freeze(["work"]), children: Object.freeze([task({ id: "undated-child", title: "Undated child", parentId: "dated" })]) });
    renderApp(baseApi(Object.freeze([
      datedParent,
      task({ id: "today-task", title: "Today task", dueDate: todayDate }),
      task({ id: "upcoming-task", title: "Upcoming task", dueDate: upcomingDate }),
      task({ id: "plain", title: "No date" })
    ])));

    expect(await screen.findByRole("button", { name: "Dated note" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Undated child" })).toBeInTheDocument();
    expect(screen.queryByText("No date")).not.toBeInTheDocument();
    const overdueTime = document.querySelector(`time[datetime="${overdueDate}"]`);
    const todayTime = document.querySelector(`time[datetime="${todayDate}"]`);
    const upcomingTime = document.querySelector(`time[datetime="${upcomingDate}"]`);
    expect(overdueTime).toHaveClass("task-due-date-overdue");
    expect(overdueTime).toHaveTextContent(overdueDate);
    expect(overdueTime?.querySelector("svg")).not.toBeNull();
    expect(todayTime).toHaveClass("task-due-date-upcoming");
    expect(todayTime).toHaveTextContent("today");
    expect(upcomingTime).toHaveClass("task-due-date-upcoming");
    expect(upcomingTime).toHaveTextContent(upcomingDate);
    expect(screen.getByRole("link", { name: "work" })).toHaveAttribute("href", "/labels?label=work");
  });

  it("filters the Dates list by overdue, today, and upcoming dates", async () => {
    window.history.replaceState({}, "", "/dates");
    const today = new Date();
    const isoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    let storedTasks: ReadonlyArray<TaskNode> = Object.freeze([]);
    let nextTaskId = 0;
    const api = Object.freeze({
      ...baseApi(Object.freeze([])),
      listTasks: async () => storedTasks,
      createTask: async (title: string, projectId: string | null, sectionId: string | null, parentId: string | null) => {
        const created = task({ id: `date-filter-${nextTaskId++}`, title, projectId, sectionId, parentId });
        storedTasks = Object.freeze([...storedTasks, created]);
        return created;
      },
      updateTask: async (id: string, patch: Partial<Task>) => {
        const current = storedTasks.find((item) => item.id === id);
        if (current === undefined) throw new Error(`Unknown task ${id}`);
        const updated = task({ ...current, ...patch });
        storedTasks = Object.freeze(storedTasks.map((item) => item.id === id ? updated : item));
        return updated;
      }
    });
    renderApp(api);

    const createTaskInApp = async (title: string, dueDate: string | null) => {
      await userEvent.click(screen.getByRole("button", { name: "Add task Q" }));
      const addDialog = screen.getByRole("dialog", { name: "Add task" });
      await userEvent.type(within(addDialog).getByLabelText("New task title"), title);
      if (dueDate !== null) {
        await userEvent.click(within(addDialog).getByRole("button", { name: /Add date/ }));
        const dateDialog = screen.getByRole("dialog", { name: "Add date" });
        await userEvent.type(within(dateDialog).getByLabelText("New task date"), dueDate);
        await userEvent.click(within(dateDialog).getByRole("button", { name: "Set date" }));
      }
      await userEvent.click(within(addDialog).getByRole("button", { name: /^Add task$/ }));
    };

    await createTaskInApp("Overdue task", isoDate(yesterday));
    await createTaskInApp("Today task", isoDate(today));
    await createTaskInApp("Upcoming task", isoDate(tomorrow));
    await createTaskInApp("Undated task", null);

    const datesTasks = screen.getByRole("region", { name: "Dates tasks" });
    const taskButton = (title: string) => within(datesTasks).getByRole("button", { name: new RegExp(`^${title}$`) });
    const expectVisibleTasks = (...titles: ReadonlyArray<string>) => titles.forEach((title) => expect(taskButton(title)).toBeInTheDocument());
    const expectHiddenTasks = (...titles: ReadonlyArray<string>) => titles.forEach((title) => expect(within(datesTasks).queryByRole("button", { name: new RegExp(`^${title}$`) })).not.toBeInTheDocument());

    expect(storedTasks.map((item) => [item.title, item.dueDate])).toEqual([
      ["Overdue task", isoDate(yesterday)],
      ["Today task", isoDate(today)],
      ["Upcoming task", isoDate(tomorrow)],
      ["Undated task", null]
    ]);
    expectVisibleTasks("Overdue task", "Today task", "Upcoming task");
    expectHiddenTasks("Undated task");

    await userEvent.click(within(datesTasks).getByRole("button", { name: /^Overdue$/ }));
    expectVisibleTasks("Overdue task");
    expectHiddenTasks("Today task", "Upcoming task", "Undated task");

    await userEvent.click(within(datesTasks).getByRole("button", { name: /^Today$/ }));
    expectVisibleTasks("Today task");
    expectHiddenTasks("Overdue task", "Upcoming task", "Undated task");

    await userEvent.click(within(datesTasks).getByRole("button", { name: /^Upcoming$/ }));
    expectVisibleTasks("Upcoming task");
    expectHiddenTasks("Overdue task", "Today task", "Undated task");

    await userEvent.click(within(datesTasks).getByRole("button", { name: /^All$/ }));
    expectVisibleTasks("Overdue task", "Today task", "Upcoming task");
    expectHiddenTasks("Undated task");

    await userEvent.click(within(datesTasks).getByRole("button", { name: "Calendar" }));
    expect(screen.queryByRole("navigation", { name: "Filter dated tasks" })).not.toBeInTheDocument();
  });

  it("renders a complete navigable month calendar with a visible today marker", async () => {
    window.history.replaceState({}, "", "/dates");
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const currentMonth = today.slice(0, 7);
    renderApp(baseApi(Object.freeze([task({ id: "today-task", title: "Scheduled today", dueDate: today })])));

    await userEvent.click(await screen.findByRole("button", { name: "Calendar" }));
    fireEvent.change(screen.getByLabelText("Calendar month"), { target: { value: currentMonth } });

    expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    expect(screen.getAllByRole("gridcell")).toHaveLength(42);
    const todayCell = screen.getByLabelText(`Tasks for ${today}`);
    expect(todayCell).toHaveClass("today");
    expect(within(todayCell).getByRole("button", { name: "Scheduled today" })).toBeInTheDocument();
    expect(within(todayCell).getByText("Inbox")).toBeInTheDocument();

    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const expectedNextMonth = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}`;
    await userEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByLabelText("Calendar month")).toHaveValue(expectedNextMonth);
    await userEvent.click(screen.getByRole("button", { name: "Today" }));
    expect(screen.getByLabelText("Calendar month")).toHaveValue(currentMonth);
  });

  it("filters tasks by selected label across the complete task list", async () => {
    window.history.replaceState({}, "", "/labels?label=work");
    const labeledParent = task({ id: "match", title: "Project task", projectId: "p1", labels: Object.freeze(["work"]), children: Object.freeze([task({ id: "other-child", title: "Other label child", parentId: "match", labels: Object.freeze(["home"]) })]) });
    renderApp(baseApi(Object.freeze([
      labeledParent,
      task({ id: "other", title: "Other label", labels: Object.freeze(["home"]) })
    ])));

    expect(await screen.findByRole("button", { name: "Project task" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Other label child" })).toBeInTheDocument();
    expect(screen.queryByText("Other label")).not.toBeInTheDocument();
  });
});

describe("SearchPalette", () => {
  it("searches task descriptions and labels, and opens matching destinations", async () => {
    renderApp(baseApi(Object.freeze([
      task({ id: "search-task", title: "Prepare launch", description: "needle phrase in notes", labels: Object.freeze(["work"]) })
    ])));

    await userEvent.click(await screen.findByRole("button", { name: /Search/ }));
    const search = screen.getByRole("textbox", { name: "Search or type a command" });
    await userEvent.type(search, "needle");
    await userEvent.click(await screen.findByRole("button", { name: "Prepare launch" }));
    expect(await screen.findByRole("dialog", { name: "Task details: Prepare launch" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Close task details" }));

    fireEvent.keyDown(document.body, { key: "л", code: "KeyK", ctrlKey: true, bubbles: true });
    await userEvent.type(screen.getByRole("textbox", { name: "Search or type a command" }), "work");
    expect(await screen.findByRole("link", { name: /^work$/ })).toHaveAttribute("href", "/labels?label=work");
  });
});

describe("SettingsPage", () => {
  it("saves the current user's deletion preference", async () => {
    const updateSettings = vi.fn(async (settings: Parameters<ApplicationApi["updateSettings"]>[0]) =>
      Object.freeze({ confirmDelete: settings.confirmDelete, accessMode: "password" as const, username: "admin" })
    );
    const api = Object.freeze({ ...baseApi(Object.freeze([])), updateSettings });

    render(
      <QueryClientProvider client={createQueryClient()}>
        <BrowserRouter><SettingsPage api={api} /></BrowserRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(await screen.findByRole("checkbox", { name: /Ask for confirmation/ })).toBeChecked();
    await userEvent.click(screen.getByRole("checkbox", { name: /Ask for confirmation/ }));
    await userEvent.click(screen.getByRole("button", { name: "Save settings" }));

    await waitFor(() => expect(updateSettings).toHaveBeenCalled());
    expect(updateSettings.mock.calls[0]?.[0]).toEqual({ confirmDelete: false });
  });

  it("lets a signed-in user update their own account without user administration", async () => {
    const updateOwnAccount = vi.fn(async (account: Parameters<ApplicationApi["updateOwnAccount"]>[0]) => Object.freeze({ id: "admin", username: account.username, isAdmin: true }));
    const api = Object.freeze({ ...baseApi(Object.freeze([])), updateOwnAccount });
    render(<QueryClientProvider client={createQueryClient()}><BrowserRouter><SettingsPage api={api} /></BrowserRouter></QueryClientProvider>);

    expect(await screen.findByRole("heading", { name: "Your account" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Users" })).not.toBeInTheDocument();
    await userEvent.clear(screen.getByRole("textbox", { name: "Username" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Username" }), "NewAdmin");
    await userEvent.type(screen.getByLabelText("New password"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Save account" }));

    await waitFor(() => expect(updateOwnAccount.mock.calls[0]?.[0]).toEqual({ username: "newadmin", password: "x" }));
  });

  it("lets administrators create a user on the user management page", async () => {
    const createUser = vi.fn(async (user: Parameters<ApplicationApi["createUser"]>[0]) => Object.freeze({ id: "created", username: user.username, isAdmin: user.isAdmin }));
    const api = Object.freeze({ ...baseApi(Object.freeze([])), createUser });
    render(<QueryClientProvider client={createQueryClient()}><BrowserRouter><AdminUsersPage api={api} /></BrowserRouter></QueryClientProvider>);

    const usernames = await screen.findAllByLabelText("Username");
    await userEvent.type(usernames[0]!, "sam");
    await userEvent.type(screen.getByLabelText("Password"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Create user" }));

    await waitFor(() => expect(createUser.mock.calls[0]?.[0]).toEqual({ username: "sam", password: "x", isAdmin: false }));
  });
});

describe("createTaskApi", () => {
  it("moves tasks with the backend PUT contract", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ task: task({ id: "task-1", title: "Moved" }) }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    vi.stubGlobal("fetch", fetchMock);

    await createTaskApi("http://api.test").moveTask("task-1", "project-1", null, "parent-1", "before-1", "after-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/tasks/task-1/move",
      expect.objectContaining({
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentId: "parent-1",
          projectId: "project-1",
          sectionId: null,
          beforeId: "before-1",
          afterId: "after-1"
        })
      })
    );
  });

  it("updates projects and task patches with JSON requests", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      new Response(
        JSON.stringify(
          url.includes("/projects/")
            ? { project: project({ id: "project-1", title: "Launch" }) }
            : { task: task({ id: "task-1", title: "Renamed" }) }
        ),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      )
    );

    vi.stubGlobal("fetch", fetchMock);

    await createTaskApi("http://api.test").updateProject("project-1", Object.freeze({ title: "Launch" }));
    await createTaskApi("http://api.test").updateTask("task-1", Object.freeze({ title: "Renamed" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/projects/project-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ title: "Launch" })
      })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/tasks/task-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ title: "Renamed" })
      })
    );
  });
});
