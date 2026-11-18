# Module: backup

The doctor's safety net: the free database may lose data (idea.md D8). Specs: `data-backup`,
`data-import` (change `add-data-backup`).

## Scope

- **Export** everything into one `.zip` built in the browser (`archive.ts`, `fflate`):
  `manifest.json` + `data.json` + `images/<patient id>.webp|jpg` (format 2). The browser fetches
  each picture straight from Storage with the signed URLs `GET /api/backup` lists. Saved as `doctor-handbook_<username>_<yyyy-mm-dd>.zip`.
- **Import** = replace all (D20): the browser unpacks and checks the file, shows a summary,
  saves a backup of the current data first (`…_truoc-khi-nhap.zip`) when there is any, then the
  server checks it again and swaps everything in one transaction.
- **Reminder** on `/patients` when the last backup (or the account's creation) is more than 7
  days old and data changed since; "Để mai" snoozes it for a day on that device (localStorage).
- No password on the file (D18); the keep-safe notice is shown next to every download button
  and after every download.

## Layout

| File                          | Role                                                                             |
| ----------------------------- | -------------------------------------------------------------------------------- |
| `schemas.ts`                  | `backupFileSchema`: the format, shared by browser and server                     |
| `format.ts`                   | `readBackup` (version check + upgraders), `backupFileName`                       |
| `archive.ts`                  | `.zip` pack/unpack (128 MB unpacked, 512 KB per picture), gzip JSON for the wire |
| `reminder.ts`                 | `shouldRemind`, `describeLastBackup` (Vietnam calendar days)                     |
| `backup-client.ts`            | `downloadBackup`, `sendImport` (browser only)                                    |
| `server/queries.ts`           | `getBackupStatus`, `getBackupSnapshot` (REPEATABLE READ)                         |
| `server/mutations.ts`         | `recordBackup`, `replaceAllData`                                                 |
| `server/actions.ts`           | `recordBackupAction`                                                             |
| `src/app/api/backup/route.ts` | `GET` export data + signed picture URLs, `PUT` replace-all; gzip JSON ≤ 4 MB     |

The `.zip` never reaches the server; only its JSON does, gzip-compressed, so it stays far below
the ~4.5 MB a Vercel Function accepts (about 25 MB of text fits in 4 MB compressed).

## Format (version 2)

```jsonc
// manifest.json
{ "app": "doctor-handbook", "formatVersion": 1, "appVersion": "0.1.0",
  "exportedAt": "2026-11-19T08:30:00.000Z", "account": { "username": "bs.lan" },
  "counts": { "patients": 132, "notes": 845, "todos": 20 } }
// data.json: camelCase, instants in ISO 8601 UTC, calendar days as "yyyy-mm-dd"
{ "patients": [{ "id", "fullName", "birthYear", "birthDate", "gender", "hometown", "phone",
                 "patientCode", "summary", "createdAt", "updatedAt", "deletedAt" }],
  "notes":    [{ "id", "patientId", "content", "createdAt", "updatedAt" }],
  "todos":    [{ "id", "content", "dueDate", "completedAt", "createdAt", "updatedAt" }] }
```

- Patients include those still restorable from the trash (P3-1), with `deletedAt`.
- Never in the file: `accountId`, `searchText`, `avatarPath`, passwords, sessions.
- Timestamps keep milliseconds (the database has microseconds).

## Rules for changing the format

- **Every column a doctor can write must round-trip.** A new column → add it to the schema,
  the snapshot query and `replaceAllData` in the same change.
- **Bump `BACKUP_FORMAT_VERSION`** for any change an older app could not read, and add
  `UPGRADERS[old]` in `format.ts` turning the old shape into the new one. Never delete an
  upgrader: the app MUST read every older version.
- **Tightening a rule** (a shorter limit, a required field) also needs an upgrader or a looser
  rule for old files, or older backups stop importing.
- The server only accepts the current version; the browser upgrades first.

## Import details

- Pictures first: `prepareImportUploadsAction` gives one signed upload URL per picture (fresh
  random paths), the browser uploads them, then `PUT /api/backup` sends `images: { <old patient
id>: <path> }`; every path must pass `isAvatarPathOf`. `replaceAllData` attaches them in the
  transaction and deletes the replaced data's pictures after the commit. A failed import calls
  `discardImportUploadsAction` (only paths no patient uses).
- `.zip` up to 50 MB (pictures included); the JSON sent to the server stays ≤ 4 MB gzip.

- One import at a time per account: the transaction first locks the `accounts` row.
- Without the `x-replace-existing: 1` header (sent only after the confirmation and the automatic
  backup) the server refuses with `CONFLICT` when the account has data: a stale page never
  deletes data the doctor was not warned about.
- Patients past the 30 days of the trash (and their notes) are not imported.

- Rows get **new ids** (old ids may still exist in another account on the same server; keeping
  them would fail and reveal that). Note drafts of old notes on a device are then refused like
  drafts of deleted patients.
- `search_text` is recomputed with `buildSearchText`, never read from the file.
- `last_backup_at` becomes `GREATEST(last_backup_at, LEAST(file's exportedAt, now()))`.
- Note drafts in IndexedDB are NOT part of a backup: they live on one device until sent.

## Known limits

- A change made only of permanent deletions (no add/edit) does not trigger the reminder.
- On iPhone in standalone (PWA) mode, check that the download lands in the Files app.
