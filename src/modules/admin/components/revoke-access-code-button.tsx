"use client";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  ROW_ACTION_BUTTON_CLASS,
  useConfirmedRowAction,
} from "@/modules/admin/components/row-action";
import { revokeAccessCodeAction } from "@/modules/admin/server/actions";

type RevokeAccessCodeButtonProps = { id: string; recipientName: string };

/**
 * "Huỷ mã" on an active code. Revoking cannot be undone, so it asks first (N2 allows a
 * confirmation only for irreversible actions). A refusal is shown inside the dialog.
 */
export function RevokeAccessCodeButton({ id, recipientName }: RevokeAccessCodeButtonProps) {
  const revoke = useConfirmedRowAction(() => revokeAccessCodeAction({ id }));

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={revoke.openDialog}
        className={ROW_ACTION_BUTTON_CLASS}
      >
        Huỷ mã
      </Button>
      <ConfirmDialog
        open={revoke.open}
        onOpenChange={revoke.onOpenChange}
        title={`Huỷ mã của ${recipientName}?`}
        description="Mã này sẽ không dùng được nữa. Không hoàn tác được."
        cancelLabel="Không huỷ"
        confirmLabel="Huỷ mã"
        destructive
        pending={revoke.isPending}
        error={revoke.error}
        onConfirm={revoke.confirm}
      />
    </>
  );
}
