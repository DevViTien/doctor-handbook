import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

import { describe, expect, it } from "vitest";

/**
 * The cache allow-list of public/sw.js (spec app-install "Trình duyệt không giữ dữ liệu bệnh
 * nhân"), tested on the real file: it runs in a sandbox with a stub `self`.
 */
const context: Record<string, unknown> = {
  self: { addEventListener: () => undefined, location: { origin: "https://sotay.example" } },
  URL,
};
runInNewContext(readFileSync("public/sw.js", "utf8"), context);
const isCacheableStatic = context.isCacheableStatic as (url: string, origin: string) => boolean;
const origin = "https://sotay.example";

describe("service worker cache rules", () => {
  it.each([
    "/_next/static/chunks/app-123.js",
    "/_next/static/media/be-vietnam-pro.woff2",
    "/icons/icon-192.png",
    "/icon.svg",
    "/offline.html",
  ])("caches the static file %s", (path) => {
    expect(isCacheableStatic(`${origin}${path}`, origin)).toBe(true);
  });

  it.each([
    "/patients",
    "/patients/0b7f8f0e-6a3c-4a8e-9f5c-2d1e0c9b8a76",
    "/settings/backup",
    "/api/backup",
    "/api/patients/search",
    "/api/patients/0b7f8f0e-6a3c-4a8e-9f5c-2d1e0c9b8a76/avatar?v=abc",
    "/todos",
    "/manifest.webmanifest",
    "/_next/image?url=x",
  ])("never caches %s (pages and data)", (path) => {
    expect(isCacheableStatic(`${origin}${path}`, origin)).toBe(false);
  });

  it("never caches another origin (signed Storage URLs)", () => {
    expect(
      isCacheableStatic("https://ref.supabase.co/storage/v1/object/sign/avatars/a.webp", origin),
    ).toBe(false);
    expect(isCacheableStatic(`https://evil.example/_next/static/x.js`, origin)).toBe(false);
  });

  it("refuses what is not a URL", () => {
    expect(isCacheableStatic("not a url", origin)).toBe(false);
  });
});
