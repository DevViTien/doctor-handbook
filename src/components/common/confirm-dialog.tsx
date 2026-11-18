"use client";

import type { ReactNode } from "react";

import { FormAlert } from "@/components/common/form-alert";
import { Spinner } from "@/components/common/spinner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { ActionError } from "@/lib/errors";
import { cn } from "@/lib/utils";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button as destructive (delete, replace data, lock account). */
  destructive?: boolean;
  /** Shows a spinner and blocks closing while the confirmed action runs. */
  pending?: boolean;
  onConfirm: () => void;
  /**
   * Why the confirmed action failed. Shown inside the dialog (a toast could vanish before it
   * is read); the footer then only offers "Đóng".
   */
  error?: Pick<ActionError, "code" | "message"> | null;
  closeLabel?: string;
  /** Extra content, e.g. a "type the username to confirm" field. */
  children?: ReactNode;
};

const FOOTER_BUTTON = "h-12 w-full text-base font-semibold sm:w-auto sm:min-w-28";

/**
 * The single confirmation pattern for irreversible actions. Use it sparingly:
 * routine saves must never ask for confirmation (idea.md N2).
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Xác nhận",
  cancelLabel = "Huỷ",
  destructive = false,
  pending = false,
  onConfirm,
  error = null,
  closeLabel = "Đóng",
  children,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <AlertDialogContent className="gap-4 p-5 data-[size=default]:max-w-[calc(100%-2.5rem)] data-[size=default]:sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-lg font-bold text-balance wrap-break-word">
            {title}
          </AlertDialogTitle>
          {description ? (
            <AlertDialogDescription className="text-[0.95rem]">
              {description}
            </AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        {children}
        {error ? <FormAlert error={error} /> : null}
        <AlertDialogFooter className="-mx-5 -mb-5 grid grid-cols-2 gap-2 p-5 sm:flex">
          {error ? (
            <AlertDialogCancel className={cn(FOOTER_BUTTON, "col-span-2")}>
              {closeLabel}
            </AlertDialogCancel>
          ) : (
            <>
              <AlertDialogCancel disabled={pending} className={FOOTER_BUTTON}>
                {cancelLabel}
              </AlertDialogCancel>
              <AlertDialogAction
                variant={destructive ? "destructive" : "default"}
                disabled={pending}
                className={cn(
                  FOOTER_BUTTON,
                  // Solid red (mockup), stronger than the soft "destructive" button variant.
                  destructive &&
                    "bg-destructive text-primary-foreground hover:bg-destructive/90 dark:bg-destructive dark:hover:bg-destructive/90",
                )}
                onClick={(event) => {
                  // Keep the dialog open until the caller closes it after the action settles.
                  event.preventDefault();
                  onConfirm();
                }}
              >
                {pending ? <Spinner className="size-4" label={null} /> : null}
                {confirmLabel}
              </AlertDialogAction>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
