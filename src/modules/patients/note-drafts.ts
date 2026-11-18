import { createStore, del, entries, get, set, type UseStore } from "idb-keyval";
import { z } from "zod";

/**
 * Note drafts kept on the doctor's device until the server confirms them (spec patient-notes
 * "Không mất ghi chú đang gõ", design §3). Browser-only: IndexedDB through `idb-keyval`
 * (teckstack.md §4.9). Keys are `${accountId}/${noteId}`, so an account never reads another
 * account's drafts on a shared browser. Everything read back is validated: a corrupt or
 * older-format entry is ignored, never trusted.
 *
 * Every function swallows storage errors (private mode, quota, blocked IndexedDB): the
 * composer then still autosaves from memory, it only loses the "survives a closed tab" part.
 */

const noteDraftSchema = z.object({
  v: z.literal(1),
  accountId: z.string().min(1),
  patientId: z.uuid(),
  noteId: z.uuid(),
  /** Opened with "Sửa" on an existing note (design §2). */
  editing: z.boolean(),
  content: z.string(),
  savedAt: z.number(),
});

export type NoteDraft = z.infer<typeof noteDraftSchema>;

let store: UseStore | undefined;
function draftStore(): UseStore {
  store ??= createStore("doctor-handbook", "note-drafts");
  return store;
}

export function noteDraftKey(accountId: string, noteId: string): string {
  return `${accountId}/${noteId}`;
}

function parseDraft(value: unknown, accountId: string): NoteDraft | null {
  const parsed = noteDraftSchema.safeParse(value);
  return parsed.success && parsed.data.accountId === accountId ? parsed.data : null;
}

export async function readNoteDraft(accountId: string, noteId: string): Promise<NoteDraft | null> {
  try {
    return parseDraft(await get(noteDraftKey(accountId, noteId), draftStore()), accountId);
  } catch {
    return null;
  }
}

/** Writes (replaces) a draft. `false` when the device storage is unavailable. */
export async function writeNoteDraft(draft: Omit<NoteDraft, "v" | "savedAt">): Promise<boolean> {
  try {
    const value: NoteDraft = { ...draft, v: 1, savedAt: Date.now() };
    await set(noteDraftKey(draft.accountId, draft.noteId), value, draftStore());
    return true;
  } catch {
    return false;
  }
}

export async function removeNoteDraft(accountId: string, noteId: string): Promise<void> {
  try {
    await del(noteDraftKey(accountId, noteId), draftStore());
  } catch {
    // Nothing to do: the draft simply stays and is sent (idempotently) again later.
  }
}

/** Drafts of one account, optionally of one patient, oldest first. */
export async function listNoteDrafts(accountId: string, patientId?: string): Promise<NoteDraft[]> {
  try {
    const prefix = noteDraftKey(accountId, "");
    return (await entries(draftStore()))
      .filter(([key]) => typeof key === "string" && key.startsWith(prefix))
      .map(([, value]) => parseDraft(value, accountId))
      .filter((draft): draft is NoteDraft => draft !== null)
      .filter((draft) => patientId === undefined || draft.patientId === patientId)
      .sort((a, b) => a.savedAt - b.savedAt);
  } catch {
    return [];
  }
}
