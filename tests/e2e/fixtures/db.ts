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

// The app's single normalization, so seeded rows are searchable exactly like real ones.
import { buildSearchText } from "@/lib/text/normalize-vi";

import { E2E_ACCESS_CODE_PEPPER, E2E_CLIENT_IP } from "./constants";
import { resetStorage } from "./storage";

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
  // The fake Storage holds the avatars of the rows about to be wiped.
  await resetStorage();
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

// --- Patients (change add-patient-records) --------------------------------------------

export type PatientSeed = {
  fullName: string;
  birthYear?: number;
  birthDate?: string;
  gender?: "male" | "female" | "other";
  hometown?: string;
  phone?: string;
  patientCode?: string;
  summary?: string;
  /** Added/edited that many minutes ago (the list puts the most recent first). Default 60. */
  minutesAgo?: number;
};

/** Inserts a patient owned by a sample account and returns its id. */
export async function insertPatient(owner: AccountKey, patient: PatientSeed): Promise<string> {
  const db = sql();
  const [row] = await db<{ id: string }[]>`
    INSERT INTO patients (
      account_id, full_name, birth_year, birth_date, gender, hometown, phone, patient_code,
      summary, search_text, created_at, updated_at
    )
    SELECT
      id, ${patient.fullName}, ${patient.birthYear ?? null}, ${patient.birthDate ?? null},
      ${patient.gender ?? null}, ${patient.hometown ?? null}, ${patient.phone ?? null},
      ${patient.patientCode ?? null}, ${patient.summary ?? null},
      ${buildSearchText(patient.fullName, patient.hometown, patient.phone, patient.patientCode)},
      now() - make_interval(mins => ${patient.minutesAgo ?? 60}),
      now() - make_interval(mins => ${patient.minutesAgo ?? 60})
    FROM accounts WHERE username = ${ACCOUNTS[owner].username}
    RETURNING id
  `;
  if (!row) throw new Error("insertPatient: no row returned");
  return row.id;
}

export type PatientDbRow = {
  id: string;
  full_name: string;
  birth_year: number | null;
  birth_date: string | null;
  gender: string | null;
  hometown: string | null;
  phone: string | null;
  patient_code: string | null;
  summary: string | null;
  search_text: string;
};

/** The patients of a sample account, oldest first. */
export async function listPatientRows(owner: AccountKey): Promise<PatientDbRow[]> {
  return sql()<PatientDbRow[]>`
    SELECT p.id, p.full_name, p.birth_year, p.birth_date::text AS birth_date, p.gender::text,
      p.hometown, p.phone, p.patient_code, p.summary, p.search_text
    FROM patients p JOIN accounts a ON a.id = p.account_id
    WHERE a.username = ${ACCOUNTS[owner].username}
    ORDER BY p.created_at, p.id
  `;
}

// --- Notes (change add-patient-notes) -------------------------------------------------

/**
 * Inserts a note on a patient (owner taken from the patient). `createdAt` is an ISO instant;
 * `editedAt` makes it an edited note (updated_at later than created_at).
 */
export async function insertNote(
  patientId: string,
  note: { content: string; createdAt?: string; editedAt?: string },
): Promise<string> {
  const createdAt = note.createdAt ?? new Date(Date.now() - 3_600_000).toISOString();
  const [row] = await sql()<{ id: string }[]>`
    INSERT INTO notes (patient_id, account_id, content, search_text, created_at, updated_at)
    SELECT id, account_id, ${note.content}, ${buildSearchText(note.content)}, ${createdAt}::timestamptz,
      ${note.editedAt ?? createdAt}::timestamptz
    FROM patients WHERE id = ${patientId}
    RETURNING id
  `;
  if (!row) throw new Error("insertNote: no row returned");
  return row.id;
}

export type NoteDbRow = {
  id: string;
  account_id: string;
  content: string;
  search_text: string;
  created_at: Date;
  updated_at: Date;
};

/** Notes of one patient, oldest first. */
export async function listNoteRows(patientId: string): Promise<NoteDbRow[]> {
  return sql()<NoteDbRow[]>`
    SELECT id, account_id, content, search_text, created_at, updated_at
    FROM notes WHERE patient_id = ${patientId} ORDER BY created_at, id
  `;
}

// --- Trash (change add-patient-trash) -------------------------------------------------

