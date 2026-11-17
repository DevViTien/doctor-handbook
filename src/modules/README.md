# Feature modules

Each folder is one business capability. Routes in `src/app` stay thin and compose module code.

| Module                         | Responsibility                                                              | Requirements (idea.md)       |
| ------------------------------ | --------------------------------------------------------------------------- | ---------------------------- |
| [auth](auth/README.md)         | Login, logout, activation with a code, password reset/change, rate limiting | D2, D13, D17, S2, S6, S8, S9 |
| [admin](admin/README.md)       | Issue/revoke access codes, list/lock/unlock/delete doctor accounts          | D2, D19, D21, N6             |
| [patients](patients/README.md) | Patient CRUD, summary, timestamped notes, avatar, trash                     | D6, D7, §10.1                |
| [search](search/README.md)     | Accent-insensitive instant search, fuzzy search, voice search               | D11, §10.2                   |
| [todos](todos/README.md)       | Simple to-do list with optional due date                                    | D5, D15, §10.3               |
| [backup](backup/README.md)     | Export to a single file, import (replace all), backup reminder              | D8, D18, D20, §10.5          |

## Standard layout of a module

Create only the files a module needs; keep the names so everyone knows where to look.

```
modules/<feature>/
├── components/          # React components of this feature (server or "use client")
├── hooks/               # Client hooks of this feature (e.g. useSpeechSearch)
├── server/
│   ├── queries.ts       # DAL reads   — `import "server-only"`, scoped by the session's account
│   ├── mutations.ts     # DAL writes  — `import "server-only"`, scoped by the session's account
│   └── actions.ts       # "use server" — thin wrappers built with `createAction`
├── schemas.ts           # Zod schemas shared by forms (client) and actions (server)
├── types.ts             # Public types (DTOs) returned to the UI — never raw DB rows with secrets
├── constants.ts         # Limits and labels of the feature
└── README.md
```

## Rules

1. **Ownership is enforced in the DAL.** `queries.ts` / `mutations.ts` take the `AuthContext`
   (or call `requireAccess`) and always filter by `auth.account.id`. Never accept an account id
   from the client.
2. **Actions are thin.** Validation, authorization and error mapping come from `createAction`;
   the handler calls DAL functions and returns a DTO.
3. **Shared layers never import modules** (enforced by ESLint). If two modules need the same
   thing, move it down into `src/lib`, `src/components` or `src/server`.
4. **Cross-module imports** are allowed for `schemas.ts`, `types.ts`, `constants.ts` and, from
   server code only, `server/queries.ts`. Avoid cycles; prefer moving shared logic down a layer.
5. **No barrel `index.ts`** in modules: it mixes server and client code and defeats tree-shaking.
