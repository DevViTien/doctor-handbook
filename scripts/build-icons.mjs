// Renders the app icons (change add-pwa-install) from src/assets/app-icon.svg with Playwright's
// Chromium. Run `pnpm icons` after changing the artwork; the PNGs are committed, so builds never
// need a browser.
import { readFile } from "node:fs/promises";

import { chromium } from "@playwright/test";

const svg = (await readFile("src/assets/app-icon.svg", "utf8")).replace(
  "<svg ",
  '<svg width="100%" height="100%" ',
);

const outputs = [
  // "any": rounded square with transparent corners (Android shows it as is).
  { path: "public/icons/icon-192.png", size: 192, rounded: true },
  { path: "public/icons/icon-512.png", size: 512, rounded: true },
  // "maskable": full bleed; the launcher crops it to its own shape.
  { path: "public/icons/maskable-512.png", size: 512, rounded: false },
  // iOS: full bleed and opaque (it rounds the corners itself, and blackens transparency).
  { path: "src/app/apple-icon.png", size: 180, rounded: false },
];

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const { path, size, rounded } of outputs) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">
      <div style="width:${size}px;height:${size}px;overflow:hidden;border-radius:${rounded ? "22%" : "0"}">${svg}</div>
    </body></html>`,
  );
  await page.screenshot({
    path,
    omitBackground: rounded,
    clip: { x: 0, y: 0, width: size, height: size },
  });
  process.stdout.write(`${path} (${size}×${size})\n`);
}
await browser.close();