/** Puts a patient in the trash as if it was moved there `daysAgo` days ago. */
export async function trashPatient(id: string, daysAgo: number): Promise<void> {
  await sql()`
    UPDATE patients SET deleted_at = now() - make_interval(secs => ${daysAgo * 86_400})
    WHERE id = ${id}
  `;
}

/** A patient row (in the trash or not), or `undefined` when it no longer exists. */
export async function findPatient(id: string): Promise<{ deleted_at: Date | null } | undefined> {
  const [row] = await sql()<{ deleted_at: Date | null }[]>`
    SELECT deleted_at FROM patients WHERE id = ${id}
  `;
  return row;
}

// --- Backup (change add-data-backup) ---------------------------------------------------

/** Sets "lần sao lưu gần nhất" of an account to `daysAgo` days ago, or to never (`null`). */
export async function setLastBackup(key: AccountKey, daysAgo: number | null): Promise<void> {
  const username = ACCOUNTS[key].username;
  if (daysAgo === null) {
    await sql()`UPDATE accounts SET last_backup_at = NULL WHERE username = ${username}`;
    return;
  }
  await sql()`
    UPDATE accounts SET last_backup_at = now() - make_interval(secs => ${daysAgo * 86_400})
    WHERE username = ${username}
  `;
}

/** Makes an account look `daysAgo` days old. */
export async function setAccountCreated(key: AccountKey, daysAgo: number): Promise<void> {
  await sql()`
    UPDATE accounts SET created_at = now() - make_interval(secs => ${daysAgo * 86_400})
    WHERE username = ${ACCOUNTS[key].username}
  `;
}

export async function lastBackupAt(key: AccountKey): Promise<Date | null> {
  const [row] = await sql()<{ last_backup_at: Date | null }[]>`
    SELECT last_backup_at FROM accounts WHERE username = ${ACCOUNTS[key].username}
  `;
  return row?.last_backup_at ?? null;
}

/** Every note of an account, oldest first (content and timestamps only). */
export async function listAccountNotes(
  key: AccountKey,
): Promise<{ content: string; created_at: Date; updated_at: Date; search_text: string }[]> {
  return sql()`
    SELECT n.content, n.search_text,
      -- A backup keeps milliseconds (JSON dates); the database keeps microseconds.
      date_trunc('milliseconds', n.created_at) AS created_at,
      date_trunc('milliseconds', n.updated_at) AS updated_at
    FROM notes n JOIN accounts a ON a.id = n.account_id
    WHERE a.username = ${ACCOUNTS[key].username}
    ORDER BY n.created_at, n.content
  `;
}

/** Every patient of an account with the columns a backup must round-trip. */
export async function listPatientSnapshot(key: AccountKey): Promise<Record<string, unknown>[]> {
  return sql()`
    SELECT p.full_name, p.birth_year, p.birth_date::text AS birth_date, p.gender::text, p.hometown,
      p.phone, p.patient_code, p.summary, p.search_text,
      date_trunc('milliseconds', p.created_at) AS created_at,
      date_trunc('milliseconds', p.updated_at) AS updated_at,
      date_trunc('milliseconds', p.deleted_at) AS deleted_at
    FROM patients p JOIN accounts a ON a.id = p.account_id
    WHERE a.username = ${ACCOUNTS[key].username}
    ORDER BY p.created_at, p.full_name
  `;
}

// --- To-do list (change add-todo-list) ------------------------------------------------

/** Adds a to-do. `dueInDays` is relative to today in Vietnam (negative = overdue). */
export async function insertTodo(
  owner: AccountKey,
  todo: { content: string; dueInDays?: number; minutesAgo?: number; doneMinutesAgo?: number },
): Promise<string> {
  const [row] = await sql()<{ id: string }[]>`
    INSERT INTO todos (account_id, content, due_date, completed_at, created_at, updated_at)
    SELECT id, ${todo.content},
      CASE WHEN ${todo.dueInDays ?? null}::int IS NULL THEN NULL
        ELSE (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + ${todo.dueInDays ?? 0}::int END,
      CASE WHEN ${todo.doneMinutesAgo ?? null}::int IS NULL THEN NULL
        ELSE now() - make_interval(mins => ${todo.doneMinutesAgo ?? 0}) END,
      now() - make_interval(mins => ${todo.minutesAgo ?? 60}),
      now() - make_interval(mins => ${todo.minutesAgo ?? 60})
    FROM accounts WHERE username = ${ACCOUNTS[owner].username}
    RETURNING id
  `;
  if (!row) throw new Error("insertTodo: no row returned");
  return row.id;
}

