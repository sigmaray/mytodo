import type { Page } from "@playwright/test";
import { createE2eApi } from "./api";
import { expect } from "./fixtures";

/** Создаёт задачу через подготовительный API и проверяет, что она появилась в UI. */
export const createTask = (page: Page) => async (title: string) => {
  // Сохраняем текущий проект из URL, чтобы helper создавал задачу в открытой области.
  const projectId = await page.evaluate(() => new URLSearchParams(window.location.search).get("project"));
  await createE2eApi(page.request).createTask(title, { projectId });
  await page.reload();
  await expect(page.getByRole("button", { name: title, exact: true })).toBeVisible();
};

/** Создаёт несколько задач за одну подготовку API и одну перезагрузку страницы. */
export const createTasks = (page: Page) => async (titles: Array<string>) => {
  const projectId = await page.evaluate(() => new URLSearchParams(window.location.search).get("project"));
  const api = createE2eApi(page.request);
  // Создаём данные через API без повторного открытия страницы после каждой задачи.
  for (const title of titles) await api.createTask(title, { projectId });
  await page.reload();
  await Promise.all(
    titles.map((title) => expect(page.getByRole("button", { name: title, exact: true })).toBeVisible()),
  );
};

/** Создаёт задачу через форму интерфейса для проверки пользовательского потока. */
export const createTaskThroughUi = (page: Page) => async (title: string) => {
  await page.getByRole("button", { name: "Add task Q" }).click();
  await expect(page.getByLabel("Initial task comment")).toHaveCount(0);
  await page.getByLabel("New task title").fill(title);
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(page.getByRole("button", { name: title, exact: true })).toBeVisible();
};

/** Создаёт проект через тестовый API и открывает его страницу. */
export const createProject = (page: Page) => async (title: string) => {
  const created = await createE2eApi(page.request).createProject(title);
  await page.goto(`/?project=${encodeURIComponent(created.id)}`);
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
};

/** Создаёт несколько проектов и проверяет, что их ссылки отображаются в sidebar. */
export const createProjects = (page: Page) => async (titles: Array<string>) => {
  const api = createE2eApi(page.request);
  for (const title of titles) await api.createProject(title);
  await page.reload();
  await Promise.all(
    titles.map((title) => expect(page.getByRole("button", { name: title, exact: true })).toBeVisible()),
  );
};

/** Создаёт проект через форму интерфейса и ждёт успешного ответа API. */
export const createProjectThroughUi = (page: Page) => async (title: string) => {
  await page.getByRole("button", { name: "Add project" }).click();
  await page.getByLabel("Project title").fill(title);
  const createdResponse = page.waitForResponse(
    (response) => response.url().endsWith("/projects") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Save", exact: true }).click();
  expect((await createdResponse).ok()).toBe(true);
};

/** Имитирует DOM drag events для переноса проекта в указанную часть строки-цели. */
export const dragProjectTo =
  (page: Page) => async (sourceTitle: string, targetTitle: string, yRatio: number) => {
    await page
      .locator(".project-nav-row")
      .filter({ has: page.getByRole("button", { name: sourceTitle, exact: true }) })
      .evaluate(
        (source, data) => {
          // Находим целевую строку внутри документа, так как callback выполняется в контексте браузера.
          const target = [...document.querySelectorAll<HTMLElement>(".project-nav-row")].find(
            (row) => row.querySelector("button.nav-button")?.textContent?.trim() === data.targetTitle,
          );
          if (!target) throw new Error("Project target not found");
          const rect = target.getBoundingClientRect();
          // Позиция внутри строки выбирает before/inside/after в обработчике приложения.
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

/** Перетаскивает проект мышью в заданную вертикальную область строки проекта. */
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
    // Ограничиваем точку drop границами строки, включая очень узкие строки.
    await source.dragTo(target, {
      targetPosition: {
        x: Math.max(8, Math.min(box.width - 8, box.width / 2)),
        y: Math.max(2, Math.min(box.height - 2, box.height * yRatio)),
      },
    });
  };

/** Показывает индикатор drop проекта, не завершая само перемещение. */
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
          // Один DataTransfer переносит ID проекта через всю последовательность drag-событий.
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

/** Создаёт секцию через интерфейс открытого проекта или Входящих. */
export const createSection = (page: Page) => async (title: string) => {
  await page.getByRole("button", { name: "Add section" }).click();
  await page.getByLabel("Section title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
};

/** Имитирует перетаскивание задачи внутрь другой задачи для создания подзадачи. */
export const dragTaskOntoTask = (page: Page) => async (sourceTitle: string, targetTitle: string) => {
  await page.getByRole("button", { name: sourceTitle, exact: true }).evaluate((sourceElement, target) => {
    // Из DOM извлекаются строка-источник и задача-цель, чтобы отправить события на правильные узлы.
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
    // Середина строки задаёт вложение задачи в цель.
    const middleY = rect.top + rect.height / 2;
    const middleX = rect.left + Math.max(48, rect.width / 3);

    // Все события используют один payload, как при настоящем перетаскивании браузером.
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

/** Имитирует перетаскивание задачи перед другой задачей в том же списке. */
export const dragTaskBeforeTask = (page: Page) => async (sourceTitle: string, targetTitle: string) => {
  await page.getByRole("button", { name: sourceTitle, exact: true }).evaluate((sourceElement, target) => {
    // Цель выбирается по тексту строки, затем точка drop задаётся возле её верхнего края.
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
    // Верхняя область целевой строки обозначает перестановку перед ней.
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

/** Перетаскивает задачу над проектом для проверки индикатора назначения. */
export const dragTaskOverProject = (page: Page) => async (sourceTitle: string, projectTitle: string) => {
  await page.getByRole("button", { name: sourceTitle, exact: true }).evaluate((sourceElement, title) => {
    // Находим целевой проект в sidebar для проверки подсветки при наведении задачи.
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

/** Сбрасывает задачу слева от себя, имитируя снятие одного уровня вложенности. */
export const dragTaskLeftOnItself = (page: Page) => async (title: string) => {
  await page.getByRole("button", { name: title, exact: true }).evaluate((sourceElement) => {
    // Повторный сброс на ту же строку с координатой слева имитирует снятие отступа.
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

/** Перетаскивает задачу в область по aria-label, например в Inbox или проект. */
export const dragTaskToRegion = (page: Page) => async (sourceTitle: string, regionLabel: string) => {
  await page.getByRole("button", { name: sourceTitle, exact: true }).evaluate((sourceElement, label) => {
    // Ищем drop-цель по доступному имени, чтобы helper подходил Входящим и проектам.
    const sourceRow = sourceElement.closest(".task-row");
    const region = [...document.querySelectorAll("[aria-label]")].find(
      (element) => element.getAttribute("aria-label") === label,
    );
    const taskId = sourceRow?.getAttribute("data-task-id") ?? null;
    const dataTransfer = new DataTransfer();

    if (region === undefined || taskId === null) {
      throw new Error("Unable to drag task to region");
    }

    // Переносим задачу на найденную область и завершаем drag-последовательность.
    dataTransfer.setData("text/task-id", taskId);
    sourceRow?.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer }));
    region.dispatchEvent(new DragEvent("dragover", { bubbles: true, dataTransfer }));
    region.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer }));
    sourceRow?.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer }));
  }, regionLabel);
};
