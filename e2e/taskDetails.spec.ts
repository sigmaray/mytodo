import process from "node:process";
import { createE2eApi } from "./api";
import { expect, test } from "./fixtures";
import * as browserHelpers from "./taskBrowserHelpers";

test.beforeEach(async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
});

test("creates a task in the browser", async ({ page }, testInfo) => {
  const title = `Write the first MVP task ${testInfo.retry}-${Date.now()}`;
  const editedTitle = `Write the first persistent MVP task ${testInfo.retry}-${Date.now()}`;

  await page.goto("/");

  await browserHelpers.createTaskThroughUi(page)(title);

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
  await createE2eApi(page.request).createTask(title);
  await page.goto("/");
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
  expect(
    await dialog.locator(".task-subtasks-card").evaluate((card) => {
      const cardRect = card.getBoundingClientRect();
      const bodyRect = card.querySelector(".task-subtasks-body")?.getBoundingClientRect();
      return bodyRect !== undefined && bodyRect !== null && bodyRect.bottom <= cardRect.bottom;
    }),
  ).toBe(true);
  const metadataTop = await dialog
    .locator(".task-details-sidebar")
    .evaluate((element) => element.getBoundingClientRect().top);
  const subtasksTop = await dialog
    .locator(".task-subtasks-card")
    .evaluate((element) => element.getBoundingClientRect().top);
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
  expect(
    await dialog.locator(".task-comments").evaluate((comments) => {
      const button = comments.querySelector<HTMLElement>(".btn-primary");
      const formCard = comments.querySelector<HTMLElement>(".card");
      return (
        button !== null &&
        formCard !== null &&
        button.getBoundingClientRect().width >= formCard.getBoundingClientRect().width - 34
      );
    }),
  ).toBe(true);
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
  expect(
    await backdrop.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return rect.x === 0 && rect.y === 0 && rect.width === 320 && rect.height === 568;
    }),
  ).toBe(true);
  expect(
    await dateDialog.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return (
        rect.left === 0 &&
        rect.right === 320 &&
        rect.bottom === 568 &&
        element.scrollWidth <= element.clientWidth
      );
    }),
  ).toBe(true);

  const today = dateDialog.getByRole("button", { name: "Today" });
  const tomorrow = dateDialog.getByRole("button", { name: "Tomorrow" });
  const quickDateLayout = await Promise.all([today.boundingBox(), tomorrow.boundingBox()]);
  if (quickDateLayout.some((box) => box === null)) throw new Error("Quick date buttons must be visible");
  expect(quickDateLayout[0]?.y).toBe(quickDateLayout[1]?.y);
  expect(quickDateLayout[0]?.height).toBeGreaterThanOrEqual(44);
  await expect(dateDialog.locator('[aria-current="date"]')).toBeVisible();
  expect(
    await dateDialog
      .locator(".date-picker-grid")
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);

  await tomorrow.click();
  const expectedTomorrow = new Date();
  expectedTomorrow.setDate(expectedTomorrow.getDate() + 1);
  await expect(dateDialog.getByLabel("New task date")).toHaveValue(
    expectedTomorrow.toLocaleDateString("en-CA"),
  );
  await expect(dateDialog).toBeVisible();
  await dateDialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dateDialog).toHaveCount(0);
  await expect(addTaskDialog).toBeVisible();
});

