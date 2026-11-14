import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Project, Task } from "@todoist-clone/domain";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { baseApi, project, renderApp, savedComments, section, task, taskRow } from "./AppTestSupport";
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
  // Удаление сохранённых данных из мобильных блоков требует подтверждения пользователя.
  it("asks before removing saved labels, comments, and subtasks from mobile sections", async () => {
    const updateTask = vi.fn(
      async (id: string, patch: Parameters<ApplicationApi["updateTask"]>[1]): Promise<Task> => {
        const { comments, ...fields } = patch;
        return task({
          id,
          title: "Plan release",
          ...fields,
          ...(comments === undefined ? {} : { comments: savedComments(comments) }),
        });
      },
    );
    const deleteTask = vi.fn(async () => undefined);
    const child = task({ id: "child-1", title: "Write tests", parentId: "task-1" });
    const savedTask = task({
      id: "task-1",
      title: "Plan release",
      labels: ["work"],
      comments: [{ id: "comment-1", body: "Saved note", createdAt: "2026-01-01T00:00:00.000Z" }],
      children: [child],
    });
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderApp({ ...baseApi([savedTask]), updateTask, deleteTask });
    await userEvent.click(await screen.findByRole("button", { name: "Plan release" }));
    const dialog = screen.getByRole("dialog", { name: "Task details: Plan release" });

    await userEvent.click(within(dialog).getByRole("button", { name: "Remove all labels and hide section" }));
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Remove all comments and hide section" }),
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Delete all subtasks and hide section" }),
    );

    expect(window.confirm).toHaveBeenCalledTimes(3);
    expect(window.confirm).toHaveBeenNthCalledWith(1, "Remove all saved labels from this task?");
    expect(window.confirm).toHaveBeenNthCalledWith(2, "Remove all saved comments from this task?");
    expect(window.confirm).toHaveBeenNthCalledWith(3, "Delete all saved subtasks and their descendants?");
    expect(updateTask).not.toHaveBeenCalled();
    expect(deleteTask).not.toHaveBeenCalled();
  });

  // Навигация по маршрутам закрывает открытую мобильную панель.
  it("closes the mobile sidebar after each route selection", async () => {
    const user = userEvent.setup();
    renderApp(baseApi([]));
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

  // Основной экран отображает список задач.
  it("renders a task list", async () => {
    renderApp(baseApi([task({ id: "1", title: "Plan MVP" })]));

    expect(await screen.findByText("Plan MVP")).toBeInTheDocument();
  });

  // В строке задачи показываются описание и число комментариев.
  it("shows a task description and comment count in the task list", async () => {
    const description = "A detailed description that is available directly from the task list.";
    renderApp(
      baseApi([
        task({
          id: "task-with-details",
          title: "Plan release",
          description,
          comments: [
            { id: "comment-1", body: "First", createdAt: "2026-01-01T00:00:00.000Z" },
            { id: "comment-2", body: "Second", createdAt: "2026-01-02T00:00:00.000Z" },
          ],
        }),
      ]),
    );

    const title = await screen.findByRole("button", { name: "Plan release" });
    const row = title.closest<HTMLElement>(".task-row");
    if (row === null) throw new Error("Unable to find task row");
    expect(within(row).getByText(description)).toHaveClass("task-description-preview");
    expect(within(row).getByLabelText("2 comments")).toHaveTextContent("2");
  });

  // Подсказки меток можно добавить, а выбранные метки удалить.
  it("adds suggested labels and removes label chips in task details", async () => {
    const updateTask = vi.fn(
      async (id: string, patch: Parameters<ApplicationApi["updateTask"]>[1]): Promise<Task> =>
        task({ id, title: "Plan release", labels: patch.labels ?? [] }),
    );
    renderApp({
      ...baseApi([
        task({ id: "task-1", title: "Plan release", labels: ["work"] }),
        task({ id: "task-2", title: "Review notes", labels: ["review"] }),
      ]),
      updateTask,
    });

    await userEvent.click(await screen.findByRole("button", { name: "Plan release" }));
    const dialog = screen.getByRole("dialog", { name: "Task details: Plan release" });
    const input = within(dialog).getByLabelText("Labels");
    await userEvent.click(input);
    await userEvent.click(within(dialog).getByRole("option", { name: "review" }));
    await waitFor(() => expect(updateTask).toHaveBeenCalledWith("task-1", { labels: ["work", "review"] }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Remove label work" }));
    await waitFor(() => expect(updateTask).toHaveBeenCalledWith("task-1", { labels: ["review"] }));
  });

  // Проверяем клавиатурное сохранение/отмену редактирования, срок и метки.
  it("edits text on demand with Save, Cancel, Enter and Escape, and edits dates and labels", async () => {
    const updateTask = vi.fn(
      async (id: string, patch: Parameters<ApplicationApi["updateTask"]>[1]): Promise<Task> =>
        task({
          id,
          title: patch.title ?? "Plan MVP",
          description: patch.description ?? "",
          dueDate: patch.dueDate ?? null,
          labels: patch.labels ?? [],
          comments: savedComments(patch.comments),
        }),
    );
    renderApp({ ...baseApi([task({ id: "task-1", title: "Plan MVP" })]), updateTask });
    await userEvent.click(await screen.findByRole("button", { name: "Plan MVP" }));
    const dialog = screen.getByRole("dialog", { name: "Task details: Plan MVP" });
    const editTitleButton = within(dialog).getByRole("button", { name: "Edit task title" });
    expect(editTitleButton.querySelector("svg")).not.toBeNull();
    await userEvent.click(editTitleButton);
    await userEvent.clear(within(dialog).getByRole("textbox", { name: "Edit task title" }));
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: "Edit task title" }),
      "Plan launch{Enter}",
    );
    await waitFor(() => expect(updateTask).toHaveBeenCalledWith("task-1", { title: "Plan launch" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Edit task description" }));
    const descriptionField = within(dialog).getByRole("textbox", { name: "Edit task description" });
    await userEvent.type(descriptionField, "Ship release");
    fireEvent.keyDown(descriptionField, { key: "Enter", ctrlKey: true });
    await waitFor(() => expect(updateTask).toHaveBeenCalledWith("task-1", { description: "Ship release" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Edit task description" }));
    await userEvent.clear(within(dialog).getByRole("textbox", { name: "Edit task description" }));
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: "Edit task description" }),
      "discard{Escape}",
    );
    expect(within(dialog).getByRole("button", { name: "Edit task description" })).toHaveTextContent(
      "Ship release",
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "＋ Add date" }));
    fireEvent.change(screen.getByLabelText("New date"), { target: { value: "2026-11-01" } });
    await userEvent.click(
      within(screen.getByRole("dialog", { name: "Add date" })).getByRole("button", { name: "Save date" }),
    );
    await waitFor(() => expect(updateTask).toHaveBeenCalledWith("task-1", { dueDate: "2026-11-01" }));
    expect(dialog.querySelector(".task-detail-date svg")).not.toBeNull();
    await userEvent.type(within(dialog).getByLabelText("Labels"), "work{Enter}");
    await waitFor(() => expect(updateTask).toHaveBeenCalledWith("task-1", { labels: ["work"] }));
    await userEvent.type(within(dialog).getByLabelText("Add comment"), "Looks good");
    await userEvent.click(within(dialog).getByRole("button", { name: "Add comment" }));
    await waitFor(() =>
      expect(updateTask).toHaveBeenCalledWith(
        "task-1",
        expect.objectContaining({ comments: [expect.objectContaining({ body: "Looks good" })] }),
      ),
    );
    const addedComment = updateTask.mock.calls.at(-1)?.[1].comments?.[0];
    expect(addedComment).not.toHaveProperty("id");
    expect(addedComment).not.toHaveProperty("createdAt");
    expect(within(dialog).queryByRole("button", { name: "Save task" })).not.toBeInTheDocument();
  });

  // Подробности показывают расположение и родителей, а форма меняет список задачи.
  it("shows task location and parent links, and moves tasks between Inbox and projects", async () => {
    const moveTask = vi.fn(
      async (id: string, projectId: string | null, sectionId: string | null): Promise<Task> =>
        task({ id, title: "Child task", projectId, sectionId }),
    );
    const parent = task({
      id: "parent-1",
      title: "Parent task",
      children: [task({ id: "child-1", title: "Child task", parentId: "parent-1" })],
    });
    renderApp({
      ...baseApi([parent]),
      listProjects: async () => [
        project({ id: "project-1", title: "Roadmap" }),
        project({ id: "project-2", title: "Alpha" }),
      ],
      listSections: async () => [
        section({ id: "section-1", title: "Next", projectId: "project-1" }),
        section({ id: "section-2", title: "Back", projectId: "project-1" }),
      ],
      moveTask,
    });

    await userEvent.click(await screen.findByRole("button", { name: "Child task" }));
    const dialog = screen.getByRole("dialog", { name: "Task details: Child task" });
    expect(within(dialog).getAllByRole("link", { name: "Inbox" })[0]).toHaveAttribute("href", "/");
    expect(within(dialog).getByRole("link", { name: "Parent task" })).toHaveAttribute(
      "href",
      "/?task=parent-1",
    );
    const locationPicker = within(dialog).getByLabelText("Project, section, or Inbox");
    expect(
      within(locationPicker)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Alpha", "Inbox", "Roadmap", "Roadmap / Back", "Roadmap / Next"]);
    await userEvent.selectOptions(locationPicker, "project:project-1");
    await waitFor(() =>
      expect(moveTask).toHaveBeenCalledWith("child-1", "project-1", null, null, null, null),
    );
    expect(locationPicker).toHaveValue("project:project-1");
    expect(within(dialog).getByRole("option", { name: "Roadmap / Next" })).toBeInTheDocument();
    await userEvent.selectOptions(locationPicker, "section:section-1");
    await waitFor(() =>
      expect(moveTask).toHaveBeenCalledWith("child-1", "project-1", "section-1", null, null, null),
    );
    expect(locationPicker).toHaveValue("section:section-1");
    expect(within(dialog).queryByRole("navigation", { name: "Task location" })).not.toBeInTheDocument();
  });

  // Отправка формы вызывает создание задачи с введённым названием.
  it("calls the create handler when a task is submitted", async () => {
    const createTask = vi.fn(async (title: string): Promise<Task> => task({ id: "created", title }));

    renderApp({
      ...baseApi([]),
      createTask,
    });

    await userEvent.click(screen.getByRole("button", { name: "Add task Q" }));
    await userEvent.type(screen.getByLabelText("New task title"), "Write tests");
    await userEvent.click(
      within(screen.getByRole("dialog", { name: "Add task" })).getByRole("button", { name: "Add task" }),
    );

    await waitFor(() => expect(createTask).toHaveBeenCalledWith("Write tests", null, null, null));
  });

  // Новые проекты доступны для выбора при создании последующей задачи.
  it("creates projects and sends new tasks to the selected project", async () => {
    let projects = [] as Array<Project>;
    const createTask = vi.fn(
      async (
        title: string,
        projectId: string | null,
        sectionId: string | null,
        parentId: string | null,
      ): Promise<Task> => task({ id: "created", title, projectId, sectionId, parentId }),
    );
    const createProject = vi.fn(async (title: string): Promise<Project> => {
      const created = project({ id: "project-1", title });
      projects = [...projects, created];

      return created;
    });

    renderApp({
      ...baseApi([]),
      listProjects: async () => projects,
      createProject,
      createTask,
    });

    await userEvent.click(screen.getByRole("button", { name: "Add project" }));
    await userEvent.type(screen.getByLabelText("Project title"), "Roadmap");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await userEvent.click(await screen.findByRole("button", { name: "Roadmap" }));
    await userEvent.click(screen.getByRole("button", { name: "Add task Q" }));
    await userEvent.type(screen.getByLabelText("New task title"), "Define milestones");
    await userEvent.click(
      within(screen.getByRole("dialog", { name: "Add task" })).getByRole("button", { name: "Add task" }),
    );

    await waitFor(() =>
      expect(createTask).toHaveBeenCalledWith("Define milestones", "project-1", null, null),
    );
  });

  // Новая подзадача сохраняется под выбранной родительской задачей.
  it("creates subtasks under an existing task", async () => {
    const createTask = vi.fn(
      async (
        title: string,
        projectId: string | null,
        sectionId: string | null,
        parentId: string | null,
      ): Promise<Task> => task({ id: "subtask-1", title, projectId, sectionId, parentId }),
    );

    renderApp({
      ...baseApi([task({ id: "task-1", title: "Plan MVP" })]),
      createTask,
    });

    await screen.findByText("Plan MVP");
    await userEvent.click(screen.getByRole("button", { name: "Add subtask to Plan MVP" }));
    expect(screen.getByLabelText("Subtask for Plan MVP")).toHaveFocus();
    await userEvent.type(screen.getByLabelText("Subtask for Plan MVP"), "Write outline");
    await userEvent.click(screen.getByRole("button", { name: "Add subtask" }));

    await waitFor(() => expect(createTask).toHaveBeenCalledWith("Write outline", null, null, "task-1"));
  });

  // Контекстное меню открывает действия при правом клике по задаче Входящих.
  it("opens task actions from the right-click menu in Inbox", async () => {
    renderApp({ ...baseApi([task({ id: "1", title: "Plan MVP" })]) });

    await screen.findByText("Plan MVP");
    fireEvent.contextMenu(taskRow("Plan MVP"), { clientX: 120, clientY: 90 });

    const menu = screen.getByRole("menu", { name: "Task actions for Plan MVP" });
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual(["Open", "Quick edit", "Add subtask", "Delete"]);

    await userEvent.click(within(menu).getByRole("menuitem", { name: "Quick edit" }));
    expect(screen.getByLabelText("Edit Plan MVP")).toHaveFocus();
  });

  // Клик по области поддерева выбирает его корневую задачу.
  it("selects the root task when clicking anywhere in its subtree", async () => {
    renderApp({
      ...baseApi([
        task({
          id: "root",
          title: "Parent",
          children: [
            task({
              id: "child",
              title: "Child",
              parentId: "root",
              children: [task({ id: "grandchild", title: "Grandchild", parentId: "child" })],
            }),
          ],
        }),
      ]),
    });

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

  // Клавиша S включает выбор в любой раскладке, Escape выходит из режима.
  it("toggles selection mode with the S key in any keyboard layout and exits with Escape", async () => {
    renderApp({ ...baseApi([task({ id: "root", title: "Parent" })]) });

    await screen.findByText("Parent");
    fireEvent.keyDown(document, { key: "ы", code: "KeyS" });
    expect(taskRow("Parent")).toHaveClass("selection-mode");

    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
    expect(taskRow("Parent")).not.toHaveClass("selection-mode");

    fireEvent.keyDown(document, { key: "s", code: "KeyS" });
    expect(taskRow("Parent")).toHaveClass("selection-mode");
  });

  // Пакетное перемещение затрагивает выбранные корневые задачи и сбрасывает выбор.
  it("moves selected top-level tasks and cancels selection", async () => {
    const moveTask = vi.fn(
      async (
        id: string,
        projectId: string | null,
        sectionId: string | null,
        parentId: string | null,
      ): Promise<Task> => task({ id, title: "Moved", projectId, sectionId, parentId }),
    );
    renderApp({
      ...baseApi([
        task({
          id: "root",
          title: "Parent",
          children: [task({ id: "child", title: "Child", parentId: "root" })],
        }),
      ]),
      listProjects: async () => [project({ id: "project-1", title: "Roadmap" })],
      moveTask,
    });

    await screen.findByText("Parent");
    await userEvent.click(screen.getByRole("button", { name: "Select tasks" }));
    await userEvent.click(screen.getByRole("button", { name: "Parent" }));
    await userEvent.click(screen.getAllByRole("button", { name: "Move selected tasks" })[0]!);
    const dialog = screen.getByRole("dialog", { name: "Move selected tasks" });
    await userEvent.selectOptions(
      within(dialog).getByLabelText("Move selected tasks to"),
      "project:project-1",
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Move selected tasks" }));

    await waitFor(() => expect(moveTask).toHaveBeenCalledTimes(1));
    expect(moveTask).toHaveBeenCalledWith("root", "project-1", null, null, null, null);
    expect(screen.queryByRole("group", { name: "Selected task actions" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Select tasks" }));
    await userEvent.click(screen.getByRole("button", { name: "Parent" }));
    await userEvent.click(screen.getAllByRole("button", { name: "Cancel selection" })[0]!);
    expect(screen.queryByRole("group", { name: "Selected task actions" })).not.toBeInTheDocument();
  });
});
