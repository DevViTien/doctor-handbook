import "server-only";

import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

import { getServerEnv } from "@/config/env";

import { ACCESS_CODE_ALPHABET, ACCESS_CODE_LENGTH } from "./constants";

/** 256-bit random session token, URL-safe. */
export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Hex SHA-256. Only for secrets with enough entropy to resist brute force on their own
 * (256-bit session tokens). Never for passwords or short codes.
 */
export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Hex HMAC-SHA256 keyed with a server secret. */
export function hmacSha256Hex(value: string, key: string): string {
  return createHmac("sha256", key).update(value).digest("hex");
}

/** Constant-time string comparison for secrets (e.g. cron bearer tokens). */
export function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
}

/** Random one-time code such as "K7HM3QXR" (~40 bits). */
export function generateAccessCode(): string {
  let code = "";
  for (let i = 0; i < ACCESS_CODE_LENGTH; i++) {
    code += ACCESS_CODE_ALPHABET[randomInt(ACCESS_CODE_ALPHABET.length)];
  }
  return code;
}

/** Accepts what people actually type ("k7hm-3qxr ") and returns the canonical code. */
export function normalizeAccessCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** "K7HM3QXR" -> "K7HM-3QXR", easier to read aloud or copy into a chat message. */
export function formatAccessCode(code: string): string {
  const half = Math.ceil(code.length / 2);
  return `${code.slice(0, half)}-${code.slice(half)}`;
}

/**
 * Value stored in `access_codes.code_hash`. A 40-bit code is too small for a plain hash:
 * keying it with `ACCESS_CODE_PEPPER` (kept outside the database) makes a leaked table
 * useless for offline brute force.
 */
export function hashAccessCode(input: string): string {
  return hmacSha256Hex(normalizeAccessCode(input), getServerEnv().ACCESS_CODE_PEPPER);
}
