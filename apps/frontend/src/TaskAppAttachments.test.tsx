import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Task } from "@todoist-clone/domain";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { baseApi, renderApp, savedComments, task } from "./AppTestSupport";
import type { ApplicationApi } from "./api";

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
  // При выключенных вложениях сведения о них скрыты в подробностях задачи.
  it("hides stored attachments in task details when attachments are disabled", async () => {
    const attachmentComment = {
      id: "comment-attachment",
      body: "File",
      createdAt: "2026-01-01T00:00:00.000Z",
      attachments: [{ id: "attachment-1", name: "photo.png", mimeType: "image/png", size: 5 }],
    };
    renderApp(baseApi([task({ id: "task-1", title: "Plan MVP", comments: [attachmentComment] })]));
    expect(
      within(screen.getByRole("complementary", { name: "Navigation" })).queryByRole("link", {
        name: "Attachments",
      }),
    ).not.toBeInTheDocument();
    await userEvent.click(await screen.findByRole("button", { name: "Plan MVP" }));
    const dialog = screen.getByRole("dialog", { name: "Task details: Plan MVP" });
    expect(within(dialog).queryByRole("img", { name: "photo.png" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("link", { name: /photo.png/ })).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Attach files to comment")).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: "Remove attachment photo.png" }),
    ).not.toBeInTheDocument();
  });

  // Комментарий, состоящий только из файла, не создаёт пустой Markdown-блок.
  it("does not render an empty Markdown block for an attachment-only comment", async () => {
    const attachmentComment = {
      id: "comment-attachment",
      body: "",
      createdAt: "2026-01-01T00:00:00.000Z",
      attachments: [{ id: "attachment-1", name: "photo.png", mimeType: "image/png", size: 5 }],
    };
    renderApp(baseApi([task({ id: "task-1", title: "Plan MVP", comments: [attachmentComment] })]), true);
    await userEvent.click(await screen.findByRole("button", { name: "Plan MVP" }));
    const dialog = screen.getByRole("dialog", { name: "Task details: Plan MVP" });
    expect(dialog.querySelector(".comment-markdown")).not.toBeInTheDocument();
    expect(dialog.querySelector(".comment-attachment a[download]")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Edit" }));
    expect(within(dialog).getByRole("textbox", { name: "Edit comment comment-attachment" })).toHaveFocus();
    expect(within(dialog).getByRole("img", { name: "photo.png" })).toBeVisible();
    expect(dialog.querySelector(".comment-attachment a[download]")).toBeVisible();
  });

  // В строке задачи отображается значок, если у комментариев есть файлы.
  it("shows a paperclip on tasks that have attachments", async () => {
    const attachmentComment = {
      id: "comment-attachment",
      body: "File",
      createdAt: "2026-01-01T00:00:00.000Z",
      attachments: [{ id: "attachment-1", name: "photo.png", mimeType: "image/png", size: 5 }],
    };
    renderApp(baseApi([task({ id: "task-1", title: "Plan MVP", comments: [attachmentComment] })]), true);
    expect(await screen.findByLabelText("Task has attachments")).toBeVisible();
  });

  // Библиотека показывает предпросмотр файла, задачу, размер и дату загрузки.
  it("lists attachments with previews, task links, size, and upload date", async () => {
    window.history.replaceState({}, "", "/attachments");
    const attachmentComment = {
      id: "comment-attachment",
      body: "",
      createdAt: "2026-01-01T00:00:00.000Z",
      attachments: [{ id: "attachment-1", name: "photo.png", mimeType: "image/png", size: 5 }],
    };
    const api = {
      ...baseApi([task({ id: "task-1", title: "Plan MVP", comments: [attachmentComment] })]),
      getAuthStatus: async () => ({
        accessMode: "password" as const,
        authenticated: true,
        user: { id: "admin", username: "admin", isAdmin: true },
        attachmentsEnabled: true,
      }),
    };
    renderApp(api, true);
    expect(await screen.findByRole("heading", { name: "Attachments" })).toBeVisible();
    expect(await screen.findByRole("img", { name: "photo.png" })).toBeVisible();
    expect(
      document.querySelector('.attachment-library-file-link[href="/attachments/attachment-1"]'),
    ).toBeInTheDocument();
    const taskLink = screen.getByRole("link", { name: "Plan MVP" });
    expect(taskLink).toHaveAttribute("href", "/attachments");
    expect(screen.getByText("5 B")).toBeInTheDocument();
    expect(screen.getByText(new Date("2026-01-01T00:00:00.000Z").toLocaleString())).toBeInTheDocument();
    expect(
      within(screen.getByRole("complementary", { name: "Navigation" })).getByRole("link", {
        name: "Attachments",
      }),
    ).toBeVisible();
    await userEvent.click(taskLink);
    expect(await screen.findByRole("dialog", { name: "Task details: Plan MVP" })).toBeVisible();
    expect(window.location.pathname).toBe("/attachments");
    await userEvent.click(screen.getByRole("button", { name: "Close task details" }));
    expect(await screen.findByRole("heading", { name: "Attachments" })).toBeVisible();
    expect(window.location.pathname).toBe("/attachments");
  });

  // Удаление последнего файла также удаляет комментарий без текста.
  it("removes individual attachments and deletes an empty attachment-only comment", async () => {
    const comments = [
      {
        id: "comment-only",
        body: "",
        createdAt: "2026-01-01T00:00:00.000Z",
        attachments: [{ id: "attachment-only", name: "only.png", mimeType: "image/png", size: 5 }],
      },
      {
        id: "comment-text",
        body: "Keep this note",
        createdAt: "2026-01-02T00:00:00.000Z",
        attachments: [{ id: "attachment-text", name: "note.png", mimeType: "image/png", size: 6 }],
      },
    ];
    const updateTask = vi.fn(
      async (id: string, patch: Parameters<ApplicationApi["updateTask"]>[1]): Promise<Task> =>
        task({ id, title: "Plan MVP", comments: savedComments(patch.comments) }),
    );
    renderApp(
      {
        ...baseApi([task({ id: "task-1", title: "Plan MVP", comments })]),
        updateTask,
      },
      true,
    );
    await userEvent.click(await screen.findByRole("button", { name: "Plan MVP" }));
    const dialog = screen.getByRole("dialog", { name: "Task details: Plan MVP" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Remove attachment only.png" }));
    await waitFor(() => expect(updateTask).toHaveBeenLastCalledWith("task-1", { comments: [comments[1]] }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Remove attachment note.png" }));
    await waitFor(() =>
      expect(updateTask).toHaveBeenLastCalledWith("task-1", {
        comments: [expect.objectContaining({ id: "comment-text", body: "Keep this note", attachments: [] })],
      }),
    );
  });

  // Файл можно отправить отдельным комментарием без текстового содержимого.
  it("allows submitting an attachment without comment text", async () => {
    const createComment = vi.fn(async () => undefined);
    renderApp(
      {
        ...baseApi([task({ id: "task-1", title: "Plan MVP" })]),
        createComment,
      },
      true,
    );
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

  // Вставленное изображение сразу сохраняется как комментарий существующей задачи.
  it("immediately saves a pasted clipboard image as a comment on an existing task", async () => {
    const createComment = vi.fn(async () => undefined);
    renderApp(
      {
        ...baseApi([task({ id: "task-1", title: "Plan MVP" })]),
        createComment,
      },
      true,
    );
    await userEvent.click(await screen.findByRole("button", { name: "Plan MVP" }));
    const dialog = screen.getByRole("dialog", { name: "Task details: Plan MVP" });
    const image = new File(["png data"], "pasted.png", { type: "image/png" });
    fireEvent.paste(document.body, {
      clipboardData: { items: [{ kind: "file", getAsFile: () => image }], files: [] },
    });
    await waitFor(() => expect(createComment).toHaveBeenCalledWith("task-1", "", [image]));
    expect(within(dialog).queryByText("pasted.png")).not.toBeInTheDocument();
    expect(await screen.findByText("Файл «pasted.png» прикреплён")).toBeVisible();
    expect(createComment).toHaveBeenCalledTimes(1);
  });

  // Диалог новой задачи принимает вставленное изображение, не создавая пустой комментарий.
  it("pastes clipboard images into the task creation dialog without an initial comment field", async () => {
    const createComment = vi.fn(async () => undefined);
    renderApp({ ...baseApi([]), createComment }, true);
    await userEvent.click(await screen.findByRole("button", { name: "Add task Q" }));
    const dialog = screen.getByRole("dialog", { name: "Add task" });
    expect(within(dialog).queryByLabelText("Initial task comment")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Initial comment")).not.toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText("New task title"), "Task with pasted image");
    const image = new File(["png data"], "pasted.png", { type: "image/png" });
    fireEvent.paste(within(dialog).getByLabelText("New task title"), {
      clipboardData: { items: [{ kind: "file", getAsFile: () => image }], files: [] },
    });
    expect(within(dialog).getByText("pasted.png")).toBeInTheDocument();
    expect(await screen.findByText("Файл «pasted.png» прикреплён")).toBeVisible();
    await userEvent.click(within(dialog).getByRole("button", { name: "Add task" }));
    await waitFor(() => expect(createComment).toHaveBeenCalledWith("created", "", [image]));
  });

  // Мобильные сокращения раскрывают необязательные поля новой задачи и фокусируют ввод.
  it("reveals optional Add task fields from mobile shortcuts and focuses their inputs", async () => {
    renderApp(baseApi([]));
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

  // Мобильное действие подзадач показывает и фокусирует её редактор.
  it("reveals and focuses the subtask editor from the Subtasks shortcut", async () => {
    renderApp(baseApi([task({ id: "task-1", title: "Plan release" })]));
    await userEvent.click(await screen.findByRole("button", { name: "Plan release" }));
    const dialog = screen.getByRole("dialog", { name: "Task details: Plan release" });
    const shortcutButtons = within(
      dialog.querySelector(".task-details-mobile-shortcuts") as HTMLElement,
    ).getAllByRole("button");
    expect(shortcutButtons.slice(0, 3).map((button) => button.textContent?.trim())).toEqual([
      "Labels",
      "Date",
      "Subtasks",
    ]);
    expect(shortcutButtons.slice(0, 3).every((button) => button.querySelector("svg") !== null)).toBe(true);
    expect(dialog.querySelector(".task-subtasks-card")).toHaveClass("task-subtasks-hidden");
    await userEvent.click(within(dialog).getByRole("button", { name: "Subtasks" }));
    expect(within(dialog).getByLabelText("New subtask title")).toHaveFocus();
    expect(dialog.querySelector(".task-subtasks-card")).toHaveClass("task-subtasks-open");
    expect(within(dialog).queryByRole("button", { name: "Subtasks" })).not.toBeInTheDocument();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Delete all subtasks and hide section" }),
    );
    expect(within(dialog).getByRole("button", { name: "Subtasks" })).toBeInTheDocument();
  });

  // Закрытие мобильного раздела подзадач удаляет уже сохранённые подзадачи.
  it("deletes existing subtasks when their mobile section is closed", async () => {
    let childDeleted = false;
    const child = task({ id: "child-1", title: "Write tests", parentId: "task-1" });
    const parentWithChild = task({ id: "task-1", title: "Plan release", children: [child] });
    const parentWithoutChild = task({ id: "task-1", title: "Plan release" });
    const deleteTask = vi.fn(async () => {
      childDeleted = true;
    });
    const api = {
      ...baseApi([parentWithChild]),
      listTasks: async () => [childDeleted ? parentWithoutChild : parentWithChild],
      deleteTask,
    };
    renderApp(api);
    await userEvent.click(await screen.findByRole("button", { name: "Plan release" }));
    const dialog = screen.getByRole("dialog", { name: "Task details: Plan release" });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Delete all subtasks and hide section" }),
    );
    await waitFor(() => expect(deleteTask).toHaveBeenCalledWith("child-1"));
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Subtasks" })).toBeInTheDocument());
  });

  // Поле метки получает фокус после раскрытия редактора.
  it("focuses the label input when Add labels reveals the editor", async () => {
    renderApp(baseApi([task({ id: "task-1", title: "Plan release" })]));
    await userEvent.click(await screen.findByRole("button", { name: "Plan release" }));
    const dialog = screen.getByRole("dialog", { name: "Task details: Plan release" });
    await userEvent.click(
      within(dialog.querySelector(".task-details-mobile-shortcuts") as HTMLElement).getByRole("button", {
        name: "Labels",
      }),
    );
    expect(within(dialog).getByLabelText("Labels")).toHaveFocus();
  });

  // Поле комментария получает фокус после раскрытия раздела обсуждения.
  it("focuses the comment input when Add comments reveals the editor", async () => {
    renderApp(baseApi([task({ id: "task-1", title: "Plan release" })]));
    await userEvent.click(await screen.findByRole("button", { name: "Plan release" }));
    const dialog = screen.getByRole("dialog", { name: "Task details: Plan release" });
    await userEvent.click(
      within(dialog.querySelector(".task-details-mobile-shortcuts") as HTMLElement).getByRole("button", {
        name: "Comments",
      }),
    );
    expect(within(dialog).getByLabelText("Add comment")).toHaveFocus();
  });

  // Закрытие мобильных разделов применяет удаление меток, комментариев и срока.
  it("removes labels, comments, and date when their mobile sections are closed", async () => {
    const updateTask = vi.fn(
      async (id: string, patch: Parameters<ApplicationApi["updateTask"]>[1]): Promise<Task> =>
        task({
          id,
          title: "Plan release",
          labels: patch.labels ?? ["work"],
          comments:
            patch.comments === undefined
              ? [{ id: "comment-1", body: "Note", createdAt: "2026-01-01T00:00:00.000Z" }]
              : savedComments(patch.comments),
          dueDate: patch.dueDate === null ? null : "2026-01-03",
        }),
    );
    renderApp({
      ...baseApi([
        task({
          id: "task-1",
          title: "Plan release",
          labels: ["work"],
          comments: [{ id: "comment-1", body: "Note", createdAt: "2026-01-01T00:00:00.000Z" }],
          dueDate: "2026-01-03",
        }),
      ]),
      updateTask,
    });
    await userEvent.click(await screen.findByRole("button", { name: "Plan release" }));
    const dialog = screen.getByRole("dialog", { name: "Task details: Plan release" });

    await userEvent.click(within(dialog).getByRole("button", { name: "Remove all labels and hide section" }));
    await waitFor(() => expect(updateTask).toHaveBeenCalledWith("task-1", { labels: [] }));
    await waitFor(() =>
      expect(
        within(dialog.querySelector(".task-details-mobile-shortcuts") as HTMLElement).getByRole("button", {
          name: "Labels",
        }),
      ).toBeInTheDocument(),
    );

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Remove all comments and hide section" }),
    );
    await waitFor(() => expect(updateTask).toHaveBeenCalledWith("task-1", { comments: [] }));
    await waitFor(() =>
      expect(
        within(dialog.querySelector(".task-details-mobile-shortcuts") as HTMLElement).getByRole("button", {
          name: "Comments",
        }),
      ).toBeInTheDocument(),
    );

    await userEvent.click(within(dialog).getByRole("button", { name: "Remove date and hide section" }));
    await waitFor(() => expect(updateTask).toHaveBeenCalledWith("task-1", { dueDate: null }));
    await waitFor(() =>
      expect(
        within(dialog.querySelector(".task-details-mobile-shortcuts") as HTMLElement).getByRole("button", {
          name: "Date",
        }),
      ).toBeInTheDocument(),
    );
  });
});
