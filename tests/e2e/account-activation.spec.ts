import { type BrowserContext, expect, type Page, test } from "@playwright/test";

import { formAlert, loginAs, skipWhenSecureCookiesUnsupported, submitLogin } from "./fixtures/auth";
import {
  ACCOUNTS,
  closeDatabase,
  countAccounts,
  countAuthAttempts,
  findAccountByUsername,
  hasDatabase,
  insertAccessCode,
  insertCodeFailures,
  listAccessCodeRows,
  resetDatabase,
  revokeAccessCodeInDb,
  SESSION_COOKIE,
  SKIP_WITHOUT_DATABASE,
} from "./fixtures/db";

/** Scenarios of openspec spec account-activation (change add-account-activation). */

const INVALID_CODE =
  "Mã kích hoạt không đúng hoặc đã hết hạn. Liên hệ quản trị viên để nhận mã mới.";
const RATE_LIMITED = "Bạn đã thử quá nhiều lần. Vui lòng thử lại sau ít phút.";
const USERNAME_TAKEN = "Tên đăng nhập này đã có người dùng. Hãy chọn tên khác.";
const SAMPLE_ACCOUNTS = Object.keys(ACCOUNTS).length;

const codeInput = (page: Page) => page.getByLabel("Mã kích hoạt");
const displayNameInput = (page: Page) => page.getByLabel("Họ tên");
const newUsernameInput = (page: Page) => page.getByLabel("Tên đăng nhập");
const newPasswordInput = (page: Page) => page.getByLabel("Mật khẩu", { exact: true });
const termsCheckbox = (page: Page) => page.getByLabel("Tôi đã đọc và đồng ý");
const accountStep = (page: Page) => page.getByText("Bước 2/2. Tạo tài khoản của bạn.");
const codeStep = (page: Page) => page.getByText("Bước 1/2. Nhập mã quản trị viên gửi cho bạn.");

async function enterCode(page: Page, code: string) {
  await page.goto("/activate");
  await codeInput(page).fill(code);
  await page.getByRole("button", { name: "Tiếp tục" }).click();
}

async function fillAccount(
  page: Page,
  values: { username: string; password?: string; displayName?: string; terms?: boolean },
) {
  if (values.displayName !== undefined) await displayNameInput(page).fill(values.displayName);
  await newUsernameInput(page).fill(values.username);
  await newPasswordInput(page).fill(values.password ?? "matkhau123");
  if (values.terms ?? true) await termsCheckbox(page).check();
  else await termsCheckbox(page).uncheck();
}

async function submitAccount(page: Page) {
  await page.getByRole("button", { name: "Tạo tài khoản" }).click();
}

/**
 * Waits for a "username taken" response to settle: error shown, form reset (password cleared)
 * and the cursor moved back to the username field. Typing earlier races React's reset.
 */
async function expectUsernameTaken(page: Page) {
  await expect(page.getByText(USERNAME_TAKEN)).toBeVisible();
  await expect(newUsernameInput(page)).toBeFocused();
  await expect(newPasswordInput(page)).toHaveValue("");
}

async function sessionCookie(context: BrowserContext) {
  return (await context.cookies()).find((cookie) => cookie.name === SESSION_COOKIE);
}

