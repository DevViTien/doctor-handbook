import type { Route } from "next";

import type { MATCH_KINDS } from "@/modules/search/constants";

export type MatchKind = (typeof MATCH_KINDS)[number];

/**
 * One patient as the list page shows it, the only data the browser search works on: name and
 * hometown (already visible), the precomputed line "Nam · 47 tuổi · Nghệ An" and the link.
 * Never phone, patient code, summary or notes (spec patient-records "Danh sách không lộ…").
 */
export type SearchablePatient = {
  id: string;
  fullName: string;
  hometown: string | null;
  meta: string;
  href: Route;
};

/** A deep-search hit: only the id and where it matched, never the matched content. */
export type DeepMatch = { id: string; kinds: MatchKind[] };

export type DeepSearchResult = {
  matches: DeepMatch[];
  /** "Có phải bạn tìm…?" ids, most similar first; only when nothing matched at all. */
  suggestions: string[];
};
