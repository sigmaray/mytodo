import { expect, test } from "./fixtures";
import { createE2eApi } from "./api";

const unique = (label: string) => `${label} ${Date.now()}-${Math.random().toString(16).slice(2, 7)}`;

test("edits task details and copies all Markdown", async ({ context, page }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  page.on("dialog", (dialog) => dialog.accept());
  const api = createE2eApi(page.request);
  const projectTitle = unique("Task home");
  const project = await api.createProject(projectTitle);
  const sectionTitle = unique("Task section");
  await api.createSection(sectionTitle, project.id);
  const title = unique("Detailed task");
  await api.createTask(title, { projectId: project.id });
  await page.goto(`/?project=${encodeURIComponent(project.id)}`);
  await expect(page.getByRole("button", { name: title, exact: true })).toBeVisible();
  await page.keyboard.press("Control+k");
  const searchPalette = page.locator(".search-palette-backdrop");
  await expect(searchPalette).toBeVisible();
  expect(await searchPalette.evaluate((element) => element.parentElement === document.body)).toBe(true);
  await expect(searchPalette).toHaveCSS("z-index", "2000");
  await page.getByRole("textbox", { name: "Search or type a command" }).fill(title);
  await page.locator(".search-palette .search-result").filter({ hasText: title }).click();
  const taskDialog = page.getByRole("dialog", { name: `Task details: ${title}` });
  await expect(taskDialog.getByRole("link", { name: projectTitle, exact: true })).toBeVisible();
  await expect(taskDialog.locator(".task-details-breadcrumbs")).toHaveCount(0);
  await expect(taskDialog.locator(".task-details-header-path")).toContainText(title);
  await expect(taskDialog.locator(".task-subtasks-card")).toBeVisible();
  await expect(taskDialog.getByRole("button", { name: "Add comment" })).toHaveClass(/btn-primary/);
  await expect(taskDialog.getByRole("button", { name: "Add", exact: true })).toHaveClass(/btn-primary/);
  await taskDialog.getByRole("button", { name: "Edit task title" }).click();
  const detailTitle = page.getByLabel("Edit task title");
  await expect(detailTitle).toHaveJSProperty("tagName", "TEXTAREA");
  await detailTitle.fill("line one\nline two\nline three");
  expect(
    await detailTitle.evaluate((element) => Number.parseFloat(getComputedStyle(element).height)),
  ).toBeGreaterThan(38);
  await page.getByLabel("Edit task title").press("Escape");
  await expect(taskDialog.getByRole("button", { name: "Edit task title" })).toHaveText(title);
  await taskDialog.getByRole("button", { name: "Edit task description" }).click();
  const detailDescription = page.getByLabel("Edit task description");
  await expect(detailDescription).toHaveJSProperty("tagName", "TEXTAREA");
  await detailDescription.fill("unsaved\ndescription\nwith multiple lines");
  expect(
    await detailDescription.evaluate((element) => Number.parseFloat(getComputedStyle(element).height)),
  ).toBeGreaterThan(38);
  await page.getByLabel("Edit task description").press("Escape");
  await expect(taskDialog.getByRole("button", { name: "Edit task description" })).toHaveText(
    "Add description",
  );
  await taskDialog.getByRole("button", { name: "Edit task description" }).click();
  await page.getByLabel("Edit task description").fill("Task details saved from the dialog");
  await page.getByRole("button", { name: "Save" }).click();
  await taskDialog.getByRole("button", { name: /Add date/ }).click();
  await expect(page.getByRole("dialog", { name: "Add date" })).toBeVisible();
  const dateDialog = page.getByRole("dialog", { name: "Add date" });
  await expect(dateDialog.getByRole("button", { name: "Today" })).toBeVisible();
  await expect(dateDialog.getByRole("button", { name: "Tomorrow" })).toBeVisible();
  const todayCell = dateDialog.locator('[aria-current="date"]');
  await expect(todayCell).toBeVisible();
  await expect
    .poll(() => todayCell.evaluate((element) => getComputedStyle(element).backgroundColor))
    .toBe("rgb(255, 214, 208)");
  await dateDialog.getByRole("button", { name: "Today" }).click();
  await expect
    .poll(() =>
      dateDialog.locator('[aria-pressed="true"]').evaluate((element) => getComputedStyle(element).boxShadow),
    )
    .toContain("rgb(200, 58, 45)");
  await expect(dateDialog).toBeVisible();
  await expect(page.getByLabel("New date")).toHaveValue(new Date().toLocaleDateString("en-CA"));
  await dateDialog.getByRole("button", { name: "Save date" }).click();
  await expect(taskDialog.locator(".task-detail-date")).toHaveText("today");
  await taskDialog.locator(".task-detail-date").click();
  await expect(page.getByRole("dialog", { name: "Change date" })).toBeVisible();
  await page.getByLabel("New date").press("Escape");
  await expect(taskDialog).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Change date" })).toHaveCount(0);
  await taskDialog.locator(".task-detail-date").click();
  await page.getByLabel("New date").fill("2026-11-01");
  await page.getByRole("dialog", { name: "Change date" }).getByRole("button", { name: "Save date" }).click();
  await taskDialog.getByRole("textbox", { name: "Labels" }).fill("work");
  await page.keyboard.press("Enter");
  await expect(taskDialog.getByText("work", { exact: true })).toBeVisible();
  await taskDialog.getByRole("textbox", { name: "Labels" }).fill("review");
  await page.keyboard.press("Enter");
  const commentEditor = page.getByLabel("Add comment");
  await expect(commentEditor).toHaveJSProperty("tagName", "TEXTAREA");
  await commentEditor.fill("First\ncomment");
  expect(
    await commentEditor.evaluate((element) => Number.parseFloat(getComputedStyle(element).height)),
  ).toBeGreaterThan(38);
  await page.getByRole("button", { name: "Add comment" }).click();
  const detailSubtaskTitle = page.getByLabel("New subtask title");
  await expect(detailSubtaskTitle).toHaveJSProperty("tagName", "TEXTAREA");
  await detailSubtaskTitle.fill("Nested from details");
  await page.getByLabel("New subtask title").press("Enter");
  const locationPicker = taskDialog.getByLabel("Project, section, or Inbox");
  const optionLabels = await locationPicker.locator("option").allTextContents();
  expect(optionLabels).toEqual(
    [...optionLabels].sort(
      (left, right) =>
        left.localeCompare(right, undefined, { sensitivity: "base" }) || left.localeCompare(right),
    ),
  );
  expect(optionLabels).toContain(`${projectTitle} / ${sectionTitle}`);
  await locationPicker.selectOption({ label: `${projectTitle} / ${sectionTitle}` });
  await expect(taskDialog.locator(".task-details-header-path")).toContainText(sectionTitle);
  await expect(taskDialog.getByRole("link", { name: projectTitle, exact: true }).first()).toBeVisible();
  const projectHref = await taskDialog
    .getByRole("link", { name: projectTitle, exact: true })
    .first()
    .getAttribute("href");
  if (projectHref === null) throw new Error("Missing project navigation link");
  await page.goto(projectHref);
  await expect(
    page
      .getByRole("region", { name: `Section ${sectionTitle}` })
      .getByRole("button", { name: title, exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: title, exact: true }).click();
  const reopenedDialog = page.getByRole("dialog", { name: `Task details: ${title}` });
  await expect(reopenedDialog.getByRole("button", { name: "Edit task description" })).toHaveText(
    "Task details saved from the dialog",
  );
  await expect(reopenedDialog.locator(".task-detail-date")).toHaveAttribute("title", "Due 2026-11-01");
  await expect(reopenedDialog.locator(".label-picker-chip").nth(0)).toContainText("work");
  await expect(reopenedDialog.locator(".label-picker-chip").nth(1)).toContainText("review");
  await expect(reopenedDialog.locator(".task-comment .comment-markdown p")).toHaveText(["First", "comment"]);
  await expect(
    reopenedDialog.getByRole("button", { name: "Nested from details", exact: true }),
  ).toBeVisible();
  await reopenedDialog.getByRole("button", { name: "Nested from details", exact: true }).click();
  const childDialog = page.getByRole("dialog", { name: "Task details: Nested from details" });
  await expect(childDialog.getByRole("link", { name: title, exact: true })).toBeVisible();
  const parentHref = await childDialog.getByRole("link", { name: title, exact: true }).getAttribute("href");
  if (parentHref === null) throw new Error("Missing parent task link");
  await page.goto(parentHref);
  await expect(page.getByRole("dialog", { name: `Task details: ${title}` })).toBeVisible();
  const comment = page.locator(".task-comment");
  await comment.getByRole("button", { name: "Edit", exact: true }).click();
  await comment.locator("textarea").fill("Edited comment");
  await comment.getByRole("button", { name: "Save comment" }).click();
  await expect(comment).toContainText("Edited comment");
  await comment.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(comment).not.toBeVisible();
  await page.getByRole("button", { name: "Close task details" }).click();

  await page.goto("/dates");
  const datedTasks = page.getByLabel("Dates tasks");
  await expect(datedTasks).toContainText(title);
  await datedTasks.getByRole("link", { name: "work", exact: true }).first().click();
  await expect(page).toHaveURL(/\/labels\?label=work/);
  await expect(page.getByLabel("Label: work tasks")).toContainText(title);
  await page.getByRole("button", { name: "Inbox", exact: true }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/labels");
  const navigationProjectTitle = unique("Navigate project");
  await api.createProject(navigationProjectTitle);
  await page.goto("/dates");
  await page.getByRole("button", { name: navigationProjectTitle, exact: true }).click();
  await expect(page).toHaveURL(/\/?project=/);
  await expect(page.getByRole("heading", { name: navigationProjectTitle })).toBeVisible();

  await page.getByRole("link", { name: "Export", exact: true }).click();
  await page.getByRole("button", { name: "Copy all markdown" }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain(title);
  const copiedMarkdown = await page.evaluate(() => navigator.clipboard.readText());
  expect(copiedMarkdown).toContain(title);
  expect(copiedMarkdown.match(/^# /gm)).toHaveLength(1);
});

test("renaming projects and sections preserves their visual order after reload", async ({ page }) => {
  await page.goto("/");
  const projectNames = [unique("Order project A"), unique("Order project B"), unique("Order project C")];
  for (const name of projectNames) {
    await page.getByRole("button", { name: "Add project" }).click();
    await page.getByLabel("Project title").fill(name);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  }
  const renamedProject = `${projectNames[1]} updated`;
  await page.locator(`summary[aria-label="Project menu ${projectNames[1]}"]`).click();
  await page.locator(".project-menu[open]").getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("Project title").first().fill(renamedProject);
  await page.getByRole("button", { name: "Save project" }).click();
  await expect(page.getByRole("button", { name: renamedProject, exact: true })).toBeVisible();
  const projectRows = page.locator(".project-nav-row > .nav-button");
  const projectOrder = async () => projectRows.allTextContents();
  const verifyProjectOrder = async () => {
    const names = await projectOrder();
    expect(names.indexOf(renamedProject)).toBeGreaterThan(names.indexOf(projectNames[0]));
    expect(names.indexOf(renamedProject)).toBeLessThan(names.indexOf(projectNames[2]));
  };
  await verifyProjectOrder();
  await page.reload();
  await expect(page.getByRole("button", { name: renamedProject, exact: true })).toBeVisible();
  await verifyProjectOrder();
  const sourceProjectRow = page
    .locator(".project-nav-row")
    .filter({ has: page.getByRole("button", { name: projectNames[2], exact: true }) });
  const targetProjectRow = page
    .locator(".project-nav-row")
    .filter({ has: page.getByRole("button", { name: projectNames[0], exact: true }) });
  await sourceProjectRow.dragTo(targetProjectRow, { targetPosition: { x: 24, y: 1 } });
  await expect
    .poll(async () => {
      const names = await projectOrder();
      return names.indexOf(projectNames[2]) < names.indexOf(projectNames[0]);
    })
    .toBe(true);
  await page.reload();
  await expect(page.getByRole("button", { name: projectNames[2], exact: true })).toBeVisible();
  const persistedProjectNames = await projectOrder();
  expect(persistedProjectNames.indexOf(projectNames[2])).toBeLessThan(
    persistedProjectNames.indexOf(projectNames[0]),
  );

  await page.getByRole("button", { name: "Inbox", exact: true }).click();
  const sectionNames = [unique("Order section A"), unique("Order section B"), unique("Order section C")];
  for (const name of sectionNames) {
    await page.getByRole("button", { name: "Add section" }).click();
    await page.getByLabel("Section title").fill(name);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  }
  const renamedSection = `${sectionNames[1]} updated`;
  await page.getByRole("button", { name: `Edit section ${sectionNames[1]}` }).click();
  await page.getByLabel("Section title").last().fill(renamedSection);
  await page.getByRole("button", { name: "Save section" }).click();
  await expect(page.getByRole("heading", { name: renamedSection, exact: true })).toBeVisible();
  const sectionRows = page.locator(".board > section[aria-label^='Section '] h2");
  const verifySectionOrder = async () => {
    const names = await sectionRows.allTextContents();
    expect(names.indexOf(renamedSection)).toBeGreaterThan(names.indexOf(sectionNames[0]));
    expect(names.indexOf(renamedSection)).toBeLessThan(names.indexOf(sectionNames[2]));
  };
  await verifySectionOrder();
  await page.reload();
  await expect(page.getByRole("heading", { name: renamedSection, exact: true })).toBeVisible();
  await verifySectionOrder();
});

test("archives and restores projects, and views table records", async ({ page }) => {
  await page.goto("/");
  const title = unique("Archive candidate");
  await page.getByRole("button", { name: "Add project" }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: title, exact: true })).toBeVisible();
  const sourceDescription = unique("Original description");
  await page.getByRole("button", { name: "Add description" }).click();
  await page.getByLabel("Scope description").fill(sourceDescription);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText(sourceDescription)).toBeVisible();
  await page.getByRole("button", { name: title, exact: true }).click();
  const taskTitle = unique("Archived task");
  await page.getByRole("button", { name: "Add task Q" }).click();
  await page.getByLabel("New task title").fill(taskTitle);
  await page.getByLabel("Add task project").selectOption({ label: title });
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await page.getByRole("button", { name: `Add subtask to ${taskTitle}` }).click();
  const subtaskTitle = unique("Nested archived task");
  await page.getByLabel(`Subtask for ${taskTitle}`).fill(subtaskTitle);
  await page.getByRole("button", { name: "Add subtask", exact: true }).click();
  await page.locator(`summary[aria-label="Project menu ${title}"]`).click();
  await page.getByRole("button", { name: "Duplicate", exact: true }).click();
  const copyTitle = `${title} copy`;
  await expect(page.getByRole("button", { name: copyTitle, exact: true })).toBeVisible();
  await expect(page.locator(".project-menu[open]")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: copyTitle })).toBeVisible();
  await expect(page.getByText(sourceDescription)).toBeVisible();
  await page.getByRole("button", { name: "Edit description" }).click();
  const copiedDescription = unique("Copied description");
  await page.getByLabel("Scope description").fill(copiedDescription);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText(copiedDescription)).toBeVisible();
  await page.getByRole("button", { name: title, exact: true }).click();
  await expect(page.getByText(sourceDescription)).toBeVisible();
  await expect(page.getByText(copiedDescription)).toHaveCount(0);
  await page.getByRole("button", { name: copyTitle, exact: true }).click();
  await expect(page.getByText(copiedDescription)).toBeVisible();
  const copiedProjectTasks = page.getByLabel(`${copyTitle} tasks`);
  await expect(copiedProjectTasks).toContainText(taskTitle);
  await expect(copiedProjectTasks).toContainText(subtaskTitle);
  await page.locator(`summary[aria-label="Project menu ${copyTitle}"]`).click();
  await page
    .locator(".project-nav-row")
    .filter({ hasText: copyTitle })
    .getByRole("button", { name: "Archive", exact: true })
    .click();

  await page.getByRole("link", { name: "Archived projects" }).click();
  const archivedProject = page.locator(".archived-project").filter({ hasText: copyTitle });
  await expect(archivedProject).toBeVisible();
  await archivedProject.getByRole("button", { name: "View tasks" }).click();
  await expect(page.getByRole("region", { name: `${copyTitle} tasks` })).toContainText(taskTitle);
  await archivedProject.getByRole("button", { name: "Restore" }).click();
  await expect(archivedProject).not.toBeVisible();

  await page.goto("/tools/");
  await expect(page.getByRole("link", { name: "Dates" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Labels" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Archived projects" })).toBeVisible();
  await page.getByLabel("Table", { exact: true }).selectOption("tasks");
  await page.getByLabel("Rows to view").selectOption("100");
  await page.getByRole("button", { name: "View records" }).click();
  await expect(page.locator(".query-result")).toContainText('"count"');
  await expect(page.locator(".query-result")).toContainText('"rows"');
});
