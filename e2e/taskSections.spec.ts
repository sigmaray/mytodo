import { expect, test } from "./fixtures";
import { createE2eApi } from "./api";
import * as browserHelpers from "./taskBrowserHelpers";

test.beforeEach(async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
});

/** Tasks can be created directly in a section, and confirmed deletion clears the scope. */
test("adds tasks directly to sections and deletes all tasks within Inbox or a project", async ({
  page,
}, testInfo) => {
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
  await browserHelpers.createSection(page)(inboxSection);
  const inboxSectionRegion = page.getByLabel(`Section ${inboxSection}`);
  await inboxSectionRegion.getByRole("button", { name: `Add task to section ${inboxSection}` }).click();
  const inboxSectionDialog = page.getByRole("dialog", { name: "Add task" });
  await expect(inboxSectionDialog.getByLabel("Add task project")).toHaveValue(/^section:/);
  await inboxSectionDialog.getByLabel("New task title").fill(inboxSectionTask);
  await inboxSectionDialog.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(inboxSectionRegion.getByText(inboxSectionTask)).toBeVisible();
  await expect(inboxSectionDialog).not.toBeVisible();

  await browserHelpers.createProject(page)(project);
  await browserHelpers.createSection(page)(projectSection);
  await page
    .getByLabel(`${project} tasks`)
    .getByRole("button", { name: `Add task to ${project}` })
    .click();
  const projectRootDialog = page.getByRole("dialog", { name: "Add task" });
  await expect(projectRootDialog.getByLabel("Add task project")).toHaveValue(/^project:/);
  await projectRootDialog.getByLabel("New task title").fill(projectTask);
  await projectRootDialog.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(projectRootDialog).not.toBeVisible();
  const projectSectionRegion = page.getByLabel(`Section ${projectSection}`);
  await projectSectionRegion.getByRole("button", { name: `Add task to section ${projectSection}` }).click();
  const projectSectionDialog = page.getByRole("dialog", { name: "Add task" });
  await expect(projectSectionDialog.getByLabel("Add task project")).toHaveValue(/^section:/);
  await expect(
    projectSectionDialog
      .getByLabel("Add task project")
      .locator("option", { hasText: `${project} / ${projectSection}` }),
  ).toHaveCount(1);
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

/** The main project flow creates sections and subtasks, then verifies Markdown export. */
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

  await browserHelpers.createProjectThroughUi(page)(projectTitle);
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

  await browserHelpers.createTask(page)(projectTask);
  await expect(page.getByLabel(`${projectTitle} edited tasks`).getByText(projectTask)).toBeVisible();

  await page.getByRole("button", { name: `Edit task ${projectTask}` }).click();
  await expect(page.getByLabel(`Edit ${projectTask}`)).toHaveJSProperty("tagName", "TEXTAREA");
  await page
    .getByLabel(`Move ${projectTask} to`)
    .selectOption({ label: `${projectTitle} edited / ${projectSection}` });
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
  const projectMarkdown = (await markdownPreview.locator("pre").textContent()) ?? "";
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
  await browserHelpers.createSection(page)(sectionTitle);
  await expect(page.getByRole("heading", { name: sectionTitle })).toBeVisible();

  await page.getByRole("button", { name: `Edit section ${sectionTitle}` }).click();
  await page.getByLabel("Section title").last().fill(`${sectionTitle} edited`);
  await page.getByRole("button", { name: "Save section" }).click();
  await expect(page.getByRole("heading", { name: `${sectionTitle} edited` })).toBeVisible();

  await browserHelpers.createTask(page)(inboxTask);
  await expect(page.getByRole("button", { name: inboxTask, exact: true })).toBeVisible();
  await browserHelpers.dragTaskOverProject(page)(inboxTask, `${projectTitle} edited`);
  await expect(page.getByRole("button", { name: `${projectTitle} edited`, exact: true })).toHaveClass(
    /drop-active/,
  );
  await page.getByRole("button", { name: `Edit task ${inboxTask}` }).click();
  await page.getByLabel(`Move ${inboxTask} to`).selectOption({ label: `Inbox / ${sectionTitle} edited` });
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByLabel(`Section ${sectionTitle} edited`).getByText(inboxTask)).toBeVisible();

  await browserHelpers.createTask(page)(`Loose child ${suffix}`);
  await browserHelpers.dragTaskOntoTask(page)(`Loose child ${suffix}`, inboxTask);
  await expect(
    page.getByLabel(`Section ${sectionTitle} edited`).getByText(`Loose child ${suffix}`),
  ).toBeVisible();
  await browserHelpers.dragTaskToRegion(page)(`Loose child ${suffix}`, "Inbox tasks");
  await expect(page.getByLabel("Inbox tasks").getByText(`Loose child ${suffix}`)).toBeVisible();

  const firstOrderTask = `Order first ${suffix}`;
  const secondOrderTask = `Order second ${suffix}`;

  await browserHelpers.createTasks(page)([firstOrderTask, secondOrderTask]);
  await browserHelpers.dragTaskBeforeTask(page)(secondOrderTask, firstOrderTask);
  await expect(
    page.getByLabel("Inbox tasks").locator(".task-title").filter({ hasText: secondOrderTask }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        ({ before, after }) => {
          const rows = [...document.querySelectorAll(".task-row")];
          const beforeIndex = rows.findIndex((row) => row.textContent?.includes(before));
          const afterIndex = rows.findIndex((row) => row.textContent?.includes(after));

          return beforeIndex >= 0 && afterIndex >= 0 ? beforeIndex < afterIndex : false;
        },
        { before: secondOrderTask, after: firstOrderTask },
      ),
    )
    .toBe(true);

  const firstOrderRow = page
    .locator(".task-row")
    .filter({ has: page.getByRole("button", { name: firstOrderTask, exact: true }) });
  await firstOrderRow.focus();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+ArrowRight" : "Control+ArrowRight");
  await expect(firstOrderRow).toHaveCSS("padding-left", "20px");
  await firstOrderRow.focus();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+ArrowLeft" : "Control+ArrowLeft");
  await expect(firstOrderRow).toHaveCSS("padding-left", "0px");

  const dragParent = `Drag parent ${suffix}`;
  const dragChild = `Drag child ${suffix}`;

  await browserHelpers.createTasks(page)([dragParent, dragChild]);
  await browserHelpers.dragTaskOntoTask(page)(dragChild, dragParent);
  const dragChildRow = page
    .locator(".task-row")
    .filter({ has: page.getByRole("button", { name: dragChild, exact: true }) });
  await expect(dragChildRow).toHaveCSS("padding-left", "20px");
  await browserHelpers.dragTaskLeftOnItself(page)(dragChild);
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

/** Truncate long titles and keep the project menu within the viewport. */
test("truncates long project names and keeps the project menu inside the viewport", async ({
  page,
}, testInfo) => {
  const longTitle = `A very long project name that should be truncated in the sidebar ${testInfo.workerIndex}-${Date.now()}`;
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  await browserHelpers.createProjects(page)([
    ...Array.from(
      { length: 24 },
      (_, index) => `Sidebar project ${index} ${testInfo.workerIndex}-${Date.now()}`,
    ),
    longTitle,
  ]);

  const sidebar = page.getByRole("complementary", { name: "Navigation" });
  const projectButton = sidebar.getByRole("button", { name: longTitle, exact: true });
  const projectRow = projectButton.locator("..");
  const dimensions = await projectButton.evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
    textOverflow: getComputedStyle(element).textOverflow,
    whiteSpace: getComputedStyle(element).whiteSpace,
  }));
  expect(dimensions.scrollWidth).toBeGreaterThan(dimensions.clientWidth);
  expect(dimensions.textOverflow).toBe("ellipsis");
  expect(dimensions.whiteSpace).toBe("nowrap");

  await sidebar.evaluate((element) => {
    const sidebarElement = element as HTMLElement;
    sidebarElement.scrollTop = sidebarElement.scrollHeight;
  });
  const projectMenu = projectRow.locator("details.project-menu");
  await projectMenu.locator("summary").click();
  await expect(projectMenu).toHaveClass(/opens-up/);
  const menuBounds = await projectMenu.locator(".project-menu-items").boundingBox();
  expect(menuBounds).not.toBeNull();
  expect(menuBounds!.y).toBeGreaterThanOrEqual(0);
  expect(menuBounds!.y + menuBounds!.height).toBeLessThanOrEqual(720);
});

