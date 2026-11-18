"use client";

import { ChevronRightIcon, ListTodoIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { DOCTOR_TOASTER_ID } from "@/config/site";
import { vietnamIsoDay } from "@/lib/date/calendar";
import type { ActionError } from "@/lib/errors";
import { type AddResult, TodoComposer } from "@/modules/todos/components/todo-composer";
import { type SaveResult, TodoEditSheet } from "@/modules/todos/components/todo-edit-sheet";
import { TodoRow } from "@/modules/todos/components/todo-item";
import { TODO_MESSAGES, TODO_UNDO_MS } from "@/modules/todos/constants";
import { compareDone, compareOpen } from "@/modules/todos/due";
import {
  createTodoAction,
  deleteCompletedTodosAction,
  deleteTodoAction,
  restoreTodoAction,
  setTodoDoneAction,
  updateTodoAction,
} from "@/modules/todos/server/actions";
import type { TodoItem } from "@/modules/todos/types";

/** Re-read "today" every minute: a page left open past midnight moves "Hôm nay" along. */
function subscribeEveryMinute(onChange: () => void): () => void {
  const timer = setInterval(onChange, 60_000);
  return () => clearInterval(timer);
}

const notify = { toasterId: DOCTOR_TOASTER_ID };

type Refusal = Pick<ActionError, "code" | "message">;

/**
 * The to-do list (spec todo-list, design §3). The list in the browser is what is shown: every
 * change appears at once and is sent in the background; a refusal puts things back. Notices
 * never contain a to-do's text (it may name a patient).
 *
 * Only an add and an undo may INSERT a row into the list; every other answer or rollback only
 * PATCHES a row that is still there, so a to-do deleted meanwhile never comes back as a ghost.
 */
export function TodoList({ initial, today: serverToday }: { initial: TodoItem[]; today: string }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [editing, setEditing] = useState<TodoItem | null>(null);
  const [clearCount, setClearCount] = useState<number | null>(null);
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState<Refusal | null>(null);
  // Latest toggle per to-do: only its answer may roll back (two quick taps, both offline).
  const toggleTokens = useRef(new Map<string, number>());
  const today = useSyncExternalStore(
    subscribeEveryMinute,
    () => vietnamIsoDay(new Date()),
    () => serverToday,
  );

  const open = items.filter((item) => item.completedAt === null).sort(compareOpen);
  const done = items.filter((item) => item.completedAt !== null).sort(compareDone);

  const insert = (item: TodoItem) =>
    setItems((current) =>
      current.some((x) => x.id === item.id)
        ? current.map((x) => (x.id === item.id ? item : x))
        : [...current, item],
    );
  const patch = (id: string, change: (item: TodoItem) => TodoItem) =>
    setItems((current) => current.map((x) => (x.id === id ? change(x) : x)));
  const remove = (id: string) => setItems((current) => current.filter((x) => x.id !== id));

  /** A refusal: say why. Gone → leaves the list; signed out → the page guard takes over. */
  const refused = (error: Refusal, id: string) => {
    toast.error(error.message, notify);
    if (error.code === "NOT_FOUND") remove(id);
    if (error.code === "UNAUTHENTICATED" || error.code === "FORBIDDEN") router.refresh();
  };
  const offline = (retry: () => void) =>
    toast.error(TODO_MESSAGES.saveOffline, {
      ...notify,
      action: { label: TODO_MESSAGES.retry, onClick: retry },
    });

  const add = async (input: {
    id: string;
    content: string;
    dueDate: string | null;
  }): Promise<AddResult> => {
    insert({ ...input, completedAt: null, createdAt: new Date().toISOString() });
    try {
      const result = await createTodoAction(input);
      if (result.ok) {
        patch(input.id, () => result.data);
        return { ok: true };
      }
      remove(input.id);
      if (result.error.code === "UNAUTHENTICATED") router.refresh();
      return { ok: false, message: result.error.message, offline: false };
    } catch {
      remove(input.id);
      return { ok: false, message: TODO_MESSAGES.addOffline, offline: true };
    }
  };

  /** Sets the wanted state (not a flip), so "Thử lại" never toggles back from a stale copy. */
  const setDone = async (todo: TodoItem, markDone: boolean) => {
    const token = (toggleTokens.current.get(todo.id) ?? 0) + 1;
    toggleTokens.current.set(todo.id, token);
    const before = todo.completedAt;
    patch(todo.id, (x) => ({
      ...x,
      completedAt: markDone ? (x.completedAt ?? new Date().toISOString()) : null,
    }));
    const latest = () => toggleTokens.current.get(todo.id) === token;
    try {
      const result = await setTodoDoneAction({ id: todo.id, done: markDone });
      if (result.ok) {
        if (latest()) patch(todo.id, () => result.data);
        return;
      }
      if (latest()) patch(todo.id, (x) => ({ ...x, completedAt: before }));
      refused(result.error, todo.id);
    } catch {
      if (!latest()) return;
      patch(todo.id, (x) => ({ ...x, completedAt: before }));
      offline(() => void setDone(todo, markDone));
    }
  };

  const save = async (input: {
    id: string;
    content: string;
    dueDate: string | null;
  }): Promise<SaveResult> => {
    try {
      const result = await updateTodoAction(input);
      if (result.ok) {
        patch(input.id, () => result.data);
        return { ok: true };
      }
      if (result.error.code === "NOT_FOUND" || result.error.code === "UNAUTHENTICATED") {
        refused(result.error, input.id);
        return { ok: true };
      }
      return { ok: false, error: result.error };
    } catch {
      return { ok: false, error: { code: "INTERNAL", message: TODO_MESSAGES.saveOffline } };
    }
  };

  const restore = async (todo: TodoItem) => {
    insert(todo);
    try {
      const result = await restoreTodoAction({
        id: todo.id,
        content: todo.content,
        dueDate: todo.dueDate,
        completedAt: todo.completedAt,
        createdAt: todo.createdAt,
      });
      if (result.ok) {
        patch(todo.id, () => result.data);
        return;
      }
      // Not back on the server, whatever the reason: not back on screen either.
      remove(todo.id);
      refused(result.error, todo.id);
    } catch {
      remove(todo.id);
      offline(() => void restore(todo));
    }
  };

  const deleteOne = async (todo: TodoItem) => {
    setEditing(null);
    remove(todo.id);
    try {
      const result = await deleteTodoAction({ id: todo.id });
      if (result.ok) {
        toast(TODO_MESSAGES.deleted, {
          ...notify,
          duration: TODO_UNDO_MS,
          action: { label: TODO_MESSAGES.undo, onClick: () => void restore(todo) },
        });
        return;
      }
      // Still on the server (refused for another reason): show it again.
      if (result.error.code !== "NOT_FOUND") insert(todo);
      refused(result.error, todo.id);
    } catch {
      insert(todo);
      offline(() => void deleteOne(todo));
    }
  };

  const clearDone = async () => {
    setClearing(true);
    setClearError(null);
    try {
      const result = await deleteCompletedTodosAction({});
      if (!result.ok) {
        setClearError(result.error);
        return;
      }
      setItems((current) => current.filter((item) => item.completedAt === null));
      setClearCount(null);
      toast.success(TODO_MESSAGES.clearedDone(result.data.deleted), notify);
    } catch {
      setClearError({ code: "INTERNAL", message: TODO_MESSAGES.saveOffline });
    } finally {
      setClearing(false);
    }
  };

  const row = (todo: TodoItem) => (
    <TodoRow
      key={todo.id}
      todo={todo}
      today={today}
      onToggle={(item) => void setDone(item, item.completedAt === null)}
      onEdit={setEditing}
    />
  );

  return (
    <>
      {/* Title and the add field stay on top while scrolling, like the patient search. */}
      <div className="sticky top-0 z-20 -mx-4 bg-background px-4 pb-2.5">
        <header className="flex items-baseline justify-between gap-3 pt-4 pb-3">
          <h1 className="text-xl font-semibold tracking-tight">Việc cần làm</h1>
          {/* Always mounted, so screen readers hear the count change. */}
          <p className="text-sm whitespace-nowrap text-muted-foreground" aria-live="polite">
            {open.length > 0 ? `${open.length} việc` : ""}
          </p>
        </header>
        <TodoComposer today={today} onAdd={add} />
      </div>

      {items.length === 0 ? (
        <EmptyState
          className="mt-1 rounded-2xl border bg-card"
          icon={ListTodoIcon}
          title="Chưa có việc nào"
          description="Gõ vào ô ở trên rồi nhấn Enter để thêm. Chọn ngày hạn nếu cần."
        />
      ) : null}

      {open.length > 0 ? (
        <ul
          aria-label="Việc chưa xong"
          className="divide-y overflow-hidden rounded-2xl border bg-card"
        >
          {open.map(row)}
        </ul>
      ) : null}

      {done.length > 0 ? (
        <details className="group mt-3.5">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-1.5 font-semibold text-muted-foreground focus-visible:outline-3 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
            <ChevronRightIcon
              className="size-5 transition-transform group-open:rotate-90 motion-reduce:transition-none"
              aria-hidden
            />
            Đã xong ({done.length})
          </summary>
          <ul
            aria-label="Việc đã xong"
            className="mt-1.5 divide-y overflow-hidden rounded-2xl border bg-card"
          >
            {done.map(row)}
          </ul>
          <button
            type="button"
            onClick={() => {
              setClearError(null);
              setClearCount(done.length);
            }}
            className="mt-1.5 inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-[0.92rem] font-semibold text-destructive hover:bg-destructive/10 focus-visible:outline-3 focus-visible:outline-ring"
          >
            <Trash2Icon className="size-4" aria-hidden />
            Xoá các việc đã xong
          </button>
        </details>
      ) : null}

      <TodoEditSheet
        todo={editing}
        onClose={() => setEditing(null)}
        onSave={save}
        onDelete={(todo) => void deleteOne(todo)}
      />
      <ConfirmDialog
        open={clearCount !== null}
        onOpenChange={(value) => {
          if (!value && !clearing) setClearCount(null);
        }}
        // Counted when opened: the list empties while the dialog is closing.
        title={`Xoá ${clearCount ?? 0} việc đã xong?`}
        description="Các việc đã xong sẽ bị xoá hẳn, không khôi phục được. Việc chưa xong giữ nguyên."
        confirmLabel="Xoá"
        cancelLabel="Không xoá"
        destructive
        pending={clearing}
        error={clearError}
        onConfirm={() => void clearDone()}
      />
    </>
  );
}
