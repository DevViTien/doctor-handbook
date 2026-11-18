/**
 * How long a patient stays restorable in the trash (spec patient-trash, idea.md BR3). Lives in
 * `config` because both the patients module and the shared SQL helper (`server/db/trash-sql.ts`,
 * also used by backup) need the one value.
 */
export const TRASH_RETENTION_DAYS = 30;
