import { expect, test } from "./fixtures";

test("runs a SQL query from the development tools page", async ({ page }) => {
  await page.goto("/tools/");

  await expect(page.getByRole("heading", { name: "Database Tools" })).toBeVisible();
  await expect(page.getByLabel("Navigation").getByRole("button", { name: "Inbox" })).toBeVisible();
  await expect(page.getByLabel("Navigation").getByRole("link", { name: "Tools" })).toHaveClass(/active/);
  await expect(page.getByLabel("Navigation").getByRole("link", { name: "Export" })).toHaveAttribute(
    "href",
    "/export",
  );
  await expect(page.getByLabel("Navigation").getByRole("button", { name: /Export all/ })).toHaveCount(0);
  await page.getByLabel("PostgreSQL query").fill("SELECT 1 AS value;");
  await page.getByRole("button", { name: "Run query" }).click();

  await expect(page.getByText('"value": 1')).toBeVisible();
});
