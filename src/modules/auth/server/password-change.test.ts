import { beforeEach, describe, expect, it, vi } from "vitest";

import { LOGIN_MESSAGES, PASSWORD_CHANGE_MESSAGES } from "@/modules/auth/constants";
import { changePasswordHash } from "@/modules/auth/server/mutations";
import { changePassword } from "@/modules/auth/server/password-change";
import { findPasswordHash } from "@/modules/auth/server/queries";
import type * as RateLimitModule from "@/modules/auth/server/rate-limit";
import {
  clearUsernameFailures,
  countRecentLoginAttempts,
  forgetLoginAttempt,
  recordLoginAttempt,
} from "@/modules/auth/server/rate-limit";
import { hashPassword, verifyPassword } from "@/server/auth/password";

vi.mock("@/modules/auth/server/queries", () => ({ findPasswordHash: vi.fn() }));
vi.mock("@/modules/auth/server/mutations", () => ({ changePasswordHash: vi.fn() }));
vi.mock("@/modules/auth/server/rate-limit", async (importOriginal) => ({
  // Keep the pure parts (key derivation, threshold decision) real.
  ...(await importOriginal<typeof RateLimitModule>()),
  recordLoginAttempt: vi.fn(),
  countRecentLoginAttempts: vi.fn(),
  forgetLoginAttempt: vi.fn(),
  clearUsernameFailures: vi.fn(),
}));
vi.mock("@/server/auth/password", () => ({
  hashPassword: vi.fn(async () => "new-argon2-hash"),
  verifyPassword: vi.fn(),
}));

const ATTEMPT_IDS = [501, 502];
const input = {
  accountId: "account-lan",
  username: "bs.lan",
  sessionId: "session-this-device",
  currentPassword: "LanPass-123",
  newPassword: "matkhau-moi-123",
};

function withAttempts(username: number, ip = username) {
  vi.mocked(countRecentLoginAttempts).mockResolvedValue({ username, ip });
}

beforeEach(() => {
  vi.mocked(recordLoginAttempt).mockResolvedValue(ATTEMPT_IDS);
  withAttempts(1);
  vi.mocked(findPasswordHash).mockResolvedValue("current-argon2-hash");
  vi.mocked(verifyPassword).mockResolvedValue(true);
  vi.mocked(changePasswordHash).mockResolvedValue("changed");
});

describe("changePassword", () => {
  it("Đổi mật khẩu thành công: clears failures, keeps this device's session", async () => {
    await changePassword(input);

    expect(verifyPassword).toHaveBeenCalledWith("current-argon2-hash", "LanPass-123");
    expect(hashPassword).toHaveBeenCalledWith("matkhau-moi-123");
    expect(changePasswordHash).toHaveBeenCalledWith({
      accountId: "account-lan",
      verifiedHash: "current-argon2-hash",
      newHash: "new-argon2-hash",
      keepSessionId: "session-this-device",
    });
    expect(forgetLoginAttempt).toHaveBeenCalledWith(ATTEMPT_IDS);
    expect(clearUsernameFailures).toHaveBeenCalled();
  });

  it("counts toward the username limit only, never the IP", async () => {
    await changePassword(input);

    const [keys] = vi.mocked(recordLoginAttempt).mock.calls[0]!;
    expect(keys.username).toMatch(/^login:user:/);
    expect(keys.ip).toBeNull();
  });

  it("Mật khẩu hiện tại sai: field error, the attempt stays a failure, nothing changes", async () => {
    vi.mocked(verifyPassword).mockResolvedValue(false);

    await expect(changePassword(input)).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      fieldErrors: { currentPassword: [PASSWORD_CHANGE_MESSAGES.wrongCurrentPassword] },
    });
    expect(forgetLoginAttempt).not.toHaveBeenCalled();
    expect(changePasswordHash).not.toHaveBeenCalled();
  });

  it("Sai quá nhiều lần: refused before checking the password, not counted", async () => {
    withAttempts(6);

    await expect(changePassword(input)).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(verifyPassword).not.toHaveBeenCalled();
    expect(forgetLoginAttempt).toHaveBeenCalledWith(ATTEMPT_IDS);
    expect(changePasswordHash).not.toHaveBeenCalled();
  });

  it("Mật khẩu mới trùng mật khẩu hiện tại: field error, no session ended", async () => {
    await expect(
      changePassword({ ...input, newPassword: input.currentPassword }),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      fieldErrors: { newPassword: [PASSWORD_CHANGE_MESSAGES.samePassword] },
    });
    expect(changePasswordHash).not.toHaveBeenCalled();
    expect(hashPassword).not.toHaveBeenCalled();
    // A refused change does not wipe earlier failures.
    expect(clearUsernameFailures).not.toHaveBeenCalled();
  });

  it("refuses with the locked message when the account was locked meanwhile", async () => {
    vi.mocked(changePasswordHash).mockResolvedValue("locked");

    await expect(changePassword(input)).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: LOGIN_MESSAGES.accountLocked,
    });
    expect(clearUsernameFailures).not.toHaveBeenCalled();
  });

  it("never overwrites a password reset or changed elsewhere meanwhile", async () => {
    vi.mocked(changePasswordHash).mockResolvedValue("stale");

    await expect(changePassword(input)).rejects.toMatchObject({
      code: "CONFLICT",
      message: PASSWORD_CHANGE_MESSAGES.changedElsewhere,
    });
  });

  it("reports UNAUTHENTICATED when this device was signed out meanwhile", async () => {
    vi.mocked(changePasswordHash).mockResolvedValue("session-ended");

    await expect(changePassword(input)).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });
});
