import { expect, test } from "./fixtures";
import { createE2eApi } from "./api";
import type { Page } from "@playwright/test";
import process from "node:process";

test.beforeEach(async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
});

test("shows task context actions in Inbox and projects", async ({ page }, testInfo) => {
  const inboxTitle = `Inbox context ${testInfo.workerIndex}-${Date.now()}`;
  const projectTitle = `Project context ${testInfo.workerIndex}-${Date.now()}`;
  const projectTaskTitle = `Project task ${testInfo.workerIndex}-${Date.now()}`;
  await page.goto("/");
  await createTask(page)(inboxTitle);

  const inboxRow = page.locator(".task-row").filter({ has: page.getByRole("button", { name: inboxTitle, exact: true }) });
  await inboxRow.click({ button: "right" });
  const inboxMenu = page.getByRole("menu", { name: `Task actions for ${inboxTitle}` });
  await expect(inboxMenu.getByRole("menuitem")).toHaveText(["Open", "Quick edit", "Add subtask", "Delete"]);
  await inboxMenu.getByRole("menuitem", { name: "Open" }).click();
  const details = page.getByRole("dialog", { name: `Task details: ${inboxTitle}` });
  await expect(details).toBeVisible();
  await details.getByRole("button", { name: "Close task details" }).click();

  await createProject(page)(projectTitle);
  await page.getByRole("button", { name: projectTitle, exact: true }).click();
  await createTask(page)(projectTaskTitle);
  const projectRow = page.locator(".task-row").filter({ has: page.getByRole("button", { name: projectTaskTitle, exact: true }) });
  await projectRow.click({ button: "right" });
  const projectMenu = page.getByRole("menu", { name: `Task actions for ${projectTaskTitle}` });
  await expect(projectMenu.getByRole("menuitem")).toHaveText(["Open", "Quick edit", "Add subtask", "Delete"]);
});

const createTask = (page: Page) => async (title: string) => {
  const projectId = await page.evaluate(() => new URLSearchParams(window.location.search).get("project"));
  await createE2eApi(page.request).createTask(title, { projectId });
  await page.reload();
  await expect(page.getByRole("button", { name: title, exact: true })).toBeVisible();
};

const createTasks = (page: Page) => async (titles: ReadonlyArray<string>) => {
  const projectId = await page.evaluate(() => new URLSearchParams(window.location.search).get("project"));
  const api = createE2eApi(page.request);
  for (const title of titles) await api.createTask(title, { projectId });
  await page.reload();
  await Promise.all(titles.map((title) => expect(page.getByRole("button", { name: title, exact: true })).toBeVisible()));
};

const createTaskThroughUi = (page: Page) => async (title: string) => {
  await page.getByRole("button", { name: "Add task Q" }).click();
  await expect(page.getByLabel("Initial task comment")).toHaveCount(0);
  await page.getByLabel("New task title").fill(title);
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(page.getByRole("button", { name: title, exact: true })).toBeVisible();
};

const createProject = (page: Page) => async (title: string) => {
  const created = await createE2eApi(page.request).createProject(title);
  await page.goto(`/?project=${encodeURIComponent(created.id)}`);
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
};

const createProjects = (page: Page) => async (titles: ReadonlyArray<string>) => {
  const api = createE2eApi(page.request);
  for (const title of titles) await api.createProject(title);
  await page.reload();
  await Promise.all(titles.map((title) => expect(page.getByRole("button", { name: title, exact: true })).toBeVisible()));
};

const createProjectThroughUi = (page: Page) => async (title: string) => {
  await page.getByRole("button", { name: "Add project" }).click();
  await page.getByLabel("Project title").fill(title);
  const createdResponse = page.waitForResponse((response) => response.url().endsWith("/projects") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  expect((await createdResponse).ok()).toBe(true);
};

test("Playwright API creates and clears individual data tables", async ({ page }, testInfo) => {
  const api = createE2eApi(page.request);
  const project = await api.createProject(`API project ${testInfo.workerIndex}-${Date.now()}`);
  const section = await api.createSection("API section", project.id);
  const task = await api.createTask("API task", { projectId: project.id, sectionId: section.id });
  await api.createComment(task.id, "Seeded comment");
  const attachment = await api.createAttachment(task.id, { name: "seed.txt", mimeType: "text/plain", buffer: Buffer.from("seed data") });

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
  await expect(page.getByRole("dialog", { name: `Task details: ${task.title}` }).locator(".task-comment")).toHaveCount(0);

  expect((await api.clearTable("tasks")).deleted).toBe(1);
  expect((await api.clearTable("sections")).deleted).toBe(1);
  expect((await api.clearTable("projects")).deleted).toBe(1);
});

test("moves a selected task group to a project with drag and drop", async ({ page }, testInfo) => {
  const sourceTitle = `Group source ${testInfo.workerIndex}-${Date.now()}`;
  const secondTitle = `Group second ${testInfo.workerIndex}-${Date.now()}`;
  const projectTitle = `Group destination ${testInfo.workerIndex}-${Date.now()}`;
  await page.goto("/");
  await createTasks(page)([sourceTitle, secondTitle]);
  await createProject(page)(projectTitle);

  await page.getByRole("button", { name: "Inbox", exact: true }).click();
  const sourceTitleButton = page.getByRole("button", { name: sourceTitle, exact: true });
  const titlePositionBefore = await sourceTitleButton.boundingBox();
  const selectTasksButton = page.getByRole("button", { name: "Select tasks" });
  await expect(selectTasksButton).toHaveClass(/btn-outline-secondary/);
  await expect(selectTasksButton.locator("svg")).toBeVisible();
  await selectTasksButton.click();
  await sourceTitleButton.click();
  await page.getByRole("button", { name: secondTitle, exact: true }).click();
  const sourceRow = page.locator(".task-row").filter({ has: page.getByRole("button", { name: sourceTitle, exact: true }) });
  const titlePositionAfter = await sourceTitleButton.boundingBox();
  expect(titlePositionBefore?.x).toBe(titlePositionAfter?.x);
  expect(await sourceRow.locator(".task-action").evaluateAll((actions) => actions.every((action) => getComputedStyle(action).visibility === "hidden"))).toBe(true);
  await expect(sourceRow.locator("input[type='checkbox']")).toBeHidden();
  await sourceRow.dragTo(page.locator(".project-nav-row").filter({ has: page.getByRole("button", { name: projectTitle, exact: true }) }).getByRole("button", { name: projectTitle, exact: true }));

  await expect(page.getByRole("button", { name: sourceTitle, exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: secondTitle, exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: projectTitle, exact: true }).click();
  await expect(page.getByRole("button", { name: sourceTitle, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: secondTitle, exact: true })).toBeVisible();
});

test("toggles task selection with S in any layout and exits with Escape", async ({ page }, testInfo) => {
  const title = `Selection shortcut ${testInfo.workerIndex}-${Date.now()}`;
  await page.goto("/");
  await createTask(page)(title);
  const row = page.locator(".task-row").filter({ has: page.getByRole("button", { name: title, exact: true }) });

  await page.evaluate(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "ы", code: "KeyS", bubbles: true })));
  await expect(row).toHaveClass(/selection-mode/);
  await page.keyboard.press("Escape");
  await expect(row).not.toHaveClass(/selection-mode/);
});

