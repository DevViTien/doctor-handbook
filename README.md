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
