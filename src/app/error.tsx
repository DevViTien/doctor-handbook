"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import { ErrorState } from "@/components/common/error-state";
import { Button } from "@/components/ui/button";
import {
  APP_UPDATE_MESSAGES,
  isStaleActionError,
  markUpdateAvailable,
  UPDATE_TOAST_ID,
} from "@/lib/pwa/app-update";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // A form submitted from a page older than the live deployment: retrying here would send the
  // same unknown action again, only a reload helps.
  const stale = isStaleActionError(error);

  useEffect(() => {
    if (stale) {
      markUpdateAvailable();
      // This page already says it, with its own button: the toast would only repeat it.
      toast.dismiss(UPDATE_TOAST_ID);
      return;
    }
    // The server already logged the details; `digest` correlates with server logs.
    console.error("Unhandled UI error", error.digest ?? error.message);
  }, [error, stale]);

  if (stale) {
    return (
      <ErrorState
        title={APP_UPDATE_MESSAGES.title}
        description={APP_UPDATE_MESSAGES.boundary}
        action={
          <Button onClick={() => window.location.reload()}>{APP_UPDATE_MESSAGES.reloadPage}</Button>
        }
      />
    );
  }

  return <ErrorState action={<Button onClick={reset}>Thử lại</Button>} />;
}
