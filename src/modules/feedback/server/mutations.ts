import "server-only";

import { and, count, eq, gt, isNull, sql } from "drizzle-orm";

import { AppError } from "@/lib/errors";
import { FEEDBACK_LIMITS, FEEDBACK_MESSAGES } from "@/modules/feedback/constants";
import type { AuthContext } from "@/server/auth/session";
import { type DbExecutor, getDb } from "@/server/db/client";
import { accounts, feedback } from "@/server/db/schema";

/** Writes of the feedback module (spec feedback). */

/** What the server adds to a feedback; never sent by the browser. */
export type FeedbackMeta = { userAgent: string | null; deploymentId: string | null };

/**
 * Saves a doctor's feedback, signed with the SESSION's account (idea.md S3). Refuses the 21st
 * one in 24 hours. The sender's own account row is locked first, so two sends at the same time
 * cannot both slip under the limit. Returns the new id.
 */
export async function sendFeedback(
  auth: AuthContext,
  input: { content: string },
  meta: FeedbackMeta,
  db: DbExecutor = getDb(),
): Promise<string> {
  const accountId = auth.account.id;
  return db.transaction(async (tx) => {
    const [me] = await tx
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.id, accountId))
      // NO KEY UPDATE: serializes this account's sends without blocking its other inserts
      // (patients, sessions) that only check the foreign key.
      .for("no key update");
    if (!me) throw new AppError("UNAUTHENTICATED");

    const [recent] = await tx
      .select({ total: count() })
      .from(feedback)
      .where(
        and(
          eq(feedback.accountId, accountId),
          gt(feedback.createdAt, sql`now() - interval '24 hours'`),
        ),
      );
    if ((recent?.total ?? 0) >= FEEDBACK_LIMITS.perDay) {
      throw new AppError("RATE_LIMITED", FEEDBACK_MESSAGES.rateLimited);
    }

    const [row] = await tx
      .insert(feedback)
      .values({
        accountId,
        content: input.content,
        userAgent: meta.userAgent?.slice(0, FEEDBACK_LIMITS.userAgent) || null,
        deploymentId: meta.deploymentId || null,
      })
      .returning({ id: feedback.id });
    if (!row) throw new AppError("INTERNAL");
    return row.id;
  });
}

/** Admin: drops the "Mới" label. Already seen is fine; a feedback that is gone is NOT_FOUND. */
export async function markFeedbackSeen(id: string, db: DbExecutor = getDb()): Promise<void> {
  const updated = await db
    .update(feedback)
    .set({ seenAt: sql`now()` })
    .where(and(eq(feedback.id, id), isNull(feedback.seenAt)))
    .returning({ id: feedback.id });
  if (updated.length > 0) return;

  const [exists] = await db.select({ id: feedback.id }).from(feedback).where(eq(feedback.id, id));
  if (!exists) throw new AppError("NOT_FOUND", FEEDBACK_MESSAGES.notFound);
}

/** Admin: deletes one feedback for good (no trash). */
export async function deleteFeedback(id: string, db: DbExecutor = getDb()): Promise<void> {
  const deleted = await db
    .delete(feedback)
    .where(eq(feedback.id, id))
    .returning({ id: feedback.id });
  if (deleted.length === 0) throw new AppError("NOT_FOUND", FEEDBACK_MESSAGES.notFound);
}
