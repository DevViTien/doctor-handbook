"use client";

import { Trash2Icon, TriangleAlertIcon } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { FORM_INPUT_CLASS, FORM_LABEL_CLASS } from "@/components/common/password-input";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/date/format";
import { cn } from "@/lib/utils";
import { usernameMatches } from "@/modules/admin/account-deletion";
import {
  ROW_ACTION_BUTTON_CLASS,
  useConfirmedRowAction,
} from "@/modules/admin/components/row-action";
import { ACCOUNT_LIST_TITLE_ID, ACCOUNT_MESSAGES } from "@/modules/admin/constants";
import { deleteAccountAction } from "@/modules/admin/server/actions";

type DeleteAccountButtonProps = {
  id: string;
  displayName: string;
  username: string;
  patientCount: number;
  lastBackupAt: Date | null;
};

/**
 * "Xoá" on a LOCKED doctor's row (spec account-management "Xoá tài khoản đã khoá"). Asks with
 * what will be lost and the last backup, and only lets the admin confirm once the username is
 * typed (`usernameMatches`, checked again on the server). After a delete the row is gone, so a
 * toast says it and focus moves to the list title.
 */
export function DeleteAccountButton({
  id,
  displayName,
  username,
  patientCount,
  lastBackupAt,
}: DeleteAccountButtonProps) {
  const [typed, setTyped] = useState("");
  const inputId = useId();
  const hintId = useId();
  const remove = useConfirmedRowAction(async () => {
    const result = await deleteAccountAction({ id, username: typed });
    if (result.ok) {
      toast.success(ACCOUNT_MESSAGES.deleted(result.data.username));
      // The button leaves with its row: hand focus to the list instead of losing it.
      setTimeout(() => document.getElementById(ACCOUNT_LIST_TITLE_ID)?.focus(), 0);
    }
    return result;
  });
  const matches = usernameMatches(typed, username);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setTyped("");
          remove.openDialog();
        }}
        className={cn(ROW_ACTION_BUTTON_CLASS, "text-destructive hover:text-destructive")}
      >
        <Trash2Icon className="size-4" aria-hidden />
        Xoá
      </Button>
      <ConfirmDialog
        open={remove.open}
        onOpenChange={remove.onOpenChange}
        title={`Xoá tài khoản của ${displayName}?`}
        description="Không hoàn tác được. Nếu bác sĩ còn cần dữ liệu, mở khoá để bác sĩ tự sao lưu trước."
        cancelLabel="Không xoá"
        confirmLabel="Xoá vĩnh viễn"
        destructive
        pending={remove.isPending}
        confirmDisabled={!matches}
        error={remove.error}
        onConfirm={remove.confirm}
      >
        <div className="grid gap-2 rounded-xl bg-destructive/10 px-3.5 py-3">
          <p className="flex items-center gap-2 text-[0.95rem] font-bold text-destructive">
            <TriangleAlertIcon className="size-5 shrink-0" aria-hidden />
            Sẽ mất vĩnh viễn
          </p>
          <ul className="grid list-disc gap-0.5 pl-6.5 text-[0.95rem]">
            <li>{patientCount.toLocaleString("vi-VN")} bệnh nhân, cả thùng rác</li>
            <li>Mọi ghi chú và ảnh đại diện</li>
            <li>Việc cần làm</li>
          </ul>
          <p className="border-t border-destructive/25 pt-2 text-[0.9rem]">
            {lastBackupAt
              ? `Lần sao lưu gần nhất: ${formatDate(lastBackupAt)}.`
              : "Chưa sao lưu lần nào."}
          </p>
        </div>
        <Field>
          <FieldLabel htmlFor={inputId} className={FORM_LABEL_CLASS}>
            Gõ tên đăng nhập để xác nhận
          </FieldLabel>
          <FieldDescription id={hintId}>
            Gõ{" "}
            <b translate="no" className="font-semibold text-foreground">
              {username}
            </b>
          </FieldDescription>
          <Input
            id={inputId}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              if (matches && !remove.isPending) remove.confirm();
            }}
            disabled={remove.isPending || remove.error !== null}
            aria-describedby={hintId}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            translate="no"
            maxLength={64}
            className={FORM_INPUT_CLASS}
          />
        </Field>
      </ConfirmDialog>
    </>
  );
}
