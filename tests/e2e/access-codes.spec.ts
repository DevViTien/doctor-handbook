import { expect, type Page, test } from "@playwright/test";

import { formAlert, loginAs } from "./fixtures/auth";
import {
  closeDatabase,
  countAccessCodes,
  hasDatabase,
  insertAccessCode,
  listAccessCodeRows,
  markAccessCodeUsed,
  normalizeCode,
  resetDatabase,
  SKIP_WITHOUT_DATABASE,
} from "./fixtures/db";

/** Scenarios of openspec spec access-codes (change add-account-activation). */

const CODE_PATTERN = /^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/;
const REVOKE_CONFLICT = "Mã này đã được dùng, đã hết hạn hoặc đã bị huỷ.";
const PAGE = "/admin/access-codes";

/** "21/11/2026 14:05" in Vietnam time (UTC+7, no daylight saving). */
function vietnamTime(time: number): string {
  const local = new Date(time + 7 * 60 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    `${pad(local.getUTCDate())}/${pad(local.getUTCMonth() + 1)}/${local.getUTCFullYear()} ` +
    `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`
  );
}

function codeRow(page: Page, recipient: string) {
  return page.getByRole("listitem").filter({ hasText: recipient });
}

async function createCode(page: Page, recipient: string): Promise<string> {
  await page.getByLabel("Tên người nhận").fill(recipient);
  await page.getByRole("button", { name: "Tạo mã", exact: true }).click();
  const issued = page.getByTestId("issued-code");
  await expect(issued).toHaveText(CODE_PATTERN);
  return (await issued.textContent()) ?? "";
}

