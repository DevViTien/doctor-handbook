import { expect, type Page, type Route, test } from "@playwright/test";

import { loginAs } from "./fixtures/auth";
import { E2E_CRON_SECRET } from "./fixtures/constants";
import {
  closeDatabase,
  findPatient,
  hasDatabase,
  insertNote,
  insertPatient,
  listNoteRows,
  resetDatabase,
  SKIP_WITHOUT_DATABASE,
  trashPatient,
} from "./fixtures/db";

/** Scenarios of openspec spec patient-trash (change add-patient-trash). */

const NOT_FOUND = "Không tìm thấy bệnh nhân";
const MOVED = "Đã chuyển bệnh nhân vào thùng rác.";
const listRows = (page: Page) =>
  page.getByRole("main").getByRole("list").first().getByRole("listitem");

async function moveToTrashFromDetail(page: Page, patientId: string) {
  await loginAs(page, "lan", `/patients/${patientId}`);
  await page.getByRole("button", { name: "Thêm thao tác" }).click();
  await page.getByRole("menuitem", { name: "Chuyển vào thùng rác" }).click();
  await expect(page).toHaveURL(/\/patients$/);
}

test.describe("patient-trash", () => {
  test.skip(!hasDatabase, SKIP_WITHOUT_DATABASE);
  test.beforeEach(resetDatabase);
  test.afterAll(closeDatabase);

  let an: string;
  let binh: string;
  test.beforeEach(async () => {
    an = await insertPatient("lan", {
      fullName: "Nguyễn Văn An",
      hometown: "Nghệ An",
      minutesAgo: 30,
    });
    binh = await insertPatient("lan", { fullName: "Trần Thị Bình", minutesAgo: 20 });
  });

  test.describe("Chuyển vào thùng rác", () => {
    test("Chuyển vào thùng rác", async ({ page }) => {
      await moveToTrashFromDetail(page, an);

      await expect(listRows(page)).toHaveCount(1);
      await expect(page.getByText("Nguyễn Văn An")).toHaveCount(0);
      await page.goto(`/patients/${an}`);
      await expect(page.getByText(NOT_FOUND)).toBeVisible();
      expect((await findPatient(an))?.deleted_at).not.toBeNull();
    });

    test("Bệnh nhân trong thùng rác không hiện khi tìm", async ({ page }) => {
      await insertNote(an, { content: "Dị ứng Penicillin" });
      await trashPatient(an, 0);
      await loginAs(page, "lan", "/patients");
      await page.getByRole("searchbox", { name: "Tìm bệnh nhân" }).fill("penicillin");

      await expect(page.getByText("Không thấy bệnh nhân nào khớp")).toBeVisible();
    });

    test("Hoàn tác", async ({ page }) => {
      await moveToTrashFromDetail(page, an);
      const notice = page.getByText(MOVED);
      await expect(notice).toBeVisible();
      const toast = page.locator("[data-sonner-toast]").filter({ hasText: MOVED });
      await expect(toast).not.toContainText("Nguyễn Văn An");

      await toast.getByRole("button", { name: "Hoàn tác" }).click();
      await expect(page.getByText("Đã khôi phục bệnh nhân.")).toBeVisible();
      await expect(listRows(page)).toHaveCount(2);
      await expect(listRows(page).filter({ hasText: "Nguyễn Văn An" })).toHaveCount(1);
      expect((await findPatient(an))?.deleted_at).toBeNull();
    });
  });

  test.describe("Trang thùng rác", () => {
    test("Xem thùng rác", async ({ page }) => {
      await moveToTrashFromDetail(page, an);
      await page.goto("/settings");
      const trashLink = page.getByRole("link", { name: /Thùng rác/ });
      await expect(trashLink).toContainText("1 bệnh nhân");

      await trashLink.click();
      await expect(page).toHaveURL(/\/settings\/trash$/);
      const rows = listRows(page);
      await expect(rows).toHaveCount(1);
      await expect(rows.first()).toContainText("Nguyễn Văn An");
      await expect(rows.first()).toContainText("còn 30 ngày");
    });

    test("Thùng rác trống", async ({ page }) => {
      await loginAs(page, "lan", "/settings/trash");
      await expect(page.getByText("Thùng rác trống")).toBeVisible();
    });

    test("Khôi phục giữ nguyên ghi chú", async ({ page }) => {
      await insertNote(an, { content: "HA 150/90" });
      await trashPatient(an, 2);
      await loginAs(page, "lan", "/settings/trash");
      await page.getByRole("button", { name: "Khôi phục Nguyễn Văn An" }).click();

      await expect(page.getByText("Đã khôi phục bệnh nhân.")).toBeVisible();
      await expect(page.getByText("Thùng rác trống")).toBeVisible();
      await page.goto("/patients");
      await expect(listRows(page).first()).toContainText("Nguyễn Văn An");
      await page.goto(`/patients/${an}`);
      await expect(page.getByText("HA 150/90")).toBeVisible();
    });

    test("Xoá vĩnh viễn", async ({ page }) => {
      await insertNote(an, { content: "HA 150/90" });
      await trashPatient(an, 1);
      await loginAs(page, "lan", "/settings/trash");
      await page.getByRole("button", { name: "Xoá vĩnh viễn Nguyễn Văn An" }).click();

      const dialog = page.getByRole("alertdialog");
      await expect(dialog).toContainText("Nguyễn Văn An");
      await expect(dialog).toContainText("không khôi phục được");
      await dialog.getByRole("button", { name: "Xoá vĩnh viễn" }).click();

      await expect(page.getByText("Thùng rác trống")).toBeVisible();
      expect(await findPatient(an)).toBeUndefined();
      expect(await listNoteRows(an)).toHaveLength(0);
    });

    test("Đổi ý khi xoá vĩnh viễn", async ({ page }) => {
      await trashPatient(an, 1);
      await loginAs(page, "lan", "/settings/trash");
      await page.getByRole("button", { name: "Xoá vĩnh viễn Nguyễn Văn An" }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Không xoá" }).click();

      await expect(page.getByRole("alertdialog")).toHaveCount(0);
      await expect(listRows(page).first()).toContainText("Nguyễn Văn An");
      expect(await findPatient(an)).toBeDefined();
    });
  });

  test.describe("Tự xoá hẳn sau 30 ngày", () => {
    test("Quá 30 ngày", async ({ page, request }) => {
      await insertNote(an, { content: "HA 150/90" });
      await trashPatient(an, 31);
      await loginAs(page, "lan", "/settings/trash");
      // Expired: already hidden, before the purge even runs.
      await expect(page.getByText("Thùng rác trống")).toBeVisible();

      const cron = await request.get("/api/cron/daily-maintenance", {
        headers: { Authorization: `Bearer ${E2E_CRON_SECRET}` },
      });
      expect(cron.ok()).toBe(true);
      expect(await cron.json()).toMatchObject({ purgedPatients: 1 });
      expect(await findPatient(an)).toBeUndefined();
      expect(await listNoteRows(an)).toHaveLength(0);
    });

    test("Ngày cuối cùng", async ({ page, request }) => {
      await trashPatient(binh, 29.5);
      await loginAs(page, "lan", "/settings/trash");
      await expect(listRows(page).first()).toContainText("Trần Thị Bình");
      await expect(listRows(page).first()).toContainText("còn 1 ngày");

      const cron = await request.get("/api/cron/daily-maintenance", {
        headers: { Authorization: `Bearer ${E2E_CRON_SECRET}` },
      });
      expect(await cron.json()).toMatchObject({ purgedPatients: 0 });
      expect(await findPatient(binh)).toBeDefined();
    });
  });

  test.describe("Thùng rác tách theo bác sĩ", () => {
    test("Thùng rác của bác sĩ khác", async ({ page }) => {
      await trashPatient(an, 1);
      await loginAs(page, "minh", "/settings/trash");
      await expect(page.getByText("Thùng rác trống")).toBeVisible();
      await expect(page.getByText("Nguyễn Văn An")).toHaveCount(0);
    });

    test("Chuyển vào thùng rác và khôi phục bệnh nhân của bác sĩ khác", async ({ page }) => {
      const minhLive = await insertPatient("minh", { fullName: "Lê Văn Tâm" });
      const minhTrashed = await insertPatient("minh", { fullName: "Đỗ Thị Hoa" });
      await trashPatient(minhTrashed, 1);
      await trashPatient(binh, 1);
      // Tampered clients: bs.minh's own buttons, posting bs.lan's patient ids.
      const swap = (from: string, to: string) => async (route: Route) => {
        const body = route.request().postData();
        if (route.request().method() === "POST" && body?.includes(from)) {
          await route.continue({ postData: body.replaceAll(from, to) });
        } else {
          await route.continue();
        }
      };

      await page.route(`**/patients/${minhLive}`, swap(minhLive, an));
      await loginAs(page, "minh", `/patients/${minhLive}`);
      await page.getByRole("button", { name: "Thêm thao tác" }).click();
      await page.getByRole("menuitem", { name: "Chuyển vào thùng rác" }).click();
      await expect(
        page.locator("[data-sonner-toast]").filter({ hasText: NOT_FOUND }),
      ).toBeVisible();
      expect((await findPatient(an))?.deleted_at).toBeNull();
      expect((await findPatient(minhLive))?.deleted_at).toBeNull();

      await page.route("**/settings/trash", swap(minhTrashed, binh));
      await page.goto("/settings/trash");
      await page.getByRole("button", { name: "Khôi phục Đỗ Thị Hoa" }).click();
      await expect(
        page.locator("[data-sonner-toast]").filter({ hasText: NOT_FOUND }),
      ).toBeVisible();
      expect((await findPatient(binh))?.deleted_at).not.toBeNull();
      expect((await findPatient(minhTrashed))?.deleted_at).not.toBeNull();
    });

    test("Xoá bệnh nhân của bác sĩ khác", async ({ page }) => {
      const minhPatient = await insertPatient("minh", { fullName: "Lê Văn Tâm" });
      await trashPatient(an, 1);
      await trashPatient(minhPatient, 1);
      await loginAs(page, "minh", "/settings/trash");

      // A tampered client: bs.minh's own "Xoá vĩnh viễn" posting bs.lan's patient id.
      await page.route("**/settings/trash", async (route) => {
        const body = route.request().postData();
        if (route.request().method() === "POST" && body?.includes(minhPatient)) {
          await route.continue({ postData: body.replaceAll(minhPatient, an) });
        } else {
          await route.continue();
        }
      });
      await page.getByRole("button", { name: "Xoá vĩnh viễn Lê Văn Tâm" }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Xoá vĩnh viễn" }).click();

      await expect(page.getByRole("alertdialog")).toContainText(NOT_FOUND);
      expect((await findPatient(an))?.deleted_at).not.toBeNull();
      expect(await findPatient(minhPatient)).toBeDefined();
    });
  });
});
