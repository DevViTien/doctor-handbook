import { routes } from "@/config/routes";
import { DEFAULT_ERROR_MESSAGES, type ErrorCode } from "@/lib/errors";
import type { DeepSearchResult } from "@/modules/search/types";

export type DeepSearchResponse =
  { ok: true; data: DeepSearchResult } | { ok: false; error: { code: ErrorCode; message: string } };

/**
 * Calls the deep search Route Handler (design §3). The query goes in the POST body, never the
 * URL. Rejects when the request did not complete (network lost, aborted): the caller decides
 * whether that means "offline" or "superseded by a newer query".
 */
export async function fetchDeepSearch(
  query: string,
  signal: AbortSignal,
): Promise<DeepSearchResponse> {
  const response = await fetch(routes.api.patientSearch, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
    signal,
    cache: "no-store",
  });
  if (response.ok) return { ok: true, data: (await response.json()) as DeepSearchResult };

  const body = (await response.json().catch(() => null)) as {
    error?: { code?: ErrorCode; message?: string };
  } | null;
  const code = body?.error?.code ?? "INTERNAL";
  return {
    ok: false,
    error: { code, message: body?.error?.message ?? DEFAULT_ERROR_MESSAGES[code] },
  };
}
