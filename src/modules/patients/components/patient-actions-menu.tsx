"use client";

import { EllipsisVerticalIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { routes } from "@/config/routes";
import { DOCTOR_TOASTER_ID } from "@/config/site";
import { TRASH_MESSAGES, TRASH_UNDO_MS } from "@/modules/patients/constants";
import { moveToTrashAction, restoreFromTrashAction } from "@/modules/patients/server/actions";

/**
 * "Thêm thao tác" (⋮) on the patient page (spec patient-trash): "Chuyển vào thùng rác" with no
 * confirmation, since it can be undone right away ("Hoàn tác", 8 s) or from the trash for 30
 * days. The notices never name the patient (S7).
 */
export function PatientActionsMenu({ patientId }: { patientId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const undo = async () => {
    try {
      const result = await restoreFromTrashAction({ patientId });
      if (!result.ok) {
        toast.error(result.error.message, { toasterId: DOCTOR_TOASTER_ID });
        return;
      }
      router.refresh();
      toast.success(TRASH_MESSAGES.restored, { toasterId: DOCTOR_TOASTER_ID });
    } catch {
      toast.error(TRASH_MESSAGES.restoreOffline, {
        toasterId: DOCTOR_TOASTER_ID,
        action: { label: "Thử lại", onClick: () => void undo() },
      });
    }
  };

  const moveToTrash = async () => {
    setBusy(true);
    try {
      const result = await moveToTrashAction({ patientId });
      if (!result.ok) {
        toast.error(result.error.message, { toasterId: DOCTOR_TOASTER_ID });
        // Already in the trash (e.g. the first answer was lost) or gone: show what is true now.
        if (result.error.code === "NOT_FOUND") router.refresh();
        return;
      }
      router.replace(routes.doctor.patients);
      toast(TRASH_MESSAGES.moved, {
        toasterId: DOCTOR_TOASTER_ID,
        duration: TRASH_UNDO_MS,
        action: { label: TRASH_MESSAGES.undo, onClick: () => void undo() },
      });
    } catch {
      toast.error(TRASH_MESSAGES.moveOffline, {
        toasterId: DOCTOR_TOASTER_ID,
        action: { label: "Thử lại", onClick: () => void moveToTrash() },
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Thêm thao tác"
          disabled={busy}
          className="grid size-11 place-items-center rounded-lg border border-input bg-card hover:bg-muted focus-visible:outline-3 focus-visible:outline-ring disabled:opacity-60"
        >
          <EllipsisVerticalIcon className="size-5" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-60 p-1.5">
        <DropdownMenuItem
          onSelect={() => void moveToTrash()}
          className="min-h-11 gap-2.5 px-3 text-base font-semibold text-destructive focus:text-destructive"
        >
          <Trash2Icon className="size-5 text-destructive" aria-hidden />
          Chuyển vào thùng rác
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
