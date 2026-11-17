import { expect, test } from "@playwright/test";

import { loginAs } from "./fixtures/auth";
import {
  closeDatabase,
  hasDatabase,
  resetDatabase,
  SESSION_COOKIE,
  setAccountStatus,
  SKIP_WITHOUT_DATABASE,
} from "./fixtures/db";

/**
 * Scenarios of openspec/specs/access-gate/spec.md. The last block needs signed-in users and
 * therefore a test database (E2E_DATABASE_URL).
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

test.describe("access-gate with signed-in users", () => {
  test.skip(!hasDatabase, SKIP_WITHOUT_DATABASE);
  test.beforeEach(resetDatabase);
  test.afterAll(closeDatabase);

  test.describe("Mỗi vai trò chỉ vào khu vực của mình", () => {
    test("Admin mở danh sách bệnh nhân", async ({ page }) => {
      await loginAs(page, "admin");
      await page.goto("/patients");

      await expect(page).toHaveURL(/\/admin\/access-codes$/);
    });

    test("Bác sĩ mở khu vực quản trị", async ({ page }) => {
      await loginAs(page, "lan");
      await page.goto("/admin/accounts");

      await expect(page).toHaveURL(/\/patients$/);
    });

    test("Đã đăng nhập mở trang đăng nhập", async ({ page }) => {
      await loginAs(page, "lan");
      await page.goto("/login");

      await expect(page).toHaveURL(/\/patients$/);
    });
  });

  test.describe("Phiên không còn hiệu lực được dọn", () => {
    test("Gọi dọn phiên khi phiên còn hiệu lực", async ({ page, context }) => {
      await loginAs(page, "lan");
      await page.goto("/api/auth/clear-session");

      await expect(page).toHaveURL(/\/patients$/);
      const cookies = await context.cookies();
      expect(cookies.some((cookie) => cookie.name === SESSION_COOKIE)).toBe(true);
    });

    test("Tài khoản bị khoá khi đang đăng nhập", async ({ page, context }) => {
      await loginAs(page, "lan");
      await setAccountStatus("lan", "locked");
      await page.goto("/todos");

      await expect(page).toHaveURL(/\/login\?next=%2Ftodos$/);
      const cookies = await context.cookies();
      expect(cookies.some((cookie) => cookie.name === SESSION_COOKIE)).toBe(false);
    });
  });
});
