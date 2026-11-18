import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_ERROR_MESSAGES } from "@/lib/errors";
import { ACTIVATION_MESSAGES } from "@/modules/auth/constants";
import { activateAccount, checkActivationCode } from "@/modules/auth/server/activation";
import { activateAccountWithCode } from "@/modules/auth/server/mutations";
import { findUsableActivationCode, usernameExists } from "@/modules/auth/server/queries";
import { codeAttemptKey } from "@/modules/auth/server/rate-limit";
import { countRecentAttempts, forgetAttempts, recordAttempts } from "@/server/auth/attempts";
import { hashAccessCode } from "@/server/auth/crypto";
import { hashPassword } from "@/server/auth/password";

vi.mock("@/modules/auth/server/queries", () => ({
  findUsableActivationCode: vi.fn(),
  usernameExists: vi.fn(),
}));
vi.mock("@/modules/auth/server/mutations", () => ({ activateAccountWithCode: vi.fn() }));
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
const ATTEMPT_IDS = [301];
const expiresAt = new Date("2026-11-21T07:05:00Z");

/** Code entries from this IP in the window, INCLUDING the current one. */
function withAttempts(count: number) {
  vi.mocked(countRecentAttempts).mockResolvedValue(new Map([[codeAttemptKey(IP), count]]));
}

const form = {
  code: "K7HM-3QXR",
  displayName: "BS. Trần Thị B",
  username: "bs.tran",
  password: "matkhau123",
  ip: IP,
  userAgent: "test",
};

beforeEach(() => {
  vi.mocked(recordAttempts).mockResolvedValue(ATTEMPT_IDS);
  withAttempts(1);
});

describe("checkActivationCode", () => {
  it("Nhập mã đúng: returns the recipient and forgets the attempt", async () => {
    vi.mocked(findUsableActivationCode).mockResolvedValue({
      recipientName: "BS. Trần Thị B",
      expiresAt,
    });

    await expect(checkActivationCode({ code: "k7hm 3qxr", ip: IP })).resolves.toEqual({
      recipientName: "BS. Trần Thị B",
      expiresAt,
    });
    // Normalized before hashing: any spelling of the code finds the same row.
    expect(findUsableActivationCode).toHaveBeenCalledWith(hashAccessCode("K7HM-3QXR"));
    expect(forgetAttempts).toHaveBeenCalledWith(ATTEMPT_IDS);
  });

  it("records the attempt before counting it", async () => {
    vi.mocked(findUsableActivationCode).mockResolvedValue({ recipientName: "B", expiresAt });
    await checkActivationCode({ code: "K7HM3QXR", ip: IP });

    expect(recordAttempts).toHaveBeenCalledWith([codeAttemptKey(IP)]);
    const recordedAt = vi.mocked(recordAttempts).mock.invocationCallOrder[0]!;
    const countedAt = vi.mocked(countRecentAttempts).mock.invocationCallOrder[0]!;
    expect(recordedAt).toBeLessThan(countedAt);
  });

  it("Mã không tồn tại: one generic message, the attempt stays a failure", async () => {
    vi.mocked(findUsableActivationCode).mockResolvedValue(null);

    await expect(checkActivationCode({ code: "AAAA-AAAA", ip: IP })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: ACTIVATION_MESSAGES.invalidCode,
    });
    expect(forgetAttempts).not.toHaveBeenCalled();
  });

  it("Lần nhập mã thứ mười một bị từ chối: refused before looking the code up, not counted", async () => {
    withAttempts(11);

    await expect(checkActivationCode({ code: "K7HM3QXR", ip: IP })).rejects.toMatchObject({
      code: "RATE_LIMITED",
      message: DEFAULT_ERROR_MESSAGES.RATE_LIMITED,
    });
    expect(findUsableActivationCode).not.toHaveBeenCalled();
    expect(forgetAttempts).toHaveBeenCalledWith(ATTEMPT_IDS);
  });
});

