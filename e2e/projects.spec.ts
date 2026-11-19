import { createE2eApi } from "./api";
import { expect, test } from "./fixtures";
import * as browserHelpers from "./taskBrowserHelpers";

test.beforeEach(async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
});

/** Rename the open project title directly on the page. */
test("renames the current project inline from its heading", async ({ page }, testInfo) => {
  const projectTitle = `Inline rename ${testInfo.workerIndex}-${Date.now()}`;
  const renamedTitle = `${projectTitle} updated`;
  await page.goto("/");
  await browserHelpers.createProject(page)(projectTitle);

  await page.getByRole("button", { name: "Edit project name" }).click();
  await page.getByRole("textbox", { name: "Project title" }).fill(renamedTitle);
  await page.getByRole("button", { name: "Save", exact: true }).click();

  await expect(page.getByRole("heading", { name: renamedTitle, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: renamedTitle, exact: true })).toBeVisible();
});

/** Create subprojects and change project parents using drag and drop. */
test("creates subprojects and drags projects into and out of a parent", async ({ page }, testInfo) => {
  const suffix = `${Date.now()}-${testInfo.workerIndex}`;
  const root = `Root ${suffix}`;
  const child = `Child ${suffix}`;
  const grandchild = `Grandchild ${suffix}`;
  await page.goto("/");
  await browserHelpers.createProject(page)(root);
  await page.locator(`summary[aria-label="Project menu ${root}"]`).click();
  await page.getByRole("button", { name: "＋ Add subproject" }).click();
  await page.getByLabel("Project title").fill(child);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".project-nav-row").filter({ hasText: child })).toHaveCSS(
    "padding-inline-start",
    "18px",
  );
  await page.locator(`summary[aria-label="Project menu ${child}"]`).click();
  await page.getByRole("button", { name: "＋ Add subproject" }).click();
  await page.getByLabel("Project title").fill(grandchild);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await browserHelpers.dragProjectTo(page)(grandchild, root, 0.5);
  await expect(page.locator(".project-nav-row").filter({ hasText: grandchild })).toHaveCSS(
    "padding-inline-start",
    "18px",
  );
  await browserHelpers.dragProjectTo(page)(grandchild, root, 0.1);
  await expect(page.locator(".project-nav-row").filter({ hasText: grandchild })).toHaveCSS(
    "padding-inline-start",
    "0px",
  );
  await page.reload();
  await expect(
    page
      .locator(".project-nav-row")
      .filter({ has: page.getByRole("button", { name: grandchild, exact: true }) }),
  ).toHaveCSS("padding-inline-start", "0px");
});

/** Project reordering before or after neighbors persists after reload. */
test("reorders projects reliably before and after siblings and persists the order", async ({
  page,
}, testInfo) => {
  const suffix = `${Date.now()}-${testInfo.workerIndex}`;
  const first = `Drag first ${suffix}`;
  const middle = `Drag middle ${suffix}`;
  const last = `Drag last ${suffix}`;
  await page.goto("/");
  await browserHelpers.createProjects(page)([first, middle, last]);
  await browserHelpers.dragProjectTo(page)(last, first, 0.1);
  await expect
    .poll(() =>
      page
        .locator(".project-nav-row")
        .evaluateAll((rows) =>
          rows.map((row) => row.querySelector("button.nav-button")?.textContent?.trim()),
        ),
    )
    .toContain(first);
  const order = async () =>
    page
      .locator(".project-nav-row")
      .evaluateAll((rows) => rows.map((row) => row.querySelector("button.nav-button")?.textContent?.trim()));
  await expect
    .poll(async () => {
      const rows = await order();
      return rows.indexOf(last) < rows.indexOf(first) && rows.indexOf(first) < rows.indexOf(middle);
    })
    .toBe(true);
  await browserHelpers.dragProjectTo(page)(last, middle, 0.9);
  await expect
    .poll(async () => {
      const rows = await order();
      return rows.indexOf(first) < rows.indexOf(middle) && rows.indexOf(middle) < rows.indexOf(last);
    })
    .toBe(true);
  await page.reload();
  await expect
    .poll(async () => {
      const rows = await order();
      return rows.indexOf(first) < rows.indexOf(middle) && rows.indexOf(middle) < rows.indexOf(last);
    })
    .toBe(true);
});

