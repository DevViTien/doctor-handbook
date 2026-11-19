import { describe, expect, it } from "vitest";

import { usernameMatches } from "@/modules/admin/account-deletion";

describe("usernameMatches", () => {
  it("Chưa gõ đúng thì chưa xoá được: ignores case and surrounding spaces only", () => {
    expect(usernameMatches("bs.khoa", "bs.khoa")).toBe(true);
    expect(usernameMatches("  BS.Khoa ", "bs.khoa")).toBe(true);
    expect(usernameMatches("bs.kho", "bs.khoa")).toBe(false);
    expect(usernameMatches("bs. khoa", "bs.khoa")).toBe(false);
    expect(usernameMatches("bs.lan", "bs.khoa")).toBe(false);
  });

  it("never matches an empty answer", () => {
    expect(usernameMatches("", "bs.khoa")).toBe(false);
    expect(usernameMatches("   ", "bs.khoa")).toBe(false);
  });
});