const dragProjectTo = (page: Page) => async (sourceTitle: string, targetTitle: string, yRatio: number) => {
  await page.locator(".project-nav-row").filter({ has: page.getByRole("button", { name: sourceTitle, exact: true }) }).evaluate((source, data) => {
    const target = [...document.querySelectorAll<HTMLElement>(".project-nav-row")].find((row) => row.querySelector("button.nav-button")?.textContent?.trim() === data.targetTitle);
    if (!target) throw new Error("Project target not found");
    const rect = target.getBoundingClientRect();
    const y = rect.top + rect.height * data.yRatio;
    const transfer = new DataTransfer();
    transfer.setData("application/x-project-id", source.getAttribute("data-project-id") ?? "");
    source.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: transfer }));
    target.dispatchEvent(new DragEvent("dragenter", { bubbles: true, dataTransfer: transfer, clientY: y }));
    target.dispatchEvent(new DragEvent("dragover", { bubbles: true, dataTransfer: transfer, clientY: y }));
    target.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer: transfer, clientY: y }));
    source.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: transfer }));
  }, { targetTitle, yRatio });
};
const dragProjectWithMouse = (page: Page) => async (sourceTitle: string, targetTitle: string, yRatio: number) => {
  const source = page.locator(".project-nav-row").filter({ has: page.getByRole("button", { name: sourceTitle, exact: true }) });
  const target = page.locator(".project-nav-row").filter({ has: page.getByRole("button", { name: targetTitle, exact: true }) });
  const box = await target.boundingBox();
  if (!box) throw new Error("Project target is not visible");
  await source.dragTo(target, { targetPosition: { x: Math.max(8, Math.min(box.width - 8, box.width / 2)), y: Math.max(2, Math.min(box.height - 2, box.height * yRatio)) } });
};

const showProjectDropIndicator = (page: Page) => async (sourceTitle: string, targetTitle: string, yRatio: number) => {
  await page.locator(".project-nav-row").filter({ has: page.getByRole("button", { name: sourceTitle, exact: true }) }).evaluate((source, data) => {
    const target = [...document.querySelectorAll<HTMLElement>(".project-nav-row")].find((row) => row.querySelector("button.nav-button")?.textContent?.trim() === data.targetTitle);
    if (!target) throw new Error("Project target not found");
    const rect = target.getBoundingClientRect();
    const transfer = new DataTransfer();
    transfer.setData("application/x-project-id", source.getAttribute("data-project-id") ?? "");
    const y = rect.top + rect.height * data.yRatio;
    source.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: transfer }));
    target.dispatchEvent(new DragEvent("dragover", { bubbles: true, dataTransfer: transfer, clientY: y }));
    const child = target.querySelector("button.nav-button");
    child?.dispatchEvent(new DragEvent("dragleave", { bubbles: true, dataTransfer: transfer, relatedTarget: target }));
  }, { targetTitle, yRatio });
};

const createSection = (page: Page) => async (title: string) => {
  await page.getByRole("button", { name: "Add section" }).click();
  await page.getByLabel("Section title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
};

const dragTaskOntoTask = (page: Page) => async (sourceTitle: string, targetTitle: string) => {
  await page.getByRole("button", { name: sourceTitle, exact: true }).evaluate(
    (sourceElement, target) => {
      const sourceRow = sourceElement.closest(".task-row");
      const targetRow = [...document.querySelectorAll(".task-row")]
        .find((row) => row.textContent?.includes(target));
      const taskId = sourceRow?.getAttribute("data-task-id") ?? null;
      const dataTransfer = new DataTransfer();

      if (targetRow === undefined || taskId === null) {
        throw new Error("Unable to drag task");
      }

      const rect = targetRow.getBoundingClientRect();
      const middleY = rect.top + rect.height / 2;
      const middleX = rect.left + Math.max(48, rect.width / 3);

      dataTransfer.setData("text/task-id", taskId);
      sourceRow?.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer, clientX: middleX, clientY: middleY }));
      targetRow.dispatchEvent(new DragEvent("dragenter", { bubbles: true, dataTransfer, clientX: middleX, clientY: middleY }));
      targetRow.dispatchEvent(new DragEvent("dragover", { bubbles: true, dataTransfer, clientX: middleX, clientY: middleY }));
      targetRow.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer, clientX: middleX, clientY: middleY }));
      sourceRow?.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer, clientX: middleX, clientY: middleY }));
    },
    targetTitle
  );
};

const dragTaskBeforeTask = (page: Page) => async (sourceTitle: string, targetTitle: string) => {
  await page.getByRole("button", { name: sourceTitle, exact: true }).evaluate(
    (sourceElement, target) => {
      const sourceRow = sourceElement.closest(".task-row");
      const targetRow = [...document.querySelectorAll(".task-row")]
        .find((row) => row.textContent?.includes(target));
      const taskId = sourceRow?.getAttribute("data-task-id") ?? null;
      const dataTransfer = new DataTransfer();

      if (targetRow === undefined || taskId === null) {
        throw new Error("Unable to reorder task");
      }

      const rect = targetRow.getBoundingClientRect();
      const topY = rect.top + Math.max(1, rect.height * 0.1);
      const middleX = rect.left + Math.max(48, rect.width / 3);

      dataTransfer.setData("text/task-id", taskId);
      sourceRow?.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer, clientX: middleX, clientY: topY }));
      targetRow.dispatchEvent(new DragEvent("dragenter", { bubbles: true, dataTransfer, clientX: middleX, clientY: topY }));
      targetRow.dispatchEvent(new DragEvent("dragover", { bubbles: true, dataTransfer, clientX: middleX, clientY: topY }));
      targetRow.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer, clientX: middleX, clientY: topY }));
      sourceRow?.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer, clientX: middleX, clientY: topY }));
    },
    targetTitle
  );
};

const dragTaskOverProject = (page: Page) => async (sourceTitle: string, projectTitle: string) => {
  await page.getByRole("button", { name: sourceTitle, exact: true }).evaluate(
    (sourceElement, title) => {
      const sourceRow = sourceElement.closest(".task-row");
      const projectButton = [...document.querySelectorAll(".project-nav-row > button.nav-button")]
        .find((button) => button.textContent?.trim() === title);
      const taskId = sourceRow?.getAttribute("data-task-id") ?? null;
      const dataTransfer = new DataTransfer();

      if (projectButton === undefined || taskId === null) {
        throw new Error("Unable to drag task over project");
      }

      dataTransfer.setData("text/task-id", taskId);
      sourceRow?.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer }));
      projectButton.dispatchEvent(new DragEvent("dragenter", { bubbles: true, dataTransfer }));
      projectButton.dispatchEvent(new DragEvent("dragover", { bubbles: true, dataTransfer }));
    },
    projectTitle
  );
};

const dragTaskLeftOnItself = (page: Page) => async (title: string) => {
  await page.getByRole("button", { name: title, exact: true }).evaluate((sourceElement) => {
    const sourceRow = sourceElement.closest<HTMLElement>(".task-row");
    const taskId = sourceRow?.getAttribute("data-task-id") ?? null;
    if (sourceRow === null) throw new Error("Unable to find task row");
    const rect = sourceRow.getBoundingClientRect();
    const dataTransfer = new DataTransfer();

    if (taskId === null) {
      throw new Error("Unable to drag task left");
    }

    dataTransfer.setData("text/task-id", taskId);
    sourceRow.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer, clientX: rect.left }));
    sourceRow.dispatchEvent(new DragEvent("dragenter", { bubbles: true, dataTransfer, clientX: rect.left - 40 }));
    sourceRow.dispatchEvent(new DragEvent("dragover", { bubbles: true, dataTransfer, clientX: rect.left - 40 }));
    sourceRow.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer, clientX: rect.left - 40 }));
    sourceRow.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer, clientX: rect.left - 40 }));
  });
};

