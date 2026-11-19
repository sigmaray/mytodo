import type { Page } from "@playwright/test";
import { createE2eApi } from "./api";
import { expect } from "./fixtures";

/**
 * Creates a task through the setup API and verifies that it appears in the UI.
 *
 * @param {Page} page
 */
export const createTask = (page: Page) => async (title: string) => {
  /** Read the current project from the URL so the helper creates the task in the open scope. */
  const projectId = await page.evaluate(() => new URLSearchParams(window.location.search).get("project"));
  await createE2eApi(page.request).createTask(title, { projectId });
  await page.reload();
  await expect(page.getByRole("button", { name: title, exact: true })).toBeVisible();
};

/**
 * Creates several tasks with one API setup and one page reload.
 *
 * @param {Page} page
 */
export const createTasks = (page: Page) => async (titles: Array<string>) => {
  const projectId = await page.evaluate(() => new URLSearchParams(window.location.search).get("project"));
  const api = createE2eApi(page.request);
  /** Create data through the API without reloading the page after each task. */
  for (const title of titles) await api.createTask(title, { projectId });
  await page.reload();
  await Promise.all(
    titles.map((title) => expect(page.getByRole("button", { name: title, exact: true })).toBeVisible()),
  );
};

/**
 * Creates a task through the UI form to test the user flow.
 *
 * @param {Page} page
 */
export const createTaskThroughUi = (page: Page) => async (title: string) => {
  await page.getByRole("button", { name: "Add task Q" }).click();
  await expect(page.getByLabel("Initial task comment")).toHaveCount(0);
  await page.getByLabel("New task title").fill(title);
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(page.getByRole("button", { name: title, exact: true })).toBeVisible();
};

/**
 * Creates a project through the test API and opens its page.
 *
 * @param {Page} page
 */
export const createProject = (page: Page) => async (title: string) => {
  const created = await createE2eApi(page.request).createProject(title);
  await page.goto(`/?project=${encodeURIComponent(created.id)}`);
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
};

/**
 * Creates several projects and verifies that their links appear in the sidebar.
 *
 * @param {Page} page
 */
export const createProjects = (page: Page) => async (titles: Array<string>) => {
  const api = createE2eApi(page.request);
  for (const title of titles) await api.createProject(title);
  await page.reload();
  await Promise.all(
    titles.map((title) => expect(page.getByRole("button", { name: title, exact: true })).toBeVisible()),
  );
};

/**
 * Creates a project through the UI form and waits for a successful API response.
 *
 * @param {Page} page
 */
export const createProjectThroughUi = (page: Page) => async (title: string) => {
  await page.getByRole("button", { name: "Add project" }).click();
  await page.getByLabel("Project title").fill(title);
  const createdResponse = page.waitForResponse(
    (response) => response.url().endsWith("/projects") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Save", exact: true }).click();
  expect((await createdResponse).ok()).toBe(true);
};

/**
 * Simulates DOM drag events to move a project to a specified part of the target row.
 *
 * @param {Page} page
 */
export const dragProjectTo =
  (page: Page) => async (sourceTitle: string, targetTitle: string, yRatio: number) => {
    await page
      .locator(".project-nav-row")
      .filter({ has: page.getByRole("button", { name: sourceTitle, exact: true }) })
      .evaluate(
        (source, data) => {
          /** Find the target row in the document because the callback runs in the browser context. */
          const target = [...document.querySelectorAll<HTMLElement>(".project-nav-row")].find(
            (row) => row.querySelector("button.nav-button")?.textContent?.trim() === data.targetTitle,
          );
          if (!target) throw new Error("Project target not found");
          const rect = target.getBoundingClientRect();
          /** The position within the row selects before, inside, or after in the application handler. */
          const y = rect.top + rect.height * data.yRatio;
          const transfer = new DataTransfer();
          transfer.setData("application/x-project-id", source.getAttribute("data-project-id") ?? "");
          source.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: transfer }));
          target.dispatchEvent(
            new DragEvent("dragenter", { bubbles: true, dataTransfer: transfer, clientY: y }),
          );
          target.dispatchEvent(
            new DragEvent("dragover", { bubbles: true, dataTransfer: transfer, clientY: y }),
          );
          target.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer: transfer, clientY: y }));
          source.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: transfer }));
        },
        { targetTitle, yRatio },
      );
  };

/**
 * Drags a project with the mouse to a specified vertical area of a project row.
 *
 * @param {Page} page
 */
