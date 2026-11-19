import { randomBytes } from "node:crypto";

import { type Browser, expect, type Page, test } from "@playwright/test";

import { formAlert, loginAs, submitLogin } from "./fixtures/auth";
import {
  accountIdOf,
  ACCOUNTS,
  accountStatus,
  closeDatabase,
  countOwnedRows,
  countSessions,
  deleteDoctorAccounts,
  findAccountByUsername,
  hasDatabase,
  insertAccessCode,
  insertDoctor,
  insertNote,
  insertPatient,
  insertTodo,
  resetDatabase,
  setAccountStatus,
  setAvatarPath,
  setLastBackup,
  SKIP_WITHOUT_DATABASE,
  trashPatient,
} from "./fixtures/db";
import { failStorageList, listStoredObjects, putStoredObject, TINY_WEBP } from "./fixtures/storage";

/**
 * Scenarios of openspec spec account-management (changes add-account-management and
 * add-account-deletion).
 */

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

  test.describe("Số bệnh nhân và lần sao lưu trong danh sách", () => {
    test("Đếm bệnh nhân không tính thùng rác", async ({ page }) => {
      await insertPatient("lan", { fullName: "Nguyễn Văn An" });
      await insertPatient("lan", { fullName: "Trần Thị Bình" });
      await trashPatient(await insertPatient("lan", { fullName: "Lê Văn Cường" }), 1);
      await setLastBackup("lan", 2);
      await loginAs(page, "admin", PAGE);

      const lan = accountRow(page, ACCOUNTS.lan.username);
      await expect(lan).toContainText("2 bệnh nhân");
      await expect(lan).toContainText(/Sao lưu \d{2}\/\d{2}\/\d{4}/);
      await expect(page.getByRole("main")).not.toContainText(/Nguyễn Văn An|Trần Thị Bình|Cường/);
    });

    test("Chưa có bệnh nhân, chưa sao lưu", async ({ page }) => {
      await loginAs(page, "admin", PAGE);

      const minh = accountRow(page, ACCOUNTS.minh.username);
      await expect(minh).toContainText("0 bệnh nhân");
      await expect(minh).toContainText("Chưa sao lưu");
    });
  });

  test.describe("Xoá tài khoản", () => {
    const KHOA = ACCOUNTS.locked.username;
    const dialog = (page: Page) => page.getByRole("alertdialog");
    const confirmInput = (page: Page) => dialog(page).getByLabel("Gõ tên đăng nhập để xác nhận");
    const confirmButton = (page: Page) =>
      dialog(page).getByRole("button", { name: "Xoá vĩnh viễn" });

    /** A patient with a stored avatar and a note, a patient in the trash, and a to-do. */
    async function seedData(key: "lan" | "locked") {
      const withPhoto = await insertPatient(key, { fullName: `Bệnh nhân có ảnh ${key}` });
      const path = await setAvatarPath(withPhoto, `${randomBytes(16).toString("hex")}.webp`);
      await putStoredObject(`avatars/${path}`, TINY_WEBP);
      await insertNote(withPhoto, { content: "Dị ứng penicillin" });
      await trashPatient(await insertPatient(key, { fullName: `Trong thùng rác ${key}` }), 1);
      await insertTodo(key, { content: "Gọi báo kết quả" });
      return { accountId: await accountIdOf(key), avatarKey: `avatars/${path}` };
    }

    async function openDeleteDialog(page: Page) {
      await accountRow(page, KHOA).getByRole("button", { name: "Xoá", exact: true }).click();
      await expect(dialog(page)).toBeVisible();
    }

    async function deleteKhoa(page: Page) {
      await openDeleteDialog(page);
      await confirmInput(page).fill(KHOA);
      await confirmButton(page).click();
      await expect(dialog(page)).toBeHidden();
      await expect(page.getByText(`Đã xoá tài khoản ${KHOA}.`)).toBeVisible();
    }

    test("Xoá tài khoản cùng toàn bộ dữ liệu", async ({ page }) => {
      const khoa = await seedData("locked");
      await insertAccessCode({ usedBy: "locked" });
      await loginAs(page, "admin", PAGE);

      await deleteKhoa(page);

      await expect(accountRow(page, KHOA)).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "Bác sĩ" })).toBeFocused();
      expect(await countOwnedRows(khoa.accountId)).toEqual({
        accounts: 0,
        patients: 0,
        notes: 0,
        todos: 0,
        codes: 0,
      });
      expect(await listStoredObjects(`avatars/${khoa.accountId}/`)).toEqual([]);
    });

    test("Dữ liệu của bác sĩ khác còn nguyên", async ({ page }) => {
      await seedData("locked");
      const lan = await seedData("lan");
      await loginAs(page, "admin", PAGE);

      await deleteKhoa(page);

      expect(await countOwnedRows(lan.accountId)).toEqual({
        accounts: 1,
        patients: 2,
        notes: 1,
        todos: 1,
        codes: 0,
      });
      expect((await listStoredObjects(lan.avatarKey)).map((object) => object.key)).toEqual([
        lan.avatarKey,
      ]);
    });

    test("Tài khoản đang hoạt động không có nút xoá", async ({ page }) => {
      await loginAs(page, "admin", PAGE);

      const lan = accountRow(page, ACCOUNTS.lan.username);
      await expect(lan.getByRole("button", { name: "Khoá", exact: true })).toBeVisible();
      await expect(lan.getByRole("button", { name: "Cấp mã đặt lại mật khẩu" })).toBeVisible();
      await expect(lan.getByRole("button", { name: "Xoá", exact: true })).toHaveCount(0);
    });

    test("Đăng nhập bằng tài khoản đã xoá", async ({ page, browser }) => {
      await loginAs(page, "admin", PAGE);
      await deleteKhoa(page);

      const context = await browser.newContext();
      const other = await context.newPage();
      await other.goto("/login");
      await submitLogin(other, KHOA, ACCOUNTS.locked.password);
      await expect(formAlert(other)).toHaveText("Tên đăng nhập hoặc mật khẩu không đúng.");
      await context.close();
    });

    test("Dùng lại tên đăng nhập đã xoá", async ({ page, browser }) => {
      await seedData("locked");
      await loginAs(page, "admin", PAGE);
      await deleteKhoa(page);
      const { formatted } = await insertAccessCode({ recipient: "BS. Khoa mới" });

      const context = await browser.newContext();
      const doctor = await context.newPage();
      await doctor.goto("/activate");
      await doctor.getByLabel("Mã kích hoạt").fill(formatted);
      await doctor.getByRole("button", { name: "Tiếp tục" }).click();
      await doctor.getByLabel("Họ tên").fill(ACCOUNTS.locked.name);
      await doctor.getByLabel("Tên đăng nhập").fill(KHOA);
      await doctor.getByLabel("Mật khẩu", { exact: true }).fill("matkhau-moi-123");
      await doctor.getByLabel("Tôi đã đọc và đồng ý").check();
      await doctor.getByRole("button", { name: "Tạo tài khoản" }).click();

      await expect(doctor).toHaveURL(/\/patients$/);
      const account = await findAccountByUsername(KHOA);
      if (!account) throw new Error("expected the new bs.khoa account");
      expect(await countOwnedRows(String(account.id))).toMatchObject({ patients: 0, todos: 0 });
      await context.close();
    });

    test("Chưa gõ đúng thì chưa xoá được", async ({ page }) => {
      await loginAs(page, "admin", PAGE);
      await openDeleteDialog(page);

      await expect(confirmButton(page)).toBeDisabled();
      await confirmInput(page).fill("bs.kho");
      await expect(confirmButton(page)).toBeDisabled();
      await confirmInput(page).fill("BS.Khoa");
      await expect(confirmButton(page)).toBeEnabled();
    });

    test("Hộp thoại cho biết sẽ mất gì", async ({ page }) => {
      for (let i = 1; i <= 12; i += 1) await insertPatient("locked", { fullName: `BN ${i}` });
      await loginAs(page, "admin", PAGE);
      await openDeleteDialog(page);

      await expect(dialog(page)).toContainText(ACCOUNTS.locked.name);
      await expect(dialog(page)).toContainText("12 bệnh nhân");
      await expect(dialog(page)).toContainText("Chưa sao lưu");
      await expect(dialog(page)).toContainText("Không hoàn tác được");
    });

    test("Đổi ý trong hộp thoại xoá", async ({ page }) => {
      const khoa = await seedData("locked");
      await loginAs(page, "admin", PAGE);
      await openDeleteDialog(page);
      await confirmInput(page).fill(KHOA);

      await dialog(page).getByRole("button", { name: "Không xoá" }).click();

      await expect(dialog(page)).toBeHidden();
      await expect(accountRow(page, KHOA)).toContainText("Đã khoá");
      expect(await countOwnedRows(khoa.accountId)).toMatchObject({ accounts: 1, patients: 2 });
    });

    test("Tài khoản vừa được mở khoá ở nơi khác", async ({ page }) => {
      const khoa = await seedData("locked");
      await loginAs(page, "admin", PAGE);
      await openDeleteDialog(page);
      await confirmInput(page).fill(KHOA);
      await setAccountStatus("locked", "active");

      await confirmButton(page).click();

      await expect(dialog(page).getByRole("alert")).toHaveText(
        "Tài khoản đang hoạt động. Khoá trước khi xoá.",
      );
      expect(await countOwnedRows(khoa.accountId)).toMatchObject({ accounts: 1, patients: 2 });
    });

    test("Kho ảnh lỗi", async ({ page }) => {
      const khoa = await seedData("locked");
      await failStorageList();
      await loginAs(page, "admin", PAGE);
      await openDeleteDialog(page);
      await confirmInput(page).fill(KHOA);

      await confirmButton(page).click();

      await expect(dialog(page).getByRole("alert")).toHaveText(
        "Chưa xoá được tài khoản. Tài khoản vẫn bị khoá, hãy thử lại sau.",
      );
      expect(await countOwnedRows(khoa.accountId)).toEqual({
        accounts: 1,
        patients: 2,
        notes: 1,
        todos: 1,
        codes: 0,
      });
      expect(await accountStatus("locked")).toBe("locked");
      await dialog(page).getByRole("button", { name: "Đóng" }).click();
      await expect(accountRow(page, KHOA)).toContainText("Đã khoá");
    });
  });
});
