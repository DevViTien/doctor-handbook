import { describe, expect, it } from "vitest";

import { calendarDaysBetween, vietnamIsoDay } from "@/lib/date/calendar";

describe("vietnamIsoDay", () => {
  it("uses the Vietnam calendar day, not UTC", () => {
    expect(vietnamIsoDay("2026-11-18T17:30:00Z")).toBe("2026-11-19");
    expect(vietnamIsoDay("2026-11-18T16:59:00Z")).toBe("2026-11-18");
  });
});

describe("calendarDaysBetween", () => {
  it("counts calendar days in Vietnam time", () => {
    expect(calendarDaysBetween("2026-11-19T01:00:00Z", "2026-11-19T15:00:00Z")).toBe(0);
    // 23:50 then 00:10 in Vietnam: twenty minutes apart, but "yesterday".
    expect(calendarDaysBetween("2026-11-18T16:50:00Z", "2026-11-18T17:10:00Z")).toBe(1);
    expect(calendarDaysBetween("2026-11-07T03:00:00Z", "2026-11-19T03:00:00Z")).toBe(12);
  });
});
