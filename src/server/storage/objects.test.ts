import { describe, expect, it } from "vitest";

import { accountObjectPath } from "@/server/storage/objects";

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
