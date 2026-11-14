import { expect, test } from "./fixtures";

test.beforeEach(async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
});

/** Для нового аккаунта подтверждение удаления включено по умолчанию. */
test("opens settings with deletion confirmation enabled by default", async ({ page }) => {
  await page.goto("/settings");

  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /Ask for confirmation before deleting/ })).toBeChecked();
  await expect(page.getByRole("heading", { name: "Your account" })).toBeVisible();
  await expect(page.getByLabel("Username")).toHaveValue("admin");
  await expect(page.getByRole("heading", { name: "Users" })).toHaveCount(0);
  await expect(page.getByText(/Set the initial administrator password with the backend CLI/)).toHaveCount(0);
});

/** Администратор управляет аккаунтами на отдельной странице. */
test("administrators manage accounts on a separate page", async ({ page }, testInfo) => {
  const username = `managed-${testInfo.workerIndex}-${Date.now()}`;
  await page.goto("/");
  await page.getByRole("link", { name: "User management" }).click();
  await expect(page).toHaveURL(/\/admin\/users$/);
  await expect(page.getByRole("heading", { name: "User management" })).toBeVisible();
  await page.getByLabel("Username").first().fill(username);
  await page.getByLabel("Password", { exact: true }).fill("x");
  await page.getByRole("button", { name: "Create user" }).click();
  await expect(page.locator(`.managed-users input[value="${username}"]`)).toBeVisible();
});

/** Удаление аккаунта также удаляет связанные записи пользователя в базе. */
test("deleting a user from User management removes all of their database records", async ({
  page,
  browser,
}, testInfo) => {
  const suffix = `${testInfo.workerIndex}-${Date.now()}`;
  const username = `delete-data-${suffix}`;
  const password = "user-data-test-password";
  const baseURL = testInfo.project.use.baseURL as string;
  const userContext = await browser.newContext({ baseURL });
  let userId: string | undefined;

  try {
    await page.goto("/admin/users");
    await page.getByLabel("Username").first().fill(username);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Create user" }).click();
    await expect(page.locator(`.managed-users input[value="${username}"]`)).toBeVisible();

    const usersResponse = await page.request.get("/users");
    expect(usersResponse.ok()).toBe(true);
    const usersBody = (await usersResponse.json()) as {
      users: Array<{ id: string; username: string }>;
    };
    userId = usersBody.users.find((user) => user.username === username)?.id;
    expect(userId).toBeDefined();
    if (userId === undefined) throw new Error("Created user was not returned by the admin API");
    expect(userId).toMatch(/^[0-9a-f-]{36}$/i);

    const userRequest = userContext.request;
    const loginResponse = await userRequest.post("/auth/login", { data: { username, password } });
    expect(loginResponse.ok()).toBe(true);

    const projectResponse = await userRequest.post("/projects", {
      data: { title: `Owned project ${suffix}` },
    });
    expect(projectResponse.status()).toBe(201);
    const project = ((await projectResponse.json()) as { project: { id: string } }).project;
    const subprojectResponse = await userRequest.post("/projects", {
      data: { title: `Owned subproject ${suffix}`, parentId: project.id },
    });
    expect(subprojectResponse.status()).toBe(201);
    const subproject = ((await subprojectResponse.json()) as { project: { id: string } }).project;

    const sectionResponse = await userRequest.post("/sections", {
      data: { title: `Owned section ${suffix}`, projectId: subproject.id },
    });
    expect(sectionResponse.status()).toBe(201);
    const section = ((await sectionResponse.json()) as { section: { id: string } }).section;
    const taskResponse = await userRequest.post("/tasks", {
      data: { title: `Owned task ${suffix}`, projectId: subproject.id, sectionId: section.id },
    });
    expect(taskResponse.status()).toBe(201);
    const task = ((await taskResponse.json()) as { task: { id: string } }).task;
    const childTaskResponse = await userRequest.post("/tasks", {
      data: {
        title: `Owned child task ${suffix}`,
        parentId: task.id,
        projectId: subproject.id,
        sectionId: section.id,
      },
    });
    expect(childTaskResponse.status()).toBe(201);
    const inboxTaskResponse = await userRequest.post("/tasks", {
      data: { title: `Owned Inbox task ${suffix}` },
    });
    expect(inboxTaskResponse.status()).toBe(201);
    const detailsResponse = await userRequest.patch(`/tasks/${task.id}`, {
      data: {
        description: "Persisted task details",
        labels: ["owned-label"],
        comments: [
          { id: `comment-${suffix}`, body: "Persisted task comment", createdAt: new Date().toISOString() },
        ],
      },
    });
    expect(detailsResponse.ok()).toBe(true);
    const countResponse = await page.request.post("/tools-api/query", {
      data: {
        sql: `SELECT (SELECT count(*)::int FROM users WHERE id = '${userId}') AS users, (SELECT count(*)::int FROM sessions WHERE user_id = '${userId}') AS sessions, (SELECT count(*)::int FROM projects WHERE user_id = '${userId}') AS projects, (SELECT count(*)::int FROM sections WHERE user_id = '${userId}') AS sections, (SELECT count(*)::int FROM tasks WHERE user_id = '${userId}') AS tasks`,
      },
    });
    expect(countResponse.ok()).toBe(true);
    const countBody = (await countResponse.json()) as {
      rows: Array<{ users: number; sessions: number; projects: number; sections: number; tasks: number }>;
    };
    expect(countBody.rows[0]).toEqual({ users: 1, sessions: 1, projects: 2, sections: 1, tasks: 3 });

    const managedUser = page
      .locator(".managed-user")
      .filter({ has: page.locator(`input[value="${username}"]`) });
    await managedUser.getByRole("button", { name: "Delete" }).click();
    await expect(managedUser).toHaveCount(0);

    const remainingResponse = await page.request.post("/tools-api/query", {
      data: {
        sql: `SELECT (SELECT count(*)::int FROM users WHERE id = '${userId}') AS users, (SELECT count(*)::int FROM sessions WHERE user_id = '${userId}') AS sessions, (SELECT count(*)::int FROM projects WHERE user_id = '${userId}') AS projects, (SELECT count(*)::int FROM sections WHERE user_id = '${userId}') AS sections, (SELECT count(*)::int FROM tasks WHERE user_id = '${userId}') AS tasks`,
      },
    });
    expect(remainingResponse.ok()).toBe(true);
    const remainingBody = (await remainingResponse.json()) as {
      rows: Array<{ users: number; sessions: number; projects: number; sections: number; tasks: number }>;
    };
    expect(remainingBody.rows[0]).toEqual({ users: 0, sessions: 0, projects: 0, sections: 0, tasks: 0 });
    expect((await userRequest.get("/tasks")).status()).toBe(401);
  } finally {
    await userContext.close();
    const cleanupUsersResponse = await page.request.get("/users");
    if (cleanupUsersResponse.ok()) {
      const cleanupUsersBody = (await cleanupUsersResponse.json()) as {
        users: Array<{ id: string; username: string }>;
      };
      const cleanupUserId = userId ?? cleanupUsersBody.users.find((user) => user.username === username)?.id;
      if (cleanupUserId !== undefined) await page.request.delete(`/users/${cleanupUserId}`);
    }
  }
});
