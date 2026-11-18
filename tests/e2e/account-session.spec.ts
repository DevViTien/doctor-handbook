import { type BrowserContext, expect, type Page, test } from "@playwright/test";

import {
  expectLoginError,
  formAlert,
  loginAs,
  passwordInput,
  skipWhenSecureCookiesUnsupported,
  submitLogin,
  usernameInput,
} from "./fixtures/auth";
import {
  ACCOUNTS,
  closeDatabase,
  countAuthAttempts,
  hasDatabase,
  insertUsernameFailures,
  resetDatabase,
  SESSION_COOKIE,
  SKIP_WITHOUT_DATABASE,
} from "./fixtures/db";

/** Scenarios of openspec spec account-session (change add-account-login). */

const INVALID = "Tên đăng nhập hoặc mật khẩu không đúng.";
const LOCKED = "Tài khoản đã bị khoá. Vui lòng liên hệ quản trị viên.";
const RATE_LIMITED = "Bạn đã thử quá nhiều lần. Vui lòng thử lại sau ít phút.";

async function sessionCookie(context: BrowserContext) {
  return (await context.cookies()).find((cookie) => cookie.name === SESSION_COOKIE);
}

test.describe("account-session", () => {
  test.skip(!hasDatabase, SKIP_WITHOUT_DATABASE);
  test.beforeEach(resetDatabase);
  test.afterAll(closeDatabase);

  test.describe("Đăng nhập bằng tên đăng nhập và mật khẩu", () => {
    test("Bác sĩ đăng nhập đúng", async ({ page }) => {
      await loginAs(page, "lan");

      await expect(page).toHaveURL(/\/patients$/);
      await expect(page.getByRole("heading", { name: "Bệnh nhân" })).toBeVisible();
    });

    test("Admin đăng nhập đúng", async ({ page }) => {
      await loginAs(page, "admin");

      await expect(page).toHaveURL(/\/admin\/access-codes$/);
      await expect(page.getByRole("heading", { name: "Mã truy cập" })).toBeVisible();
    });

    test("Tên đăng nhập viết hoa và có khoảng trắng", async ({ page }) => {
      await page.goto("/login");
      await submitLogin(page, " BS.Lan ", ACCOUNTS.lan.password);

      await expect(page).toHaveURL(/\/patients$/);
    });

    test("Mật khẩu khác hoa thường", async ({ page }) => {
      await page.goto("/login");
      await submitLogin(page, ACCOUNTS.lan.username, ACCOUNTS.lan.password.toUpperCase());

      await expectLoginError(page, INVALID);
      await expect(page).toHaveURL(/\/login$/);
    });
  });

  test.describe("Đi tiếp tới trang đã định mở", () => {
    test("Quay lại trang đã định mở", async ({ page }) => {
      await page.goto("/todos");
      await expect(page).toHaveURL(/\/login\?next=%2Ftodos$/);

      await submitLogin(page, ACCOUNTS.lan.username, ACCOUNTS.lan.password);

      await expect(page).toHaveURL(/\/todos$/);
    });

    test("next trỏ ra ngoài", async ({ page }) => {
      await page.goto("/login?next=%2F%2Fevil.com");
      await submitLogin(page, ACCOUNTS.lan.username, ACCOUNTS.lan.password);

      await expect(page).toHaveURL(/localhost:\d+\/patients$/);
    });
  });

  test.describe("Thông báo lỗi không lộ tài khoản", () => {
    test("Sai mật khẩu", async ({ page }) => {
      await page.goto("/login");
      await submitLogin(page, ACCOUNTS.lan.username, "sai-mat-khau");

      await expectLoginError(page, INVALID);
      await expect(page).toHaveURL(/\/login$/);
    });

    test("Tên đăng nhập không tồn tại", async ({ page }) => {
      await page.goto("/login");
      await submitLogin(page, "khong.ton.tai", "bat-ky");

      await expectLoginError(page, INVALID);
    });

    test("Bỏ trống mật khẩu", async ({ page }) => {
      await page.goto("/login");
      await usernameInput(page).fill(ACCOUNTS.lan.username);
      await page.getByRole("button", { name: "Đăng nhập" }).click();

      await expect(page.getByText("Nhập mật khẩu.")).toBeVisible();
      await expect(passwordInput(page)).toHaveAttribute("aria-invalid", "true");
      expect(await countAuthAttempts()).toBe(0);
    });

    test("Giữ tên đăng nhập sau lỗi", async ({ page }) => {
      await page.goto("/login");
      await submitLogin(page, ACCOUNTS.lan.username, "sai-mat-khau");

      await expectLoginError(page, INVALID);
      await expect(usernameInput(page)).toHaveValue(ACCOUNTS.lan.username);
      await expect(passwordInput(page)).toHaveValue("");
    });
  });

  test.describe("Tài khoản bị khoá không đăng nhập được", () => {
    test("Đúng mật khẩu nhưng bị khoá", async ({ page, context }) => {
      await page.goto("/login");
      await submitLogin(page, ACCOUNTS.locked.username, ACCOUNTS.locked.password);

      await expect(formAlert(page)).toHaveText(LOCKED);
      expect(await sessionCookie(context)).toBeUndefined();
    });

    test("Sai mật khẩu khi bị khoá", async ({ page }) => {
      await page.goto("/login");
      await submitLogin(page, ACCOUNTS.locked.username, "sai-mat-khau");

      await expectLoginError(page, INVALID);
    });
  });

  test.describe("Giữ đăng nhập trên thiết bị", () => {
    test("Mở lại app", async ({ page, browser }) => {
      await loginAs(page, "lan");
      const storageState = await page.context().storageState();

      // A new browser context with the same stored cookies = closing and reopening the browser.
      const reopened = await browser.newContext({ storageState });
      const reopenedPage = await reopened.newPage();
      await reopenedPage.goto("/patients");

      await expect(reopenedPage).toHaveURL(/\/patients$/);
      await reopened.close();
    });

    test("Cookie phiên được bảo vệ", async ({ page, context }) => {
      await loginAs(page, "lan");

      const cookie = await sessionCookie(context);
      expect(cookie?.httpOnly).toBe(true);
      expect(cookie?.sameSite).toBe("Lax");
      expect(await page.evaluate(() => document.cookie)).not.toContain(SESSION_COOKIE);
    });
  });

  test.describe("Đăng xuất", () => {
    test("Bác sĩ đăng xuất", async ({ page, context }) => {
      await loginAs(page, "lan");
      await page.goto("/settings");
      await page.getByRole("button", { name: "Đăng xuất" }).click();

      await expect(page).toHaveURL(/\/login$/);
      expect(await sessionCookie(context)).toBeUndefined();
      await page.goto("/patients");
      await expect(page).toHaveURL(/\/login\?next=%2Fpatients$/);
    });

    test("Admin đăng xuất", async ({ page, context }) => {
      await loginAs(page, "admin");
      await page.getByRole("button", { name: "Đăng xuất" }).click();

      await expect(page).toHaveURL(/\/login$/);
      expect(await sessionCookie(context)).toBeUndefined();
    });

    test("Thiết bị khác vẫn đăng nhập", async ({ page, browser }) => {
      // Skip before opening a second context: a skip thrown later would leave it open.
      skipWhenSecureCookiesUnsupported(page);
      const otherDevice = await browser.newContext();
      const otherPage = await otherDevice.newPage();
      await loginAs(page, "lan");
      await loginAs(otherPage, "lan");

      await page.goto("/settings");
      await page.getByRole("button", { name: "Đăng xuất" }).click();
      await expect(page).toHaveURL(/\/login$/);

      await otherPage.goto("/patients");
      await expect(otherPage).toHaveURL(/\/patients$/);
      await otherDevice.close();
    });
  });

  test.describe("Giới hạn đăng nhập sai theo tên đăng nhập", () => {
    async function failLogins(page: Page, username: string, times: number) {
      await page.goto("/login");
      for (let i = 0; i < times; i++) {
        await submitLogin(page, username, `sai-${i}`);
        await expectLoginError(page, INVALID);
      }
    }

    test("Lần thử thứ sáu bị từ chối", async ({ page, context }) => {
      await failLogins(page, ACCOUNTS.lan.username, 5);
      await submitLogin(page, ACCOUNTS.lan.username, ACCOUNTS.lan.password);

      await expectLoginError(page, RATE_LIMITED);
      expect(await sessionCookie(context)).toBeUndefined();
    });

    test("Hết cửa sổ thì thử lại được", async ({ page }) => {
      await insertUsernameFailures("lan", 5, 16);

      await loginAs(page, "lan");
      await expect(page).toHaveURL(/\/patients$/);
    });

    test("Đăng nhập thành công xoá đếm", async ({ page }) => {
      skipWhenSecureCookiesUnsupported(page);
      await failLogins(page, ACCOUNTS.lan.username, 4);
      await submitLogin(page, ACCOUNTS.lan.username, ACCOUNTS.lan.password);
      await expect(page).toHaveURL(/\/patients$/);

      await page.goto("/settings");
      await page.getByRole("button", { name: "Đăng xuất" }).click();
      await expect(page).toHaveURL(/\/login$/);

      await failLogins(page, ACCOUNTS.lan.username, 4);
      await submitLogin(page, ACCOUNTS.lan.username, ACCOUNTS.lan.password);
      await expect(page).toHaveURL(/\/patients$/);
    });

    test("Tên khác không bị ảnh hưởng", async ({ page }) => {
      await failLogins(page, ACCOUNTS.lan.username, 5);
      await submitLogin(page, ACCOUNTS.lan.username, ACCOUNTS.lan.password);
      await expectLoginError(page, RATE_LIMITED);

      await submitLogin(page, ACCOUNTS.minh.username, ACCOUNTS.minh.password);
      await expect(page).toHaveURL(/\/patients$/);
    });
  });

  test.describe("Giới hạn đăng nhập sai theo địa chỉ IP", () => {
    test("Dò nhiều tên từ một IP", async ({ page }) => {
      await page.goto("/login");
      for (let i = 0; i < 20; i++) {
        await submitLogin(page, `do.ten.${i}`, "sai");
        await expectLoginError(page, INVALID);
      }

      await submitLogin(page, ACCOUNTS.minh.username, ACCOUNTS.minh.password);
      await expectLoginError(page, RATE_LIMITED);
    });
  });

  test.describe("Form đăng nhập dùng tốt trên điện thoại", () => {
    test("Thuộc tính ô nhập", async ({ page }) => {
      await page.goto("/login");

      const username = usernameInput(page);
      await expect(username).toHaveAttribute("autocapitalize", "none");
      await expect(username).toHaveAttribute("autocorrect", "off");
      await expect(username).toHaveAttribute("spellcheck", "false");
      await expect(username).toHaveAttribute("autocomplete", "username");
      await expect(passwordInput(page)).toHaveAttribute("autocomplete", "current-password");
    });

    test("Hiện mật khẩu", async ({ page }) => {
      await page.goto("/login");
      await passwordInput(page).fill("bi-mat");

      await page.getByRole("button", { name: "Hiện mật khẩu" }).click();
      await expect(passwordInput(page)).toHaveAttribute("type", "text");

      await page.getByRole("button", { name: "Ẩn mật khẩu" }).click();
      await expect(passwordInput(page)).toHaveAttribute("type", "password");
    });

    test("Không lộ thông tin lên URL", async ({ page }) => {
      await page.goto("/login");
      await submitLogin(page, ACCOUNTS.lan.username, "sai-mat-khau");
      await expectLoginError(page, INVALID);
      expect(page.url()).not.toContain("sai-mat-khau");
      expect(page.url()).not.toContain(ACCOUNTS.lan.username);

      await submitLogin(page, ACCOUNTS.lan.username, ACCOUNTS.lan.password);
      await expect(page).toHaveURL(/\/patients$/);
      expect(page.url()).not.toContain(ACCOUNTS.lan.password);
    });

    test("Không lộ thông tin lên URL khi JavaScript chưa chạy", async ({ browser }) => {
      const noScript = await browser.newContext({ javaScriptEnabled: false });
      const page = await noScript.newPage();
      skipWhenSecureCookiesUnsupported(page);
      await page.goto("/login");
      await submitLogin(page, ACCOUNTS.lan.username, ACCOUNTS.lan.password);

      await expect(page).toHaveURL(/\/patients$/);
      expect(page.url()).not.toContain(ACCOUNTS.lan.password);
      await noScript.close();
    });
  });
});
