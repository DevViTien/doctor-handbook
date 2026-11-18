import { expect, type Page, test } from "@playwright/test";

import { loginAs } from "./fixtures/auth";
import {
  ACCOUNTS,
  closeDatabase,
  findAccountByUsername,
  hasDatabase,
  insertNote,
  insertPatient,
  listNoteRows,
  resetDatabase,
  SKIP_WITHOUT_DATABASE,
} from "./fixtures/db";

/** Scenarios of openspec spec patient-notes (change add-patient-notes). */

const notesSection = (page: Page) => page.getByRole("region", { name: "Ghi chú", exact: true });
const newNoteButton = (page: Page) => page.getByRole("button", { name: "Ghi chú mới" });
const newNoteInput = (page: Page) => page.getByLabel("Ghi chú mới", { exact: true });
const saveStatus = (page: Page, text: string) => page.getByRole("status").filter({ hasText: text });

async function openPatient(page: Page, patientId: string, account: "lan" | "minh" = "lan") {
  await loginAs(page, account, `/patients/${patientId}`);
  await expect(notesSection(page)).toBeVisible();
}

async function startNote(page: Page) {
  await newNoteButton(page).click();
  await expect(newNoteInput(page)).toBeFocused();
}

/**
 * Blocks (or lets through) every Server Action POST of the page: the network is "back" for page
 * loads, but saves still fail. Lets a test hold a draft on the device for as long as it needs.
 */
async function blockSaves(page: Page) {
  const state = { blocked: true };
  await page.route("**/*", (route) =>
    state.blocked && route.request().method() === "POST" && route.request().headers()["next-action"]
      ? route.abort("internetdisconnected")
      : route.continue(),
  );
  return state;
}

/** Writes a draft straight into the app's IndexedDB store (same layout as idb-keyval). */
async function putDraft(page: Page, key: string, value: Record<string, unknown>) {
  await page.evaluate(
    ([draftKey, draft]) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("doctor-handbook");
        open.onupgradeneeded = () => open.result.createObjectStore("note-drafts");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction("note-drafts", "readwrite");
          tx.objectStore("note-drafts").put(draft, draftKey);
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    [key, value] as const,
  );
}

async function draftKeys(page: Page): Promise<string[]> {
  return page.evaluate(
    () =>
      new Promise<string[]>((resolve, reject) => {
        const open = indexedDB.open("doctor-handbook");
        open.onupgradeneeded = () => open.result.createObjectStore("note-drafts");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const request = open.result
            .transaction("note-drafts", "readonly")
            .objectStore("note-drafts")
            .getAllKeys();
          request.onsuccess = () => {
            open.result.close();
            resolve(request.result.map(String));
          };
          request.onerror = () => reject(request.error);
        };
      }),
  );
}

async function accountId(key: "lan" | "minh"): Promise<string> {
  const account = await findAccountByUsername(ACCOUNTS[key].username);
  if (!account) throw new Error(`No account ${key}`);
  return account.id;
}

