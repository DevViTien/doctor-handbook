import { expect, type Page, test } from "@playwright/test";

import { loginAs } from "./fixtures/auth";
import {
  closeDatabase,
  hasDatabase,
  insertNote,
  insertPatient,
  resetDatabase,
  SKIP_WITHOUT_DATABASE,
} from "./fixtures/db";

/** Scenarios of openspec spec patient-search (change add-patient-search). */

const searchInput = (page: Page) => page.getByRole("searchbox", { name: "Tìm bệnh nhân" });
// The results list inside <main>, never the bottom navigation's list.
const results = (page: Page) =>
  page.getByRole("main").getByRole("list").first().getByRole("listitem");
const NONE = "Không thấy bệnh nhân nào khớp";

/**
 * A fake Web Speech API: `mode = "hear"` hears "Trần Thị" then "Trần Thị Bình",
 * `mode = "deny"` fails like a refused microphone, `mode = "none"` removes the API.
 */
async function fakeSpeech(page: Page, mode: "hear" | "deny" | "none") {
  await page.addInitScript((speechMode) => {
    const w = window as unknown as Record<string, unknown>;
    if (speechMode === "none") {
      delete w.SpeechRecognition;
      delete w.webkitSpeechRecognition;
      return;
    }
    type Handler = ((event: unknown) => void) | null;
    class FakeRecognition {
      lang = "";
      onresult: Handler = null;
      onerror: Handler = null;
      onend: (() => void) | null = null;
      start() {
        w.__speechLang = this.lang;
        if (speechMode === "deny") {
          setTimeout(() => {
            this.onerror?.({ error: "not-allowed" });
            this.onend?.();
          }, 50);
          return;
        }
        setTimeout(() => this.onresult?.({ results: [[{ transcript: "Trần Thị" }]] }), 50);
        setTimeout(() => {
          // Two results, as Safari and some Android builds send: joined with a space.
          this.onresult?.({ results: [[{ transcript: "Trần Thị" }], [{ transcript: "Bình" }]] });
          this.onend?.();
        }, 150);
      }
      stop() {
        this.onend?.();
      }
      abort() {
        this.onerror?.({ error: "aborted" });
        this.onend?.();
      }
    }
    w.SpeechRecognition = FakeRecognition;
    w.webkitSpeechRecognition = FakeRecognition;
  }, mode);
}

