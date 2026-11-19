"use client";

import { CircleAlertIcon, KeyRoundIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ROW_ACTION_BUTTON_CLASS } from "@/components/common/row-action";
import { Spinner } from "@/components/common/spinner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ActionError } from "@/lib/errors";
import { IssuedCodeDetails } from "@/modules/admin/components/issued-code-card";
import {
  createPasswordResetCodeAction,
  type IssuedAccessCode,
} from "@/modules/admin/server/actions";

type PasswordResetCodeButtonProps = { id: string; displayName: string };

/**
 * "Cấp mã đặt lại mật khẩu" on an active doctor's row. Runs at once (no confirmation: issuing
 * destroys nothing, and a new code revokes the previous one) and shows the code once in a
 * dialog with the message to copy (spec access-codes "Admin cấp mã đặt lại mật khẩu").
 */
export function PasswordResetCodeButton({ id, displayName }: PasswordResetCodeButtonProps) {
  const [issued, setIssued] = useState<IssuedAccessCode | null>(null);
  const [error, setError] = useState<ActionError | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function issue() {
    setError(null);
    startTransition(async () => {
      const result = await createPasswordResetCodeAction({ id });
      if (result.ok) {
        setIssued(result.data);
        return;
      }
      setError(result.error);
      // Show the account's real state (locked or gone in another tab).
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={isPending}
        onClick={issue}
        className={ROW_ACTION_BUTTON_CLASS}
      >
        {isPending ? (
          <>
            <Spinner className="size-4" label={null} />
            Đang tạo mã…
          </>
        ) : (
          <>
            <KeyRoundIcon className="size-4" aria-hidden />
            Cấp mã đặt lại mật khẩu
          </>
        )}
      </Button>

      <Dialog open={issued !== null} onOpenChange={(open) => !open && setIssued(null)}>
        <DialogContent
          showCloseButton={false}
          // The code is shown once: a stray tap outside must not throw it away ("Đóng" closes).
          onInteractOutside={(event) => event.preventDefault()}
          className="gap-4 p-5 sm:max-w-md"
        >
          <DialogTitle className="text-lg font-bold text-balance wrap-break-word">
            Mã đặt lại mật khẩu cho {displayName}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Gửi mã này cho bác sĩ qua tin nhắn. Mã chỉ hiện một lần.
          </DialogDescription>
          {issued ? <IssuedCodeDetails issued={issued} /> : null}
          <DialogClose asChild>
            <Button
              type="button"
              variant="outline"
              className="h-12 w-full border-input bg-card text-base font-semibold dark:bg-card"
            >
              Đóng
            </Button>
          </DialogClose>
        </DialogContent>
      </Dialog>

      {error ? (
        <p
          role="alert"
          className="order-last flex basis-full items-start gap-1.5 pt-1 text-sm text-destructive"
        >
          <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error.message}
        </p>
      ) : null}
    </>
  );
}
