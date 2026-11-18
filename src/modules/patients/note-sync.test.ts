import { beforeEach, describe, expect, it, vi } from "vitest";

import { NOTE_MESSAGES } from "@/modules/patients/constants";
import {
  listNoteDrafts,
  readNoteDraft,
  removeNoteDraft,
  writeNoteDraft,
} from "@/modules/patients/note-drafts";
import {
  deleteNoteAndDraft,
  discardNoteDraft,
  sendAllNoteDrafts,
  sendNoteDraft,
} from "@/modules/patients/note-sync";
import { deleteNoteAction, saveNoteAction } from "@/modules/patients/server/actions";

// In-memory stand-in for IndexedDB.
const memory = new Map<string, unknown>();
vi.mock("idb-keyval", () => ({
  createStore: () => "store",
  get: async (key: string) => memory.get(key),
  set: async (key: string, value: unknown) => void memory.set(key, structuredClone(value)),
  del: async (key: string) => void memory.delete(key),
  entries: async () => [...memory.entries()],
}));
vi.mock("@/modules/patients/server/actions", () => ({
  saveNoteAction: vi.fn(),
  deleteNoteAction: vi.fn(),
}));

const LAN = "account-lan";
const MINH = "account-minh";
const PATIENT = "0b7f8f0e-6a3c-4a8e-9f5c-2d1e0c9b8a76";
const NOTE = "6f1f2c3a-9b8e-4d7c-8a6b-5e4d3c2b1a09";
const OTHER_NOTE = "7a2e3d4b-0c9f-4e8d-9b7c-6f5e4d3c2b1a";

type DraftOverrides = {
  accountId?: string;
  patientId?: string;
  noteId?: string;
  editing?: boolean;
};

const draft = (content: string, overrides: DraftOverrides = {}) =>
  writeNoteDraft({
    accountId: overrides.accountId ?? LAN,
    patientId: overrides.patientId ?? PATIENT,
    noteId: overrides.noteId ?? NOTE,
    editing: overrides.editing ?? false,
    content,
  });

function savedAs(content: string) {
  return {
    ok: true as const,
    data: {
      id: NOTE,
      content,
      createdAt: "2026-11-18T02:12:00.000Z",
      updatedAt: "2026-11-18T02:12:00.000Z",
    },
  };
}

beforeEach(() => {
  memory.clear();
  vi.mocked(saveNoteAction).mockImplementation(async (input) => savedAs(input.content ?? ""));
  vi.mocked(deleteNoteAction).mockResolvedValue({ ok: true, data: { deleted: true } });
});

describe("note drafts", () => {
  it("Đổi tài khoản trên cùng trình duyệt: another account never reads the draft", async () => {
    await draft("HA 150/90");

    expect(await readNoteDraft(LAN, NOTE)).toMatchObject({ content: "HA 150/90" });
    expect(await readNoteDraft(MINH, NOTE)).toBeNull();
    expect(await listNoteDrafts(MINH)).toEqual([]);
    expect(await listNoteDrafts(LAN, PATIENT)).toHaveLength(1);
  });

  it("ignores a corrupt or older-format entry instead of trusting it", async () => {
    memory.set(`${LAN}/${NOTE}`, { v: 0, content: 42 });
    memory.set(`${LAN}/broken`, "not an object");

    expect(await readNoteDraft(LAN, NOTE)).toBeNull();
    expect(await listNoteDrafts(LAN)).toEqual([]);
  });

  it("filters by patient", async () => {
    await draft("A");
    await draft("B", { noteId: OTHER_NOTE, patientId: "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f" });

    expect((await listNoteDrafts(LAN, PATIENT)).map((d) => d.content)).toEqual(["A"]);
  });
});