export type TodoDbRow = {
  id: string;
  content: string;
  due_date: string | null;
  completed_at: Date | null;
};

/** The to-dos of a sample account, oldest first. */
export async function listTodoRows(owner: AccountKey): Promise<TodoDbRow[]> {
  return sql()<TodoDbRow[]>`
    SELECT t.id, t.content, t.due_date::text AS due_date, t.completed_at
    FROM todos t JOIN accounts a ON a.id = t.account_id
    WHERE a.username = ${ACCOUNTS[owner].username}
    ORDER BY t.created_at, t.id
  `;
}

// --- Avatars (change add-patient-avatars) -----------------------------------------------

/** Sets a patient's stored avatar path ("<accountId>/<hex>.webp"); returns it. */
export async function setAvatarPath(patientId: string, name: string): Promise<string> {
  const [row] = await sql()<{ path: string }[]>`
    UPDATE patients SET avatar_path = account_id::text || '/' || ${name}
    WHERE id = ${patientId} RETURNING avatar_path AS path
  `;
  if (!row) throw new Error("setAvatarPath: no such patient");
  return row.path;
}

export async function avatarPathOf(patientId: string): Promise<string | null> {
  const [row] = await sql()<{ path: string | null }[]>`
    SELECT avatar_path AS path FROM patients WHERE id = ${patientId}
  `;
  return row?.path ?? null;
}

export async function accountIdOf(key: AccountKey): Promise<string> {
  const [row] = await sql()<{ id: string }[]>`
    SELECT id FROM accounts WHERE username = ${ACCOUNTS[key].username}
  `;
  if (!row) throw new Error("accountIdOf: no such account");
  return row.id;
}

// --- Account deletion (change add-account-deletion) ---------------------------------------

/** Everything an account owns, by id (the username is gone once the account is deleted). */
export async function countOwnedRows(accountId: string) {
  const [row] = await sql()<
    { accounts: number; patients: number; notes: number; todos: number; codes: number }[]
  >`
    SELECT
      (SELECT count(*)::int FROM accounts WHERE id = ${accountId}) AS accounts,
      (SELECT count(*)::int FROM patients WHERE account_id = ${accountId}) AS patients,
      (SELECT count(*)::int FROM notes WHERE account_id = ${accountId}) AS notes,
      (SELECT count(*)::int FROM todos WHERE account_id = ${accountId}) AS todos,
      (SELECT count(*)::int FROM access_codes WHERE account_id = ${accountId}) AS codes
  `;
  if (!row) throw new Error("countOwnedRows: no row returned");
  return row;
}

// --- Feedback (change add-feedback) ------------------------------------------------------

/** Inserts feedback sent by a sample account `minutesAgo` ago; returns its id. */
export async function seedFeedback(
  from: AccountKey,
  content: string,
  options: { minutesAgo?: number; seen?: boolean; userAgent?: string } = {},
): Promise<string> {
  const [row] = await sql()<{ id: string }[]>`
    INSERT INTO feedback (account_id, content, user_agent, seen_at, created_at)
    SELECT id, ${content}, ${options.userAgent ?? null},
      ${options.seen ? sql()`now()` : null},
      now() - make_interval(mins => ${options.minutesAgo ?? 5})
    FROM accounts WHERE username = ${ACCOUNTS[from].username}
    RETURNING id
  `;
  if (!row) throw new Error("seedFeedback: no row returned");
  return row.id;
}

export type FeedbackDbRow = {
  id: string;
  username: string | null;
  content: string;
  user_agent: string | null;
  seen_at: Date | null;
};

/** Every feedback row, newest first, with the sender's username (null once deleted). */
export async function listFeedbackRows(): Promise<FeedbackDbRow[]> {
  return sql()<FeedbackDbRow[]>`
    SELECT f.id, a.username, f.content, f.user_agent, f.seen_at
    FROM feedback f LEFT JOIN accounts a ON a.id = f.account_id
    ORDER BY f.created_at DESC, f.id
  `;
}

export async function deleteFeedbackRow(id: string): Promise<void> {
  await sql()`DELETE FROM feedback WHERE id = ${id}`;
}

export async function closeDatabase(): Promise<void> {
  await client?.end();
  client = undefined;
}