for (const scopeName of ["Inbox", "project"] as const) {
  /** The top and bottom buttons create tasks in the correct section positions. */
  test(`adds tasks at the top and bottom of a section in ${scopeName}`, async ({ page }, testInfo) => {
    const suffix = `${scopeName}-${testInfo.workerIndex}-${Date.now()}`;
    const project =
      scopeName === "project"
        ? await createE2eApi(page.request).createProject(`Section parent ${suffix}`)
        : null;
    const sectionTitle = `Section ${suffix}`;
    const firstTitle = `First ${suffix}`;
    const secondTitle = `Second ${suffix}`;
    const topTitle = `Top ${suffix}`;
    const bottomTitle = `Bottom ${suffix}`;
    const api = createE2eApi(page.request);
    const section = await api.createSection(sectionTitle, project?.id ?? null);
    await api.createTask(firstTitle, { projectId: project?.id, sectionId: section.id });
    await api.createTask(secondTitle, { projectId: project?.id, sectionId: section.id });
    await page.goto(project === null ? "/" : `/?project=${encodeURIComponent(project.id)}`);

    const sectionRegion = page.locator(`[aria-label="Section ${sectionTitle}"]`);
    await expect(sectionRegion.locator(".task-title")).toHaveText([firstTitle, secondTitle]);
    await sectionRegion.getByRole("button", { name: `Add task to section ${sectionTitle}` }).click();
    const topDialog = page.getByRole("dialog", { name: "Add task" });
    await topDialog.getByLabel("New task title").fill(topTitle);
    await topDialog.getByRole("button", { name: "Add task", exact: true }).click();
    await expect(sectionRegion.locator(".task-title")).toHaveText([topTitle, firstTitle, secondTitle]);

    await sectionRegion
      .getByRole("button", { name: `Add task to bottom of section ${sectionTitle}` })
      .click();
    const bottomDialog = page.getByRole("dialog", { name: "Add task" });
    await bottomDialog.getByLabel("New task title").fill(bottomTitle);
    await bottomDialog.getByRole("button", { name: "Add task", exact: true }).click();
    await expect(sectionRegion.locator(".task-title")).toHaveText([
      topTitle,
      firstTitle,
      secondTitle,
      bottomTitle,
    ]);
  });
}

