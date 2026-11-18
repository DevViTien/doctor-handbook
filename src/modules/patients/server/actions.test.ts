import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { NOTE_MESSAGES, PATIENT_MESSAGES } from "@/modules/patients/constants";
import { PATIENT_FIELD_NAMES as F } from "@/modules/patients/schemas";
import {
  createPatientFormAction,
  deleteNoteAction,
  deletePermanentlyAction,
  moveToTrashAction,
  prepareAvatarUploadAction,
  removeAvatarAction,
  restoreFromTrashAction,
  saveNoteAction,
  setAvatarAction,
  updatePatientFormAction,
} from "@/modules/patients/server/actions";
import {
  deleteNote,
  deletePermanently,
  insertPatient,
  moveToTrash,
  restoreFromTrash,
  saveNote,
  setAvatar,
  updatePatient,
} from "@/modules/patients/server/mutations";
import { getPatient } from "@/modules/patients/server/queries";
import { getSessionToken } from "@/server/auth/cookies";
import { type AuthContext, validateSessionToken } from "@/server/auth/session";
import { removeAvatarsQuietly } from "@/server/storage/objects";

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
  setAvatar: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/storage/objects", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createSignedUploadUrl: vi.fn(async () => ({
    signedUrl: "https://storage/upload",
    token: "t",
    path: "p",
  })),
  removeAvatarsQuietly: vi.fn(async () => undefined),
}));
vi.mock("@/modules/patients/server/queries", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getPatient: vi.fn(),
}));
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
    vi.mocked(moveToTrash).mockResolvedValue(true);
    vi.mocked(restoreFromTrash).mockResolvedValue(true);
    vi.mocked(deletePermanently).mockResolvedValue({ avatarPath: null });
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
      (vi.mocked(mutation) as unknown as Mock).mockResolvedValue(
        mutation === deletePermanently ? null : false,
      );

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

describe("avatar actions", () => {
  const OTHER_ACCOUNT = "0a1c1b0e-6c1a-4c37-9d55-1f0a8c1e2b3d";
  const MINH_ACCOUNT = "7b1c1b0e-6c1a-4c37-9d55-1f0a8c1e2b3d";
  const minhUuid: AuthContext = { ...minh, account: { ...minh.account, id: MINH_ACCOUNT } };
  const name = "0123456789abcdef0123456789abcdef";

  it("prepare: a fresh path under the session's account, only for its own patient", async () => {
    signedInAs(minhUuid);
    vi.mocked(getPatient).mockResolvedValue({ id: PATIENT_ID } as never);
    const result = await prepareAvatarUploadAction({ patientId: PATIENT_ID, format: "webp" });
    expect(result).toMatchObject({ ok: true, data: { uploadUrl: "https://storage/upload" } });
    expect(result.ok && result.data.path).toMatch(
      new RegExp(`^${MINH_ACCOUNT}/[0-9a-f]{32}[.]webp$`),
    );

    vi.mocked(getPatient).mockResolvedValue(null);
    expect(
      await prepareAvatarUploadAction({ patientId: PATIENT_ID, format: "webp" }),
    ).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
  });

  it("Gắn ảnh của tài khoản khác: a path outside the account is refused", async () => {
    signedInAs(minhUuid);
    for (const path of [`${OTHER_ACCOUNT}/${name}.webp`, `${MINH_ACCOUNT}/../${name}.webp`]) {
      expect(await setAvatarAction({ patientId: PATIENT_ID, path })).toMatchObject({
        ok: false,
        error: { code: "VALIDATION_FAILED" },
      });
    }
    expect(setAvatar).not.toHaveBeenCalled();
  });

  it("set: attaches the picture and deletes the previous one", async () => {
    signedInAs(minhUuid);
    vi.mocked(setAvatar).mockResolvedValue({ previous: `${MINH_ACCOUNT}/${"f".repeat(32)}.webp` });
    const path = `${MINH_ACCOUNT}/${name}.webp`;
    expect(await setAvatarAction({ patientId: PATIENT_ID, path })).toEqual({
      ok: true,
      data: { avatarUrl: `/api/patients/${PATIENT_ID}/avatar?v=${name}` },
    });
    expect(setAvatar).toHaveBeenCalledWith(minhUuid, PATIENT_ID, path);
    expect(removeAvatarsQuietly).toHaveBeenCalledWith([`${MINH_ACCOUNT}/${"f".repeat(32)}.webp`]);
  });

  it("set / remove: another doctor's patient is NOT_FOUND", async () => {
    signedInAs(minhUuid);
    vi.mocked(setAvatar).mockResolvedValue(undefined);
    expect(
      await setAvatarAction({ patientId: PATIENT_ID, path: `${MINH_ACCOUNT}/${name}.webp` }),
    ).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    expect(await removeAvatarAction({ patientId: PATIENT_ID })).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
  });

  it.each([
    ["not signed in", null, "UNAUTHENTICATED"],
    ["an Admin", admin, "FORBIDDEN"],
  ])("%s cannot touch avatars", async (_label, auth, code) => {
    signedInAs(auth);
    for (const result of [
      await prepareAvatarUploadAction({ patientId: PATIENT_ID, format: "webp" }),
      await setAvatarAction({ patientId: PATIENT_ID, path: `${MINH_ACCOUNT}/${name}.webp` }),
      await removeAvatarAction({ patientId: PATIENT_ID }),
    ]) {
      expect(result).toMatchObject({ ok: false, error: { code } });
    }
    expect(setAvatar).not.toHaveBeenCalled();
  });
});