const dragTaskToRegion = (page: Page) => async (sourceTitle: string, regionLabel: string) => {
  await page.getByRole("button", { name: sourceTitle, exact: true }).evaluate(
    (sourceElement, label) => {
      const sourceRow = sourceElement.closest(".task-row");
      const region = [...document.querySelectorAll("[aria-label]")]
        .find((element) => element.getAttribute("aria-label") === label);
      const taskId = sourceRow?.getAttribute("data-task-id") ?? null;
      const dataTransfer = new DataTransfer();

      if (region === undefined || taskId === null) {
        throw new Error("Unable to drag task to region");
      }

      dataTransfer.setData("text/task-id", taskId);
      sourceRow?.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer }));
      region.dispatchEvent(new DragEvent("dragover", { bubbles: true, dataTransfer }));
      region.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer }));
      sourceRow?.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer }));
    },
    regionLabel
  );
};

test("creates a task in the browser", async ({ page }, testInfo) => {
  const title = `Write the first MVP task ${testInfo.retry}-${Date.now()}`;
  const editedTitle = `Write the first persistent MVP task ${testInfo.retry}-${Date.now()}`;

  await page.goto("/");

  await createTaskThroughUi(page)(title);

  await expect(page.getByText(title)).toBeVisible();
  await expect(page.getByRole("button", { name: `Edit task ${title}` })).toHaveCSS("opacity", "1");

  await page.getByRole("button", { name: `Edit task ${title}` }).click();
  await page.getByLabel(`Edit ${title}`).fill(editedTitle);
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByText(editedTitle)).toBeVisible();

  await page.getByRole("button", { name: `Delete task ${editedTitle}` }).click();

  await expect(page.getByText(editedTitle)).not.toBeVisible();
});

test("adapts task details to a small mobile viewport", async ({ page }, testInfo) => {
  const title = `Mobile task details with a long wrapping title ${testInfo.workerIndex}-${Date.now()}`;
  await page.goto("/");
  await createTask(page)(title);
  await page.setViewportSize({ width: 360, height: 640 });
  await page.getByRole("button", { name: title, exact: true }).click();

  const dialog = page.getByRole("dialog", { name: `Task details: ${title}` });
  const bounds = await dialog.boundingBox();
  if (bounds === null) throw new Error("Task details dialog must be visible");
  expect(bounds.x).toBe(0);
  expect(bounds.y).toBe(0);
  expect(bounds.width).toBe(360);
  expect(bounds.height).toBe(640);
  await expect(dialog.getByRole("button", { name: "Close task details" })).toHaveCSS("min-height", "42px");
  await expect(dialog.getByRole("button", { name: "Edit task title" })).toHaveCSS("white-space", "pre-wrap");

  const layout = dialog.locator(".task-details-layout");
  expect(await layout.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await expect(dialog.locator(".task-subtasks-card")).toBeHidden();
  await dialog.getByRole("button", { name: "Subtasks" }).click();
  await expect(dialog.locator(".task-subtasks-card")).toBeVisible();
  await expect(dialog.getByLabel("New subtask title")).toBeFocused();
  const subtaskTitle = `Visible mobile subtask ${testInfo.workerIndex}-${Date.now()}`;
  await dialog.getByLabel("New subtask title").fill(subtaskTitle);
  await dialog.locator(".details-subtask-add").getByRole("button", { name: "Add", exact: true }).click();
  await expect(dialog.getByRole("button", { name: subtaskTitle, exact: true })).toBeVisible();
  expect(await dialog.locator(".task-subtasks-card").evaluate((card) => {
    const cardRect = card.getBoundingClientRect();
    const bodyRect = card.querySelector(".task-subtasks-body")?.getBoundingClientRect();
    return bodyRect !== undefined && bodyRect !== null && bodyRect.bottom <= cardRect.bottom;
  })).toBe(true);
  const metadataTop = await dialog.locator(".task-details-sidebar").evaluate((element) => element.getBoundingClientRect().top);
  const subtasksTop = await dialog.locator(".task-subtasks-card").evaluate((element) => element.getBoundingClientRect().top);
  expect(metadataTop).toBeLessThan(subtasksTop);

  await dialog.getByLabel("Project, section, or Inbox").scrollIntoViewIfNeeded();
  await expect(dialog.getByLabel("Project, section, or Inbox")).toBeVisible();
  await expect(dialog.locator(".task-comments")).toBeHidden();
  await expect(dialog.getByRole("button", { name: "Labels" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Comments" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Date" })).toBeVisible();
  await dialog.getByRole("button", { name: "Labels" }).click();
  await expect(dialog.getByRole("textbox", { name: "Labels" })).toBeFocused();
  await dialog.getByRole("button", { name: "Comments" }).click();
  await expect(dialog.locator(".task-comments")).toBeVisible();
  await expect(dialog.getByLabel("Add comment")).toBeFocused();
  expect(await dialog.locator(".task-comments").evaluate((comments) => {
    const button = comments.querySelector<HTMLElement>(".btn-primary");
    const formCard = comments.querySelector<HTMLElement>(".card");
    return button !== null && formCard !== null && button.getBoundingClientRect().width >= formCard.getBoundingClientRect().width - 34;
  })).toBe(true);
  await dialog.getByRole("button", { name: "Date" }).click();
  const dateDialog = dialog.getByRole("dialog", { name: "Add date" });
  await expect(dateDialog).toBeVisible();
  await expect(dateDialog.getByLabel("New date")).toBeFocused();
});

test("adapts the Add date picker to a small mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Add task Q" }).click();
  const addTaskDialog = page.getByRole("dialog", { name: "Add task" });
  await addTaskDialog.getByRole("button", { name: /Add date/ }).click();

  const dateDialog = page.getByRole("dialog", { name: "Add date" });
  const backdrop = page.locator(".task-date-picker-backdrop");
  await expect(dateDialog).toBeVisible();
  expect(await backdrop.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.x === 0 && rect.y === 0 && rect.width === 320 && rect.height === 568;
  })).toBe(true);
  expect(await dateDialog.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.left === 0 && rect.right === 320 && rect.bottom === 568 && element.scrollWidth <= element.clientWidth;
  })).toBe(true);

  const today = dateDialog.getByRole("button", { name: "Today" });
  const tomorrow = dateDialog.getByRole("button", { name: "Tomorrow" });
  const quickDateLayout = await Promise.all([today.boundingBox(), tomorrow.boundingBox()]);
  if (quickDateLayout.some((box) => box === null)) throw new Error("Quick date buttons must be visible");
  expect(quickDateLayout[0]?.y).toBe(quickDateLayout[1]?.y);
  expect(quickDateLayout[0]?.height).toBeGreaterThanOrEqual(44);
  await expect(dateDialog.locator('[aria-current="date"]')).toBeVisible();
  expect(await dateDialog.locator(".date-picker-grid").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);

  await tomorrow.click();
  const expectedTomorrow = new Date();
  expectedTomorrow.setDate(expectedTomorrow.getDate() + 1);
  await expect(dateDialog.getByLabel("New task date")).toHaveValue(expectedTomorrow.toLocaleDateString("en-CA"));
  await expect(dateDialog).toBeVisible();
  await dateDialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dateDialog).toHaveCount(0);
  await expect(addTaskDialog).toBeVisible();
});