export const dragProjectWithMouse =
  (page: Page) => async (sourceTitle: string, targetTitle: string, yRatio: number) => {
    const source = page
      .locator(".project-nav-row")
      .filter({ has: page.getByRole("button", { name: sourceTitle, exact: true }) });
    const target = page
      .locator(".project-nav-row")
      .filter({ has: page.getByRole("button", { name: targetTitle, exact: true }) });
    const box = await target.boundingBox();
    if (!box) throw new Error("Project target is not visible");
    /** Clamp the drop point to the row bounds, including for very short rows. */
    await source.dragTo(target, {
      targetPosition: {
        x: Math.max(8, Math.min(box.width - 8, box.width / 2)),
        y: Math.max(2, Math.min(box.height - 2, box.height * yRatio)),
      },
    });
  };

/**
 * Shows the project drop indicator without completing the move.
 *
 * @param {Page} page
 */
export const showProjectDropIndicator =
  (page: Page) => async (sourceTitle: string, targetTitle: string, yRatio: number) => {
    await page
      .locator(".project-nav-row")
      .filter({ has: page.getByRole("button", { name: sourceTitle, exact: true }) })
      .evaluate(
        (source, data) => {
          const target = [...document.querySelectorAll<HTMLElement>(".project-nav-row")].find(
            (row) => row.querySelector("button.nav-button")?.textContent?.trim() === data.targetTitle,
          );
          if (!target) throw new Error("Project target not found");
          const rect = target.getBoundingClientRect();
          /** Reuse one DataTransfer object to carry the project ID through all drag events. */
          const transfer = new DataTransfer();
          transfer.setData("application/x-project-id", source.getAttribute("data-project-id") ?? "");
          const y = rect.top + rect.height * data.yRatio;
          source.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: transfer }));
          target.dispatchEvent(
            new DragEvent("dragover", { bubbles: true, dataTransfer: transfer, clientY: y }),
          );
          const child = target.querySelector("button.nav-button");
          child?.dispatchEvent(
            new DragEvent("dragleave", { bubbles: true, dataTransfer: transfer, relatedTarget: target }),
          );
        },
        { targetTitle, yRatio },
      );
  };

/**
 * Creates a section through the UI in the open project or Inbox.
 *
 * @param {Page} page
 */
