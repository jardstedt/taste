import Database from 'better-sqlite3';
import { readFileSync, existsSync } from 'fs';
import { mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
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

  const v13 = resolve(__dirname, 'migration-v1.3.sql');
  if (existsSync(v13)) {
    db.exec(readFileSync(v13, 'utf-8'));
    console.log('[DB] v1.3 migration applied');
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
  if (!key) return email; // No encryption without key (dev mode)

  const keyBuf = Buffer.from(key, 'hex');
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', keyBuf, iv);
  let encrypted = cipher.update(email, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export function decryptEmail(encrypted: string): string {
  const env = getEnv();
  const key = env.EMAIL_ENCRYPTION_KEY;
  if (!key) return encrypted; // No encryption without key (dev mode)

  const keyBuf = Buffer.from(key, 'hex');
  const [ivHex, encHex] = encrypted.split(':');
  if (!ivHex || !encHex) return encrypted;

  const iv = Buffer.from(ivHex, 'hex');
  const decipher = createDecipheriv('aes-256-cbc', keyBuf, iv);
  let decrypted = decipher.update(encHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
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
