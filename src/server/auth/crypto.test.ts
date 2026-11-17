import { describe, expect, it } from "vitest";

import { ACCESS_CODE_ALPHABET, ACCESS_CODE_LENGTH } from "@/server/auth/constants";
import {
  formatAccessCode,
  generateAccessCode,
  generateSessionToken,
  hmacSha256Hex,
  normalizeAccessCode,
  safeEqual,
  sha256Hex,
} from "@/server/auth/crypto";

describe("generateAccessCode", () => {
  it("uses only the unambiguous alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateAccessCode();
      expect(code).toHaveLength(ACCESS_CODE_LENGTH);
      for (const char of code) expect(ACCESS_CODE_ALPHABET).toContain(char);
    }
  });
});

describe("normalizeAccessCode / formatAccessCode", () => {
  it("round-trips what a user types", () => {
    expect(normalizeAccessCode(" k7hm-3qxr ")).toBe("K7HM3QXR");
    expect(formatAccessCode("K7HM3QXR")).toBe("K7HM-3QXR");
  });
});

describe("tokens and hashing", () => {
  it("generates distinct URL-safe tokens", () => {
    const a = generateSessionToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateSessionToken()).not.toBe(a);
  });

  it("hashes deterministically", () => {
    expect(sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("computes keyed hashes (HMAC-SHA256)", () => {
    const message = "The quick brown fox jumps over the lazy dog";
    expect(hmacSha256Hex(message, "key")).toBe(
      "f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8",
    );
    expect(hmacSha256Hex(message, "other-key")).not.toBe(hmacSha256Hex(message, "key"));
  });

  it("compares secrets safely", () => {
    expect(safeEqual("secret", "secret")).toBe(true);
    expect(safeEqual("secret", "secreT")).toBe(false);
    expect(safeEqual("secret", "secret-longer")).toBe(false);
  });
});
