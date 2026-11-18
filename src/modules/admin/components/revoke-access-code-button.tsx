"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import type { ActionError } from "@/lib/errors";
import { revokeAccessCodeAction } from "@/modules/admin/server/actions";

type RevokeAccessCodeButtonProps = { id: string; recipientName: string };

/**
 * "Huỷ mã" on an active code. Revoking cannot be undone, so it asks first (N2 allows a
 * confirmation only for irreversible actions). A refusal is shown inside the dialog.
 */
export function RevokeAccessCodeButton({ id, recipientName }: RevokeAccessCodeButtonProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<ActionError | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function changeOpen(next: boolean) {
    setOpen(next);
    // After a refusal, show the code's real state (used, expired…) once the error was read.
    if (!next && error) router.refresh();
  }

  function confirm() {
    startTransition(async () => {
      const result = await revokeAccessCodeAction({ id });
      if (result.ok) setOpen(false);
      else setError(result.error);
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="h-11 shrink-0 border-input bg-card px-3.5 text-[0.9rem] font-semibold dark:bg-card"
      >
        Huỷ mã
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={changeOpen}
        title={`Huỷ mã của ${recipientName}?`}
        description="Mã này sẽ không dùng được nữa. Không hoàn tác được."
        cancelLabel="Không huỷ"
        confirmLabel="Huỷ mã"
        destructive
        pending={isPending}
        error={error}
        onConfirm={confirm}
      />
    </>
  );
}
