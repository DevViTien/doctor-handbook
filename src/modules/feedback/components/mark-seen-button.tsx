"use client";

import { CheckIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { ROW_ACTION_BUTTON_CLASS } from "@/components/common/row-action";
import { Spinner } from "@/components/common/spinner";
import { Button } from "@/components/ui/button";
import { DEFAULT_ERROR_MESSAGES } from "@/lib/errors";
import { markFeedbackSeenAction } from "@/modules/feedback/server/actions";

/**
 * "Đã xem" on a new feedback (spec feedback "Đánh dấu góp ý đã xem"): no dialog, it is
 * harmless. A refusal is a fixed message in a toast (never the feedback's text).
 */
export function MarkSeenButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      type="button"
      variant="outline"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          try {
            const result = await markFeedbackSeenAction({ id });
            if (!result.ok) toast.error(result.error.message);
          } catch {
            toast.error(DEFAULT_ERROR_MESSAGES.INTERNAL);
          }
          router.refresh();
        })
      }
      className={ROW_ACTION_BUTTON_CLASS}
    >
      {isPending ? (
        <Spinner className="size-4" label={null} />
      ) : (
        <CheckIcon className="size-4" aria-hidden />
      )}
      Đã xem
    </Button>
  );
}
