"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  NOTE_AUTOSAVE_DELAY_MS,
  NOTE_MESSAGES,
  NOTE_RETRY_INTERVAL_MS,
} from "@/modules/patients/constants";
import { writeNoteDraft } from "@/modules/patients/note-drafts";
import {
  discardNoteDraft,
  isNoteTooLong,
  normalizeNoteContent,
  sendNoteDraft,
} from "@/modules/patients/note-sync";

/**
 * - `idle`: nothing to save yet (empty) — "Tự lưu khi bạn ngừng gõ";
 * - `typing`: changed, will be sent after the pause;
 * - `saving` / `saved`: being sent / the server has exactly what is shown;
 * - `offline`: waiting for the network (retried on `online` and every 15 s);
 * - `error`: refused (too long, not found, signed out); the text stays on the device.
 */
export type NoteSaveStatus = "idle" | "typing" | "saving" | "saved" | "offline" | "error";

type Options = {
  accountId: string;
  patientId: string;
  noteId: string;
  editing: boolean;
  initialContent: string;
  /** Text not confirmed by the server yet (a restored draft, a pending note reopened): send it now. */
  sendOnMount: boolean;
};

/**
 * Autosave of one note composer (spec patient-notes, design §4). Every keystroke is written to
 * the device first; the send happens after a one-second pause, through `sendNoteDraft` (the
 * single, locked path to the server). The list learns about saves from `NOTE_SAVED_EVENT`.
 */
export function useNoteAutosave({
  accountId,
  patientId,
  noteId,
  editing,
  initialContent,
  sendOnMount,
}: Options) {
  const [content, setContentState] = useState(initialContent);
  const [status, setStatus] = useState<NoteSaveStatus>(sendOnMount ? "saving" : "idle");
  const [error, setError] = useState<string | null>(null);
  /** The last refusal was a transient server error (`INTERNAL`): retried like the network. */
  const [retryable, setRetryable] = useState(false);

  const contentRef = useRef(initialContent);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const writes = useRef<Promise<unknown>>(Promise.resolve());
  const mounted = useRef(true);
  const touched = useRef(sendOnMount);
  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const flush = useCallback(async () => {
    clearTimer();
    await writes.current;
    const sent = contentRef.current;
    if (!normalizeNoteContent(sent)) return;
    if (mounted.current) setStatus("saving");

    const result = await sendNoteDraft(accountId, noteId, {
      // Sent from memory when the device storage has no draft (blocked, full, failed write).
      current: { patientId, noteId, editing, content: sent },
      onSlow: () => {
        if (mounted.current) setStatus("offline");
      },
    });
    if (!mounted.current) return;
    setRetryable(result.status === "error" && result.error.code === "INTERNAL");
    switch (result.status) {
      case "saved":
        setError(null);
        // "Đã lưu" only when the server has exactly what is shown.
        // Typed while sending: `setContent` has already scheduled the next send.
        setStatus(result.content === contentRef.current ? "saved" : "typing");
        return;
      case "offline":
        setStatus("offline");
        return;
      case "too-long":
        setError(NOTE_MESSAGES.tooLong);
        setStatus("error");
        return;
      case "error":
        setError(result.error.code === "NOT_FOUND" ? NOTE_MESSAGES.notFound : result.error.message);
        setStatus("error");
        return;
      case "nothing":
        // Only an empty text sends nothing (the memory copy covers a missing draft).
        setStatus(normalizeNoteContent(contentRef.current) ? "typing" : "idle");
    }
  }, [accountId, patientId, noteId, editing]);

  const setContent = useCallback(
    (text: string) => {
      touched.current = true;
      contentRef.current = text;
      setContentState(text);
      clearTimer();
      // Device first, in order: a closed tab right after this keystroke still has it.
      writes.current = writes.current.then(() =>
        writeNoteDraft({ accountId, patientId, noteId, editing, content: text }),
      );

      if (isNoteTooLong(text)) {
        setError(NOTE_MESSAGES.tooLong);
        setStatus("error");
        return;
      }
      setError(null);
      if (!normalizeNoteContent(text)) {
        setStatus("idle");
        return;
      }
      setStatus("typing");
      timer.current = setTimeout(() => void flush(), NOTE_AUTOSAVE_DELAY_MS);
    },
    [accountId, patientId, noteId, editing, flush],
  );

  /**
   * "Xong": an empty composer drops its draft (an edited note then keeps its stored text);
   * otherwise any pending text keeps being sent after the composer is gone.
   */
  const close = useCallback(async (): Promise<{
    empty: boolean;
    pending: boolean;
    refused: boolean;
  }> => {
    clearTimer();
    await writes.current;
    if (!normalizeNoteContent(contentRef.current)) {
      await discardNoteDraft(accountId, noteId);
      return { empty: true, pending: false, refused: false };
    }
    const pending = touched.current && statusRef.current !== "saved";
    // Refused (too long, not found, signed out): it will not go through by itself.
    const refused = pending && statusRef.current === "error";
    if (pending && !refused) {
      void sendNoteDraft(accountId, noteId, {
        current: { patientId, noteId, editing, content: contentRef.current },
      });
    }
    return { empty: false, pending, refused };
  }, [accountId, patientId, noteId, editing]);

  // A restored draft is sent right away (from a callback, not during the effect itself).
  useEffect(() => {
    if (!sendOnMount) return;
    const start = setTimeout(() => void flush(), 0);
    return () => clearTimeout(start);
  }, [sendOnMount, flush]);

  // Waiting for the network (or a transient server error): retry when it comes back, and every
  // 15 s in case no event fires.
  useEffect(() => {
    if (status !== "offline" && !(status === "error" && retryable)) return;
    const retry = () => void flush();
    window.addEventListener("online", retry);
    const interval = setInterval(retry, NOTE_RETRY_INTERVAL_MS);
    return () => {
      window.removeEventListener("online", retry);
      clearInterval(interval);
    };
  }, [status, retryable, flush]);

  // Leaving the page mid-pause: send now; the draft is on the device either way.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) {
        clearTimer();
        const content = contentRef.current;
        void writes.current.then(() =>
          sendNoteDraft(accountId, noteId, { current: { patientId, noteId, editing, content } }),
        );
      }
    };
  }, [accountId, patientId, noteId, editing]);

  return { content, setContent, status, error, flush, close };
}
