import { randomBytes } from "node:crypto";

import { expect, type Page, test } from "@playwright/test";

import { loginAs } from "./fixtures/auth";
import { E2E_CRON_SECRET } from "./fixtures/constants";
import {
  avatarPathOf,
  closeDatabase,
  hasDatabase,
  insertPatient,
  resetDatabase,
  setAvatarPath,
  SKIP_WITHOUT_DATABASE,
  trashPatient,
} from "./fixtures/db";
import {
  imageSize,
  listStoredObjects,
  makePng,
  putStoredObject,
  readStoredObject,
  TINY_WEBP,
} from "./fixtures/storage";

/** Scenarios of openspec spec patient-avatars (change add-patient-avatars). */

async function seedAvatar(patientId: string): Promise<string> {
  const path = await setAvatarPath(patientId, `${randomBytes(16).toString("hex")}.webp`);
  await putStoredObject(`avatars/${path}`, TINY_WEBP);
  return path;
}

const avatarButton = (page: Page) => page.getByRole("button", { name: "Ảnh đại diện" });
const headerPhoto = (page: Page) => avatarButton(page).locator("img");
const loaded = (page: Page) =>
  expect
    .poll(() => headerPhoto(page).evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);

async function choose(page: Page, option: string) {
  await avatarButton(page).click();
  // A bottom sheet on phones, a menu on wider screens.
  await page
    .getByRole("dialog", { name: "Ảnh đại diện" })
    .getByRole("button", { name: option })
    .or(page.getByRole("menuitem", { name: option }))
    .click();
}

async function pickFile(page: Page, file: { name: string; mimeType: string; buffer: Buffer }) {
  const chooser = page.waitForEvent("filechooser");
  await choose(page, "Chọn ảnh có sẵn");
  await (await chooser).setFiles(file);
}

