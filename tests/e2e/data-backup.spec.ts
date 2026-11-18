import { randomBytes } from "node:crypto";

import { expect, type Page, test } from "@playwright/test";

import { loginAs } from "./fixtures/auth";
import { readDownloadedBackup, vietnamDay } from "./fixtures/backup";
import {
  closeDatabase,
  hasDatabase,
  insertNote,
  insertPatient,
  lastBackupAt,
  resetDatabase,
  setAccountCreated,
  setAvatarPath,
  setLastBackup,
  SKIP_WITHOUT_DATABASE,
  trashPatient,
} from "./fixtures/db";
import { putStoredObject, TINY_WEBP } from "./fixtures/storage";

/** Scenarios of openspec spec data-backup (change add-data-backup). */

const reminder = (page: Page) => page.getByRole("region", { name: "Nhắc sao lưu" });
const downloadButton = (page: Page) => page.getByRole("button", { name: "Tải file sao lưu" });

async function download(page: Page, click: () => Promise<void>) {
  const pending = page.waitForEvent("download");
  await click();
  return pending;
}

test.describe("data-backup", () => {
  test.skip(!hasDatabase, SKIP_WITHOUT_DATABASE);
  test.beforeEach(resetDatabase);
  test.afterAll(closeDatabase);

  test.describe("Ngày sao lưu gần nhất trong Cài đặt", () => {
    test("Chưa sao lưu lần nào", async ({ page }) => {
      await loginAs(page, "lan", "/settings");
      await expect(page.getByRole("link", { name: /Sao lưu và nhập dữ liệu/ })).toContainText(
        "Chưa sao lưu lần nào",
      );
    });

    test("Đã sao lưu 3 ngày trước", async ({ page }) => {
      await setLastBackup("lan", 3);
      await loginAs(page, "lan", "/settings");
      const link = page.getByRole("link", { name: /Sao lưu và nhập dữ liệu/ });
      await expect(link).toContainText("Lần sao lưu gần nhất: 3 ngày trước");

      await link.click();
      await expect(page).toHaveURL(/\/settings\/backup$/);
      await expect(page.getByRole("main")).toContainText("Lần sao lưu gần nhất: 3 ngày trước");
    });
  });

  test.describe("Tải file sao lưu", () => {
    test("Tải file sao lưu", async ({ page }) => {
      await loginAs(page, "lan", "/settings/backup");
      const file = await download(page, () => downloadButton(page).click());
      expect(file.suggestedFilename()).toBe(`doctor-handbook_bs.lan_${vietnamDay().iso}.zip`);
    });

    test("Mất mạng khi tải file sao lưu", async ({ page }) => {
      await setLastBackup("lan", 3);
      await loginAs(page, "lan", "/settings/backup");
      await page.route("**/api/backup", (route) => route.abort("internetdisconnected"));
      await downloadButton(page).click();

      await expect(page.getByRole("main").getByRole("alert")).toContainText(
        "Không tạo được file vì mất mạng. Thử lại khi có mạng.",
      );
      await expect(page.getByRole("main")).toContainText("Lần sao lưu gần nhất: 3 ngày trước");
    });
  });

  test.describe("Nội dung file sao lưu", () => {
    test("File có cả thùng rác", async ({ page }) => {
      const an = await insertPatient("lan", { fullName: "Nguyễn Văn An", phone: "0912 345 678" });
      const binh = await insertPatient("lan", { fullName: "Trần Thị Bình" });
      await insertNote(an, { content: "HA 150/90" });
      await insertNote(an, { content: "Tái khám" });
      await insertNote(binh, { content: "Đau đầu" });
      await trashPatient(binh, 2);

      await loginAs(page, "lan", "/settings/backup");
      await expect(page.getByRole("main")).toContainText(
        "Đang có 2 bệnh nhân (1 trong thùng rác), 3 ghi chú, 0 việc",
      );
      const backup = await readDownloadedBackup(
        await download(page, () => downloadButton(page).click()),
      );

      expect(backup.manifest.counts).toEqual({ patients: 2, notes: 3, todos: 0, images: 0 });
      expect(backup.manifest.account.username).toBe("bs.lan");
      const trashed = backup.data.patients.find((p) => p.fullName === "Trần Thị Bình");
      expect(trashed?.deletedAt).not.toBeNull();
      // Internal columns never leave the server.
      expect(backup.dataText).not.toContain("searchText");
      expect(backup.dataText).not.toContain("accountId");
    });

    test("File không có dữ liệu của bác sĩ khác", async ({ page }) => {
      await insertPatient("minh", { fullName: "Lê Văn Tâm" });
      await insertPatient("lan", { fullName: "Nguyễn Văn An" });
      await loginAs(page, "lan", "/settings/backup");
      const backup = await readDownloadedBackup(
        await download(page, () => downloadButton(page).click()),
      );

      expect(backup.dataText).toContain("Nguyễn Văn An");
      expect(backup.dataText).not.toContain("Lê Văn Tâm");
    });
  });

  test.describe("Ảnh trong file sao lưu", () => {
    test("File có ảnh", async ({ page }) => {
      const an = await insertPatient("lan", { fullName: "Nguyễn Văn An" });
      await insertPatient("lan", { fullName: "Trần Thị Bình" });
      const path = await setAvatarPath(an, `${randomBytes(16).toString("hex")}.webp`);
      await putStoredObject(`avatars/${path}`, TINY_WEBP);
      await loginAs(page, "lan", "/settings/backup");
      await expect(page.getByRole("main")).toContainText("1 ảnh");

      const backup = await readDownloadedBackup(
        await download(page, () => downloadButton(page).click()),
      );
      expect(backup.manifest.counts.images).toBe(1);
      expect(backup.images).toEqual([`images/${an}.webp`]);
      expect(backup.dataText).not.toContain(path);
    });
  });

  test.describe("Ghi lại lần sao lưu và nhắc giữ file", () => {
    test("Ghi lại ngày sao lưu", async ({ page }) => {
      await loginAs(page, "lan", "/settings/backup");
      await expect(page.getByRole("main")).toContainText("Chưa sao lưu lần nào");
      await download(page, () => downloadButton(page).click());

      await expect(page.getByRole("main")).toContainText("Lần sao lưu gần nhất: hôm nay");
      expect(await lastBackupAt("lan")).not.toBeNull();
    });

    test("Nhắc sau khi tải", async ({ page }) => {
      await loginAs(page, "lan", "/settings/backup");
      await expect(page.getByRole("main")).toContainText(
        "File chứa thông tin bệnh nhân. Giữ file cẩn thận, không gửi cho người khác.",
      );
      await download(page, () => downloadButton(page).click());

      const status = page.getByRole("status").filter({ hasText: "Đã tải file" });
      await expect(status).toContainText(
        `Đã tải file doctor-handbook_bs.lan_${vietnamDay().iso}.zip.`,
      );
      await expect(status).toContainText("Giữ file cẩn thận, không gửi cho người khác.");
    });
  });

  test.describe("Thanh nhắc sao lưu", () => {
    test("Quá 7 ngày và có thay đổi", async ({ page }) => {
      await setLastBackup("lan", 12);
      await insertPatient("lan", { fullName: "Nguyễn Văn An", minutesAgo: 60 });
      await loginAs(page, "lan", "/patients");

      await expect(reminder(page)).toContainText("Đã 12 ngày chưa sao lưu dữ liệu.");
      await expect(reminder(page)).not.toContainText("Nguyễn Văn An");
    });

    test("Chưa sao lưu lần nào, tài khoản đã cũ", async ({ page }) => {
      await setAccountCreated("lan", 10);
      await insertPatient("lan", { fullName: "Nguyễn Văn An" });
      await loginAs(page, "lan", "/patients");
      await expect(reminder(page)).toContainText("Bạn chưa sao lưu dữ liệu lần nào.");
    });

    test("Quá 7 ngày nhưng không có thay đổi", async ({ page }) => {
      await setLastBackup("lan", 12);
      await insertPatient("lan", { fullName: "Nguyễn Văn An", minutesAgo: 13 * 24 * 60 });
      await loginAs(page, "lan", "/patients");

      await expect(page.getByText("Nguyễn Văn An")).toBeVisible();
      // Not even rendered by the server (a hidden marker would be in the HTML otherwise).
      await expect(page.locator("[data-backup-reminder]")).toHaveCount(0);
    });

    test("Mới sao lưu", async ({ page }) => {
      await setLastBackup("lan", 2);
      await insertPatient("lan", { fullName: "Nguyễn Văn An", minutesAgo: 60 });
      await loginAs(page, "lan", "/patients");

      await expect(page.getByText("Nguyễn Văn An")).toBeVisible();
      // Not even rendered by the server (a hidden marker would be in the HTML otherwise).
      await expect(page.locator("[data-backup-reminder]")).toHaveCount(0);
    });

    test("Sao lưu ngay từ thanh nhắc", async ({ page }) => {
      await setLastBackup("lan", 12);
      await insertPatient("lan", { fullName: "Nguyễn Văn An" });
      await loginAs(page, "lan", "/patients");

      const file = await download(page, () =>
        reminder(page).getByRole("button", { name: "Sao lưu ngay" }).click(),
      );
      expect(file.suggestedFilename()).toMatch(/^doctor-handbook_bs\.lan_\d{4}-\d{2}-\d{2}\.zip$/);
      await expect(reminder(page)).toHaveCount(0);
      await expect(page.locator("[data-sonner-toast]")).toContainText(
        "Giữ file cẩn thận, không gửi cho người khác.",
      );

      await page.goto("/settings");
      await expect(page.getByRole("link", { name: /Sao lưu và nhập dữ liệu/ })).toContainText(
        "Lần sao lưu gần nhất: hôm nay",
      );
    });

    test("Để mai", async ({ page }) => {
      await setLastBackup("lan", 12);
      await insertPatient("lan", { fullName: "Nguyễn Văn An" });
      await loginAs(page, "lan", "/patients");
      await reminder(page)
        .getByRole("button", { name: /Để mai/ })
        .click();
      await expect(reminder(page)).toHaveCount(0);

      await page.reload();
      // Hydrated and read back from this device: due, but snoozed.
      await expect(page.locator('[data-backup-reminder="hidden"]')).toBeAttached();
      await expect(reminder(page)).toHaveCount(0);
    });
  });

  test.describe("Quyền tải sao lưu", () => {
    test("Chưa đăng nhập hoặc Admin tải sao lưu", async ({ page, request }) => {
      await insertPatient("lan", { fullName: "Nguyễn Văn An" });

      const anonymous = await request.get("/api/backup");
      expect(anonymous.ok()).toBe(false);
      expect(await anonymous.text()).not.toContain("Nguyễn Văn An");

      await loginAs(page, "admin", "/login");
      const asAdmin = await page.request.get("/api/backup");
      expect(asAdmin.status()).toBe(403);
      expect(await asAdmin.text()).not.toContain("Nguyễn Văn An");
    });
  });
});
