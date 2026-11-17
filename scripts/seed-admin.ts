/**
 * Creates the admin account, or resets its password.
 *
 *   pnpm db:seed-admin                    # create if missing (idempotent)
 *   pnpm db:seed-admin --reset-password   # set ADMIN_PASSWORD and end all admin sessions
 *
 * Reads ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_DISPLAY_NAME and DIRECT_DATABASE_URL
 * (falls back to DATABASE_URL) from the environment; the npm script loads `.env.local`
 * through Node's `--env-file-if-exists`.
 */
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { z } from "zod";

import { passwordSchema, usernameSchema } from "@/lib/validation";
import { hashPassword } from "@/server/auth/password";
import * as schema from "@/server/db/schema";

const env = z
  .object({
    DATABASE_URL: z.url(),
    ADMIN_USERNAME: usernameSchema,
    // Stricter than doctors: the admin can issue access to everyone.
    ADMIN_PASSWORD: passwordSchema.pipe(z.string().min(12)),
    ADMIN_DISPLAY_NAME: z.string().trim().min(1).default("Administrator"),
  })
  .parse({
    ...process.env,
    DATABASE_URL: process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL,
  });

const resetPassword = process.argv.includes("--reset-password");

const client = postgres(env.DATABASE_URL, { max: 1, prepare: false });
const db = drizzle({ client, schema, casing: "snake_case" });
const { accounts, sessions } = schema;

try {
  const [existing] = await db
    .select({ id: accounts.id, role: accounts.role })
    .from(accounts)
    .where(eq(accounts.username, env.ADMIN_USERNAME))
    .limit(1);

  if (!existing) {
    await db.insert(accounts).values({
      role: "admin",
      username: env.ADMIN_USERNAME,
      displayName: env.ADMIN_DISPLAY_NAME,
      passwordHash: await hashPassword(env.ADMIN_PASSWORD),
    });
    console.info(`Admin "${env.ADMIN_USERNAME}" created.`);
  } else if (existing.role !== "admin") {
    throw new Error(`Username "${env.ADMIN_USERNAME}" already belongs to a doctor account.`);
  } else if (resetPassword) {
    await db.transaction(async (tx) => {
      await tx
        .update(accounts)
        .set({ passwordHash: await hashPassword(env.ADMIN_PASSWORD), status: "active" })
        .where(eq(accounts.id, existing.id));
      await tx.delete(sessions).where(eq(sessions.accountId, existing.id));
    });
    console.info(`Admin "${env.ADMIN_USERNAME}" password reset; all admin sessions ended.`);
  } else {
    console.info(`Admin "${env.ADMIN_USERNAME}" already exists. Use --reset-password to reset.`);
  }
} finally {
  await client.end();
}
