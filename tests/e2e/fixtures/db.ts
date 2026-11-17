/**
 * Direct database access for E2E tests (design §7 of change add-account-login).
 *
 * Uses `postgres` + `@node-rs/argon2` directly instead of `src/server/*` (those are
 * `server-only`). Runs ONLY against `E2E_DATABASE_URL`, a database dedicated to tests: every
 * reset wipes the accounts table.
 */
import { createHash } from "node:crypto";

import { hash } from "@node-rs/argon2";
import postgres from "postgres";

export const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL;
export const hasDatabase = Boolean(E2E_DATABASE_URL);
export const SKIP_WITHOUT_DATABASE = "Needs E2E_DATABASE_URL (a PostgreSQL database for tests)";

export const SESSION_COOKIE = "dh_session";

export const ACCOUNTS = {
  admin: { username: "admin", password: "admin-e2e-password", role: "admin", name: "Quản trị" },
  lan: { username: "bs.lan", password: "LanPass-123", role: "doctor", name: "Nguyễn Thị Lan" },
  minh: { username: "bs.minh", password: "MinhPass-123", role: "doctor", name: "Trần Văn Minh" },
  locked: { username: "bs.khoa", password: "KhoaPass-123", role: "doctor", name: "Lê Văn Khoa" },
} as const;

type AccountKey = keyof typeof ACCOUNTS;

let client: postgres.Sql | undefined;

/**
 * Allow-list guard: the fixtures TRUNCATE accounts (cascading to every patient), so they only
 * touch a database that is unmistakably a test one. A deny-list of hosts is not enough (Supabase
 * alone has `*.supabase.co` and `*.pooler.supabase.com`).
 */
function assertTestDatabase(url: string): void {
  const parsed = new URL(url);
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  const refuse = (reason: string) => {
    throw new Error(`Refusing to wipe E2E_DATABASE_URL: ${reason}. Use a dedicated test database.`);
  };

  if (!/_(e2e|test)$/.test(databaseName)) {
    refuse(`database name "${databaseName}" must end with "_e2e" or "_test"`);
  }
  if (/supabase\.(co|com)$/.test(parsed.hostname)) refuse("it is a Supabase host");
  if ([process.env.DATABASE_URL, process.env.DIRECT_DATABASE_URL].includes(url)) {
    refuse("it is the application database");
  }
}

function sql(): postgres.Sql {
  if (!E2E_DATABASE_URL) throw new Error(SKIP_WITHOUT_DATABASE);
  if (!client) {
    assertTestDatabase(E2E_DATABASE_URL);
    client = postgres(E2E_DATABASE_URL, { max: 1, onnotice: () => {} });
  }
  return client;
}

const passwordHashes = new Map<AccountKey, Promise<string>>();
function passwordHash(key: AccountKey): Promise<string> {
  let hashed = passwordHashes.get(key);
  if (!hashed) {
    hashed = hash(ACCOUNTS[key].password);
    passwordHashes.set(key, hashed);
  }
  return hashed;
}

/** Fresh state: the four sample accounts, no sessions, no recorded failures. */
export async function resetDatabase(): Promise<void> {
  const db = sql();
  await db`TRUNCATE accounts, auth_attempts RESTART IDENTITY CASCADE`;
  for (const key of Object.keys(ACCOUNTS) as AccountKey[]) {
    const account = ACCOUNTS[key];
    const status = key === "locked" ? "locked" : "active";
    await db`
      INSERT INTO accounts (role, username, display_name, password_hash, status)
      VALUES (${account.role}, ${account.username}, ${account.name}, ${await passwordHash(key)}, ${status})
    `;
  }
}

export async function setAccountStatus(key: AccountKey, status: "active" | "locked") {
  await sql()`UPDATE accounts SET status = ${status} WHERE username = ${ACCOUNTS[key].username}`;
}

/** Same key format as `loginAttemptKeys` in src/modules/auth/server/rate-limit.ts. */
function usernameAttemptKey(username: string): string {
  return `login:user:${createHash("sha256").update(username).digest("hex")}`;
}

/** Inserts failed logins for a username, as if they happened `minutesAgo` minutes ago. */
export async function insertUsernameFailures(key: AccountKey, count: number, minutesAgo: number) {
  const attemptKey = usernameAttemptKey(ACCOUNTS[key].username);
  for (let i = 0; i < count; i++) {
    await sql()`
      INSERT INTO auth_attempts (key, created_at)
      VALUES (${attemptKey}, now() - make_interval(mins => ${minutesAgo}))
    `;
  }
}

export async function countAuthAttempts(): Promise<number> {
  const [row] = await sql()<{ count: number }[]>`SELECT count(*)::int AS count FROM auth_attempts`;
  return row?.count ?? 0;
}

export async function closeDatabase(): Promise<void> {
  await client?.end();
  client = undefined;
}
