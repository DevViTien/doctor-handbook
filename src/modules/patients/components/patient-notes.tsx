"use client";

import { PlusIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { formatDateTime } from "@/lib/date/format";
import {
  type ComposerCloseResult,
  type ComposerSession,
  NoteComposer,
} from "@/modules/patients/components/note-composer";
import { NoteItem } from "@/modules/patients/components/note-item";
import { listNoteDrafts } from "@/modules/patients/note-drafts";
import {
  normalizeNoteContent,
  NOTE_SAVED_EVENT,
  type NoteSavedDetail,
} from "@/modules/patients/note-sync";
import type { PatientNote } from "@/modules/patients/types";

type PatientNotesProps = {
  /** The signed-in account, to find ITS drafts on this device. Never used for authorization. */
  accountId: string;
  patientId: string;
  initialNotes: PatientNote[];
};

/** A closed composer whose text the server does not have yet. */
type Unsent = { content: string; refused: boolean };

const byNewest = (a: PatientNote, b: PatientNote) =>
  b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id);

function upsertNote(notes: PatientNote[], note: PatientNote): PatientNote[] {
  return [...notes.filter((existing) => existing.id !== note.id), note].sort(byNewest);
}

function without<T>(record: Record<string, T>, key: string): Record<string, T> {
  const { [key]: _removed, ...rest } = record;
  return rest;
}

/**
 * The "Ghi chú" section of a patient (spec patient-notes, mockup of change add-patient-notes):
 * newest first, a floating "Ghi chú mới" button in the thumb zone, composers that autosave, and
 * the drafts left on this device restored on open ("Khôi phục ghi chú chưa gửi").
 *
 * A composer's place (top of the section, or in place of its note) is fixed when it opens: moving
 * it later would remount it, lose focus and bring back older text.
 */
