# Module: backup

The doctor's safety net: the free database may lose data (idea.md D8).

## Scope

- **Export** everything (patients, notes, avatars, todos) into one `.zip` built in the browser:
  `manifest.json` (format version, counts, export date) + `data.json` + `images/`.
- **Import** = replace all (D20): validate with Zod, show a summary, auto-export the current data
  first, upload images to the `imports` bucket, then swap data in a single DB transaction.
- **Reminder** when the last backup is older than 7 days and data changed since.
- No password on the file (D18); show a short "keep this file safe" notice on every export.

## Constraints

- Vercel functions limit request/response bodies (~4.5 MB): images never go through a function.
- Keep `formatVersion` and an upgrade path for every older version.
