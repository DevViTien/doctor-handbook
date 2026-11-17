-- Trigram matching for accent-insensitive, fuzzy search on `search_text` columns.
-- Must run before any migration that creates a `gin_trgm_ops` index.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
