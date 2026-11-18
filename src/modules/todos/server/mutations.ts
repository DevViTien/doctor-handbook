import "server-only";

import { and, eq, isNotNull, sql } from "drizzle-orm";

import { todoColumns, toTodoItem } from "@/modules/todos/server/queries";
import type { TodoItem } from "@/modules/todos/types";
import type { AuthContext } from "@/server/auth/session";
import { type DbExecutor, getDb } from "@/server/db/client";
import { todos } from "@/server/db/schema";

/** Writes of the todos module, always scoped to the SESSION's account (idea.md S3, BR5). */

const owned = (auth: AuthContext, id: string) =>
  and(eq(todos.id, id), eq(todos.accountId, auth.account.id));

/**
 * Adds a to-do with the id the browser made (design §2): sending the same add again updates
 * that same row, so a lost answer never makes a duplicate. `createdAt` / `completedAt` are only given by "Hoàn
 * tác" and are clamped to now. `null` when the id belongs to another account (a tampered client).
 */
export async function insertTodo(
  auth: AuthContext,
  input: {
    id: string;
    content: string;
    dueDate: string | null;
    completedAt?: string | null;
    createdAt?: string;
  },
  db: DbExecutor = getDb(),
): Promise<TodoItem | null> {
  const createdAt = input.createdAt ?? null;
  const completedAt = input.completedAt ?? null;
  await db
    .insert(todos)
    .values({
      id: input.id,
      accountId: auth.account.id,
      content: input.content,
      dueDate: input.dueDate,
      // LEAST skips NULL: keep an open to-do open.
      completedAt: completedAt === null ? null : sql`least(${completedAt}::timestamptz, now())`,
      createdAt: sql`least(coalesce(${createdAt}::timestamptz, now()), now())`,
    })
    // The same add sent again (lost answer) may carry an edited due date: keep the latest.
    // Only a row of THIS account is touched; another account's id writes nothing.
    .onConflictDoUpdate({
      target: todos.id,
      set: { content: input.content, dueDate: input.dueDate },
      setWhere: eq(todos.accountId, auth.account.id),
    });

  const [row] = await db.select(todoColumns).from(todos).where(owned(auth, input.id));
  return row ? toTodoItem(row) : null;
}

export async function updateTodo(
  auth: AuthContext,
  input: { id: string; content: string; dueDate: string | null },
  db: DbExecutor = getDb(),
): Promise<TodoItem | null> {
  const [row] = await db
    .update(todos)
    .set({ content: input.content, dueDate: input.dueDate })
    .where(owned(auth, input.id))
    .returning(todoColumns);
  return row ? toTodoItem(row) : null;
}

/** Done keeps the first completion time (a second tap does not reorder); open clears it. */
export async function setTodoDone(
  auth: AuthContext,
  input: { id: string; done: boolean },
  db: DbExecutor = getDb(),
): Promise<TodoItem | null> {
  const [row] = await db
    .update(todos)
    .set({ completedAt: input.done ? sql`coalesce(${todos.completedAt}, now())` : null })
    .where(owned(auth, input.id))
    .returning(todoColumns);
  return row ? toTodoItem(row) : null;
}

export async function deleteTodo(
  auth: AuthContext,
  id: string,
  db: DbExecutor = getDb(),
): Promise<boolean> {
  const rows = await db.delete(todos).where(owned(auth, id)).returning({ id: todos.id });
  return rows.length > 0;
}

/** Deletes every completed to-do of the account; returns how many. */
export async function deleteCompletedTodos(
  auth: AuthContext,
  db: DbExecutor = getDb(),
): Promise<number> {
  const rows = await db
    .delete(todos)
    .where(and(eq(todos.accountId, auth.account.id), isNotNull(todos.completedAt)))
    .returning({ id: todos.id });
  return rows.length;
}
