import { type Browser, expect, type Page, test } from "@playwright/test";

import { formAlert, loginAs, submitLogin } from "./fixtures/auth";
import {
  ACCOUNTS,
  accountStatus,
  closeDatabase,
  countSessions,
  deleteDoctorAccounts,
  hasDatabase,
  insertDoctor,
  resetDatabase,
  SKIP_WITHOUT_DATABASE,
} from "./fixtures/db";

/** Scenarios of openspec spec account-management (change add-account-management). */

const PAGE = "/admin/accounts";
const LOCKED = "Tài khoản đã bị khoá. Vui lòng liên hệ quản trị viên.";

function accountRow(page: Page, username: string) {
  return page.getByRole("listitem").filter({ has: page.getByText(username, { exact: true }) });
}

/** A second device where the doctor is signed in. */
async function signedInDoctor(browser: Browser, key: "lan" | "locked") {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await loginAs(page, key);
  } catch (error) {
    // loginAs may skip the test (WebKit over HTTP): never leave this context open.
    await context.close();
    throw error;
  }
  return { context, page };
}

async function lockFromList(page: Page, username: string) {
  await accountRow(page, username).getByRole("button", { name: "Khoá", exact: true }).click();
  const dialog = page.getByRole("alertdialog");
  await dialog.getByRole("button", { name: "Khoá", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(accountRow(page, username)).toContainText("Đã khoá");
}

test.describe("account-management", () => {
  test.skip(!hasDatabase, SKIP_WITHOUT_DATABASE);
  test.beforeEach(resetDatabase);
  test.afterAll(closeDatabase);

  test.describe("Danh sách tài khoản bác sĩ", () => {
    test("Xem danh sách", async ({ page }) => {
      await insertDoctor({ username: "bs.moi", displayName: "Phạm Văn Mới" });
      await loginAs(page, "admin", PAGE);

      const lan = accountRow(page, ACCOUNTS.lan.username);
      await expect(lan).toContainText(ACCOUNTS.lan.name);
      await expect(lan).toContainText("Đang hoạt động");
      await expect(lan).toContainText(/Tạo \d{2}\/\d{2}\/\d{4}/);
      await expect(accountRow(page, ACCOUNTS.locked.username)).toContainText("Đã khoá");
      await expect(accountRow(page, "bs.moi")).toContainText(
        /Đăng nhập \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/,
      );
      // Newest first: the account inserted last is on top.
      await expect(page.getByRole("listitem").first()).toContainText("bs.moi");
    });

    test("Tài khoản Admin không có trong danh sách", async ({ page }) => {
      await loginAs(page, "admin", PAGE);

      await expect(accountRow(page, ACCOUNTS.lan.username)).toBeVisible();
      await expect(accountRow(page, ACCOUNTS.admin.username)).toHaveCount(0);
    });

    test("Bác sĩ chưa đăng nhập lần nào", async ({ page }) => {
      await insertDoctor({ username: "bs.chua", displayName: "Đỗ Thị Chưa", lastLoginAt: null });
      await loginAs(page, "admin", PAGE);

      await expect(accountRow(page, "bs.chua")).toContainText("Chưa đăng nhập");
    });

    test("Chưa có tài khoản bác sĩ nào", async ({ page }) => {
      await deleteDoctorAccounts();
      await loginAs(page, "admin", PAGE);

      await expect(page.getByText("Chưa có tài khoản bác sĩ nào")).toBeVisible();
      await page.getByRole("link", { name: "Tạo mã kích hoạt" }).click();
      await expect(page).toHaveURL(/\/admin\/access-codes$/);
    });
  });

  test.describe("Khoá tài khoản", () => {
    test("Khoá tài khoản đang dùng", async ({ page, browser }) => {
      const doctor = await signedInDoctor(browser, "lan");
      await loginAs(page, "admin", PAGE);

      await accountRow(page, ACCOUNTS.lan.username)
        .getByRole("button", { name: "Khoá", exact: true })
        .click();
      await expect(page.getByRole("alertdialog")).toContainText(
        `Khoá tài khoản của ${ACCOUNTS.lan.name}?`,
      );
      await page
        .getByRole("alertdialog")
        .getByRole("button", { name: "Khoá", exact: true })
        .click();

      await expect(accountRow(page, ACCOUNTS.lan.username)).toContainText("Đã khoá");
      expect(await accountStatus("lan")).toBe("locked");
      expect(await countSessions("lan")).toBe(0);
      await doctor.page.goto("/patients");
      await expect(doctor.page).toHaveURL(/\/login\?next=%2Fpatients$/);
      await doctor.context.close();
    });

    test("Đổi ý trong hộp thoại", async ({ page, browser }) => {
      const doctor = await signedInDoctor(browser, "lan");
      await loginAs(page, "admin", PAGE);

      await accountRow(page, ACCOUNTS.lan.username)
        .getByRole("button", { name: "Khoá", exact: true })
        .click();
      await page
        .getByRole("alertdialog")
        .getByRole("button", { name: "Không khoá", exact: true })
        .click();

      await expect(page.getByRole("alertdialog")).toBeHidden();
      await expect(accountRow(page, ACCOUNTS.lan.username)).toContainText("Đang hoạt động");
      expect(await countSessions("lan")).toBe(1);
      await doctor.page.goto("/patients");
      await expect(doctor.page).toHaveURL(/\/patients$/);
      await doctor.context.close();
    });

    test("Bị khoá thì không đăng nhập được", async ({ page, browser }) => {
      await loginAs(page, "admin", PAGE);
      await lockFromList(page, ACCOUNTS.lan.username);

      const other = await browser.newContext();
      const doctorPage = await other.newPage();
      await doctorPage.goto("/login");
      await submitLogin(doctorPage, ACCOUNTS.lan.username, ACCOUNTS.lan.password);
      await expect(formAlert(doctorPage)).toHaveText(LOCKED);
      await other.close();
    });
  });

  test.describe("Mở khoá tài khoản", () => {
    test("Mở khoá rồi đăng nhập lại", async ({ page, browser }) => {
      await loginAs(page, "admin", PAGE);

      const row = accountRow(page, ACCOUNTS.locked.username);
      await row.getByRole("button", { name: "Mở khoá", exact: true }).click();
      await expect(row).toContainText("Đang hoạt động");
      await expect(row.getByRole("button", { name: "Khoá", exact: true })).toBeVisible();
      expect(await accountStatus("locked")).toBe("active");

      const doctor = await signedInDoctor(browser, "locked");
      await expect(doctor.page).toHaveURL(/\/patients$/);
      await doctor.context.close();
    });

    test("Phiên cũ không sống lại", async ({ page, browser }) => {
      const doctor = await signedInDoctor(browser, "lan");
      await loginAs(page, "admin", PAGE);

      await lockFromList(page, ACCOUNTS.lan.username);
      await accountRow(page, ACCOUNTS.lan.username)
        .getByRole("button", { name: "Mở khoá", exact: true })
        .click();
      await expect(accountRow(page, ACCOUNTS.lan.username)).toContainText("Đang hoạt động");

      await doctor.page.goto("/patients");
      await expect(doctor.page).toHaveURL(/\/login\?next=%2Fpatients$/);
      await doctor.context.close();
    });
  });
});
