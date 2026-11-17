import { describe, expect, it } from "vitest";

import { getInitials } from "@/lib/text/initials";

describe("getInitials", () => {
  it("uses the family name and the given name", () => {
    expect(getInitials("Nguyễn Văn An")).toBe("NA");
  });

  it("keeps Vietnamese letters", () => {
    expect(getInitials("đặng ánh")).toBe("ĐÁ");
  });

  it("returns a single letter for one-word names", () => {
    expect(getInitials("Lan")).toBe("L");
  });

  it("returns an empty string for blank input", () => {
    expect(getInitials("   ")).toBe("");
  });
});