describe("sendNoteDraft", () => {
  it("Tự lưu khi ngừng gõ: sends the draft, then removes it", async () => {
    await draft("HA 150/90");

    await expect(sendNoteDraft(LAN, NOTE)).resolves.toMatchObject({
      status: "saved",
      pending: false,
    });
    expect(saveNoteAction).toHaveBeenCalledWith({
      patientId: PATIENT,
      noteId: NOTE,
      content: "HA 150/90",
      editing: false,
    });
    expect(await readNoteDraft(LAN, NOTE)).toBeNull();
  });

  it("keeps the draft and sends again when the text changed while sending", async () => {
    await draft("HA 150/90");
    vi.mocked(saveNoteAction).mockImplementationOnce(async (input) => {
      await draft("HA 150/90, tăng liều"); // typed during the request
      return savedAs(input.content ?? "");
    });

    await expect(sendNoteDraft(LAN, NOTE)).resolves.toMatchObject({
      status: "saved",
      content: "HA 150/90, tăng liều",
      pending: false,
    });
    expect(vi.mocked(saveNoteAction).mock.calls.map(([input]) => input.content)).toEqual([
      "HA 150/90",
      "HA 150/90, tăng liều",
    ]);
    expect(await readNoteDraft(LAN, NOTE)).toBeNull();
  });

  it("Mất mạng khi đang ghi: a failed call keeps the draft", async () => {
    await draft("HA 150/90");
    vi.mocked(saveNoteAction).mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await expect(sendNoteDraft(LAN, NOTE)).resolves.toEqual({ status: "offline" });
    expect(await readNoteDraft(LAN, NOTE)).toMatchObject({ content: "HA 150/90" });
  });

  it("keeps the draft when the server refuses it (NOT_FOUND)", async () => {
    await draft("HA 150/90");
    vi.mocked(saveNoteAction).mockResolvedValueOnce({
      ok: false,
      error: { code: "NOT_FOUND", message: NOTE_MESSAGES.notFound },
    });

    await expect(sendNoteDraft(LAN, NOTE)).resolves.toMatchObject({
      status: "error",
      error: { code: "NOT_FOUND" },
    });
    expect(await readNoteDraft(LAN, NOTE)).not.toBeNull();
  });

  it("never calls the server for an empty or too-long draft", async () => {
    await draft("   ");
    await expect(sendNoteDraft(LAN, NOTE)).resolves.toEqual({ status: "nothing" });
    await draft("a".repeat(5001));
    await expect(sendNoteDraft(LAN, NOTE)).resolves.toEqual({ status: "too-long" });
    expect(saveNoteAction).not.toHaveBeenCalled();
    expect(await readNoteDraft(LAN, NOTE)).not.toBeNull();
  });

  it("runs concurrent sends of one note one after the other, the later with the newest text", async () => {
    await draft("v1");
    let inFlight = 0;
    let maxInFlight = 0;
    let releaseFirst: () => void = () => undefined;
    const firstHeld = new Promise<void>((resolve) => (releaseFirst = resolve));
    vi.mocked(saveNoteAction).mockImplementation(async (input) => {
      maxInFlight = Math.max(maxInFlight, ++inFlight);
      if (input.content === "v1") await firstHeld; // the first request is slow
      inFlight--;
      return savedAs(input.content ?? "");
    });

    const first = sendNoteDraft(LAN, NOTE);
    await vi.waitFor(() => expect(saveNoteAction).toHaveBeenCalledTimes(1));
    await draft("v2"); // typed while v1 is in flight
    const second = sendNoteDraft(LAN, NOTE);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(saveNoteAction).toHaveBeenCalledTimes(1); // the second waits for the first
    releaseFirst();
    await Promise.all([first, second]);

    expect(maxInFlight).toBe(1);
    expect(vi.mocked(saveNoteAction).mock.calls.map(([input]) => input.content)).toEqual([
      "v1",
      "v2",
    ]);
    expect(await readNoteDraft(LAN, NOTE)).toBeNull();
  });

  it("sends from memory when the device storage has no draft (blocked or full)", async () => {
    const current = { patientId: PATIENT, noteId: NOTE, editing: false, content: "HA 150/90" };

    await expect(sendNoteDraft(LAN, NOTE, { current })).resolves.toMatchObject({
      status: "saved",
      content: "HA 150/90",
    });
    expect(saveNoteAction).toHaveBeenCalledWith({
      patientId: PATIENT,
      noteId: NOTE,
      content: "HA 150/90",
      editing: false,
    });
  });

  it("reports a slow request, and keeps the lock until it settles", async () => {
    vi.useFakeTimers();
    try {
      await draft("v1");
      let release: () => void = () => undefined;
      vi.mocked(saveNoteAction).mockImplementationOnce(async (input) => {
        await new Promise<void>((resolve) => (release = resolve));
        return savedAs(input.content ?? "");
      });
      const onSlow = vi.fn();

      const send = sendNoteDraft(LAN, NOTE, { onSlow });
      await vi.waitFor(() => expect(saveNoteAction).toHaveBeenCalledTimes(1));
      await vi.advanceTimersByTimeAsync(15_000);
      expect(onSlow).toHaveBeenCalledTimes(1);
      const later = sendNoteDraft(LAN, NOTE);
      await vi.advanceTimersByTimeAsync(10);
      expect(saveNoteAction).toHaveBeenCalledTimes(1);

      release();
      await expect(send).resolves.toMatchObject({ status: "saved" });
      await later;
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("sendAllNoteDrafts", () => {
  it("Rời trang khi chưa gửi được: sends every draft of the account, and only of it", async () => {
    await draft("A");
    await draft("B", { noteId: OTHER_NOTE });
    await draft("C", { accountId: MINH });

    await sendAllNoteDrafts(LAN);

    expect(
      vi
        .mocked(saveNoteAction)
        .mock.calls.map(([input]) => input.content)
        .sort(),
    ).toEqual(["A", "B"]);
    expect(await listNoteDrafts(MINH)).toHaveLength(1);
  });
});

describe("discard and delete", () => {
  it("discards a draft without sending it", async () => {
    await draft("");
    await discardNoteDraft(LAN, NOTE);
    expect(await readNoteDraft(LAN, NOTE)).toBeNull();
    expect(saveNoteAction).not.toHaveBeenCalled();
  });

  it("Xoá ghi chú: deletes the note and its draft", async () => {
    await draft("HA 150/90", { editing: true });

    await expect(deleteNoteAndDraft(LAN, PATIENT, NOTE)).resolves.toEqual({ ok: true });
    expect(deleteNoteAction).toHaveBeenCalledWith({ patientId: PATIENT, noteId: NOTE });
    expect(await readNoteDraft(LAN, NOTE)).toBeNull();
  });

  it("keeps the draft when the delete cannot reach the server", async () => {
    await draft("HA 150/90", { editing: true });
    vi.mocked(deleteNoteAction).mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await expect(deleteNoteAndDraft(LAN, PATIENT, NOTE)).resolves.toMatchObject({
      ok: false,
      error: { message: NOTE_MESSAGES.deleteFailedOffline },
    });
    expect(await readNoteDraft(LAN, NOTE)).not.toBeNull();
    await removeNoteDraft(LAN, NOTE);
  });
});