test("keeps optional Add task fields collapsed on mobile until requested", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 360, height: 640 },
    isMobile: true,
    hasTouch: true,
  });
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
  const api = createE2eApi(page.request);
  const created = await api.createTask(title);
  await api.updateTask(created.id, { description });
  await api.createComment(created.id, "First row comment");
  await api.createComment(created.id, "Second row comment");
  await page.goto("/");

  const row = page
    .locator(".task-row")
    .filter({ has: page.getByRole("button", { name: title, exact: true }) });
  const descriptionPreview = row.locator(".task-description-preview");
  await expect(descriptionPreview).toHaveText(description);
  await expect(descriptionPreview).toHaveCSS("text-overflow", "ellipsis");
  await expect(descriptionPreview).toHaveCSS("white-space", "nowrap");
  expect(await descriptionPreview.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(
    true,
  );

  await row.getByRole("button", { name: title, exact: true }).click();
  const taskDialog = page.getByRole("dialog", { name: `Task details: ${title}` });
  await expect(taskDialog.getByText("First row comment")).toBeVisible();
  await expect(taskDialog.getByText("Second row comment")).toBeVisible();
  await expect(taskDialog.locator(".comment-markdown").first()).toHaveCSS("text-align", "left");
  await taskDialog.getByRole("button", { name: "Close task details" }).click();
  await expect(row.getByLabel("2 comments")).toContainText("2");
  await row.getByRole("button", { name: title, exact: true }).click();
  const comments = taskDialog.locator(".task-comment");
  const firstComment = comments.filter({ hasText: "First row comment" });
  const firstCommentIndex = await firstComment.evaluate((element) =>
    Array.from(element.parentElement?.querySelectorAll(".task-comment") ?? []).indexOf(element),
  );
  const firstCommentAtIndex = comments.nth(firstCommentIndex);
  await firstComment.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(firstCommentAtIndex.locator("textarea")).toBeFocused();
  await firstCommentAtIndex.locator("textarea").fill("Edited first comment");
  await firstCommentAtIndex.getByRole("button", { name: "Save comment" }).click();
  await expect(comments.filter({ hasText: "Edited first comment" })).toBeVisible();
  await comments
    .filter({ hasText: "Second row comment" })
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await expect(comments).toHaveCount(1);
  await expect(comments.first()).toContainText("Edited first comment");
});

test("saves comment attachments on submit and serves them through the authenticated API", async ({
  page,
}, testInfo) => {
  test.setTimeout(60000);
  const title = `Attachment comment ${testInfo.workerIndex}-${Date.now()}`;
  await createE2eApi(page.request).createTask(title);
  await page.goto("/");
  await page.getByRole("button", { name: title, exact: true }).click();
  const dialog = page.getByRole("dialog", { name: `Task details: ${title}` });
  await page.evaluate(() => {
    const clipboardFiles = new DataTransfer();
    clipboardFiles.items.add(new File(["Pasted attachment"], "pasted.txt", { type: "text/plain" }));
    document.body.dispatchEvent(
      new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: clipboardFiles }),
    );
  });
  await expect(page.getByText("Файл «pasted.txt» прикреплён", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("link", { name: /pasted.txt/ })).toBeVisible();
  await dialog.getByLabel("Add comment").fill("Read **the notes**");
  await dialog
    .getByLabel("Attach files to comment")
    .setInputFiles({ name: "notes.md", mimeType: "text/markdown", buffer: Buffer.from("# Notes") });
  await expect(page.getByText("Файл «notes.md» прикреплён", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Add comment" }).click();
  await expect(dialog.locator(".comment-markdown strong")).toHaveText("the notes");
  const attachmentLink = dialog.getByRole("link", { name: /notes.md/ });
  await expect(attachmentLink).toBeVisible();
  const attachmentPath = await attachmentLink.getAttribute("href");
  expect(attachmentPath).toMatch(/^\/attachments\//);
  const row = page
    .locator(".task-row")
    .filter({ has: page.getByRole("button", { name: title, exact: true }) });
  await expect(row.getByLabel("Task has attachments")).toBeVisible();
  await dialog.getByRole("button", { name: "Close task details" }).click();
  await page.getByRole("link", { name: "Attachments", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Attachments" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Attachments" })).toBeVisible();
  const pastedAttachmentRow = page
    .locator(".attachment-library-item")
    .filter({ hasText: title })
    .filter({ hasText: "pasted.txt" });
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
  await createE2eApi(page.request).createTask(targetTitle);
  await page.goto("/");
  await page.getByRole("button", { name: "Add task Q" }).click();
  const addTaskDialog = page.getByRole("dialog", { name: "Add task" });
  await addTaskDialog.getByLabel("New task title").fill(sourceTitle);
  await addTaskDialog.getByLabel("New task labels").fill("shared");
  await addTaskDialog.getByLabel("New task labels").press("Enter");
  await expect(addTaskDialog.locator(".label-picker-chip")).toContainText("shared");
  await addTaskDialog.getByRole("button", { name: "Add task", exact: true }).click();

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
