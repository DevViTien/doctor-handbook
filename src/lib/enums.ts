/**
 * Domain enumerations shared by the database schema (server) and the UI (client).
 * The database enums in `src/server/db/schema/enums.ts` are derived from these arrays,
 * so adding a value here is the only change needed outside of a migration.
 */

export const ACCOUNT_ROLES = ["admin", "doctor"] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];

export const ACCOUNT_STATUSES = ["active", "locked"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const ACCESS_CODE_TYPES = ["activation", "password_reset"] as const;
export type AccessCodeType = (typeof ACCESS_CODE_TYPES)[number];

export const GENDERS = ["male", "female", "other"] as const;
export type Gender = (typeof GENDERS)[number];
