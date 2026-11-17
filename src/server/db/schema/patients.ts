import {
  date,
  foreignKey,
  index,
  pgTable,
  smallint,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { primaryId, timestamps, timestampTz } from "./_columns";
import { accounts } from "./accounts";
import { genderEnum } from "./enums";

/**
 * Patients remembered by a doctor. Every row is owned by exactly one doctor account;
 * all queries MUST filter by `accountId` (idea.md S3).
 *
 * `searchText` holds `buildSearchText(fullName, hometown, phone, patientCode)` computed by
 * the application, indexed with pg_trgm for accent-insensitive, fuzzy search.
 */
export const patients = pgTable(
  "patients",
  {
    id: primaryId(),
    accountId: uuid()
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    fullName: text().notNull(),
    /** Either the year only, or a full date of birth when known. */
    birthYear: smallint(),
    birthDate: date({ mode: "string" }),
    gender: genderEnum(),
    hometown: text(),
    phone: text(),
    /** Patient id in the clinic's official system, to look the record up there. */
    patientCode: text(),
    /** Object path in the private avatars bucket. */
    avatarPath: text(),
    /** "Always remember" summary: history, allergies, notes. Never shown in lists. */
    summary: text(),
    searchText: text().notNull().default(""),
    /** Soft delete: the trash keeps patients restorable for 30 days. */
    deletedAt: timestampTz(),
    ...timestamps,
  },
  (table) => [
    // Target of the composite foreign key from `notes` (owner consistency).
    unique("patients_id_account_id_key").on(table.id, table.accountId),
    index("patients_account_id_deleted_at_idx").on(table.accountId, table.deletedAt),
    index("patients_search_text_trgm_idx").using("gin", table.searchText.op("gin_trgm_ops")),
  ],
).enableRLS();

/** Timestamped notes on a patient, newest first. */
export const notes = pgTable(
  "notes",
  {
    id: primaryId(),
    patientId: uuid().notNull(),
    /**
     * Denormalized owner, so ownership checks and search never need a join. The composite
     * foreign key below guarantees it always equals the patient's owner.
     */
    accountId: uuid()
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    content: text().notNull(),
    searchText: text().notNull().default(""),
    ...timestamps,
  },
  (table) => [
    foreignKey({
      name: "notes_patient_owner_fk",
      columns: [table.patientId, table.accountId],
      foreignColumns: [patients.id, patients.accountId],
    }).onDelete("cascade"),
    index("notes_patient_id_created_at_idx").on(table.patientId, table.createdAt.desc()),
    index("notes_account_id_idx").on(table.accountId),
    index("notes_search_text_trgm_idx").using("gin", table.searchText.op("gin_trgm_ops")),
  ],
).enableRLS();

export type PatientRow = typeof patients.$inferSelect;
export type NoteRow = typeof notes.$inferSelect;
