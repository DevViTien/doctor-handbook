# Module: patients

The doctor's "contact book" of patients.

## Scope

- Create (only the full name is required), view, edit patients (BR1).
- Optional fields: birth year or date, gender, hometown, phone (tap to call), patient code.
- Avatar: compressed in the browser, uploaded straight to the private `avatars` bucket through a
  signed URL; displayed through short-lived signed URLs.
- Summary ("always remember") — never displayed in lists (S7).
- Timestamped notes, newest first; draft kept in IndexedDB until saved (§10.6).
- Duplicate-name hint on create (BR2).
- Trash: soft delete via `deleted_at`, restore within 30 days (BR3).

## Data

Tables `patients` and `notes` (`src/server/db/schema/patients.ts`). Keep `search_text`
up to date on every write with `buildSearchText` from `src/lib/text/normalize-vi.ts`.