test("keeps optional Add task fields collapsed on mobile until requested", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  try {
    await page.goto("/");
    await page.getByLabel("Login").fill("admin");
    await page.getByLabel("Password").fill("todoist-e2e-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    const quickAdd = page.getByRole("button", { name: "Quick add task" });
    await expect(quickAdd).toBeVisible();
    const quickAddBounds = await quickAdd.boundingBox();
    if (quickAddBounds === null) throw new Error("Mobile quick-add button must be visible");
    expect(quickAddBounds.x + quickAddBounds.width).toBeLessThanOrEqual(360);
    expect(quickAddBounds.y + quickAddBounds.height).toBeLessThanOrEqual(640);
    await quickAdd.click();
    const dialog = page.getByRole("dialog", { name: "Add task" });
    const shortcuts = dialog.locator(".add-task-mobile-shortcuts");

    await expect(dialog.getByLabel("New task description")).toBeHidden();
    await shortcuts.getByRole("button", { name: "Description" }).click();
    await expect(dialog.getByLabel("New task description")).toBeFocused();
    await dialog.getByRole("button", { name: "Clear description and hide section" }).click();
    await expect(shortcuts.getByRole("button", { name: "Description" })).toBeVisible();

    await shortcuts.getByRole("button", { name: "Labels" }).click();
    await expect(dialog.getByLabel("New task labels")).toBeFocused();
    await dialog.getByRole("button", { name: "Remove labels and hide section" }).click();
    await expect(shortcuts.getByRole("button", { name: "Labels" })).toBeVisible();

    await shortcuts.getByRole("button", { name: "Date", exact: true }).click({ timeout: 5000 });
    const dateDialog = dialog.getByRole("dialog", { name: "Add date" });
    await expect(dateDialog).toBeVisible();
    await expect(dateDialog.getByLabel("New task date")).toBeFocused();
  } finally {
    await context.close().catch(() => undefined);
  }
});

test("does not show mobile Add task shortcuts in the desktop dialog", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Add task Q" }).click();
  const dialog = page.getByRole("dialog", { name: "Add task" });
  await expect(dialog.locator(".add-task-mobile-shortcuts")).toBeHidden();
  await expect(dialog.getByLabel("New task description")).toBeVisible();
  await expect(dialog.getByLabel("Add task project")).toBeVisible();
  await expect(dialog.getByLabel("New task labels")).toBeVisible();
});

test("shows truncated descriptions and comment counts in task rows", async ({ page }, testInfo) => {
  const title = `Task row details ${testInfo.workerIndex}-${Date.now()}`;
  const description = Array.from({ length: 24 }, () => "A long task description").join(" ");
  await page.goto("/");
  await page.getByRole("button", { name: "Add task Q" }).click();
  const addTaskDialog = page.getByRole("dialog", { name: "Add task" });
  await addTaskDialog.getByLabel("New task title").fill(title);
  await addTaskDialog.getByLabel("New task description").fill(description);
  await addTaskDialog.getByRole("button", { name: "Add task", exact: true }).click();

  const row = page.locator(".task-row").filter({ has: page.getByRole("button", { name: title, exact: true }) });
  const descriptionPreview = row.locator(".task-description-preview");
  await expect(descriptionPreview).toHaveText(description);
  await expect(descriptionPreview).toHaveCSS("text-overflow", "ellipsis");
  await expect(descriptionPreview).toHaveCSS("white-space", "nowrap");
  expect(await descriptionPreview.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);

  await row.getByRole("button", { name: title, exact: true }).click();
  const taskDialog = page.getByRole("dialog", { name: `Task details: ${title}` });
  for (const [index, comment] of ["First row comment", "Second row comment"].entries()) {
    if (index > 0) await row.getByRole("button", { name: title, exact: true }).click();
    await taskDialog.getByLabel("Add comment").fill(comment);
    await expect(taskDialog.getByRole("button", { name: "Add comment" })).toBeEnabled();
    await taskDialog.getByRole("button", { name: "Add comment" }).click();
    await expect(taskDialog.getByText(comment)).toBeVisible();
    await expect(taskDialog.locator(".comment-markdown")).toHaveCSS("text-align", "left");
    if (index === 0) await taskDialog.getByRole("button", { name: "Close task details" }).click();
  }
  await taskDialog.getByRole("button", { name: "Close task details" }).click();
  await expect(row.getByLabel("2 comments")).toContainText("2");
  await row.getByRole("button", { name: title, exact: true }).click();
  const comments = taskDialog.locator(".task-comment");
  await comments.nth(0).getByRole("button", { name: "Edit", exact: true }).click();
  await expect(comments.nth(0).locator("textarea")).toBeFocused();
  await comments.nth(0).locator("textarea").fill("Edited first comment");
  await comments.nth(0).getByRole("button", { name: "Save comment" }).click();
  await expect(comments.nth(0)).toContainText("Edited first comment");
  await comments.nth(1).getByRole("button", { name: "Delete", exact: true }).click();
  await expect(comments).toHaveCount(1);
  await expect(comments.first()).toContainText("Edited first comment");
});

test("saves comment attachments on submit and serves them through the authenticated API", async ({ page }, testInfo) => {
  test.setTimeout(60000);
  const title = `Attachment comment ${testInfo.workerIndex}-${Date.now()}`;
  await page.goto("/");
  await createTask(page)(title);
  await page.getByRole("button", { name: title, exact: true }).click();
  const dialog = page.getByRole("dialog", { name: `Task details: ${title}` });
  await page.evaluate(() => {
    const clipboardFiles = new DataTransfer();
    clipboardFiles.items.add(new File(["Pasted attachment"], "pasted.txt", { type: "text/plain" }));
    document.body.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: clipboardFiles }));
  });
  await expect(page.getByText("Файл «pasted.txt» прикреплён", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("link", { name: /pasted.txt/ })).toBeVisible();
  await dialog.getByLabel("Add comment").fill("Read **the notes**");
  await dialog.getByLabel("Attach files to comment").setInputFiles({ name: "notes.md", mimeType: "text/markdown", buffer: Buffer.from("# Notes") });
  await expect(page.getByText("Файл «notes.md» прикреплён", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Add comment" }).click();
  await expect(dialog.locator(".comment-markdown strong")).toHaveText("the notes");
  const attachmentLink = dialog.getByRole("link", { name: /notes.md/ });
  await expect(attachmentLink).toBeVisible();
  const attachmentPath = await attachmentLink.getAttribute("href");
  expect(attachmentPath).toMatch(/^\/attachments\//);
  const row = page.locator(".task-row").filter({ has: page.getByRole("button", { name: title, exact: true }) });
  await expect(row.getByLabel("Task has attachments")).toBeVisible();
  await dialog.getByRole("button", { name: "Close task details" }).click();
  await page.getByRole("link", { name: "Attachments", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Attachments" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Attachments" })).toBeVisible();
  const pastedAttachmentRow = page.locator(".attachment-library-item").filter({ hasText: title }).filter({ hasText: "pasted.txt" });
  await expect(pastedAttachmentRow.getByRole("link", { name: "pasted.txt" })).toBeVisible();
  await expect(page.getByRole("link", { name: /notes\.md/ }).first()).toBeVisible();
  await expect(pastedAttachmentRow.getByRole("link", { name: title, exact: true })).toBeVisible();
  await expect(pastedAttachmentRow.getByText("17 B", { exact: true })).toBeVisible();
  await pastedAttachmentRow.getByRole("link", { name: title, exact: true }).click();
  const reopenedDialog = page.getByRole("dialog", { name: `Task details: ${title}` });
  await expect(reopenedDialog.getByRole("button", { name: "Remove attachment pasted.txt" })).toBeVisible();
  await reopenedDialog.getByRole("button", { name: "Remove attachment pasted.txt" }).click();
  await expect(reopenedDialog.getByRole("link", { name: /pasted\.txt/ })).toHaveCount(0);
  await expect(reopenedDialog.getByRole("link", { name: /notes\.md/ })).toBeVisible();
  await attachmentLink.locator("..").getByRole("button", { name: "Preview" }).click();
  await expect(dialog.getByLabel("Preview notes.md").locator("pre")).toHaveText("# Notes");
  const backendPort = process.env.E2E_BACKEND_PORT ?? "3100";
  const response = await page.request.get(`http://127.0.0.1:${backendPort}${attachmentPath}`);
  expect(response.ok()).toBe(true);
  expect(await response.text()).toBe("# Notes");
});

test("adds, suggests, and removes labels with the shared label picker", async ({ page }, testInfo) => {
  const sourceTitle = `Label source ${testInfo.workerIndex}-${Date.now()}`;
  const targetTitle = `Label target ${testInfo.workerIndex}-${Date.now()}`;
  await page.goto("/");
  await page.getByRole("button", { name: "Add task Q" }).click();
  const addTaskDialog = page.getByRole("dialog", { name: "Add task" });
  await addTaskDialog.getByLabel("New task title").fill(sourceTitle);
  await addTaskDialog.getByLabel("New task labels").fill("shared");
  await addTaskDialog.getByLabel("New task labels").press("Enter");
  await expect(addTaskDialog.locator(".label-picker-chip")).toContainText("shared");
  await addTaskDialog.getByRole("button", { name: "Add task", exact: true }).click();

  await createTask(page)(targetTitle);
  await page.getByRole("button", { name: targetTitle, exact: true }).click();
  const taskDialog = page.getByRole("dialog", { name: `Task details: ${targetTitle}` });
  const labelInput = taskDialog.getByRole("textbox", { name: "Labels" });
  await labelInput.click();
  await taskDialog.getByRole("option", { name: "shared", exact: true }).click();
  await expect(taskDialog.locator(".label-picker-chip")).toContainText("shared");
  await taskDialog.getByRole("button", { name: "Remove label shared" }).click();
  await expect(taskDialog.locator(".label-picker-chip")).toHaveCount(0);
  await labelInput.fill("custom");
  await labelInput.press("Enter");
  await expect(taskDialog.locator(".label-picker-chip")).toContainText("custom");
  await labelInput.fill("discarded");
  await labelInput.press("Escape");
  await expect(labelInput).toHaveValue("");
  await expect(taskDialog).toBeVisible();
});

test("opens settings with deletion confirmation enabled by default", async ({ page }) => {
  await page.goto("/settings");

  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /Ask for confirmation before deleting/ })).toBeChecked();
  await expect(page.getByRole("heading", { name: "Your account" })).toBeVisible();
  await expect(page.getByLabel("Username")).toHaveValue("admin");
  await expect(page.getByRole("heading", { name: "Users" })).toHaveCount(0);
  await expect(page.getByText(/Set the initial administrator password with the backend CLI/)).toHaveCount(0);
});

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

