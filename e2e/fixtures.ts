import { test as base, expect } from "@playwright/test";

export const test = base.extend({
  page: async ({ page, baseURL }, use) => {
    if (baseURL === undefined) throw new Error("Playwright baseURL is required");
    const loginResponse = await page.request.post(new URL("/auth/login", baseURL).toString(), {
      data: { username: "admin", password: "todoist-e2e-password" },
    });
    const loginBody = await loginResponse.text();
    expect(loginResponse.ok(), `E2E login failed (${loginResponse.status()}): ${loginBody}`).toBe(true);
    const resetResponse = await page.request.post(new URL("/api/playwright/reset", baseURL).toString());
    const resetBody = await resetResponse.text();
    expect(resetResponse.ok(), `E2E data reset failed (${resetResponse.status()}): ${resetBody}`).toBe(true);
    await use(page);
  },
});

export { expect };
