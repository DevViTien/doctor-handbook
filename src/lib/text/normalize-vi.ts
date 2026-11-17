const COMBINING_MARKS = /[̀-ͯ]/g;
const WHITESPACE = /\s+/g;

/**
 * Normalizes Vietnamese text for search: strips diacritics, maps "đ" to "d",
 * lowercases and collapses whitespace.
 *
 * Used on both write (stored `search_text` columns) and read (user queries), on both
 * client and server. Keep it the single implementation, otherwise matches silently drift.
 *
 * @example normalizeVi("  Nguyễn  Văn Đức ") // "nguyen van duc"
 */
export function normalizeVi(input: string): string {
  return input
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(WHITESPACE, " ")
    .trim();
}

/** Builds one normalized, space-separated search string from optional parts. */
export function buildSearchText(...parts: ReadonlyArray<string | null | undefined>): string {
  return parts
    .filter((part): part is string => Boolean(part?.trim()))
    .map(normalizeVi)
    .join(" ");
}
