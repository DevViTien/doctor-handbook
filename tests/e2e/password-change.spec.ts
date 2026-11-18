import { type Browser, expect, type Page, test } from "@playwright/test";

import {
  expectLoginError,
  formAlert,
  loginAs,
  skipWhenSecureCookiesUnsupported,
  submitLogin,
} from "./fixtures/auth";
import {
  ACCOUNTS,
  clearAuthAttempts,
  closeDatabase,
  countSessions,
  hasDatabase,
  insertUsernameFailures,
  resetDatabase,
  SKIP_WITHOUT_DATABASE,
} from "./fixtures/db";

/** Scenarios of openspec spec password-change (change add-password-change). */

const NEW_PASSWORD = "matkhau-moi-123";
const CHANGED = "Đã đổi mật khẩu. Các thiết bị khác đã bị đăng xuất.";
const WRONG_CREDENTIALS = "Tên đăng nhập hoặc mật khẩu không đúng.";
const RATE_LIMITED = "Bạn đã thử quá nhiều lần. Vui lòng thử lại sau ít phút.";

const currentInput = (page: Page) => page.getByLabel("Mật khẩu hiện tại", { exact: true });
const newInput = (page: Page) => page.getByLabel("Mật khẩu mới", { exact: true });

async function submitChange(page: Page, current: string, next: string) {
  await currentInput(page).fill(current);
  await newInput(page).fill(next);
  await page.getByRole("button", { name: "Đổi mật khẩu" }).click();
}

/** Logs `bs.lan` in from a fresh browser context and returns the outcome. */
async function loginLanElsewhere(browser: Browser, password: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login");
  await submitLogin(page, ACCOUNTS.lan.username, password);
  return { context, page };
}

test.describe("password-change", () => {
  test.skip(!hasDatabase, SKIP_WITHOUT_DATABASE);
  test.beforeEach(resetDatabase);
  test.afterAll(closeDatabase);

  test.describe("Đổi mật khẩu khi đang đăng nhập", () => {
    test("Đổi mật khẩu thành công", async ({ page, browser }) => {
      await loginAs(page, "lan", "/settings");
      await submitChange(page, ACCOUNTS.lan.password, NEW_PASSWORD);

      await expect(page.getByRole("status").filter({ hasText: CHANGED })).toBeVisible();
      await expect(currentInput(page)).toHaveValue("");
      await expect(newInput(page)).toHaveValue("");

      const oldPassword = await loginLanElsewhere(browser, ACCOUNTS.lan.password);
      await expectLoginError(oldPassword.page, WRONG_CREDENTIALS);
      await oldPassword.context.close();
      const newPassword = await loginLanElsewhere(browser, NEW_PASSWORD);
      await expect(newPassword.page).toHaveURL(/\/patients$/);
      await newPassword.context.close();
    });

    test("Thiết bị đang dùng vẫn đăng nhập, thiết bị khác bị đăng xuất", async ({
      page,
      browser,
    }) => {
      // Skip before opening a second context: a skip thrown later would leave it open.
      skipWhenSecureCookiesUnsupported(page);
      const otherDevice = await browser.newContext();
      const otherPage = await otherDevice.newPage();
      await loginAs(otherPage, "lan");
      await loginAs(page, "lan", "/settings");
      expect(await countSessions("lan")).toBe(2);

      await submitChange(page, ACCOUNTS.lan.password, NEW_PASSWORD);
      await expect(page.getByRole("status").filter({ hasText: CHANGED })).toBeVisible();

      await page.goto("/patients");
      await expect(page).toHaveURL(/\/patients$/);
      await otherPage.goto("/patients");
      await expect(otherPage).toHaveURL(/\/login\?next=%2Fpatients$/);
      expect(await countSessions("lan")).toBe(1);
      await otherDevice.close();
    });
  });

  test.describe("Kiểm mật khẩu hiện tại", () => {
    test("Mật khẩu hiện tại sai", async ({ page, browser }) => {
      await loginAs(page, "lan", "/settings");
      await submitChange(page, "sai-mat-khau", NEW_PASSWORD);

      await expect(page.getByText("Mật khẩu hiện tại không đúng.")).toBeVisible();
      await expect(currentInput(page)).toHaveAttribute("aria-invalid", "true");

      const oldPassword = await loginLanElsewhere(browser, ACCOUNTS.lan.password);
      await expect(oldPassword.page).toHaveURL(/\/patients$/);
      await oldPassword.context.close();
    });

    test("Sai quá nhiều lần", async ({ page, browser }) => {
      await loginAs(page, "lan", "/settings");
      await insertUsernameFailures("lan", 5, 1);
      await submitChange(page, ACCOUNTS.lan.password, NEW_PASSWORD);

      await expect(formAlert(page)).toHaveText(RATE_LIMITED);
      // The password did not change: the old one is still valid once the window passes.
      await clearAuthAttempts();
      const oldPassword = await loginLanElsewhere(browser, ACCOUNTS.lan.password);
      await expect(oldPassword.page).toHaveURL(/\/patients$/);
      await oldPassword.context.close();
    });
  });

  test.describe("Quy tắc mật khẩu mới", () => {
    test("Mật khẩu mới quá ngắn", async ({ page }) => {
      await loginAs(page, "lan", "/settings");
      await submitChange(page, ACCOUNTS.lan.password, "1234567");

      await expect(page.getByText("Mật khẩu cần tối thiểu 8 ký tự.")).toBeVisible();
      await expect(newInput(page)).toHaveAttribute("aria-invalid", "true");
    });

    test("Mật khẩu mới trùng mật khẩu hiện tại", async ({ page, browser }) => {
      skipWhenSecureCookiesUnsupported(page);
      const otherDevice = await browser.newContext();
      const otherPage = await otherDevice.newPage();
      await loginAs(otherPage, "lan");
      await loginAs(page, "lan", "/settings");

      await submitChange(page, ACCOUNTS.lan.password, ACCOUNTS.lan.password);

      await expect(page.getByText("Mật khẩu mới phải khác mật khẩu hiện tại.")).toBeVisible();
      expect(await countSessions("lan")).toBe(2);
      await otherDevice.close();
    });
  });

  test.describe("Form đổi mật khẩu dùng tốt trên điện thoại", () => {
    test("Thuộc tính ô đổi mật khẩu", async ({ page }) => {
      await loginAs(page, "lan", "/settings");

      await expect(currentInput(page)).toHaveAttribute("autocomplete", "current-password");
      await expect(newInput(page)).toHaveAttribute("autocomplete", "new-password");
      await expect(currentInput(page)).toHaveAttribute("type", "password");
      await expect(newInput(page)).toHaveAttribute("type", "password");
    });

    test("Không lộ mật khẩu lên URL khi đổi", async ({ page }) => {
      await loginAs(page, "lan", "/settings");
      await submitChange(page, "sai-mat-khau", NEW_PASSWORD);
      await expect(page.getByText("Mật khẩu hiện tại không đúng.")).toBeVisible();
      await expect(currentInput(page)).toBeFocused();
      await submitChange(page, ACCOUNTS.lan.password, NEW_PASSWORD);
      await expect(page.getByRole("status").filter({ hasText: CHANGED })).toBeVisible();

      for (const secret of ["sai-mat-khau", ACCOUNTS.lan.password, NEW_PASSWORD]) {
        expect(page.url()).not.toContain(secret);
      }
    });
  });
});
