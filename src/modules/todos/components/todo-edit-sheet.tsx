"use client";

import { Trash2Icon, XIcon } from "lucide-react";
import { useId, useState } from "react";

import { FormAlert } from "@/components/common/form-alert";
import { Spinner } from "@/components/common/spinner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { ActionError } from "@/lib/errors";
import { TODO_LIMITS, TODO_MESSAGES } from "@/modules/todos/constants";
import type { TodoItem } from "@/modules/todos/types";

export type SaveResult = { ok: true } | { ok: false; error: Pick<ActionError, "code" | "message"> };

/**
 * "Sửa việc" (spec todo-list): a sheet docked at the bottom on phones, a centred dialog from
 * 640 px. Closes only once the server has saved; "Xoá việc" closes at once (it can be undone).
 */
export function TodoEditSheet({
  todo,
  onClose,
  onSave,
  onDelete,
}: {
  todo: TodoItem | null;
  onClose: () => void;
  onSave: (input: { id: string; content: string; dueDate: string | null }) => Promise<SaveResult>;
  onDelete: (todo: TodoItem) => void;
}) {
  // While saving, the sheet stays open: a failed save must be seen, not silently dropped.
  const [saving, setSaving] = useState(false);
  return (
    <Dialog
      open={todo !== null}
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100dvh-1rem)] gap-3.5 overflow-y-auto overscroll-contain p-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] max-sm:top-auto max-sm:bottom-0 max-sm:max-w-full max-sm:translate-y-0 max-sm:rounded-t-2xl max-sm:rounded-b-none sm:max-w-md sm:p-5"
      >
        {/* Remounted per to-do, so the fields always start from that to-do. */}
        {todo ? (
          <EditForm
            key={todo.id}
            todo={todo}
            onSave={onSave}
            onDelete={onDelete}
            onClose={onClose}
            saving={saving}
            setSaving={setSaving}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function EditForm({
  todo,
  onSave,
  onDelete,
  onClose,
  saving,
  setSaving,
}: {
  todo: TodoItem;
  onSave: (input: { id: string; content: string; dueDate: string | null }) => Promise<SaveResult>;
  onDelete: (todo: TodoItem) => void;
  onClose: () => void;
  saving: boolean;
  setSaving: (saving: boolean) => void;
}) {
  const contentId = useId();
  const dueId = useId();
  const [content, setContent] = useState(todo.content);
  const [due, setDue] = useState(todo.dueDate ?? "");
  const [error, setError] = useState<Pick<ActionError, "code" | "message"> | null>(null);

  const save = async () => {
    const trimmed = content.normalize("NFC").trim();
    if (!trimmed) {
      setError({ code: "VALIDATION_FAILED", message: TODO_MESSAGES.empty });
      return;
    }
    if (trimmed.length > TODO_LIMITS.content) {
      setError({ code: "VALIDATION_FAILED", message: TODO_MESSAGES.tooLong });
      return;
    }
    setSaving(true);
    setError(null);
    const result = await onSave({ id: todo.id, content: trimmed, dueDate: due || null });
    setSaving(false);
    if (result.ok) onClose();
    else setError(result.error);
  };

  return (
    <form
      className="grid gap-3.5"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <span className="mx-auto h-1 w-10 rounded-full bg-border sm:hidden" aria-hidden />
      <div className="flex items-center justify-between gap-2">
        <DialogTitle className="text-lg font-bold">Sửa việc</DialogTitle>
        <DialogClose asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11"
            aria-label="Đóng"
            disabled={saving}
          >
            <XIcon className="size-5" aria-hidden />
          </Button>
        </DialogClose>
      </div>
      <DialogDescription className="sr-only">
        Sửa nội dung, ngày hạn, hoặc xoá việc này.
      </DialogDescription>

      <div className="grid gap-1.5">
        <label htmlFor={contentId} className="text-[0.95rem] font-semibold">
          Nội dung
        </label>
        <Textarea
          id={contentId}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          rows={3}
          className="max-h-[40dvh] min-h-24 text-base"
        />
      </div>
      <div className="grid gap-1.5">
        <label htmlFor={dueId} className="flex items-baseline gap-2 text-[0.95rem] font-semibold">
          Ngày hạn{" "}
          <span className="text-[0.82rem] font-medium text-muted-foreground">không bắt buộc</span>
        </label>
        <div className="flex gap-2">
          <input
            id={dueId}
            type="date"
            value={due}
            onChange={(event) => setDue(event.target.value)}
            className="h-12 min-w-0 flex-1 rounded-lg border border-input bg-card px-3 text-base focus-visible:outline-3 focus-visible:outline-ring"
          />
          <Button
            type="button"
            variant="outline"
            className="h-12 px-3.5"
            disabled={!due}
            onClick={() => setDue("")}
          >
            Bỏ ngày hạn
          </Button>
        </div>
      </div>

      {error ? <FormAlert error={error} /> : null}

      <div className="grid gap-2">
        <Button
          type="submit"
          className="h-12 text-base font-semibold"
          disabled={saving}
          aria-busy={saving}
        >
          {saving ? (
            <>
              <Spinner className="size-5" label={null} />
              Đang lưu…
            </>
          ) : (
            "Lưu"
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-11 font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={saving}
          onClick={() => onDelete(todo)}
        >
          <Trash2Icon className="size-4" aria-hidden />
          Xoá việc
        </Button>
      </div>
    </form>
  );
}
