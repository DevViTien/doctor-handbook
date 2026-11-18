/** One piece of a text: plain characters, or an `http(s)://` address to render as a link. */
export type TextPart = { type: "text"; value: string } | { type: "link"; value: string };

/** An `http://` or `https://` address up to the next whitespace, quote or angle bracket. */
const URL_PATTERN = /https?:\/\/[^\s<>"']+/gi;
/** Punctuation that usually ends a sentence rather than an address ("xem https://a.vn/x."). */
const TRAILING_PUNCTUATION = new Set([".", ",", ";", ":", "!", "?", ")", "]", "}"]);

const count = (text: string, char: string) => text.split(char).length - 1;

/**
 * Drops sentence punctuation after an address. A closing bracket is kept when the address opened
 * it (`https://vi.wikipedia.org/wiki/A_(B)`), and dropped when the sentence did ("(xem https://a.vn)").
 */
function trimTrailingPunctuation(url: string): string {
  let end = url.length;
  while (end > 0 && TRAILING_PUNCTUATION.has(url[end - 1] ?? "")) {
    const kept = url.slice(0, end);
    if (url[end - 1] === ")" && count(kept, "(") >= count(kept, ")")) break;
    end -= 1;
  }
  return url.slice(0, end);
}

/**
 * Splits free text (patient summary, notes) into plain text and `http(s)` links.
 *
 * Only `http://` and `https://` become links: `javascript:`, `data:`, `www.` without a scheme
 * and every other form stay plain text. Callers render the parts as React text nodes and
 * `<a>` elements, never as HTML, so the text can never inject markup.
 *
 * @example splitLinks("KQ: https://lab.vn/1.") // [text "KQ: ", link "https://lab.vn/1", text "."]
 */
export function splitLinks(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let cursor = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index;
    const url = trimTrailingPunctuation(match[0]);
    // "https://" followed only by punctuation is not an address.
    if (/^https?:\/\/$/i.test(url)) continue;

    if (start > cursor) parts.push({ type: "text", value: text.slice(cursor, start) });
    parts.push({ type: "link", value: url });
    cursor = start + url.length;
  }

  if (cursor < text.length) parts.push({ type: "text", value: text.slice(cursor) });
  return parts;
}
