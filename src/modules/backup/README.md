# Module: backup

The doctor's safety net: the free database may lose data (idea.md D8).

## Scope

- **Export** everything (patients, notes, avatars, todos) into one `.zip` built in the browser:
  `manifest.json` (format version, counts, export date) + `data.json` + `images/`.
- **Import** = replace all (D20): validate with Zod, show a summary, auto-export the current data
  first, upload images to the `imports` bucket, then swap data in a single DB transaction.
- **Reminder** when the last backup is older than 7 days and data changed since.
- No password on the file (D18); show a short "keep this file safe" notice on every export.

## Data to include

Every column a doctor can write must round-trip through export and import:

- `patients` (since change `add-patient-records`): `full_name`, `birth_year`, `birth_date`,
  `gender`, `hometown`, `phone`, `patient_code`, `summary`, `created_at`, `updated_at`,
  `deleted_at`. `search_text` is derived: recompute it on import with `buildSearchText`, do not
  trust the file.

## Constraints

- Vercel functions limit request/response bodies (~4.5 MB): images never go through a function.
- Keep `formatVersion` and an upgrade path for every older version.
