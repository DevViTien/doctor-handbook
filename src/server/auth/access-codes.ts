import "server-only";

import { and, gt, isNull, sql } from "drizzle-orm";

import { accessCodes } from "@/server/db/schema";

/**
 * The single SQL definition of "this access code can still be used": not used, not revoked,
 * not expired (database clock). Activation consumes only such codes and the admin revokes only
 * such codes. Its TypeScript twin for display is `getAccessCodeStatus(...) === "active"` in
 * src/modules/admin/access-code-status.ts: keep both in step.
 */
export function accessCodeIsUsable() {
  return and(
    isNull(accessCodes.usedAt),
    isNull(accessCodes.revokedAt),
    gt(accessCodes.expiresAt, sql`now()`),
  );
}
