"use client";

import { Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { ROW_ACTION_BUTTON_CLASS, useConfirmedRowAction } from "@/components/common/row-action";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FEEDBACK_LIST_TITLE_ID, FEEDBACK_MESSAGES } from "@/modules/feedback/constants";
import { deleteFeedbackAction } from "@/modules/feedback/server/actions";

type DeleteFeedbackButtonProps = {
  id: string;
  sender: string;
  sentAt: string;
  content: string;
};

/**
 * "Xoá" on a feedback (spec feedback "Xoá góp ý"). It cannot be undone, so it asks first and
 * quotes the first lines, to be sure it is the right one. After a delete the item is gone, so a
 * toast says it and focus moves to the list title.
 */
export function DeleteFeedbackButton({ id, sender, sentAt, content }: DeleteFeedbackButtonProps) {
  const remove = useConfirmedRowAction(async () => {
    const result = await deleteFeedbackAction({ id });
    if (result.ok) {
      toast.success(FEEDBACK_MESSAGES.deleted);
      setTimeout(() => document.getElementById(FEEDBACK_LIST_TITLE_ID)?.focus(), 0);
    }
    return result;
  });

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={remove.openDialog}
        className={cn(ROW_ACTION_BUTTON_CLASS, "text-destructive hover:text-destructive")}
      >
        <Trash2Icon className="size-4" aria-hidden />
        Xoá
      </Button>
      <ConfirmDialog
        open={remove.open}
        onOpenChange={remove.onOpenChange}
        title="Xoá góp ý này?"
        description={`Góp ý của ${sender}, gửi lúc ${sentAt}. Không hoàn tác được.`}
        cancelLabel="Không xoá"
        confirmLabel="Xoá góp ý"
        destructive
        pending={remove.isPending}
        error={remove.error}
        onConfirm={remove.confirm}
      >
        {/* The clamp sits on the inner text: on the padded box, a 4th line peeks out below. */}
        <p className="rounded-lg bg-secondary px-3 py-2.5 text-[0.92rem]">
          <span className="line-clamp-3 wrap-anywhere whitespace-pre-wrap">{content}</span>
        </p>
      </ConfirmDialog>
    </>
  );
}
