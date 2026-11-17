import { relations } from "drizzle-orm";

import { accounts } from "./accounts";
import { sessions } from "./auth";
import { notes, patients } from "./patients";
import { todos } from "./todos";

export const accountsRelations = relations(accounts, ({ many }) => ({
  sessions: many(sessions),
  patients: many(patients),
  todos: many(todos),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  account: one(accounts, { fields: [sessions.accountId], references: [accounts.id] }),
}));

export const patientsRelations = relations(patients, ({ one, many }) => ({
  account: one(accounts, { fields: [patients.accountId], references: [accounts.id] }),
  notes: many(notes),
}));

export const notesRelations = relations(notes, ({ one }) => ({
  patient: one(patients, { fields: [notes.patientId], references: [patients.id] }),
}));

export const todosRelations = relations(todos, ({ one }) => ({
  account: one(accounts, { fields: [todos.accountId], references: [accounts.id] }),
}));
