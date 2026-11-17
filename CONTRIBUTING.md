# Contributing

## Workflow

1. Branch from `main`: `feat/<module>-<topic>`, `fix/<module>-<topic>`, `chore/<topic>`.
2. Commit with [Conventional Commits](https://www.conventionalcommits.org) — enforced by
   commitlint. Scopes: `auth`, `admin`, `patients`, `todos`, `search`, `backup`, `ui`, `db`,
   `config`, `deps`, `docs`, `ci`.
   ```
   feat(patients): add timestamped notes
   fix(auth): end other sessions on password change
   ```
3. The pre-commit hook runs ESLint and Prettier on staged files.
4. Before opening a pull request, run `pnpm check` (and `pnpm build` when touching config).
5. CI runs lint, typecheck, format check, unit tests and a production build.

## Code conventions

**Language**: code, identifiers, comments, commit messages and docs in English. User-facing
copy (UI text, error messages) in Vietnamese.

**Naming**

| Thing                | Convention                                          | Example                                 |
| -------------------- | --------------------------------------------------- | --------------------------------------- |
| Files and folders    | kebab-case                                          | `confirm-dialog.tsx`, `normalize-vi.ts` |
| React components     | PascalCase, named exports                           | `export function PageHeader()`          |
| Functions, variables | camelCase                                           | `requireAccess`, `searchText`           |
| Constants            | UPPER_SNAKE_CASE                                    | `ACCESS_CODE_TTL_MS`                    |
| Types                | PascalCase, `type` over `interface`                 | `type AuthContext = …`                  |
| DB tables / columns  | snake_case plural tables (generated from camelCase) | `patients.full_name`                    |
| Server Actions       | verb + noun                                         | `createPatient`, `lockAccount`          |

**TypeScript**: strict mode with `noUncheckedIndexedAccess`. No `any`; use `unknown` and narrow.
Use `import type` for type-only imports (auto-fixed by ESLint).

**Imports**: always via the `@/` alias, sorted automatically. Respect the layer rules in
[docs/architecture.md](docs/architecture.md).

**React**

- Server Components by default; add `"use client"` only for interactivity, as low in the tree as
  possible.
- Read data in Server Components through module DAL functions; mutate through Server Actions.
- Use `cn()` for conditional classes; build variants with `cva`.
- Mobile first: design for a 375 px wide screen, then enlarge.

**Server**

- Start every server-only file with `import "server-only"`.
- Every Server Action is built with `createAction` and declares its `access`.
- Every DAL function scopes queries by the authenticated account.
- Throw `AppError` for expected failures; let everything else bubble up to be logged.

**Comments**: explain _why_, not _what_. Reference product decisions with their ids from
`idea.md` (e.g. `D13`, `S3`) when a rule comes from there.

## Adding a feature

1. Read the module's `README.md` in `src/modules/<feature>/`.
2. Schema change? Edit `src/server/db/schema/*` (declare new tables with `.enableRLS()`), run
   `pnpm db:generate`, review the SQL, and commit `drizzle/` with the change (CI checks it).
   Keep migrations backward compatible.
3. Add `schemas.ts` → `server/queries.ts` / `server/mutations.ts` → `server/actions.ts` →
   `components/` → wire the route in `src/app`.
4. Add unit tests for pure logic and an E2E test for the main flow.
5. Remove the `FeaturePlaceholder` from the route.

## Adding UI primitives

```bash
pnpm dlx shadcn@latest add <component>
pnpm format
```

Generated files live in `src/components/ui`. Keep changes there minimal so upgrades stay easy.
