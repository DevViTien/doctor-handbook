import "server-only";

import { eq } from "drizzle-orm";

import type { TodoItem } from "@/modules/todos/types";
import type { AuthContext } from "@/server/auth/session";
import { type DbExecutor, getDb } from "@/server/db/client";
import { todos } from "@/server/db/schema";

/** Reads of the todos module, always scoped to the SESSION's account (idea.md S3, BR5). */

export const todoColumns = {
  id: todos.id,
  content: todos.content,
  dueDate: todos.dueDate,
  completedAt: todos.completedAt,
  createdAt: todos.createdAt,
};

export function toTodoItem(row: {
  id: string;
  content: string;
  dueDate: string | null;
  completedAt: Date | null;
  createdAt: Date;
}): TodoItem {
  return {
    id: row.id,
    content: row.content,
    dueDate: row.dueDate,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Every to-do of the account. The order is the UI's (`due.ts`), so moves need no refetch. */
export async function listTodos(auth: AuthContext, db: DbExecutor = getDb()): Promise<TodoItem[]> {
  const rows = await db.select(todoColumns).from(todos).where(eq(todos.accountId, auth.account.id));
  return rows.map(toTodoItem);
}
