import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Project, Section, Task } from "@todoist-clone/domain";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { baseApi, dragTask, project, renderApp, section, task } from "./AppTestSupport";

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
  it("deletes selected roots with the existing confirmation and their subtasks", async () => {
    const deleteTask = vi.fn(async () => undefined);
    renderApp(
      Object.freeze({
        ...baseApi(
          Object.freeze([
            task({
              id: "root",
              title: "Parent",
              children: Object.freeze([task({ id: "child", title: "Child", parentId: "root" })]),
            }),
          ]),
        ),
        deleteTask,
      }),
    );

    await screen.findByText("Parent");
    await userEvent.click(screen.getByRole("button", { name: "Select tasks" }));
    await userEvent.click(screen.getByRole("button", { name: "Parent" }));
    await userEvent.click(screen.getAllByRole("button", { name: "Delete selected tasks" })[0]!);

    expect(window.confirm).toHaveBeenCalledWith("Delete 1 selected task and all their subtasks?");
    await waitFor(() => expect(deleteTask).toHaveBeenCalledTimes(1));
    expect(deleteTask).toHaveBeenCalledWith("root");
  });

  it("shows a created project from the create response", async () => {
    const createProject = vi.fn(
      async (title: string): Promise<Project> => project({ id: "project-1", title }),
    );

    renderApp(
      Object.freeze({
        ...baseApi(Object.freeze([])),
        listProjects: async () => Object.freeze([]),
        createProject,
      }),
    );

    await userEvent.click(screen.getByRole("button", { name: "Add project" }));
    await userEvent.type(screen.getByLabelText("Project title"), "Roadmap");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(createProject).toHaveBeenCalledWith("Roadmap", null));
    expect(await screen.findByRole("button", { name: "Roadmap" })).toBeInTheDocument();
  });

  it("updates and deletes projects from the sidebar", async () => {
    const updateProject = vi.fn(
      async (id: string, patch: Readonly<{ title?: string; description?: string }>): Promise<Project> =>
        project({ id, title: patch.title ?? "Roadmap", description: patch.description ?? "" }),
    );
    const deleteProject = vi.fn(async () => undefined);

    renderApp(
      Object.freeze({
        ...baseApi(Object.freeze([])),
        listProjects: async () => Object.freeze([project({ id: "project-1", title: "Roadmap" })]),
        updateProject,
        deleteProject,
      }),
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

  it("renames the selected project inline from its heading", async () => {
    const updateProject = vi.fn(
      async (id: string, patch: Readonly<{ title?: string; description?: string }>): Promise<Project> =>
        project({ id, title: patch.title ?? "Roadmap", description: patch.description ?? "" }),
    );
    window.history.replaceState({}, "", "/?project=project-1");
    renderApp(
      Object.freeze({
        ...baseApi(Object.freeze([])),
        listProjects: async () => Object.freeze([project({ id: "project-1", title: "Roadmap" })]),
        updateProject,
      }),
    );

    await screen.findByRole("heading", { name: "Roadmap" });
    await userEvent.click(screen.getByRole("button", { name: "Edit project name" }));
    const input = screen.getByRole("textbox", { name: "Project title" });
    await userEvent.clear(input);
    await userEvent.type(input, "Launch plan");
    await userEvent.keyboard("{Enter}");

    await waitFor(() =>
      expect(updateProject).toHaveBeenCalledWith("project-1", { id: "project-1", title: "Launch plan" }),
    );
    expect(await screen.findByRole("heading", { name: "Launch plan" })).toBeInTheDocument();
  });

  it("saves, edits, and removes the Inbox description", async () => {
    let description = "";
    renderApp(
      Object.freeze({
        ...baseApi(Object.freeze([])),
        getInboxDescription: async () => description,
        updateInboxDescription: async (next) => {
          description = next;
        },
      }),
    );

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
    renderApp(
      Object.freeze({
        ...baseApi(Object.freeze([])),
        listProjects: async () => Object.freeze([project({ id: "project-1", title: "Roadmap" })]),
      }),
    );
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

  it("opens the project menu upward when there is not enough room below", async () => {
    renderApp(
      Object.freeze({
        ...baseApi(Object.freeze([])),
        listProjects: async () => Object.freeze([project({ id: "project-1", title: "Roadmap" })]),
      }),
    );
    const summary = await screen.findByLabelText("Project menu Roadmap");
    vi.spyOn(summary, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 720,
      top: 720,
      bottom: 754,
      left: 0,
      right: 34,
      width: 34,
      height: 34,
      toJSON: () => ({}),
    });

    await userEvent.click(summary);

    expect(summary.parentElement).toHaveClass("opens-up");
  });

  it("hides project archiving controls by default and keeps archived projects visible", async () => {
    renderApp(
      Object.freeze({
        ...baseApi(Object.freeze([])),
        listProjects: async () =>
          Object.freeze([project({ id: "archived-project", title: "Roadmap", archived: true })]),
      }),
    );
    const roadmap = await screen.findByRole("button", { name: "Roadmap" });
    const sidebar = screen.getByRole("complementary", { name: "Navigation" });
    expect(within(sidebar).queryByRole("link", { name: "Archived projects" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByLabelText("Project menu Roadmap"));
    expect(within(sidebar).queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
    expect(roadmap).toBeVisible();
  });

  it("opens a duplicated project and saves its description independently", async () => {
    let projects: ReadonlyArray<Project> = Object.freeze([
      project({ id: "source", title: "Source", description: "Original notes" }),
    ]);
    const updateProject = vi.fn(
      async (id: string, patch: Readonly<{ description?: string }>): Promise<Project> => {
        const existing = projects.find((item) => item.id === id);
        if (existing === undefined) throw new Error("Unknown project");
        const updated = project({ ...existing, ...patch });
        projects = Object.freeze(projects.map((item) => (item.id === id ? updated : item)));
        return updated;
      },
    );
    const duplicateProject = vi.fn(async (id: string): Promise<Project> => {
      const source = projects.find((item) => item.id === id);
      if (source === undefined) throw new Error("Unknown project");
      const duplicate = project({ ...source, id: "source-copy", title: "Source copy" });
      projects = Object.freeze([...projects, duplicate]);
      return duplicate;
    });
    renderApp(
      Object.freeze({
        ...baseApi(Object.freeze([])),
        listProjects: async () => projects,
        updateProject,
        duplicateProject,
      }),
    );

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
    expect(updateProject).toHaveBeenCalledWith(
      "source-copy",
      expect.objectContaining({ description: "Copy notes only" }),
    );

    await userEvent.click(screen.getByRole("button", { name: /^Source$/ }));
    expect(await screen.findByText("Original notes")).toBeInTheDocument();
    expect(screen.queryByText("Copy notes only")).not.toBeInTheDocument();
  });

  it("creates inbox sections and moves inbox tasks into them", async () => {
    let sections = Object.freeze([] as ReadonlyArray<Section>);
    const moveTask = vi.fn(
      async (
        id: string,
        projectId: string | null,
        sectionId: string | null,
        parentId: string | null,
      ): Promise<Task> => task({ id, title: "Sort receipts", projectId, sectionId, parentId }),
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
        moveTask,
      }),
    );

    await userEvent.click(screen.getByRole("button", { name: "Add section" }));
    await userEvent.type(screen.getByLabelText("Section title"), "Later");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    const dataTransfer = dragTask("Sort receipts");
    fireEvent.drop(await screen.findByLabelText("Section Later"), { dataTransfer });

    await waitFor(() => expect(moveTask).toHaveBeenCalledWith("task-1", null, "section-1", null, null, null));
  });

  it("shows a created inbox section from the create response", async () => {
    const createSection = vi.fn(
      async (title: string): Promise<Section> => section({ id: "section-1", title }),
    );

    renderApp(
      Object.freeze({
        ...baseApi(Object.freeze([])),
        listSections: async () => Object.freeze([]),
        createSection,
      }),
    );

    await userEvent.click(screen.getByRole("button", { name: "Add section" }));
    await userEvent.type(screen.getByLabelText("Section title"), "Someday");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(createSection).toHaveBeenCalledWith("Someday", null));
    expect(await screen.findByRole("heading", { name: "Someday" })).toBeInTheDocument();
  });

  it("moves tasks between inbox and projects with drag and drop", async () => {
    const moveTask = vi.fn(
      async (
        id: string,
        projectId: string | null,
        sectionId: string | null,
        parentId: string | null,
      ): Promise<Task> => task({ id, title: "Plan launch", projectId, sectionId, parentId }),
    );

    renderApp(
      Object.freeze({
        ...baseApi(Object.freeze([task({ id: "task-1", title: "Plan launch", projectId: "project-1" })])),
        listProjects: async () => Object.freeze([project({ id: "project-1", title: "Launch" })]),
        moveTask,
      }),
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
        listProjects: async () => Object.freeze([project({ id: "project-1", title: "Launch" })]),
      }),
    );

    await screen.findByText("Plan launch");
    const dataTransfer = dragTask("Plan launch");
    const projectButton = await screen.findByRole("button", { name: "Launch" });

    fireEvent.dragEnter(projectButton, { dataTransfer });

    expect(projectButton).toHaveClass("drop-active");
  });

  it("nests a project inside the mobile project drop target", async () => {
    const moveProject = vi.fn(
      async (id: string, parentId: string | null): Promise<Project> =>
        project({ id, title: "Source", parentId }),
    );
    renderApp(
      Object.freeze({
        ...baseApi(Object.freeze([])),
        listProjects: async () =>
          Object.freeze([
            project({ id: "source", title: "Source" }),
            project({ id: "target", title: "Target" }),
          ]),
        moveProject,
      }),
    );

    const sourceHandle = await screen.findByRole("button", { name: "Drag project Source" });
    const targetButton = screen.getByRole("button", { name: "Target" });
    const elementFromPointDescriptor = Object.getOwnPropertyDescriptor(document, "elementFromPoint");
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: vi.fn(() => targetButton),
    });
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
});
