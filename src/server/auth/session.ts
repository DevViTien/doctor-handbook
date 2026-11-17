import "server-only";

import { and, eq, ne } from "drizzle-orm";

import type { AccountRole } from "@/lib/enums";
import { type DbExecutor, getDb } from "@/server/db/client";
import { accounts, sessions } from "@/server/db/schema";

import { SESSION_TOUCH_INTERVAL_MS } from "./constants";
import { generateSessionToken, sha256Hex } from "./crypto";

/** The account fields every authenticated request may rely on. No secrets. */
export type SessionAccount = {
  id: string;
  role: AccountRole;
  username: string;
  displayName: string;
};

export type AuthContext = {
  sessionId: string;
  account: SessionAccount;
};

/** Creates a session and returns the raw token to put in the cookie. */
export async function createSession(
  accountId: string,
  meta: { userAgent?: string | null } = {},
  db: DbExecutor = getDb(),
): Promise<{ token: string; sessionId: string }> {
  const token = generateSessionToken();
  const sessionId = sha256Hex(token);

  await db.insert(sessions).values({ id: sessionId, accountId, userAgent: meta.userAgent ?? null });

  return { token, sessionId };
}

/**
 * Resolves a cookie token into an auth context, or `null` when the session does not exist
 * or the account is locked. Sessions have no expiry (idea.md D13).
 */
export async function validateSessionToken(token: string): Promise<AuthContext | null> {
  const db = getDb();
  const sessionId = sha256Hex(token);

  const [row] = await db
    .select({
      lastUsedAt: sessions.lastUsedAt,
      account: {
        id: accounts.id,
        role: accounts.role,
        username: accounts.username,
        displayName: accounts.displayName,
        status: accounts.status,
      },
    })
    .from(sessions)
    .innerJoin(accounts, eq(sessions.accountId, accounts.id))
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!row || row.account.status !== "active") return null;

  if (Date.now() - row.lastUsedAt.getTime() > SESSION_TOUCH_INTERVAL_MS) {
    await db.update(sessions).set({ lastUsedAt: new Date() }).where(eq(sessions.id, sessionId));
  }

  const { status: _status, ...account } = row.account;
  return { sessionId, account };
}

export async function invalidateSession(sessionId: string, db: DbExecutor = getDb()) {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

/**
 * Ends every session of an account — on lock and password reset — or every *other*
 * session when `exceptSessionId` is given (password change on the current device).
 */
export async function invalidateAccountSessions(
  accountId: string,
  options: { exceptSessionId?: string } = {},
  db: DbExecutor = getDb(),
) {
  const byAccount = eq(sessions.accountId, accountId);
  await db
    .delete(sessions)
    .where(
      options.exceptSessionId
        ? and(byAccount, ne(sessions.id, options.exceptSessionId))
        : byAccount,
    );
}
