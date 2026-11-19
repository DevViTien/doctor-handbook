import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";

import { expect, type Page, test } from "@playwright/test";

import { loginAs } from "./fixtures/auth";
import { backupZip, daysAgoIso, readDownloadedBackup, type SeedPatient } from "./fixtures/backup";
import { FAKE_STORAGE_URL } from "./fixtures/constants";
import {
  avatarPathOf,
  closeDatabase,
  hasDatabase,
  insertNote,
  insertPatient,
  listAccountNotes,
  listFeedbackRows,
  listPatientRows,
  listPatientSnapshot,
  resetDatabase,
  seedFeedback,
  setAvatarPath,
  SKIP_WITHOUT_DATABASE,
  trashPatient,
} from "./fixtures/db";
import { listStoredObjects, putStoredObject, TINY_WEBP } from "./fixtures/storage";

/** Scenarios of openspec spec data-import (change add-data-backup). */

const BROKEN = "File này không phải file sao lưu của Doctor Handbook, hoặc đã bị hỏng.";
const AN: SeedPatient = {
  fullName: "Nguyễn Văn An",
  phone: "0912 345 678",
  notes: [{ content: "HA 150/90" }],
};

const importButton = (page: Page) => page.getByRole("button", { name: "Nhập dữ liệu" });
const dialog = (page: Page) => page.getByRole("alertdialog");

async function choose(page: Page, buffer: Buffer, name = "doctor-handbook_bs.lan_2026-11-10.zip") {
  await page.locator('input[type="file"]').setInputFiles({
    name,
    mimeType: "application/zip",
    buffer,
  });
}

const names = async (key: "lan" | "minh") =>
  (await listPatientRows(key)).map((row) => row.full_name).sort();

