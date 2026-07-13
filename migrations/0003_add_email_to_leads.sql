ALTER TABLE leads ADD COLUMN email TEXT;

CREATE INDEX IF NOT EXISTS leads_email_created_at_idx
ON leads (email, created_at);
