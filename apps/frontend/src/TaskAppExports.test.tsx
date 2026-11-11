import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Section, Task } from "@todoist-clone/domain";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  baseApi,
  dragTask,
  placePointer,
  project,
  renderApp,
  section,
  task,
  taskRow,
} from "./AppTestSupport";

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
  it("moves a task inside another task with drag and drop", async () => {
    const moveTask = vi.fn(
      async (
        id: string,
        projectId: string | null,
        sectionId: string | null,
        parentId: string | null,
      ): Promise<Task> => task({ id, title: "Child", projectId, sectionId, parentId }),
    );

    renderApp(
      Object.freeze({
        ...baseApi(
          Object.freeze([
            task({ id: "parent", title: "Parent task" }),
            task({ id: "child", title: "Child task" }),
          ]),
        ),
        moveTask,
      }),
    );

    await screen.findByText("Parent task");
    const dataTransfer = dragTask("Child task");
    const parentRow = taskRow("Parent task");

    placePointer(parentRow, -50);
    fireEvent.drop(parentRow, { dataTransfer });

    await waitFor(() => expect(moveTask).toHaveBeenCalledWith("child", null, null, "parent", null, null));
  });

  it("reorders sibling tasks with drag and drop insertion lines", async () => {
    const moveTask = vi.fn(
      async (
        id: string,
        projectId: string | null,
        sectionId: string | null,
        parentId: string | null,
      ): Promise<Task> => task({ id, title: "Moved", projectId, sectionId, parentId }),
    );

    renderApp(
      Object.freeze({
        ...baseApi(
          Object.freeze([
            task({ id: "a", title: "Alpha", lexicalOrder: "a" }),
            task({ id: "b", title: "Beta", lexicalOrder: "b" }),
            task({ id: "c", title: "Gamma", lexicalOrder: "c" }),
          ]),
        ),
        moveTask,
      }),
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
    const moveTask = vi.fn(
      async (
        id: string,
        projectId: string | null,
        sectionId: string | null,
        parentId: string | null,
      ): Promise<Task> => task({ id, title: "Moved", projectId, sectionId, parentId }),
    );

    renderApp(
      Object.freeze({
        ...baseApi(
          Object.freeze([
            task({ id: "a", title: "Alpha", lexicalOrder: "a" }),
            task({ id: "b", title: "Beta", lexicalOrder: "b" }),
            task({
              id: "parent",
              title: "Parent",
              lexicalOrder: "c",
              children: Object.freeze([
                task({ id: "child", title: "Child", parentId: "parent", lexicalOrder: "a" }),
              ]),
            }),
          ]),
        ),
        moveTask,
      }),
    );

    await screen.findByText("Beta");
    fireEvent.keyDown(taskRow("Beta"), { key: "ArrowRight", ctrlKey: true });

    await waitFor(() => expect(moveTask).toHaveBeenCalledWith("b", null, null, "a", null, null));

    fireEvent.keyDown(taskRow("Child"), { key: "ArrowLeft", ctrlKey: true });

    await waitFor(() => expect(moveTask).toHaveBeenCalledWith("child", null, null, null, null, "parent"));
  });

  it("outdents a nested task by dragging it left", async () => {
    const moveTask = vi.fn(
      async (
        id: string,
        projectId: string | null,
        sectionId: string | null,
        parentId: string | null,
      ): Promise<Task> => task({ id, title: "Moved", projectId, sectionId, parentId }),
    );

    renderApp(
      Object.freeze({
        ...baseApi(
          Object.freeze([
            task({
              id: "parent",
              title: "Parent",
              lexicalOrder: "a",
              children: Object.freeze([
                task({ id: "child", title: "Child", parentId: "parent", lexicalOrder: "a" }),
              ]),
            }),
          ]),
        ),
        moveTask,
      }),
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
          toJSON: () => Object.freeze({}),
        }),
    });
    fireEvent.drop(childRow, { dataTransfer, clientX: -24 });

    await waitFor(() => expect(moveTask).toHaveBeenCalledWith("child", null, null, null, null, "parent"));
  });

  it("calls update and delete handlers", async () => {
    const updateTask = vi.fn(
      async (id: string, patch: Readonly<{ title?: string }>): Promise<Task> =>
        task({ id, title: patch.title ?? "Plan MVP" }),
    );
    const deleteTask = vi.fn(async () => undefined);

    renderApp(
      Object.freeze({
        ...baseApi(Object.freeze([task({ id: "1", title: "Plan MVP" })])),
        updateTask,
        deleteTask,
      }),
    );

    await screen.findByText("Plan MVP");
    await userEvent.click(screen.getByRole("button", { name: "Edit task Plan MVP" }));
    expect(screen.getByLabelText("Edit Plan MVP")).toHaveFocus();
    await userEvent.clear(screen.getByLabelText("Edit Plan MVP"));
    await userEvent.type(screen.getByLabelText("Edit Plan MVP"), "Plan MVP carefully");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(updateTask).toHaveBeenCalledWith("1", { title: "Plan MVP carefully" }));

    await userEvent.click(screen.getByRole("button", { name: "Delete task Plan MVP" }));

    expect(window.confirm).toHaveBeenCalledWith("Delete task “Plan MVP” and its subtasks?");
    await waitFor(() => expect(deleteTask).toHaveBeenCalledWith("1"));
  });

  it("does not delete when the confirmation is declined", async () => {
    const deleteTask = vi.fn(async () => undefined);
    vi.mocked(window.confirm).mockReturnValue(false);

    renderApp(
      Object.freeze({ ...baseApi(Object.freeze([task({ id: "1", title: "Plan MVP" })])), deleteTask }),
    );
    await screen.findByText("Plan MVP");
    await userEvent.click(screen.getByRole("button", { name: "Delete task Plan MVP" }));

    expect(window.confirm).toHaveBeenCalled();
    expect(deleteTask).not.toHaveBeenCalled();
  });

  it("skips delete confirmation when the preference is disabled", async () => {
    const deleteTask = vi.fn(async () => undefined);
    const api = Object.freeze({
      ...baseApi(Object.freeze([task({ id: "1", title: "Plan MVP" })])),
      getSettings: async () =>
        Object.freeze({ confirmDelete: false, accessMode: "password" as const, username: "admin" }),
      deleteTask,
    });

    renderApp(api);
    await screen.findByText("Plan MVP");
    await userEvent.click(screen.getByRole("button", { name: "Delete task Plan MVP" }));

    expect(window.confirm).not.toHaveBeenCalled();
    await waitFor(() => expect(deleteTask).toHaveBeenCalledWith("1"));
  });

  it("assigns a task to a project while editing", async () => {
    const updateTask = vi.fn(
      async (id: string, patch: Readonly<{ title?: string }>): Promise<Task> =>
        task({ id, title: patch.title ?? "Plan MVP" }),
    );
    const moveTask = vi.fn(
      async (
        id: string,
        projectId: string | null,
        sectionId: string | null,
        parentId: string | null,
      ): Promise<Task> => task({ id, title: "Plan MVP", projectId, sectionId, parentId }),
    );

    renderApp(
      Object.freeze({
        ...baseApi(Object.freeze([task({ id: "1", title: "Plan MVP" })])),
        listProjects: async () => Object.freeze([project({ id: "project-1", title: "Roadmap" })]),
        updateTask,
        moveTask,
      }),
    );

    await screen.findByText("Plan MVP");
    await userEvent.click(screen.getByRole("button", { name: "Edit task Plan MVP" }));
    await userEvent.selectOptions(screen.getByLabelText("Move Plan MVP to"), "project:project-1");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(updateTask).toHaveBeenCalledWith("1", { title: "Plan MVP" }));
    await waitFor(() => expect(moveTask).toHaveBeenCalledWith("1", "project-1", null, null, null, null));
  });

  it("updates and deletes inbox sections", async () => {
    const updateSection = vi.fn(
      async (id: string, title: string): Promise<Section> => section({ id, title }),
    );
    const deleteSection = vi.fn(async () => undefined);

    renderApp(
      Object.freeze({
        ...baseApi(Object.freeze([])),
        listSections: async () => Object.freeze([section({ id: "section-1", title: "Later" })]),
        updateSection,
        deleteSection,
      }),
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

  it("adds section tasks at the top or bottom from the matching button", async () => {
    const createTask = vi.fn(
      async (
        title: string,
        projectId: string | null,
        sectionId: string | null,
        parentId: string | null,
      ): Promise<Task> => task({ id: title, title, projectId, sectionId, parentId }),
    );
    const moveTask = vi.fn(
      async (
        id: string,
        projectId: string | null,
        sectionId: string | null,
        parentId: string | null,
      ): Promise<Task> => task({ id, title: "Created task", projectId, sectionId, parentId }),
    );
    renderApp(
      Object.freeze({
        ...baseApi(
          Object.freeze([task({ id: "existing-task", title: "Existing task", sectionId: "section-1" })]),
        ),
        listSections: async () => Object.freeze([section({ id: "section-1", title: "Later" })]),
        createTask,
        moveTask,
      }),
    );

    await screen.findByText("Existing task");
    expect(screen.getByRole("button", { name: "Add task to bottom of section Later" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Add task to section Later" }));
    await userEvent.type(screen.getByLabelText("New task title"), "First task");
    await userEvent.click(
      within(screen.getByRole("dialog", { name: "Add task" })).getByRole("button", { name: "Add task" }),
    );
    await waitFor(() =>
      expect(moveTask).toHaveBeenCalledWith("First task", null, "section-1", null, "existing-task", null),
    );

    await userEvent.click(screen.getByRole("button", { name: "Add task to bottom of section Later" }));
    await userEvent.type(screen.getByLabelText("New task title"), "Last task");
    await userEvent.click(
      within(screen.getByRole("dialog", { name: "Add task" })).getByRole("button", { name: "Add task" }),
    );
    await waitFor(() => expect(createTask).toHaveBeenCalledWith("Last task", null, "section-1", null));
    expect(moveTask).toHaveBeenCalledTimes(1);
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
      comments: Object.freeze([
        Object.freeze({
          id: "project-comment",
          body: "Project comment",
          createdAt: "2026-10-22T10:00:00.000Z",
        }),
      ]),
    });
    const api = Object.freeze({
      ...baseApi(Object.freeze([task({ id: "inbox-task", title: "Inbox only" }), projectTask])),
      listProjects: async () =>
        Object.freeze([project({ id: "project-1", title: "Roadmap", description: "Roadmap details" })]),
      listSections: async () =>
        Object.freeze([section({ id: "section-1", title: "Milestone", projectId: "project-1" })]),
    });
    renderApp(api);

    await screen.findByText("Project task");
    await userEvent.click(screen.getByRole("button", { name: /^Export$/ }));
    expect(await screen.findByRole("dialog", { name: "Export options" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Preview JSON" }));
    const jsonDialog = await screen.findByRole("dialog", { name: "JSON preview" });
    const jsonText = jsonDialog.querySelector("pre")?.textContent;
    if (jsonText === null || jsonText === undefined) throw new Error("Missing scoped JSON preview");
    const exported = JSON.parse(jsonText) as {
      scope: { type: string; title: string };
      project: {
        description: string;
        sections: ReadonlyArray<{ title: string }>;
        tasks: ReadonlyArray<{
          description: string;
          dueDate: string;
          labels: ReadonlyArray<string>;
          comments: ReadonlyArray<{ body: string }>;
        }>;
      };
      inbox: unknown;
      comments: ReadonlyArray<{ body: string }>;
      dates: ReadonlyArray<{ dueDate: string }>;
    };
    expect(exported.scope).toEqual({ type: "project", id: "project-1", title: "Roadmap" });
    expect(exported.inbox).toBeNull();
    expect(exported.project).toMatchObject({
      description: "Roadmap details",
      sections: [expect.objectContaining({ title: "Milestone" })],
      tasks: [
        expect.objectContaining({
          description: "Detailed project note",
          dueDate: "2026-12-04",
          labels: ["planning"],
          comments: [expect.objectContaining({ body: "Project comment" })],
        }),
      ],
    });
    expect(exported.comments).toEqual([expect.objectContaining({ body: "Project comment" })]);
    expect(exported.dates).toEqual([expect.objectContaining({ dueDate: "2026-12-04" })]);
    expect(jsonText).not.toContain("Inbox only");
    fireEvent.keyDown(jsonDialog, { key: "Escape" });
    expect(screen.getByRole("dialog", { name: "Export options" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Preview advanced markdown" }));
    const advancedMarkdown =
      screen.getByRole("dialog", { name: "Advanced markdown preview" }).querySelector("pre")?.textContent ??
      "";
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
      comments: Object.freeze([
        Object.freeze({ id: "comment-1", body: "Task comment", createdAt: "2026-10-22T10:00:00.000Z" }),
      ]),
    });
    const api = Object.freeze({
      ...baseApi(Object.freeze([inboxTask])),
      getInboxDescription: async () => "Inbox description",
      listProjects: async () =>
        Object.freeze([project({ id: "project-1", title: "Roadmap", description: "Project description" })]),
      listSections: async () =>
        Object.freeze([section({ id: "section-1", title: "Later", projectId: "project-1" })]),
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
    const exported = JSON.parse(jsonText) as {
      inbox: {
        description: string;
        tasks: ReadonlyArray<{
          description: string;
          dueDate: string;
          comments: ReadonlyArray<{ body: string }>;
        }>;
      };
      projects: ReadonlyArray<{ description: string; sections: ReadonlyArray<{ title: string }> }>;
      sections: ReadonlyArray<{ title: string }>;
      dates: ReadonlyArray<{ dueDate: string }>;
      comments: ReadonlyArray<{ body: string }>;
    };
    expect(exported.inbox.description).toBe("Inbox description");
    expect(exported.inbox.tasks[0]).toMatchObject({
      description: "Task description",
      dueDate: "2026-11-18",
      comments: [expect.objectContaining({ body: "Task comment" })],
    });
    expect(exported.projects[0]).toMatchObject({
      description: "Project description",
      sections: [expect.objectContaining({ title: "Later" })],
    });
    expect(exported.sections).toEqual([expect.objectContaining({ title: "Later" })]);
    expect(exported.dates).toEqual([expect.objectContaining({ dueDate: "2026-11-18" })]);
    expect(exported.comments).toEqual([expect.objectContaining({ body: "Task comment" })]);
  });
});
