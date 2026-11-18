/**
 * Direct database access for E2E tests (design §7 of change add-account-login).
 *
 * Uses `postgres` + `@node-rs/argon2` directly instead of `src/server/*` (those are
 * `server-only`). Runs ONLY against `E2E_DATABASE_URL`, a database dedicated to tests: every
 * reset wipes the accounts table.
 */
import { createHash, createHmac, randomInt } from "node:crypto";

import { hash } from "@node-rs/argon2";
import postgres from "postgres";

import { E2E_ACCESS_CODE_PEPPER, E2E_CLIENT_IP } from "./constants";

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

/** Fresh state: the four sample accounts, no sessions, no access codes, no recorded failures. */
export async function resetDatabase(): Promise<void> {
  const db = sql();
  await db`TRUNCATE accounts, access_codes, auth_attempts RESTART IDENTITY CASCADE`;
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

// --- Accounts (change add-account-management) -----------------------------------------

/**
 * Inserts an extra doctor account (password "Extra-Pass-123"). `lastLoginAt: null` gives a
 * doctor who never signed in; by default the last login is one hour ago.
 */
export async function insertDoctor(options: {
  username: string;
  displayName: string;
  lastLoginAt?: null;
}): Promise<string> {
  const db = sql();
  const passwordHash = await hash("Extra-Pass-123");
  const [row] = await db<{ id: string }[]>`
    INSERT INTO accounts (role, username, display_name, password_hash, status, last_login_at)
    VALUES (
      'doctor', ${options.username}, ${options.displayName}, ${passwordHash}, 'active',
      ${options.lastLoginAt === null ? null : db`now() - interval '1 hour'`}
    )
    RETURNING id
  `;
  if (!row) throw new Error("insertDoctor: no row returned");
  return row.id;
}

/** Removes every doctor account (the admin stays), for the empty-list scenario. */
export async function deleteDoctorAccounts(): Promise<void> {
  await sql()`DELETE FROM accounts WHERE role = 'doctor'`;
}

export async function countSessions(key: AccountKey): Promise<number> {
  const [row] = await sql()<{ count: number }[]>`
    SELECT count(*)::int AS count FROM sessions s
    JOIN accounts a ON a.id = s.account_id
    WHERE a.username = ${ACCOUNTS[key].username}
  `;
  return row?.count ?? 0;
}

export async function accountStatus(key: AccountKey): Promise<string | undefined> {
  const [row] = await sql()<{ status: string }[]>`
    SELECT status FROM accounts WHERE username = ${ACCOUNTS[key].username}
  `;
  return row?.status;
}

// --- Access codes (change add-account-activation) ---------------------------------------

/** Same alphabet, normalization and HMAC as src/server/auth/crypto.ts. */
const ACCESS_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const ACCESS_CODE_TTL_HOURS = 72;

export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function formatCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

function hashCode(code: string): string {
  return createHmac("sha256", E2E_ACCESS_CODE_PEPPER).update(normalizeCode(code)).digest("hex");
}

function randomCode(): string {
  let code = "";
  for (let i = 0; i < 8; i++) code += ACCESS_CODE_ALPHABET[randomInt(ACCESS_CODE_ALPHABET.length)];
  return code;
}

export type InsertedAccessCode = { id: string; code: string; formatted: string };

/**
 * Inserts an access code directly (bypassing the admin UI) and returns the raw code.
 * `createdMinutesAgo` past 72 hours gives an expired code.
 */
export async function insertAccessCode(
  options: {
    recipient?: string;
    type?: "activation" | "password_reset";
    createdMinutesAgo?: number;
    usedBy?: AccountKey;
    /** Password reset: the account the code is for (default `lan`). */
    forAccount?: AccountKey;
    revoked?: boolean;
  } = {},
): Promise<InsertedAccessCode> {
  const {
    recipient = "BS. Trần Thị B",
    type = "activation",
    createdMinutesAgo = 0,
    usedBy,
    forAccount,
    revoked = false,
  } = options;
  const code = randomCode();
  const db = sql();
  const accountKey = usedBy ?? forAccount ?? (type === "password_reset" ? "lan" : undefined);
  const [account] = accountKey
    ? await db<
        { id: string }[]
      >`SELECT id FROM accounts WHERE username = ${ACCOUNTS[accountKey].username}`
    : [];

  const [row] = await db<{ id: string }[]>`
    INSERT INTO access_codes (type, code_hash, recipient_name, account_id, expires_at, used_at, revoked_at, created_at)
    VALUES (
      ${type}, ${hashCode(code)}, ${recipient}, ${account?.id ?? null},
      now() - make_interval(mins => ${createdMinutesAgo}) + make_interval(hours => ${ACCESS_CODE_TTL_HOURS}),
      ${usedBy ? db`now()` : null},
      ${revoked ? db`now()` : null},
      now() - make_interval(mins => ${createdMinutesAgo})
    )
    RETURNING id
  `;
  if (!row) throw new Error("insertAccessCode: no row returned");
  return { id: row.id, code, formatted: formatCode(code) };
}

/** Revokes a code as the admin would (used to simulate a revoke while a doctor fills the form). */
export async function revokeAccessCodeInDb(id: string): Promise<void> {
  await sql()`UPDATE access_codes SET revoked_at = now() WHERE id = ${id}`;
}

/** Marks a code as used by a sample account, as an activation in another browser would. */
export async function markAccessCodeUsed(id: string, by: AccountKey): Promise<void> {
  await sql()`
    UPDATE access_codes
    SET used_at = now(),
        account_id = (SELECT id FROM accounts WHERE username = ${ACCOUNTS[by].username})
    WHERE id = ${id}
  `;
}

export type AccessCodeDbRow = Record<string, unknown> & {
  id: string;
  used_at: Date | null;
  revoked_at: Date | null;
  account_id: string | null;
};

export async function listAccessCodeRows(): Promise<AccessCodeDbRow[]> {
  return sql()<AccessCodeDbRow[]>`SELECT * FROM access_codes ORDER BY created_at DESC`;
}

export async function countAccessCodes(): Promise<number> {
  const [row] = await sql()<{ count: number }[]>`SELECT count(*)::int AS count FROM access_codes`;
  return row?.count ?? 0;
}

export type AccountDbRow = {
  id: string;
  role: string;
  status: string;
  display_name: string;
  terms_accepted_at: Date | null;
};

export async function findAccountByUsername(username: string): Promise<AccountDbRow | undefined> {
  const [row] = await sql()<AccountDbRow[]>`
    SELECT id, role, status, display_name, terms_accepted_at FROM accounts WHERE username = ${username}
  `;
  return row;
}

export async function countAccounts(): Promise<number> {
  const [row] = await sql()<{ count: number }[]>`SELECT count(*)::int AS count FROM accounts`;
  return row?.count ?? 0;
}

/** Same key format as `codeAttemptKey` in src/modules/auth/server/rate-limit.ts. */
function codeAttemptKey(ip: string): string {
  return `code:ip:${createHash("sha256").update(ip).digest("hex")}`;
}

/** Inserts failed code entries from the E2E client IP, as if they happened `minutesAgo` ago. */
export async function insertCodeFailures(count: number, minutesAgo: number): Promise<void> {
  const attemptKey = codeAttemptKey(E2E_CLIENT_IP);
  for (let i = 0; i < count; i++) {
    await sql()`
      INSERT INTO auth_attempts (key, created_at)
      VALUES (${attemptKey}, now() - make_interval(mins => ${minutesAgo}))
    `;
  }
}

/** Forgets every recorded login and code-entry attempt (ends any rate-limit window). */
export async function clearAuthAttempts(): Promise<void> {
  await sql()`DELETE FROM auth_attempts`;
}

export async function countAuthAttempts(): Promise<number> {
  const [row] = await sql()<{ count: number }[]>`SELECT count(*)::int AS count FROM auth_attempts`;
  return row?.count ?? 0;
}

export async function closeDatabase(): Promise<void> {
  await client?.end();
  client = undefined;
}
