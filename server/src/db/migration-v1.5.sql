-- v1.5: Follow-up reference codes for content_quality_gate
CREATE TABLE IF NOT EXISTS reference_codes (
  code TEXT PRIMARY KEY,
  source_session_id TEXT NOT NULL REFERENCES sessions(id),
  offering_type TEXT NOT NULL,
  discount_pct INTEGER NOT NULL DEFAULT 50,
  redeemed_session_id TEXT REFERENCES sessions(id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_refcodes_source ON reference_codes(source_session_id);
