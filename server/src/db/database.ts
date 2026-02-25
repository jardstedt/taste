import Database from 'better-sqlite3';
import { readFileSync, existsSync } from 'fs';
import { mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { createCipheriv, createDecipheriv, randomBytes, createHmac } from 'crypto';
import { getEnv } from '../config/env.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) throw new Error('Database not initialized. Call initDb() first.');
  return _db;
}

export function initDb(): Database.Database {
  if (_db) return _db;

  const env = getEnv();
  const dbPath = resolve(env.DB_PATH);

  // Ensure data directory exists
  mkdirSync(dirname(dbPath), { recursive: true });

  _db = new Database(dbPath);

  // Enable WAL mode for better concurrent read performance
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  // Run schema
  const schema = readFileSync(resolve(__dirname, 'schema.sql'), 'utf-8');
  _db.exec(schema);

  // Run migrations
  runMigrations(_db);

  return _db;
}

const KNOWN_TABLES = ['experts', 'withdrawals', 'sessions', 'messages', 'addons', 'jobs', 'judgments', 'reputation_events', 'audit_log', 'session_deliverables', 'session_attachments'];

function hasColumn(db: Database.Database, table: string, column: string): boolean {
  if (!KNOWN_TABLES.includes(table)) throw new Error(`Unknown table: ${table}`);
  const cols = db.pragma(`table_info(${table})`) as Array<{ name: string }>;
  return cols.some(c => c.name === column);
}

function runMigrations(db: Database.Database): void {
  const v11 = resolve(__dirname, 'migration-v1.1.sql');
  if (existsSync(v11)) {
    db.exec(readFileSync(v11, 'utf-8'));
    console.log('[DB] v1.1 migration applied');
  }

  const v12 = resolve(__dirname, 'migration-v1.2.sql');
  if (existsSync(v12)) {
    db.exec(readFileSync(v12, 'utf-8'));
    console.log('[DB] v1.2 migration applied');
  }

  // v1.3: wallet + withdrawals (ALTER TABLE needs column existence check)
  if (!hasColumn(db, 'experts', 'wallet_address')) {
    db.exec('ALTER TABLE experts ADD COLUMN wallet_address TEXT');
  }
  if (!hasColumn(db, 'experts', 'wallet_chain')) {
    db.exec("ALTER TABLE experts ADD COLUMN wallet_chain TEXT DEFAULT 'base'");
  }
  const v13 = resolve(__dirname, 'migration-v1.3.sql');
  if (existsSync(v13)) {
    db.exec(readFileSync(v13, 'utf-8'));
    console.log('[DB] v1.3 migration applied');
  }

  // v1.4: soft-delete for experts
  if (!hasColumn(db, 'experts', 'deactivated_at')) {
    db.exec('ALTER TABLE experts ADD COLUMN deactivated_at TEXT');
  }

  // v1.4: add 'file' to messages.message_type CHECK constraint (requires table rebuild)
  const msgSchema = (db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='messages'").get() as { sql: string } | undefined)?.sql ?? '';
  if (!msgSchema.includes("'file'")) {
    db.pragma('foreign_keys = OFF');
    db.exec(`
      DROP TABLE IF EXISTS messages_new;
      CREATE TABLE messages_new (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions(id),
        sender_type TEXT NOT NULL CHECK (sender_type IN ('agent', 'expert', 'system')),
        sender_id TEXT,
        content TEXT NOT NULL,
        message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'addon_request', 'addon_response', 'system_notice', 'summary', 'image', 'file')),
        metadata TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO messages_new SELECT * FROM messages;
      DROP TABLE messages;
      ALTER TABLE messages_new RENAME TO messages;
    `);
    db.pragma('foreign_keys = ON');
    console.log('[DB] v1.4 messages table rebuilt with file type');
  }

  // v1.4: structured deliverables & file attachments
  const v14 = resolve(__dirname, 'migration-v1.4.sql');
  if (existsSync(v14)) {
    db.exec(readFileSync(v14, 'utf-8'));
    console.log('[DB] v1.4 migration applied');
  }

  // v1.4: payment tracking for ACP sessions
  if (!hasColumn(db, 'sessions', 'payment_received_at')) {
    db.exec('ALTER TABLE sessions ADD COLUMN payment_received_at TEXT');
    console.log('[DB] v1.4 added payment_received_at to sessions');
  }

  // v1.5: security hardening
  if (!hasColumn(db, 'sessions', 'payout_confirmed_at')) {
    db.exec('ALTER TABLE sessions ADD COLUMN payout_confirmed_at TEXT');
  }
  if (!hasColumn(db, 'experts', 'email_hash')) {
    db.exec('ALTER TABLE experts ADD COLUMN email_hash TEXT');
    db.exec('CREATE INDEX IF NOT EXISTS idx_experts_email_hash ON experts(email_hash)');
  }
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

// ── Email Encryption ──


export function encryptEmail(email: string): string {
  const env = getEnv();
  const key = env.EMAIL_ENCRYPTION_KEY;
  if (!key) {
    if (env.NODE_ENV !== 'test') console.warn('[Security] EMAIL_ENCRYPTION_KEY not set — emails stored in plaintext');
    return email;
  }

  const keyBuf = Buffer.from(key, 'hex');
  const iv = randomBytes(12); // 12-byte IV for GCM
  const cipher = createCipheriv('aes-256-gcm', keyBuf, iv);
  let encrypted = cipher.update(email, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `gcm:${iv.toString('hex')}:${encrypted}:${tag}`;
}

export function decryptEmail(encrypted: string): string {
  const env = getEnv();
  const key = env.EMAIL_ENCRYPTION_KEY;
  if (!key) return encrypted; // No encryption without key (dev mode)

  const keyBuf = Buffer.from(key, 'hex');
  const parts = encrypted.split(':');

  // AES-256-GCM format: gcm:iv:encrypted:tag
  if (parts[0] === 'gcm' && parts.length === 4) {
    const iv = Buffer.from(parts[1], 'hex');
    const decipher = createDecipheriv('aes-256-gcm', keyBuf, iv);
    decipher.setAuthTag(Buffer.from(parts[3], 'hex'));
    let decrypted = decipher.update(parts[2], 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  // Legacy AES-256-CBC format: iv:encrypted
  if (parts.length === 2) {
    const iv = Buffer.from(parts[0], 'hex');
    const decipher = createDecipheriv('aes-256-cbc', keyBuf, iv);
    let decrypted = decipher.update(parts[1], 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  return encrypted;
}

/** Deterministic email hash for indexed lookup (HMAC-SHA256) */
export function hashEmail(email: string): string {
  const env = getEnv();
  const key = env.EMAIL_ENCRYPTION_KEY;
  if (!key) return email.toLowerCase(); // Dev mode: hash is the plaintext email
  return createHmac('sha256', Buffer.from(key, 'hex')).update(email.toLowerCase()).digest('hex');
}

// ── Audit Logging ──

export function auditLog(
  entityType: string,
  entityId: string,
  action: string,
  details?: Record<string, unknown>,
  performedBy?: string,
): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO audit_log (entity_type, entity_id, action, details, performed_by)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(entityType, entityId, action, details ? JSON.stringify(details) : null, performedBy ?? 'system');
}

// ── Helpers ──

export function generateId(): string {
  return randomBytes(12).toString('hex');
}
