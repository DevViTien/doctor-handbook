import { beforeEach, describe, expect, it, vi } from "vitest";

import { ACCOUNT_MESSAGES, ADMIN_MESSAGES } from "@/modules/admin/constants";
import {
  createAccessCodeFormAction,
  createPasswordResetCodeAction,
  deleteAccountAction,
  lockAccountAction,
  revokeAccessCodeAction,
  unlockAccountAction,
} from "@/modules/admin/server/actions";
import {
  deleteDoctorAccount,
  insertAccessCode,
  issuePasswordResetCode,
  revokeAccessCode,
  setDoctorAccountStatus,
} from "@/modules/admin/server/mutations";
import { ACCESS_CODE_ALPHABET, ACCESS_CODE_TTL_MS } from "@/server/auth/constants";
import { getSessionToken } from "@/server/auth/cookies";
import { hashAccessCode } from "@/server/auth/crypto";
import { type AuthContext, validateSessionToken } from "@/server/auth/session";
import { logger } from "@/server/logger";

// Real guards (requireAccess), fake session lookup: tests the access rules end to end.
vi.mock("@/server/auth/cookies", () => ({ getSessionToken: vi.fn() }));
vi.mock("@/server/auth/session", () => ({ validateSessionToken: vi.fn() }));
vi.mock("@/modules/admin/server/mutations", () => ({
  deleteDoctorAccount: vi.fn(),
  insertAccessCode: vi.fn(),
  issuePasswordResetCode: vi.fn(),
  revokeAccessCode: vi.fn(),
  setDoctorAccountStatus: vi.fn(),
}));
vi.mock("@/config/env", () => ({
  getServerEnv: () => ({ ACCESS_CODE_PEPPER: "unit-test-pepper-0123456789abcdef0123" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

const admin: AuthContext = {
  sessionId: "s-admin",
  account: { id: "account-admin", role: "admin", username: "admin", displayName: "Quản trị" },
};
const doctor: AuthContext = {
  sessionId: "s-lan",
  account: { id: "account-lan", role: "doctor", username: "bs.lan", displayName: "BS. Lan" },
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

const CODE_ID = "0b9f4f0e-4a43-4c9e-9a51-3d3a8a9a6f10";
const uniqueViolation = new Error("Failed query", {
  cause: Object.assign(new Error("duplicate"), {
    code: "23505",
    constraint_name: "access_codes_code_hash_key",
  }),
});

describe("createAccessCodeFormAction", () => {
  beforeEach(() => {
    signedInAs(admin);
    vi.mocked(insertAccessCode).mockResolvedValue({ id: CODE_ID });
  });

  it("Tạo mã cho bác sĩ mới: stores only the hash and returns the formatted code once", async () => {
    const before = Date.now();
    const result = await createAccessCodeFormAction(
      null,
      form({ recipientName: " BS. Trần Thị B " }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { code, recipientName, expiresAt } = result.data;
    expect(code).toMatch(new RegExp(`^[${ACCESS_CODE_ALPHABET}]{4}-[${ACCESS_CODE_ALPHABET}]{4}$`));
    expect(recipientName).toBe("BS. Trần Thị B");
    const ttl = new Date(expiresAt).getTime() - before;
    expect(ttl).toBeGreaterThanOrEqual(ACCESS_CODE_TTL_MS);
    expect(ttl).toBeLessThan(ACCESS_CODE_TTL_MS + 5_000);

    const stored = vi.mocked(insertAccessCode).mock.calls[0]![0];
    expect(stored).toMatchObject({
      type: "activation",
      recipientName: "BS. Trần Thị B",
      createdById: "account-admin",
      codeHash: hashAccessCode(code),
    });
    expect(JSON.stringify(stored)).not.toContain(code.replace("-", ""));
  });

  it("generates a new code when the hash collides", async () => {
    vi.mocked(insertAccessCode)
      .mockRejectedValueOnce(uniqueViolation)
      .mockResolvedValueOnce({ id: CODE_ID });

    const result = await createAccessCodeFormAction(null, form({ recipientName: "BS. B" }));

    expect(result.ok).toBe(true);
    expect(insertAccessCode).toHaveBeenCalledTimes(2);
  });

  it("gives up after three collisions", async () => {
    vi.mocked(insertAccessCode).mockRejectedValue(uniqueViolation);

    const result = await createAccessCodeFormAction(null, form({ recipientName: "BS. B" }));

    expect(result).toMatchObject({ ok: false, error: { code: "INTERNAL" } });
    expect(insertAccessCode).toHaveBeenCalledTimes(3);
  });

  it("Bác sĩ gửi yêu cầu tạo mã: refused with FORBIDDEN, nothing stored", async () => {
    signedInAs(doctor);

    const result = await createAccessCodeFormAction(null, form({ recipientName: "BS. B" }));

    expect(result).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(insertAccessCode).not.toHaveBeenCalled();
  });

  it("Bỏ trống tên người nhận: field error, nothing stored", async () => {
    const result = await createAccessCodeFormAction(null, form({ recipientName: "  " }));

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: "VALIDATION_FAILED",
        fieldErrors: { recipientName: [ADMIN_MESSAGES.recipientRequired] },
      },
    });
    expect(insertAccessCode).not.toHaveBeenCalled();
  });
});

describe("revokeAccessCodeAction", () => {
  beforeEach(() => {
    signedInAs(admin);
    vi.mocked(revokeAccessCode).mockResolvedValue(true);
  });

  it("Huỷ mã còn hạn: revokes the code", async () => {
    await expect(revokeAccessCodeAction({ id: CODE_ID })).resolves.toEqual({
      ok: true,
      data: { id: CODE_ID },
    });
    expect(revokeAccessCode).toHaveBeenCalledWith(CODE_ID);
  });

  it("Huỷ mã vừa được dùng: CONFLICT when the code is no longer active", async () => {
    vi.mocked(revokeAccessCode).mockResolvedValue(false);

    await expect(revokeAccessCodeAction({ id: CODE_ID })).resolves.toEqual({
      ok: false,
      error: { code: "CONFLICT", message: ADMIN_MESSAGES.revokeConflict },
    });
  });

  it("Chưa đăng nhập gửi yêu cầu huỷ mã: refused with UNAUTHENTICATED, nothing changed", async () => {
    signedInAs(null);

    const result = await revokeAccessCodeAction({ id: CODE_ID });

    expect(result).toMatchObject({ ok: false, error: { code: "UNAUTHENTICATED" } });
    expect(revokeAccessCode).not.toHaveBeenCalled();
  });

  it("refuses a doctor with FORBIDDEN", async () => {
    signedInAs(doctor);

    const result = await revokeAccessCodeAction({ id: CODE_ID });

    expect(result).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(revokeAccessCode).not.toHaveBeenCalled();
  });
});

const ACCOUNT_ID = "6f1d2c3b-4a59-4e7f-8a1b-2c3d4e5f6a7b";

describe("lockAccountAction / unlockAccountAction", () => {
  beforeEach(() => {
    signedInAs(admin);
    vi.mocked(setDoctorAccountStatus).mockResolvedValue(true);
  });

  it("Khoá tài khoản đang dùng: locks the doctor account", async () => {
    await expect(lockAccountAction({ id: ACCOUNT_ID })).resolves.toEqual({
      ok: true,
      data: { id: ACCOUNT_ID, status: "locked" },
    });
    expect(setDoctorAccountStatus).toHaveBeenCalledWith(ACCOUNT_ID, "locked");
  });

  it("Mở khoá rồi đăng nhập lại: unlocks the doctor account", async () => {
    await expect(unlockAccountAction({ id: ACCOUNT_ID })).resolves.toEqual({
      ok: true,
      data: { id: ACCOUNT_ID, status: "active" },
    });
    expect(setDoctorAccountStatus).toHaveBeenCalledWith(ACCOUNT_ID, "active");
  });

  it("Khoá tài khoản Admin: no doctor account with that id is NOT_FOUND", async () => {
    vi.mocked(setDoctorAccountStatus).mockResolvedValue(false);

    await expect(lockAccountAction({ id: ACCOUNT_ID })).resolves.toEqual({
      ok: false,
      error: { code: "NOT_FOUND", message: ACCOUNT_MESSAGES.notFound },
    });
  });

  it("Bác sĩ gửi yêu cầu khoá tài khoản khác: FORBIDDEN, nothing changed", async () => {
    signedInAs(doctor);

    const result = await lockAccountAction({ id: ACCOUNT_ID });

    expect(result).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(setDoctorAccountStatus).not.toHaveBeenCalled();
  });

  it("Chưa đăng nhập gửi yêu cầu mở khoá: UNAUTHENTICATED, nothing changed", async () => {
    signedInAs(null);

    const result = await unlockAccountAction({ id: ACCOUNT_ID });

    expect(result).toMatchObject({ ok: false, error: { code: "UNAUTHENTICATED" } });
    expect(setDoctorAccountStatus).not.toHaveBeenCalled();
  });
});

describe("createPasswordResetCodeAction", () => {
  beforeEach(() => {
    signedInAs(admin);
    vi.mocked(issuePasswordResetCode).mockResolvedValue({
      status: "issued",
      displayName: "Nguyễn Thị Lan",
      username: "bs.lan",
    });
  });

  it("Cấp mã đặt lại cho bác sĩ quên mật khẩu: returns the code once, with the username", async () => {
    const result = await createPasswordResetCodeAction({ id: ACCOUNT_ID });

    expect(result).toMatchObject({
      ok: true,
      data: { kind: "password_reset", recipientName: "Nguyễn Thị Lan", username: "bs.lan" },
    });
    if (!result.ok) return;
    expect(result.data.code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    const [accountId, stored] = vi.mocked(issuePasswordResetCode).mock.calls[0]!;
    expect(accountId).toBe(ACCOUNT_ID);
    expect(stored).toMatchObject({
      codeHash: hashAccessCode(result.data.code),
      createdById: "account-admin",
    });
  });

  it("generates a new code when the hash collides", async () => {
    vi.mocked(issuePasswordResetCode)
      .mockRejectedValueOnce(uniqueViolation)
      .mockResolvedValueOnce({ status: "issued", displayName: "Lan", username: "bs.lan" });

    expect((await createPasswordResetCodeAction({ id: ACCOUNT_ID })).ok).toBe(true);
    expect(issuePasswordResetCode).toHaveBeenCalledTimes(2);
  });

  it("answers NOT_FOUND for an unknown or admin account", async () => {
    vi.mocked(issuePasswordResetCode).mockResolvedValue({ status: "not-found" });

    await expect(createPasswordResetCodeAction({ id: ACCOUNT_ID })).resolves.toEqual({
      ok: false,
      error: { code: "NOT_FOUND", message: ACCOUNT_MESSAGES.notFound },
    });
  });

  it("refuses a locked account with CONFLICT", async () => {
    vi.mocked(issuePasswordResetCode).mockResolvedValue({ status: "locked" });

    await expect(createPasswordResetCodeAction({ id: ACCOUNT_ID })).resolves.toEqual({
      ok: false,
      error: { code: "CONFLICT", message: ACCOUNT_MESSAGES.lockedNoReset },
    });
  });

  it("Bác sĩ gửi yêu cầu cấp mã đặt lại: FORBIDDEN, no code created", async () => {
    signedInAs(doctor);

    const result = await createPasswordResetCodeAction({ id: ACCOUNT_ID });

    expect(result).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(issuePasswordResetCode).not.toHaveBeenCalled();
  });
});

describe("deleteAccountAction", () => {
  const request = { id: ACCOUNT_ID, username: "bs.khoa" };

  beforeEach(() => {
    signedInAs(admin);
    vi.mocked(deleteDoctorAccount).mockResolvedValue({
      status: "deleted",
      username: "bs.khoa",
      removedObjects: 2,
    });
  });

  it("Xoá tài khoản cùng toàn bộ dữ liệu: returns the username, logs only id and count", async () => {
    const info = vi.spyOn(logger, "info");

    await expect(deleteAccountAction(request)).resolves.toEqual({
      ok: true,
      data: { username: "bs.khoa" },
    });
    expect(deleteDoctorAccount).toHaveBeenCalledWith(ACCOUNT_ID, "bs.khoa");
    expect(info).toHaveBeenCalledWith("Doctor account deleted", {
      accountId: ACCOUNT_ID,
      removedObjects: 2,
    });
  });

  it("Bác sĩ gửi yêu cầu xoá tài khoản khác: FORBIDDEN, nothing deleted", async () => {
    signedInAs(doctor);

    const result = await deleteAccountAction(request);

    expect(result).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(deleteDoctorAccount).not.toHaveBeenCalled();
  });

  it("Chưa đăng nhập gửi yêu cầu xoá: UNAUTHENTICATED, nothing deleted", async () => {
    signedInAs(null);

    const result = await deleteAccountAction(request);

    expect(result).toMatchObject({ ok: false, error: { code: "UNAUTHENTICATED" } });
    expect(deleteDoctorAccount).not.toHaveBeenCalled();
  });

  it.each([
    [
      "Xoá tài khoản Admin hoặc tài khoản đã xoá",
      "not-found",
      "NOT_FOUND",
      ACCOUNT_MESSAGES.notFound,
    ],
    [
      "Tài khoản vừa được mở khoá ở nơi khác",
      "active",
      "CONFLICT",
      ACCOUNT_MESSAGES.activeNoDelete,
    ],
    [
      "Server từ chối tên đăng nhập không khớp",
      "mismatch",
      "VALIDATION_FAILED",
      ACCOUNT_MESSAGES.usernameMismatch,
    ],
  ] as const)("%s", async (_label, status, code, message) => {
    vi.mocked(deleteDoctorAccount).mockResolvedValue({ status });

    await expect(deleteAccountAction(request)).resolves.toEqual({
      ok: false,
      error: { code, message },
    });
  });

  it("Kho ảnh lỗi: INTERNAL with its own message", async () => {
    vi.spyOn(logger, "error").mockImplementation(() => undefined);
    vi.mocked(deleteDoctorAccount).mockRejectedValue(new Error("storage down"));

    await expect(deleteAccountAction(request)).resolves.toEqual({
      ok: false,
      error: { code: "INTERNAL", message: ACCOUNT_MESSAGES.deleteFailed },
    });
  });

  it("rejects an id that is not a UUID before touching anything", async () => {
    const result = await deleteAccountAction({ id: "bs.khoa", username: "bs.khoa" });

    expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION_FAILED" } });
    expect(deleteDoctorAccount).not.toHaveBeenCalled();
  });
});