/** Keep the drop highlight stable and prevent moving a project into its own descendant. */
test("keeps project drop feedback stable and blocks dragging a project into its descendant", async ({
  page,
}, testInfo) => {
  const suffix = `${Date.now()}-${testInfo.workerIndex}`;
  const parent = `Drag parent ${suffix}`;
  const child = `Drag child ${suffix}`;
  const peer = `Drag peer ${suffix}`;
  await page.goto("/");
  await browserHelpers.createProjects(page)([parent, peer]);
  await page.locator(`summary[aria-label="Project menu ${parent}"]`).click();
  await page.getByRole("button", { name: "＋ Add subproject" }).click();
  await page.getByLabel("Project title").fill(child);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await browserHelpers.showProjectDropIndicator(page)(peer, parent, 0.5);
  await expect(
    page
      .locator(`.project-nav-row[data-project-id]`)
      .filter({ has: page.getByRole("button", { name: parent, exact: true }) }),
  ).toHaveClass(/project-drop-inside/);
  await browserHelpers.dragProjectTo(page)(peer, parent, 0.5);
  await expect(
    page.locator(".project-nav-row").filter({ has: page.getByRole("button", { name: peer, exact: true }) }),
  ).toHaveCSS("padding-inline-start", "18px");
  await browserHelpers.dragProjectTo(page)(parent, child, 0.5);
  await expect(
    page.locator(".project-nav-row").filter({ has: page.getByRole("button", { name: parent, exact: true }) }),
  ).toHaveCSS("padding-inline-start", "0px");
  await expect(
    page.locator(".project-nav-row").filter({ has: page.getByRole("button", { name: child, exact: true }) }),
  ).toHaveCSS("padding-inline-start", "18px");
});

/** Verify dragging a project row with the mouse. */
test("supports real mouse dragging of project rows", async ({ page }, testInfo) => {
  const suffix = `${Date.now()}-${testInfo.workerIndex}`;
  const first = `Mouse drag first ${suffix}`;
  const second = `Mouse drag second ${suffix}`;
  await page.goto("/");
  await browserHelpers.createProjects(page)([first, second]);
  await browserHelpers.dragProjectWithMouse(page)(second, first, 0.1);
  const rows = async () =>
    page
      .locator(".project-nav-row")
      .evaluateAll((items) =>
        items.map((row) => row.querySelector("button.nav-button")?.textContent?.trim()),
      );
  await expect
    .poll(async () => {
      const order = await rows();
      return order.indexOf(second) < order.indexOf(first);
    })
    .toBe(true);
  await page.reload();
  await expect
    .poll(async () => {
      const order = await rows();
      return order.indexOf(second) < order.indexOf(first);
    })
    .toBe(true);
});

