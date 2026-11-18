import { normalizeVi } from "@/lib/text/normalize-vi";
import { SEARCH_LIMITS } from "@/modules/search/constants";
import { searchTokens } from "@/modules/search/match";
import type { MatchKind } from "@/modules/search/types";

/**
 * Deep matching of one patient's sensitive fields (design §3), run on the SERVER only: the
 * browser never receives phone, patient code or summary. Notes are matched in SQL.
 */

const PHONE_QUERY = /^[0-9 +\-.()]+$/;

/** Digits only, with the Vietnamese country code written as a leading 0 ("+84 912…" → "0912…"). */
function phoneDigits(text: string): string {
  const digits = text.replace(/\D/g, "");
  return digits.startsWith("84") && digits.length > 9 ? `0${digits.slice(2)}` : digits;
}

/** Letters and digits only, so "bn10234", "BN 10234" and "BN-10234" are the same code. */
const compact = (normalized: string) => normalized.replace(/[^a-z0-9]/g, "");

export type DeepFields = {
  phone: string | null;
  patientCode: string | null;
  summary: string | null;
};

export function matchPatientFields(fields: DeepFields, query: string): MatchKind[] {
  const kinds: MatchKind[] = [];
  const tokens = searchTokens(query);
  if (tokens.length === 0) return kinds;
  const normalized = tokens.join(" ");

  if (fields.phone && PHONE_QUERY.test(query.trim())) {
    const typed = query.replace(/\D/g, "");
    const stored = fields.phone.replace(/\D/g, "");
    // "+84…" typed is the country code even when only part of the number is typed.
    const typedLocal = /^\s*\(?\s*\+\s*84/.test(query) ? `0${typed.slice(2)}` : phoneDigits(typed);
    if (
      typed.length >= SEARCH_LIMITS.phoneMinDigits &&
      (stored.includes(typed) || phoneDigits(stored).includes(typedLocal))
    ) {
      kinds.push("phone");
    }
  }

  if (fields.patientCode) {
    const code = normalizeVi(fields.patientCode);
    const compactQuery = compact(normalized);
    if (
      code.includes(normalized) ||
      tokens.every((token) => code.includes(token)) ||
      (compactQuery.length > 0 && compact(code).includes(compactQuery))
    ) {
      kinds.push("patientCode");
    }
  }

  if (fields.summary) {
    const summary = normalizeVi(fields.summary);
    if (tokens.every((token) => summary.includes(token))) kinds.push("summary");
  }

  return kinds;
}
