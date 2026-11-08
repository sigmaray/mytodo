import { expect, test } from "./fixtures";

const localIsoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

test("month calendar stays readable on mobile and moves tasks between days", async ({ page }, testInfo) => {
  const request = page.request;
  const title = `Calendar task ${Date.now()}-${testInfo.workerIndex}`;
  const todayDate = new Date();
  const tomorrowDate = new Date(todayDate);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const today = localIsoDate(todayDate);
  const tomorrow = localIsoDate(tomorrowDate);
  const createdResponse = await request.post("/tasks", { data: { title, projectId: null, sectionId: null, parentId: null } });
  expect(createdResponse.ok()).toBe(true);
  const created = await createdResponse.json() as Readonly<{ task: Readonly<{ id: string }> }>;

  try {
    const datedResponse = await request.patch(`/tasks/${created.task.id}`, { data: { dueDate: today } });
    expect(datedResponse.ok()).toBe(true);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dates");
    await page.getByRole("button", { name: "Calendar" }).click();

    await expect(page.getByRole("columnheader")).toHaveText(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    await expect(page.getByRole("gridcell")).toHaveCount(42);
    await expect(page.getByRole("button", { name: "Today", exact: true })).toBeVisible();
    const todayNumber = page.locator('.dates-calendar-day.today [aria-current="date"]');
    await expect(todayNumber).toBeVisible();
    await expect.poll(() => todayNumber.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe("rgb(214, 54, 43)");
    await expect(page.locator(".dates-calendar-scroll").evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).resolves.toBe(true);

    const source = page.locator(`section[aria-label="Tasks for ${today}"]`);
    const destination = page.locator(`section[aria-label="Tasks for ${tomorrow}"]`);
    await expect(source.getByRole("button", { name: title, exact: true })).toBeVisible();
    await expect(source.getByText("Inbox")).toHaveCount(1);
    const viewportWidth = page.viewportSize()?.width ?? 0;
    const todayBox = await source.boundingBox();
    const taskBox = await source.getByRole("button", { name: title, exact: true }).boundingBox();
    expect(todayBox).not.toBeNull();
    expect(taskBox).not.toBeNull();
    expect(todayBox?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect((todayBox?.x ?? viewportWidth) + (todayBox?.width ?? 1)).toBeLessThanOrEqual(viewportWidth);
    expect(taskBox?.x ?? -1).toBeGreaterThanOrEqual(todayBox?.x ?? 0);
    expect((taskBox?.x ?? viewportWidth) + (taskBox?.width ?? 1)).toBeLessThanOrEqual((todayBox?.x ?? 0) + (todayBox?.width ?? viewportWidth));
    await source.getByRole("button", { name: title, exact: true }).evaluate((taskCard, target) => {
      const dateCell = document.querySelector<HTMLElement>(`section[aria-label="Tasks for ${target.date}"]`);
      if (dateCell === null) throw new Error("Calendar date cell not found");
      const dataTransfer = new DataTransfer();
      dataTransfer.setData("text/task-id", target.taskId);
      taskCard.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer }));
      dateCell.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer }));
      dateCell.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer }));
      taskCard.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer }));
    }, { date: tomorrow, taskId: created.task.id });
    await expect(destination.getByRole("button", { name: title, exact: true })).toBeVisible();
    await expect(source.getByRole("button", { name: title, exact: true })).toHaveCount(0);
  } finally {
    await request.delete(`/tasks/${created.task.id}`);
  }
});

test("Dates list tabs show only tasks in their date range", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const request = page.request;
  const suffix = `${Date.now()}-${testInfo.workerIndex}`;
  const todayDate = new Date();
  const yesterdayDate = new Date(todayDate);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const tomorrowDate = new Date(todayDate);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const taskCases = [
    { title: `Overdue filter ${suffix}`, dueDate: localIsoDate(yesterdayDate) },
    { title: `Today filter ${suffix}`, dueDate: localIsoDate(todayDate) },
    { title: `Upcoming filter ${suffix}`, dueDate: localIsoDate(tomorrowDate) },
    { title: `Undated filter ${suffix}`, dueDate: null }
  ] as const;
  const createdTaskIds: string[] = [];

  try {
    await page.goto("/");
    for (const taskCase of taskCases) {
      await page.getByRole("button", { name: "Add task Q" }).click();
      const addDialog = page.getByRole("dialog", { name: "Add task" });
      await addDialog.getByLabel("New task title").fill(taskCase.title);
      if (taskCase.dueDate !== null) {
        await addDialog.getByRole("button", { name: /Add date/ }).click();
        const dateDialog = page.getByRole("dialog", { name: "Add date" });
        await dateDialog.getByLabel("New task date").fill(taskCase.dueDate);
        await dateDialog.getByRole("button", { name: "Set date" }).click();
      }
      const responsePromise = page.waitForResponse((response) => response.url().endsWith("/tasks") && response.request().method() === "POST");
      await addDialog.getByRole("button", { name: "Add task", exact: true }).click();
      const response = await responsePromise;
      expect(response.ok()).toBe(true);
      const created = await response.json() as Readonly<{ task: Readonly<{ id: string }> }>;
      createdTaskIds.push(created.task.id);
      await expect(page.getByRole("button", { name: taskCase.title, exact: true })).toBeVisible();
    }

    const persistedResponse = await request.get("/tasks");
    expect(persistedResponse.ok()).toBe(true);
    const persisted = await persistedResponse.json() as Readonly<{ tasks: ReadonlyArray<Readonly<{ id: string; title: string; dueDate: string | null }>> }>;
    for (const [index, taskCase] of taskCases.entries()) {
      expect(persisted.tasks).toContainEqual(expect.objectContaining({ id: createdTaskIds[index], title: taskCase.title, dueDate: taskCase.dueDate }));
    }

    await page.getByRole("link", { name: "Dates" }).click();
    const datedTasks = page.getByLabel("Dates tasks");
    const taskButton = (title: string) => datedTasks.getByRole("button", { name: title, exact: true });
    const expectVisible = async (...titles: ReadonlyArray<string>) => {
      for (const title of titles) await expect(taskButton(title)).toBeVisible();
    };
    const expectHidden = async (...titles: ReadonlyArray<string>) => {
      for (const title of titles) await expect(taskButton(title)).toHaveCount(0);
    };
    const [overdue, today, upcoming, undated] = taskCases.map(({ title }) => title);

    await expectVisible(overdue, today, upcoming);
    await expectHidden(undated);

    await datedTasks.getByRole("button", { name: "Overdue", exact: true }).click();
    await expect(datedTasks.getByRole("button", { name: "Overdue", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expectVisible(overdue);
    await expectHidden(today, upcoming, undated);

    await datedTasks.getByRole("button", { name: "Today", exact: true }).click();
    await expect(datedTasks.getByRole("button", { name: "Today", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expectVisible(today);
    await expectHidden(overdue, upcoming, undated);

    await datedTasks.getByRole("button", { name: "Upcoming", exact: true }).click();
    await expect(datedTasks.getByRole("button", { name: "Upcoming", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expectVisible(upcoming);
    await expectHidden(overdue, today, undated);

    await datedTasks.getByRole("button", { name: "All", exact: true }).click();
    await expect(datedTasks.getByRole("button", { name: "All", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expectVisible(overdue, today, upcoming);
    await expectHidden(undated);
  } finally {
    await Promise.all(createdTaskIds.map((taskId) => request.delete(`/tasks/${taskId}`, { timeout: 10_000 })));
  }
});
