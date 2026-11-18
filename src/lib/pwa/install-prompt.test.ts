import { describe, expect, it } from "vitest";

import { isIos } from "@/lib/pwa/install-prompt";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1";
const IPAD_DESKTOP_MODE =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";

describe("isIos", () => {
  it("recognises iPhone and iPad (which reports a Mac with touch), whatever the browser", () => {
    expect(isIos(IPHONE_SAFARI, 5)).toBe(true);
    expect(isIos(IPHONE_CHROME, 5)).toBe(true);
    expect(isIos(IPAD_DESKTOP_MODE, 5)).toBe(true);
  });

  it("is not a real Mac or Android", () => {
    expect(isIos(IPAD_DESKTOP_MODE, 0)).toBe(false);
    expect(isIos(ANDROID_CHROME, 5)).toBe(false);
  });
});
