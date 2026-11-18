"use client";

import {
  CircleAlertIcon,
  CloudCheckIcon,
  HistoryIcon,
  LoaderCircleIcon,
  SquarePenIcon,
  WifiOffIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import type { ActionError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { NOTE_LIMITS, NOTE_MESSAGES } from "@/modules/patients/constants";
import { type NoteSaveStatus, useNoteAutosave } from "@/modules/patients/hooks/use-note-autosave";
import { deleteNoteAndDraft, normalizeNoteContent } from "@/modules/patients/note-sync";

export type ComposerSession = {
  noteId: string;
  /** Opened with "Sửa" on a stored note. */
  editing: boolean;
  initialContent: string;
  /** Restored from a draft left on the device (shows "Khôi phục ghi chú chưa gửi"). */
  restored: boolean;
  /** Its text is not on the server yet (restored, or a waiting note reopened): send on open. */
  unsent: boolean;
  /** Fixed when opened: top of the section, or in place of its note in the list. */
  placement: "top" | "inline";
  /** Label above the text area: "Ghi chú mới", or the note's creation time. */
  label: string;
};

type NoteComposerProps = {
  accountId: string;
  patientId: string;
  session: ComposerSession;
  /** Focus and scroll into view when opened by the doctor (not for a restored draft). */
  autoFocus: boolean;
  onClose: (result: ComposerCloseResult) => void;
  onDeleted: () => void;
};

export type ComposerCloseResult = {
  content: string;
  empty: boolean;
  /** The server does not have this text yet. */
  pending: boolean;
  /** …and refused it (too long, not found): it will not go through by itself. */
  refused: boolean;
};

const STATUS_TEXT: Record<NoteSaveStatus, string> = {
  idle: NOTE_MESSAGES.idle,
  typing: NOTE_MESSAGES.saving,
  saving: NOTE_MESSAGES.saving,
  saved: NOTE_MESSAGES.saved,
  offline: NOTE_MESSAGES.offline,
  error: NOTE_MESSAGES.unsaved,
};

function StatusIcon({ status }: { status: NoteSaveStatus }) {
  const className = "size-4 shrink-0";
  switch (status) {
    case "typing":
    case "saving":
      return (
        <LoaderCircleIcon
          className={cn(className, "animate-spin motion-reduce:animate-none")}
          aria-hidden
        />
      );
    case "saved":
      return <CloudCheckIcon className={cn(className, "text-primary")} aria-hidden />;
    case "offline":
      return <WifiOffIcon className={className} aria-hidden />;
    case "error":
      return <CircleAlertIcon className={className} aria-hidden />;
    default:
      return <SquarePenIcon className={className} aria-hidden />;
  }
}

/** Grows the text area with its content, up to the CSS max height (then it scrolls). */
function fitHeight(textarea: HTMLTextAreaElement | null) {
  if (!textarea) return;
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

/**
 * The open note composer (spec patient-notes, mockup of change add-patient-notes): the one
 * accent of the notes section, a 2 px primary border and a small status line, so a glance tells
 * whether the words are safe. Autosaves; "Xong" only closes. "Xoá ghi chú" for stored notes.
 */
export function NoteComposer({
  accountId,
  patientId,
  session,
  autoFocus,
  onClose,
  onDeleted,
}: NoteComposerProps) {
  const { content, setContent, status, error, close } = useNoteAutosave({
    accountId,
    patientId,
    noteId: session.noteId,
    editing: session.editing,
    initialContent: session.initialContent,
    sendOnMount: session.restored || session.unsent,
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<Pick<ActionError, "code" | "message"> | null>(
    null,
  );

  useEffect(() => {
    const textarea = textareaRef.current;
    fitHeight(textarea);
    if (!autoFocus || !textarea) return;
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    // Keep the composer clear of the on-screen keyboard and the bottom bar.
    textarea.scrollIntoView({ block: "center" });
  }, [autoFocus]);

  const length = normalizeNoteContent(content).length;
  const showCounter = length >= NOTE_LIMITS.counterFrom;
  const over = length > NOTE_LIMITS.content;
  const textareaId = `note-${session.noteId}`;

  const handleDone = async () => {
    onClose({ content, ...(await close()) });
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    const result = await deleteNoteAndDraft(accountId, patientId, session.noteId);
    setDeleting(false);
    if (result.ok) {
      setConfirmingDelete(false);
      onDeleted();
    } else {
      setDeleteError(result.error);
    }
  };

  return (
    <div className="grid gap-2 rounded-2xl border-2 border-primary bg-card p-2.5">
      {session.restored ? (
        <p className="flex items-start gap-2 rounded-lg bg-warning-bg px-2.5 py-2 text-[0.9rem] font-semibold text-warning">
          <HistoryIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          {NOTE_MESSAGES.restored}
        </p>
      ) : null}
      <label
        htmlFor={textareaId}
        className="px-1 text-[0.82rem] font-semibold text-muted-foreground tabular-nums"
      >
        {session.label}
      </label>
      <textarea
        ref={textareaRef}
        id={textareaId}
        value={content}
        onChange={(event) => {
          setContent(event.target.value);
          fitHeight(event.target);
        }}
        rows={4}
        autoComplete="off"
        placeholder="Ghi điều cần nhớ về lần gặp này…"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${textareaId}-error` : undefined}
        className="max-h-72 min-h-28 w-full resize-none overflow-y-auto bg-transparent px-1 py-1.5 text-base leading-normal outline-none placeholder:text-muted-foreground"
      />
      {error ? (
        <p
          id={`${textareaId}-error`}
          className="mx-1 flex items-start gap-1.5 text-sm text-destructive"
        >
          <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-1.5 border-t pt-1.5">
        <span
          role="status"
          className={cn(
            "mr-auto inline-flex min-h-11 items-center gap-1.5 px-1 text-sm font-medium text-muted-foreground",
            status === "saved" && "text-foreground",
            status === "offline" && "text-warning",
            status === "error" && "text-destructive",
          )}
        >
          <StatusIcon status={status} />
          {STATUS_TEXT[status]}
        </span>
        {showCounter ? (
          <span
            className={cn(
              "px-1 text-[0.8rem] text-muted-foreground tabular-nums",
              over && "font-semibold text-destructive",
            )}
          >
            {length.toLocaleString("vi-VN")}/{NOTE_LIMITS.content.toLocaleString("vi-VN")}
          </span>
        ) : null}
        {session.editing ? (
          <button
            type="button"
            onClick={() => {
              setDeleteError(null);
              setConfirmingDelete(true);
            }}
            className="h-11 rounded-lg px-2.5 text-[0.9rem] font-semibold text-destructive hover:bg-destructive/10 focus-visible:outline-3 focus-visible:outline-ring"
          >
            Xoá ghi chú
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => void handleDone()}
          className="h-11 rounded-lg border border-input bg-card px-4.5 font-semibold hover:bg-muted focus-visible:outline-3 focus-visible:outline-ring"
        >
          Xong
        </button>
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={(open) => {
          if (!deleting) setConfirmingDelete(open);
        }}
        title="Xoá ghi chú này?"
        description={`Ghi chú lúc ${session.label} sẽ bị xoá vĩnh viễn, không khôi phục được.`}
        confirmLabel="Xoá ghi chú"
        cancelLabel="Không xoá"
        destructive
        pending={deleting}
        error={deleteError}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
