import { Loader2Icon } from "lucide-react";

import { cn } from "@/lib/utils";

type SpinnerProps = {
  className?: string;
  /**
   * Announced loading text. Pass `null` when the spinner sits next to visible text that already
   * says what is happening (e.g. inside a button "Đang đăng nhập…"): it is then decorative.
   */
  label?: string | null;
};

export function Spinner({ className, label = "Đang tải" }: SpinnerProps) {
  const a11y = label === null ? { "aria-hidden": true } : { role: "status", "aria-label": label };

  return (
    <Loader2Icon
      {...a11y}
      className={cn("size-5 animate-spin motion-reduce:animate-none", className)}
    />
  );
}
