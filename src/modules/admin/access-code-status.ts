/**
 * The single status of an access code, in the priority order of spec access-codes:
 * revoked, then used, then expired, then active. A code is usable only while `active`
 * (the server checks the same conditions in SQL: not used, not revoked, `expires_at > now`).
 */
export type AccessCodeStatus = "revoked" | "used" | "expired" | "active";

export type AccessCodeStatusInput = {
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
};

export function getAccessCodeStatus(code: AccessCodeStatusInput, now: Date): AccessCodeStatus {
  if (code.revokedAt) return "revoked";
  if (code.usedAt) return "used";
  if (code.expiresAt.getTime() <= now.getTime()) return "expired";
  return "active";
}
