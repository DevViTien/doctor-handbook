"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/common/error-state";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";

/** Reading the patients failed: keep the navigation, offer "Thử lại". No details are shown. */
export default function PatientsError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // The server already logged the details; `digest` correlates with server logs.
    console.error("Patients page error", error.digest ?? error.name);
  }, [error]);

  return (
    <PageContainer className="pt-4">
      <ErrorState
        className="rounded-2xl border bg-card"
        action={
          <Button variant="outline" className="h-11" onClick={retry}>
            Thử lại
          </Button>
        }
      />
    </PageContainer>
  );
}