test.describe("patient-notes", () => {
  test.skip(!hasDatabase, SKIP_WITHOUT_DATABASE);
  test.beforeEach(resetDatabase);
  test.afterAll(closeDatabase);

  let patientId: string;
  test.beforeEach(async () => {
    patientId = await insertPatient("lan", { fullName: "Nguyễn Văn An", summary: "THA 5 năm" });
  });

  test.describe("Danh sách ghi chú của bệnh nhân", () => {
    test("Xem ghi chú mới nhất ở trên", async ({ page }) => {
      // 07:30 / 02:12 UTC = 14:30 / 09:12 in Vietnam.
      await insertNote(patientId, {
        content: "Tái khám, KQ XN bình thường",
        createdAt: "2026-10-02T07:30:00Z",
      });
      await insertNote(patientId, {
        content: "HA 150/90, tăng liều amlodipin",
        createdAt: "2026-11-15T02:12:00Z",
      });
      await openPatient(page, patientId);

      const items = notesSection(page).getByRole("listitem");
      await expect(items).toHaveCount(2);
      await expect(items.nth(0)).toContainText("15/11/2026 09:12");
      await expect(items.nth(0)).toContainText("HA 150/90, tăng liều amlodipin");
      await expect(items.nth(1)).toContainText("02/10/2026 14:30");
      await expect(items.nth(1)).toContainText("Tái khám, KQ XN bình thường");
      await expect(notesSection(page)).toContainText("2 ghi chú");
    });

    test("Chưa có ghi chú", async ({ page }) => {
      await openPatient(page, patientId);
      await expect(notesSection(page).getByText("Chưa có ghi chú")).toBeVisible();
    });

    test("Ghi chú không hiện ở danh sách bệnh nhân", async ({ page }) => {
      await insertNote(patientId, { content: "Dị ứng Penicillin" });
      await loginAs(page, "lan", "/patients");

      await expect(page.getByText("Nguyễn Văn An")).toBeVisible();
      expect(await page.content()).not.toContain("Dị ứng Penicillin");
    });
  });

  test.describe("Thêm và tự lưu ghi chú", () => {
    test("Ghi một ý", async ({ page }) => {
      await openPatient(page, patientId);
      await startNote(page);
      await newNoteInput(page).pressSequentially("HA 150/90, tăng liều amlodipin");

      await expect(saveStatus(page, "Đã lưu")).toBeVisible();
      const [row] = await listNoteRows(patientId);
      expect(row?.content).toBe("HA 150/90, tăng liều amlodipin");
      expect(row?.search_text).toBe("ha 150/90, tang lieu amlodipin");
      expect(Math.abs((row?.created_at.getTime() ?? 0) - Date.now())).toBeLessThan(60_000);
    });

    test("Ghi chú trống không được tạo", async ({ page }) => {
      await openPatient(page, patientId);
      await startNote(page);
      await newNoteInput(page).fill("   ");
      await page.waitForTimeout(1500);
      await page.getByRole("button", { name: "Xong" }).click();

      await expect(notesSection(page).getByText("Chưa có ghi chú")).toBeVisible();
      expect(await listNoteRows(patientId)).toHaveLength(0);
    });

    test("Tự lưu khi ngừng gõ", async ({ page }) => {
      await openPatient(page, patientId);
      await startNote(page);
      await newNoteInput(page).fill("HA 150/90");

      await expect(saveStatus(page, "Đã lưu")).toBeVisible();
      await page.reload();
      await expect(notesSection(page).getByText("HA 150/90")).toBeVisible();
    });

    test("Gõ tiếp không tạo ghi chú thứ hai", async ({ page }) => {
      await openPatient(page, patientId);
      await startNote(page);
      await newNoteInput(page).fill("HA 150/90");
      await expect(saveStatus(page, "Đã lưu")).toBeVisible();
      await newNoteInput(page).pressSequentially(", tăng liều amlodipin");
      await expect(saveStatus(page, "Đang lưu…")).toBeVisible();
      await expect(saveStatus(page, "Đã lưu")).toBeVisible();

      const rows = await listNoteRows(patientId);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.content).toBe("HA 150/90, tăng liều amlodipin");
    });
  });

  test.describe("Không mất ghi chú đang gõ", () => {
    test("Mất mạng khi đang ghi", async ({ page, context }) => {
      await openPatient(page, patientId);
      await startNote(page);
      await context.setOffline(true);
      await newNoteInput(page).fill("HA 150/90");

      await expect(saveStatus(page, "Đang chờ mạng")).toBeVisible();
      expect(await listNoteRows(patientId)).toHaveLength(0);
      await context.setOffline(false);
      await expect(saveStatus(page, "Đã lưu")).toBeVisible();
      expect((await listNoteRows(patientId))[0]?.content).toBe("HA 150/90");
    });

    test("Đóng ô soạn khi đang chờ mạng", async ({ page, context }) => {
      await openPatient(page, patientId);
      await startNote(page);
      await context.setOffline(true);
      await newNoteInput(page).fill("HA 150/90");
      await expect(saveStatus(page, "Đang chờ mạng")).toBeVisible();
      await page.getByRole("button", { name: "Xong" }).click();

      const item = notesSection(page).getByRole("listitem").first();
      await expect(item).toContainText("HA 150/90");
      await expect(item).toContainText("Đang chờ mạng");
      // Reopen it and close it again without typing: still waiting, still shown.
      await item.getByRole("button", { name: /Sửa ghi chú/ }).click();
      await expect(newNoteInput(page)).toHaveValue("HA 150/90");
      await page.getByRole("button", { name: "Xong" }).click();
      await expect(notesSection(page).getByRole("listitem").first()).toContainText("Đang chờ mạng");

      await context.setOffline(false);
      await expect(notesSection(page).getByText("Đang chờ mạng")).toHaveCount(0);
      expect((await listNoteRows(patientId))[0]?.content).toBe("HA 150/90");
    });

    test("Rời trang khi chưa gửi được", async ({ page, context }) => {
      await openPatient(page, patientId);
      await startNote(page);
      await context.setOffline(true);
      await newNoteInput(page).fill("HA 150/90");
      await expect(saveStatus(page, "Đang chờ mạng")).toBeVisible();

      // Back online on the list page: the background sync sends the note from there.
      await context.setOffline(false);
      await page.goto("/patients");
      await expect(page.getByText("Nguyễn Văn An")).toBeVisible();
      await expect.poll(async () => (await listNoteRows(patientId))[0]?.content).toBe("HA 150/90");
      await expect.poll(() => draftKeys(page)).toEqual([]);
    });

    test("Đóng trang khi chưa gửi được", async ({ page, context }) => {
      await openPatient(page, patientId);
      await startNote(page);
      await context.setOffline(true);
      await newNoteInput(page).fill("HA 150/90");
      await expect(saveStatus(page, "Đang chờ mạng")).toBeVisible();

      // Saves keep failing for now, so the restored draft stays visible.
      const saves = await blockSaves(page);
      await context.setOffline(false);
      await page.reload();

      await expect(page.getByText("Khôi phục ghi chú chưa gửi")).toBeVisible();
      await expect(newNoteInput(page)).toHaveValue("HA 150/90");
      saves.blocked = false;
      await page.evaluate(() => window.dispatchEvent(new Event("online")));
      await expect(saveStatus(page, "Đã lưu")).toBeVisible();
      expect((await listNoteRows(patientId))[0]?.content).toBe("HA 150/90");
    });

    test("Đổi tài khoản trên cùng trình duyệt", async ({ page }) => {
      const minhPatient = await insertPatient("minh", { fullName: "Trần Thị Bình" });
      const lanId = await accountId("lan");
      const noteId = "3b9d7c1e-2f4a-4b6c-8d0e-1f2a3b4c5d6e";
      await loginAs(page, "minh", "/patients");
      // A draft bs.lan left in this browser, for a patient bs.minh can open.
      await putDraft(page, `${lanId}/${noteId}`, {
        v: 1,
        accountId: lanId,
        patientId: minhPatient,
        noteId,
        editing: false,
        content: "Nháp của bs.lan",
        savedAt: Date.now(),
      });

      await page.goto(`/patients/${minhPatient}`);
      await expect(notesSection(page)).toBeVisible();
      await expect(page.getByText("Khôi phục ghi chú chưa gửi")).toHaveCount(0);
      await expect(page.getByText("Nháp của bs.lan")).toHaveCount(0);
      expect(await listNoteRows(minhPatient)).toHaveLength(0);
      expect(await draftKeys(page)).toEqual([`${lanId}/${noteId}`]);
    });
  });

  test.describe("Sửa và xoá ghi chú", () => {
    test("Sửa giữ ngày tạo", async ({ page }) => {
      await insertNote(patientId, { content: "HA 150/90", createdAt: "2026-11-15T02:12:00Z" });
      await openPatient(page, patientId);
      await page.getByRole("button", { name: "Sửa ghi chú lúc 15/11/2026 09:12" }).click();

      const input = page.getByLabel("15/11/2026 09:12", { exact: true });
      await expect(input).toHaveValue("HA 150/90");
      await input.fill("HA 140/90");
      await expect(saveStatus(page, "Đã lưu")).toBeVisible();
      await page.getByRole("button", { name: "Xong" }).click();

      const item = notesSection(page).getByRole("listitem").first();
      await expect(item).toContainText("15/11/2026 09:12");
      await expect(item).toContainText("HA 140/90");
      await expect(item).toContainText("Đã sửa");
      const [row] = await listNoteRows(patientId);
      expect(row?.created_at.toISOString()).toBe("2026-11-15T02:12:00.000Z");
      expect(row?.updated_at.getTime()).toBeGreaterThan(row?.created_at.getTime() ?? 0);
    });

    test("Ghi chú mới không hiện Đã sửa", async ({ page }) => {
      await openPatient(page, patientId);
      await startNote(page);
      await newNoteInput(page).fill("HA 150/90");
      await expect(saveStatus(page, "Đã lưu")).toBeVisible();
      await newNoteInput(page).pressSequentially(", hẹn 2 tuần");
      await expect(saveStatus(page, "Đã lưu")).toBeVisible();
      await page.getByRole("button", { name: "Xong" }).click();

      await expect(notesSection(page).getByText("HA 150/90, hẹn 2 tuần")).toBeVisible();
      await expect(notesSection(page).getByText("Đã sửa")).toHaveCount(0);
      const [row] = await listNoteRows(patientId);
      expect(row?.updated_at.getTime()).toBe(row?.created_at.getTime());
    });

    test("Xoá ghi chú", async ({ page }) => {
      await insertNote(patientId, {
        content: "Ghi nhầm bệnh nhân",
        createdAt: "2026-11-15T02:12:00Z",
      });
      await openPatient(page, patientId);
      await page.getByRole("button", { name: "Sửa ghi chú lúc 15/11/2026 09:12" }).click();
      await page.getByRole("button", { name: "Xoá ghi chú" }).click();

      const dialog = page.getByRole("alertdialog");
      await expect(dialog).toContainText("không khôi phục được");
      await dialog.getByRole("button", { name: "Xoá ghi chú" }).click();

      // While editing, the text is inside the composer: wait for the composer to go away.
      await expect(page.getByRole("alertdialog")).toHaveCount(0);
      await expect(notesSection(page).getByRole("textbox")).toHaveCount(0);
      await expect(notesSection(page)).not.toContainText("Ghi nhầm bệnh nhân");
      expect(await listNoteRows(patientId)).toHaveLength(0);
      await page.reload();
      await expect(notesSection(page).getByText("Chưa có ghi chú")).toBeVisible();
    });

    test("Đổi ý khi xoá", async ({ page }) => {
      await insertNote(patientId, { content: "Giữ lại", createdAt: "2026-11-15T02:12:00Z" });
      await openPatient(page, patientId);
      await page.getByRole("button", { name: "Sửa ghi chú lúc 15/11/2026 09:12" }).click();
      await page.getByRole("button", { name: "Xoá ghi chú" }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Không xoá" }).click();

      await expect(page.getByRole("alertdialog")).toHaveCount(0);
      expect(await listNoteRows(patientId)).toHaveLength(1);
    });
  });

  test.describe("Giới hạn và tách theo bác sĩ", () => {
    test("Ghi chú quá dài", async ({ page }) => {
      await openPatient(page, patientId);
      await startNote(page);
      await newNoteInput(page).fill("a".repeat(5001));

      await expect(page.getByText("Ghi chú tối đa 5000 ký tự.")).toBeVisible();
      await page.waitForTimeout(1500);
      expect(await listNoteRows(patientId)).toHaveLength(0);
      await expect(newNoteInput(page)).toHaveValue("a".repeat(5001));
    });

    test("Đóng ô soạn khi ghi chú bị từ chối", async ({ page }) => {
      await openPatient(page, patientId);
      await startNote(page);
      await newNoteInput(page).fill("a".repeat(5001));
      await expect(page.getByText("Ghi chú tối đa 5000 ký tự.")).toBeVisible();
      await page.getByRole("button", { name: "Xong" }).click();

      const item = notesSection(page).getByRole("listitem").first();
      await expect(item).toContainText("Chưa lưu được");
      await expect(item).not.toContainText("Đang chờ mạng");
      expect(await listNoteRows(patientId)).toHaveLength(0);
    });

    test("Ghi vào bệnh nhân của bác sĩ khác", async ({ page }) => {
      const minhId = await accountId("minh");
      const noteId = "4c0e8d2f-3a5b-4c7d-9e1f-2a3b4c5d6e7f";
      await loginAs(page, "minh", "/patients");
      // A tampered client: bs.minh's own draft, aimed at bs.lan's patient.
      await putDraft(page, `${minhId}/${noteId}`, {
        v: 1,
        accountId: minhId,
        patientId,
        noteId,
        editing: false,
        content: "Ghi lén",
        savedAt: Date.now(),
      });
      // The background sync sends it on the next page load; the server refuses it.
      const refused = page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          Boolean(response.request().headers()["next-action"]) &&
          (response.request().postData() ?? "").includes(noteId),
      );
      await page.reload();
      expect((await refused).ok()).toBe(true);
      expect(await listNoteRows(patientId)).toHaveLength(0);
      expect(await draftKeys(page)).toEqual([`${minhId}/${noteId}`]);
    });

    test("Ghi đè ghi chú của bác sĩ khác", async ({ page }) => {
      const lanNote = await insertNote(patientId, { content: "Ghi chú của bs.lan" });
      const minhPatient = await insertPatient("minh", { fullName: "Trần Thị Bình" });
      const minhId = await accountId("minh");
      await loginAs(page, "minh", "/patients");
      // bs.minh's draft reusing the id of bs.lan's note, on bs.minh's own patient.
      await putDraft(page, `${minhId}/${lanNote}`, {
        v: 1,
        accountId: minhId,
        patientId: minhPatient,
        noteId: lanNote,
        editing: true,
        content: "Đã bị ghi đè",
        savedAt: Date.now(),
      });
      await page.goto(`/patients/${minhPatient}`);

      await expect(page.getByText("Khôi phục ghi chú chưa gửi")).toBeVisible();
      await expect(
        page.getByText("Không lưu được: bệnh nhân hoặc ghi chú không còn trong sổ."),
      ).toBeVisible();
      const [lanRow] = await listNoteRows(patientId);
      expect(lanRow?.content).toBe("Ghi chú của bs.lan");
      expect(await listNoteRows(minhPatient)).toHaveLength(0);
    });
  });

  test.describe("Ô soạn ghi chú dùng tốt trên điện thoại", () => {
    test("Thuộc tính ô soạn", async ({ page }) => {
      await openPatient(page, patientId);
      await startNote(page);

      await expect(newNoteInput(page)).toHaveAttribute("autocomplete", "off");
      const fontSize = await newNoteInput(page).evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).fontSize),
      );
      expect(fontSize).toBeGreaterThanOrEqual(16);
      await expect(saveStatus(page, "Tự lưu khi bạn ngừng gõ")).toBeVisible();
      await expect(page.getByRole("button", { name: "Ghi chú mới" })).toHaveCount(0);
    });

    test("Ghi chú không lên URL hay tiêu đề", async ({ page }) => {
      const urls: string[] = [];
      page.on("request", (request) => urls.push(request.url()));
      await openPatient(page, patientId);
      await startNote(page);
      await newNoteInput(page).fill("HA 150/90");
      await expect(saveStatus(page, "Đã lưu")).toBeVisible();

      urls.push(page.url());
      for (const url of urls) {
        expect(url).not.toContain("HA 150");
        expect(url).not.toContain(encodeURIComponent("HA 150/90"));
      }
      expect(await page.title()).not.toContain("HA 150/90");
    });
  });
});