test.describe("data-import", () => {
  test.skip(!hasDatabase, SKIP_WITHOUT_DATABASE);
  test.beforeEach(resetDatabase);
  test.afterAll(closeDatabase);

  test.describe("Chọn file và xem tóm tắt", () => {
    test("Xem tóm tắt file", async ({ page }) => {
      await insertPatient("lan", { fullName: "Trần Thị Bình" });
      await loginAs(page, "lan", "/settings/backup");
      await choose(
        page,
        backupZip({
          exportedAt: "2026-11-10T03:00:00.000Z",
          patients: [
            { fullName: "Nguyễn Văn An", notes: [{ content: "a" }, { content: "b" }] },
            { fullName: "Lê Thị Cúc", notes: [{ content: "c" }] },
          ],
        }),
      );

      await expect(
        page.getByRole("group", {
          name: "File sao lưu ngày 10/11/2026: 2 bệnh nhân, 3 ghi chú, 0 việc",
        }),
      ).toBeVisible();
      expect(await names("lan")).toEqual(["Trần Thị Bình"]);
    });

    test("File của tài khoản khác", async ({ page }) => {
      await loginAs(page, "lan", "/settings/backup");
      await choose(page, backupZip({ username: "bs.minh", patients: [AN] }));

      await expect(page.getByText("File này của tài khoản bs.minh.")).toBeVisible();
      await expect(importButton(page)).toBeEnabled();
    });
  });

  test.describe("Từ chối file không hợp lệ", () => {
    test("File hỏng", async ({ page }) => {
      await insertPatient("lan", { fullName: "Trần Thị Bình" });
      await loginAs(page, "lan", "/settings/backup");
      await choose(page, Buffer.from("this is not a backup"));

      await expect(page.getByRole("main").getByRole("alert")).toContainText(BROKEN);
      await expect(importButton(page)).toHaveCount(0);
      expect(await names("lan")).toEqual(["Trần Thị Bình"]);
    });

    test("Dữ liệu sai gửi thẳng lên server", async ({ page }) => {
      await insertPatient("lan", { fullName: "Trần Thị Bình" });
      await loginAs(page, "lan", "/settings/backup");
      // A tampered browser: the PUT carries a patient without a name.
      await page.route("**/api/backup", async (route) => {
        if (route.request().method() !== "PUT") return route.continue();
        const manifest = {
          app: "doctor-handbook",
          formatVersion: 1,
          appVersion: "0.1.0",
          exportedAt: daysAgoIso(1),
          account: { username: "bs.lan" },
          counts: { patients: 1, notes: 0, todos: 0 },
        };
        const data = {
          patients: [
            {
              id: crypto.randomUUID(),
              fullName: "",
              birthYear: null,
              birthDate: null,
              gender: null,
              hometown: null,
              phone: null,
              patientCode: null,
              summary: null,
              createdAt: daysAgoIso(2),
              updatedAt: daysAgoIso(2),
              deletedAt: null,
            },
          ],
          notes: [],
          todos: [],
        };
        return route.continue({ postData: gzipSync(JSON.stringify({ manifest, data })) });
      });
      await choose(page, backupZip({ patients: [AN] }));
      await importButton(page).click();
      const backupFile = page.waitForEvent("download");
      await dialog(page).getByRole("button", { name: "Thay thế dữ liệu" }).click();
      await backupFile;

      await expect(page.getByRole("main").getByRole("alert")).toContainText(BROKEN);
      expect(await names("lan")).toEqual(["Trần Thị Bình"]);
    });
  });

  test.describe("Phiên bản và dung lượng", () => {
    test("File của phiên bản mới hơn", async ({ page }) => {
      await loginAs(page, "lan", "/settings/backup");
      await choose(page, backupZip({ formatVersion: 99, patients: [AN] }));

      await expect(page.getByRole("main").getByRole("alert")).toContainText(
        "Vui lòng cập nhật app",
      );
      await expect(importButton(page)).toHaveCount(0);
    });

    test("File quá lớn", async ({ page }) => {
      await loginAs(page, "lan", "/settings/backup");
      // Over Playwright's in-memory limit: pass it as a file on disk.
      const big = test.info().outputPath("qua-lon.zip");
      await writeFile(big, Buffer.alloc(50 * 1024 * 1024 + 1));
      await page.locator('input[type="file"]').setInputFiles(big);
      await expect(page.getByRole("main").getByRole("alert")).toContainText(
        "File quá lớn. Dung lượng tối đa 50 MB.",
      );
    });
  });

  test.describe("Xác nhận và tự sao lưu trước khi thay", () => {
    test("Thay thế dữ liệu đang có", async ({ page }) => {
      await insertPatient("lan", { fullName: "Trần Thị Bình" });
      // Feedback is a message to the admin, not notebook data: an import never touches it.
      await seedFeedback("lan", "Góp ý trước khi nhập");
      await loginAs(page, "lan", "/settings/backup");
      await choose(page, backupZip({ patients: [AN] }));
      await importButton(page).click();

      await expect(dialog(page)).toContainText("Thay thế toàn bộ dữ liệu?");
      await expect(dialog(page)).toContainText("1 bệnh nhân, 0 ghi chú, 0 việc");
      const pending = page.waitForEvent("download");
      await dialog(page).getByRole("button", { name: "Thay thế dữ liệu" }).click();
      const preImport = await pending;
      expect(preImport.suggestedFilename()).toMatch(/_truoc-khi-nhap\.zip$/);
      const preImportData = (await readDownloadedBackup(preImport)).dataText;
      expect(preImportData).toContain("Trần Thị Bình");
      expect(preImportData).not.toContain("Góp ý trước khi nhập");

      await expect(page.getByRole("status").filter({ hasText: "Đã nhập" })).toContainText(
        "Đã nhập 1 bệnh nhân, 1 ghi chú, 0 việc.",
      );
      expect(await names("lan")).toEqual(["Nguyễn Văn An"]);
      await page.goto("/patients");
      await expect(page.getByText("Nguyễn Văn An")).toBeVisible();
      await expect(page.getByText("Trần Thị Bình")).toHaveCount(0);
      expect((await listFeedbackRows()).map((row) => row.content)).toEqual([
        "Góp ý trước khi nhập",
      ]);
    });

    test("Trang cũ không được thay dữ liệu mới mà không hỏi", async ({ page }) => {
      // Loaded while the account was empty; a patient is added elsewhere afterwards.
      await loginAs(page, "lan", "/settings/backup");
      await insertPatient("lan", { fullName: "Trần Thị Bình" });
      await choose(page, backupZip({ patients: [AN] }));
      await importButton(page).click();

      await expect(page.getByRole("main").getByRole("alert")).toContainText(
        "Sổ tay vừa có thêm dữ liệu nên chưa nhập.",
      );
      expect(await names("lan")).toEqual(["Trần Thị Bình"]);
      // The refreshed page now warns and asks before replacing.
      await choose(page, backupZip({ patients: [AN] }));
      await importButton(page).click();
      await expect(dialog(page)).toContainText("Thay thế toàn bộ dữ liệu?");
    });

    test("Đổi ý khi thay thế", async ({ page }) => {
      await insertPatient("lan", { fullName: "Trần Thị Bình" });
      await loginAs(page, "lan", "/settings/backup");
      let downloads = 0;
      page.on("download", () => (downloads += 1));
      await choose(page, backupZip({ patients: [AN] }));
      await importButton(page).click();
      await dialog(page).getByRole("button", { name: "Không nhập" }).click();

      await expect(dialog(page)).toHaveCount(0);
      expect(downloads).toBe(0);
      expect(await names("lan")).toEqual(["Trần Thị Bình"]);
    });
  });

  test.describe("Nhập tất cả hoặc không", () => {
    test("Nhập vào tài khoản trống", async ({ page }) => {
      await loginAs(page, "lan", "/settings/backup");
      let downloads = 0;
      page.on("download", () => (downloads += 1));
      await choose(page, backupZip({ patients: [AN] }));
      await importButton(page).click();

      await expect(page.getByRole("status").filter({ hasText: "Đã nhập" })).toContainText(
        "Đã nhập 1 bệnh nhân, 1 ghi chú, 0 việc.",
      );
      await expect(dialog(page)).toHaveCount(0);
      expect(downloads).toBe(0);

      await page.getByRole("link", { name: "Xem danh sách bệnh nhân" }).click();
      await page.getByRole("link", { name: /Nguyễn Văn An/ }).click();
      await expect(page.getByText("HA 150/90")).toBeVisible();
    });

    test("Mất mạng khi nhập", async ({ page }) => {
      await loginAs(page, "lan", "/settings/backup");
      await page.route("**/api/backup", (route) =>
        route.request().method() === "PUT" ? route.abort("internetdisconnected") : route.continue(),
      );
      await choose(page, backupZip({ patients: [AN] }));
      await importButton(page).click();

      await expect(page.getByRole("main").getByRole("alert")).toContainText(
        "Không nhập được vì mất mạng. Dữ liệu chưa thay đổi.",
      );
      await expect(page.getByRole("button", { name: "Thử lại" })).toBeVisible();
      expect(await names("lan")).toEqual([]);

      // Back online: "Thử lại" sends again.
      await page.unroute("**/api/backup");
      await page.getByRole("button", { name: "Thử lại" }).click();
      await expect(page.getByRole("status").filter({ hasText: "Đã nhập" })).toBeVisible();
      expect(await names("lan")).toEqual(["Nguyễn Văn An"]);
    });
  });

  test.describe("Dữ liệu nhập giữ nguyên như trong file", () => {
    test("Tìm được dữ liệu vừa nhập", async ({ page }) => {
      await loginAs(page, "lan", "/settings/backup");
      await choose(page, backupZip({ patients: [AN, { fullName: "Lê Thị Cúc" }] }));
      await importButton(page).click();
      await expect(page.getByRole("status").filter({ hasText: "Đã nhập" })).toBeVisible();

      await page.goto("/patients");
      await page.getByRole("searchbox", { name: "Tìm bệnh nhân" }).fill("0912345678");
      const results = page.getByRole("main").getByRole("list").first().getByRole("listitem");
      await expect(results).toHaveCount(1);
      await expect(results.first()).toContainText("Nguyễn Văn An");
    });

    test("Giữ ngày tháng và thùng rác", async ({ page }) => {
      await loginAs(page, "lan", "/settings/backup");
      await choose(
        page,
        backupZip({
          patients: [
            {
              fullName: "Nguyễn Văn An",
              notes: [{ content: "HA 150/90", createdAt: daysAgoIso(9), updatedAt: daysAgoIso(8) }],
            },
            { fullName: "Lê Thị Cúc", deletedAt: daysAgoIso(5) },
            // Already past the 30 days of the trash: not brought back.
            { fullName: "Phạm Văn Dũng", deletedAt: daysAgoIso(40), notes: [{ content: "cũ" }] },
          ],
        }),
      );
      await importButton(page).click();
      await expect(page.getByRole("status").filter({ hasText: "Đã nhập" })).toContainText(
        "Đã nhập 2 bệnh nhân, 1 ghi chú, 0 việc.",
      );
      expect(await names("lan")).toEqual(["Lê Thị Cúc", "Nguyễn Văn An"]);

      await page.goto("/patients");
      await page.getByRole("link", { name: /Nguyễn Văn An/ }).click();
      await expect(page.getByText("Đã sửa")).toBeVisible();
      await page.goto("/settings/trash");
      const row = page.getByRole("main").getByRole("listitem").filter({ hasText: "Lê Thị Cúc" });
      await expect(row).toContainText("còn 25 ngày");
    });

    test("Ngày sao lưu sau khi nhập", async ({ page }) => {
      await loginAs(page, "lan", "/settings/backup");
      await expect(page.getByRole("main")).toContainText("Chưa sao lưu lần nào");
      await choose(page, backupZip({ exportedAt: daysAgoIso(3), patients: [AN] }));
      await importButton(page).click();

      await expect(page.getByRole("main")).toContainText("Lần sao lưu gần nhất: 3 ngày trước");
    });

    test("Xuất rồi nhập lại giữ đủ mọi trường", async ({ page }) => {
      const an = await insertPatient("lan", {
        fullName: "Nguyễn Văn An",
        birthYear: 1979,
        birthDate: "1979-03-12",
        gender: "male",
        hometown: "Nghệ An",
        phone: "0912 345 678",
        patientCode: "BN-001",
        summary: "Dị ứng Penicillin",
        minutesAgo: 600,
      });
      const binh = await insertPatient("lan", { fullName: "Trần Thị Bình", minutesAgo: 500 });
      await insertNote(an, {
        content: "HA 150/90",
        createdAt: daysAgoIso(3),
        editedAt: daysAgoIso(2),
      });
      await insertNote(binh, { content: "Đau đầu" });
      await trashPatient(binh, 4);
      const patientsBefore = await listPatientSnapshot("lan");
      const notesBefore = await listAccountNotes("lan");

      await loginAs(page, "lan", "/settings/backup");
      const exported = page.waitForEvent("download");
      await page.getByRole("button", { name: "Tải file sao lưu" }).click();
      const file = await readDownloadedBackup(await exported);

      await choose(page, file.bytes);
      await importButton(page).click();
      const preImport = page.waitForEvent("download");
      await dialog(page).getByRole("button", { name: "Thay thế dữ liệu" }).click();
      await preImport;
      await expect(page.getByRole("status").filter({ hasText: "Đã nhập" })).toContainText(
        "Đã nhập 2 bệnh nhân, 2 ghi chú, 0 việc.",
      );

      expect(await listPatientSnapshot("lan")).toEqual(patientsBefore);
      expect(await listAccountNotes("lan")).toEqual(notesBefore);
    });
  });

  test.describe("Nhập ảnh đại diện", () => {
    test("Nhập file có ảnh", async ({ page }) => {
      const binh = await insertPatient("lan", { fullName: "Trần Thị Bình" });
      const oldPath = await setAvatarPath(binh, `${randomBytes(16).toString("hex")}.webp`);
      await putStoredObject(`avatars/${oldPath}`, TINY_WEBP);
      await loginAs(page, "lan", "/settings/backup");
      await choose(page, backupZip({ patients: [{ ...AN, image: TINY_WEBP }] }));
      await expect(page.getByRole("group", { name: /File sao lưu ngày/ })).toContainText("ảnh");
      await importButton(page).click();
      const preImport = page.waitForEvent("download");
      await dialog(page).getByRole("button", { name: "Thay thế dữ liệu" }).click();
      // The automatic backup carries the current picture too.
      expect((await readDownloadedBackup(await preImport)).images).toEqual([`images/${binh}.webp`]);
      await expect(page.getByRole("status").filter({ hasText: "Đã nhập" })).toBeVisible();

      const [an] = await listPatientRows("lan");
      if (!an) throw new Error("An was not imported");
      const newPath = await avatarPathOf(an.id);
      expect(newPath).not.toBeNull();
      expect(await listStoredObjects(`avatars/${newPath}`)).toHaveLength(1);
      await expect.poll(() => listStoredObjects(`avatars/${oldPath}`)).toEqual([]);

      await page.goto(`/patients/${an.id}`);
      const photo = page.getByRole("button", { name: "Ảnh đại diện" }).locator("img");
      await expect
        .poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth))
        .toBeGreaterThan(0);
    });

    test("Nhập file định dạng cũ không có ảnh", async ({ page }) => {
      await loginAs(page, "lan", "/settings/backup");
      await choose(page, backupZip({ formatVersion: 1, patients: [AN] }));
      await importButton(page).click();
      await expect(page.getByRole("status").filter({ hasText: "Đã nhập" })).toContainText(
        "Đã nhập 1 bệnh nhân, 1 ghi chú, 0 việc.",
      );
      const [an] = await listPatientRows("lan");
      expect(an && (await avatarPathOf(an.id))).toBeNull();
    });

    test("Mất mạng khi tải ảnh lên", async ({ page }) => {
      await insertPatient("lan", { fullName: "Trần Thị Bình" });
      await loginAs(page, "lan", "/settings/backup");
      await page.route(`${FAKE_STORAGE_URL}/**`, (route) =>
        route.request().method() === "PUT" ? route.abort("internetdisconnected") : route.continue(),
      );
      await choose(page, backupZip({ patients: [{ ...AN, image: TINY_WEBP }] }));
      await importButton(page).click();
      const preImport = page.waitForEvent("download");
      await dialog(page).getByRole("button", { name: "Thay thế dữ liệu" }).click();
      await preImport;

      const alert = page.getByRole("main").getByRole("alert");
      await expect(alert).toContainText(
        "Chưa tải được ảnh lên vì mất mạng. Dữ liệu chưa thay đổi.",
      );
      await expect(page.getByRole("button", { name: "Thử lại" })).toBeVisible();
      expect(await names("lan")).toEqual(["Trần Thị Bình"]);
    });
  });

  test.describe("Quyền nhập dữ liệu", () => {
    test("Chưa đăng nhập hoặc Admin nhập dữ liệu", async ({ page, request, baseURL }) => {
      await insertPatient("lan", { fullName: "Trần Thị Bình" });
      const body = gzipSync(JSON.stringify({ manifest: {}, data: {} }));
      const headers = { "content-type": "application/gzip", origin: baseURL ?? "" };

      const anonymous = await request.put("/api/backup", { headers, data: body });
      expect(anonymous.ok()).toBe(false);

      await loginAs(page, "admin", "/login");
      const asAdmin = await page.request.put("/api/backup", { headers, data: body });
      expect(asAdmin.status()).toBe(403);
      expect(await names("lan")).toEqual(["Trần Thị Bình"]);
    });

    test("Nhập không đụng dữ liệu bác sĩ khác", async ({ page }) => {
      await insertPatient("minh", { fullName: "Lê Văn Tâm" });
      await loginAs(page, "lan", "/settings/backup");
      await choose(page, backupZip({ username: "bs.minh", patients: [AN] }));
      await importButton(page).click();
      await expect(page.getByRole("status").filter({ hasText: "Đã nhập" })).toBeVisible();

      expect(await names("lan")).toEqual(["Nguyễn Văn An"]);
      expect(await names("minh")).toEqual(["Lê Văn Tâm"]);
    });
  });
});
