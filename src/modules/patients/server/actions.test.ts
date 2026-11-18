import { beforeEach, describe, expect, it, vi } from "vitest";

import { NOTE_MESSAGES, PATIENT_MESSAGES } from "@/modules/patients/constants";
import { PATIENT_FIELD_NAMES as F } from "@/modules/patients/schemas";
import {
  createPatientFormAction,
  deleteNoteAction,
  deletePermanentlyAction,
  moveToTrashAction,
  restoreFromTrashAction,
  saveNoteAction,
  updatePatientFormAction,
} from "@/modules/patients/server/actions";
import {
  deleteNote,
  deletePermanently,
  insertPatient,
  moveToTrash,
  restoreFromTrash,
  saveNote,
  updatePatient,
} from "@/modules/patients/server/mutations";
import { getSessionToken } from "@/server/auth/cookies";
import { type AuthContext, validateSessionToken } from "@/server/auth/session";

// Real guards (requireAccess), fake session lookup: tests the access rule end to end.
vi.mock("@/server/auth/cookies", () => ({ getSessionToken: vi.fn() }));
vi.mock("@/server/auth/session", () => ({ validateSessionToken: vi.fn() }));
vi.mock("@/modules/patients/server/mutations", () => ({
  insertPatient: vi.fn(),
  updatePatient: vi.fn(),
  saveNote: vi.fn(),
  deleteNote: vi.fn(),
  moveToTrash: vi.fn(),
  restoreFromTrash: vi.fn(),
  deletePermanently: vi.fn(),
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

const NOTE_ID = "6f1f2c3a-9b8e-4d7c-8a6b-5e4d3c2b1a09";
const savedNote = {
  id: NOTE_ID,
  content: "HA 150/90",
  createdAt: "2026-11-18T02:12:00.000Z",
  updatedAt: "2026-11-18T02:12:00.000Z",
};
const noteInput = {
  patientId: PATIENT_ID,
  noteId: NOTE_ID,
  content: " HA 150/90 ",
  editing: false,
};

describe("saveNoteAction", () => {
  beforeEach(() => {
    vi.mocked(saveNote).mockResolvedValue(savedNote);
    vi.mocked(deleteNote).mockResolvedValue(true);
  });

  it("saves into the session's own account, trimmed, ignoring any account id sent", async () => {
    signedInAs(minh);

    await expect(
      saveNoteAction({ ...noteInput, accountId: "account-lan" } as typeof noteInput),
    ).resolves.toEqual({ ok: true, data: savedNote });
    expect(saveNote).toHaveBeenCalledWith(minh, {
      patientId: PATIENT_ID,
      noteId: NOTE_ID,
      content: "HA 150/90",
      editing: false,
    });
  });

  it("Ghi vào bệnh nhân của bác sĩ khác: no row written means NOT_FOUND", async () => {
    signedInAs(minh);
    vi.mocked(saveNote).mockResolvedValue(null);

    await expect(saveNoteAction(noteInput)).resolves.toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND", message: NOTE_MESSAGES.notFound },
    });
  });

  it("Chưa đăng nhập hoặc Admin gửi lệnh lưu ghi chú", async () => {
    signedInAs(null);
    await expect(saveNoteAction(noteInput)).resolves.toMatchObject({
      ok: false,
      error: { code: "UNAUTHENTICATED" },
    });
    signedInAs(admin);
    await expect(saveNoteAction(noteInput)).resolves.toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
    expect(saveNote).not.toHaveBeenCalled();
  });

  it("Ghi chú quá dài, or empty: refused before reaching the database", async () => {
    signedInAs(minh);

    await expect(
      saveNoteAction({ ...noteInput, content: "a".repeat(5001) }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "VALIDATION_FAILED", fieldErrors: { content: [NOTE_MESSAGES.tooLong] } },
    });
    await expect(saveNoteAction({ ...noteInput, content: "   " })).resolves.toMatchObject({
      ok: false,
      error: { code: "VALIDATION_FAILED", fieldErrors: { content: [NOTE_MESSAGES.empty] } },
    });
    await expect(saveNoteAction({ ...noteInput, noteId: "not-a-uuid" })).resolves.toMatchObject({
      ok: false,
      error: { code: "VALIDATION_FAILED" },
    });
    expect(saveNote).not.toHaveBeenCalled();
  });
});

describe("deleteNoteAction", () => {
  beforeEach(() => vi.mocked(deleteNote).mockResolvedValue(true));

  it("deletes within the session's account", async () => {
    signedInAs(minh);

    await expect(deleteNoteAction({ patientId: PATIENT_ID, noteId: NOTE_ID })).resolves.toEqual({
      ok: true,
      data: { deleted: true },
    });
    expect(deleteNote).toHaveBeenCalledWith(minh, { patientId: PATIENT_ID, noteId: NOTE_ID });
  });

  it("reports NOT_FOUND when nothing was deleted", async () => {
    signedInAs(minh);
    vi.mocked(deleteNote).mockResolvedValue(false);

    await expect(
      deleteNoteAction({ patientId: PATIENT_ID, noteId: NOTE_ID }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
  });

  it("refuses an admin", async () => {
    signedInAs(admin);

    await expect(
      deleteNoteAction({ patientId: PATIENT_ID, noteId: NOTE_ID }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
    expect(deleteNote).not.toHaveBeenCalled();
  });
});

describe("trash actions", () => {
  const actions = [
    ["moveToTrashAction", moveToTrashAction, moveToTrash],
    ["restoreFromTrashAction", restoreFromTrashAction, restoreFromTrash],
    ["deletePermanentlyAction", deletePermanentlyAction, deletePermanently],
  ] as const;

  beforeEach(() => {
    for (const [, , mutation] of actions) vi.mocked(mutation).mockResolvedValue(true);
  });

  it.each(actions)(
    "%s acts on the session's own account, ignoring any account id sent",
    async (_name, action, mutation) => {
      signedInAs(minh);

      await expect(
        action({ patientId: PATIENT_ID, accountId: "account-lan" } as { patientId: string }),
      ).resolves.toMatchObject({ ok: true });
      expect(mutation).toHaveBeenCalledWith(minh, PATIENT_ID);
    },
  );

  it.each(actions)(
    "Xoá bệnh nhân của bác sĩ khác: %s reports NOT_FOUND",
    async (_name, action, mutation) => {
      signedInAs(minh);
      vi.mocked(mutation).mockResolvedValue(false);

      await expect(action({ patientId: PATIENT_ID })).resolves.toMatchObject({
        ok: false,
        error: { code: "NOT_FOUND", message: PATIENT_MESSAGES.notFound },
      });
    },
  );

  it("Chưa đăng nhập hoặc Admin gửi lệnh xoá", async () => {
    signedInAs(null);
    await expect(moveToTrashAction({ patientId: PATIENT_ID })).resolves.toMatchObject({
      ok: false,
      error: { code: "UNAUTHENTICATED" },
    });
    signedInAs(admin);
    await expect(moveToTrashAction({ patientId: PATIENT_ID })).resolves.toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
    expect(moveToTrash).not.toHaveBeenCalled();
  });

  it("refuses an id that is not a UUID", async () => {
    signedInAs(minh);
    await expect(moveToTrashAction({ patientId: "1 OR 1=1" })).resolves.toMatchObject({
      ok: false,
      error: { code: "VALIDATION_FAILED" },
    });
    expect(moveToTrash).not.toHaveBeenCalled();
  });
});
