CREATE TABLE IF NOT EXISTS google_reviews_cache (
  cache_key TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_attempt_at TEXT NOT NULL,
  last_error TEXT
);
