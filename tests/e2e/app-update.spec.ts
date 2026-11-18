import { expect, type Page, test } from "@playwright/test";

import { loginAs } from "./fixtures/auth";
import { closeDatabase, hasDatabase, resetDatabase, SKIP_WITHOUT_DATABASE } from "./fixtures/db";

/**
 * Version skew after a deploy: a page loaded from the previous deployment sends Server Action IDs
 * the live one no longer knows (Next answers `x-nextjs-action-not-found: 1`). Simulated here by
 * answering the page's actions that way.
 */
async function answerActionsAsNewerDeployment(page: Page) {
  await page.route("**/*", async (route) => {
    const request = route.request();
    if (request.method() === "POST" && request.headers()["next-action"]) {
      await route.fulfill({
        status: 404,
        headers: { "x-nextjs-action-not-found": "1", "content-type": "text/plain" },
        body: "Server action not found.",
      });
      return;
    }
    await route.fallback();
  });
}

/** The watch is installed once the app has hydrated (it wraps `fetch`). */
async function waitForUpdateWatch(page: Page) {
  await page.waitForFunction(() => !String(window.fetch).includes("[native code]"));
}

const updateToast = (page: Page) =>
  page.getByText("Ứng dụng vừa có bản mới. Tải lại trang để lưu tiếp.");

test.describe("app-update", () => {
  // Requests that pass through a service worker escape `page.route` in WebKit.
  test.use({ serviceWorkers: "block" });

  test("Gửi form từ trang cũ hơn bản đang chạy", async ({ page }) => {
    await page.goto("/activate");
    await waitForUpdateWatch(page);
    await answerActionsAsNewerDeployment(page);
    await page.locator('[name="code"]').fill("ABCD-EFGH");
    await page.locator('[name="code"]').press("Enter");

    // The root error boundary replaces the whole page.
    await expect(page.getByText("Ứng dụng vừa có bản mới", { exact: true })).toBeVisible();
    // The page says it already: no toast repeating it on top.
    await expect(updateToast(page)).toHaveCount(0);

    // Reloading (against the live deployment again) brings the form back.
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await page.getByRole("button", { name: "Tải lại trang" }).click();
    await expect(page.locator('[name="code"]')).toBeVisible();
    await expect(updateToast(page)).toHaveCount(0);
  });

  test("Mở lại app khi đã có bản mới", async ({ page }) => {
    await page.goto("/login");
    await waitForUpdateWatch(page);
    await page.route("**/api/health", (route) =>
      route.fulfill({ json: { status: "ok", deploymentId: "dpl_newer" } }),
    );
    // What the browser fires when the doctor switches back to the app.
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await expect(updateToast(page)).toBeVisible();
  });

  test("Cùng bản thì không báo gì", async ({ page }) => {
    await page.goto("/login");
    await waitForUpdateWatch(page);
    const health = page.waitForResponse("**/api/health");
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(((await (await health).json()) as { deploymentId: string }).deploymentId).toBe(
      "dpl_e2e",
    );
    await page.waitForTimeout(300);
    await expect(updateToast(page)).toHaveCount(0);
  });

  test.describe("Bệnh nhân", () => {
    test.skip(!hasDatabase, SKIP_WITHOUT_DATABASE);
    test.beforeEach(resetDatabase);
    test.afterAll(closeDatabase);

    test("Lưu bệnh nhân từ trang cũ hơn bản đang chạy", async ({ page }) => {
      await loginAs(page, "lan", "/patients/new");
      await waitForUpdateWatch(page);
      await answerActionsAsNewerDeployment(page);
      const fullName = page.getByLabel("Họ tên");
      await fullName.fill("Trần Thị Bình");
      await page.getByRole("button", { name: "Lưu" }).click();

      await expect(page.getByRole("main")).toContainText(
        "Chưa lưu được vì ứng dụng vừa có bản mới",
      );
      await expect(fullName).toHaveValue("Trần Thị Bình");
      await expect(updateToast(page)).toBeVisible();
    });
  });
});