test.describe("patient-search", () => {
  test.skip(!hasDatabase, SKIP_WITHOUT_DATABASE);
  test.beforeEach(resetDatabase);
  test.afterAll(closeDatabase);

  let anNgheAn: string;
  test.beforeEach(async () => {
    anNgheAn = await insertPatient("lan", {
      fullName: "Nguyễn Văn An",
      hometown: "Nghệ An",
      phone: "0912 345 678",
      patientCode: "BN-10234",
      minutesAgo: 30,
    });
    await insertPatient("lan", {
      fullName: "Nguyễn Văn An",
      hometown: "Thanh Hoá",
      minutesAgo: 40,
    });
    await insertPatient("lan", {
      fullName: "Trần Thị Bình",
      hometown: "Hà Tĩnh",
      summary: "Tiền sử đái tháo đường",
      minutesAgo: 20,
    });
  });

  async function openList(page: Page) {
    await loginAs(page, "lan", "/patients");
    await expect(results(page)).toHaveCount(3);
  }

  test.describe("Ô tìm kiếm và lọc tức thì", () => {
    test("Xoá từ khoá", async ({ page }) => {
      await openList(page);
      await searchInput(page).fill("bình");
      await expect(results(page)).toHaveCount(1);
      await expect(page.getByText("1 kết quả")).toBeVisible();

      await page.getByRole("button", { name: "Xoá từ khoá" }).click();
      await expect(searchInput(page)).toHaveValue("");
      await expect(results(page)).toHaveCount(3);
      await expect(page.getByText("3 bệnh nhân")).toBeVisible();
    });

    test("Thuộc tính ô tìm", async ({ page }) => {
      await openList(page);
      await expect(searchInput(page)).toHaveAttribute("type", "search");
      await expect(searchInput(page)).toHaveAttribute("autocomplete", "off");
      const fontSize = await searchInput(page).evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).fontSize),
      );
      expect(fontSize).toBeGreaterThanOrEqual(16);
    });

    test("Gõ không dấu", async ({ page }) => {
      await openList(page);
      await searchInput(page).fill("tran thi binh");
      await expect(results(page)).toHaveCount(1);
      await expect(results(page).first()).toContainText("Trần Thị Bình");
    });

    test("Từ theo thứ tự bất kỳ, gồm cả quê", async ({ page }) => {
      await openList(page);
      await searchInput(page).fill("an nghe");
      await expect(results(page)).toHaveCount(1);
      await expect(results(page).first()).toContainText("Nghệ An");
    });

    test("Lọc khi mất mạng", async ({ page, context }) => {
      await openList(page);
      await context.setOffline(true);
      await searchInput(page).fill("bình");
      await expect(results(page)).toHaveCount(1);
      await expect(results(page).first()).toContainText("Trần Thị Bình");
      await context.setOffline(false);
    });
  });

  test.describe("Tìm sâu", () => {
    test("Tìm trong ghi chú", async ({ page }) => {
      await insertNote(anNgheAn, { content: "Dị ứng Penicillin" });
      await openList(page);
      await searchInput(page).fill("penicillin");

      await expect(results(page)).toHaveCount(1);
      await expect(results(page).first()).toContainText("Nguyễn Văn An");
      await expect(results(page).first()).toContainText("Khớp trong ghi chú");
      expect(await page.content()).not.toContain("Dị ứng Penicillin");
    });

    test("Tìm trong tóm tắt", async ({ page }) => {
      await openList(page);
      await searchInput(page).fill("dai thao duong");

      await expect(results(page)).toHaveCount(1);
      await expect(results(page).first()).toContainText("Trần Thị Bình");
      await expect(results(page).first()).toContainText("Khớp trong tóm tắt");
      expect(await page.content()).not.toContain("đái tháo đường");
    });

    test("Tìm theo số điện thoại", async ({ page }) => {
      await openList(page);
      await searchInput(page).fill("0912345");

      await expect(results(page).first()).toContainText("Khớp số điện thoại");
      await expect(results(page)).toHaveCount(1);
      expect(await page.content()).not.toContain("0912 345 678");
    });

    test("Tìm theo mã bệnh nhân", async ({ page }) => {
      await openList(page);
      await searchInput(page).fill("bn-10234");

      await expect(results(page).first()).toContainText("Khớp mã bệnh nhân");
      await expect(results(page)).toHaveCount(1);
    });

    test("Gõ sai một chữ", async ({ page }) => {
      await openList(page);
      await searchInput(page).fill("nguyn van an");

      const suggestions = page.getByRole("region", { name: "Có phải bạn tìm…?" });
      await expect(suggestions).toBeVisible();
      await expect(suggestions.getByRole("listitem").first()).toContainText("Nguyễn Văn An");
    });

    test("Gõ sai số điện thoại không gợi ý ai", async ({ page }) => {
      await openList(page);
      await searchInput(page).fill("0912 345 679");

      await expect(page.getByText("Không thấy bệnh nhân nào khớp")).toBeVisible();
      await expect(page.getByText("Có phải bạn tìm…?")).toHaveCount(0);
    });

    test("Tìm ghi chú khi mất mạng", async ({ page, context }) => {
      await insertNote(anNgheAn, { content: "Dị ứng Penicillin" });
      await openList(page);
      await context.setOffline(true);
      await searchInput(page).fill("penicillin");

      await expect(page.getByText("Chưa tìm được trong ghi chú vì mất mạng.")).toBeVisible();
      await context.setOffline(false);
      await expect(results(page).first()).toContainText("Khớp trong ghi chú");
    });
  });

  test.describe("Không thấy bệnh nhân nào", () => {
    test("Thêm từ kết quả trống", async ({ page }) => {
      await openList(page);
      await searchInput(page).fill("Phạm Thu Hà");
      await expect(page.getByText(NONE)).toBeVisible();

      await page.getByRole("link", { name: "Thêm bệnh nhân" }).first().click();
      await expect(page).toHaveURL(/\/patients\/new$/);
      await expect(page.getByLabel("Họ tên")).toHaveValue("Phạm Thu Hà");
      // Read once: reopening the form does not prefill it again.
      await page.reload();
      await expect(page.getByLabel("Họ tên")).toHaveValue("");
    });
  });

  test.describe("Tìm bằng giọng nói", () => {
    test("Đọc tên để tìm", async ({ page }) => {
      await fakeSpeech(page, "hear");
      await openList(page);
      await page.getByRole("button", { name: "Tìm bằng giọng nói" }).click();

      await expect(searchInput(page)).toHaveValue("Trần Thị Bình");
      await expect(results(page)).toHaveCount(1);
      await expect(results(page).first()).toContainText("Trần Thị Bình");
      expect(
        await page.evaluate(() => (window as unknown as { __speechLang: string }).__speechLang),
      ).toBe("vi-VN");
    });

    test("Trình duyệt không hỗ trợ giọng nói", async ({ page }) => {
      await fakeSpeech(page, "none");
      await openList(page);
      await expect(page.getByRole("button", { name: "Tìm bằng giọng nói" })).toHaveCount(0);
    });

    test("Bị từ chối quyền micro", async ({ page }) => {
      await fakeSpeech(page, "deny");
      await openList(page);
      await page.getByRole("button", { name: "Tìm bằng giọng nói" }).click();

      await expect(
        page.getByText("Không dùng được micro. Hãy cho phép micro, hoặc gõ để tìm."),
      ).toBeVisible();
      await searchInput(page).fill("bình");
      await expect(results(page)).toHaveCount(1);
    });

    test("Lỗi micro không che dòng mất mạng", async ({ page, context }) => {
      await fakeSpeech(page, "deny");
      await openList(page);
      await page.getByRole("button", { name: "Tìm bằng giọng nói" }).click();
      await expect(page.getByText("Không dùng được micro.", { exact: false })).toBeVisible();

      await context.setOffline(true);
      await searchInput(page).fill("penicillin");
      await expect(page.getByText("Chưa tìm được trong ghi chú vì mất mạng.")).toBeVisible();
      await expect(page.getByText("Không dùng được micro.", { exact: false })).toHaveCount(0);
      await context.setOffline(false);
    });
  });

  test.describe("Riêng tư và tách theo bác sĩ", () => {
    test("Từ khoá không lên URL hay tiêu đề", async ({ page }) => {
      await insertNote(anNgheAn, { content: "Dị ứng Penicillin" });
      const urls: string[] = [];
      page.on("request", (request) => urls.push(request.url()));
      await openList(page);
      await searchInput(page).fill("penicillin");
      await expect(results(page).first()).toContainText("Khớp trong ghi chú");

      urls.push(page.url());
      for (const url of urls) expect(url.toLowerCase()).not.toContain("penicillin");
      expect((await page.title()).toLowerCase()).not.toContain("penicillin");
    });

    test("Không tìm thấy ghi chú của bác sĩ khác", async ({ page }) => {
      await insertNote(anNgheAn, { content: "Dị ứng Penicillin" });
      await insertPatient("minh", { fullName: "Lê Văn Tâm" });
      await loginAs(page, "minh", "/patients");
      await expect(results(page)).toHaveCount(1);

      await searchInput(page).fill("penicillin");
      await expect(page.getByText(NONE)).toBeVisible();
      await expect(page.getByText("Nguyễn Văn An")).toHaveCount(0);
    });
  });
});