export function PatientNotes({ accountId, patientId, initialNotes }: PatientNotesProps) {
  const [notes, setNotes] = useState(() => [...initialNotes].sort(byNewest));
  const [sessions, setSessions] = useState<ComposerSession[]>([]);
  const [unsent, setUnsent] = useState<Record<string, Unsent>>({});
  const [focusId, setFocusId] = useState<string | null>(null);

  // Restore once, when the page opens: a later refresh must not reopen composers the doctor
  // closed while offline.
  const notesAtOpen = useRef(initialNotes);
  useEffect(() => {
    let cancelled = false;
    void listNoteDrafts(accountId, patientId).then((drafts) => {
      if (cancelled || drafts.length === 0) return;
      setSessions((open) => [
        ...open,
        ...drafts
          .filter((draft) => normalizeNoteContent(draft.content))
          .filter((draft) => !open.some((session) => session.noteId === draft.noteId))
          .map((draft): ComposerSession => {
            const stored = notesAtOpen.current.find((note) => note.id === draft.noteId);
            return {
              noteId: draft.noteId,
              editing: draft.editing,
              initialContent: draft.content,
              restored: true,
              unsent: true,
              // An edit of a note no longer on the page shows at the top: its text stays visible.
              placement: draft.editing && stored ? "inline" : "top",
              label: stored ? formatDateTime(stored.createdAt) : "Ghi chú mới",
            };
          }),
      ]);
    });
    return () => {
      cancelled = true;
    };
  }, [accountId, patientId]);

  // Saves made by any composer or by the background sync land here.
  useEffect(() => {
    const onSaved = (event: Event) => {
      const detail = (event as CustomEvent<NoteSavedDetail>).detail;
      if (detail.patientId !== patientId) return;
      setNotes((current) => upsertNote(current, detail.note));
      if (!detail.pending) setUnsent((current) => without(current, detail.note.id));
    };
    window.addEventListener(NOTE_SAVED_EVENT, onSaved);
    return () => window.removeEventListener(NOTE_SAVED_EVENT, onSaved);
  }, [patientId]);

  const topSessions = sessions.filter((session) => session.placement === "top");
  const inTopComposer = (id: string) => topSessions.some((session) => session.noteId === id);
  const openNewSession = sessions.find((session) => !session.editing);

  /** Opens the new-note composer (or a closed new note still waiting for the server). */
  const openNew = (noteId: string = crypto.randomUUID(), waiting?: Unsent) => {
    if (openNewSession) {
      setFocusId(openNewSession.noteId);
      return;
    }
    setSessions((current) => [
      {
        noteId,
        editing: false,
        initialContent: waiting?.content ?? "",
        restored: false,
        unsent: Boolean(waiting),
        placement: "top",
        label: "Ghi chú mới",
      },
      ...current,
    ]);
    setFocusId(noteId);
  };

  const openEdit = (note: PatientNote) => {
    if (sessions.some((session) => session.noteId === note.id)) return;
    const waiting = unsent[note.id];
    setSessions((current) => [
      ...current,
      {
        noteId: note.id,
        editing: true,
        initialContent: waiting?.content ?? note.content,
        restored: false,
        unsent: Boolean(waiting),
        placement: "inline",
        label: formatDateTime(note.createdAt),
      },
    ]);
    setFocusId(note.id);
  };

  const closeSession = useCallback((noteId: string, result: ComposerCloseResult) => {
    setSessions((current) => current.filter((session) => session.noteId !== noteId));
    setUnsent((current) =>
      result.pending && !result.empty
        ? { ...current, [noteId]: { content: result.content, refused: result.refused } }
        : without(current, noteId),
    );
  }, []);

  const removeNote = useCallback((noteId: string) => {
    setSessions((current) => current.filter((session) => session.noteId !== noteId));
    setNotes((current) => current.filter((note) => note.id !== noteId));
    setUnsent((current) => without(current, noteId));
  }, []);

  const composer = (session: ComposerSession) => (
    <NoteComposer
      key={session.noteId}
      accountId={accountId}
      patientId={patientId}
      session={session}
      autoFocus={focusId === session.noteId}
      onClose={(result) => closeSession(session.noteId, result)}
      onDeleted={() => removeNote(session.noteId)}
    />
  );

  // A new note closed before reaching the server: shown as "Vừa ghi" until it is stored.
  const unsentNew = Object.entries(unsent).filter(
    ([id]) => !notes.some((note) => note.id === id) && !inTopComposer(id),
  );
  const listed = notes.filter((note) => !inTopComposer(note.id));
  const count = listed.length + unsentNew.length + topSessions.length;
  const inlineSession = (id: string) =>
    sessions.find((session) => session.noteId === id && session.placement === "inline");

  return (
    <section aria-labelledby="patient-notes-heading" className="mt-5">
      <div className="mb-2.5 flex items-baseline justify-between gap-2">
        <h2 id="patient-notes-heading" className="text-[1.05rem] font-bold">
          Ghi chú
        </h2>
        {count > 0 ? <span className="text-sm text-muted-foreground">{count} ghi chú</span> : null}
      </div>

      {topSessions.length > 0 ? (
        <div className="mb-3 grid gap-3">{topSessions.map(composer)}</div>
      ) : null}

      {listed.length + unsentNew.length === 0 ? (
        topSessions.length > 0 ? null : (
          <p className="rounded-2xl border border-dashed bg-card px-4 py-5 text-center text-muted-foreground">
            Chưa có ghi chú
          </p>
        )
      ) : (
        <ol className="divide-y rounded-2xl border bg-card">
          {unsentNew.map(([id, waiting]) => (
            <li key={id}>
              <NoteItem
                content={waiting.content}
                createdAt={null}
                updatedAt={null}
                unsent={waiting.refused ? "refused" : "waiting"}
                onEdit={() => openNew(id, waiting)}
              />
            </li>
          ))}
          {listed.map((note) => {
            const session = inlineSession(note.id);
            const waiting = unsent[note.id];
            return (
              <li key={note.id} className={session ? "p-2" : undefined}>
                {session ? (
                  composer(session)
                ) : (
                  <NoteItem
                    content={waiting?.content ?? note.content}
                    createdAt={note.createdAt}
                    updatedAt={note.updatedAt}
                    unsent={waiting ? (waiting.refused ? "refused" : "waiting") : undefined}
                    onEdit={() => openEdit(note)}
                  />
                )}
              </li>
            );
          })}
        </ol>
      )}

      {openNewSession ? null : (
        <button
          type="button"
          onClick={() => openNew()}
          className="fixed right-[max(1rem,calc((100vw-42rem)/2+1rem))] bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 inline-flex h-13 items-center gap-2 rounded-full bg-primary pr-5 pl-4 font-semibold text-primary-foreground shadow-lg transition-colors hover:bg-primary/90 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
        >
          <PlusIcon className="size-5" aria-hidden />
          Ghi chú mới
        </button>
      )}
    </section>
  );
}
