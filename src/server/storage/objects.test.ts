import { describe, expect, it } from "vitest";

import {
  accountObjectPath,
  isAvatarPathOf,
  newAvatarObjectPath,
  storedAvatarPath,
} from "@/server/storage/objects";

const ACCOUNT_ID = "6f1c1b0e-6c1a-4c37-9d55-1f0a8c1e2b3d";

describe("accountObjectPath", () => {
  it("prefixes segments with the account id", () => {
    expect(accountObjectPath(ACCOUNT_ID, "patient-1.webp")).toBe(`${ACCOUNT_ID}/patient-1.webp`);
  });

  it.each(["..", ".", "a/b", "a\\b", "", "%2e%2e"])("rejects unsafe segment %j", (segment) => {
    expect(() => accountObjectPath(ACCOUNT_ID, segment)).toThrow();
  });

  it("rejects an account id that is not a UUID", () => {
    expect(() => accountObjectPath("..", "file.webp")).toThrow();
  });

  it("requires at least one segment", () => {
    expect(() => accountObjectPath(ACCOUNT_ID)).toThrow();
  });
});

describe("avatar paths", () => {
  const OTHER = "0a1c1b0e-6c1a-4c37-9d55-1f0a8c1e2b3d";
  const name = "0123456789abcdef0123456789abcdef";

  it("makes a fresh random name under the account", () => {
    const first = newAvatarObjectPath(ACCOUNT_ID, "webp");
    expect(first).toMatch(new RegExp(`^${ACCOUNT_ID}/[0-9a-f]{32}[.]webp$`));
    expect(newAvatarObjectPath(ACCOUNT_ID, "webp")).not.toBe(first);
  });

  it("accepts only this account's avatar paths", () => {
    expect(isAvatarPathOf(ACCOUNT_ID, `${ACCOUNT_ID}/${name}.webp`)).toBe(true);
    expect(isAvatarPathOf(ACCOUNT_ID, `${ACCOUNT_ID}/${name}.jpg`)).toBe(true);
  });

  it.each([
    ["another account", `${OTHER}/${name}.webp`],
    ["a sub-folder", `${ACCOUNT_ID}/x/${name}.webp`],
    ["a parent segment", `${ACCOUNT_ID}/../${OTHER}/${name}.webp`],
    ["an odd extension", `${ACCOUNT_ID}/${name}.png`],
    ["a short name", `${ACCOUNT_ID}/abc.webp`],
    ["upper-case hex", `${ACCOUNT_ID}/${name.toUpperCase()}.webp`],
  ])("rejects %s", (_label, path) => {
    expect(isAvatarPathOf(ACCOUNT_ID, path)).toBe(false);
  });

  it("reads back stored paths of any account, and nothing else", () => {
    expect(storedAvatarPath(`${OTHER}/${name}.webp`)).toBe(`${OTHER}/${name}.webp`);
    expect(storedAvatarPath(null)).toBeNull();
    expect(storedAvatarPath(`not-a-uuid/${name}.webp`)).toBeNull();
    expect(storedAvatarPath(`${OTHER}/../x.webp`)).toBeNull();
  });
});
