import { describe, expect, it } from "vitest";

import { getSafeRedirectPath, isActivePath } from "@/lib/url";

describe("getSafeRedirectPath", () => {
  it.each(["/patients", "/patients/123?tab=notes", "/"])("accepts %j", (value) => {
    expect(getSafeRedirectPath(value)).toBe(value);
  });

  it.each([
    null,
    undefined,
    "",
    "patients",
    "//evil.com",
    "/\\evil.com",
    "https://evil.com",
    "javascript:alert(1)",
    "/\t/evil.com",
    "/\n/evil.com",
  ])("rejects %j", (value) => {
    expect(getSafeRedirectPath(value)).toBeNull();
  });
});

describe("isActivePath", () => {
  it("matches the section and its sub-paths only", () => {
    expect(isActivePath("/admin/accounts", "/admin/accounts")).toBe(true);
    expect(isActivePath("/patients/42", "/patients")).toBe(true);
    expect(isActivePath("/patients-archive", "/patients")).toBe(false);
  });
});
