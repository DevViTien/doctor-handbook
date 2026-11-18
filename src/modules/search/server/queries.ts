import "server-only";

import { and, desc, eq, isNull, type SQL, sql } from "drizzle-orm";

import { MATCH_KINDS, SEARCH_LIMITS } from "@/modules/search/constants";
import { matchPatientFields } from "@/modules/search/deep-match";
import { indexPatients, matchesLocally, searchTokens } from "@/modules/search/match";
import { nameSimilarity } from "@/modules/search/similarity";
import type { DeepSearchResult, MatchKind } from "@/modules/search/types";
import type { AuthContext } from "@/server/auth/session";
import { type DbExecutor, getDb } from "@/server/db/client";
import { notes, patients } from "@/server/db/schema";

/** `%`, `_` and `\` are LIKE wildcards / the escape character: match them literally. */
export function likeContains(token: string): string {
  return `%${token.replace(/[\\%_]/g, "\\$&")}%`;
}

/**
 * Deep search of the session's own, non-deleted patients (spec patient-search, design §3):
 * phone, patient code and summary matched in JS (a few hundred rows), notes in SQL on the
 * trigram-indexed `search_text`, then near-NAME suggestions (trigram similarity on the full name
 * only, never phone, code or hometown) when nothing matched at all.
 *
 * Returns ids and match kinds only: the browser already has each patient's row and must never
 * receive the matched content. The query is never logged.
 */
export async function searchPatients(
  auth: AuthContext,
  query: string,
  db: DbExecutor = getDb(),
): Promise<DeepSearchResult> {
  const tokens = searchTokens(query);
  if (tokens.join(" ").length < SEARCH_LIMITS.deepMinLength)
    return { matches: [], suggestions: [] };

  const owned = and(eq(patients.accountId, auth.account.id), isNull(patients.deletedAt));
  const rows = await db
    .select({
      id: patients.id,
      fullName: patients.fullName,
      hometown: patients.hometown,
      phone: patients.phone,
      patientCode: patients.patientCode,
      summary: patients.summary,
    })
    .from(patients)
    .where(owned)
    .orderBy(desc(patients.updatedAt), desc(patients.id));

  const found = new Map<string, Set<MatchKind>>();
  const add = (id: string, kind: MatchKind) => {
    const kinds = found.get(id) ?? new Set<MatchKind>();
    kinds.add(kind);
    found.set(id, kinds);
  };

  for (const row of rows) {
    for (const kind of matchPatientFields(row, query)) add(row.id, kind);
  }

  const noteConditions: SQL[] = tokens.map(
    (token) => sql`${notes.searchText} LIKE ${likeContains(token)} ESCAPE '\\'`,
  );
  const noteHits = await db
    .selectDistinct({ patientId: notes.patientId })
    .from(notes)
    .innerJoin(patients, eq(patients.id, notes.patientId))
    .where(
      and(eq(notes.accountId, auth.account.id), isNull(patients.deletedAt), ...noteConditions),
    );
  for (const hit of noteHits) add(hit.patientId, "notes");

  const matches = rows
    .filter((row) => found.has(row.id))
    .map((row) => ({
      id: row.id,
      kinds: MATCH_KINDS.filter((kind) => found.get(row.id)?.has(kind)),
    }));

  const anyLocal = indexPatients(rows).some((entry) => matchesLocally(entry, tokens));
  if (matches.length > 0 || anyLocal) return { matches, suggestions: [] };

  // Nothing at all: names that look alike ("nguyn van an" → "Nguyễn Văn An").
  const suggestions = rows
    .map((row, order) => ({ id: row.id, order, score: nameSimilarity(query, row.fullName) }))
    .filter((candidate) => candidate.score >= SEARCH_LIMITS.similarity)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, SEARCH_LIMITS.suggestions)
    .map((candidate) => candidate.id);

  return { matches, suggestions };
}
