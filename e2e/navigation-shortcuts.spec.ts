import { expect, test } from "./fixtures";

const unique = (prefix: string) => `${prefix} ${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;

test("task dialog, inline keyboard editing, navigation, search, and calendar work", async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/");

  await page.getByRole("button", { name: "Add description" }).click();
  await page.getByLabel("Scope description").fill("Inbox description from E2E");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Inbox description from E2E")).toBeVisible();

  const project = unique("Keyboard project");
  await page.getByRole("button", { name: "Add project" }).click();
  await expect(page.getByLabel("Project title")).toBeFocused();
  await page.getByLabel("Project title").fill("cancel this project");
  await page.getByLabel("Project title").press("Escape");
  await page.getByRole("button", { name: "Add project" }).click();
  await page.getByLabel("Project title").fill(project);
  await page.getByLabel("Project title").press("Enter");
  await expect(page.getByRole("button", { name: project, exact: true })).toBeVisible();

  const taskName = unique("Keyboard task");
  await page.getByRole("button", { name: "Add task Q" }).click();
  const addDialog = page.getByRole("dialog", { name: "Add task" });
  await addDialog.getByLabel("New task title").fill(taskName);
  await addDialog.getByLabel("New task description").fill("Details from the quick add dialog");
  await addDialog.getByLabel("Add task project").selectOption({ label: project });
  await addDialog.getByRole("button", { name: /Add date/ }).click();
  const addDateDialog = page.getByRole("dialog", { name: "Add date" });
  await expect(addDateDialog.locator('[role="grid"]')).toBeVisible();
  const todayCell = addDateDialog.locator('[aria-current="date"]');
  await expect(todayCell).toBeVisible();
  await expect
    .poll(() => todayCell.evaluate((element) => getComputedStyle(element).backgroundColor))
    .toBe("rgb(255, 214, 208)");
  await addDateDialog.getByLabel("New task date").fill("2026-11-18");
  const selectedDay = addDateDialog.locator('[aria-pressed="true"]');
  await expect(selectedDay).toBeVisible();
  await expect
    .poll(() => selectedDay.evaluate((element) => getComputedStyle(element).backgroundColor))
    .toBe("rgb(214, 54, 43)");
  await addDateDialog.getByRole("button", { name: "Set date" }).click();
  await expect(addDialog).toBeVisible();
  await addDialog.getByLabel("New task labels").fill("focus, work");
  await addDialog.getByRole("button", { name: "Add task", exact: true }).click();

  await page.getByRole("button", { name: project, exact: true }).click();
  await expect(page.getByRole("button", { name: taskName, exact: true })).toBeVisible();
  await page.getByRole("button", { name: taskName, exact: true }).click();
  const details = page.getByRole("dialog", { name: `Task details: ${taskName}` });
  await page.keyboard.press("Escape");
  await expect(details).not.toBeVisible();

  await page.getByRole("button", { name: `Edit task ${taskName}` }).click();
  const taskEditor = page.getByLabel(`Edit ${taskName}`);
  await expect(taskEditor).toBeFocused();
  await taskEditor.fill("cancelled title");
  await taskEditor.press("Escape");
  await expect(page.getByRole("button", { name: taskName, exact: true })).toBeVisible();
  await page.getByRole("button", { name: `Edit task ${taskName}` }).click();
  const savedTaskName = unique("Saved task");
  await page.getByLabel(`Edit ${taskName}`).fill(savedTaskName);
  await page.getByLabel(`Edit ${taskName}`).press("Enter");
  await expect(page.getByRole("button", { name: savedTaskName, exact: true })).toBeVisible();

  await page.locator(`summary[aria-label="Project menu ${project}"]`).click();
  await expect(page.getByRole("button", { name: "Duplicate", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Duplicate", exact: true })).toHaveCount(0);
  await page.locator(`summary[aria-label="Project menu ${project}"]`).click();
  await expect(page.getByRole("button", { name: "Duplicate", exact: true })).toBeVisible();
  await page.getByRole("heading", { name: project, exact: true }).click();
  await expect(page.getByRole("button", { name: "Duplicate", exact: true })).toHaveCount(0);
  await page.locator(`summary[aria-label="Project menu ${project}"]`).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const projectEditor = page.locator('input[id^="project-edit-"]');
  await expect(projectEditor).toBeFocused();
  await projectEditor.fill("cancel project");
  await projectEditor.press("Escape");
  await expect(page.getByRole("button", { name: project, exact: true })).toBeVisible();
  await page.locator(`summary[aria-label="Project menu ${project}"]`).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const renamedProject = unique("Renamed project");
  await page.locator('input[id^="project-edit-"]').fill(renamedProject);
  await page.locator('input[id^="project-edit-"]').press("Enter");
  await expect(page.getByRole("button", { name: renamedProject, exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Inbox", exact: true }).click();
  const sectionName = unique("Section");
  await page.getByRole("button", { name: "Add section" }).click();
  await expect(page.getByLabel("Section title")).toBeFocused();
  await page.getByLabel("Section title").fill("cancel this section");
  await page.getByLabel("Section title").press("Escape");
  await page.getByRole("button", { name: "Add section" }).click();
  await page.getByLabel("Section title").fill(sectionName);
  await page.getByLabel("Section title").press("Enter");
  await page.getByRole("button", { name: `Edit section ${sectionName}` }).click();
  await expect(page.locator('input[id^="section-edit-"]')).toBeFocused();
  await page.locator('input[id^="section-edit-"]').fill("discard section");
  await page.locator('input[id^="section-edit-"]').press("Escape");
  await expect(page.getByRole("heading", { name: sectionName, exact: true })).toBeVisible();
  await page.getByRole("button", { name: `Edit section ${sectionName}` }).click();
  const renamedSection = unique("Renamed section");
  await page.locator('input[id^="section-edit-"]').fill(renamedSection);
  await page.locator('input[id^="section-edit-"]').press("Enter");
  await expect(page.getByRole("heading", { name: renamedSection, exact: true })).toBeVisible();
  const secondSectionName = unique("Ordered section");
  await page.getByRole("button", { name: "Add section" }).click();
  await page.getByLabel("Section title").fill(secondSectionName);
  await page.getByLabel("Section title").press("Enter");
  await page
    .locator(`section[aria-label="Section ${secondSectionName}"] .section-header`)
    .evaluate((source, targetName) => {
      const target = document.querySelector<HTMLElement>(
        `section[aria-label="Section ${CSS.escape(targetName)}"] .section-header`,
      );
      if (target === null) throw new Error("Section drop target was not found");
      const transfer = new DataTransfer();
      const rect = target.getBoundingClientRect();
      const clientY = rect.top + 1;
      source.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: transfer }));
      target.dispatchEvent(new DragEvent("dragenter", { bubbles: true, dataTransfer: transfer, clientY }));
      target.dispatchEvent(new DragEvent("dragover", { bubbles: true, dataTransfer: transfer, clientY }));
      target.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer: transfer, clientY }));
      source.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: transfer }));
    }, renamedSection);
  await expect
    .poll(() =>
      page
        .locator('section[aria-label^="Section "]')
        .evaluateAll(
          (sections, names: Readonly<{ first: string; second: string }>) =>
            sections.findIndex(
              (section) => section.getAttribute("aria-label") === `Section ${names.second}`,
            ) <
            sections.findIndex((section) => section.getAttribute("aria-label") === `Section ${names.first}`),
          { first: renamedSection, second: secondSectionName },
        ),
    )
    .toBe(true);

  await page.evaluate(() =>
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "л", code: "KeyK", ctrlKey: true, bubbles: true }),
    ),
  );
  await page.getByRole("textbox", { name: "Search or type a command" }).fill(renamedProject);
  await expect(
    page.locator(".search-palette .search-result").filter({ hasText: renamedProject }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+k");
  await page.getByRole("textbox", { name: "Search or type a command" }).fill(renamedSection);
  await expect(
    page.locator(".search-palette .search-result").filter({ hasText: renamedSection }),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  await page.goto("/dates");
  await expect(page.getByRole("button", { name: "Inbox", exact: true })).not.toHaveClass(/active/);
  await expect(page.getByRole("link", { name: "Dates" })).toHaveClass(/active/);
  await expect(page.getByRole("button", { name: "Copy markdown" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Preview markdown" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Dates" }).locator("svg")).toBeVisible();
  await expect(page.getByRole("link", { name: "Labels", exact: true }).locator("svg")).toBeVisible();
  await expect(page.getByRole("button", { name: savedTaskName, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Calendar" }).click();
  await expect(page.getByLabel("Calendar view")).toBeVisible();
  await expect(page.getByRole("columnheader")).toHaveText(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
  await expect(page.getByRole("gridcell")).toHaveCount(42);
  await expect(page.getByRole("button", { name: "Today", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(page.locator('.dates-calendar-day.today [aria-current="date"]')).toBeVisible();
  await page.getByLabel("Calendar month").fill("2026-11");
  const day18 = page.locator('section[aria-label="Tasks for 2026-11-18"]');
  const day19 = page.locator('section[aria-label="Tasks for 2026-11-19"]');
  await expect(day18.getByRole("button", { name: savedTaskName, exact: true })).toBeVisible();
  await day18.getByRole("button", { name: savedTaskName, exact: true }).evaluate((source) => {
    const target = document.querySelector<HTMLElement>('section[aria-label="Tasks for 2026-11-19"]');
    if (target === null) throw new Error("Calendar drop target was not found");
    const transfer = new DataTransfer();
    source.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: transfer }));
    target.dispatchEvent(new DragEvent("dragover", { bubbles: true, dataTransfer: transfer }));
    target.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer: transfer }));
    source.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: transfer }));
  });
  await expect(day19.getByRole("button", { name: savedTaskName, exact: true })).toBeVisible();
  await expect(day18.getByRole("button", { name: savedTaskName, exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "List" }).click();
  await page.goto("/labels");
  await expect(page.getByRole("button", { name: "Inbox", exact: true })).not.toHaveClass(/active/);
  await expect(page.getByRole("link", { name: "Labels", exact: true })).toHaveClass(/active/);
  await expect(page.getByRole("button", { name: "Copy markdown" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Preview markdown" })).toHaveCount(0);
  await page.getByRole("button", { name: "Inbox", exact: true }).click();
  await expect(page).toHaveURL("/");

  await page.goto("/settings");
  const settingsNav = page.getByLabel("Navigation");
  await expect(settingsNav.getByRole("link", { name: "Export" })).toHaveAttribute("href", "/export");
  await expect(settingsNav.getByRole("button", { name: /Export all/ })).toHaveCount(0);
  await expect(settingsNav.getByRole("link", { name: "Dates" })).toBeVisible();
  await expect(settingsNav.getByRole("link", { name: "Labels", exact: true })).toBeVisible();
  await expect(settingsNav.getByRole("button", { name: renamedProject })).toBeVisible();

  await page.keyboard.press("q");
  const quickDialog = page.getByRole("dialog", { name: "Add task" });
  await expect(quickDialog).toBeVisible();
  await quickDialog.getByLabel("New task title").fill(unique("Q task"));
  await quickDialog.getByRole("button", { name: "Add task", exact: true }).click();
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "й", bubbles: true })));
  await expect(page.getByRole("dialog", { name: "Add task" })).toBeVisible();
});

test("project reorder clears all drag highlight states", async ({ page }) => {
  await page.goto("/");
  const first = unique("Drag project first");
  const second = unique("Drag project second");
  for (const name of [first, second]) {
    await page.getByRole("button", { name: "Add project" }).click();
    await page.getByLabel("Project title").fill(name);
    await page.getByLabel("Project title").press("Enter");
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  }

  const firstRow = page
    .locator(".project-nav-row")
    .filter({ has: page.getByRole("button", { name: first, exact: true }) });
  const secondRow = page
    .locator(".project-nav-row")
    .filter({ has: page.getByRole("button", { name: second, exact: true }) });
  await firstRow.dragTo(secondRow);
  await expect
    .poll(() =>
      page
        .locator(
          ".project-nav-row.project-dragging, .project-nav-row.project-drop-before, .project-nav-row.project-drop-after, .project-nav-row .nav-button.drop-active",
        )
        .count(),
    )
    .toBe(0);
  await expect(page.getByRole("button", { name: first, exact: true })).not.toHaveClass(/drop-active/);
  await expect(page.getByRole("button", { name: second, exact: true })).not.toHaveClass(/drop-active/);
});