for (const scopeName of ["Inbox", "project"] as const) {
  /** Create project or Inbox root tasks at the beginning and end of the list. */
  test(`adds unsectioned tasks at the top and bottom of ${scopeName}`, async ({ page }, testInfo) => {
    const suffix = `root-${scopeName}-${testInfo.workerIndex}-${Date.now()}`;
    const project =
      scopeName === "project" ? await createE2eApi(page.request).createProject(`Root ${suffix}`) : null;
    const firstTitle = `First ${suffix}`;
    const secondTitle = `Second ${suffix}`;
    const topTitle = `Top ${suffix}`;
    const bottomTitle = `Bottom ${suffix}`;
    const api = createE2eApi(page.request);
    await api.createTask(firstTitle, { projectId: project?.id });
    await api.createTask(secondTitle, { projectId: project?.id });
    await page.goto(project === null ? "/" : `/?project=${encodeURIComponent(project.id)}`);

    const taskRegion = page.locator(
      project === null ? '[aria-label="Inbox tasks"]' : '[aria-label$=" tasks"]',
    );
    await expect(taskRegion.locator(".task-title")).toHaveText([firstTitle, secondTitle]);
    const topButtonName = project === null ? "Add task to Inbox" : `Add task to ${project.title}`;
    await taskRegion.getByRole("button", { name: topButtonName }).click();
    const topDialog = page.getByRole("dialog", { name: "Add task" });
    await topDialog.getByLabel("New task title").fill(topTitle);
    await topDialog.getByRole("button", { name: "Add task", exact: true }).click();
    await expect(taskRegion.locator(".task-title")).toHaveText([topTitle, firstTitle, secondTitle]);

    const bottomButtonName =
      project === null ? "Add task to bottom of Inbox" : `Add task to bottom of ${project.title}`;
    await taskRegion.getByRole("button", { name: bottomButtonName }).click();
    const bottomDialog = page.getByRole("dialog", { name: "Add task" });
    await bottomDialog.getByLabel("New task title").fill(bottomTitle);
    await bottomDialog.getByRole("button", { name: "Add task", exact: true }).click();
    await expect(taskRegion.locator(".task-title")).toHaveText([
      topTitle,
      firstTitle,
      secondTitle,
      bottomTitle,
    ]);
  });
}