test("deleting a user from User management removes all of their database records", async ({ page, browser }, testInfo) => {
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
    const usersBody = await usersResponse.json() as Readonly<{ users: ReadonlyArray<Readonly<{ id: string; username: string }>> }>;
    userId = usersBody.users.find((user) => user.username === username)?.id;
    expect(userId).toBeDefined();
    if (userId === undefined) throw new Error("Created user was not returned by the admin API");
    expect(userId).toMatch(/^[0-9a-f-]{36}$/i);

    const userRequest = userContext.request;
    const loginResponse = await userRequest.post("/auth/login", { data: { username, password } });
    expect(loginResponse.ok()).toBe(true);

    const projectResponse = await userRequest.post("/projects", { data: { title: `Owned project ${suffix}` } });
    expect(projectResponse.status()).toBe(201);
    const project = (await projectResponse.json() as Readonly<{ project: Readonly<{ id: string }> }>).project;
    const subprojectResponse = await userRequest.post("/projects", { data: { title: `Owned subproject ${suffix}`, parentId: project.id } });
    expect(subprojectResponse.status()).toBe(201);
    const subproject = (await subprojectResponse.json() as Readonly<{ project: Readonly<{ id: string }> }>).project;

    const sectionResponse = await userRequest.post("/sections", { data: { title: `Owned section ${suffix}`, projectId: subproject.id } });
    expect(sectionResponse.status()).toBe(201);
    const section = (await sectionResponse.json() as Readonly<{ section: Readonly<{ id: string }> }>).section;
    const taskResponse = await userRequest.post("/tasks", { data: { title: `Owned task ${suffix}`, projectId: subproject.id, sectionId: section.id } });
    expect(taskResponse.status()).toBe(201);
    const task = (await taskResponse.json() as Readonly<{ task: Readonly<{ id: string }> }>).task;
    const childTaskResponse = await userRequest.post("/tasks", { data: { title: `Owned child task ${suffix}`, parentId: task.id, projectId: subproject.id, sectionId: section.id } });
    expect(childTaskResponse.status()).toBe(201);
    const inboxTaskResponse = await userRequest.post("/tasks", { data: { title: `Owned Inbox task ${suffix}` } });
    expect(inboxTaskResponse.status()).toBe(201);
    const detailsResponse = await userRequest.patch(`/tasks/${task.id}`, {
      data: {
        description: "Persisted task details",
        labels: ["owned-label"],
        comments: [{ id: `comment-${suffix}`, body: "Persisted task comment", createdAt: new Date().toISOString() }]
      }
    });
    expect(detailsResponse.ok()).toBe(true);
    const countResponse = await page.request.post("/tools-api/query", {
      data: {
        sql: `SELECT (SELECT count(*)::int FROM users WHERE id = '${userId}') AS users, (SELECT count(*)::int FROM sessions WHERE user_id = '${userId}') AS sessions, (SELECT count(*)::int FROM projects WHERE user_id = '${userId}') AS projects, (SELECT count(*)::int FROM sections WHERE user_id = '${userId}') AS sections, (SELECT count(*)::int FROM tasks WHERE user_id = '${userId}') AS tasks`
      }
    });
    expect(countResponse.ok()).toBe(true);
    const countBody = await countResponse.json() as Readonly<{ rows: ReadonlyArray<Readonly<{ users: number; sessions: number; projects: number; sections: number; tasks: number }>> }>;
    expect(countBody.rows[0]).toEqual({ users: 1, sessions: 1, projects: 2, sections: 1, tasks: 3 });

    const managedUser = page.locator(".managed-user").filter({ has: page.locator(`input[value="${username}"]`) });
    await managedUser.getByRole("button", { name: "Delete" }).click();
    await expect(managedUser).toHaveCount(0);

    const remainingResponse = await page.request.post("/tools-api/query", {
      data: {
        sql: `SELECT (SELECT count(*)::int FROM users WHERE id = '${userId}') AS users, (SELECT count(*)::int FROM sessions WHERE user_id = '${userId}') AS sessions, (SELECT count(*)::int FROM projects WHERE user_id = '${userId}') AS projects, (SELECT count(*)::int FROM sections WHERE user_id = '${userId}') AS sections, (SELECT count(*)::int FROM tasks WHERE user_id = '${userId}') AS tasks`
      }
    });
    expect(remainingResponse.ok()).toBe(true);
    const remainingBody = await remainingResponse.json() as Readonly<{ rows: ReadonlyArray<Readonly<{ users: number; sessions: number; projects: number; sections: number; tasks: number }>> }>;
    expect(remainingBody.rows[0]).toEqual({ users: 0, sessions: 0, projects: 0, sections: 0, tasks: 0 });
    expect((await userRequest.get("/tasks")).status()).toBe(401);
  } finally {
    await userContext.close();
    const cleanupUsersResponse = await page.request.get("/users");
    if (cleanupUsersResponse.ok()) {
      const cleanupUsersBody = await cleanupUsersResponse.json() as Readonly<{ users: ReadonlyArray<Readonly<{ id: string; username: string }>> }>;
      const cleanupUserId = userId ?? cleanupUsersBody.users.find((user) => user.username === username)?.id;
      if (cleanupUserId !== undefined) await page.request.delete(`/users/${cleanupUserId}`);
    }
  }
});

