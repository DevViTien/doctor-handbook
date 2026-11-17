import { sql } from "drizzle-orm";
import { bigint, check, index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { primaryId, timestampTz } from "./_columns";
import { accounts } from "./accounts";
import { accessCodeTypeEnum } from "./enums";

/**
 * Login sessions. Sessions never expire on their own (idea.md D13); they end on logout,
 * password change/reset or account lock — which is why they must live in the database.
 */
export const sessions = pgTable(
  "sessions",
  {
    /** SHA-256 (hex) of the session token. The raw token only exists in the cookie. */
    id: text().primaryKey(),
    accountId: uuid()
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    userAgent: text(),
    createdAt: timestampTz().notNull().defaultNow(),
    lastUsedAt: timestampTz().notNull().defaultNow(),
  },
  (table) => [index("sessions_account_id_idx").on(table.accountId)],
).enableRLS();

/**
 * One-time codes issued by the admin: account activation and password reset.
 * Valid for 72 hours (idea.md D17).
 */
export const accessCodes = pgTable(
  "access_codes",
  {
    id: primaryId(),
    type: accessCodeTypeEnum().notNull(),
    /** HMAC-SHA256 of the code keyed with ACCESS_CODE_PEPPER (`hashAccessCode`). */
    codeHash: text().notNull(),
    /** Who the admin issued the code for (free text, e.g. "BS. Trần Thị B"). */
    recipientName: text().notNull(),
    /** Password reset: the target account. Activation: the account created with the code. */
    accountId: uuid().references(() => accounts.id, { onDelete: "cascade" }),
    createdById: uuid().references(() => accounts.id, { onDelete: "set null" }),
    expiresAt: timestampTz().notNull(),
    usedAt: timestampTz(),
    revokedAt: timestampTz(),
    createdAt: timestampTz().notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("access_codes_code_hash_key").on(table.codeHash),
    check(
      "access_codes_reset_has_account",
      sql`${table.type} <> 'password_reset' OR ${table.accountId} IS NOT NULL`,
    ),
  ],
).enableRLS();

/**
 * Failed attempts used for rate limiting (login, code entry). Kept in PostgreSQL to avoid
 * another service; pruned daily by the maintenance cron (`pruneAuthAttempts`).
 */
export const authAttempts = pgTable(
  "auth_attempts",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    /** e.g. "login:<ip>:<username>" or "code:<ip>". */
    key: text().notNull(),
    createdAt: timestampTz().notNull().defaultNow(),
  },
  (table) => [
    index("auth_attempts_key_created_at_idx").on(table.key, table.createdAt),
    index("auth_attempts_created_at_idx").on(table.createdAt),
  ],
).enableRLS();

export type SessionRow = typeof sessions.$inferSelect;
export type AccessCodeRow = typeof accessCodes.$inferSelect;
