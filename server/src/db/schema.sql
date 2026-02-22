-- Taste Database Schema

CREATE TABLE IF NOT EXISTS experts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email_encrypted TEXT NOT NULL,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'expert' CHECK (role IN ('admin', 'expert')),
  domains TEXT NOT NULL DEFAULT '[]',  -- JSON array of domain strings
  credentials TEXT NOT NULL DEFAULT '{}',  -- JSON: { bio, portfolioUrls[], socialLinks[] }
  availability TEXT NOT NULL DEFAULT 'offline' CHECK (availability IN ('online', 'offline', 'busy')),
  consent_to_public_profile INTEGER NOT NULL DEFAULT 0,
  agreement_accepted_at TEXT,  -- ISO timestamp when expert accepted agreement
  completed_jobs INTEGER NOT NULL DEFAULT 0,
  avg_response_time_mins REAL NOT NULL DEFAULT 0,
  earnings_usdc REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  acp_job_id TEXT UNIQUE,  -- ID from ACP protocol
  offering_type TEXT NOT NULL,  -- vibes_check, narrative, creative_review, community_sentiment, general
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_progress', 'delivered', 'rejected', 'timeout')),
  expert_id TEXT REFERENCES experts(id),
  requirements TEXT NOT NULL DEFAULT '{}',  -- JSON: the agent's request
  buyer_agent TEXT,  -- requesting agent identifier
  price_usdc REAL NOT NULL DEFAULT 0,
  sla_minutes INTEGER NOT NULL DEFAULT 120,  -- 2 hours default
  assigned_at TEXT,
  deadline_at TEXT,
  delivered_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS judgments (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id),
  expert_id TEXT NOT NULL REFERENCES experts(id),
  offering_type TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '{}',  -- JSON: structured judgment per offering schema
  disclaimer TEXT NOT NULL,
  expert_name TEXT NOT NULL,
  expert_public_profile TEXT,
  submitted_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reputation_events (
  id TEXT PRIMARY KEY,
  expert_id TEXT NOT NULL REFERENCES experts(id),
  domain TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('job_completed', 'positive_feedback', 'timeout', 'rejected')),
  score_change INTEGER NOT NULL,
  job_id TEXT REFERENCES jobs(id),
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reputation_scores (
  expert_id TEXT NOT NULL REFERENCES experts(id),
  domain TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 50,
  PRIMARY KEY (expert_id, domain)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,  -- expert, job, judgment
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,  -- created, updated, assigned, delivered, etc.
  details TEXT,  -- JSON: additional context
  performed_by TEXT,  -- expert_id or 'system'
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_expert_id ON jobs(expert_id);
CREATE INDEX IF NOT EXISTS idx_jobs_offering_type ON jobs(offering_type);
CREATE INDEX IF NOT EXISTS idx_judgments_job_id ON judgments(job_id);
CREATE INDEX IF NOT EXISTS idx_reputation_events_expert_id ON reputation_events(expert_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
