import { beforeEach, describe, expect, it, vi } from "vitest";

import { LOGIN_MESSAGES, RESET_MESSAGES } from "@/modules/auth/constants";
import { resetPasswordWithCode } from "@/modules/auth/server/mutations";
import { checkPasswordResetCode, resetPassword } from "@/modules/auth/server/password-reset";
import { findUsablePasswordResetCode } from "@/modules/auth/server/queries";
import { codeAttemptKey } from "@/modules/auth/server/rate-limit";
import { countRecentAttempts, forgetAttempts, recordAttempts } from "@/server/auth/attempts";
import { hashAccessCode } from "@/server/auth/crypto";
import { hashPassword } from "@/server/auth/password";

vi.mock("@/modules/auth/server/queries", () => ({ findUsablePasswordResetCode: vi.fn() }));
vi.mock("@/modules/auth/server/mutations", () => ({ resetPasswordWithCode: vi.fn() }));
vi.mock("@/server/auth/attempts", () => ({
  recordAttempts: vi.fn(),
  countRecentAttempts: vi.fn(),
  forgetAttempts: vi.fn(),
}));
vi.mock("@/server/auth/password", () => ({ hashPassword: vi.fn(async () => "argon2-hash") }));
vi.mock("@/config/env", () => ({
  getServerEnv: () => ({ ACCESS_CODE_PEPPER: "unit-test-pepper-0123456789abcdef0123" }),
}));

const IP = "203.0.113.7";
const ATTEMPT_IDS = [401];
const expiresAt = new Date("2026-11-21T07:05:00Z");
const form = { code: "R4FT-EJTD", password: "matkhau-moi-123", ip: IP, userAgent: "test" };

function withAttempts(count: number) {
  vi.mocked(countRecentAttempts).mockResolvedValue(new Map([[codeAttemptKey(IP), count]]));
}

beforeEach(() => {
  vi.mocked(recordAttempts).mockResolvedValue(ATTEMPT_IDS);
  withAttempts(1);
  vi.mocked(findUsablePasswordResetCode).mockResolvedValue({
    username: "bs.lan",
    expiresAt,
    accountStatus: "active",
  });
  vi.mocked(resetPasswordWithCode).mockResolvedValue({
    status: "reset",
    accountId: "account-lan",
    sessionToken: "token",
  });
});

describe("checkPasswordResetCode", () => {
  it("Nhập mã đặt lại đúng: returns the username, forgets the attempt", async () => {
    await expect(checkPasswordResetCode({ code: "r4ft ejtd", ip: IP })).resolves.toEqual({
      username: "bs.lan",
      expiresAt,
    });
    expect(findUsablePasswordResetCode).toHaveBeenCalledWith(hashAccessCode("R4FT-EJTD"));
    expect(forgetAttempts).toHaveBeenCalledWith(ATTEMPT_IDS);
  });

  it("Mã đặt lại không tồn tại / Mã kích hoạt dùng ở trang đặt lại: one message, counted", async () => {
    vi.mocked(findUsablePasswordResetCode).mockResolvedValue(null);

    await expect(checkPasswordResetCode({ code: "AAAA-AAAA", ip: IP })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: RESET_MESSAGES.invalidCode,
    });
    expect(forgetAttempts).not.toHaveBeenCalled();
  });

  it("Bị khoá sau khi được cấp mã: a locked account is refused at step 1, not counted", async () => {
    vi.mocked(findUsablePasswordResetCode).mockResolvedValue({
      username: "bs.lan",
      expiresAt,
      accountStatus: "locked",
    });

    await expect(checkPasswordResetCode({ code: "R4FTEJTD", ip: IP })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: LOGIN_MESSAGES.accountLocked,
    });
    expect(forgetAttempts).toHaveBeenCalledWith(ATTEMPT_IDS);
  });

  it("Quá nhiều lần nhập mã sai: refused before the lookup, not counted", async () => {
    withAttempts(11);

    await expect(checkPasswordResetCode({ code: "R4FTEJTD", ip: IP })).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
    expect(findUsablePasswordResetCode).not.toHaveBeenCalled();
    expect(forgetAttempts).toHaveBeenCalledWith(ATTEMPT_IDS);
  });
});

describe("resetPassword", () => {
  it("Đặt lại thành công: hashes, resets in one call, forgets the attempt", async () => {
    await expect(resetPassword(form)).resolves.toEqual({
      accountId: "account-lan",
      sessionToken: "token",
    });
    expect(hashPassword).toHaveBeenCalledWith("matkhau-moi-123");
    expect(resetPasswordWithCode).toHaveBeenCalledWith({
      codeHash: hashAccessCode("R4FTEJTD"),
      passwordHash: "argon2-hash",
      userAgent: "test",
    });
    expect(forgetAttempts).toHaveBeenCalledWith(ATTEMPT_IDS);
  });

  it("checks the code before hashing: an unusable code costs no Argon2", async () => {
    vi.mocked(findUsablePasswordResetCode).mockResolvedValue(null);

    await expect(resetPassword(form)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(hashPassword).not.toHaveBeenCalled();
    expect(forgetAttempts).not.toHaveBeenCalled();
  });

  it("Dùng lại mã đặt lại: a code consumed meanwhile is NOT_FOUND, counted", async () => {
    vi.mocked(resetPasswordWithCode).mockResolvedValue({ status: "invalid-code" });

    await expect(resetPassword(form)).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: RESET_MESSAGES.invalidCode,
    });
    expect(forgetAttempts).not.toHaveBeenCalled();
  });

  it("Bị khoá sau khi được cấp mã: FORBIDDEN with the locked message, not a code failure", async () => {
    vi.mocked(resetPasswordWithCode).mockResolvedValue({ status: "account-locked" });

    await expect(resetPassword(form)).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: LOGIN_MESSAGES.accountLocked,
    });
    expect(forgetAttempts).toHaveBeenCalledWith(ATTEMPT_IDS);
  });

  it("is refused when the IP is over the limit, without hashing", async () => {
    withAttempts(11);

    await expect(resetPassword(form)).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(hashPassword).not.toHaveBeenCalled();
    expect(resetPasswordWithCode).not.toHaveBeenCalled();
  });
});