test("adds tasks directly to sections and deletes all tasks within Inbox or a project", async ({ page }, testInfo) => {
  const suffix = `${testInfo.workerIndex}-${Date.now()}`;
  const inboxSection = `Inbox section ${suffix}`;
  const inboxTask = `Inbox scoped task ${suffix}`;
  const inboxSectionTask = `Inbox section task ${suffix}`;
  const project = `Scoped project ${suffix}`;
  const projectSection = `Project section ${suffix}`;
  const projectTask = `Project scoped task ${suffix}`;
  const projectSectionTask = `Project section task ${suffix}`;

  await page.goto("/");
  await page.getByLabel("Inbox tasks").getByRole("button", { name: "Add task to Inbox" }).click();
  const inboxRootDialog = page.getByRole("dialog", { name: "Add task" });
  await expect(inboxRootDialog.getByLabel("Add task project")).toHaveValue("inbox");
  await inboxRootDialog.getByLabel("New task title").fill(inboxTask);
  await inboxRootDialog.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(inboxRootDialog).not.toBeVisible();
  await createSection(page)(inboxSection);
  const inboxSectionRegion = page.getByLabel(`Section ${inboxSection}`);
  await inboxSectionRegion.getByRole("button", { name: `Add task to section ${inboxSection}` }).click();
  const inboxSectionDialog = page.getByRole("dialog", { name: "Add task" });
  await expect(inboxSectionDialog.getByLabel("Add task project")).toHaveValue(/^section:/);
  await inboxSectionDialog.getByLabel("New task title").fill(inboxSectionTask);
  await inboxSectionDialog.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(inboxSectionRegion.getByText(inboxSectionTask)).toBeVisible();
  await expect(inboxSectionDialog).not.toBeVisible();

  await createProject(page)(project);
  await createSection(page)(projectSection);
  await page.getByLabel(`${project} tasks`).getByRole("button", { name: `Add task to ${project}` }).click();
  const projectRootDialog = page.getByRole("dialog", { name: "Add task" });
  await expect(projectRootDialog.getByLabel("Add task project")).toHaveValue(/^project:/);
  await projectRootDialog.getByLabel("New task title").fill(projectTask);
  await projectRootDialog.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(projectRootDialog).not.toBeVisible();
  const projectSectionRegion = page.getByLabel(`Section ${projectSection}`);
  await projectSectionRegion.getByRole("button", { name: `Add task to section ${projectSection}` }).click();
  const projectSectionDialog = page.getByRole("dialog", { name: "Add task" });
  await expect(projectSectionDialog.getByLabel("Add task project")).toHaveValue(/^section:/);
  await expect(projectSectionDialog.getByLabel("Add task project").locator("option", { hasText: `${project} / ${projectSection}` })).toHaveCount(1);
  await projectSectionDialog.getByLabel("New task title").fill(projectSectionTask);
  await projectSectionDialog.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(projectSectionRegion.getByText(projectSectionTask)).toBeVisible();

  await page.getByRole("button", { name: "Delete all tasks" }).click();
  await expect(page.getByRole("button", { name: projectTask, exact: true })).not.toBeVisible();
  await expect(page.getByRole("button", { name: projectSectionTask, exact: true })).not.toBeVisible();
  await page.getByRole("button", { name: "Inbox", exact: true }).click();
  await expect(page.getByRole("button", { name: inboxTask, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Delete all tasks" }).click();
  await expect(page.getByRole("button", { name: inboxTask, exact: true })).not.toBeVisible();
  await expect(page.getByRole("button", { name: inboxSectionTask, exact: true })).not.toBeVisible();
});

test("creates projects, sections, subtasks, and exports markdown", async ({ context, page }, testInfo) => {
  const suffix = `${testInfo.workerIndex}-${Date.now()}`;
  const projectTitle = `Roadmap ${suffix}`;
  const sectionTitle = `Someday ${suffix}`;
  const projectTask = `Define project milestones ${suffix}`;
  const subtask = `Write launch notes ${suffix}`;
  const inboxTask = `Sort inbox item ${suffix}`;

  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Tools" })).toHaveAttribute("href", "/tools");

  await createProjectThroughUi(page)(projectTitle);
  await expect(page.getByRole("button", { name: projectTitle, exact: true })).toBeVisible();

  await page.locator(`summary[aria-label="Project menu ${projectTitle}"]`).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("Project title").first().fill(`${projectTitle} edited`);
  await page.getByRole("button", { name: "Save project" }).click();
  await expect(page.getByRole("button", { name: `${projectTitle} edited`, exact: true })).toBeVisible();

  await page.getByRole("button", { name: `${projectTitle} edited`, exact: true }).click();
  await expect(page.getByRole("heading", { name: `${projectTitle} edited` })).toBeVisible();

  const projectSection = `Planning ${suffix}`;
  await page.getByRole("button", { name: "Add section" }).click();
  await page.getByLabel("Section title").fill(projectSection);
  await page.getByLabel("Section title").press("Enter");
  await expect(page.getByRole("heading", { name: projectSection, exact: true })).toBeVisible();

  await createTask(page)(projectTask);
  await expect(page.getByLabel(`${projectTitle} edited tasks`).getByText(projectTask)).toBeVisible();

  await page.getByRole("button", { name: `Edit task ${projectTask}` }).click();
  await expect(page.getByLabel(`Edit ${projectTask}`)).toHaveJSProperty("tagName", "TEXTAREA");
  await page.getByLabel(`Move ${projectTask} to`).selectOption({ label: `${projectTitle} edited / ${projectSection}` });
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByLabel(`Section ${projectSection}`).getByText(projectTask)).toBeVisible();

  await page.getByRole("button", { name: `Add subtask to ${projectTask}` }).click();
  await page.getByLabel(`Subtask for ${projectTask}`).fill(subtask);
  await page.getByRole("button", { name: "Add subtask", exact: true }).click();
  await expect(page.getByLabel(`Section ${projectSection}`).getByText(subtask)).toBeVisible();

  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page.getByRole("button", { name: "Preview markdown" }).click();
  const markdownPreview = page.getByRole("dialog", { name: "Markdown preview" });
  await expect(markdownPreview.getByText(projectTask)).toBeVisible();
  await expect(markdownPreview.getByText(subtask)).toBeVisible();
  const projectMarkdown = await markdownPreview.locator("pre").textContent() ?? "";
  expect(projectMarkdown.match(/^# /gm)).toHaveLength(1);
  expect(projectMarkdown).toContain(`## ${projectSection}`);
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog", { name: "Export options" })).toBeVisible();
  await page.getByRole("button", { name: "Preview advanced markdown" }).click();
  const advancedProjectPreview = page.getByRole("dialog", { name: "Advanced markdown preview" });
  await expect(advancedProjectPreview).toContainText(projectTask);
  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Close export options" }).click();

  await page.getByRole("button", { name: "Inbox" }).click();
  await createSection(page)(sectionTitle);
  await expect(page.getByRole("heading", { name: sectionTitle })).toBeVisible();

  await page.getByRole("button", { name: `Edit section ${sectionTitle}` }).click();
  await page.getByLabel("Section title").last().fill(`${sectionTitle} edited`);
  await page.getByRole("button", { name: "Save section" }).click();
  await expect(page.getByRole("heading", { name: `${sectionTitle} edited` })).toBeVisible();

  await createTask(page)(inboxTask);
  await expect(page.getByRole("button", { name: inboxTask, exact: true })).toBeVisible();
  await dragTaskOverProject(page)(inboxTask, `${projectTitle} edited`);
  await expect(page.getByRole("button", { name: `${projectTitle} edited`, exact: true })).toHaveClass(/drop-active/);
  await page.getByRole("button", { name: `Edit task ${inboxTask}` }).click();
  await page.getByLabel(`Move ${inboxTask} to`).selectOption({ label: `Inbox / ${sectionTitle} edited` });
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByLabel(`Section ${sectionTitle} edited`).getByText(inboxTask)).toBeVisible();

  await createTask(page)(`Loose child ${suffix}`);
  await dragTaskOntoTask(page)(`Loose child ${suffix}`, inboxTask);
  await expect(page.getByLabel(`Section ${sectionTitle} edited`).getByText(`Loose child ${suffix}`)).toBeVisible();
  await dragTaskToRegion(page)(`Loose child ${suffix}`, "Inbox tasks");
  await expect(page.getByLabel("Inbox tasks").getByText(`Loose child ${suffix}`)).toBeVisible();

  const firstOrderTask = `Order first ${suffix}`;
  const secondOrderTask = `Order second ${suffix}`;

  await createTasks(page)([firstOrderTask, secondOrderTask]);
  await dragTaskBeforeTask(page)(secondOrderTask, firstOrderTask);
  await expect(page.getByLabel("Inbox tasks").locator(".task-title").filter({ hasText: secondOrderTask })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        ({ before, after }) => {
          const rows = [...document.querySelectorAll(".task-row")];
          const beforeIndex = rows.findIndex((row) => row.textContent?.includes(before));
          const afterIndex = rows.findIndex((row) => row.textContent?.includes(after));

          return beforeIndex >= 0 && afterIndex >= 0 ? beforeIndex < afterIndex : false;
        },
        { before: secondOrderTask, after: firstOrderTask }
      )
    )
    .toBe(true);

  const firstOrderRow = page.locator(".task-row").filter({ has: page.getByRole("button", { name: firstOrderTask, exact: true }) });
  await firstOrderRow.focus();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+ArrowRight" : "Control+ArrowRight");
  await expect(firstOrderRow).toHaveCSS("padding-left", "20px");
  await firstOrderRow.focus();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+ArrowLeft" : "Control+ArrowLeft");
  await expect(firstOrderRow).toHaveCSS("padding-left", "0px");

  const dragParent = `Drag parent ${suffix}`;
  const dragChild = `Drag child ${suffix}`;

  await createTasks(page)([dragParent, dragChild]);
  await dragTaskOntoTask(page)(dragChild, dragParent);
  const dragChildRow = page.locator(".task-row").filter({ has: page.getByRole("button", { name: dragChild, exact: true }) });
  await expect(dragChildRow).toHaveCSS("padding-left", "20px");
  await dragTaskLeftOnItself(page)(dragChild);
  await expect(dragChildRow).toHaveCSS("padding-left", "0px");

  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page.getByRole("button", { name: "Copy markdown" }).click();
  await expect(page.locator('.export-options-modal [role="status"]')).toHaveText("Markdown copied");
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain(inboxTask);
  await page.getByRole("button", { name: "Copy advanced markdown" }).click();
  await expect(page.locator('.export-options-modal [role="status"]')).toHaveText("Advanced markdown copied");
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain(inboxTask);
  await page.getByRole("button", { name: "Close export options" }).click();

  await page.getByRole("link", { name: "Export", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Export" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Export all ZIP" })).toHaveCount(0);
  const markdownDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export all markdown" }).click();
  expect((await markdownDownload).suggestedFilename()).toBe("mytodo.md");
  const advancedMarkdownDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export all advanced markdown" }).click();
  expect((await advancedMarkdownDownload).suggestedFilename()).toBe("mytodo-advanced.md");
  const jsonDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export all JSON" }).click();
  expect((await jsonDownload).suggestedFilename()).toBe("mytodo.json");
  await page.getByRole("button", { name: "Copy all JSON" }).click();
  await expect(page.locator(".export-page [role=status]")).toHaveText("All JSON copied");
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain('"taskTree"');
  await page.getByRole("button", { name: "Preview all JSON" }).click();
  await expect(page.getByRole("dialog", { name: "JSON preview" })).toContainText('"projects"');
  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Inbox", exact: true }).click();

  await page.getByRole("button", { name: `Delete section ${sectionTitle} edited` }).click();
  await expect(page.getByRole("heading", { name: `${sectionTitle} edited` })).not.toBeVisible();

  await page.locator(`summary[aria-label="Project menu ${projectTitle} edited"]`).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("button", { name: `${projectTitle} edited`, exact: true })).not.toBeVisible();
});

