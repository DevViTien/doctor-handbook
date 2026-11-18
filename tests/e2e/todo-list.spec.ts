import { expect, type Page, type Route, test } from "@playwright/test";

import { loginAs } from "./fixtures/auth";
import { vietnamDay } from "./fixtures/backup";
import {
  closeDatabase,
  hasDatabase,
  insertTodo,
  listTodoRows,
  resetDatabase,
  SKIP_WITHOUT_DATABASE,
} from "./fixtures/db";

/** Scenarios of openspec spec todo-list (change add-todo-list). */

const openRows = (page: Page) =>
  page.getByRole("list", { name: "Việc chưa xong" }).getByRole("listitem");
const doneRows = (page: Page) =>
  page.getByRole("list", { name: "Việc đã xong" }).getByRole("listitem");
const addField = (page: Page) => page.getByRole("textbox", { name: "Thêm việc" });
const doneSummary = (page: Page) => page.locator("summary").filter({ hasText: /Đã xong/ });
const contents = async (key: "lan" | "minh") => (await listTodoRows(key)).map((r) => r.content);
const tomorrow = () => vietnamDay(new Date(Date.now() + 86_400_000)).iso;

test.describe("todo-list", () => {
  test.skip(!hasDatabase, SKIP_WITHOUT_DATABASE);
  test.beforeEach(resetDatabase);
  test.afterAll(closeDatabase);

  test.describe("Trang việc cần làm", () => {
    test("Chưa có việc nào", async ({ page }) => {
      await loginAs(page, "lan", "/todos");
      await expect(page.getByText("Chưa có việc nào")).toBeVisible();
      await expect(addField(page)).toBeVisible();
      await expect(page).toHaveTitle(/Việc cần làm/);
    });

    test("Việc đã xong thu gọn ở cuối", async ({ page }) => {
      await insertTodo("lan", { content: "Gọi chị Bình" });
      await insertTodo("lan", { content: "Nộp báo cáo" });
      await insertTodo("lan", { content: "Trả sách thư viện", doneMinutesAgo: 10 });
      await loginAs(page, "lan", "/todos");

      await expect(openRows(page)).toHaveCount(2);
      await expect(doneSummary(page)).toHaveText("Đã xong (1)");
      await expect(page.getByText("Trả sách thư viện")).toBeHidden();
      await doneSummary(page).click();
      await expect(page.getByText("Trả sách thư viện")).toBeVisible();
    });
  });

  test.describe("Thêm việc nhanh", () => {
    test("Thêm việc bằng Enter", async ({ page }) => {
      await loginAs(page, "lan", "/todos");
      await addField(page).fill("Gọi chị Bình báo kết quả XN");
      await addField(page).press("Enter");

      await expect(openRows(page).first()).toContainText("Gọi chị Bình báo kết quả XN");
      await expect(addField(page)).toHaveValue("");
      await expect(addField(page)).toBeFocused();
      await expect.poll(() => contents("lan")).toEqual(["Gọi chị Bình báo kết quả XN"]);

      await page.reload();
      await expect(openRows(page).first()).toContainText("Gọi chị Bình báo kết quả XN");
    });

    test("Thêm việc có ngày hạn", async ({ page }) => {
      await loginAs(page, "lan", "/todos");
      await addField(page).fill("Nộp báo cáo tháng");
      await page.getByLabel("Ngày hạn của việc mới").fill(tomorrow());
      await expect(page.getByText("Hạn: Ngày mai")).toBeVisible();
      await addField(page).press("Enter");

      await expect(openRows(page).first()).toContainText("Nộp báo cáo tháng");
      await expect(openRows(page).first()).toContainText("Ngày mai");
      await expect.poll(async () => (await listTodoRows("lan"))[0]?.due_date).toBe(tomorrow());
    });

    test("Mất mạng khi thêm việc", async ({ page }) => {
      await loginAs(page, "lan", "/todos");
      await page.route("**/todos", (route) =>
        route.request().method() === "POST"
          ? route.abort("internetdisconnected")
          : route.continue(),
      );
      await addField(page).fill("Hỏi khoa Dược");
      await addField(page).press("Enter");

      await expect(page.getByRole("main").getByRole("alert")).toContainText(
        "Chưa thêm được vì mất mạng",
      );
      await expect(addField(page)).toHaveValue("Hỏi khoa Dược");
      expect(await contents("lan")).toEqual([]);

      // Back online: Enter again adds it once.
      await page.unroute("**/todos");
      await addField(page).press("Enter");
      await expect(openRows(page)).toHaveCount(1);
      await expect.poll(() => contents("lan")).toEqual(["Hỏi khoa Dược"]);
    });

    test("Hai việc thêm liên tiếp lúc mất mạng đều không mất", async ({ page }) => {
      await loginAs(page, "lan", "/todos");
      await page.route("**/todos", async (route) => {
        if (route.request().method() !== "POST") return route.continue();
        await new Promise((resolve) => setTimeout(resolve, 800));
        await route.abort("internetdisconnected");
      });
      await addField(page).fill("Việc A");
      await addField(page).press("Enter");
      await addField(page).fill("Việc B");
      await addField(page).press("Enter");

      // A comes back into the empty field; B, which failed after, is listed with "Thử lại".
      await expect(addField(page)).toHaveValue("Việc A");
      const failed = page.getByRole("list", { name: "Việc chưa thêm được" }).getByRole("listitem");
      await expect(failed).toHaveCount(1);
      await expect(failed.first()).toContainText("Việc B");

      await page.unroute("**/todos");
      await addField(page).press("Enter");
      await failed.first().getByRole("button", { name: "Thử lại" }).click();
      await expect(openRows(page)).toHaveCount(2);
      await expect.poll(async () => (await contents("lan")).sort()).toEqual(["Việc A", "Việc B"]);
    });

    test("Gửi lại không tạo việc trùng", async ({ page }) => {
      await loginAs(page, "lan", "/todos");
      // The first answer is lost after the server saved: the browser sees a network error.
      let first = true;
      await page.route("**/todos", async (route: Route) => {
        if (route.request().method() !== "POST" || !first) return route.continue();
        first = false;
        await route.fetch();
        await route.abort("internetdisconnected");
      });
      await addField(page).fill("Hỏi khoa Dược");
      await addField(page).press("Enter");
      await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
      await addField(page).press("Enter");

      await expect(openRows(page)).toHaveCount(1);
      await expect.poll(() => contents("lan")).toEqual(["Hỏi khoa Dược"]);
    });
  });

  test.describe("Ngày hạn và thứ tự", () => {
    test("Việc quá hạn", async ({ page }) => {
      await insertTodo("lan", { content: "Nộp báo cáo", minutesAgo: 5 });
      await insertTodo("lan", { content: "Gọi chị Bình", dueInDays: -1, minutesAgo: 60 });
      await loginAs(page, "lan", "/todos");

      await expect(openRows(page).first()).toContainText("Gọi chị Bình");
      await expect(openRows(page).first()).toContainText("Quá hạn");
    });

    test("Thứ tự việc chưa xong", async ({ page }) => {
      await insertTodo("lan", { content: "Việc A", dueInDays: 5 });
      await insertTodo("lan", { content: "Việc B", dueInDays: 1 });
      await insertTodo("lan", { content: "Việc C", minutesAgo: 24 * 60 });
      await insertTodo("lan", { content: "Việc D", minutesAgo: 10 });
      await loginAs(page, "lan", "/todos");

      await expect(openRows(page)).toHaveText([/Việc B/, /Việc A/, /Việc D/, /Việc C/]);
    });
  });

  test.describe("Đánh dấu xong và mở lại", () => {
    test("Đánh dấu xong", async ({ page }) => {
      await insertTodo("lan", { content: "Gọi chị Bình" });
      await loginAs(page, "lan", "/todos");
      await page.getByRole("button", { name: "Đánh dấu xong: Gọi chị Bình" }).click();

      await expect(openRows(page)).toHaveCount(0);
      await expect(doneSummary(page)).toHaveText("Đã xong (1)");
      await expect.poll(async () => (await listTodoRows("lan"))[0]?.completed_at).not.toBeNull();
      await page.reload();
      await expect(doneSummary(page)).toHaveText("Đã xong (1)");
    });

    test("Mở lại việc", async ({ page }) => {
      await insertTodo("lan", { content: "Gọi chị Bình", doneMinutesAgo: 5 });
      await loginAs(page, "lan", "/todos");
      await doneSummary(page).click();
      await page.getByRole("button", { name: "Mở lại việc: Gọi chị Bình" }).click();

      await expect(openRows(page)).toHaveCount(1);
      await expect(openRows(page).first()).toContainText("Gọi chị Bình");
      await expect.poll(async () => (await listTodoRows("lan"))[0]?.completed_at).toBeNull();
    });
  });

  test.describe("Sửa việc", () => {
    test("Sửa nội dung và ngày hạn", async ({ page }) => {
      await insertTodo("lan", { content: "Nộp báo cáo", dueInDays: 3 });
      await loginAs(page, "lan", "/todos");
      await openRows(page)
        .first()
        .getByRole("button", { name: /Nộp báo cáo/ })
        .last()
        .click();

      const sheet = page.getByRole("dialog", { name: "Sửa việc" });
      await sheet.getByLabel("Nội dung").fill("Nộp báo cáo quý");
      await sheet.getByRole("button", { name: "Bỏ ngày hạn" }).click();
      await sheet.getByRole("button", { name: "Lưu" }).click();

      await expect(sheet).toHaveCount(0);
      await expect(openRows(page).first()).toHaveText("Nộp báo cáo quý");
      await page.reload();
      await expect(openRows(page).first()).toHaveText("Nộp báo cáo quý");
      expect((await listTodoRows("lan"))[0]?.due_date).toBeNull();
    });
  });

  test.describe("Xoá việc có hoàn tác", () => {
    test("Xoá rồi hoàn tác", async ({ page }) => {
      await insertTodo("lan", { content: "Hỏi khoa Dược", dueInDays: 2 });
      await loginAs(page, "lan", "/todos");
      await openRows(page)
        .first()
        .getByRole("button", { name: /Hỏi khoa Dược/ })
        .last()
        .click();
      await page.getByRole("dialog").getByRole("button", { name: "Xoá việc" }).click();

      const toast = page.locator("[data-sonner-toast]").filter({ hasText: "Đã xoá việc." });
      await expect(toast).toBeVisible();
      await expect(toast).not.toContainText("Hỏi khoa Dược");
      await expect.poll(() => contents("lan")).toEqual([]);

      await toast.getByRole("button", { name: "Hoàn tác" }).click();
      await expect(openRows(page).first()).toContainText("Hỏi khoa Dược");
      await expect.poll(() => contents("lan")).toEqual(["Hỏi khoa Dược"]);
      const [row] = await listTodoRows("lan");
      expect(row?.due_date).toBe(vietnamDay(new Date(Date.now() + 2 * 86_400_000)).iso);
    });
  });

  test.describe("Hoàn tác giữ trạng thái xong", () => {
    test("Xoá một việc đã xong rồi hoàn tác", async ({ page }) => {
      await insertTodo("lan", { content: "Trả sách", doneMinutesAgo: 30 });
      await loginAs(page, "lan", "/todos");
      await doneSummary(page).click();
      await doneRows(page).first().getByRole("button").last().click();
      await page.getByRole("dialog").getByRole("button", { name: "Xoá việc" }).click();
      const toast = page.locator("[data-sonner-toast]").filter({ hasText: "Đã xoá việc." });
      await toast.getByRole("button", { name: "Hoàn tác" }).click();

      await expect(doneSummary(page)).toHaveText("Đã xong (1)");
      await expect.poll(async () => (await listTodoRows("lan"))[0]?.completed_at).not.toBeNull();
    });
  });

  test.describe("Xoá các việc đã xong", () => {
    test("Xoá các việc đã xong", async ({ page }) => {
      await insertTodo("lan", { content: "Việc còn lại" });
      await insertTodo("lan", { content: "Xong 1", doneMinutesAgo: 5 });
      await insertTodo("lan", { content: "Xong 2", doneMinutesAgo: 3 });
      await loginAs(page, "lan", "/todos");
      await doneSummary(page).click();
      await page.getByRole("button", { name: "Xoá các việc đã xong" }).click();

      const dialog = page.getByRole("alertdialog");
      await expect(dialog).toContainText("Xoá 2 việc đã xong?");
      await dialog.getByRole("button", { name: "Xoá", exact: true }).click();

      await expect(doneSummary(page)).toHaveCount(0);
      await expect(openRows(page)).toHaveCount(1);
      expect(await contents("lan")).toEqual(["Việc còn lại"]);
    });

    test("Đổi ý khi xoá việc đã xong", async ({ page }) => {
      await insertTodo("lan", { content: "Xong 1", doneMinutesAgo: 5 });
      await loginAs(page, "lan", "/todos");
      await doneSummary(page).click();
      await page.getByRole("button", { name: "Xoá các việc đã xong" }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Không xoá" }).click();

      await expect(page.getByRole("alertdialog")).toHaveCount(0);
      await expect(doneRows(page)).toHaveCount(1);
      expect(await contents("lan")).toEqual(["Xong 1"]);
    });
  });

  test.describe("Việc cần làm tách theo bác sĩ", () => {
    test("Việc của bác sĩ khác", async ({ page }) => {
      await insertTodo("minh", { content: "Họp khoa" });
      await loginAs(page, "lan", "/todos");
      await expect(page.getByText("Chưa có việc nào")).toBeVisible();
      await expect(page.getByText("Họp khoa")).toHaveCount(0);
    });

    test("Sửa hoặc xoá việc của bác sĩ khác", async ({ page }) => {
      const minhTodo = await insertTodo("minh", { content: "Họp khoa" });
      const lan1 = await insertTodo("lan", { content: "Việc Lan 1", minutesAgo: 30 });
      const lan2 = await insertTodo("lan", { content: "Việc Lan 2", minutesAgo: 20 });
      const lan3 = await insertTodo("lan", { content: "Việc Lan 3", minutesAgo: 10 });
      await loginAs(page, "lan", "/todos");
      // A tampered client: bs.lan's own buttons, posting bs.minh's to-do id instead.
      await page.route("**/todos", async (route) => {
        const body = route.request().postData();
        if (route.request().method() !== "POST" || !body) return route.continue();
        let tampered = body;
        for (const id of [lan1, lan2, lan3]) tampered = tampered.replaceAll(id, minhTodo);
        if (body.includes("Việc giả")) {
          tampered = tampered.replace(/"id":"[0-9a-f-]{36}"/, `"id":"${minhTodo}"`);
        }
        await route.continue({ postData: tampered });
      });
      const notFound = page
        .locator("[data-sonner-toast]")
        .filter({ hasText: "Không tìm thấy việc này." });

      // Mark done.
      await page.getByRole("button", { name: "Đánh dấu xong: Việc Lan 1" }).click();
      await expect(notFound.first()).toBeVisible();
      // Edit.
      await openRows(page).filter({ hasText: "Việc Lan 2" }).getByRole("button").last().click();
      await page.getByRole("dialog").getByLabel("Nội dung").fill("Đã bị sửa");
      await page.getByRole("dialog").getByRole("button", { name: "Lưu" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      // Delete.
      await openRows(page).filter({ hasText: "Việc Lan 3" }).getByRole("button").last().click();
      await page.getByRole("dialog").getByRole("button", { name: "Xoá việc" }).click();
      // Add, with bs.minh's id: must neither overwrite nor read it.
      await addField(page).fill("Việc giả");
      await addField(page).press("Enter");
      await expect(page.getByRole("main").getByRole("alert")).toContainText(
        "Không tìm thấy việc này.",
      );

      expect(await listTodoRows("minh")).toEqual([
        expect.objectContaining({ content: "Họp khoa", due_date: null, completed_at: null }),
      ]);
      expect(await contents("lan")).toEqual(["Việc Lan 1", "Việc Lan 2", "Việc Lan 3"]);
    });
  });
});
