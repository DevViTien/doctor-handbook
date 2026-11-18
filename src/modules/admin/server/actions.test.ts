import { beforeEach, describe, expect, it, vi } from "vitest";

import { ADMIN_MESSAGES } from "@/modules/admin/constants";
import { createAccessCodeFormAction, revokeAccessCodeAction } from "@/modules/admin/server/actions";
import { insertAccessCode, revokeAccessCode } from "@/modules/admin/server/mutations";
import { ACCESS_CODE_ALPHABET, ACCESS_CODE_TTL_MS } from "@/server/auth/constants";
import { getSessionToken } from "@/server/auth/cookies";
import { hashAccessCode } from "@/server/auth/crypto";
import { type AuthContext, validateSessionToken } from "@/server/auth/session";

// Real guards (requireAccess), fake session lookup: tests the access rules end to end.
vi.mock("@/server/auth/cookies", () => ({ getSessionToken: vi.fn() }));
vi.mock("@/server/auth/session", () => ({ validateSessionToken: vi.fn() }));
vi.mock("@/modules/admin/server/mutations", () => ({
  insertAccessCode: vi.fn(),
  revokeAccessCode: vi.fn(),
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