describe("activateAccount", () => {
  beforeEach(() => {
    vi.mocked(findUsableActivationCode).mockResolvedValue({ recipientName: "B", expiresAt });
    vi.mocked(usernameExists).mockResolvedValue(false);
    vi.mocked(activateAccountWithCode).mockResolvedValue({
      status: "created",
      accountId: "account-tran",
      sessionToken: "token",
    });
  });

  it("Kích hoạt thành công: hashes the password, consumes the code, forgets the attempt", async () => {
    await expect(activateAccount(form)).resolves.toEqual({
      accountId: "account-tran",
      sessionToken: "token",
    });
    expect(hashPassword).toHaveBeenCalledWith("matkhau123");
    expect(activateAccountWithCode).toHaveBeenCalledWith({
      codeHash: hashAccessCode("K7HM3QXR"),
      displayName: "BS. Trần Thị B",
      username: "bs.tran",
      passwordHash: "argon2-hash",
      userAgent: "test",
    });
    expect(forgetAttempts).toHaveBeenCalledWith(ATTEMPT_IDS);
  });

  it("hashes the password before opening the transaction", async () => {
    await activateAccount(form);

    const hashedAt = vi.mocked(hashPassword).mock.invocationCallOrder[0]!;
    const activatedAt = vi.mocked(activateAccountWithCode).mock.invocationCallOrder[0]!;
    expect(hashedAt).toBeLessThan(activatedAt);
  });

  it("Mã đặt lại mật khẩu dùng ở trang kích hoạt: any unusable code is NOT_FOUND, kept as a failure", async () => {
    vi.mocked(activateAccountWithCode).mockResolvedValue({ status: "invalid-code" });

    await expect(activateAccount(form)).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: ACTIVATION_MESSAGES.invalidCode,
    });
    expect(forgetAttempts).not.toHaveBeenCalled();
  });

  it("Tên đăng nhập đã có người dùng: CONFLICT on the username field, no hash, not a code failure", async () => {
    vi.mocked(usernameExists).mockResolvedValue(true);

    await expect(activateAccount(form)).rejects.toMatchObject({
      code: "CONFLICT",
      fieldErrors: { username: [ACTIVATION_MESSAGES.usernameTaken] },
    });
    expect(usernameExists).toHaveBeenCalledWith("bs.tran");
    expect(hashPassword).not.toHaveBeenCalled();
    expect(activateAccountWithCode).not.toHaveBeenCalled();
    expect(forgetAttempts).toHaveBeenCalledWith(ATTEMPT_IDS);
  });

  it("reports a username taken concurrently (inside the transaction) the same way", async () => {
    vi.mocked(activateAccountWithCode).mockResolvedValue({ status: "username-taken" });

    await expect(activateAccount(form)).rejects.toMatchObject({
      code: "CONFLICT",
      fieldErrors: { username: [ACTIVATION_MESSAGES.usernameTaken] },
    });
    expect(forgetAttempts).toHaveBeenCalledWith(ATTEMPT_IDS);
  });

  it("checks the code before the username, so an unusable code reveals no username", async () => {
    vi.mocked(findUsableActivationCode).mockResolvedValue(null);
    vi.mocked(usernameExists).mockResolvedValue(true);

    await expect(activateAccount(form)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(usernameExists).not.toHaveBeenCalled();
    expect(hashPassword).not.toHaveBeenCalled();
    expect(forgetAttempts).not.toHaveBeenCalled();
  });

  it("does not count an unexpected server error as a failed code entry", async () => {
    vi.mocked(activateAccountWithCode).mockRejectedValue(new Error("connection reset"));

    await expect(activateAccount(form)).rejects.toThrow("connection reset");
    expect(forgetAttempts).toHaveBeenCalledWith(ATTEMPT_IDS);
  });

  it("is refused when the IP is over the limit, without touching the database", async () => {
    withAttempts(11);

    await expect(activateAccount(form)).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(activateAccountWithCode).not.toHaveBeenCalled();
    expect(hashPassword).not.toHaveBeenCalled();
  });
});
