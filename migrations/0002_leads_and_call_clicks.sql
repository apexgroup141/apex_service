CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  area TEXT,
  service TEXT NOT NULL,
  message TEXT,
  page TEXT,
  user_agent TEXT,
  ip TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS leads_created_at_idx
ON leads (created_at);

CREATE INDEX IF NOT EXISTS leads_area_created_at_idx
ON leads (area, created_at);

CREATE INDEX IF NOT EXISTS leads_service_created_at_idx
ON leads (service, created_at);

CREATE TABLE IF NOT EXISTS call_clicks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT,
  label TEXT,
  page TEXT,
  user_agent TEXT,
  ip TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS call_clicks_created_at_idx
ON call_clicks (created_at);

CREATE INDEX IF NOT EXISTS call_clicks_phone_created_at_idx
ON call_clicks (phone, created_at);
