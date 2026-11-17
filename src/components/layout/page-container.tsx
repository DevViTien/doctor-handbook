import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/** Horizontal padding and readable max width for page content. */
export function PageContainer({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mx-auto w-full max-w-2xl px-4", className)} {...props} />;
}
