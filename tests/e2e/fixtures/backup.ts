import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

import type { Download } from "@playwright/test";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

/**
 * Backup files for E2E tests (change add-data-backup): builds `.zip` files in the format the app
 * writes (version 1), and reads the files the app downloads.
 */

export type SeedPatient = {
  fullName: string;
  phone?: string | null;
  hometown?: string | null;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  notes?: { content: string; createdAt?: string; updatedAt?: string }[];
};

export const daysAgoIso = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

export function backupZip(options: {
  username?: string;
  exportedAt?: string;
  formatVersion?: number;
  patients: SeedPatient[];
}): Buffer {
  const patients = options.patients.map((patient) => ({ id: randomUUID(), patient }));
  const data = {
    patients: patients.map(({ id, patient }) => ({
      id,
      fullName: patient.fullName,
      birthYear: null,
      birthDate: null,
      gender: null,
      hometown: patient.hometown ?? null,
      phone: patient.phone ?? null,
      patientCode: null,
      summary: null,
      createdAt: patient.createdAt ?? daysAgoIso(20),
      updatedAt: patient.updatedAt ?? patient.createdAt ?? daysAgoIso(20),
      deletedAt: patient.deletedAt ?? null,
    })),
    notes: patients.flatMap(({ id, patient }) =>
      (patient.notes ?? []).map((note) => ({
        id: randomUUID(),
        patientId: id,
        content: note.content,
        createdAt: note.createdAt ?? daysAgoIso(10),
        updatedAt: note.updatedAt ?? note.createdAt ?? daysAgoIso(10),
      })),
    ),
    todos: [],
  };
  const manifest = {
    app: "doctor-handbook",
    formatVersion: options.formatVersion ?? 1,
    appVersion: "0.1.0",
    exportedAt: options.exportedAt ?? daysAgoIso(1),
    account: { username: options.username ?? "bs.lan" },
    counts: { patients: data.patients.length, notes: data.notes.length, todos: 0 },
  };
  return Buffer.from(
    zipSync({
      "manifest.json": strToU8(JSON.stringify(manifest)),
      "data.json": strToU8(JSON.stringify(data)),
    }),
  );
}

export type ReadBackup = {
  manifest: {
    exportedAt: string;
    account: { username: string };
    counts: { patients: number; notes: number; todos: number };
  };
  data: {
    patients: { fullName: string; deletedAt: string | null }[];
    notes: { content: string }[];
    todos: unknown[];
  };
  /** `data.json` as text, to look for what must not be there. */
  dataText: string;
  bytes: Buffer;
};

export async function readDownloadedBackup(download: Download): Promise<ReadBackup> {
  const path = await download.path();
  const bytes = await readFile(path);
  const entries = unzipSync(new Uint8Array(bytes));
  const manifest = entries["manifest.json"];
  const data = entries["data.json"];
  if (!manifest || !data) throw new Error("Downloaded file is not a backup");
  const dataText = strFromU8(data);
  return { manifest: JSON.parse(strFromU8(manifest)), data: JSON.parse(dataText), dataText, bytes };
}

/** "19/11/2026" and "2026-11-19" for a date in Vietnam time. */
export function vietnamDay(date: Date = new Date()): { display: string; iso: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return {
    display: `${parts.day}/${parts.month}/${parts.year}`,
    iso: `${parts.year}-${parts.month}-${parts.day}`,
  };
}
