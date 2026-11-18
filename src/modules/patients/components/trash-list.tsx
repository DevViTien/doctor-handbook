"use client";

import { Trash2Icon, Undo2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { InitialsAvatar } from "@/components/common/initials-avatar";
import { Button } from "@/components/ui/button";
import { DOCTOR_TOASTER_ID } from "@/config/site";
import type { ActionError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { TRASH_MESSAGES } from "@/modules/patients/constants";
import { listNoteDrafts, removeNoteDraft } from "@/modules/patients/note-drafts";
import { deletePermanentlyAction, restoreFromTrashAction } from "@/modules/patients/server/actions";

/** One trashed patient, already formatted by the page. */
export type TrashRow = {
  id: string;
  fullName: string;
  meta: string;
  /** "Xoá ngày 18/11/2026 · còn 30 ngày". */
  expiry: string;
  /** Last day: shown in warning colour, with the words saying it too. */
  lastDay: boolean;
  avatarSrc: string | null;
};

type Pending = { id: string; kind: "restore" | "delete" } | null;

/**
 * The trash (spec patient-trash): restore puts a patient back on top of the list; "Xoá vĩnh
 * viễn" is the only step that asks, and also drops that patient's note drafts on this device.
 * Rows are not links: a trashed patient is restored before being looked at. Toasts never name
 * the patient; the confirmation dialog does, so the doctor is sure of who goes.
 */
export function TrashList({ accountId, rows }: { accountId: string; rows: TrashRow[] }) {
  const router = useRouter();
  // Derived from the server's rows (refreshed after every action, or by an undo elsewhere),
  // minus what this page has just restored or deleted.
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
  const items = rows.filter((row) => !gone.has(row.id));
  const [pending, setPending] = useState<Pending>(null);
  const [confirming, setConfirming] = useState<TrashRow | null>(null);
  const [deleteError, setDeleteError] = useState<Pick<ActionError, "code" | "message"> | null>(
    null,
  );

  const remove = (id: string) => setGone((current) => new Set(current).add(id));

  const restore = async (row: TrashRow) => {
    setPending({ id: row.id, kind: "restore" });
    try {
      const result = await restoreFromTrashAction({ patientId: row.id });
      if (!result.ok) {
        toast.error(result.error.message, { toasterId: DOCTOR_TOASTER_ID });
        // Expired, or restored/deleted on another device: fresh rows from the server drop it.
        if (result.error.code === "NOT_FOUND") router.refresh();
        return;
      }
      remove(row.id);
      router.refresh();
      toast.success(TRASH_MESSAGES.restored, { toasterId: DOCTOR_TOASTER_ID });
    } catch {
      toast.error(TRASH_MESSAGES.restoreOffline, { toasterId: DOCTOR_TOASTER_ID });
    } finally {
      setPending(null);
    }
  };

  const deleteForGood = async (row: TrashRow) => {
    setPending({ id: row.id, kind: "delete" });
    setDeleteError(null);
    try {
      const result = await deletePermanentlyAction({ patientId: row.id });
      if (!result.ok) {
        // Shown in the dialog; fresh rows drop the patient if it is really gone. Removing the
        // row here would unmount the dialog (empty trash) before the error could be read.
        setDeleteError(result.error);
        if (result.error.code === "NOT_FOUND") router.refresh();
        return;
      }
      // Its notes are gone from the server: drafts of them on this device would never send.
      for (const draft of await listNoteDrafts(accountId, row.id)) {
        await removeNoteDraft(accountId, draft.noteId);
      }
      remove(row.id);
      setConfirming(null);
      router.refresh();
      toast.success(TRASH_MESSAGES.deleted, { toasterId: DOCTOR_TOASTER_ID });
    } catch {
      setDeleteError({ code: "INTERNAL", message: TRASH_MESSAGES.deleteOffline });
    } finally {
      setPending(null);
    }
  };

  if (items.length === 0) {
    return (
      <EmptyState
        className="rounded-2xl border bg-card"
        icon={Trash2Icon}
        title="Thùng rác trống"
        description="Bệnh nhân bị xoá sẽ nằm ở đây 30 ngày trước khi bị xoá hẳn."
      />
    );
  }

  return (
    <>
      <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
        {items.map((row) => (
          <li key={row.id} className="grid gap-2.5 py-3 pr-3 pl-3.5">
            <div className="flex min-w-0 items-center gap-3">
              <InitialsAvatar name={row.fullName} src={row.avatarSrc} />
              <div className="grid min-w-0 flex-1 gap-px">
                <span className="truncate font-semibold">{row.fullName}</span>
                {row.meta ? (
                  <span className="truncate text-sm text-muted-foreground">{row.meta}</span>
                ) : null}
                <span
                  className={cn(
                    "text-[0.8125rem] text-muted-foreground tabular-nums",
                    row.lastDay && "font-semibold text-warning",
                  )}
                >
                  {row.expiry}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pl-13">
              <Button
                type="button"
                variant="outline"
                className="h-11 px-3.5"
                disabled={pending !== null}
                aria-label={`Khôi phục ${row.fullName}`}
                onClick={() => void restore(row)}
              >
                <Undo2Icon className="size-4" aria-hidden />
                {pending?.id === row.id && pending.kind === "restore"
                  ? "Đang khôi phục…"
                  : "Khôi phục"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-11 px-3 font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={pending !== null}
                aria-label={`Xoá vĩnh viễn ${row.fullName}`}
                onClick={() => {
                  setDeleteError(null);
                  setConfirming(row);
                }}
              >
                Xoá vĩnh viễn
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open && pending === null) setConfirming(null);
        }}
        title="Xoá vĩnh viễn bệnh nhân này?"
        description={
          confirming
            ? `Hồ sơ của ${confirming.fullName} cùng mọi ghi chú sẽ bị xoá hẳn, không khôi phục được.`
            : undefined
        }
        confirmLabel="Xoá vĩnh viễn"
        cancelLabel="Không xoá"
        destructive
        pending={pending?.kind === "delete"}
        error={deleteError}
        onConfirm={() => {
          if (confirming) void deleteForGood(confirming);
        }}
      />
    </>
  );
}
