-- v1.4: Structured deliverables & file attachments

-- Structured deliverable data per session
CREATE TABLE IF NOT EXISTS session_deliverables (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE REFERENCES sessions(id),
  offering_type TEXT NOT NULL,
  structured_data TEXT NOT NULL DEFAULT '{}',
  summary TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- File attachments
CREATE TABLE IF NOT EXISTS session_attachments (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  original_filename TEXT NOT NULL,
  stored_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  upload_context TEXT NOT NULL DEFAULT 'chat' CHECK (upload_context IN ('chat', 'completion')),
  uploader_id TEXT NOT NULL,
  message_id TEXT REFERENCES messages(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_attachments_session ON session_attachments(session_id);
