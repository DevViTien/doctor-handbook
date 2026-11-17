"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/common/error-state";
import { Button } from "@/components/ui/button";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The server already logged the details; `digest` correlates with server logs.
    console.error("Unhandled UI error", error.digest ?? error.message);
  }, [error]);

  return <ErrorState action={<Button onClick={reset}>Thử lại</Button>} />;
}
