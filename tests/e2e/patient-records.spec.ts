import { expect, type Page, test } from "@playwright/test";

import { formAlert, loginAs } from "./fixtures/auth";
import {
  closeDatabase,
  hasDatabase,
  insertPatient,
  listPatientRows,
  resetDatabase,
  SKIP_WITHOUT_DATABASE,
} from "./fixtures/db";

/** Scenarios of openspec spec patient-records (change add-patient-records). */

const PATIENT_URL = /\/patients\/[0-9a-f-]{36}$/;
const NOT_FOUND = "Không tìm thấy bệnh nhân";

/** Current year in Vietnam, as the app computes ages. */
const THIS_YEAR = Number(
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric" }).format(
    new Date(),
  ),
);

const nameInput = (page: Page) => page.getByLabel("Họ tên");
const birthInput = (page: Page) => page.getByLabel("Năm sinh hoặc tuổi");
const hometownInput = (page: Page) => page.getByLabel("Quê quán");
const phoneInput = (page: Page) => page.getByLabel("Số điện thoại");
const codeInput = (page: Page) => page.getByLabel("Mã bệnh nhân");
const summaryInput = (page: Page) => page.getByLabel("Tóm tắt");
const saveButton = (page: Page) => page.getByRole("button", { name: "Lưu", exact: true });
const rows = (page: Page) => page.getByRole("list").first().getByRole("listitem");

async function openNewPatient(page: Page) {
  await loginAs(page, "lan", "/patients/new");
  await expect(nameInput(page)).toBeFocused();
}

