import { searchTokens } from "@/modules/search/match";

/**
 * Trigram similarity of a query to a full NAME, for "Có phải bạn tìm…?" (spec patient-search
 * "Tìm gần đúng"). Same measure as PostgreSQL `pg_trgm` `similarity()` (each word padded with
 * two spaces before and one after), computed in JS on the rows the server already read, so it
 * compares names only, never phone, code or hometown.
 */

function trigrams(words: readonly string[]): Set<string> {
  const set = new Set<string>();
  for (const word of words) {
    const padded = `  ${word} `;
    for (let i = 0; i + 3 <= padded.length; i++) set.add(padded.slice(i, i + 3));
  }
  return set;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const gram of a) if (b.has(gram)) shared++;
  return shared / (a.size + b.size - shared);
}

/**
 * Best similarity between the query and the full name or any run of consecutive name words of
 * the query's length ("nguyn" ~ "Nguyễn" in "Nguyễn Văn An"), in [0, 1].
 */
export function nameSimilarity(query: string, fullName: string): number {
  const queryWords = searchTokens(query);
  const nameWords = searchTokens(fullName);
  if (queryWords.length === 0 || nameWords.length === 0) return 0;

  const target = trigrams(queryWords);
  let best = jaccard(target, trigrams(nameWords));
  const width = Math.min(queryWords.length, nameWords.length);
  for (let start = 0; start + width <= nameWords.length; start++) {
    best = Math.max(best, jaccard(target, trigrams(nameWords.slice(start, start + width))));
  }
  return best;
}
