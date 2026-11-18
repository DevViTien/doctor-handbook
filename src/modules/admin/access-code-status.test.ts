import { describe, expect, it } from "vitest";

import { getAccessCodeStatus } from "@/modules/admin/access-code-status";

const HOUR = 60 * 60 * 1000;
const createdAt = new Date("2026-11-18T07:05:00Z");
const expiresAt = new Date(createdAt.getTime() + 72 * HOUR);
const fresh = { expiresAt, usedAt: null, revokedAt: null };

describe("getAccessCodeStatus", () => {
  it("Mã còn hạn: an unused, unrevoked code within 72 hours is active", () => {
    expect(getAccessCodeStatus(fresh, new Date(createdAt.getTime() + HOUR))).toBe("active");
  });

  it("is still active one millisecond before the 72-hour mark", () => {
    expect(getAccessCodeStatus(fresh, new Date(expiresAt.getTime() - 1))).toBe("active");
  });

  it("Mã hết hạn: expires exactly 72 hours after creation", () => {
    expect(getAccessCodeStatus(fresh, expiresAt)).toBe("expired");
  });

  it("Mã đã dùng: a used code is used, even after it would have expired", () => {
    const used = { ...fresh, usedAt: new Date(createdAt.getTime() + HOUR) };
    expect(getAccessCodeStatus(used, new Date(createdAt.getTime() + 2 * HOUR))).toBe("used");
    expect(getAccessCodeStatus(used, new Date(expiresAt.getTime() + HOUR))).toBe("used");
  });

  it("Mã đã huỷ: revoked wins over every other state", () => {
    const revoked = { ...fresh, revokedAt: new Date(createdAt.getTime() + HOUR) };
    expect(getAccessCodeStatus(revoked, new Date(createdAt.getTime() + 2 * HOUR))).toBe("revoked");
    expect(getAccessCodeStatus(revoked, new Date(expiresAt.getTime() + HOUR))).toBe("revoked");
  });
});
