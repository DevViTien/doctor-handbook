import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_ERROR_MESSAGES } from "@/lib/errors";
import { LOGIN_MESSAGES } from "@/modules/auth/constants";
import { authenticate } from "@/modules/auth/server/login";
import { recordLoginSuccess } from "@/modules/auth/server/mutations";
import { findAccountForLogin, type LoginAccount } from "@/modules/auth/server/queries";
import type * as RateLimitModule from "@/modules/auth/server/rate-limit";
import {
  clearUsernameFailures,
  countRecentLoginAttempts,
  forgetLoginAttempt,
  recordLoginAttempt,
} from "@/modules/auth/server/rate-limit";
import { verifyPassword } from "@/server/auth/password";

vi.mock("@/modules/auth/server/queries", () => ({ findAccountForLogin: vi.fn() }));
vi.mock("@/modules/auth/server/mutations", () => ({ recordLoginSuccess: vi.fn() }));
vi.mock("@/modules/auth/server/rate-limit", async (importOriginal) => ({
  // Keep the pure parts (key derivation, threshold decision) real.
  ...(await importOriginal<typeof RateLimitModule>()),
  recordLoginAttempt: vi.fn(),
  countRecentLoginAttempts: vi.fn(),
  forgetLoginAttempt: vi.fn(),
  clearUsernameFailures: vi.fn(),
}));
vi.mock("@/server/auth/password", () => ({
  hashPassword: vi.fn(async () => "dummy-hash"),
  verifyPassword: vi.fn(),
}));

const lan: LoginAccount = {
  id: "account-lan",
  role: "doctor",
  status: "active",
  passwordHash: "hash-of-lan",
};

const attempt = { username: "bs.lan", password: "matkhau123", ip: "203.0.113.7" };
const ATTEMPT_IDS = [101, 102];

/** Counts include the attempt being evaluated (record-then-count). */
function withAttempts(username: number, ip = username) {
  vi.mocked(countRecentLoginAttempts).mockResolvedValue({ username, ip });
}

describe("authenticate", () => {
  beforeEach(() => {
    vi.mocked(recordLoginAttempt).mockResolvedValue(ATTEMPT_IDS);
    withAttempts(1);
    vi.mocked(findAccountForLogin).mockResolvedValue(lan);
    vi.mocked(verifyPassword).mockResolvedValue(true);
  });

  it("records the attempt before counting it", async () => {
    await authenticate(attempt);

    const recordedAt = vi.mocked(recordLoginAttempt).mock.invocationCallOrder[0]!;
    const countedAt = vi.mocked(countRecentLoginAttempts).mock.invocationCallOrder[0]!;
    expect(recordedAt).toBeLessThan(countedAt);
  });

  it("returns the account, records the success and forgets the attempt", async () => {
    await expect(authenticate(attempt)).resolves.toEqual({ id: "account-lan", role: "doctor" });

    expect(recordLoginSuccess).toHaveBeenCalledWith("account-lan");
    expect(forgetLoginAttempt).toHaveBeenCalledWith(ATTEMPT_IDS);
  });

  it("Sai mật khẩu: generic message, the attempt stays as a failure", async () => {
    vi.mocked(verifyPassword).mockResolvedValue(false);

    await expect(authenticate(attempt)).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
      message: LOGIN_MESSAGES.invalidCredentials,
    });
    expect(forgetLoginAttempt).not.toHaveBeenCalled();
    expect(recordLoginSuccess).not.toHaveBeenCalled();
  });

  it("Mật khẩu khác hoa thường: the password is compared exactly", async () => {
    vi.mocked(verifyPassword).mockImplementation(
      async (_hash, password) => password === "matkhau123",
    );

    await expect(authenticate({ ...attempt, password: "MATKHAU123" })).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
  });

  it("Tên đăng nhập không tồn tại: same message, and a hash is still verified", async () => {
    vi.mocked(findAccountForLogin).mockResolvedValue(null);
    vi.mocked(verifyPassword).mockResolvedValue(false);

    await expect(authenticate({ ...attempt, username: "khong.ton.tai" })).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
      message: LOGIN_MESSAGES.invalidCredentials,
    });
    expect(verifyPassword).toHaveBeenCalledWith("dummy-hash", attempt.password);
    expect(forgetLoginAttempt).not.toHaveBeenCalled();
  });

  it("Đúng mật khẩu nhưng bị khoá: locked message, not a failure, no success", async () => {
    vi.mocked(findAccountForLogin).mockResolvedValue({ ...lan, status: "locked" });

    await expect(authenticate(attempt)).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: LOGIN_MESSAGES.accountLocked,
    });
    expect(forgetLoginAttempt).toHaveBeenCalledWith(ATTEMPT_IDS);
    expect(recordLoginSuccess).not.toHaveBeenCalled();
  });

  it("Sai mật khẩu khi bị khoá: the lock is not revealed", async () => {
    vi.mocked(findAccountForLogin).mockResolvedValue({ ...lan, status: "locked" });
    vi.mocked(verifyPassword).mockResolvedValue(false);

    await expect(authenticate(attempt)).rejects.toMatchObject({
      message: LOGIN_MESSAGES.invalidCredentials,
    });
  });

  it("Lần thử thứ sáu bị từ chối: refused before the password check and not counted", async () => {
    withAttempts(6);

    await expect(authenticate(attempt)).rejects.toMatchObject({
      code: "RATE_LIMITED",
      message: DEFAULT_ERROR_MESSAGES.RATE_LIMITED,
    });
    expect(verifyPassword).not.toHaveBeenCalled();
    expect(forgetLoginAttempt).toHaveBeenCalledWith(ATTEMPT_IDS);
  });

  it("Dò nhiều tên từ một IP: refused once the IP goes beyond its threshold", async () => {
    withAttempts(1, 21);

    await expect(authenticate(attempt)).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });

  it("Đăng nhập thành công xoá đếm: clears the username's failures", async () => {
    withAttempts(5);

    await authenticate(attempt);

    expect(clearUsernameFailures).toHaveBeenCalledTimes(1);
  });
});
