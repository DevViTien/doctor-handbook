import { describe, expect, it } from "vitest";

import { daysLeft } from "@/modules/patients/trash";

const now = new Date("2026-11-18T03:00:00Z");
const ago = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

describe("daysLeft", () => {
  it("is 30 right after the move", () => {
    expect(daysLeft(now, now)).toBe(30);
    expect(daysLeft(ago(0.2), now)).toBe(30);
  });

  it("Ngày cuối cùng: 1 day left after 29.5 days", () => {
    expect(daysLeft(ago(29.5), now)).toBe(1);
  });

  it("stays within [1, 30]: expiry is decided in SQL, clocks may differ", () => {
    expect(daysLeft(ago(31), now)).toBe(1);
    // The database clock a little ahead of the app server's.
    expect(daysLeft(new Date(now.getTime() + 5000), now)).toBe(30);
  });

  it("accepts ISO strings", () => {
    expect(daysLeft(ago(10).toISOString(), now)).toBe(20);
  });
});