test("creates subprojects and drags projects into and out of a parent", async ({ page }, testInfo) => {
  const suffix = `${Date.now()}-${testInfo.workerIndex}`;
  const root = `Root ${suffix}`;
  const child = `Child ${suffix}`;
  const grandchild = `Grandchild ${suffix}`;
  await page.goto("/");
  await createProject(page)(root);
  await page.locator(`summary[aria-label="Project menu ${root}"]`).click();
  await page.getByRole("button", { name: "＋ Add subproject" }).click();
  await page.getByLabel("Project title").fill(child);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".project-nav-row").filter({ hasText: child })).toHaveCSS("padding-inline-start", "18px");
  await page.locator(`summary[aria-label="Project menu ${child}"]`).click();
  await page.getByRole("button", { name: "＋ Add subproject" }).click();
  await page.getByLabel("Project title").fill(grandchild);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await dragProjectTo(page)(grandchild, root, 0.5);
  await expect(page.locator(".project-nav-row").filter({ hasText: grandchild })).toHaveCSS("padding-inline-start", "18px");
  await dragProjectTo(page)(grandchild, root, 0.1);
  await expect(page.locator(".project-nav-row").filter({ hasText: grandchild })).toHaveCSS("padding-inline-start", "0px");
  await page.reload();
  await expect(page.locator(".project-nav-row").filter({ has: page.getByRole("button", { name: grandchild, exact: true }) })).toHaveCSS("padding-inline-start", "0px");
});

test("reorders projects reliably before and after siblings and persists the order", async ({ page }, testInfo) => {
  const suffix = `${Date.now()}-${testInfo.workerIndex}`;
  const first = `Drag first ${suffix}`;
  const middle = `Drag middle ${suffix}`;
  const last = `Drag last ${suffix}`;
  await page.goto("/");
  await createProjects(page)([first, middle, last]);
  await dragProjectTo(page)(last, first, 0.1);
  await expect.poll(() => page.locator(".project-nav-row").evaluateAll((rows) => rows.map((row) => row.querySelector("button.nav-button")?.textContent?.trim()))).toContain(first);
  const order = async () => page.locator(".project-nav-row").evaluateAll((rows) => rows.map((row) => row.querySelector("button.nav-button")?.textContent?.trim()));
  await expect.poll(async () => {
    const rows = await order();
    return rows.indexOf(last) < rows.indexOf(first) && rows.indexOf(first) < rows.indexOf(middle);
  }).toBe(true);
  await dragProjectTo(page)(last, middle, 0.9);
  await expect.poll(async () => {
    const rows = await order();
    return rows.indexOf(first) < rows.indexOf(middle) && rows.indexOf(middle) < rows.indexOf(last);
  }).toBe(true);
  await page.reload();
  await expect.poll(async () => {
    const rows = await order();
    return rows.indexOf(first) < rows.indexOf(middle) && rows.indexOf(middle) < rows.indexOf(last);
  }).toBe(true);
});

