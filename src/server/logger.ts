import "server-only";

import { DrizzleQueryError } from "drizzle-orm";
import postgres from "postgres";

/**
 * Minimal structured logger (one JSON line per entry, picked up by Vercel logs).
 *
 * PRIVACY RULE: never log patient data — names, notes, phone numbers, request bodies.
 * Log identifiers (account id, patient id), error codes and timings only.
 *
 * Errors are serialized through an allow-list: database errors in particular carry
 * user data in their message (`DrizzleQueryError` embeds query params; `PostgresError`
 * has `detail` such as "Key (username)=(bs.lan) already exists").
 */

type LogLevel = "debug" | "info" | "warn" | "error";
type LogContext = Record<string, unknown>;

const isProduction = process.env.NODE_ENV === "production";
const MAX_CAUSE_DEPTH = 3;

export function serializeError(error: unknown, depth = 0): unknown {
  if (!(error instanceof Error)) return error;
  if (depth >= MAX_CAUSE_DEPTH) return { name: error.name };

  if (error instanceof DrizzleQueryError) {
    // The SQL text is parameterized and safe; `params` and `message` are not.
    return {
      name: "DrizzleQueryError",
      query: error.query,
      cause: serializeError(error.cause, depth + 1),
    };
  }

  if (error instanceof postgres.PostgresError) {
    // Only structural fields: never `message`, `detail`, `where` or `hint`.
    return {
      name: "PostgresError",
      code: error.code,
      table: error.table_name,
      column: error.column_name,
      constraint: error.constraint_name,
    };
  }

  return {
    name: error.name,
    message: error.message,
    ...(isProduction ? {} : { stack: error.stack }),
    ...(error.cause === undefined ? {} : { cause: serializeError(error.cause, depth + 1) }),
  };
}

function write(level: LogLevel, message: string, context: LogContext = {}) {
  if (level === "debug" && isProduction) return;

  const entry: LogContext = { level, message, time: new Date().toISOString() };
  for (const [key, value] of Object.entries(context)) entry[key] = serializeError(value);

  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const logger = {
  debug: (message: string, context?: LogContext) => write("debug", message, context),
  info: (message: string, context?: LogContext) => write("info", message, context),
  warn: (message: string, context?: LogContext) => write("warn", message, context),
  error: (message: string, context?: LogContext) => write("error", message, context),
};