test.describe("access-codes", () => {
  test.skip(!hasDatabase, SKIP_WITHOUT_DATABASE);
  test.beforeEach(resetDatabase);
  test.afterAll(closeDatabase);

  test.describe("Admin tạo mã kích hoạt", () => {
    test("Tạo mã cho bác sĩ mới", async ({ page }) => {
      await loginAs(page, "admin", PAGE);
      const before = Date.now();
      const code = await createCode(page, "BS. Trần Thị B");
      const after = Date.now();

      const card = page.getByRole("region", { name: "Mã vừa tạo" });
      await expect(card).toContainText("BS. Trần Thị B");
      expect(code).toMatch(CODE_PATTERN);
      // 72 hours later, in Vietnam time (the minute may tick during the request).
      const ttl = 72 * 60 * 60 * 1000;
      const candidates = [before + ttl, after + ttl].map(vietnamTime);
      const expiry = await card.getByText(/^Hết hạn /).textContent();
      expect(candidates.map((value) => `Hết hạn ${value}`)).toContain(expiry);
    });

    test("Bỏ trống tên người nhận", async ({ page }) => {
      await loginAs(page, "admin", PAGE);
      await page.getByLabel("Tên người nhận").fill("   ");
      await page.getByRole("button", { name: "Tạo mã", exact: true }).click();

      await expect(page.getByText("Nhập tên người nhận mã.")).toBeVisible();
      await expect(page.getByLabel("Tên người nhận")).toHaveAttribute("aria-invalid", "true");
      expect(await countAccessCodes()).toBe(0);
    });
  });

  test.describe("Mã chỉ hiện một lần", () => {
    test("Tải lại trang sau khi tạo mã", async ({ page }) => {
      await loginAs(page, "admin", PAGE);
      const code = await createCode(page, "BS. Trần Thị B");

      await page.reload();

      await expect(page.getByTestId("issued-code")).toHaveCount(0);
      await expect(page.locator("body")).not.toContainText(code);
      await expect(page.locator("body")).not.toContainText(normalizeCode(code));
      await expect(codeRow(page, "BS. Trần Thị B")).toContainText("Còn hạn");
    });

    test("Sao chép tin nhắn gửi bác sĩ", async ({ page, context, browserName }) => {
      test.skip(browserName !== "chromium", "Clipboard permissions are Chromium-only");
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      await loginAs(page, "admin", PAGE);
      const code = await createCode(page, "BS. Trần Thị B");

      const copyButton = page.getByRole("button", { name: "Sao chép tin nhắn" });
      await copyButton.click();

      await expect(page.getByRole("button", { name: "Đã sao chép" })).toBeVisible();
      const copied = await page.evaluate(() => navigator.clipboard.readText());
      expect(copied).toContain(code);
      expect(copied).toMatch(/Hết hạn|hết hạn lúc/);
      const link = copied.match(/https?:\/\/\S+/)?.[0] ?? "";
      expect(new URL(link).pathname).toBe("/activate");
      expect(link).not.toContain(code);
      expect(link).not.toContain(normalizeCode(code));
    });

    test("Database không chứa mã thô", async ({ page }) => {
      await loginAs(page, "admin", PAGE);
      const code = await createCode(page, "BS. Trần Thị B");

      const rows = JSON.stringify(await listAccessCodeRows());
      expect(rows).not.toContain(code);
      expect(rows).not.toContain(normalizeCode(code));
    });
  });

  test.describe("Danh sách mã theo trạng thái", () => {
    test("Mã còn hạn", async ({ page }) => {
      await insertAccessCode({ recipient: "BS. Còn Hạn", createdMinutesAgo: 60 });
      await loginAs(page, "admin", PAGE);

      const row = codeRow(page, "BS. Còn Hạn");
      await expect(row).toContainText("Còn hạn");
      await expect(row).toContainText(/đến \d{2}\/\d{2}\/\d{4}/);
      await expect(row.getByRole("button", { name: "Huỷ mã" })).toBeVisible();
    });

    test("Mã đã dùng", async ({ page }) => {
      await insertAccessCode({ recipient: "BS. Đã Dùng", usedBy: "lan" });
      await loginAs(page, "admin", PAGE);

      const row = codeRow(page, "BS. Đã Dùng");
      await expect(row).toContainText("Đã dùng");
      await expect(row).toContainText("bs.lan");
      await expect(row.getByRole("button", { name: "Huỷ mã" })).toHaveCount(0);
    });

    test("Mã hết hạn", async ({ page }) => {
      await insertAccessCode({ recipient: "BS. Hết Hạn", createdMinutesAgo: 73 * 60 });
      await loginAs(page, "admin", PAGE);

      const row = codeRow(page, "BS. Hết Hạn");
      await expect(row).toContainText("Hết hạn");
      await expect(row.getByRole("button", { name: "Huỷ mã" })).toHaveCount(0);
    });

    test("Mã đã huỷ", async ({ page }) => {
      await insertAccessCode({ recipient: "BS. Đã Huỷ", revoked: true });
      await loginAs(page, "admin", PAGE);

      const row = codeRow(page, "BS. Đã Huỷ");
      await expect(row).toContainText("Đã huỷ");
      await expect(row.getByRole("button", { name: "Huỷ mã" })).toHaveCount(0);
    });

    test("Chưa có mã nào", async ({ page }) => {
      await loginAs(page, "admin", PAGE);

      await expect(page.getByText("Chưa có mã nào")).toBeVisible();
      await expect(
        page.getByText("Tạo mã đầu tiên ở trên rồi gửi cho bác sĩ qua Zalo."),
      ).toBeVisible();
    });

    test("lists the newest code first", async ({ page }) => {
      await insertAccessCode({ recipient: "BS. Cũ", createdMinutesAgo: 120 });
      await insertAccessCode({ recipient: "BS. Mới", createdMinutesAgo: 5 });
      await loginAs(page, "admin", PAGE);

      await expect(page.getByRole("listitem").first()).toContainText("BS. Mới");
    });
  });

  test.describe("Admin cấp mã đặt lại mật khẩu", () => {
    const ACCOUNTS_PAGE = "/admin/accounts";

    function accountRow(page: Page, username: string) {
      return page.getByRole("listitem").filter({ has: page.getByText(username, { exact: true }) });
    }

    async function issueResetCode(page: Page, username: string): Promise<string> {
      await accountRow(page, username)
        .getByRole("button", { name: "Cấp mã đặt lại mật khẩu" })
        .click();
      const dialog = page.getByRole("dialog");
      const issued = dialog.getByTestId("issued-code");
      await expect(issued).toHaveText(CODE_PATTERN);
      const code = (await issued.textContent()) ?? "";
      await dialog.getByRole("button", { name: "Đóng" }).click();
      await expect(dialog).toBeHidden();
      return code;
    }

    test("Cấp mã đặt lại cho bác sĩ quên mật khẩu", async ({ page }) => {
      await loginAs(page, "admin", ACCOUNTS_PAGE);
      await accountRow(page, "bs.lan")
        .getByRole("button", { name: "Cấp mã đặt lại mật khẩu" })
        .click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toContainText("Mã đặt lại mật khẩu cho Nguyễn Thị Lan");
      await expect(dialog.getByTestId("issued-code")).toHaveText(CODE_PATTERN);
      await expect(dialog).toContainText("bs.lan");
      await expect(dialog.getByText(/Hết hạn \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/)).toBeVisible();
    });

    test("Cấp mã mới thì mã cũ bị huỷ", async ({ page, browser }) => {
      await loginAs(page, "admin", ACCOUNTS_PAGE);
      const first = await issueResetCode(page, "bs.lan");
      const second = await issueResetCode(page, "bs.lan");
      expect(second).not.toBe(first);

      await page.goto(PAGE);
      const rows = page.getByRole("listitem").filter({ hasText: "Đặt lại mật khẩu" });
      await expect(rows).toHaveCount(2);
      await expect(rows.nth(0)).toContainText("Còn hạn");
      await expect(rows.nth(1)).toContainText("Đã huỷ");

      const doctor = await browser.newContext();
      const doctorPage = await doctor.newPage();
      await doctorPage.goto("/reset-password");
      await doctorPage.getByLabel("Mã đặt lại mật khẩu").fill(first);
      await doctorPage.getByRole("button", { name: "Tiếp tục" }).click();
      await expect(formAlert(doctorPage)).toContainText("Mã đặt lại mật khẩu không đúng");
      await doctorPage.getByLabel("Mã đặt lại mật khẩu").fill(second);
      await doctorPage.getByRole("button", { name: "Tiếp tục" }).click();
      await expect(doctorPage.getByText("Đặt lại mật khẩu cho bs.lan")).toBeVisible();
      await doctor.close();
    });

    test("Tài khoản bị khoá không có nút cấp mã đặt lại", async ({ page }) => {
      await loginAs(page, "admin", ACCOUNTS_PAGE);

      await expect(accountRow(page, "bs.khoa")).toContainText("Đã khoá");
      await expect(
        accountRow(page, "bs.khoa").getByRole("button", { name: "Cấp mã đặt lại mật khẩu" }),
      ).toHaveCount(0);
      await expect(
        accountRow(page, "bs.lan").getByRole("button", { name: "Cấp mã đặt lại mật khẩu" }),
      ).toBeVisible();
    });

    test("Mã đặt lại mật khẩu trong danh sách", async ({ page }) => {
      await insertAccessCode({ recipient: "BS. Trần Thị B", createdMinutesAgo: 10 });
      await insertAccessCode({
        type: "password_reset",
        forAccount: "lan",
        recipient: "Nguyễn Thị Lan",
        createdMinutesAgo: 5,
      });
      await loginAs(page, "admin", PAGE);

      const reset = codeRow(page, "Nguyễn Thị Lan");
      await expect(reset).toContainText("Đặt lại mật khẩu");
      await expect(reset).toContainText("bs.lan");
      await expect(reset.getByRole("button", { name: "Huỷ mã" })).toBeVisible();
      await expect(codeRow(page, "BS. Trần Thị B")).toContainText("Kích hoạt");
      await expect(page.getByRole("listitem").first()).toContainText("Đặt lại mật khẩu");
    });
  });

  test.describe("Huỷ mã chưa dùng", () => {
    test("Huỷ mã còn hạn", async ({ page }) => {
      const { code } = await insertAccessCode({ recipient: "BS. Trần Thị B" });
      await loginAs(page, "admin", PAGE);

      await codeRow(page, "BS. Trần Thị B").getByRole("button", { name: "Huỷ mã" }).click();
      const dialog = page.getByRole("alertdialog");
      await expect(dialog).toContainText("Huỷ mã của BS. Trần Thị B?");
      await dialog.getByRole("button", { name: "Huỷ mã" }).click();

      await expect(dialog).toBeHidden();
      await expect(codeRow(page, "BS. Trần Thị B")).toContainText("Đã huỷ");

      // The revoked code no longer activates anything.
      await page.context().clearCookies();
      await page.goto("/activate");
      await page.getByLabel("Mã kích hoạt").fill(code);
      await page.getByRole("button", { name: "Tiếp tục" }).click();
      await expect(formAlert(page)).toContainText("Mã kích hoạt không đúng hoặc đã hết hạn");
    });

    test("Đổi ý trong hộp thoại", async ({ page }) => {
      await insertAccessCode({ recipient: "BS. Trần Thị B" });
      await loginAs(page, "admin", PAGE);

      await codeRow(page, "BS. Trần Thị B").getByRole("button", { name: "Huỷ mã" }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Không huỷ" }).click();

      await expect(page.getByRole("alertdialog")).toBeHidden();
      await expect(codeRow(page, "BS. Trần Thị B")).toContainText("Còn hạn");
      const [row] = await listAccessCodeRows();
      expect(row?.revoked_at).toBeNull();
    });

    test("Huỷ mã vừa được dùng", async ({ page }) => {
      const { id } = await insertAccessCode({ recipient: "BS. Trần Thị B" });
      await loginAs(page, "admin", PAGE);

      await codeRow(page, "BS. Trần Thị B").getByRole("button", { name: "Huỷ mã" }).click();
      await markAccessCodeUsed(id, "minh");
      const dialog = page.getByRole("alertdialog");
      await dialog.getByRole("button", { name: "Huỷ mã" }).click();

      await expect(dialog.getByRole("alert")).toHaveText(REVOKE_CONFLICT);
      await dialog.getByRole("button", { name: "Đóng" }).click();
      await expect(codeRow(page, "BS. Trần Thị B")).toContainText("Đã dùng");
      const [row] = await listAccessCodeRows();
      expect(row?.revoked_at).toBeNull();
    });
  });
});
