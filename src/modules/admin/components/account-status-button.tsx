"use client";

import { CircleAlertIcon, LockIcon, LockOpenIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Spinner } from "@/components/common/spinner";
import { Button } from "@/components/ui/button";
import type { AccountStatus } from "@/lib/enums";
import type { ActionError } from "@/lib/errors";
import {
  ROW_ACTION_BUTTON_CLASS,
  useConfirmedRowAction,
} from "@/modules/admin/components/row-action";
import { lockAccountAction, unlockAccountAction } from "@/modules/admin/server/actions";

type AccountStatusButtonProps = { id: string; displayName: string; status: AccountStatus };

/**
 * "Khoá" (asks first: the doctor is signed out everywhere) or "Mở khoá" (runs at once: easy to
 * undo). ONE button whose label follows the status, so keyboard focus stays on it when the row
 * flips after a lock or unlock (and the dialog returns focus to it on close).
 */
export function AccountStatusButton({ id, displayName, status }: AccountStatusButtonProps) {
  const locked = status === "locked";
  const lock = useConfirmedRowAction(() => lockAccountAction({ id }));
  const [unlockError, setUnlockError] = useState<ActionError | null>(null);
  const [isUnlocking, startUnlock] = useTransition();
  const router = useRouter();

  function unlock() {
    setUnlockError(null);
    startUnlock(async () => {
      const result = await unlockAccountAction({ id });
      if (result.ok) return;
      setUnlockError(result.error);
      // Show the account's real state (unlocked elsewhere, gone…).
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={isUnlocking}
        onClick={locked ? unlock : lock.openDialog}
        className={ROW_ACTION_BUTTON_CLASS}
      >
        {isUnlocking ? (
          <>
            <Spinner className="size-4" label={null} />
            Đang mở khoá…
          </>
        ) : locked ? (
          <>
            <LockOpenIcon className="size-4" aria-hidden />
            Mở khoá
          </>
        ) : (
          <>
            <LockIcon className="size-4" aria-hidden />
            Khoá
          </>
        )}
      </Button>
      <ConfirmDialog
        open={lock.open}
        onOpenChange={lock.onOpenChange}
        title={`Khoá tài khoản của ${displayName}?`}
        description="Bác sĩ bị đăng xuất khỏi mọi thiết bị ngay và không đăng nhập được cho tới khi bạn mở khoá."
        cancelLabel="Không khoá"
        confirmLabel="Khoá"
        destructive
        pending={lock.isPending}
        error={lock.error}
        onConfirm={lock.confirm}
      />
      {unlockError && locked ? (
        <p
          role="alert"
          className="order-last flex basis-full items-start gap-1.5 pt-1.5 text-sm text-destructive"
        >
          <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          {unlockError.message}
        </p>
      ) : null}
    </>
  );
}
