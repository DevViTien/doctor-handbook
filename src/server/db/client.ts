import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { getServerEnv } from "@/config/env";

import * as schema from "./schema";

function createDb() {
  const client = postgres(getServerEnv().DATABASE_URL, {
    // Required by Supabase's transaction pooler (no prepared statements across transactions).
    prepare: false,
    // Small pool per serverless instance; the pooler multiplexes upstream connections.
    max: 5,
    idle_timeout: 20,
  });

  return drizzle({ client, schema, casing: "snake_case" });
}

export type Database = ReturnType<typeof createDb>;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
/** Accepts either the root client or a transaction, so DAL functions compose inside one. */
export type DbExecutor = Database | Transaction;

// Reuse one client across hot reloads in development.
const globalForDb = globalThis as typeof globalThis & { __db?: Database };

/**
 * Lazily created database client. Lazy so that importing server modules (e.g. during
 * `next build`) never requires database credentials.
 */
export function getDb(): Database {
  globalForDb.__db ??= createDb();
  return globalForDb.__db;
}