/** A touch gesture can nest a project through the mobile sidebar. */
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

  const sourceRow = page
    .locator(".project-nav-row")
    .filter({ has: page.getByRole("button", { name: sourceTitle, exact: true }) });
  const targetRow = page
    .locator(".project-nav-row")
    .filter({ has: page.getByRole("button", { name: targetTitle, exact: true }) });
  const sourceHandle = sourceRow.getByRole("button", { name: `Drag project ${sourceTitle}` });
  const sourceId = await sourceRow.getAttribute("data-project-id");
  const targetId = await targetRow.getAttribute("data-project-id");
  if (!sourceId || !targetId) throw new Error("Project rows must expose their IDs");

  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
  try {
    await sourceHandle.scrollIntoViewIfNeeded();
    const sourceBox = await sourceHandle.boundingBox();
    if (!sourceBox || !(await targetRow.boundingBox()))
      throw new Error("Mobile project drag handles must be visible");
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ id: 1, x: sourceBox.x + sourceBox.width / 2, y: sourceBox.y + sourceBox.height / 2 }],
    });
    await expect(sourceRow).toHaveClass(/project-dragging/);
    const currentTargetBox = await targetRow.boundingBox();
    if (!currentTargetBox) throw new Error("Mobile project drop target must remain visible");
    const start = {
      x: sourceBox.x + sourceBox.width / 2,
      y: sourceBox.y + sourceBox.height / 2,
    };
    const finish = {
      x: currentTargetBox.x + currentTargetBox.width / 2,
      y: currentTargetBox.y + currentTargetBox.height / 2,
    };
    for (const progress of [0.25, 0.5, 0.75, 1]) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          {
            id: 1,
            x: start.x + (finish.x - start.x) * progress,
            y: start.y + (finish.y - start.y) * progress,
          },
        ],
      });
    }
    await expect(targetRow).toHaveClass(/project-drop-inside/);
    const movedProjectResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/projects/${sourceId}/parent`) && response.request().method() === "PATCH",
    );
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    const response = await movedProjectResponse;
    expect(response.ok()).toBe(true);
    expect(await response.json()).toMatchObject({ project: { id: sourceId, parentId: targetId } });
    await expect
      .poll(() => sourceRow.evaluate((row) => getComputedStyle(row).paddingInlineStart))
      .toBe("18px");
  } finally {
    await cdp.detach();
  }
});

/** The shared mobile sidebar is consistent across routes and closes after navigation. */
test("keeps the shared mobile sidebar consistent and closes it after navigation", async ({
  page,
}, testInfo) => {
  const projectTitle = `Shared sidebar project ${Date.now()}-${testInfo.workerIndex}`;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await browserHelpers.createProject(page)(projectTitle);

  const sidebar = page.locator("aside.sidebar[aria-label='Navigation']");
  const expectSidebarClosed = async () => {
    await expect(sidebar).not.toHaveClass(/mobile-sidebar-open/);
    await expect(page.getByRole("button", { name: "Open navigation" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  };
  const selectNavigationItem = async (name: string, expectedPath: string) => {
    await expectSidebarClosed();
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(sidebar).toHaveClass(/mobile-sidebar-open/);
    const item =
      name === "Inbox"
        ? sidebar.getByRole("button", { name, exact: true })
        : sidebar.getByRole("link", { name, exact: true });
    await item.evaluate((element: HTMLElement) => element.click());
    await expect(page).toHaveURL(new RegExp(`${expectedPath.replaceAll("/", "\\/")}(?:\\?.*)?$`));
    await expectSidebarClosed();
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(sidebar.getByRole("link", { name: "Settings", exact: true })).toBeVisible();
    await expect(
      sidebar
        .locator(".project-nav-row")
        .filter({ has: page.getByRole("button", { name: projectTitle, exact: true }) })
        .getByRole("button", { name: `Drag project ${projectTitle}` }),
    ).toBeVisible();
    await sidebar
      .getByRole("button", { name: "Close navigation" })
      .evaluate((button: HTMLButtonElement) => button.click());
    await expectSidebarClosed();
  };

  await selectNavigationItem("Dates", "/dates");
  await selectNavigationItem("Tools", "/tools");
  await selectNavigationItem("Settings", "/settings");
  await selectNavigationItem("Archived projects", "/archived-projects");
  await selectNavigationItem("Inbox", "/");
});

/** Show project archive actions when the feature is enabled. */
test("shows project archiving controls when project archiving is enabled", async ({ page }, testInfo) => {
  const projectTitle = `Archivable project ${Date.now()}-${testInfo.workerIndex}`;
  await page.goto("/");
  await browserHelpers.createProject(page)(projectTitle);
  const projectRow = page
    .locator(".project-nav-row")
    .filter({ has: page.getByRole("button", { name: projectTitle, exact: true }) });
  await projectRow.getByLabel(`Project menu ${projectTitle}`).click();
  await expect(projectRow.getByRole("button", { name: "Archive", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Archived projects", exact: true }).click();
  await expect(page).toHaveURL(/\/archived-projects$/);
  await expect(page.getByRole("heading", { name: "Archived projects" })).toBeVisible();
});
