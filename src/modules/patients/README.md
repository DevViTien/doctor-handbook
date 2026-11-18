# Module: patients

The doctor's "contact book" of patients. Behaviour: `openspec/specs/patient-records/` and
`openspec/specs/patient-notes/`.

## Done

- **List** `/patients`: name, gender, age, hometown only (S7), most recently added/edited first.
  With patients, the page renders the searchable list of module `search` (rows are the shared
  `PersonRow`); `PatientList` keeps the empty-notebook state.
- **Add** `/patients/new`: only the full name is required (BR1); "Có phải người này?" hint on
  a same-name, non-contradicting birth year (BR2, `duplicates.ts`), never blocking.
- **Detail** `/patients/<id>`: phone as a `tel:` link, patient code, summary with `http(s)` links
  (`src/lib/text/linkify.ts`).
- **Edit** `/patients/<id>/edit`: refuses to overwrite a newer version (`updated_at` compared at
  millisecond precision, `CONFLICT`).
- "Năm sinh hoặc tuổi" field (`birth.ts`): `1979`, `45t` / `45`, `12/03/1979`; ages in Vietnam time.
- A failed save (offline, validation, conflict) keeps everything typed (`patient-form.tsx`).
- **Notes** on the detail page (`patient-notes.tsx`): newest first, autosave one second after the
  last keystroke, no "Lưu" button; edit keeps the creation time ("Đã sửa …"); delete asks first.

## Trash

- "Chuyển vào thùng rác" (⋮ on the patient page) sets `deleted_at`, no confirmation; a toast
  offers "Hoàn tác" for 8 s (`patient-actions-menu.tsx`, the doctor Toaster `DOCTOR_TOASTER_ID`).
  Every read already skips `deleted_at IS NOT NULL`, so the patient disappears everywhere.
- `/settings/trash` (`trash-list.tsx`): restore (back on top, notes intact) or "Xoá vĩnh viễn"
  (confirmation dialog; notes cascade; this device's note drafts of that patient are dropped).
- 30 days: `trashIsLive()` (`server/trash-sql.ts`) is the single definition used to list, count
  and restore, so expiry is exact; the daily cron deletes expired rows (`purgeExpiredTrash`).

## Notes: drafts and sync

- Every keystroke is written to IndexedDB first (`note-drafts.ts`, `idb-keyval`), key
  `${accountId}/${noteId}`, validated with Zod when read. A draft is removed only once the server
  stored exactly that content.
- `note-sync.ts` (`sendNoteDraft`) is the ONLY path from a draft to the server: a per-note lock
  (Web Locks, or an in-tab queue) and always the latest draft, so an older send never lands after
  a newer one. Used by the composer hook, the "back online" retries and `NoteDraftSync`.
- `NoteDraftSync` (mounted in the doctor layout) sends leftover drafts of the signed-in account
  from any doctor page, on load, on `online` and when the app returns to the foreground.
- The browser makes the note id; `saveNote` is a single insert-or-update that only touches a
  note of the session's account and patient, so re-sends never duplicate and foreign ids change
  nothing (`NOT_FOUND`). `editing` decides whether `updated_at` moves (shown as "Đã sửa").

## Avatars (change `add-patient-avatars`, spec `patient-avatars`)

- `avatar-image.ts` shrinks in the browser: largest centred square, 384 × 384, WebP (JPEG when the
  browser cannot encode WebP), via `createImageBitmap` + canvas. No library.
- `avatar-client.ts`: `prepareAvatarUploadAction` (signed upload URL, fresh random path
  `<accountId>/<32 hex>.webp`) → `PUT` straight to Storage → `setAvatarAction` (the path is
  checked with `isAvatarPathOf`; the previous object is deleted).
- Display: DTOs carry `avatarUrl` (`/api/patients/<id>/avatar?v=<file name>`), never the storage
  path. The route checks ownership and redirects (307) to a 24 h signed URL, cached privately
  for 23 h; `AvatarPhoto` lazy-loads it over the initials and falls back to them on error.
- Setting or removing a picture moves `updated_at`: it is a change (the backup reminder counts it,
  the list puts the patient on top).
- Objects are deleted with the patient: "Xoá vĩnh viễn", the daily purge, a replaced picture,
  and an import (`removeAvatarsQuietly`, best effort: failures only log a count).

## Rules

- Every query goes through `server/queries.ts` / `server/mutations.ts`, scoped to the session's
  account and `deleted_at IS NULL`. A patient id from a URL is checked with `patientIdSchema`
  first; another doctor's id, an unknown id and a malformed id all end in the same `notFound()`.
- Keep `search_text` up to date on every write: `buildSearchText` (`src/lib/text/normalize-vi.ts`)
  of the full name, hometown, phone and patient code.
- Never put patient data in a URL, a page title, a toast or a log. Page titles are fixed.
- Form field names are `patient*` (not `name`, `tel`…) so browsers never autofill the doctor's
  own details into a patient record.

## Data

Tables `patients` and `notes` (`src/server/db/schema/patients.ts`).
