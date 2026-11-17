import { describe, expect, it } from "vitest";

import { LOGIN_MESSAGES } from "@/modules/auth/constants";
import { loginSchema } from "@/modules/auth/schemas";

describe("loginSchema", () => {
  it("Tên đăng nhập viết hoa và có khoảng trắng: normalizes to the stored form", () => {
    const parsed = loginSchema.parse({ username: " BS.Lan ", password: "matkhau123" });
    expect(parsed.username).toBe("bs.lan");
  });

  it("keeps the password exactly as typed (case and spaces)", () => {
    const parsed = loginSchema.parse({ username: "bs.lan", password: " MatKhau 123 " });
    expect(parsed.password).toBe(" MatKhau 123 ");
  });

  it("Bỏ trống mật khẩu: reports the field without checking credentials", () => {
    const result = loginSchema.safeParse({ username: "bs.lan", password: "" });

    expect(result.success).toBe(false);
    expect(result.error?.issues).toEqual([
      expect.objectContaining({ path: ["password"], message: LOGIN_MESSAGES.passwordRequired }),
    ]);
  });

  it("reports an empty username", () => {
    const result = loginSchema.safeParse({ username: "   ", password: "x" });

    expect(result.error?.issues[0]).toMatchObject({
      path: ["username"],
      message: LOGIN_MESSAGES.usernameRequired,
    });
  });

  it("shows Vietnamese messages for values that are too long", () => {
    const result = loginSchema.safeParse({ username: "a".repeat(65), password: "b".repeat(129) });

    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      LOGIN_MESSAGES.usernameTooLong,
      LOGIN_MESSAGES.passwordTooLong,
    ]);
  });

  it("never rejects the form because of next (a very long one is dropped)", () => {
    const parsed = loginSchema.parse({
      username: "a",
      password: "b",
      next: `/${"x".repeat(5000)}`,
    });
    expect(parsed.next).toHaveLength(5001);
    expect(loginSchema.parse({ username: "a", password: "b", next: 42 }).next).toBeUndefined();
  });

  it("accepts an optional next target", () => {
    expect(loginSchema.parse({ username: "a", password: "b", next: "/todos" }).next).toBe("/todos");
    expect(loginSchema.parse({ username: "a", password: "b" }).next).toBeUndefined();
  });
});
