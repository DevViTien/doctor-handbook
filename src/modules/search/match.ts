import { normalizeVi } from "@/lib/text/normalize-vi";

/**
 * Instant search on what the list already shows: full name and hometown (spec patient-search
 * "Lọc tức thì theo tên và quê", design §2). Pure: runs in the browser on every keystroke, and on
 * the server to know whether anything matched before suggesting near names.
 */

/** Normalized words of a query: no accents, lowercase, any order. */
export function searchTokens(query: string): string[] {
  return normalizeVi(query).split(" ").filter(Boolean);
}

type NameAndPlace = { fullName: string; hometown: string | null };

/** Precomputed normalized text of one patient, so filtering does no work per keystroke. */
export type IndexedPatient<T> = { patient: T; name: string; place: string };

export function indexPatients<T extends NameAndPlace>(patients: readonly T[]): IndexedPatient<T>[] {
  return patients.map((patient) => ({
    patient,
    name: normalizeVi(patient.fullName),
    place: normalizeVi(patient.hometown ?? ""),
  }));
}

export function matchesLocally(
  indexed: IndexedPatient<unknown>,
  tokens: readonly string[],
): boolean {
  const text = `${indexed.name} ${indexed.place}`;
  return tokens.every((token) => text.includes(token));
}

/**
 * Patients matching every token, those matching in the name alone first; each group keeps the
 * list order (most recently added or edited first). No tokens: everyone, unchanged.
 */
export function rankLocal<T>(
  indexed: readonly IndexedPatient<T>[],
  tokens: readonly string[],
): T[] {
  if (tokens.length === 0) return indexed.map((entry) => entry.patient);
  const byName: T[] = [];
  const byPlace: T[] = [];
  for (const entry of indexed) {
    if (!matchesLocally(entry, tokens)) continue;
    if (tokens.every((token) => entry.name.includes(token))) byName.push(entry.patient);
    else byPlace.push(entry.patient);
  }
  return [...byName, ...byPlace];
}
