import { expect, type Page, test } from "@playwright/test";

import { formAlert, loginAs } from "./fixtures/auth";
import {
  ACCOUNTS,
  closeDatabase,
  deleteFeedbackRow,
  hasDatabase,
  listFeedbackRows,
  resetDatabase,
  seedFeedback,
  SKIP_WITHOUT_DATABASE,
} from "./fixtures/db";

/** Scenarios of openspec spec feedback (change add-feedback). */

const DOCTOR_PAGE = "/settings/feedback";
const ADMIN_PAGE = "/admin/feedback";
const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";

const contentBox = (page: Page) => page.getByLabel("Nội dung góp ý");
const sendButton = (page: Page) => page.getByRole("button", { name: "Gửi góp ý" });
const item = (page: Page, sender: string) =>
  page.getByRole("listitem", { name: new RegExp(`^Góp ý của ${sender},`) });

async function contentsOf(username: string | null) {
  return (await listFeedbackRows())
    .filter((row) => row.username === username)
    .map((row) => row.content);
}

test.describe("feedback", () => {
  test.skip(!hasDatabase, SKIP_WITHOUT_DATABASE);
  test.beforeEach(resetDatabase);
  test.afterAll(closeDatabase);

  test.describe("Gửi góp ý từ Cài đặt", () => {
    test("Gửi góp ý", async ({ page }) => {
      await loginAs(page, "lan", "/settings");
      await page.getByRole("link", { name: /Góp ý/ }).click();
      await expect(page).toHaveURL(/\/settings\/feedback$/);
      await expect(page.getByText(/Đừng ghi tên hay thông tin bệnh nhân/)).toBeVisible();

      await contentBox(page).fill("Tìm bằng giọng nói hay nhận sai tên");
      await sendButton(page).click();

      await expect(page.getByRole("status").filter({ hasText: "Đã gửi góp ý" })).toHaveText(
        "Đã gửi góp ý. Cảm ơn bác sĩ!",
      );
      await expect(contentBox(page)).toHaveValue("");
      expect(await contentsOf(ACCOUNTS.lan.username)).toEqual([
        "Tìm bằng giọng nói hay nhận sai tên",
      ]);
    });

    test("Chưa gõ gì", async ({ page }) => {
      await loginAs(page, "lan", DOCTOR_PAGE);

      await contentBox(page).fill("   ");
      await sendButton(page).click();

      await expect(page.getByText("Nhập nội dung góp ý.")).toBeVisible();
      await expect(contentBox(page)).toBeFocused();
      expect(await listFeedbackRows()).toHaveLength(0);
    });

    test("Quá dài", async ({ page }) => {
      await loginAs(page, "lan", DOCTOR_PAGE);
      const long = "a".repeat(2001);

      await contentBox(page).fill(long);
      await expect(page.getByText("2.001/2.000 · quá 1 ký tự")).toBeVisible();
      await sendButton(page).click();

      await expect(page.getByText("Góp ý tối đa 2.000 ký tự.")).toBeVisible();
      await expect(contentBox(page)).toHaveValue(long);
      expect(await listFeedbackRows()).toHaveLength(0);
    });

    test("Mất mạng khi gửi", async ({ page, context }) => {
      await loginAs(page, "lan", DOCTOR_PAGE);
      await contentBox(page).fill("Góp ý lúc mất mạng");

      await context.setOffline(true);
      await sendButton(page).click();

      await expect(formAlert(page)).toHaveText(
        "Chưa gửi được vì mất mạng. Chữ đã nhập vẫn còn, bấm Gửi góp ý lại khi có mạng.",
      );
      await expect(contentBox(page)).toHaveValue("Góp ý lúc mất mạng");

      await context.setOffline(false);
      await sendButton(page).click();
      await expect(page.getByRole("status").filter({ hasText: "Đã gửi góp ý" })).toBeVisible();
      expect(await contentsOf(ACCOUNTS.lan.username)).toEqual(["Góp ý lúc mất mạng"]);
    });
  });

  test.describe("Thông tin kèm theo góp ý", () => {
    test.use({ userAgent: IPHONE_UA });

    test("Gửi từ iPhone", async ({ page }) => {
      await loginAs(page, "lan", DOCTOR_PAGE);
      await contentBox(page).fill("Gửi từ iPhone");
      await sendButton(page).click();
      await expect(page.getByRole("status").filter({ hasText: "Đã gửi góp ý" })).toBeVisible();

      const [row] = await listFeedbackRows();
      expect(row?.user_agent).toBe(IPHONE_UA);
      await page.context().clearCookies();
      await loginAs(page, "admin", ADMIN_PAGE);
      await expect(item(page, ACCOUNTS.lan.name)).toContainText("iPhone · Safari");
    });
  });

  test.describe("Giới hạn số góp ý", () => {
    test("Vượt 20 góp ý trong 24 giờ", async ({ page }) => {
      for (let index = 0; index < 20; index++) {
        await seedFeedback("lan", `Góp ý số ${index + 1}`, { minutesAgo: 60 + index });
      }
      // Older than 24 hours: does not count.
      await seedFeedback("lan", "Góp ý hôm kia", { minutesAgo: 60 * 30 });
      await loginAs(page, "lan", DOCTOR_PAGE);

      await contentBox(page).fill("Góp ý thứ 21");
      await sendButton(page).click();

      await expect(formAlert(page)).toHaveText("Đã gửi 20 góp ý trong 24 giờ qua. Thử lại sau.");
      await expect(contentBox(page)).toHaveValue("Góp ý thứ 21");
      expect(await contentsOf(ACCOUNTS.lan.username)).toHaveLength(21);
    });

    test("Bác sĩ khác không bị chặn", async ({ page }) => {
      for (let index = 0; index < 20; index++) {
        await seedFeedback("lan", `Góp ý số ${index + 1}`);
      }
      await loginAs(page, "minh", DOCTOR_PAGE);

      await contentBox(page).fill("Góp ý của Minh");
      await sendButton(page).click();

      await expect(page.getByRole("status").filter({ hasText: "Đã gửi góp ý" })).toBeVisible();
      expect(await contentsOf(ACCOUNTS.minh.username)).toEqual(["Góp ý của Minh"]);
    });
  });

  test.describe("Admin đọc góp ý", () => {
    test("Xem danh sách góp ý", async ({ page }) => {
      await seedFeedback("lan", "Nút lưu khó bấm", { minutesAgo: 30, userAgent: ANDROID_UA });
      await seedFeedback("minh", "App chạy tốt", { minutesAgo: 10, userAgent: IPHONE_UA });
      await loginAs(page, "admin", "/admin");

      await page.getByRole("link", { name: "Góp ý" }).click();
      await expect(page).toHaveURL(/\/admin\/feedback$/);
      await expect(page.getByText("2 mới")).toBeVisible();
      const items = page.getByRole("listitem", { name: /^Góp ý của/ });
      await expect(items).toHaveCount(2);
      await expect(items.first()).toContainText("App chạy tốt");

      const lan = item(page, ACCOUNTS.lan.name);
      await expect(lan).toContainText(ACCOUNTS.lan.username);
      await expect(lan).toContainText(/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/);
      await expect(lan).toContainText("Android · Chrome");
      await expect(lan).toContainText("Nút lưu khó bấm");
      await expect(lan.getByText("Mới", { exact: true })).toBeVisible();
      await expect(item(page, ACCOUNTS.minh.name).getByText("Mới", { exact: true })).toBeVisible();
    });

    test("Nội dung nhiều dòng", async ({ page }) => {
      await seedFeedback("lan", "Dòng một\nDòng hai\nDòng ba");
      await loginAs(page, "admin", ADMIN_PAGE);

      await expect(item(page, ACCOUNTS.lan.name).getByText("Dòng một")).toHaveJSProperty(
        "innerText",
        "Dòng một\nDòng hai\nDòng ba",
      );
    });

    test("Chưa có góp ý", async ({ page }) => {
      await loginAs(page, "admin", ADMIN_PAGE);

      await expect(page.getByText("Chưa có góp ý nào")).toBeVisible();
    });
  });

  test.describe("Đánh dấu góp ý đã xem", () => {
    test("Đánh dấu đã xem", async ({ page }) => {
      await seedFeedback("lan", "Nút lưu khó bấm", { minutesAgo: 30 });
      await seedFeedback("minh", "App chạy tốt", { minutesAgo: 10 });
      await loginAs(page, "admin", ADMIN_PAGE);
      await expect(page.getByText("2 mới")).toBeVisible();

      const lan = item(page, ACCOUNTS.lan.name);
      await lan.getByRole("button", { name: "Đã xem" }).click();

      await expect(lan.getByText("Mới", { exact: true })).toHaveCount(0);
      await expect(lan.getByRole("button", { name: "Đã xem" })).toHaveCount(0);
      await expect(page.getByText("1 mới")).toBeVisible();
      await expect(lan).toContainText("Nút lưu khó bấm");
      const rows = await listFeedbackRows();
      expect(rows.find((row) => row.content === "Nút lưu khó bấm")?.seen_at).not.toBeNull();
    });
  });

  test.describe("Xoá góp ý", () => {
    test("Xoá góp ý", async ({ page }) => {
      await seedFeedback("lan", "Nút lưu khó bấm");
      await loginAs(page, "admin", ADMIN_PAGE);

      await item(page, ACCOUNTS.lan.name).getByRole("button", { name: "Xoá" }).click();
      const dialog = page.getByRole("alertdialog");
      await expect(dialog).toContainText("Xoá góp ý này?");
      await expect(dialog).toContainText("Nút lưu khó bấm");
      await dialog.getByRole("button", { name: "Xoá góp ý" }).click();

      await expect(dialog).toBeHidden();
      await expect(page.getByText("Đã xoá góp ý.")).toBeVisible();
      await expect(item(page, ACCOUNTS.lan.name)).toHaveCount(0);
      expect(await listFeedbackRows()).toHaveLength(0);
    });

    test("Đổi ý khi xoá góp ý", async ({ page }) => {
      await seedFeedback("lan", "Nút lưu khó bấm");
      await loginAs(page, "admin", ADMIN_PAGE);

      await item(page, ACCOUNTS.lan.name).getByRole("button", { name: "Xoá" }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Không xoá" }).click();

      await expect(item(page, ACCOUNTS.lan.name)).toContainText("Nút lưu khó bấm");
      expect(await listFeedbackRows()).toHaveLength(1);
    });

    test("Góp ý đã bị xoá ở nơi khác", async ({ page }) => {
      const id = await seedFeedback("lan", "Nút lưu khó bấm");
      await loginAs(page, "admin", ADMIN_PAGE);

      await item(page, ACCOUNTS.lan.name).getByRole("button", { name: "Xoá" }).click();
      await deleteFeedbackRow(id);
      const dialog = page.getByRole("alertdialog");
      await dialog.getByRole("button", { name: "Xoá góp ý" }).click();

      await expect(dialog).toContainText("Góp ý này không còn.");
    });
  });

  test.describe("Góp ý còn lại khi xoá tài khoản", () => {
    test("Xoá tài khoản đã gửi góp ý", async ({ page }) => {
      await seedFeedback("locked", "Muốn thêm nhãn bệnh nhân");
      await loginAs(page, "admin", "/admin/accounts");

      const row = page
        .getByRole("listitem")
        .filter({ has: page.getByText(ACCOUNTS.locked.username, { exact: true }) });
      await row.getByRole("button", { name: "Xoá" }).click();
      const dialog = page.getByRole("alertdialog");
      await dialog.getByLabel("Gõ tên đăng nhập để xác nhận").fill(ACCOUNTS.locked.username);
      await dialog.getByRole("button", { name: "Xoá vĩnh viễn" }).click();
      await expect(dialog).toBeHidden();

      await page.goto(ADMIN_PAGE);
      const orphan = item(page, "Tài khoản đã xoá");
      await expect(orphan).toContainText("Muốn thêm nhãn bệnh nhân");
      await expect(orphan).not.toContainText(ACCOUNTS.locked.username);
      expect(await contentsOf(null)).toEqual(["Muốn thêm nhãn bệnh nhân"]);
    });
  });

  test.describe("Quyền truy cập góp ý", () => {
    test("Chưa đăng nhập mở trang góp ý", async ({ page }) => {
      await page.goto(DOCTOR_PAGE);

      await expect(page).toHaveURL(/\/login\?next=%2Fsettings%2Ffeedback$/);
    });

    test("Bác sĩ mở trang góp ý của Admin", async ({ page }) => {
      await seedFeedback("minh", "Góp ý của Minh");
      await loginAs(page, "lan", ADMIN_PAGE);

      await expect(page).toHaveURL(/\/patients$/);
      await expect(page.getByText("Góp ý của Minh")).toHaveCount(0);
    });
  });
});
