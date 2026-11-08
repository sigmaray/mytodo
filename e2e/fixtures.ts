import { expect, test as base } from "@playwright/test";

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.goto("/");
    await page.getByLabel("Login").fill("admin");
    await page.getByLabel("Password").fill("todoist-e2e-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("button", { name: "Add task Q" })).toBeVisible();
    const resetResponse = await page.request.post("/api/playwright/reset");
    const resetBody = await resetResponse.text();
    expect(resetResponse.ok(), `E2E data reset failed (${resetResponse.status()}): ${resetBody}`).toBe(true);
    await page.reload();
    await expect(page.getByRole("button", { name: "Add task Q" })).toBeVisible();
    await use(page);
  }
});

export { expect };