test("keeps project drop feedback stable and blocks dragging a project into its descendant", async ({ page }, testInfo) => {
  const suffix = `${Date.now()}-${testInfo.workerIndex}`;
  const parent = `Drag parent ${suffix}`;
  const child = `Drag child ${suffix}`;
  const peer = `Drag peer ${suffix}`;
  await page.goto("/");
  await createProjects(page)([parent, peer]);
  await page.locator(`summary[aria-label="Project menu ${parent}"]`).click();
  await page.getByRole("button", { name: "＋ Add subproject" }).click();
  await page.getByLabel("Project title").fill(child);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await showProjectDropIndicator(page)(peer, parent, 0.5);
  await expect(page.locator(`.project-nav-row[data-project-id]`).filter({ has: page.getByRole("button", { name: parent, exact: true }) })).toHaveClass(/project-drop-inside/);
  await dragProjectTo(page)(peer, parent, 0.5);
  await expect(page.locator(".project-nav-row").filter({ has: page.getByRole("button", { name: peer, exact: true }) })).toHaveCSS("padding-inline-start", "18px");
  await dragProjectTo(page)(parent, child, 0.5);
  await expect(page.locator(".project-nav-row").filter({ has: page.getByRole("button", { name: parent, exact: true }) })).toHaveCSS("padding-inline-start", "0px");
  await expect(page.locator(".project-nav-row").filter({ has: page.getByRole("button", { name: child, exact: true }) })).toHaveCSS("padding-inline-start", "18px");
});

test("supports real mouse dragging of project rows", async ({ page }, testInfo) => {
  const suffix = `${Date.now()}-${testInfo.workerIndex}`;
  const first = `Mouse drag first ${suffix}`;
  const second = `Mouse drag second ${suffix}`;
  await page.goto("/");
  await createProjects(page)([first, second]);
  await dragProjectWithMouse(page)(second, first, 0.1);
  const rows = async () => page.locator(".project-nav-row").evaluateAll((items) => items.map((row) => row.querySelector("button.nav-button")?.textContent?.trim()));
  await expect.poll(async () => {
    const order = await rows();
    return order.indexOf(second) < order.indexOf(first);
  }).toBe(true);
  await page.reload();
  await expect.poll(async () => {
    const order = await rows();
    return order.indexOf(second) < order.indexOf(first);
  }).toBe(true);
});

test("nests a project with touch dragging in the mobile sidebar", async ({ page }, testInfo) => {
  const suffix = `${Date.now()}-${testInfo.workerIndex}`;
  const targetTitle = `Touch target ${suffix}`;
  const sourceTitle = `Touch source ${suffix}`;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const api = createE2eApi(page.request);
  await api.createProject(targetTitle);
  await api.createProject(sourceTitle);
  await page.reload();
  await page.getByRole("button", { name: "Open navigation" }).click();

  const sourceRow = page.locator(".project-nav-row").filter({ has: page.getByRole("button", { name: sourceTitle, exact: true }) });
  const targetRow = page.locator(".project-nav-row").filter({ has: page.getByRole("button", { name: targetTitle, exact: true }) });
  const sourceHandle = sourceRow.getByRole("button", { name: `Drag project ${sourceTitle}` });
  const sourceId = await sourceRow.getAttribute("data-project-id");
  const targetId = await targetRow.getAttribute("data-project-id");
  if (!sourceId || !targetId) throw new Error("Project rows must expose their IDs");

  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
  try {
    await sourceHandle.scrollIntoViewIfNeeded();
    const sourceBox = await sourceHandle.boundingBox();
    if (!sourceBox || !(await targetRow.boundingBox())) throw new Error("Mobile project drag handles must be visible");
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ id: 1, x: sourceBox.x + sourceBox.width / 2, y: sourceBox.y + sourceBox.height / 2 }]
    });
    await expect(sourceRow).toHaveClass(/project-dragging/);
    const currentTargetBox = await targetRow.boundingBox();
    if (!currentTargetBox) throw new Error("Mobile project drop target must remain visible");
    const start = Object.freeze({ x: sourceBox.x + sourceBox.width / 2, y: sourceBox.y + sourceBox.height / 2 });
    const finish = Object.freeze({ x: currentTargetBox.x + currentTargetBox.width / 2, y: currentTargetBox.y + currentTargetBox.height / 2 });
    for (const progress of [0.25, 0.5, 0.75, 1]) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{
          id: 1,
          x: start.x + (finish.x - start.x) * progress,
          y: start.y + (finish.y - start.y) * progress
        }]
      });
    }
    await expect(targetRow).toHaveClass(/project-drop-inside/);
    const movedProjectResponse = page.waitForResponse((response) =>
      response.url().endsWith(`/projects/${sourceId}/parent`) && response.request().method() === "PATCH"
    );
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    const response = await movedProjectResponse;
    expect(response.ok()).toBe(true);
    expect(await response.json()).toMatchObject({ project: { id: sourceId, parentId: targetId } });
    await expect.poll(() => sourceRow.evaluate((row) => getComputedStyle(row).paddingInlineStart)).toBe("18px");
  } finally {
    await cdp.detach();
  }
});

test("keeps the shared mobile sidebar consistent and closes it after navigation", async ({ page }, testInfo) => {
  const projectTitle = `Shared sidebar project ${Date.now()}-${testInfo.workerIndex}`;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await createProject(page)(projectTitle);

  const sidebar = page.locator("aside.sidebar[aria-label='Navigation']");
  const expectSidebarClosed = async () => {
    await expect(sidebar).not.toHaveClass(/mobile-sidebar-open/);
    await expect(page.getByRole("button", { name: "Open navigation" })).toHaveAttribute("aria-expanded", "false");
  };
  const selectNavigationItem = async (name: string, expectedPath: string) => {
    await expectSidebarClosed();
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(sidebar).toHaveClass(/mobile-sidebar-open/);
    const item = name === "Inbox"
      ? sidebar.getByRole("button", { name, exact: true })
      : sidebar.getByRole("link", { name, exact: true });
    await item.evaluate((element: HTMLElement) => element.click());
    await expect(page).toHaveURL(new RegExp(`${expectedPath.replaceAll("/", "\\/")}(?:\\?.*)?$`));
    await expectSidebarClosed();
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(sidebar.getByRole("link", { name: "Settings", exact: true })).toBeVisible();
    await expect(sidebar.locator(".project-nav-row").filter({ has: page.getByRole("button", { name: projectTitle, exact: true }) }).getByRole("button", { name: `Drag project ${projectTitle}` })).toBeVisible();
    await sidebar.getByRole("button", { name: "Close navigation" }).evaluate((button: HTMLButtonElement) => button.click());
    await expectSidebarClosed();
  };

  await selectNavigationItem("Dates", "/dates");
  await selectNavigationItem("Tools", "/tools");
  await selectNavigationItem("Settings", "/settings");
  await selectNavigationItem("Archived projects", "/archived-projects");
  await selectNavigationItem("Inbox", "/");
});

test("shows project archiving controls when project archiving is enabled", async ({ page }, testInfo) => {
  const projectTitle = `Archivable project ${Date.now()}-${testInfo.workerIndex}`;
  await page.goto("/");
  await createProject(page)(projectTitle);
  const projectRow = page.locator(".project-nav-row").filter({ has: page.getByRole("button", { name: projectTitle, exact: true }) });
  await projectRow.getByLabel(`Project menu ${projectTitle}`).click();
  await expect(projectRow.getByRole("button", { name: "Archive", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Archived projects", exact: true }).click();
  await expect(page).toHaveURL(/\/archived-projects$/);
  await expect(page.getByRole("heading", { name: "Archived projects" })).toBeVisible();
});
