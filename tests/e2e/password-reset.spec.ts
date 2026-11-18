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
  closeDatabase,
  countAuthAttempts,
  hasDatabase,
  insertAccessCode,
  insertCodeFailures,
  listAccessCodeRows,
  resetDatabase,
  setAccountStatus,
  SKIP_WITHOUT_DATABASE,
} from "./fixtures/db";

/** Scenarios of openspec spec password-reset (change add-password-reset). */

const INVALID_CODE =
  "Mã đặt lại mật khẩu không đúng hoặc đã hết hạn. Liên hệ quản trị viên để nhận mã mới.";
const ACTIVATION_INVALID =
  "Mã kích hoạt không đúng hoặc đã hết hạn. Liên hệ quản trị viên để nhận mã mới.";
const RATE_LIMITED = "Bạn đã thử quá nhiều lần. Vui lòng thử lại sau ít phút.";
const LOCKED = "Tài khoản đã bị khoá. Vui lòng liên hệ quản trị viên.";
const WRONG_CREDENTIALS = "Tên đăng nhập hoặc mật khẩu không đúng.";
const NEW_PASSWORD = "matkhau-moi-123";

const codeInput = (page: Page) => page.getByLabel("Mã đặt lại mật khẩu");
const newPasswordInput = (page: Page) => page.getByLabel("Mật khẩu mới", { exact: true });
const passwordStep = (page: Page) => page.getByText("Bước 2/2. Đặt mật khẩu mới.");

async function enterResetCode(page: Page, code: string) {
  await page.goto("/reset-password");
  await codeInput(page).fill(code);
  await page.getByRole("button", { name: "Tiếp tục" }).click();
}

async function submitNewPassword(page: Page, password = NEW_PASSWORD) {
  await newPasswordInput(page).fill(password);
  await page.getByRole("button", { name: "Đặt mật khẩu mới" }).click();
}

/** Logs `bs.lan` in from a fresh browser context and returns the outcome page. */
async function loginLanElsewhere(browser: Browser, password: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login");
  await submitLogin(page, ACCOUNTS.lan.username, password);
  return { context, page };
}

async function usedAt(id: string) {
  return (await listAccessCodeRows()).find((row) => row.id === id)?.used_at ?? null;
}

