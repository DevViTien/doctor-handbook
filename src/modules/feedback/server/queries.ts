import "server-only";

import { count, desc, eq, isNull } from "drizzle-orm";

import { FEEDBACK_LIMITS } from "@/modules/feedback/constants";
import { type DbExecutor, getDb } from "@/server/db/client";
import { accounts, feedback } from "@/server/db/schema";

/**
 * One feedback in the admin's inbox. From `accounts` only the sender's names (null once the
 * account is deleted); never a join to patients, notes or to-dos (idea.md N6).
 */
export type FeedbackListItem = {
  id: string;
  content: string;
  userAgent: string | null;
  seenAt: Date | null;
  createdAt: Date;
  senderName: string | null;
  senderUsername: string | null;
};

export type FeedbackInbox = { items: FeedbackListItem[]; unseen: number; total: number };

/** Admin: the newest feedback first, plus how many are unseen and in all. */
export async function listFeedback(db: DbExecutor = getDb()): Promise<FeedbackInbox> {
  const [items, [unseen], [total]] = await Promise.all([
    db
      .select({
        id: feedback.id,
        content: feedback.content,
        userAgent: feedback.userAgent,
        seenAt: feedback.seenAt,
        createdAt: feedback.createdAt,
        senderName: accounts.displayName,
        senderUsername: accounts.username,
      })
      .from(feedback)
      .leftJoin(accounts, eq(feedback.accountId, accounts.id))
      .orderBy(desc(feedback.createdAt), desc(feedback.id))
      .limit(FEEDBACK_LIMITS.list),
    db.select({ n: count() }).from(feedback).where(isNull(feedback.seenAt)),
    db.select({ n: count() }).from(feedback),
  ]);
  return { items, unseen: unseen?.n ?? 0, total: total?.n ?? 0 };
}
