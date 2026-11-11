import { createE2eApi } from "./api";
import { expect, test } from "./fixtures";

test.beforeEach(async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
});

test("shows task context actions in Inbox and projects", async ({ page }, testInfo) => {
  const inboxTitle = `Inbox context ${testInfo.workerIndex}-${Date.now()}`;
  const projectTitle = `Project context ${testInfo.workerIndex}-${Date.now()}`;
  const projectTaskTitle = `Project task ${testInfo.workerIndex}-${Date.now()}`;
  const api = createE2eApi(page.request);
  const project = await api.createProject(projectTitle);
  await api.createTask(inboxTitle);
  await api.createTask(projectTaskTitle, { projectId: project.id });
  await page.goto("/");

  const inboxRow = page
    .locator(".task-row")
    .filter({ has: page.getByRole("button", { name: inboxTitle, exact: true }) });
  await inboxRow.click({ button: "right" });
  const inboxMenu = page.getByRole("menu", { name: `Task actions for ${inboxTitle}` });
  await expect(inboxMenu.getByRole("menuitem")).toHaveText(["Open", "Quick edit", "Add subtask", "Delete"]);
  await inboxMenu.getByRole("menuitem", { name: "Open" }).click();
  const details = page.getByRole("dialog", { name: `Task details: ${inboxTitle}` });
  await expect(details).toBeVisible();
  await details.getByRole("button", { name: "Close task details" }).click();

  await page.getByRole("button", { name: projectTitle, exact: true }).click();
  const projectRow = page
    .locator(".task-row")
    .filter({ has: page.getByRole("button", { name: projectTaskTitle, exact: true }) });
  await projectRow.click({ button: "right" });
  const projectMenu = page.getByRole("menu", { name: `Task actions for ${projectTaskTitle}` });
  await expect(projectMenu.getByRole("menuitem")).toHaveText(["Open", "Quick edit", "Add subtask", "Delete"]);
});

test("Playwright API creates and clears individual data tables", async ({ page }, testInfo) => {
  const api = createE2eApi(page.request);
  const project = await api.createProject(`API project ${testInfo.workerIndex}-${Date.now()}`);
  const section = await api.createSection("API section", project.id);
  const task = await api.createTask("API task", { projectId: project.id, sectionId: section.id });
  await api.createComment(task.id, "Seeded comment");
  const attachment = await api.createAttachment(task.id, {
    name: "seed.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("seed data"),
  });

  await page.goto(`/?project=${encodeURIComponent(project.id)}`);
  await page.getByRole("button", { name: task.title, exact: true }).click();
  const dialog = page.getByRole("dialog", { name: `Task details: ${task.title}` });
  await expect(dialog.getByText("Seeded comment")).toBeVisible();
  await expect(dialog.getByRole("link", { name: /seed.txt/ })).toBeVisible();
  expect(attachment.attachment.size).toBe(Buffer.byteLength("seed data"));

  expect((await api.clearTable("task_comments")).deleted).toBe(2);
  await page.reload();
  await expect(page.getByRole("button", { name: task.title, exact: true })).toBeVisible();
  await page.getByRole("button", { name: task.title, exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: `Task details: ${task.title}` }).locator(".task-comment"),
  ).toHaveCount(0);

  expect((await api.clearTable("tasks")).deleted).toBe(1);
  expect((await api.clearTable("sections")).deleted).toBe(1);
  expect((await api.clearTable("projects")).deleted).toBe(1);
});

