-- Taste v1.1 Migration: Real-Time Chat Sessions
-- Additive migration — v1.0 tables remain untouched

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  job_id TEXT REFERENCES jobs(id),  -- Optional link to v1.0 job
  acp_job_id TEXT,
  tier_id TEXT NOT NULL DEFAULT 'quick' CHECK (tier_id IN ('quick', 'full', 'deep')),
  offering_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'matching', 'accepted', 'active', 'wrapping_up', 'completed', 'cancelled', 'timeout')),
  expert_id TEXT REFERENCES experts(id),
  buyer_agent TEXT,
  buyer_agent_display TEXT,
  price_usdc REAL NOT NULL DEFAULT 0,
  expert_payout_usdc REAL NOT NULL DEFAULT 0,
  description TEXT,
  tags TEXT NOT NULL DEFAULT '[]',  -- JSON array
  turn_count INTEGER NOT NULL DEFAULT 0,
  max_turns INTEGER NOT NULL DEFAULT 20,
  idle_warned_at TEXT,
  accepted_at TEXT,
  started_at TEXT,
  completed_at TEXT,
  deadline_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  sender_type TEXT NOT NULL CHECK (sender_type IN ('agent', 'expert', 'system')),
  sender_id TEXT,
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'addon_request', 'addon_response', 'system_notice', 'summary', 'image')),
  metadata TEXT NOT NULL DEFAULT '{}',  -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS addons (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  addon_type TEXT NOT NULL CHECK (addon_type IN ('screenshot', 'extended_time', 'written_report', 'second_opinion', 'image_upload', 'follow_up')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'completed')),
  price_usdc REAL NOT NULL DEFAULT 0,
  description TEXT,
  requested_by TEXT,
  message_id TEXT REFERENCES messages(id),
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_expert_id ON sessions(expert_id);
CREATE INDEX IF NOT EXISTS idx_sessions_acp_job_id ON sessions(acp_job_id);
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_addons_session_id ON addons(session_id);
