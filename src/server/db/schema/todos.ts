import { date, index, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { primaryId, timestamps, timestampTz } from "./_columns";
import { accounts } from "./accounts";

/** A doctor's simple to-do list (idea.md D5, D15). */
export const todos = pgTable(
  "todos",
  {
    id: primaryId(),
    accountId: uuid()
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    content: text().notNull(),
    /** Optional due date (calendar day in Vietnam time, no reminder). */
    dueDate: date({ mode: "string" }),
    /** `null` while open. */
    completedAt: timestampTz(),
    ...timestamps,
  },
  (table) => [index("todos_account_id_completed_at_idx").on(table.accountId, table.completedAt)],
).enableRLS();

export type TodoRow = typeof todos.$inferSelect;