test.describe("patient-records", () => {
  test.skip(!hasDatabase, SKIP_WITHOUT_DATABASE);
  test.beforeEach(resetDatabase);
  test.afterAll(closeDatabase);

  test.describe("Danh sách bệnh nhân", () => {
    test("Xem danh sách", async ({ page }) => {
      await insertPatient("lan", {
        fullName: "Nguyễn Văn An",
        gender: "male",
        birthYear: 1979,
        hometown: "Nghệ An",
        minutesAgo: 60,
      });
      await insertPatient("lan", { fullName: "Trần Thị Bình", minutesAgo: 5 });
      await loginAs(page, "lan", "/patients");

      await expect(page.getByText("2 bệnh nhân")).toBeVisible();
      await expect(rows(page)).toHaveCount(2);
      await expect(rows(page).nth(0)).toContainText("Trần Thị Bình");
      await expect(rows(page).nth(1)).toContainText("Nguyễn Văn An");
      await expect(rows(page).nth(1)).toContainText(`Nam · ${THIS_YEAR - 1979} tuổi · Nghệ An`);

      await rows(page).nth(1).getByRole("link").click();
      await expect(page).toHaveURL(PATIENT_URL);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nguyễn Văn An");
    });

    test("Sửa thì lên đầu danh sách", async ({ page }) => {
      const an = await insertPatient("lan", { fullName: "Nguyễn Văn An", minutesAgo: 60 });
      await insertPatient("lan", { fullName: "Trần Thị Bình", minutesAgo: 5 });
      await loginAs(page, "lan", `/patients/${an}/edit`);

      await hometownInput(page).fill("Nghệ An");
      await saveButton(page).click();
      await expect(page).toHaveURL(new RegExp(`/patients/${an}$`));

      await page.goto("/patients");
      await expect(rows(page).nth(0)).toContainText("Nguyễn Văn An");
      await expect(rows(page).nth(1)).toContainText("Trần Thị Bình");
    });

    test("Danh sách không lộ tóm tắt", async ({ page }) => {
      await insertPatient("lan", {
        fullName: "Nguyễn Văn An",
        summary: "Dị ứng Penicillin",
        phone: "0912345678",
        patientCode: "BN-10234",
      });
      await loginAs(page, "lan", "/patients");

      await expect(rows(page)).toHaveCount(1);
      const html = await page.content();
      for (const secret of ["Dị ứng Penicillin", "0912345678", "BN-10234"]) {
        expect(html).not.toContain(secret);
      }
    });

    test("Họ tên rất dài", async ({ page }) => {
      // No spaces: wrapping cannot hide a missing `truncate`.
      await insertPatient("lan", { fullName: "Ngọc".repeat(25), birthYear: 1990 });
      await page.setViewportSize({ width: 360, height: 760 });
      await loginAs(page, "lan", "/patients");

      await expect(rows(page)).toHaveCount(1);
      const name = rows(page).first().getByText("Ngọc".repeat(25));
      const lineHeight = await name.evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).lineHeight),
      );
      expect((await name.boundingBox())?.height).toBeLessThanOrEqual(lineHeight + 1);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });

    test("Sổ chưa có bệnh nhân", async ({ page }) => {
      await loginAs(page, "lan", "/patients");

      await expect(page.getByText("Sổ chưa có bệnh nhân nào")).toBeVisible();
      await page.getByRole("link", { name: "Thêm bệnh nhân" }).click();
      await expect(page).toHaveURL(/\/patients\/new$/);
    });
  });

  test.describe("Thêm bệnh nhân", () => {
    test("Thêm chỉ với họ tên", async ({ page }) => {
      await openNewPatient(page);
      await nameInput(page).fill("Nguyễn Văn An");
      await saveButton(page).click();

      await expect(page).toHaveURL(PATIENT_URL);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nguyễn Văn An");
      await page.goto("/patients");
      await expect(rows(page)).toHaveCount(1);
      await expect(rows(page).first()).toContainText("Nguyễn Văn An");
    });

    test("Thêm với đủ thông tin", async ({ page }) => {
      await openNewPatient(page);
      await nameInput(page).fill("Nguyễn Văn An");
      await birthInput(page).fill("1979");
      await page.getByText("Nam", { exact: true }).click();
      await hometownInput(page).fill("Nghệ An");
      await phoneInput(page).fill("0912 345 678");
      await codeInput(page).fill("BN-10234");
      await summaryInput(page).fill("Dị ứng Penicillin");
      await saveButton(page).click();

      await expect(page).toHaveURL(PATIENT_URL);
      await expect(page.getByText(`Nam · ${THIS_YEAR - 1979} tuổi (1979) · Nghệ An`)).toBeVisible();
      await expect(page.getByRole("link", { name: "0912 345 678" })).toBeVisible();
      await expect(page.getByText("BN-10234")).toBeVisible();
      await expect(page.getByText("Dị ứng Penicillin")).toBeVisible();

      const [row] = await listPatientRows("lan");
      expect(row).toMatchObject({ gender: "male", birth_year: 1979, birth_date: null });
      expect(row?.search_text).toBe("nguyen van an nghe an 0912 345 678 bn-10234");
    });

    test("Thiếu họ tên", async ({ page }) => {
      await openNewPatient(page);
      await nameInput(page).fill("   ");
      await saveButton(page).click();

      await expect(page.getByText("Nhập họ tên bệnh nhân.")).toBeVisible();
      await expect(nameInput(page)).toHaveAttribute("aria-invalid", "true");
      await expect(nameInput(page)).toBeFocused();
      expect(await listPatientRows("lan")).toHaveLength(0);
    });

    test("Số điện thoại sai", async ({ page }) => {
      await openNewPatient(page);
      await nameInput(page).fill("Nguyễn Văn An");
      await phoneInput(page).fill("09ab");
      await saveButton(page).click();

      await expect(
        page.getByText("Số điện thoại chỉ gồm chữ số, dấu cách và + - . ( )"),
      ).toBeVisible();
      expect(await listPatientRows("lan")).toHaveLength(0);
    });

    test("Nhập tuổi nhanh", async ({ page }) => {
      await openNewPatient(page);
      await nameInput(page).fill("Nguyễn Văn An");
      await birthInput(page).fill("45t");

      await expect(page.getByText(`Năm sinh ${THIS_YEAR - 45} · 45 tuổi`)).toBeVisible();
      await saveButton(page).click();
      await expect(page).toHaveURL(PATIENT_URL);
      await expect(page.getByText(`45 tuổi (${THIS_YEAR - 45})`)).toBeVisible();
    });

    test("Nhập không hiểu được", async ({ page }) => {
      await openNewPatient(page);
      await nameInput(page).fill("Nguyễn Văn An");
      await birthInput(page).fill("khoảng 40");
      await saveButton(page).click();

      await expect(
        page.getByText("Nhập năm sinh (1979), tuổi (45t) hoặc ngày sinh (12/03/1979)."),
      ).toBeVisible();
      await expect(birthInput(page)).toBeFocused();
      expect(await listPatientRows("lan")).toHaveLength(0);
    });
  });

  test.describe("Gợi ý trùng tên khi thêm", () => {
    test("Trùng tên và năm sinh", async ({ page }) => {
      const an = await insertPatient("lan", {
        fullName: "Nguyễn Văn An",
        birthYear: 1979,
        hometown: "Nghệ An",
      });
      await openNewPatient(page);
      await nameInput(page).fill("nguyen van an");
      await birthInput(page).fill("1979");

      const hint = page.getByRole("region", { name: "Có phải người này?" });
      await expect(hint).toBeVisible();
      await expect(hint).toContainText("Nguyễn Văn An");
      await expect(hint.getByRole("link", { name: "Mở hồ sơ" })).toHaveAttribute(
        "href",
        `/patients/${an}`,
      );
    });

    test("Khác năm sinh thì không gợi ý", async ({ page }) => {
      await insertPatient("lan", { fullName: "Nguyễn Văn An", birthYear: 1979 });
      await openNewPatient(page);
      await nameInput(page).fill("Nguyễn Văn An");
      await birthInput(page).fill("1990");

      await expect(page.getByText("Năm sinh 1990")).toBeVisible();
      await expect(page.getByText("Có phải người này?")).toHaveCount(0);
    });

    test("Gợi ý không chặn việc thêm", async ({ page }) => {
      await insertPatient("lan", { fullName: "Nguyễn Văn An" });
      await openNewPatient(page);
      await nameInput(page).fill("Nguyễn Văn An");
      await expect(page.getByText("Có phải người này?")).toBeVisible();
      await saveButton(page).click();

      await expect(page).toHaveURL(PATIENT_URL);
      await page.goto("/patients");
      await expect(rows(page).filter({ hasText: "Nguyễn Văn An" })).toHaveCount(2);
    });
  });

  test.describe("Chi tiết bệnh nhân", () => {
    test("Gọi điện từ trang chi tiết", async ({ page }) => {
      const id = await insertPatient("lan", { fullName: "Nguyễn Văn An", phone: "0912 345 678" });
      await loginAs(page, "lan", `/patients/${id}`);

      await expect(page.getByRole("link", { name: "0912 345 678" })).toHaveAttribute(
        "href",
        "tel:0912345678",
      );
    });

    test("Link trong tóm tắt", async ({ page }) => {
      const id = await insertPatient("lan", {
        fullName: "Nguyễn Văn An",
        summary: "KQ XN: https://lab.example.vn/kq/123 và <b>đậm</b>",
      });
      await loginAs(page, "lan", `/patients/${id}`);

      const link = page.getByRole("link", { name: "https://lab.example.vn/kq/123" });
      await expect(link).toHaveAttribute("href", "https://lab.example.vn/kq/123");
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", "noopener noreferrer");
      await expect(page.getByText("và <b>đậm</b>")).toBeVisible();
      await expect(page.locator("b", { hasText: "đậm" })).toHaveCount(0);
    });

    test("Chưa có tóm tắt", async ({ page }) => {
      const id = await insertPatient("lan", { fullName: "Trần Thị Bình" });
      await loginAs(page, "lan", `/patients/${id}`);

      await expect(page.getByText("Chưa có tóm tắt.")).toBeVisible();
      await expect(page.getByText("Số điện thoại")).toHaveCount(0);
      await expect(page.getByText("Mã bệnh nhân")).toHaveCount(0);
      await page.getByRole("link", { name: "Thêm tóm tắt" }).click();
      await expect(page).toHaveURL(new RegExp(`/patients/${id}/edit$`));
    });
  });

  test.describe("Sửa thông tin bệnh nhân", () => {
    test("Sửa và xoá một ô", async ({ page }) => {
      const id = await insertPatient("lan", {
        fullName: "Nguyễn Văn An",
        birthDate: "1979-03-12",
        birthYear: 1979,
        hometown: "Nghệ An",
      });
      await loginAs(page, "lan", `/patients/${id}/edit`);

      await expect(birthInput(page)).toHaveValue("12/03/1979");
      await nameInput(page).fill("Nguyễn Văn Ân");
      await hometownInput(page).fill("");
      await saveButton(page).click();

      await expect(page).toHaveURL(new RegExp(`/patients/${id}$`));
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nguyễn Văn Ân");
      await expect(page.getByText("Nghệ An")).toHaveCount(0);
      const [row] = await listPatientRows("lan");
      expect(row).toMatchObject({ hometown: null, birth_date: "1979-03-12" });
      expect(row?.search_text).toBe("nguyen van an");
    });

    test("Sửa cùng lúc ở hai thiết bị", async ({ page, browser }) => {
      const id = await insertPatient("lan", { fullName: "Nguyễn Văn An", hometown: "Nghệ An" });
      await loginAs(page, "lan", `/patients/${id}/edit`);

      // The first device saves through the app, a few milliseconds after the second loaded.
      const firstDevice = await browser.newContext();
      try {
        const firstPage = await firstDevice.newPage();
        await loginAs(firstPage, "lan", `/patients/${id}/edit`);
        await hometownInput(firstPage).fill("Quỳnh Lưu, Nghệ An");
        await saveButton(firstPage).click();
        await expect(firstPage).toHaveURL(new RegExp(`/patients/${id}$`));
      } finally {
        await firstDevice.close();
      }

      await summaryInput(page).fill("Ghi ở thiết bị thứ hai");
      await saveButton(page).click();

      await expect(formAlert(page)).toHaveText(
        "Bệnh nhân vừa được sửa ở thiết bị khác. Tải lại trang để xem bản mới nhất.",
      );
      await expect(summaryInput(page)).toHaveValue("Ghi ở thiết bị thứ hai");
      const [row] = await listPatientRows("lan");
      expect(row).toMatchObject({ hometown: "Quỳnh Lưu, Nghệ An", summary: null });
    });
  });

  test.describe("Không mất chữ khi lưu thất bại", () => {
    test("Mạng hỏng dù máy báo vẫn có mạng", async ({ page }) => {
      await openNewPatient(page);
      // Wi-Fi without internet: the browser says online, the request never gets an answer.
      await page.route("**/patients/new", (route) =>
        route.request().method() === "POST"
          ? route.abort("internetdisconnected")
          : route.continue(),
      );
      await nameInput(page).fill("Nguyễn Văn An");
      await saveButton(page).click();

      await expect(formAlert(page)).toHaveText(
        "Không gửi được vì mất mạng. Chữ đã nhập vẫn còn, bấm Lưu lại khi có mạng.",
      );
      await expect(nameInput(page)).toHaveValue("Nguyễn Văn An");
      expect(await listPatientRows("lan")).toHaveLength(0);
    });

    test("Mất mạng khi lưu", async ({ page, context }) => {
      await openNewPatient(page);
      await nameInput(page).fill("Nguyễn Văn An");
      await summaryInput(page).fill("Dị ứng Penicillin");
      await context.setOffline(true);

      await expect(
        page.getByText("Đang mất mạng. Chữ đã nhập vẫn còn trên trang này."),
      ).toBeVisible();
      await saveButton(page).click();

      await expect(formAlert(page)).toHaveText(
        "Không gửi được vì mất mạng. Chữ đã nhập vẫn còn, bấm Lưu lại khi có mạng.",
      );
      await expect(nameInput(page)).toHaveValue("Nguyễn Văn An");
      await expect(summaryInput(page)).toHaveValue("Dị ứng Penicillin");

      await context.setOffline(false);
      await saveButton(page).click();
      await expect(page).toHaveURL(PATIENT_URL);
    });

    test("Lỗi ở một ô không xoá các ô khác", async ({ page }) => {
      await openNewPatient(page);
      await nameInput(page).fill("Nguyễn Văn An");
      await birthInput(page).fill("1979");
      await page.getByText("Nữ", { exact: true }).click();
      await hometownInput(page).fill("Nghệ An");
      await summaryInput(page).fill("Dị ứng Penicillin");
      await phoneInput(page).fill("09ab");
      await saveButton(page).click();

      await expect(phoneInput(page)).toHaveAttribute("aria-invalid", "true");
      await expect(page.locator('[aria-invalid="true"]')).toHaveCount(1);
      await expect(nameInput(page)).toHaveValue("Nguyễn Văn An");
      await expect(birthInput(page)).toHaveValue("1979");
      await expect(page.getByRole("radio", { name: "Nữ" })).toBeChecked();
      await expect(hometownInput(page)).toHaveValue("Nghệ An");
      await expect(summaryInput(page)).toHaveValue("Dị ứng Penicillin");
      await expect(phoneInput(page)).toHaveValue("09ab");
    });
  });

  test.describe("Riêng tư trên màn hình và trong URL", () => {
    test("Tiêu đề tab của trang chi tiết", async ({ page }) => {
      const id = await insertPatient("lan", { fullName: "Nguyễn Văn An" });
      await loginAs(page, "lan", `/patients/${id}`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nguyễn Văn An");
      expect(await page.title()).not.toContain("Nguyễn Văn An");

      await page.goto(`/patients/${id}/edit`);
      await expect(nameInput(page)).toHaveValue("Nguyễn Văn An");
      expect(await page.title()).not.toContain("Nguyễn Văn An");
    });

    test("URL không chứa dữ liệu đã nhập", async ({ page }) => {
      const urls: string[] = [];
      page.on("request", (request) => urls.push(request.url()));

      await openNewPatient(page);
      await nameInput(page).fill("Nguyễn Văn An");
      await hometownInput(page).fill("Nghệ An");
      await codeInput(page).fill("BN-10234");
      await saveButton(page).click();
      await expect(page).toHaveURL(PATIENT_URL);
      await page.getByRole("link", { name: "Sửa" }).click();
      await hometownInput(page).fill("Nghệ An mới");
      await saveButton(page).click();
      await expect(page.getByText("Nghệ An mới")).toBeVisible();

      urls.push(page.url());
      for (const secret of ["Nguyễn Văn An", "Nghệ An", "BN-10234"]) {
        for (const url of urls) {
          expect(url).not.toContain(secret);
          expect(url).not.toContain(encodeURIComponent(secret));
          expect(url).not.toContain(encodeURIComponent(secret).replace(/%20/g, "+"));
        }
      }
    });
  });

  test.describe("Bệnh nhân tách theo bác sĩ", () => {
    test("Mở bệnh nhân của bác sĩ khác", async ({ page }) => {
      const id = await insertPatient("lan", {
        fullName: "Nguyễn Văn An",
        summary: "Dị ứng Penicillin",
      });
      await loginAs(page, "minh", `/patients/${id}`);

      await expect(page.getByText(NOT_FOUND)).toBeVisible();
      await expect(page.getByText("Nguyễn Văn An")).toHaveCount(0);
      await expect(page.getByText("Dị ứng Penicillin")).toHaveCount(0);

      await page.goto(`/patients/${id}/edit`);
      await expect(page.getByText(NOT_FOUND)).toBeVisible();
      await expect(nameInput(page)).toHaveCount(0);
    });

    test("Sửa bệnh nhân của bác sĩ khác", async ({ page }) => {
      const lanPatient = await insertPatient("lan", { fullName: "Nguyễn Văn An" });
      const minhPatient = await insertPatient("minh", { fullName: "Trần Thị Bình" });
      await loginAs(page, "minh", `/patients/${minhPatient}/edit`);

      // A tampered form: bs.minh's own edit page, posting bs.lan's patient id. Tampered last:
      // any re-render (typing) makes React put its own value back into the hidden field.
      await nameInput(page).fill("Đã bị sửa");
      await page
        .locator('input[name="patientId"]')
        .evaluate((input: HTMLInputElement, id) => (input.value = id), lanPatient);
      await saveButton(page).click();

      await expect(formAlert(page)).toHaveText("Không tìm thấy bệnh nhân.");
      const [lanRow] = await listPatientRows("lan");
      expect(lanRow?.full_name).toBe("Nguyễn Văn An");
      const [minhRow] = await listPatientRows("minh");
      expect(minhRow?.full_name).toBe("Trần Thị Bình");
    });

    test("Danh sách chỉ có bệnh nhân của mình", async ({ page }) => {
      await insertPatient("lan", { fullName: "Nguyễn Văn An" });
      await insertPatient("minh", { fullName: "Trần Thị Bình" });
      await loginAs(page, "minh", "/patients");

      await expect(page.getByText("1 bệnh nhân")).toBeVisible();
      await expect(rows(page)).toHaveCount(1);
      await expect(rows(page).first()).toContainText("Trần Thị Bình");
    });

    test("Id sai định dạng", async ({ page }) => {
      await loginAs(page, "lan", "/patients/khong-phai-id");
      await expect(page.getByText(NOT_FOUND)).toBeVisible();

      await page.goto("/patients/00000000-0000-4000-8000-000000000000");
      await expect(page.getByText(NOT_FOUND)).toBeVisible();
    });
  });

  test.describe("Form bệnh nhân dùng tốt trên điện thoại", () => {
    test("Thuộc tính ô của form", async ({ page }) => {
      await openNewPatient(page);

      await expect(phoneInput(page)).toHaveAttribute("type", "tel");
      for (const input of [
        nameInput(page),
        birthInput(page),
        hometownInput(page),
        phoneInput(page),
        codeInput(page),
        summaryInput(page),
      ]) {
        await expect(input).toHaveAttribute("autocomplete", "off");
        expect(
          Number.parseFloat(await input.evaluate((element) => getComputedStyle(element).fontSize)),
        ).toBeGreaterThanOrEqual(16);
      }
    });

    test("Bỏ chọn giới tính", async ({ page }) => {
      await openNewPatient(page);
      const male = page.getByRole("radio", { name: "Nam" });
      await page.getByText("Nam", { exact: true }).click();
      await expect(male).toBeChecked();
      await page.getByText("Nam", { exact: true }).click();
      await expect(male).not.toBeChecked();

      await page.getByText("Nữ", { exact: true }).click();
      await page.getByRole("radio", { name: "Nữ" }).press("Space");
      await expect(page.getByRole("radio", { name: "Nữ" })).not.toBeChecked();

      await nameInput(page).fill("Nguyễn Văn An");
      await saveButton(page).click();
      await expect(page).toHaveURL(PATIENT_URL);
      const [row] = await listPatientRows("lan");
      expect(row?.gender).toBeNull();
    });

    test("Enter để lưu nhanh", async ({ page }) => {
      await openNewPatient(page);
      await nameInput(page).fill("Nguyễn Văn An");
      await nameInput(page).press("Enter");

      await expect(page).toHaveURL(PATIENT_URL);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nguyễn Văn An");
    });
  });
});
