"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { ActionError } from "@/lib/errors";
import type { ActionResult } from "@/lib/result";

/** Outline button at the end of a list row (44 px tall, card background). */
export const ROW_ACTION_BUTTON_CLASS =
  "h-11 shrink-0 border-input bg-card px-3.5 text-[0.9rem] font-semibold dark:bg-card";

/**
 * State of a row action that asks first (`ConfirmDialog`): revoke a code, lock an account.
 * A refusal stays in the dialog until the admin closes it; then the page is refreshed so the
 * row shows its real state (the server does not revalidate on a refusal: the row, and the
 * dialog with it, would vanish before the error is read).
 */
export function useConfirmedRowAction<T>(run: () => Promise<ActionResult<T>>) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<ActionError | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return {
    open,
    error,
    isPending,
    openDialog() {
      setError(null);
      setOpen(true);
    },
    onOpenChange(next: boolean) {
      setOpen(next);
      if (!next && error) router.refresh();
    },
    confirm() {
      startTransition(async () => {
        const result = await run();
        if (result.ok) setOpen(false);
        else setError(result.error);
      });
    },
  };
}