test.describe("password-reset", () => {
  test.skip(!hasDatabase, SKIP_WITHOUT_DATABASE);
  test.beforeEach(resetDatabase);
  test.afterAll(closeDatabase);

  test.describe("Kiểm mã đặt lại mật khẩu", () => {
    test("Nhập mã đặt lại đúng", async ({ page }) => {
      const { formatted } = await insertAccessCode({ type: "password_reset", forAccount: "lan" });
      await enterResetCode(page, formatted);

      await expect(passwordStep(page)).toBeVisible();
      await expect(page.getByText("Đặt lại mật khẩu cho bs.lan")).toBeVisible();
      await expect(page.getByText(/^Hết hạn \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/)).toBeVisible();
      await expect(newPasswordInput(page)).toBeVisible();
    });

    test("Bỏ trống mã đặt lại", async ({ page }) => {
      await page.goto("/reset-password");
      await page.getByRole("button", { name: "Tiếp tục" }).click();

      await expect(page.getByText("Nhập mã đặt lại mật khẩu.")).toBeVisible();
      expect(await countAuthAttempts()).toBe(0);
    });
  });

  test.describe("Mã đặt lại không dùng được không lộ lý do", () => {
    test("Mã đặt lại không tồn tại", async ({ page }) => {
      await enterResetCode(page, "ABCD-EFGH");
      await expect(formAlert(page)).toHaveText(INVALID_CODE);
    });

    test("Mã đặt lại đã hết hạn hoặc đã dùng", async ({ page }) => {
      const expired = await insertAccessCode({
        type: "password_reset",
        createdMinutesAgo: 72 * 60 + 1,
      });
      const used = await insertAccessCode({ type: "password_reset", usedBy: "lan" });

      await enterResetCode(page, expired.formatted);
      await expect(formAlert(page)).toHaveText(INVALID_CODE);
      await enterResetCode(page, used.formatted);
      await expect(formAlert(page)).toHaveText(INVALID_CODE);
    });

    test("Mã kích hoạt dùng ở trang đặt lại", async ({ page }) => {
      const { formatted } = await insertAccessCode({ type: "activation" });
      await enterResetCode(page, formatted);
      await expect(formAlert(page)).toHaveText(INVALID_CODE);

      await page.goto("/activate");
      await page.getByLabel("Mã kích hoạt").fill(formatted);
      await page.getByRole("button", { name: "Tiếp tục" }).click();
      await expect(page.getByText("Bước 2/2. Tạo tài khoản của bạn.")).toBeVisible();
      await expect(page.getByText(ACTIVATION_INVALID)).toHaveCount(0);
    });
  });

  test.describe("Đặt mật khẩu mới bằng mã", () => {
    test("Đặt lại thành công", async ({ page, browser }) => {
      skipWhenSecureCookiesUnsupported(page);
      const { id, formatted } = await insertAccessCode({ type: "password_reset" });
      await enterResetCode(page, formatted);
      await submitNewPassword(page);

      await expect(page).toHaveURL(/\/patients$/);
      expect(await usedAt(id)).not.toBeNull();

      const oldPassword = await loginLanElsewhere(browser, ACCOUNTS.lan.password);
      await expectLoginError(oldPassword.page, WRONG_CREDENTIALS);
      await oldPassword.context.close();
      const newPassword = await loginLanElsewhere(browser, NEW_PASSWORD);
      await expect(newPassword.page).toHaveURL(/\/patients$/);
      await newPassword.context.close();
    });

    test("Mọi thiết bị cũ bị đăng xuất", async ({ page, browser }) => {
      // Skip before opening a second context: a skip thrown later would leave it open.
      skipWhenSecureCookiesUnsupported(page);
      const otherDevice = await browser.newContext();
      const otherPage = await otherDevice.newPage();
      await loginAs(otherPage, "lan");

      const { formatted } = await insertAccessCode({ type: "password_reset" });
      await enterResetCode(page, formatted);
      await submitNewPassword(page);
      await expect(page).not.toHaveURL(/\/reset-password$/);

      await otherPage.goto("/patients");
      await expect(otherPage).toHaveURL(/\/login\?next=%2Fpatients$/);
      await otherDevice.close();
    });

    test("Mật khẩu mới quá ngắn", async ({ page, browser }) => {
      const { id, formatted } = await insertAccessCode({ type: "password_reset" });
      await enterResetCode(page, formatted);
      await submitNewPassword(page, "1234567");

      await expect(page.getByText("Mật khẩu cần tối thiểu 8 ký tự.")).toBeVisible();
      await expect(newPasswordInput(page)).toHaveAttribute("aria-invalid", "true");
      expect(await usedAt(id)).toBeNull();

      const oldPassword = await loginLanElsewhere(browser, ACCOUNTS.lan.password);
      await expect(oldPassword.page).not.toHaveURL(/\/login/);
      await oldPassword.context.close();
    });

    test("Dùng lại mã đặt lại", async ({ page, browser }) => {
      const { id, formatted } = await insertAccessCode({ type: "password_reset" });
      await enterResetCode(page, formatted);
      await submitNewPassword(page);
      await expect.poll(() => usedAt(id)).not.toBeNull();

      const other = await browser.newContext();
      const otherPage = await other.newPage();
      await enterResetCode(otherPage, formatted);
      await expect(formAlert(otherPage)).toHaveText(INVALID_CODE);
      await other.close();
    });
  });

  test.describe("Tài khoản bị khoá không đặt lại được", () => {
    test("Bị khoá sau khi được cấp mã", async ({ page }) => {
      // Locked between step 1 and step 2: the new password is refused, nothing changes.
      const { id, formatted } = await insertAccessCode({ type: "password_reset" });
      await enterResetCode(page, formatted);
      await expect(passwordStep(page)).toBeVisible();
      await setAccountStatus("lan", "locked");
      await submitNewPassword(page);

      await expect(formAlert(page)).toHaveText(LOCKED);
      expect(await usedAt(id)).toBeNull();

      // Locked when entering the code: refused at step 1 already.
      await enterResetCode(page, formatted);
      await expect(formAlert(page)).toHaveText(LOCKED);

      // Unlocked again: the code is still usable.
      await setAccountStatus("lan", "active");
      await enterResetCode(page, formatted);
      await expect(passwordStep(page)).toBeVisible();
    });
  });

  test.describe("Giới hạn nhập sai mã đặt lại", () => {
    test("Quá nhiều lần nhập mã sai", async ({ page }) => {
      const { formatted } = await insertAccessCode({ type: "password_reset" });
      await insertCodeFailures(10, 1);
      await enterResetCode(page, formatted);

      await expect(formAlert(page)).toHaveText(RATE_LIMITED);
      await expect(newPasswordInput(page)).toHaveCount(0);
    });
  });

  test.describe("Trang đặt lại mật khẩu dùng tốt trên điện thoại", () => {
    test("Thuộc tính ô nhập trang đặt lại", async ({ page }) => {
      const { formatted } = await insertAccessCode({ type: "password_reset" });
      await page.goto("/reset-password");

      const code = codeInput(page);
      await expect(code).toHaveAttribute("autocapitalize", "characters");
      await expect(code).toHaveAttribute("autocorrect", "off");
      await expect(code).toHaveAttribute("spellcheck", "false");
      await expect(code).toHaveAttribute("autocomplete", "off");

      await code.fill(formatted);
      await page.getByRole("button", { name: "Tiếp tục" }).click();
      await expect(newPasswordInput(page)).toHaveAttribute("autocomplete", "new-password");
      await expect(newPasswordInput(page)).toHaveAttribute("type", "password");
      await page.getByRole("button", { name: "Hiện mật khẩu" }).click();
      await expect(newPasswordInput(page)).toHaveAttribute("type", "text");
    });

    test("Mở trang đặt lại từ trang đăng nhập", async ({ page }) => {
      await page.goto("/login");
      await page.getByRole("link", { name: "Quên mật khẩu?" }).click();

      await expect(page).toHaveURL(/\/reset-password$/);
      await expect(codeInput(page)).toBeVisible();
      await page.getByRole("link", { name: "Đăng nhập" }).click();
      await expect(page).toHaveURL(/\/login$/);
    });

    test("Không lộ mã và mật khẩu lên URL", async ({ page }) => {
      const { id, code, formatted } = await insertAccessCode({ type: "password_reset" });
      const urls: string[] = [];
      page.on("framenavigated", (frame) => {
        if (frame === page.mainFrame()) urls.push(frame.url());
      });

      await enterResetCode(page, formatted);
      await submitNewPassword(page, "1234567");
      await expect(page.getByText("Mật khẩu cần tối thiểu 8 ký tự.")).toBeVisible();
      // Let React's form reset settle before typing again.
      await expect(newPasswordInput(page)).toBeFocused();
      await expect(newPasswordInput(page)).toHaveValue("");
      await submitNewPassword(page);
      await expect.poll(() => usedAt(id)).not.toBeNull();

      urls.push(page.url());
      for (const url of urls) {
        for (const secret of [code, formatted, "1234567", NEW_PASSWORD]) {
          expect(url).not.toContain(secret);
        }
      }
    });
  });
});
