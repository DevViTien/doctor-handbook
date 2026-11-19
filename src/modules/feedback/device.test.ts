import { describe, expect, it } from "vitest";

import { describeDevice } from "@/modules/feedback/device";

const UA = {
  iphoneSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  iphoneChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1",
  androidChrome:
    "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
  samsung:
    "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36",
  windowsEdge:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
  macSafari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
  windowsFirefox:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
};

describe("describeDevice", () => {
  it.each([
    ["iphoneSafari", "iPhone · Safari"],
    ["iphoneChrome", "iPhone · Chrome"],
    ["androidChrome", "Android · Chrome"],
    ["samsung", "Android · Samsung Internet"],
    ["windowsEdge", "Windows · Edge"],
    ["macSafari", "Mac · Safari"],
    ["windowsFirefox", "Windows · Firefox"],
  ] as const)("labels %s as %s", (key, label) => {
    expect(describeDevice(UA[key])).toBe(label);
  });

  it("falls back when the header is missing or unknown", () => {
    expect(describeDevice(null)).toBe("Máy khác · Trình duyệt khác");
    expect(describeDevice("")).toBe("Máy khác · Trình duyệt khác");
    expect(describeDevice("curl/8.5.0")).toBe("Máy khác · Trình duyệt khác");
  });
});
