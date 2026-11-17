import { sql } from "drizzle-orm";
import { check, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

import { primaryId, timestamps, timestampTz } from "./_columns";
import { accountRoleEnum, accountStatusEnum } from "./enums";

/**
 * Admin and doctor accounts. Admin accounts never own patient data (idea.md N6).
 */
export const accounts = pgTable(
  "accounts",
  {
    id: primaryId(),
    role: accountRoleEnum().notNull(),
    /** Case-insensitive login name, always stored lowercase (enforced by a CHECK). */
    username: text().notNull(),
    displayName: text().notNull(),
    passwordHash: text().notNull(),
    status: accountStatusEnum().notNull().default("active"),
    /** When the doctor accepted the usage notice shown at activation. */
    termsAcceptedAt: timestampTz(),
    lastLoginAt: timestampTz(),
    /** Drives the "back up your data" reminder. */
    lastBackupAt: timestampTz(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("accounts_username_key").on(table.username),
    check("accounts_username_lowercase", sql`${table.username} = lower(${table.username})`),
  ],
).enableRLS();

export type AccountRow = typeof accounts.$inferSelect;
export type NewAccountRow = typeof accounts.$inferInsert;
