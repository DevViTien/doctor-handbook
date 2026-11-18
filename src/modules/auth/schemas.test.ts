import { describe, expect, it } from "vitest";

import { ACTIVATION_MESSAGES, LOGIN_MESSAGES, RESET_MESSAGES } from "@/modules/auth/constants";
import {
  activateAccountSchema,
  activationCodeSchema,
  loginSchema,
  passwordResetCodeSchema,
  resetPasswordSchema,
} from "@/modules/auth/schemas";

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

describe("activationCodeSchema", () => {
  it("Bỏ trống mã: reports the code field", () => {
    for (const code of ["", "   ", undefined]) {
      const result = activationCodeSchema.safeParse({ code });
      expect(result.error?.issues[0]).toMatchObject({
        path: ["code"],
        message: ACTIVATION_MESSAGES.codeRequired,
      });
    }
  });

  it("Nhập mã chữ thường không dấu gạch: accepts what people type (normalized on the server)", () => {
    expect(activationCodeSchema.parse({ code: " k7hm3qxr " }).code).toBe("k7hm3qxr");
  });
});

describe("activateAccountSchema", () => {
  const valid = {
    code: "K7HM-3QXR",
    displayName: "BS. Trần Thị B",
    username: "bs.tran",
    password: "matkhau123",
    acceptTerms: "on",
  };

  const errorsFor = (input: Record<string, unknown>) =>
    activateAccountSchema.safeParse(input).error?.issues.map(({ path, message }) => ({
      path: path.join("."),
      message,
    }));

  it("accepts a valid form, with the checkbox posted as 'on'", () => {
    expect(activateAccountSchema.parse(valid)).toMatchObject({
      username: "bs.tran",
      acceptTerms: true,
    });
  });

  it("Tên đăng nhập viết hoa: trims and lowercases the username", () => {
    expect(activateAccountSchema.parse({ ...valid, username: " BS.Tran " }).username).toBe(
      "bs.tran",
    );
  });

  it("Tên đăng nhập có dấu: rejected with the username rule", () => {
    expect(errorsFor({ ...valid, username: "bs.lân" })).toEqual([
      {
        path: "username",
        message: "Tên đăng nhập gồm 3–32 ký tự: chữ không dấu, số, dấu chấm, gạch dưới.",
      },
    ]);
  });

  it("Mật khẩu quá ngắn: at least 8 characters, never trimmed", () => {
    expect(errorsFor({ ...valid, password: "1234567" })).toEqual([
      { path: "password", message: "Mật khẩu cần tối thiểu 8 ký tự." },
    ]);
    expect(activateAccountSchema.parse({ ...valid, password: " 1234567 " }).password).toBe(
      " 1234567 ",
    );
  });

  it("Chưa tick đồng ý: an unchecked box posts nothing", () => {
    const { acceptTerms: _omitted, ...withoutTerms } = valid;
    expect(errorsFor(withoutTerms)).toEqual([
      { path: "acceptTerms", message: ACTIVATION_MESSAGES.termsRequired },
    ]);
  });

  it("requires a display name of at most 80 characters", () => {
    expect(errorsFor({ ...valid, displayName: "  " })).toEqual([
      { path: "displayName", message: ACTIVATION_MESSAGES.displayNameRequired },
    ]);
    expect(errorsFor({ ...valid, displayName: "a".repeat(81) })).toEqual([
      { path: "displayName", message: ACTIVATION_MESSAGES.displayNameTooLong },
    ]);
  });
});

describe("passwordResetCodeSchema / resetPasswordSchema", () => {
  it("Bỏ trống mã đặt lại: reports the code field with the reset message", () => {
    const result = passwordResetCodeSchema.safeParse({ code: "  " });
    expect(result.error?.issues[0]).toMatchObject({
      path: ["code"],
      message: RESET_MESSAGES.codeRequired,
    });
  });

  it("Mật khẩu mới quá ngắn: at least 8 characters, never trimmed", () => {
    const result = resetPasswordSchema.safeParse({ code: "R4FT-EJTD", password: "1234567" });
    expect(result.error?.issues[0]).toMatchObject({
      path: ["password"],
      message: "Mật khẩu cần tối thiểu 8 ký tự.",
    });
    expect(resetPasswordSchema.parse({ code: "R4FT-EJTD", password: " matkhau " }).password).toBe(
      " matkhau ",
    );
  });
});
