# Module: search

Finding a patient in under five seconds (idea.md §6.1). Behaviour: `openspec/specs/patient-search/`.

## Done

- **Instant filtering** in the browser on every keystroke, by full name and hometown only
  (`match.ts`): accent and case insensitive, words in any order, name matches first.
- **Deep search** on the server after a 300 ms pause, query of at least 2 normalized characters
  through `POST /api/patients/search` (a Route Handler, not a Server Action: it can be aborted
  and timed out, and does not queue behind other actions; same-origin JSON only), then
  `server/queries.ts`: phone (digits), patient code and summary
  matched in JS (`deep-match.ts`), notes in SQL on the trigram-indexed `notes.search_text`.
  Returns **ids and match kinds only**; the list shows a "Khớp …" hint, never the content.
- **Suggestions** "Có phải bạn tìm…?": trigram similarity on the full NAME only (`similarity.ts`,
  same measure as `pg_trgm`, threshold 0.35, at most 5), only when nothing matched at all.
- **No result**: "Thêm bệnh nhân" opens the add form with the name prefilled, carried in
  `sessionStorage[NEW_PATIENT_NAME_KEY]` (read once and removed), never in the URL.
- **Voice search** (`hooks/use-speech-search.ts`): Web Speech API, `vi-VN`, interim results
  typed into the box; no mic button where the API is missing.

## Rules

- Always compare **normalized** strings (`normalizeVi`). Never write a second normalization.
- The browser only ever gets what the list shows (`SearchablePatient`: name, hometown, the meta
  line, the link). Never send `search_text`: it holds phone and patient code.
- The query is patient data: never in a URL, a title, storage or a log.
- UI rows are the shared `PersonRow` (`src/components/common`): this module does not import the
  components of `patients`; the list page composes both.
