"use client";

import { CalendarIcon, RefreshCwIcon, WifiOffIcon, XIcon } from "lucide-react";
import { useId, useRef, useState } from "react";

import { TODO_LIMITS, TODO_MESSAGES } from "@/modules/todos/constants";
import { describeDue } from "@/modules/todos/due";

export type AddResult = { ok: true } | { ok: false; message: string; offline: boolean };

type AddInput = { id: string; content: string; dueDate: string | null };
type Failure = AddInput & { message: string; offline: boolean };

/**
 * "Thêm việc…" (spec todo-list "Thêm việc nhanh"): type, Enter, done. The field empties and
 * keeps focus for the next one, even while earlier adds are still on their way.
 *
 * A failed add is never lost: its text and due date go back into the field when it is empty;
 * otherwise (the doctor already typed the next one) it stays listed under the field with
 * "Thử lại". Every retry of an add reuses ITS id, so it can never make a duplicate.
 */
export function TodoComposer({
  today,
  onAdd,
}: {
  today: string;
  onAdd: (input: AddInput) => Promise<AddResult>;
}) {
  const inputId = useId();
  const errorId = useId();
  const field = useRef<HTMLInputElement>(null);
  const datePicker = useRef<HTMLInputElement>(null);
  const [text, setTextState] = useState("");
  // The field's current text, readable when an earlier add answers (no stale closure).
  const textNow = useRef("");
  const setText = (value: string) => {
    textNow.current = value;
    setTextState(value);
  };
  const [due, setDue] = useState<string | null>(null);
  const [tooLong, setTooLong] = useState(false);
  // Adds that failed, oldest first. The one whose text is in the field is `inField`.
  const [failures, setFailures] = useState<Failure[]>([]);
  const [inField, setInField] = useState<string | null>(null);

  const send = async (input: AddInput) => {
    setFailures((current) => current.filter((failure) => failure.id !== input.id));
    const result = await onAdd(input);
    if (result.ok) return;
    const failure: Failure = { ...input, message: result.message, offline: result.offline };
    setFailures((current) => [...current.filter((f) => f.id !== input.id), failure]);
    // Give text and due date back together, only into an empty field.
    if (textNow.current === "") {
      setText(input.content);
      setDue(input.dueDate);
      setInField(input.id);
    }
  };

  const submit = () => {
    const content = text.normalize("NFC").trim();
    if (!content) return;
    if (content.length > TODO_LIMITS.content) {
      setTooLong(true);
      return;
    }
    // The failed add whose text is (still) in the field: retry it under its own id.
    const retried = failures.find((f) => f.id === inField && f.content === content);
    const input = { id: retried?.id ?? crypto.randomUUID(), content, dueDate: due };
    setText("");
    setDue(null);
    setInField(null);
    setTooLong(false);
    field.current?.focus();
    void send(input);
  };

  const openPicker = () => {
    const picker = datePicker.current;
    if (!picker) return;
    try {
      picker.showPicker();
    } catch {
      picker.focus();
      picker.click();
    }
  };

  const fieldFailure = failures.find((f) => f.id === inField) ?? null;
  const others = failures.filter((f) => f.id !== inField);
  const error = tooLong
    ? { message: TODO_MESSAGES.tooLong, offline: false }
    : fieldFailure
      ? { message: fieldFailure.message, offline: fieldFailure.offline }
      : null;

  return (
    <div>
      <label htmlFor={inputId} className="sr-only">
        Thêm việc
      </label>
      <div className="flex h-13 items-center gap-1.5 rounded-xl border border-input bg-card pr-1 pl-3.5 focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-ring">
        <input
          ref={field}
          id={inputId}
          type="text"
          enterKeyHint="enter"
          autoComplete="off"
          placeholder="Thêm việc…"
          value={text}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => {
            setText(event.target.value);
            setTooLong(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing) {
              event.preventDefault();
              submit();
            }
          }}
          className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
        />
        <button
          type="button"
          aria-label="Chọn ngày hạn"
          onClick={openPicker}
          className="relative grid size-11 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:outline-3 focus-visible:outline-ring"
        >
          <CalendarIcon className="size-5" aria-hidden />
        </button>
        <input
          ref={datePicker}
          type="date"
          aria-label="Ngày hạn của việc mới"
          tabIndex={-1}
          value={due ?? ""}
          onChange={(event) => setDue(event.target.value || null)}
          className="sr-only"
        />
        {text.trim() ? (
          <button
            type="button"
            onClick={submit}
            className="h-10 shrink-0 rounded-lg bg-primary px-3.5 font-semibold text-primary-foreground hover:bg-primary/85 focus-visible:outline-3 focus-visible:outline-ring"
          >
            Thêm
          </button>
        ) : null}
      </div>
      {due ? (
        <div className="mt-2 flex">
          <span className="inline-flex h-8 items-center gap-1.5 rounded-full border bg-muted pr-1 pl-2.5 text-sm font-semibold tabular-nums">
            <CalendarIcon className="size-4" aria-hidden />
            Hạn: {describeDue(due, today).text}
            <button
              type="button"
              aria-label="Bỏ ngày hạn"
              onClick={() => setDue(null)}
              className="grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-background focus-visible:outline-3 focus-visible:outline-ring"
            >
              <XIcon className="size-4" aria-hidden />
            </button>
          </span>
        </div>
      ) : null}
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="mt-2 flex items-start gap-2 text-[0.9rem] font-medium text-destructive"
        >
          {error.offline ? <WifiOffIcon className="mt-0.5 size-4 shrink-0" aria-hidden /> : null}
          {error.message}
        </p>
      ) : null}
      {others.length > 0 ? (
        <ul aria-label="Việc chưa thêm được" className="mt-2 grid gap-1.5">
          {others.map((failure) => (
            <li
              key={failure.id}
              className="flex items-center gap-2 rounded-lg bg-destructive/10 py-1 pr-1 pl-3 text-[0.9rem] text-destructive"
            >
              <WifiOffIcon className="size-4 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate font-medium">
                Chưa thêm được: {failure.content}
              </span>
              <button
                type="button"
                onClick={() => void send(failure)}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md px-2.5 font-semibold hover:bg-destructive/10 focus-visible:outline-3 focus-visible:outline-ring"
              >
                <RefreshCwIcon className="size-4" aria-hidden />
                {TODO_MESSAGES.retry}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
