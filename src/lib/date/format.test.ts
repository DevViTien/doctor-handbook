import { describe, expect, it } from "vitest";

import { formatDate, formatDateTime } from "@/lib/date/format";

describe("formatDate", () => {
  it("renders in Vietnam time, not UTC", () => {
    // 18:30 UTC on the 17th is already the 18th in Asia/Ho_Chi_Minh (UTC+7).
    expect(formatDate("2026-11-17T18:30:00Z")).toBe("18/11/2026");
  });
});

describe("formatDateTime", () => {
  it("uses a 24-hour clock in Vietnam time", () => {
    const formatted = formatDateTime("2026-11-17T18:30:00Z");
    expect(formatted).toContain("18/11/2026");
    expect(formatted).toContain("01:30");
  });
});
