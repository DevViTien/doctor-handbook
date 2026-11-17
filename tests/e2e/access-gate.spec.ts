import { expect, test } from "@playwright/test";

/**
 * Scenarios of openspec/specs/access-gate/spec.md that need no database.
 * Scenarios with a signed-in user or a revoked session are covered once the auth module exists.
 */

test.describe("Trang cần đăng nhập chuyển tới đăng nhập", () => {
  test("Mở danh sách bệnh nhân khi chưa đăng nhập", async ({ page }) => {
    await page.goto("/patients?q=an");

    await expect(page).toHaveURL(/\/login\?next=%2Fpatients%3Fq%3Dan$/);
    await expect(page.getByRole("heading", { name: "Đăng nhập" })).toBeVisible();
  });

  test("Mở trang chính khi chưa đăng nhập", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/login$/);
  });

  test("Trang công khai không bị chặn", async ({ page }) => {
    const response = await page.goto("/login");

    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe("API cần đăng nhập trả lỗi thay vì chuyển hướng", () => {
  test("Gọi API khi chưa đăng nhập", async ({ request }) => {
    const response = await request.get("/api/backup/export", { maxRedirects: 0 });

    expect(response.status()).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: "UNAUTHENTICATED" } });
  });
});

test.describe("Không chuyển hướng ra ngoài ứng dụng", () => {
  test("Tham số next trỏ ra trang ngoài", async ({ request }) => {
    const response = await request.get("/api/auth/clear-session?next=%2F%2Fevil.com", {
      maxRedirects: 0,
    });

    expect(response.status()).toBe(307);
    expect(response.headers().location).toMatch(/\/login$/);
  });
});

test.describe("Kiểm tra sống và việc định kỳ", () => {
  test("Kiểm tra sống", async ({ request }) => {
    const response = await request.get("/api/health");

    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ status: "ok" });
  });
});
