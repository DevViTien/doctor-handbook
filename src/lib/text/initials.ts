/**
 * Avatar initials for a person's name.
 *
 * Vietnamese names put the given name last ("Nguyễn Văn An"), so we take the first letter
 * of the family name and of the given name: "NA". Single-word names yield one letter.
 */
export function getInitials(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  const first = words[0];
  if (!first) return "";

  const last = words.length > 1 ? words[words.length - 1] : undefined;
  return `${firstLetter(first)}${last ? firstLetter(last) : ""}`.toUpperCase();
}

function firstLetter(word: string): string {
  // Spread to iterate by code point, never splitting a surrogate pair.
  return [...word.normalize("NFC")][0] ?? "";
}
