import { beforeEach, describe, expect, it, vi } from "vitest";

import { PATIENT_MESSAGES } from "@/modules/patients/constants";
import { PATIENT_FIELD_NAMES as F } from "@/modules/patients/schemas";
import {
  createPatientFormAction,
  updatePatientFormAction,
} from "@/modules/patients/server/actions";
import { insertPatient, updatePatient } from "@/modules/patients/server/mutations";
import { getSessionToken } from "@/server/auth/cookies";
import { type AuthContext, validateSessionToken } from "@/server/auth/session";

// Real guards (requireAccess), fake session lookup: tests the access rule end to end.
vi.mock("@/server/auth/cookies", () => ({ getSessionToken: vi.fn() }));
vi.mock("@/server/auth/session", () => ({ validateSessionToken: vi.fn() }));
vi.mock("@/modules/patients/server/mutations", () => ({
  insertPatient: vi.fn(),
  updatePatient: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

const PATIENT_ID = "0b7f8f0e-6a3c-4a8e-9f5c-2d1e0c9b8a76";
const VERSION = "2026-11-18T03:00:00.123Z";

const minh: AuthContext = {
  sessionId: "s-minh",
  account: { id: "account-minh", role: "doctor", username: "bs.minh", displayName: "BS. Minh" },
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

const newPatient = form({ [F.fullName]: "Nguyễn Văn An", accountId: "account-lan" });
const edit = form({ [F.fullName]: "Nguyễn Văn Ân", patientId: PATIENT_ID, version: VERSION });

beforeEach(() => {
  vi.mocked(insertPatient).mockResolvedValue(PATIENT_ID);
  vi.mocked(updatePatient).mockResolvedValue("updated");
});

describe("createPatientFormAction", () => {
  it("adds the patient to the session's own account, ignoring any account id sent", async () => {
    signedInAs(minh);

    await expect(createPatientFormAction(null, newPatient)).resolves.toEqual({
      ok: true,
      data: { id: PATIENT_ID },
    });
    expect(insertPatient).toHaveBeenCalledWith(
      minh,
      expect.objectContaining({ fullName: "Nguyễn Văn An" }),
    );
  });

  it("Chưa đăng nhập gửi lệnh thêm bệnh nhân", async () => {
    signedInAs(null);

    await expect(createPatientFormAction(null, newPatient)).resolves.toMatchObject({
      ok: false,
      error: { code: "UNAUTHENTICATED" },
    });
    expect(insertPatient).not.toHaveBeenCalled();
  });

  it("Admin gửi lệnh thêm bệnh nhân", async () => {
    signedInAs(admin);

    await expect(createPatientFormAction(null, newPatient)).resolves.toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
    expect(insertPatient).not.toHaveBeenCalled();
  });

  it("Thiếu họ tên: field error, nothing written", async () => {
    signedInAs(minh);

    await expect(createPatientFormAction(null, form({ [F.fullName]: " " }))).resolves.toMatchObject(
      {
        ok: false,
        error: {
          code: "VALIDATION_FAILED",
          fieldErrors: { [F.fullName]: [PATIENT_MESSAGES.fullNameRequired] },
        },
      },
    );
    expect(insertPatient).not.toHaveBeenCalled();
  });
});

describe("updatePatientFormAction", () => {
  it("updates within the session's account with the loaded version", async () => {
    signedInAs(minh);

    await expect(updatePatientFormAction(null, edit)).resolves.toEqual({
      ok: true,
      data: { id: PATIENT_ID },
    });
    expect(updatePatient).toHaveBeenCalledWith(
      minh,
      PATIENT_ID,
      VERSION,
      expect.objectContaining({ fullName: "Nguyễn Văn Ân" }),
    );
  });

  it("Sửa bệnh nhân của bác sĩ khác: NOT_FOUND", async () => {
    signedInAs(minh);
    vi.mocked(updatePatient).mockResolvedValue("not-found");

    await expect(updatePatientFormAction(null, edit)).resolves.toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND", message: PATIENT_MESSAGES.notFound },
    });
  });

  it("Sửa cùng lúc ở hai thiết bị: CONFLICT with the reload message", async () => {
    signedInAs(minh);
    vi.mocked(updatePatient).mockResolvedValue("stale");

    await expect(updatePatientFormAction(null, edit)).resolves.toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: PATIENT_MESSAGES.changedElsewhere },
    });
  });

  it("Admin gửi lệnh sửa bệnh nhân", async () => {
    signedInAs(admin);

    await expect(updatePatientFormAction(null, edit)).resolves.toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
    expect(updatePatient).not.toHaveBeenCalled();
  });
});
