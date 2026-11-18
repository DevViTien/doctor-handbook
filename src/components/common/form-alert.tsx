import { CircleAlertIcon, ClockIcon, LockIcon } from "lucide-react";

import type { ActionError } from "@/lib/errors";
import { cn } from "@/lib/utils";

type FormAlertProps = {
  error: Pick<ActionError, "code" | "message">;
  className?: string;
};

/**
 * Form-level error announced to screen readers: red with an icon for errors, amber with a clock
 * for rate limiting ("try again later" is a wait, not a mistake). Colour is never the only cue.
 */
export function FormAlert({ error, className }: FormAlertProps) {
  const isRateLimited = error.code === "RATE_LIMITED";
  const Icon = isRateLimited ? ClockIcon : error.code === "FORBIDDEN" ? LockIcon : CircleAlertIcon;

  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2.5 rounded-lg px-3.5 py-3 text-[0.95rem] font-medium",
        isRateLimited ? "bg-warning-bg text-warning" : "bg-destructive/10 text-destructive",
        className,
      )}
    >
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <span>{error.message}</span>
    </div>
  );
}
