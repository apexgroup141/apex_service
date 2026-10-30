-- Additive only: existing rows keep their data, new columns start as NULL.
-- Rows with notify_status NULL predate this migration and are never retried.

ALTER TABLE leads ADD COLUMN submission_id TEXT;
ALTER TABLE leads ADD COLUMN notify_status TEXT;
ALTER TABLE leads ADD COLUMN notify_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE leads ADD COLUMN notify_next_at TEXT;
ALTER TABLE leads ADD COLUMN notify_sent_at TEXT;
ALTER TABLE leads ADD COLUMN notify_last_error TEXT;
ALTER TABLE leads ADD COLUMN notify_payload TEXT;

ALTER TABLE leads ADD COLUMN gclid TEXT;
ALTER TABLE leads ADD COLUMN gbraid TEXT;
ALTER TABLE leads ADD COLUMN wbraid TEXT;
ALTER TABLE leads ADD COLUMN utm_source TEXT;
ALTER TABLE leads ADD COLUMN utm_medium TEXT;
ALTER TABLE leads ADD COLUMN utm_campaign TEXT;
ALTER TABLE leads ADD COLUMN lp_variant TEXT;
ALTER TABLE leads ADD COLUMN attributed_at TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS leads_submission_id_idx
ON leads (submission_id)
WHERE submission_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS leads_notify_queue_idx
ON leads (notify_status, notify_next_at);
