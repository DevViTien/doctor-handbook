# Doctor Handbook

A digital pocket notebook for clinic doctors: remember patients, find them instantly
(typing without accents or by voice), keep a simple to-do list, and back everything up to a file.

- Product idea and decisions: [idea.md](idea.md) (Vietnamese)
- Tech stack rationale: [teckstack.md](teckstack.md) (Vietnamese)
- Architecture and conventions: [docs/architecture.md](docs/architecture.md)
- Contributing (workflow, commits, checks): [CONTRIBUTING.md](CONTRIBUTING.md)
- Spec-driven workflow with AI agents (OpenSpec): [CLAUDE.md](CLAUDE.md) (Vietnamese),
  current behaviour in [openspec/specs/](openspec/specs/), planned work in
  [openspec/changes/](openspec/changes/)

> **Status:** project skeleton. Infrastructure, shared layers and module boundaries are in place;
> features are not implemented yet (screens show a placeholder).

## Stack

Next.js (App Router) · React · TypeScript · Tailwind CSS · shadcn/ui · Drizzle ORM ·
PostgreSQL + Storage on Supabase · Vercel (`sin1`) · Vitest · Playwright.

## Getting started

Requirements: Node.js 24 (see `.nvmrc`), pnpm 12.

```bash
pnpm install
cp .env.example .env.local        # fill in the values (see below)
pnpm db:migrate                   # apply migrations to the database in DIRECT_DATABASE_URL
pnpm db:seed-admin                # create the admin account from ADMIN_* variables
pnpm dev                          # http://localhost:3000
```

### Supabase setup (once per environment)

1. Create a project in the **Singapore** region. Use one project for production and another one
   for development/preview — never point Preview deployments at production.
2. Copy the pooler connection strings into `DATABASE_URL` (transaction, port 6543) and
   `DIRECT_DATABASE_URL` (session, port 5432).
3. Storage: create **private** buckets `avatars` and `imports`.
4. Settings → API: copy the project URL and the `service_role` key (server-only secret).
5. Optional hardening: disable the Data API. Migrations already enable RLS (without policies) on
   every table and revoke the `anon` / `authenticated` privileges, so it cannot read anything.

### Vercel setup

- Function region `sin1` is set in `vercel.json`.
- Set the environment variables of `.env.example` separately for **Production** and **Preview**.
- `vercel-build` (`scripts/vercel-build.mjs`) builds first, then runs migrations **only for
  production** deployments. Migrate the development database used by Preview manually:
  `pnpm db:migrate` with the dev credentials in `.env.local`.
- `CRON_SECRET` protects `/api/cron/daily-maintenance` (daily: keeps the free Supabase project
  awake and prunes rate-limit rows).

## End-to-end tests

`pnpm test:e2e` builds the app and serves it with `next start` on port **3100** (so it never
collides with `pnpm dev`). Tests that need signed-in users run only when `E2E_DATABASE_URL` is
set; the others always run.

> **Warning:** the E2E fixtures **wipe** the `accounts` table of `E2E_DATABASE_URL`. Use a
> database dedicated to tests — never the development or production database. The fixtures
> refuse any `*.supabase.co` host.

With Docker:

```bash
docker run -d --name doctor-handbook-e2e-db -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=doctor_handbook_e2e -p 54329:5432 postgres:17

export E2E_DATABASE_URL=postgres://postgres:postgres@localhost:54329/doctor_handbook_e2e
DIRECT_DATABASE_URL=$E2E_DATABASE_URL pnpm db:migrate   # once, and after each new migration
pnpm exec playwright install chromium webkit            # once
pnpm test:e2e                                           # or: pnpm test:e2e --project=android
```

The Playwright server reuses an already running app on port 3100 outside CI: stop it after
changing code, or the tests run against the old build.

## Scripts

| Script                                  | Purpose                                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------------------ |
| `pnpm dev` / `build` / `start`          | Next.js development server, production build, production server                            |
| `pnpm lint` / `lint:fix`                | ESLint (code quality, import order, architecture boundaries)                               |
| `pnpm format` / `format:check`          | Prettier (with Tailwind class sorting)                                                     |
| `pnpm typecheck`                        | TypeScript in strict mode                                                                  |
| `pnpm test` / `test:watch`              | Unit tests (Vitest)                                                                        |
| `pnpm test:e2e`                         | End-to-end tests on mobile viewports (Playwright; run `pnpm exec playwright install` once) |
| `pnpm check`                            | Lint + typecheck + format check + unit tests + OpenSpec check                              |
| `pnpm spec:check`                       | OpenSpec strict validation + no finished change left unarchived                            |
| `pnpm exec openspec <cmd>`              | OpenSpec CLI (pinned version), e.g. `list`, `show`, `validate`, `archive`                  |
| `pnpm db:generate`                      | Generate a SQL migration from schema changes                                               |
| `pnpm db:migrate`                       | Apply pending migrations                                                                   |
| `pnpm db:check`                         | Check the consistency of the migration history                                             |
| `pnpm db:studio`                        | Browse the database with Drizzle Studio                                                    |
| `pnpm db:seed-admin [--reset-password]` | Create the admin account, or reset its password                                            |
