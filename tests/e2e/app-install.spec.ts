import { expect, type Page, test } from "@playwright/test";

import { loginAs } from "./fixtures/auth";
import {
  closeDatabase,
  hasDatabase,
  insertPatient,
  resetDatabase,
  SKIP_WITHOUT_DATABASE,
} from "./fixtures/db";
import { imageSize } from "./fixtures/storage";

/** Scenarios of openspec spec app-install (change add-pwa-install). */

type Manifest = {
  display: string;
  start_url: string;
  icons: { src: string; sizes: string; type: string; purpose?: string }[];
  shortcuts: { name: string; url: string }[];
};

const installRow = (page: Page) =>
  page.getByRole("region", { name: "Cài ứng dụng lên màn hình chính" });

test.describe("app-install", () => {
  test.describe("Manifest và icon (chưa đăng nhập)", () => {
    test("Manifest đủ để cài", async ({ request }) => {
      const response = await request.get("/manifest.webmanifest");
      expect(response.ok()).toBe(true);
      const manifest = (await response.json()) as Manifest;
      expect(manifest).toMatchObject({ display: "standalone", start_url: "/patients" });

      for (const [size, purpose] of [
        [192, "any"],
        [512, "any"],
        [512, "maskable"],
      ] as const) {
        const entry = manifest.icons.find(
          (icon) => icon.sizes === `${size}x${size}` && icon.purpose === purpose,
        );
        expect(entry, `${size} ${purpose}`).toBeDefined();
        const png = await request.get(entry!.src);
        expect(png.ok()).toBe(true);
        expect(png.headers()["content-type"]).toContain("image/png");
        expect(imageSize(Buffer.from(await png.body()))).toMatchObject({
          width: size,
          height: size,
        });
      }
    });

    test("Icon iPhone", async ({ request }) => {
      const png = await request.get("/apple-icon.png");
      expect(png.ok()).toBe(true);
      // Opaque RGB: iOS would blacken transparent corners.
      expect(imageSize(Buffer.from(await png.body()))).toEqual({
        format: "png",
        width: 180,
        height: 180,
      });
    });

    test("Lối tắt trong manifest", async ({ request }) => {
      const manifest = (await (await request.get("/manifest.webmanifest")).json()) as Manifest;
      expect(manifest.shortcuts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "Thêm bệnh nhân", url: "/patients/new" }),
          expect.objectContaining({ name: "Việc cần làm", url: "/todos" }),
        ]),
      );
    });

    test("Tệp của service worker và trang mất mạng tải được khi chưa đăng nhập", async ({
      request,
    }) => {
      for (const path of ["/sw.js", "/offline.html", "/icon.svg"]) {
        const response = await request.get(path, { maxRedirects: 0 });
        expect(response.status(), path).toBe(200);
      }
      expect((await request.get("/sw.js")).headers()["cache-control"]).toContain("no-cache");
    });
  });

  test.describe("Cài từ Cài đặt", () => {
    test.skip(!hasDatabase, SKIP_WITHOUT_DATABASE);
    test.beforeEach(resetDatabase);
    test.afterAll(closeDatabase);

    test("Trình duyệt cho cài", async ({ page }) => {
      await loginAs(page, "lan", "/settings");
      await expect(installRow(page)).toBeVisible();
      // Stand-in for Chrome's own event (it never fires in a test browser).
      await page.evaluate(() => {
        const event = new Event("beforeinstallprompt", { cancelable: true });
        Object.assign(event, {
          prompt: async () => {
            (window as unknown as { prompted: boolean }).prompted = true;
          },
          userChoice: Promise.resolve({ outcome: "accepted" }),
        });
        window.dispatchEvent(event);
      });

      await installRow(page).getByRole("button", { name: "Cài ứng dụng" }).click();
      await expect(installRow(page)).toContainText("Đã cài trên máy này");
      await expect(installRow(page).getByRole("button")).toHaveCount(0);
      expect(
        await page.evaluate(() => (window as unknown as { prompted?: boolean }).prompted),
      ).toBe(true);
    });

    test("Bác sĩ chưa muốn cài", async ({ page }) => {
      await loginAs(page, "lan", "/settings");
      await expect(installRow(page)).toBeVisible();
      await page.evaluate(() => {
        const event = new Event("beforeinstallprompt", { cancelable: true });
        Object.assign(event, {
          prompt: async () => undefined,
          userChoice: Promise.resolve({ outcome: "dismissed" }),
        });
        window.dispatchEvent(event);
      });

      await installRow(page).getByRole("button", { name: "Cài ứng dụng" }).click();
      await expect(installRow(page)).toContainText("Chưa cài. Tải lại trang để cài lại.");
      await expect(installRow(page).getByRole("button")).toHaveCount(0);
    });

    test("Đang dùng app đã cài", async ({ page }) => {
      await page.addInitScript(() => {
        const original = window.matchMedia.bind(window);
        window.matchMedia = (query: string) => {
          const real = original(query);
          if (query !== "(display-mode: standalone)") return real;
          // Opened from the home-screen icon: what a standalone launch reports.
          return {
            matches: true,
            media: query,
            onchange: null,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
            addListener: () => undefined,
            removeListener: () => undefined,
            dispatchEvent: () => false,
          } as MediaQueryList;
        };
      });
      await loginAs(page, "lan", "/settings");
      await expect(installRow(page)).toContainText("Bạn đang dùng ứng dụng đã cài");
      await expect(installRow(page).getByRole("button")).toHaveCount(0);
    });

    test.describe("Trình duyệt máy tính chưa hỗ trợ", () => {
      test.use({
        userAgent: "Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0",
      });

      test("Trình duyệt chưa hỗ trợ cài", async ({ page }) => {
        await loginAs(page, "lan", "/settings");
        await expect(installRow(page)).toContainText("Trình duyệt này chưa cho cài trực tiếp");
        await expect(installRow(page)).toContainText("Chrome (Android) hoặc Safari (iPhone)");
        await expect(installRow(page).getByRole("button")).toHaveCount(0);
      });
    });

    test.describe("Safari trên iPhone", () => {
      test.use({
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      });

      test("iPhone", async ({ page }) => {
        await loginAs(page, "lan", "/settings");
        await expect(installRow(page)).toContainText("Bấm nút Chia sẻ");
        await expect(installRow(page)).toContainText("Thêm vào MH chính");
        await expect(installRow(page).getByRole("button", { name: "Cài ứng dụng" })).toHaveCount(0);
      });
    });
  });

  test.describe("Service worker", () => {
    test.skip(!hasDatabase, SKIP_WITHOUT_DATABASE);
    test.beforeEach(resetDatabase);
    test.afterAll(closeDatabase);

    async function withServiceWorker(page: Page) {
      await page.evaluate(async () => {
        await navigator.serviceWorker.ready;
      });
      // Reload once so the worker controls the page (and sees its static files).
      await page.reload();
      await expect
        .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
        .toBe(true);
    }

    test("Bộ nhớ đệm chỉ có tệp tĩnh", async ({ page }) => {
      const an = await insertPatient("lan", {
        fullName: "Nguyễn Văn An",
        summary: "Dị ứng Penicillin",
      });
      await loginAs(page, "lan", "/patients");
      await withServiceWorker(page);
      await page.goto(`/patients/${an}`);
      await expect(page.getByText("Dị ứng Penicillin")).toBeVisible();
      await page.goto("/settings");
      await expect(installRow(page)).toBeVisible();

      const cached = await page.evaluate(async () => {
        const entries: { url: string; text: string }[] = [];
        for (const name of await caches.keys()) {
          const cache = await caches.open(name);
          for (const request of await cache.keys()) {
            const response = await cache.match(request);
            const type = response?.headers.get("content-type") ?? "";
            const text = /text|javascript|json|html|css|svg/.test(type)
              ? ((await response?.text()) ?? "")
              : "";
            entries.push({ url: new URL(request.url).pathname, text });
          }
        }
        return entries;
      });

      expect(cached.length).toBeGreaterThan(0);
      for (const entry of cached) {
        expect(entry.url).toMatch(/^\/(_next\/static\/|icons\/|icon\.svg$|offline\.html$)/);
        expect(entry.text).not.toContain("Nguyễn Văn An");
        expect(entry.text).not.toContain("Penicillin");
      }
    });

    test("Chrome không báo lỗi cài", async ({ page, browserName }) => {
      test.skip(browserName !== "chromium", "installability is a Chromium check");
      await loginAs(page, "lan", "/patients");
      await withServiceWorker(page);
      const cdp = await page.context().newCDPSession(page);
      const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors");
      expect(installabilityErrors).toEqual([]);
    });

    test("Mở app lúc mất mạng", async ({ page, context }) => {
      await loginAs(page, "lan", "/patients");
      await withServiceWorker(page);

      await context.setOffline(true);
      await page.goto("/patients").catch(() => undefined);
      await expect(page.getByRole("heading", { name: "Đang mất mạng" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Thử lại" })).toBeVisible();
      await context.setOffline(false);
    });
  });
});
