import { describe, expect, it } from "vitest";

import {
  codeAttemptKey,
  isCodeEntryBlocked,
  isLoginBlocked,
  loginAttemptKeys,
} from "@/modules/auth/server/rate-limit";
import { UNKNOWN_CLIENT_IP } from "@/server/http/client-ip";

// Counts include the attempt being evaluated (record-then-count).
describe("isLoginBlocked", () => {
  it("allows the fifth attempt for a username", () => {
    expect(isLoginBlocked({ username: 5, ip: 5 })).toBe(false);
  });

  it("Lần thử thứ sáu bị từ chối: blocks the sixth attempt after five failures", () => {
    expect(isLoginBlocked({ username: 6, ip: 6 })).toBe(true);
  });

  it("Tên khác không bị ảnh hưởng: another username from the same IP is still allowed", () => {
    // The blocked name's failures count for the IP, not for the other name.
    expect(isLoginBlocked({ username: 1, ip: 7 })).toBe(false);
  });

  it("allows the twentieth attempt from one IP", () => {
    expect(isLoginBlocked({ username: 1, ip: 20 })).toBe(false);
  });

  it("Dò nhiều tên từ một IP: blocks the 21st attempt after 20 failures from one IP", () => {
    expect(isLoginBlocked({ username: 1, ip: 21 })).toBe(true);
  });
});

describe("loginAttemptKeys", () => {
  it("never stores the raw username or IP", () => {
    const keys = loginAttemptKeys("bs.lan", "203.0.113.7");

    expect(keys.username).toMatch(/^login:user:[0-9a-f]{64}$/);
    expect(keys.ip).toMatch(/^login:ip:[0-9a-f]{64}$/);
    expect(`${keys.username}${keys.ip}`).not.toContain("bs.lan");
    expect(`${keys.username}${keys.ip}`).not.toContain("203.0.113.7");
  });

  it("gives different usernames different keys and the same IP the same key", () => {
    const lan = loginAttemptKeys("bs.lan", "203.0.113.7");
    const minh = loginAttemptKeys("bs.minh", "203.0.113.7");

    expect(lan.username).not.toBe(minh.username);
    expect(lan.ip).toBe(minh.ip);
  });

  it("has no IP key when the address is unknown, so nobody shares one bucket", () => {
    expect(loginAttemptKeys("bs.lan", UNKNOWN_CLIENT_IP).ip).toBeNull();
  });
});

describe("isCodeEntryBlocked", () => {
  it("allows the tenth code entry from one IP", () => {
    expect(isCodeEntryBlocked(10)).toBe(false);
  });

  it("Lần nhập mã thứ mười một bị từ chối: blocks the 11th entry after 10 failures", () => {
    expect(isCodeEntryBlocked(11)).toBe(true);
  });
});

describe("codeAttemptKey", () => {
  it("never stores the raw IP and differs from the login keys", () => {
    const key = codeAttemptKey("203.0.113.7");

    expect(key).toMatch(/^code:ip:[0-9a-f]{64}$/);
    expect(key).not.toContain("203.0.113.7");
    expect(key).not.toBe(loginAttemptKeys("x", "203.0.113.7").ip);
  });

  it("puts unknown addresses in one shared bucket (no unlimited guessing)", () => {
    expect(codeAttemptKey(UNKNOWN_CLIENT_IP)).toBe(codeAttemptKey(UNKNOWN_CLIENT_IP));
    expect(codeAttemptKey(UNKNOWN_CLIENT_IP)).toMatch(/^code:ip:[0-9a-f]{64}$/);
  });
});