test("PostgreSQL preserves task tree, concurrent comments, and tenant links", async ({ page }, testInfo) => {
  const suffix = `${testInfo.workerIndex}-${Date.now()}`;
  const api = createE2eApi(page.request);
  let otherUserId: string | undefined;
  try {
    const parent = await api.createTask(`Cycle parent ${suffix}`);
    const child = await api.createTask(`Cycle child ${suffix}`, { parentId: parent.id });
    const cycleResponse = await page.request.put(`/tasks/${parent.id}/move`, {
      data: { parentId: child.id, projectId: null, sectionId: null, beforeId: null, afterId: null },
    });
    expect(cycleResponse.status()).toBe(404);

    const [firstComment, secondComment] = await Promise.all([
      page.request.post(`/tasks/${parent.id}/comments`, {
        multipart: {
          body: "First",
          files: { name: "first.txt", mimeType: "text/plain", buffer: Buffer.from("one") },
        },
      }),
      page.request.post(`/tasks/${parent.id}/comments`, {
        multipart: {
          body: "Second",
          files: { name: "second.txt", mimeType: "text/plain", buffer: Buffer.from("two") },
        },
      }),
    ]);
    expect(firstComment.status()).toBe(201);
    expect(secondComment.status()).toBe(201);
    const tasksResponse = await page.request.get("/tasks");
    const tasksBody = (await tasksResponse.json()) as Readonly<{
      tasks: ReadonlyArray<Readonly<{ id: string; comments: ReadonlyArray<Readonly<{ body: string }>> }>>;
    }>;
    expect(
      tasksBody.tasks
        .find((task) => task.id === parent.id)
        ?.comments.map((comment) => comment.body)
        .toSorted(),
    ).toEqual(["First", "Second"]);
    const toolMigration = await page.request.post("/tools-api/migrate");
    expect(toolMigration.ok()).toBe(true);
    const afterMigration = await page.request.get("/tasks");
    const afterMigrationBody = (await afterMigration.json()) as Readonly<{
      tasks: ReadonlyArray<Readonly<{ id: string; comments: ReadonlyArray<Readonly<{ body: string }>> }>>;
    }>;
    expect(
      afterMigrationBody.tasks
        .find((task) => task.id === parent.id)
        ?.comments.map((comment) => comment.body)
        .toSorted(),
    ).toEqual(["First", "Second"]);

    const project = await api.createProject(`Transactional delete ${suffix}`);
    const section = await api.createSection(`Transactional section ${suffix}`, project.id);
    const projectTask = await api.createTask(`Transactional task ${suffix}`, {
      projectId: project.id,
      sectionId: section.id,
    });
    const deleteProjectResponse = await page.request.delete(`/projects/${project.id}`);
    expect(deleteProjectResponse.ok()).toBe(true);
    const afterProjectDelete = await page.request.get("/tasks");
    const afterProjectDeleteBody = (await afterProjectDelete.json()) as Readonly<{
      tasks: ReadonlyArray<Readonly<{ id: string }>>;
    }>;
    expect(afterProjectDeleteBody.tasks.some((task) => task.id === projectTask.id)).toBe(false);

    const adminProjectResponse = await page.request.post("/projects", {
      data: { title: `Foreign project ${suffix}` },
    });
    const adminProject = (
      (await adminProjectResponse.json()) as Readonly<{ project: Readonly<{ id: string }> }>
    ).project;
    const otherUserName = `integrity-${suffix}`;
    const otherUserResponse = await page.request.post("/users", {
      data: { username: otherUserName, password: `integrity-password-${suffix}` },
    });
    expect(otherUserResponse.status()).toBe(201);
    otherUserId = ((await otherUserResponse.json()) as Readonly<{ user: Readonly<{ id: string }> }>).user.id;
    const invalidInsert = await page.request.post("/tools-api/query", {
      data: {
        sql: `INSERT INTO tasks (id, user_id, title, completed, parent_id, project_id, section_id, lexical_order) VALUES ('cross-user-${suffix}', '${otherUserId}', 'invalid cross-user task', false, NULL, '${adminProject.id}', NULL, 'U')`,
      },
    });
    expect(invalidInsert.status()).toBe(500);
  } finally {
    if (otherUserId !== undefined) await page.request.delete(`/users/${otherUserId}`);
  }
});

test("moves a selected task group to a project with drag and drop", async ({ page }, testInfo) => {
  const sourceTitle = `Group source ${testInfo.workerIndex}-${Date.now()}`;
  const secondTitle = `Group second ${testInfo.workerIndex}-${Date.now()}`;
  const projectTitle = `Group destination ${testInfo.workerIndex}-${Date.now()}`;
  const api = createE2eApi(page.request);
  await api.createProject(projectTitle);
  await api.createTask(sourceTitle);
  await api.createTask(secondTitle);
  await page.goto("/");

  await page.getByRole("button", { name: "Inbox", exact: true }).click();
  const sourceTitleButton = page.getByRole("button", { name: sourceTitle, exact: true });
  const titlePositionBefore = await sourceTitleButton.boundingBox();
  const selectTasksButton = page.getByRole("button", { name: "Select tasks" });
  await expect(selectTasksButton).toHaveClass(/btn-outline-secondary/);
  await expect(selectTasksButton.locator("svg")).toBeVisible();
  await selectTasksButton.click();
  await sourceTitleButton.click();
  await page.getByRole("button", { name: secondTitle, exact: true }).click();
  const sourceRow = page
    .locator(".task-row")
    .filter({ has: page.getByRole("button", { name: sourceTitle, exact: true }) });
  const titlePositionAfter = await sourceTitleButton.boundingBox();
  expect(titlePositionBefore?.x).toBe(titlePositionAfter?.x);
  expect(
    await sourceRow
      .locator(".task-action")
      .evaluateAll((actions) => actions.every((action) => getComputedStyle(action).visibility === "hidden")),
  ).toBe(true);
  await expect(sourceRow.locator("input[type='checkbox']")).toBeHidden();
  await sourceRow.dragTo(
    page
      .locator(".project-nav-row")
      .filter({ has: page.getByRole("button", { name: projectTitle, exact: true }) })
      .getByRole("button", { name: projectTitle, exact: true }),
  );

  await expect(page.getByRole("button", { name: sourceTitle, exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: secondTitle, exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: projectTitle, exact: true }).click();
  await expect(page.getByRole("button", { name: sourceTitle, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: secondTitle, exact: true })).toBeVisible();
});

test("toggles task selection with S in any layout and exits with Escape", async ({ page }, testInfo) => {
  const title = `Selection shortcut ${testInfo.workerIndex}-${Date.now()}`;
  await createE2eApi(page.request).createTask(title);
  await page.goto("/");
  const row = page
    .locator(".task-row")
    .filter({ has: page.getByRole("button", { name: title, exact: true }) });
  await expect(row).toBeVisible();

  await page.evaluate(() =>
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ы", code: "KeyS", bubbles: true })),
  );
  await expect(row).toHaveClass(/selection-mode/);
  await page.keyboard.press("Escape");
  await expect(row).not.toHaveClass(/selection-mode/);
});
