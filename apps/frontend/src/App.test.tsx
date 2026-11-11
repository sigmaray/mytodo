import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TaskNode } from "@todoist-clone/domain";
import { BrowserRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryClient } from "./App";
import { baseApi, project, renderApp, savedComments, task } from "./AppTestSupport";
import type { ApplicationApi, ToolsApi } from "./api";
import { createTaskApi } from "./api";
import { AdminUsersPage } from "./pages/AdminUsersPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ToolsPage } from "./pages/ToolsPage";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

beforeEach(() => {
  window.history.replaceState({}, "", "/");
  vi.spyOn(window, "confirm").mockReturnValue(true);
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
      runQuery,
    });

    render(
      <QueryClientProvider client={createQueryClient()}>
        <BrowserRouter>
          <ToolsPage api={api} />
        </BrowserRouter>
      </QueryClientProvider>,
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
    const isoDate = (date: Date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const overdueDate = isoDate(yesterday);
    const todayDate = isoDate(today);
    const upcomingDate = isoDate(tomorrow);
    const datedParent = task({
      id: "dated",
      title: "Dated note",
      dueDate: overdueDate,
      labels: Object.freeze(["work"]),
      children: Object.freeze([task({ id: "undated-child", title: "Undated child", parentId: "dated" })]),
    });
    renderApp(
      baseApi(
        Object.freeze([
          datedParent,
          task({ id: "today-task", title: "Today task", dueDate: todayDate }),
          task({ id: "upcoming-task", title: "Upcoming task", dueDate: upcomingDate }),
          task({ id: "plain", title: "No date" }),
        ]),
      ),
    );

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
    const isoDate = (date: Date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    let storedTasks: ReadonlyArray<TaskNode> = Object.freeze([]);
    let nextTaskId = 0;
    const api = Object.freeze({
      ...baseApi(Object.freeze([])),
      listTasks: async () => storedTasks,
      createTask: async (
        title: string,
        projectId: string | null,
        sectionId: string | null,
        parentId: string | null,
      ) => {
        const created = task({ id: `date-filter-${nextTaskId++}`, title, projectId, sectionId, parentId });
        storedTasks = Object.freeze([...storedTasks, created]);
        return created;
      },
      updateTask: async (id: string, patch: Parameters<ApplicationApi["updateTask"]>[1]) => {
        const current = storedTasks.find((item) => item.id === id);
        if (current === undefined) throw new Error(`Unknown task ${id}`);
        const { comments, ...fields } = patch;
        const updated = task({
          ...current,
          ...fields,
          ...(comments === undefined ? {} : { comments: savedComments(comments) }),
        });
        storedTasks = Object.freeze(storedTasks.map((item) => (item.id === id ? updated : item)));
        return updated;
      },
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
    const taskButton = (title: string) =>
      within(datesTasks).getByRole("button", { name: new RegExp(`^${title}$`) });
    const expectVisibleTasks = (...titles: ReadonlyArray<string>) =>
      titles.forEach((title) => expect(taskButton(title)).toBeInTheDocument());
    const expectHiddenTasks = (...titles: ReadonlyArray<string>) =>
      titles.forEach((title) =>
        expect(
          within(datesTasks).queryByRole("button", { name: new RegExp(`^${title}$`) }),
        ).not.toBeInTheDocument(),
      );

    expect(storedTasks.map((item) => [item.title, item.dueDate])).toEqual([
      ["Overdue task", isoDate(yesterday)],
      ["Today task", isoDate(today)],
      ["Upcoming task", isoDate(tomorrow)],
      ["Undated task", null],
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

    expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
      "Sun",
    ]);
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
    const labeledParent = task({
      id: "match",
      title: "Project task",
      projectId: "p1",
      labels: Object.freeze(["work"]),
      children: Object.freeze([
        task({
          id: "other-child",
          title: "Other label child",
          parentId: "match",
          labels: Object.freeze(["home"]),
        }),
      ]),
    });
    renderApp(
      baseApi(
        Object.freeze([
          labeledParent,
          task({ id: "other", title: "Other label", labels: Object.freeze(["home"]) }),
        ]),
      ),
    );

    expect(await screen.findByRole("button", { name: "Project task" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Other label child" })).toBeInTheDocument();
    expect(screen.queryByText("Other label")).not.toBeInTheDocument();
  });
});

describe("SearchPalette", () => {
  it("searches task descriptions and labels, and opens matching destinations", async () => {
    renderApp(
      baseApi(
        Object.freeze([
          task({
            id: "search-task",
            title: "Prepare launch",
            description: "needle phrase in notes",
            labels: Object.freeze(["work"]),
          }),
        ]),
      ),
    );

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
      Object.freeze({
        confirmDelete: settings.confirmDelete,
        accessMode: "password" as const,
        username: "admin",
      }),
    );
    const api = Object.freeze({ ...baseApi(Object.freeze([])), updateSettings });

    render(
      <QueryClientProvider client={createQueryClient()}>
        <BrowserRouter>
          <SettingsPage api={api} />
        </BrowserRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(await screen.findByRole("checkbox", { name: /Ask for confirmation/ })).toBeChecked();
    await userEvent.click(screen.getByRole("checkbox", { name: /Ask for confirmation/ }));
    await userEvent.click(screen.getByRole("button", { name: "Save settings" }));

    await waitFor(() => expect(updateSettings).toHaveBeenCalled());
    expect(updateSettings.mock.calls[0]?.[0]).toEqual({ confirmDelete: false });
  });

  it("lets a signed-in user update their own account without user administration", async () => {
    const updateOwnAccount = vi.fn(async (account: Parameters<ApplicationApi["updateOwnAccount"]>[0]) =>
      Object.freeze({ id: "admin", username: account.username, isAdmin: true }),
    );
    const api = Object.freeze({ ...baseApi(Object.freeze([])), updateOwnAccount });
    render(
      <QueryClientProvider client={createQueryClient()}>
        <BrowserRouter>
          <SettingsPage api={api} />
        </BrowserRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("heading", { name: "Your account" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Users" })).not.toBeInTheDocument();
    await userEvent.clear(screen.getByRole("textbox", { name: "Username" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Username" }), "NewAdmin");
    await userEvent.type(screen.getByLabelText("New password"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Save account" }));

    await waitFor(() =>
      expect(updateOwnAccount.mock.calls[0]?.[0]).toEqual({ username: "newadmin", password: "x" }),
    );
  });

  it("lets administrators create a user on the user management page", async () => {
    const createUser = vi.fn(async (user: Parameters<ApplicationApi["createUser"]>[0]) =>
      Object.freeze({ id: "created", username: user.username, isAdmin: user.isAdmin }),
    );
    const api = Object.freeze({ ...baseApi(Object.freeze([])), createUser });
    render(
      <QueryClientProvider client={createQueryClient()}>
        <BrowserRouter>
          <AdminUsersPage api={api} />
        </BrowserRouter>
      </QueryClientProvider>,
    );

    const usernames = await screen.findAllByLabelText("Username");
    await userEvent.type(usernames[0]!, "sam");
    await userEvent.type(screen.getByLabelText("Password"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Create user" }));

    await waitFor(() =>
      expect(createUser.mock.calls[0]?.[0]).toEqual({ username: "sam", password: "x", isAdmin: false }),
    );
  });
});

describe("createTaskApi", () => {
  it("moves tasks with the backend PUT contract", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ task: task({ id: "task-1", title: "Moved" }) }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );

    vi.stubGlobal("fetch", fetchMock);

    await createTaskApi("http://api.test").moveTask(
      "task-1",
      "project-1",
      null,
      "parent-1",
      "before-1",
      "after-1",
    );

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
          afterId: "after-1",
        }),
      }),
    );
  });

  it("updates projects and task patches with JSON requests", async () => {
    const fetchMock = vi.fn(
      async (url: string) =>
        new Response(
          JSON.stringify(
            url.includes("/projects/")
              ? { project: project({ id: "project-1", title: "Launch" }) }
              : { task: task({ id: "task-1", title: "Renamed" }) },
          ),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
    );

    vi.stubGlobal("fetch", fetchMock);

    await createTaskApi("http://api.test").updateProject("project-1", Object.freeze({ title: "Launch" }));
    await createTaskApi("http://api.test").updateTask("task-1", Object.freeze({ title: "Renamed" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/projects/project-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ title: "Launch" }),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/tasks/task-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ title: "Renamed" }),
      }),
    );
  });
});
