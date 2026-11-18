import type { ActionError } from "@/lib/errors";
import {
  NOTE_LIMITS,
  NOTE_MESSAGES,
  NOTE_SLOW_SEND_MS,
  TRASH_RETENTION_DAYS,
} from "@/modules/patients/constants";
import {
  listNoteDrafts,
  type NoteDraft,
  noteDraftKey,
  readNoteDraft,
  removeNoteDraft,
} from "@/modules/patients/note-drafts";
import { deleteNoteAction, saveNoteAction } from "@/modules/patients/server/actions";
import type { PatientNote } from "@/modules/patients/types";

/**
 * The ONLY way a note draft reaches the server (design §4). The composer, the background
 * `NoteDraftSync` and the "back online" retries all go through `sendNoteDraft`, which holds a
 * per-note lock and always sends the LATEST draft read inside that lock: an older send can never
 * land after a newer one, even across tabs. A draft is removed only once the server has stored
 * exactly that content.
 */

export type NoteSendResult =
  | { status: "saved"; note: PatientNote; content: string; pending: boolean }
  /** No draft (already sent) or an empty one: nothing to send. */
  | { status: "nothing" }
  | { status: "offline" }
  | { status: "too-long" }
  | { status: "error"; error: ActionError };

/** Fired on `window` after a draft was stored, so an open notes section can update itself. */
export const NOTE_SAVED_EVENT = "doctor-handbook:note-saved";
export type NoteSavedDetail = { patientId: string; note: PatientNote; pending: boolean };

/** Same normalization as the server schema: NFC, then trimmed. */
export function normalizeNoteContent(content: string): string {
  return content.normalize("NFC").trim();
}

export function isNoteTooLong(content: string): boolean {
  return normalizeNoteContent(content).length > NOTE_LIMITS.content;
}

const tails = new Map<string, Promise<unknown>>();

/**
 * Runs `work` exclusively per key: Web Locks when available (also across tabs; Chrome, Safari
 * 15.4+), otherwise a promise queue within this tab.
 */
function withNoteLock<T>(key: string, work: () => Promise<T>): Promise<T> {
  const locks = typeof navigator === "undefined" ? undefined : navigator.locks;
  if (locks?.request) return locks.request(`note-draft:${key}`, work);

  const run = (tails.get(key) ?? Promise.resolve()).then(work, work);
  const cleanup = () => {
    if (tails.get(key) === run) tails.delete(key);
  };
  tails.set(key, run);
  run.then(cleanup, cleanup);
  return run;
}

type SendOptions = {
  /**
   * What the open composer shows. Used when the device storage has no draft (IndexedDB blocked
   * or full, or a write failed): the text is then sent from memory instead of being dropped.
   */
  current?: Omit<NoteDraft, "v" | "savedAt" | "accountId">;
  /** Called once when the server has not answered after a while (shown as "Đang chờ mạng"). */
  onSlow?: () => void;
};

/**
 * Sends one draft. Up to a few rounds when the text changed while it was being sent. A slow
 * request keeps the lock until it settles: releasing it early would let this older content
 * reach the server after a newer send.
 */
export function sendNoteDraft(
  accountId: string,
  noteId: string,
  { current, onSlow }: SendOptions = {},
): Promise<NoteSendResult> {
  return withNoteLock(noteDraftKey(accountId, noteId), async () => {
    let last: NoteSendResult = { status: "nothing" };
    for (let round = 0; round < 3; round++) {
      const stored = await readNoteDraft(accountId, noteId);
      const draft = stored ?? (round === 0 && current ? { ...current, accountId } : null);
      if (!draft || !normalizeNoteContent(draft.content)) return last;
      if (isNoteTooLong(draft.content)) return { status: "too-long" };

      let result: Awaited<ReturnType<typeof saveNoteAction>>;
      const slow = onSlow ? setTimeout(onSlow, NOTE_SLOW_SEND_MS) : undefined;
      try {
        result = await saveNoteAction({
          patientId: draft.patientId,
          noteId: draft.noteId,
          content: draft.content,
          editing: draft.editing,
        });
      } catch {
        // The request or its answer was lost: the network. The draft stays.
        return { status: "offline" };
      } finally {
        clearTimeout(slow);
      }
      if (!result.ok) return { status: "error", error: result.error };

      const latest = await readNoteDraft(accountId, noteId);
      const pending = latest !== null && latest.content !== draft.content;
      if (!pending && stored) await removeNoteDraft(accountId, noteId);
      last = { status: "saved", note: result.data, content: draft.content, pending };
      announceSaved({ patientId: draft.patientId, note: result.data, pending });
      if (!pending) return last;
    }
    return last;
  });
}

function announceSaved(detail: NoteSavedDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<NoteSavedDetail>(NOTE_SAVED_EVENT, { detail }));
}

/** A refused draft older than the trash retention can never be saved: its patient is gone. */
const ORPHAN_DRAFT_MS = (TRASH_RETENTION_DAYS + 1) * 24 * 60 * 60 * 1000;

/** Sends every pending draft of an account (background sync, design §4). */
export async function sendAllNoteDrafts(accountId: string): Promise<void> {
  for (const draft of await listNoteDrafts(accountId)) {
    const result = await sendNoteDraft(accountId, draft.noteId);
    // Still offline: the others would fail the same way; the next `online` event retries.
    if (result.status === "offline") return;
    // Refused for longer than a patient can stay in the trash: deleted for good (cron, another
    // device). Dropping it stops endless re-sends; nothing could ever store it again.
    if (
      result.status === "error" &&
      result.error.code === "NOT_FOUND" &&
      Date.now() - draft.savedAt > ORPHAN_DRAFT_MS
    ) {
      await discardNoteDraft(accountId, draft.noteId);
    }
  }
}

/** Drops a draft without sending it (an empty note closed with "Xong"). */
export function discardNoteDraft(accountId: string, noteId: string): Promise<void> {
  return withNoteLock(noteDraftKey(accountId, noteId), () => removeNoteDraft(accountId, noteId));
}

export type NoteDeleteResult =
  { ok: true } | { ok: false; error: Pick<ActionError, "code" | "message"> };

/** Deletes a stored note and its draft, under the note's lock so no send races the delete. */
export function deleteNoteAndDraft(
  accountId: string,
  patientId: string,
  noteId: string,
): Promise<NoteDeleteResult> {
  return withNoteLock(noteDraftKey(accountId, noteId), async () => {
    let result: Awaited<ReturnType<typeof deleteNoteAction>>;
    try {
      result = await deleteNoteAction({ patientId, noteId });
    } catch {
      return { ok: false, error: { code: "INTERNAL", message: NOTE_MESSAGES.deleteFailedOffline } };
    }
    if (!result.ok) return { ok: false, error: result.error };
    await removeNoteDraft(accountId, noteId);
    return { ok: true };
  });
}
