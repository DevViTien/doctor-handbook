"use client";

import { CheckIcon, CircleAlertIcon } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { describeDue, shortDay } from "@/modules/todos/due";
import type { TodoItem as Todo } from "@/modules/todos/types";

/** Delay before a checked to-do moves to "Đã xong", so the tick is seen (none if reduced motion). */
const MOVE_DELAY_MS = 250;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * One to-do (spec todo-list): the round checkbox (the one accent, 44 px target) and the text,
 * which opens "Sửa việc". Overdue says so in words and with an icon, not only in red.
 */
export function TodoRow({
  todo,
  today,
  onToggle,
  onEdit,
}: {
  todo: Todo;
  today: string;
  onToggle: (todo: Todo) => void;
  onEdit: (todo: Todo) => void;
}) {
  const done = todo.completedAt !== null;
  const [checking, setChecking] = useState(false);
  const pressed = done || checking;
  const due = todo.dueDate
    ? done
      ? { text: shortDay(todo.dueDate, today), tone: "plain" as const }
      : describeDue(todo.dueDate, today)
    : null;
  const short = todo.content.length > 40 ? `${todo.content.slice(0, 40)}…` : todo.content;

  const toggle = () => {
    if (done || prefersReducedMotion()) {
      onToggle(todo);
      return;
    }
    setChecking(true);
    setTimeout(() => {
      setChecking(false);
      onToggle(todo);
    }, MOVE_DELAY_MS);
  };

  return (
    <li
      className={cn(
        "flex min-h-15 items-start gap-1 py-1.5 pr-3 pl-1 transition-opacity motion-reduce:transition-none",
        checking && "opacity-50",
      )}
    >
      <button
        type="button"
        aria-label={`${done ? "Mở lại việc" : "Đánh dấu xong"}: ${short}`}
        disabled={checking}
        onClick={toggle}
        className="grid size-11 shrink-0 place-items-center rounded-full focus-visible:outline-3 focus-visible:outline-ring"
      >
        <span
          className={cn(
            "grid size-6 place-items-center rounded-full border-2 border-input text-transparent transition-colors motion-reduce:transition-none",
            pressed && "border-primary bg-primary text-primary-foreground",
          )}
        >
          <CheckIcon className="size-3.5" strokeWidth={3} aria-hidden />
        </span>
      </button>
      <button
        type="button"
        onClick={() => onEdit(todo)}
        className="grid min-w-0 flex-1 gap-0.5 rounded-lg pt-2.5 pb-2 text-left focus-visible:outline-3 focus-visible:outline-ring"
      >
        <span
          className={cn(
            "leading-snug [overflow-wrap:anywhere] whitespace-pre-line",
            done && "text-muted-foreground line-through decoration-muted-foreground/60",
          )}
        >
          {todo.content}
        </span>
        {due ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-[0.8125rem] text-muted-foreground tabular-nums",
              due.tone === "overdue" && "font-bold text-destructive",
              due.tone === "today" && "font-bold text-warning",
              due.tone === "soon" && "font-semibold text-foreground",
            )}
          >
            {due.tone === "overdue" ? <CircleAlertIcon className="size-3.5" aria-hidden /> : null}
            {due.text}
          </span>
        ) : null}
      </button>
    </li>
  );
}