test.describe("account-activation", () => {
  test.skip(!hasDatabase, SKIP_WITHOUT_DATABASE);
  test.beforeEach(resetDatabase);
  test.afterAll(closeDatabase);

  test.describe("Kiểm mã trước khi tạo tài khoản", () => {
    test("Nhập mã đúng", async ({ page }) => {
      const { formatted } = await insertAccessCode({ recipient: "BS. Trần Thị B" });
      await enterCode(page, formatted);

      await expect(accountStep(page)).toBeVisible();
      await expect(page.getByText("Mã cho BS. Trần Thị B")).toBeVisible();
      await expect(page.getByText(/^Hết hạn \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/)).toBeVisible();
      await expect(newUsernameInput(page)).toBeVisible();
    });

    test("Nhập mã chữ thường không dấu gạch", async ({ page }) => {
      const { code } = await insertAccessCode();
      await enterCode(page, ` ${code.toLowerCase()} `);

      await expect(accountStep(page)).toBeVisible();
    });

    test("Bỏ trống mã", async ({ page }) => {
      await page.goto("/activate");
      await page.getByRole("button", { name: "Tiếp tục" }).click();

      await expect(page.getByText("Nhập mã kích hoạt.")).toBeVisible();
      await expect(codeInput(page)).toHaveAttribute("aria-invalid", "true");
      expect(await countAuthAttempts()).toBe(0);
    });
  });

  test.describe("Mã không dùng được không lộ lý do", () => {
    test("Mã không tồn tại", async ({ page }) => {
      await enterCode(page, "ABCD-EFGH");

      await expect(formAlert(page)).toHaveText(INVALID_CODE);
      await expect(codeStep(page)).toBeVisible();
    });

    test("Mã đã hết hạn", async ({ page }) => {
      const { formatted } = await insertAccessCode({ createdMinutesAgo: 72 * 60 + 1 });
      await enterCode(page, formatted);

      await expect(formAlert(page)).toHaveText(INVALID_CODE);
    });

    test("Mã đã dùng hoặc đã huỷ", async ({ page }) => {
      const used = await insertAccessCode({ usedBy: "minh" });
      const revoked = await insertAccessCode({ revoked: true });

      await enterCode(page, used.formatted);
      await expect(formAlert(page)).toHaveText(INVALID_CODE);
      await enterCode(page, revoked.formatted);
      await expect(formAlert(page)).toHaveText(INVALID_CODE);
    });

    test("Mã đặt lại mật khẩu dùng ở trang kích hoạt", async ({ page }) => {
      const { formatted } = await insertAccessCode({ type: "password_reset" });
      await enterCode(page, formatted);

      await expect(formAlert(page)).toHaveText(INVALID_CODE);
      expect(await countAccounts()).toBe(SAMPLE_ACCOUNTS);
    });
  });

  test.describe("Tạo tài khoản bằng mã kích hoạt", () => {
    test("Kích hoạt thành công", async ({ page, browser }) => {
      skipWhenSecureCookiesUnsupported(page);
      const { id, formatted } = await insertAccessCode({ recipient: "BS. Trần Thị B" });
      await enterCode(page, formatted);
      await fillAccount(page, { displayName: "Trần Thị B", username: "bs.tran" });
      await submitAccount(page);

      await expect(page).toHaveURL(/\/patients$/);
      await expect(page.getByRole("heading", { name: "Bệnh nhân" })).toBeVisible();
      expect(await sessionCookie(page.context())).toBeDefined();

      const account = await findAccountByUsername("bs.tran");
      expect(account).toMatchObject({
        role: "doctor",
        status: "active",
        display_name: "Trần Thị B",
      });
      expect(account?.terms_accepted_at).not.toBeNull();
      const code = (await listAccessCodeRows()).find((row) => row.id === id);
      expect(code?.used_at).not.toBeNull();
      expect(code?.account_id).toBe(account?.id);

      // The admin's list shows the code as used by bs.tran.
      const adminContext = await browser.newContext();
      const adminPage = await adminContext.newPage();
      await loginAs(adminPage, "admin", "/admin/access-codes");
      const row = adminPage.getByRole("listitem").filter({ hasText: "BS. Trần Thị B" });
      await expect(row).toContainText("Đã dùng");
      await expect(row).toContainText("bs.tran");
      await adminContext.close();
    });

    test("Đăng nhập lại bằng tài khoản vừa tạo", async ({ page }) => {
      skipWhenSecureCookiesUnsupported(page);
      const { formatted } = await insertAccessCode();
      await enterCode(page, formatted);
      await fillAccount(page, { username: "bs.tran", password: "matkhau123" });
      await submitAccount(page);
      await expect(page).toHaveURL(/\/patients$/);

      await page.goto("/settings");
      await page.getByRole("button", { name: "Đăng xuất" }).click();
      await expect(page).toHaveURL(/\/login$/);
      await submitLogin(page, "bs.tran", "matkhau123");

      await expect(page).toHaveURL(/\/patients$/);
    });

    test("Họ tên điền sẵn từ tên người nhận", async ({ page }) => {
      const { formatted } = await insertAccessCode({ recipient: "BS. Trần Thị B" });
      await enterCode(page, formatted);

      await expect(displayNameInput(page)).toHaveValue("BS. Trần Thị B");
      await displayNameInput(page).fill("Trần Thị Bình");
      await expect(displayNameInput(page)).toHaveValue("Trần Thị Bình");
    });
  });

  test.describe("Quy tắc tên đăng nhập, mật khẩu và họ tên", () => {
    test("Tên đăng nhập có dấu", async ({ page }) => {
      const { formatted } = await insertAccessCode();
      await enterCode(page, formatted);
      await fillAccount(page, { username: "bs.lân" });
      await submitAccount(page);

      await expect(
        page.getByText("Tên đăng nhập gồm 3–32 ký tự: chữ không dấu, số, dấu chấm, gạch dưới."),
      ).toBeVisible();
      await expect(newUsernameInput(page)).toHaveAttribute("aria-invalid", "true");
      expect(await countAccounts()).toBe(SAMPLE_ACCOUNTS);
    });

    test("Tên đăng nhập viết hoa", async ({ page }) => {
      const { formatted } = await insertAccessCode();
      await enterCode(page, formatted);
      await fillAccount(page, { username: " BS.Tran " });
      await submitAccount(page);

      await expect.poll(() => findAccountByUsername("bs.tran")).toBeDefined();
    });

    test("Tên đăng nhập đã có người dùng", async ({ page }) => {
      const { formatted } = await insertAccessCode();
      await enterCode(page, formatted);
      await fillAccount(page, { username: ACCOUNTS.lan.username });
      await submitAccount(page);

      await expectUsernameTaken(page);
      await expect(newUsernameInput(page)).toHaveValue(ACCOUNTS.lan.username);
      const [code] = await listAccessCodeRows();
      expect(code?.used_at).toBeNull();

      await fillAccount(page, { username: "bs.tran" });
      await submitAccount(page);
      await expect.poll(() => findAccountByUsername("bs.tran")).toBeDefined();
    });

    test("Mật khẩu quá ngắn", async ({ page }) => {
      const { formatted } = await insertAccessCode();
      await enterCode(page, formatted);
      await fillAccount(page, { username: "bs.tran", password: "1234567" });
      await submitAccount(page);

      await expect(page.getByText("Mật khẩu cần tối thiểu 8 ký tự.")).toBeVisible();
      await expect(newPasswordInput(page)).toHaveAttribute("aria-invalid", "true");
      expect(await countAccounts()).toBe(SAMPLE_ACCOUNTS);
    });
  });

  test.describe("Đồng ý lưu ý sử dụng", () => {
    test("Chưa tick đồng ý", async ({ page }) => {
      const { formatted } = await insertAccessCode();
      await enterCode(page, formatted);
      await fillAccount(page, { username: "bs.tran", terms: false });
      await submitAccount(page);

      await expect(page.getByText("Bạn cần đọc và đồng ý lưu ý sử dụng.")).toBeVisible();
      expect(await countAccounts()).toBe(SAMPLE_ACCOUNTS);
    });

    test("Lưu ý hiện trước khi tạo tài khoản", async ({ page }) => {
      const { formatted } = await insertAccessCode();
      await enterCode(page, formatted);

      const notice = page.getByRole("region", { name: "Trước khi bắt đầu" });
      await expect(notice).toContainText("không thay thế hồ sơ bệnh án");
      await expect(notice).toContainText("sao lưu thường xuyên");
    });
  });

  test.describe("Mã chỉ tạo được một tài khoản", () => {
    test("Dùng lại mã đã kích hoạt", async ({ page, browser }) => {
      const { formatted } = await insertAccessCode();
      await enterCode(page, formatted);
      await fillAccount(page, { username: "bs.tran" });
      await submitAccount(page);
      await expect.poll(() => findAccountByUsername("bs.tran")).toBeDefined();

      const other = await browser.newContext();
      const otherPage = await other.newPage();
      await enterCode(otherPage, formatted);
      await expect(formAlert(otherPage)).toHaveText(INVALID_CODE);
      await other.close();
    });

    test("Hai lần gửi cùng lúc", async ({ page, browser }) => {
      const { formatted } = await insertAccessCode();
      const other = await browser.newContext();
      const otherPage = await other.newPage();

      await enterCode(page, formatted);
      await enterCode(otherPage, formatted);
      await fillAccount(page, { username: "bs.mot" });
      await fillAccount(otherPage, { username: "bs.hai" });
      await Promise.all([submitAccount(page), submitAccount(otherPage)]);

      await expect.poll(countAccounts).toBe(SAMPLE_ACCOUNTS + 1);
      const refused = await Promise.all(
        [page, otherPage].map((candidate) =>
          expect(formAlert(candidate))
            .toHaveText(INVALID_CODE, { timeout: 10_000 })
            .then(
              () => true,
              () => false,
            ),
        ),
      );
      expect(refused.filter(Boolean)).toHaveLength(1);
      const created = [
        await findAccountByUsername("bs.mot"),
        await findAccountByUsername("bs.hai"),
      ];
      expect(created.filter(Boolean)).toHaveLength(1);
      await other.close();
    });

    test("Admin huỷ mã khi bác sĩ đang điền form", async ({ page }) => {
      const { id, formatted } = await insertAccessCode();
      await enterCode(page, formatted);
      await fillAccount(page, { username: "bs.tran" });
      await revokeAccessCodeInDb(id);
      await submitAccount(page);

      await expect(formAlert(page)).toHaveText(INVALID_CODE);
      await expect(codeStep(page)).toBeVisible();
      await expect(codeInput(page)).toBeVisible();
      expect(await countAccounts()).toBe(SAMPLE_ACCOUNTS);
    });
  });

  test.describe("Giới hạn nhập sai mã theo địa chỉ IP", () => {
    test("Lần nhập mã thứ mười một bị từ chối", async ({ page }) => {
      const { formatted } = await insertAccessCode();
      await insertCodeFailures(10, 1);
      await enterCode(page, formatted);

      await expect(formAlert(page)).toHaveText(RATE_LIMITED);
      await expect(accountStep(page)).toHaveCount(0);
    });

    test("Hết cửa sổ thì nhập mã lại được", async ({ page }) => {
      const { formatted } = await insertAccessCode();
      await insertCodeFailures(10, 16);
      await enterCode(page, formatted);

      await expect(accountStep(page)).toBeVisible();
    });

    test("counts each unusable code entered from the page", async ({ page }) => {
      for (let i = 0; i < 10; i++) {
        await enterCode(page, "ABCD-EFGH");
        await expect(formAlert(page)).toHaveText(INVALID_CODE);
      }
      const { formatted } = await insertAccessCode();
      await enterCode(page, formatted);

      await expect(formAlert(page)).toHaveText(RATE_LIMITED);
    });

    test("Lỗi ở form tạo tài khoản không tính là nhập sai mã", async ({ page }) => {
      const { formatted } = await insertAccessCode();
      await enterCode(page, formatted);
      for (let i = 0; i < 10; i++) {
        await fillAccount(page, { username: ACCOUNTS.lan.username });
        await submitAccount(page);
        await expectUsernameTaken(page);
      }

      await fillAccount(page, { username: "bs.tran" });
      await submitAccount(page);
      await expect.poll(() => findAccountByUsername("bs.tran")).toBeDefined();
    });
  });

  test.describe("Trang kích hoạt dùng tốt trên điện thoại", () => {
    test("Thuộc tính ô nhập", async ({ page }) => {
      const { formatted } = await insertAccessCode();
      await page.goto("/activate");

      const code = codeInput(page);
      await expect(code).toHaveAttribute("autocapitalize", "characters");
      await expect(code).toHaveAttribute("autocorrect", "off");
      await expect(code).toHaveAttribute("spellcheck", "false");
      await expect(code).toHaveAttribute("autocomplete", "off");

      await code.fill(formatted);
      await page.getByRole("button", { name: "Tiếp tục" }).click();
      await expect(newUsernameInput(page)).toHaveAttribute("autocapitalize", "none");
      await expect(newUsernameInput(page)).toHaveAttribute("autocomplete", "username");
      await expect(newPasswordInput(page)).toHaveAttribute("autocomplete", "new-password");

      await newPasswordInput(page).fill("bi-mat-123");
      await page.getByRole("button", { name: "Hiện mật khẩu" }).click();
      await expect(newPasswordInput(page)).toHaveAttribute("type", "text");
    });

    test("Mở trang kích hoạt từ trang đăng nhập", async ({ page }) => {
      await page.goto("/login");
      await page.getByRole("link", { name: "Kích hoạt tài khoản" }).click();

      await expect(page).toHaveURL(/\/activate$/);
      await expect(codeInput(page)).toBeVisible();

      await page.getByRole("link", { name: "Đăng nhập" }).click();
      await expect(page).toHaveURL(/\/login$/);
    });

    test("Không lộ thông tin lên URL", async ({ page }) => {
      const { code, formatted } = await insertAccessCode();
      const urls: string[] = [];
      page.on("framenavigated", (frame) => {
        if (frame === page.mainFrame()) urls.push(frame.url());
      });

      await enterCode(page, "ABCD-EFGH");
      await expect(formAlert(page)).toHaveText(INVALID_CODE);
      await enterCode(page, formatted);
      await fillAccount(page, { username: ACCOUNTS.lan.username, password: "matkhau-bi-mat" });
      await submitAccount(page);
      await expectUsernameTaken(page);
      await fillAccount(page, { username: "bs.tran", password: "matkhau-bi-mat" });
      await submitAccount(page);
      await expect.poll(() => findAccountByUsername("bs.tran")).toBeDefined();

      urls.push(page.url());
      for (const url of urls) {
        for (const secret of [
          code,
          formatted,
          "ABCD",
          "bs.tran",
          ACCOUNTS.lan.username,
          "bi-mat",
        ]) {
          expect(url).not.toContain(secret);
        }
      }
    });
  });
});