test.describe("patient-avatars", () => {
  test.skip(!hasDatabase, SKIP_WITHOUT_DATABASE);
  test.beforeEach(resetDatabase);
  test.afterAll(closeDatabase);

  test.describe("Đặt ảnh đại diện", () => {
    test("Chọn ảnh có sẵn", async ({ page }) => {
      const an = await insertPatient("lan", { fullName: "Nguyễn Văn An" });
      await loginAs(page, "lan", `/patients/${an}`);
      await expect(headerPhoto(page)).toHaveCount(0);

      await pickFile(page, { name: "an.png", mimeType: "image/png", buffer: makePng(1200, 900) });

      await expect.poll(() => avatarPathOf(an)).not.toBeNull();
      await loaded(page);
      const path = await avatarPathOf(an);
      const stored = await readStoredObject(`avatars/${path}`);
      expect(imageSize(stored)).toMatchObject({ width: 384, height: 384 });
      expect(stored.length).toBeLessThan(60_000);
    });

    test("File không phải ảnh", async ({ page }) => {
      const an = await insertPatient("lan", { fullName: "Nguyễn Văn An" });
      await loginAs(page, "lan", `/patients/${an}`);
      await pickFile(page, {
        name: "ghi-chu.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("không phải ảnh"),
      });

      await expect(page.getByRole("main").getByRole("alert")).toContainText(
        "Không đọc được ảnh này.",
      );
      expect(await avatarPathOf(an)).toBeNull();
    });

    test("Mất mạng khi lưu ảnh", async ({ page }) => {
      const an = await insertPatient("lan", { fullName: "Nguyễn Văn An" });
      await loginAs(page, "lan", `/patients/${an}`);
      await page.route(`**/patients/${an}`, (route) =>
        route.request().method() === "POST"
          ? route.abort("internetdisconnected")
          : route.continue(),
      );
      await pickFile(page, { name: "an.png", mimeType: "image/png", buffer: makePng(600, 600) });

      const alert = page.getByRole("main").getByRole("alert");
      await expect(alert).toContainText("Chưa lưu được ảnh vì mất mạng.");
      expect(await avatarPathOf(an)).toBeNull();

      await page.unroute(`**/patients/${an}`);
      await alert.getByRole("button", { name: "Thử lại" }).click();
      await expect.poll(() => avatarPathOf(an)).not.toBeNull();
      await loaded(page);
    });
  });

  test.describe("Xem và xoá ảnh đại diện", () => {
    test("Xoá ảnh", async ({ page }) => {
      const an = await insertPatient("lan", { fullName: "Nguyễn Văn An" });
      const path = await seedAvatar(an);
      await loginAs(page, "lan", `/patients/${an}`);
      await loaded(page);

      await choose(page, "Xoá ảnh");
      const dialog = page.getByRole("alertdialog");
      await expect(dialog).toContainText("Xoá ảnh đại diện?");
      await dialog.getByRole("button", { name: "Xoá ảnh" }).click();

      await expect(page.getByRole("alertdialog")).toHaveCount(0);
      await expect(headerPhoto(page)).toHaveCount(0);
      await expect.poll(() => avatarPathOf(an)).toBeNull();
      await expect.poll(() => listStoredObjects(`avatars/${path}`)).toEqual([]);
    });

    test("Đổi ý khi xoá ảnh", async ({ page }) => {
      const an = await insertPatient("lan", { fullName: "Nguyễn Văn An" });
      const path = await seedAvatar(an);
      await loginAs(page, "lan", `/patients/${an}`);
      await choose(page, "Xoá ảnh");
      await page.getByRole("alertdialog").getByRole("button", { name: "Không xoá" }).click();

      await expect(page.getByRole("alertdialog")).toHaveCount(0);
      expect(await avatarPathOf(an)).toBe(path);
      expect(await listStoredObjects(`avatars/${path}`)).toHaveLength(1);
    });

    test("Xem ảnh", async ({ page }) => {
      const an = await insertPatient("lan", { fullName: "Nguyễn Văn An" });
      await seedAvatar(an);
      await loginAs(page, "lan", `/patients/${an}`);
      await choose(page, "Xem ảnh");
      await expect(
        page.getByRole("dialog").getByRole("img", { name: "Ảnh đại diện" }),
      ).toBeVisible();
    });
  });

  test.describe("Trên máy tính: menu thả xuống", () => {
    test.use({ viewport: { width: 1280, height: 900 } });

    test("Chọn ảnh rồi xoá ảnh từ menu", async ({ page }) => {
      const an = await insertPatient("lan", { fullName: "Nguyễn Văn An" });
      await loginAs(page, "lan", `/patients/${an}`);
      await pickFile(page, { name: "an.png", mimeType: "image/png", buffer: makePng(800, 600) });
      await expect.poll(() => avatarPathOf(an)).not.toBeNull();
      await loaded(page);

      await choose(page, "Xoá ảnh");
      await page.getByRole("alertdialog").getByRole("button", { name: "Xoá ảnh" }).click();
      await expect(headerPhoto(page)).toHaveCount(0);
      await expect.poll(() => avatarPathOf(an)).toBeNull();
    });
  });

  test.describe("Ảnh trong danh sách bệnh nhân", () => {
    test("Danh sách có ảnh", async ({ page }) => {
      const an = await insertPatient("lan", { fullName: "Nguyễn Văn An", minutesAgo: 10 });
      await insertPatient("lan", { fullName: "Trần Thị Bình", minutesAgo: 20 });
      await seedAvatar(an);
      await loginAs(page, "lan", "/patients");

      const rows = page.getByRole("main").getByRole("list").first().getByRole("listitem");
      const anPhoto = rows.filter({ hasText: "Nguyễn Văn An" }).locator("img");
      await expect(anPhoto).toHaveAttribute("alt", "");
      await expect
        .poll(() => anPhoto.evaluate((img: HTMLImageElement) => img.naturalWidth))
        .toBeGreaterThan(0);
      await expect(rows.filter({ hasText: "Trần Thị Bình" }).locator("img")).toHaveCount(0);
    });
  });

  test.describe("Ảnh đại diện riêng tư", () => {
    test("Ảnh của bác sĩ khác", async ({ page }) => {
      const an = await insertPatient("lan", { fullName: "Nguyễn Văn An" });
      await seedAvatar(an);
      await loginAs(page, "minh", "/patients");
      const response = await page.request.get(`/api/patients/${an}/avatar?v=x`, {
        maxRedirects: 0,
      });
      expect(response.status()).toBe(404);
      expect(response.headers().location).toBeUndefined();
    });

    test("Chưa đăng nhập hoặc Admin xem ảnh", async ({ page, request }) => {
      const an = await insertPatient("lan", { fullName: "Nguyễn Văn An" });
      await seedAvatar(an);
      const anonymous = await request.get(`/api/patients/${an}/avatar?v=x`, { maxRedirects: 0 });
      expect(anonymous.status()).toBeGreaterThanOrEqual(400);

      await loginAs(page, "admin", "/login");
      const asAdmin = await page.request.get(`/api/patients/${an}/avatar?v=x`, { maxRedirects: 0 });
      expect(asAdmin.status()).toBe(403);
    });
  });

  test.describe("Ảnh bị xoá cùng bệnh nhân", () => {
    test("Xoá vĩnh viễn xoá ảnh", async ({ page }) => {
      const an = await insertPatient("lan", { fullName: "Nguyễn Văn An" });
      const path = await seedAvatar(an);
      await trashPatient(an, 1);
      await loginAs(page, "lan", "/settings/trash");
      await page.getByRole("button", { name: "Xoá vĩnh viễn Nguyễn Văn An" }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Xoá vĩnh viễn" }).click();

      await expect(page.getByText("Thùng rác trống")).toBeVisible();
      await expect.poll(() => listStoredObjects(`avatars/${path}`)).toEqual([]);
    });

    test("Khôi phục còn ảnh", async ({ page }) => {
      const an = await insertPatient("lan", { fullName: "Nguyễn Văn An" });
      await seedAvatar(an);
      await trashPatient(an, 1);
      await loginAs(page, "lan", "/settings/trash");
      await page.getByRole("button", { name: "Khôi phục Nguyễn Văn An" }).click();
      await expect(page.getByText("Thùng rác trống")).toBeVisible();

      await page.goto(`/patients/${an}`);
      await loaded(page);
    });

    test("Hệ thống tự xoá sau 30 ngày cũng xoá ảnh", async ({ request }) => {
      const an = await insertPatient("lan", { fullName: "Nguyễn Văn An" });
      const path = await seedAvatar(an);
      await trashPatient(an, 31);
      const cron = await request.get("/api/cron/daily-maintenance", {
        headers: { Authorization: `Bearer ${E2E_CRON_SECRET}` },
      });
      expect(await cron.json()).toMatchObject({ purgedPatients: 1 });
      expect(await listStoredObjects(`avatars/${path}`)).toEqual([]);
    });
  });
});
