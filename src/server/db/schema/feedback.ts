import { sql } from "drizzle-orm";
import { check, index, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { primaryId, timestampTz } from "./_columns";
import { accounts } from "./accounts";

/**
 * Feedback a doctor sends to the admin from the app (spec feedback). A message to the admin,
 * not notebook data: it is left out of backups and imports, and outlives a deleted account
 * (`account_id` becomes null, shown as "Tài khoản đã xoá").
 */
export const feedback = pgTable(
  "feedback",
  {
    id: primaryId(),
    accountId: uuid().references(() => accounts.id, { onDelete: "set null" }),
    content: text().notNull(),
    /** `User-Agent` header read on the server, truncated; shown as a short device label. */
    userAgent: text(),
    /** Vercel deployment that served the request (null when running locally). */
    deploymentId: text(),
    /** `null` while the admin has not marked it seen ("Mới"). */
    seenAt: timestampTz(),
    createdAt: timestampTz().notNull().defaultNow(),
  },
  (table) => [
    index("feedback_created_at_idx").on(table.createdAt.desc()),
    index("feedback_account_id_created_at_idx").on(table.accountId, table.createdAt),
    check("feedback_content_length", sql`char_length(${table.content}) between 1 and 2000`),
  ],
).enableRLS();

export type FeedbackRow = typeof feedback.$inferSelect;
