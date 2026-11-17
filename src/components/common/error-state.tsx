import { TriangleAlertIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type ErrorStateProps = {
  title?: string;
  description?: string;
  /** Usually a "Thử lại" button wired to an error boundary's `reset`. */
  action?: ReactNode;
  className?: string;
};

export function ErrorState({
  title = "Đã có lỗi xảy ra",
  description = "Vui lòng thử lại. Nếu lỗi tiếp diễn, hãy báo cho quản trị viên.",
  action,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-12 text-center",
        className,
      )}
    >
      <div className="rounded-full bg-destructive/10 p-3 text-destructive">
        <TriangleAlertIcon className="size-6" aria-hidden />
      </div>
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}