export const createSection = (page: Page) => async (title: string) => {
  await page.getByRole("button", { name: "Add section" }).click();
  await page.getByLabel("Section title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
};

/**
 * Simulates dragging one task onto another to create a subtask.
 *
 * @param {Page} page
 */
export const dragTaskOntoTask = (page: Page) => async (sourceTitle: string, targetTitle: string) => {
  await page.getByRole("button", { name: sourceTitle, exact: true }).evaluate((sourceElement, target) => {
    /** Read the source row and target task from the DOM so events reach the correct nodes. */
    const sourceRow = sourceElement.closest(".task-row");
    const targetRow = [...document.querySelectorAll(".task-row")].find((row) =>
      row.textContent?.includes(target),
    );
    const taskId = sourceRow?.getAttribute("data-task-id") ?? null;
    const dataTransfer = new DataTransfer();

    if (targetRow === undefined || taskId === null) {
      throw new Error("Unable to drag task");
    }

    const rect = targetRow.getBoundingClientRect();
    /** Dropping in the middle of the row nests the task under the target. */
    const middleY = rect.top + rect.height / 2;
    const middleX = rect.left + Math.max(48, rect.width / 3);

    /** Reuse one payload for all events, as in a native browser drag. */
    dataTransfer.setData("text/task-id", taskId);
    sourceRow?.dispatchEvent(
      new DragEvent("dragstart", { bubbles: true, dataTransfer, clientX: middleX, clientY: middleY }),
    );
    targetRow.dispatchEvent(
      new DragEvent("dragenter", { bubbles: true, dataTransfer, clientX: middleX, clientY: middleY }),
    );
    targetRow.dispatchEvent(
      new DragEvent("dragover", { bubbles: true, dataTransfer, clientX: middleX, clientY: middleY }),
    );
    targetRow.dispatchEvent(
      new DragEvent("drop", { bubbles: true, dataTransfer, clientX: middleX, clientY: middleY }),
    );
    sourceRow?.dispatchEvent(
      new DragEvent("dragend", { bubbles: true, dataTransfer, clientX: middleX, clientY: middleY }),
    );
  }, targetTitle);
};

/**
 * Simulates dragging a task before another task in the same list.
 *
 * @param {Page} page
 */
export const dragTaskBeforeTask = (page: Page) => async (sourceTitle: string, targetTitle: string) => {
  await page.getByRole("button", { name: sourceTitle, exact: true }).evaluate((sourceElement, target) => {
    /** Find the target by row text and place the drop point near its top edge. */
    const sourceRow = sourceElement.closest(".task-row");
    const targetRow = [...document.querySelectorAll(".task-row")].find((row) =>
      row.textContent?.includes(target),
    );
    const taskId = sourceRow?.getAttribute("data-task-id") ?? null;
    const dataTransfer = new DataTransfer();

    if (targetRow === undefined || taskId === null) {
      throw new Error("Unable to reorder task");
    }

    const rect = targetRow.getBoundingClientRect();
    /** The top area of the target row indicates that the task should be placed before it. */
    const topY = rect.top + Math.max(1, rect.height * 0.1);
    const middleX = rect.left + Math.max(48, rect.width / 3);

    dataTransfer.setData("text/task-id", taskId);
    sourceRow?.dispatchEvent(
      new DragEvent("dragstart", { bubbles: true, dataTransfer, clientX: middleX, clientY: topY }),
    );
    targetRow.dispatchEvent(
      new DragEvent("dragenter", { bubbles: true, dataTransfer, clientX: middleX, clientY: topY }),
    );
    targetRow.dispatchEvent(
      new DragEvent("dragover", { bubbles: true, dataTransfer, clientX: middleX, clientY: topY }),
    );
    targetRow.dispatchEvent(
      new DragEvent("drop", { bubbles: true, dataTransfer, clientX: middleX, clientY: topY }),
    );
    sourceRow?.dispatchEvent(
      new DragEvent("dragend", { bubbles: true, dataTransfer, clientX: middleX, clientY: topY }),
    );
  }, targetTitle);
};

/**
 * Drags a task over a project to verify the destination indicator.
 *
 * @param {Page} page
 */
export const dragTaskOverProject = (page: Page) => async (sourceTitle: string, projectTitle: string) => {
  await page.getByRole("button", { name: sourceTitle, exact: true }).evaluate((sourceElement, title) => {
    /** Find the target project in the sidebar to check its highlight during a task drag. */
    const sourceRow = sourceElement.closest(".task-row");
    const projectButton = [...document.querySelectorAll(".project-nav-row > button.nav-button")].find(
      (button) => button.textContent?.trim() === title,
    );
    const taskId = sourceRow?.getAttribute("data-task-id") ?? null;
    const dataTransfer = new DataTransfer();

    if (projectButton === undefined || taskId === null) {
      throw new Error("Unable to drag task over project");
    }

    dataTransfer.setData("text/task-id", taskId);
    sourceRow?.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer }));
    projectButton.dispatchEvent(new DragEvent("dragenter", { bubbles: true, dataTransfer }));
    projectButton.dispatchEvent(new DragEvent("dragover", { bubbles: true, dataTransfer }));
  }, projectTitle);
};

/**
 * Drops a task to the left of itself to simulate outdenting one level.
 *
 * @param {Page} page
 */
export const dragTaskLeftOnItself = (page: Page) => async (title: string) => {
  await page.getByRole("button", { name: title, exact: true }).evaluate((sourceElement) => {
    /** Drop on the same row again, using a left-side coordinate to simulate outdenting. */
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
    sourceRow.dispatchEvent(
      new DragEvent("dragenter", { bubbles: true, dataTransfer, clientX: rect.left - 40 }),
    );
    sourceRow.dispatchEvent(
      new DragEvent("dragover", { bubbles: true, dataTransfer, clientX: rect.left - 40 }),
    );
    sourceRow.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer, clientX: rect.left - 40 }));
    sourceRow.dispatchEvent(
      new DragEvent("dragend", { bubbles: true, dataTransfer, clientX: rect.left - 40 }),
    );
  });
};

/**
 * Drags a task to a region identified by aria-label, such as the Inbox or a project.
 *
 * @param {Page} page
 */
export const dragTaskToRegion = (page: Page) => async (sourceTitle: string, regionLabel: string) => {
  await page.getByRole("button", { name: sourceTitle, exact: true }).evaluate((sourceElement, label) => {
    /** Find the drop target by accessible name so the helper works for the Inbox and projects. */
    const sourceRow = sourceElement.closest(".task-row");
    const region = [...document.querySelectorAll("[aria-label]")].find(
      (element) => element.getAttribute("aria-label") === label,
    );
    const taskId = sourceRow?.getAttribute("data-task-id") ?? null;
    const dataTransfer = new DataTransfer();

    if (region === undefined || taskId === null) {
      throw new Error("Unable to drag task to region");
    }

    /** Move the task to the target region and complete the drag event sequence. */
    dataTransfer.setData("text/task-id", taskId);
    sourceRow?.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer }));
    region.dispatchEvent(new DragEvent("dragover", { bubbles: true, dataTransfer }));
    region.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer }));
    sourceRow?.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer }));
  }, regionLabel);
};
