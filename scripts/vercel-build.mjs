/**
 * Vercel build entry point (`vercel-build` script).
 *
 * 1. Build first: a failing build must never leave the database already migrated.
 * 2. Migrate ONLY production deployments. Preview deployments share the development
 *    database, where branches would otherwise race each other's migrations; migrate it
 *    deliberately with `pnpm db:migrate` against the dev credentials.
 *
 * Migrations run before the new deployment receives traffic, while the previous one is
 * still live, so they must be backward compatible (expand first, contract later).
 */
import { execSync } from "node:child_process";

const run = (command) => execSync(command, { stdio: "inherit" });

run("pnpm exec next build");

if (process.env.VERCEL_ENV === "production") {
  console.info("Applying database migrations (production)...");
  run("pnpm exec drizzle-kit migrate");
} else {
  console.info(`Skipping migrations (VERCEL_ENV=${process.env.VERCEL_ENV ?? "unset"}).`);
}
