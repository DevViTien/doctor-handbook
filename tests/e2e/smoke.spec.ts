import { expect, test } from "@playwright/test";

test.describe("smoke", () => {
  test("redirects anonymous visitors to the login page", async ({ page }) => {
    await page.goto("/patients");

    await expect(page).toHaveURL(/\/login\?next=%2Fpatients$/);
    await expect(page.getByRole("heading", { name: "Đăng nhập" })).toBeVisible();
  });

  test("serves the health endpoint", async ({ request }) => {
    const response = await request.get("/api/health");

    expect(response.ok()).toBe(true);
    expect(await response.json()).toMatchObject({ status: "ok" });
  });
});
