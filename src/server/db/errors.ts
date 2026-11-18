import "server-only";

/**
 * Recognizes PostgreSQL errors by SQLSTATE. Drizzle wraps driver errors (postgres.js
 * `PostgresError`) in its own query error and keeps the original in `cause`, so the whole
 * cause chain is inspected.
 */

const UNIQUE_VIOLATION = "23505";
const MAX_CAUSE_DEPTH = 5;

type PostgresErrorShape = { code?: unknown; constraint_name?: unknown; cause?: unknown };

function* causeChain(error: unknown): Generator<PostgresErrorShape> {
  let current: unknown = error;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH && current && typeof current === "object"; depth++) {
    const shape = current as PostgresErrorShape;
    yield shape;
    current = shape.cause;
  }
}

/** True when `error` (or one of its causes) is a unique violation of `constraint`. */
export function isUniqueViolation(error: unknown, constraint: string): boolean {
  for (const shape of causeChain(error)) {
    if (shape.code === UNIQUE_VIOLATION && shape.constraint_name === constraint) return true;
  }
  return false;
}
