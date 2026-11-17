# Module: search

Finding a patient in under five seconds (idea.md §6.1).

## Scope

- Instant, client-side filtering of a light patient list on every keystroke.
- Server-side search in summaries and notes (debounced, `pg_trgm` indexes).
- Fuzzy suggestions with `similarity()` when nothing matches exactly.
- Voice search with the browser Web Speech API (`vi-VN`); hide the button when unsupported.

## Rule

Always compare **normalized** strings: `normalizeVi(query)` against stored `search_text`.
Never write a second normalization function.
