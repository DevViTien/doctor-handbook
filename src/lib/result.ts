import type { ActionError } from "@/lib/errors";

/**
 * Discriminated result returned by every Server Action.
 * Actions never throw to the client: expected failures travel as `{ ok: false }`.
 */
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(error: ActionError): ActionResult<never> {
  return { ok: false, error };
}
