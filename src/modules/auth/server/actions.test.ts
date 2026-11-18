import { beforeEach, describe, expect, it, vi } from "vitest";

import { changePasswordFormAction } from "@/modules/auth/server/actions";
import { changePassword } from "@/modules/auth/server/password-change";
import { getSessionToken } from "@/server/auth/cookies";
import { type AuthContext, validateSessionToken } from "@/server/auth/session";

// Real guards (requireAccess), fake session lookup: tests the access rule end to end.
vi.mock("@/server/auth/cookies", () => ({
  getSessionToken: vi.fn(),
  setSessionCookie: vi.fn(),
  deleteSessionCookie: vi.fn(),
}));
vi.mock("@/server/auth/session", () => ({
  validateSessionToken: vi.fn(),
  createSession: vi.fn(),
  invalidateSession: vi.fn(),
}));
vi.mock("@/modules/auth/server/password-change", () => ({ changePassword: vi.fn() }));
vi.mock("@/server/auth/password", () => ({
  hashPassword: vi.fn(async () => "hash"),
  verifyPassword: vi.fn(),
}));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

const doctor: AuthContext = {
  sessionId: "s-lan",
  account: { id: "account-lan", role: "doctor", username: "bs.lan", displayName: "BS. Lan" },
};
const admin: AuthContext = {
  sessionId: "s-admin",
  account: { id: "account-admin", role: "admin", username: "admin", displayName: "Quản trị" },
};

function signedInAs(auth: AuthContext | null) {
  vi.mocked(getSessionToken).mockResolvedValue(auth ? "token" : undefined);
  vi.mocked(validateSessionToken).mockResolvedValue(auth);
}

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const passwords = form({ currentPassword: "LanPass-123", newPassword: "matkhau-moi-123" });

describe("changePasswordFormAction", () => {
  beforeEach(() => {
    vi.mocked(changePassword).mockResolvedValue(undefined);
  });

  it("changes the password of the session's own account, keeping this session", async () => {
    signedInAs(doctor);

    await expect(changePasswordFormAction(null, passwords)).resolves.toEqual({
      ok: true,
      data: { changed: true },
    });
    expect(changePassword).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "account-lan",
        username: "bs.lan",
        sessionId: "s-lan",
      }),
    );
  });

  it("ignores any account id sent by the client", async () => {
    signedInAs(doctor);
    const tampered = form({
      currentPassword: "LanPass-123",
      newPassword: "matkhau-moi-123",
      accountId: "account-minh",
    });

    await changePasswordFormAction(null, tampered);

    expect(changePassword).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: "account-lan" }),
    );
  });

  it("Chưa đăng nhập gửi yêu cầu đổi mật khẩu: UNAUTHENTICATED", async () => {
    signedInAs(null);

    const result = await changePasswordFormAction(null, passwords);

    expect(result).toMatchObject({ ok: false, error: { code: "UNAUTHENTICATED" } });
    expect(changePassword).not.toHaveBeenCalled();
  });

  it("Admin gửi yêu cầu đổi mật khẩu: FORBIDDEN", async () => {
    signedInAs(admin);

    const result = await changePasswordFormAction(null, passwords);

    expect(result).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(changePassword).not.toHaveBeenCalled();
  });
});
