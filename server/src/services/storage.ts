import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync, readdirSync } from 'fs';
import { join, extname, resolve } from 'path';
import { randomUUID, createHmac, timingSafeEqual } from 'crypto';
import { getEnv } from '../config/env.js';
import { getDb, generateId } from '../db/database.js';

// ── Constants ──

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB per file
export const MAX_SESSION_TOTAL = 20 * 1024 * 1024; // 20MB per session
export const SIGNED_URL_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
] as const;

export type AllowedMimeType = typeof ALLOWED_MIME_TYPES[number];

// ── Magic Byte Signatures ──

const MAGIC_BYTES: Record<string, number[][]> = {
  'image/png': [[0x89, 0x50, 0x4E, 0x47]],
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/gif': [[0x47, 0x49, 0x46, 0x38]], // GIF8
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF (WebP starts with RIFF)
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]], // %PDF
  // text/plain has no magic bytes — validated by absence of null bytes
};

// Extension to MIME mapping
const EXTENSION_TO_MIME: Record<string, AllowedMimeType> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
};

// MIME to canonical extension
const MIME_TO_EXTENSION: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
  'text/plain': '.txt',
};

// ── Validation ──

export function isAllowedMimeType(mime: string): mime is AllowedMimeType {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(mime);
}

export function validateMagicBytes(buffer: Buffer, declaredMime: string): boolean {
  if (declaredMime === 'text/plain') {
    // Text files: check for absence of null bytes in first 1024 bytes
    const checkLen = Math.min(buffer.length, 1024);
    for (let i = 0; i < checkLen; i++) {
      if (buffer[i] === 0x00) return false;
    }
    return true;
  }

  const signatures = MAGIC_BYTES[declaredMime];
  if (!signatures) return false;

  const headerMatch = signatures.some(sig =>
    sig.every((byte, i) => i < buffer.length && buffer[i] === byte),
  );
  if (!headerMatch) return false;

  // WebP: RIFF header matches WAV/AVI too — verify bytes 8-11 are "WEBP"
  if (declaredMime === 'image/webp') {
    if (buffer.length < 12) return false;
    return buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
  }

  return true;
}

export function validateExtension(filename: string, declaredMime: string): boolean {
  const ext = extname(filename).toLowerCase();
  if (!ext) return false;

  const expectedMime = EXTENSION_TO_MIME[ext];
  if (!expectedMime) return false;

  return expectedMime === declaredMime;
}

export function sanitizeFilename(filename: string): string {
  return filename
    // Remove null bytes
    .replace(/\0/g, '')
    // Remove path separators
    .replace(/[/\\]/g, '_')
    // Remove .. sequences
    .replace(/\.\./g, '_')
    // Remove control characters
    .replace(/[\x00-\x1F\x7F]/g, '')
    // Remove double quotes (prevents Content-Disposition header injection)
    .replace(/"/g, "'")
    // Limit length
    .slice(0, 255);
}

// ── Storage ──

function getUploadDir(): string {
  const env = getEnv();
  return (env as Record<string, string>).UPLOAD_DIR || './data/uploads';
}

function ensureSessionDir(sessionId: string): string {
  const base = resolve(getUploadDir());
  const dir = resolve(base, sessionId);
  if (!dir.startsWith(base)) {
    throw new Error('Path traversal detected');
  }
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export interface SaveFileResult {
  id: string;
  storedFilename: string;
  fileSizeBytes: number;
}

export function saveFile(
  sessionId: string,
  buffer: Buffer,
  originalFilename: string,
  declaredMime: string,
): SaveFileResult {
  // 1. Validate MIME type
  if (!isAllowedMimeType(declaredMime)) {
    throw new Error(`File type "${declaredMime}" is not allowed`);
  }

  // 2. Validate file size
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`File exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  // 3. Check session total
  const sessionTotal = getSessionTotalBytes(sessionId);
  if (sessionTotal + buffer.length > MAX_SESSION_TOTAL) {
    throw new Error(`Session attachment limit of ${MAX_SESSION_TOTAL / 1024 / 1024}MB exceeded`);
  }

  // 4. Validate magic bytes
  if (!validateMagicBytes(buffer, declaredMime)) {
    throw new Error('File content does not match declared type');
  }

  // 5. Validate extension consistency
  const sanitized = sanitizeFilename(originalFilename);
  if (sanitized && !validateExtension(sanitized, declaredMime)) {
    // Extension mismatch — use canonical extension for the MIME type
    // This handles double extensions like .png.exe
  }

  // 6. Generate UUID filename with canonical extension
  const id = generateId();
  const ext = MIME_TO_EXTENSION[declaredMime] || '.bin';
  const storedFilename = `${randomUUID()}${ext}`;

  // 7. Write to disk
  const dir = ensureSessionDir(sessionId);
  const filePath = join(dir, storedFilename);
  writeFileSync(filePath, buffer);

  return { id, storedFilename, fileSizeBytes: buffer.length };
}

export function readFile(sessionId: string, storedFilename: string): Buffer | null {
  const base = resolve(getUploadDir());
  const filePath = resolve(base, sessionId, storedFilename);
  if (!filePath.startsWith(base)) return null; // Path traversal guard
  if (!existsSync(filePath)) return null;
  return readFileSync(filePath);
}

export function deleteFile(sessionId: string, storedFilename: string): boolean {
  const base = resolve(getUploadDir());
  const filePath = resolve(base, sessionId, storedFilename);
  if (!filePath.startsWith(base)) return false; // Path traversal guard
  if (!existsSync(filePath)) return false;
  unlinkSync(filePath);
  return true;
}

function getSessionTotalBytes(sessionId: string): number {
  const db = getDb();
  const result = db.prepare(
    'SELECT COALESCE(SUM(file_size_bytes), 0) as total FROM session_attachments WHERE session_id = ?',
  ).get(sessionId) as { total: number };
  return result.total;
}

// ── Signed URLs ──

export function createSignedUrl(attachmentId: string, baseUrl: string): string {
  const expires = Date.now() + SIGNED_URL_EXPIRY_MS;
  const sig = signUrl(attachmentId, expires);
  return `${baseUrl}/api/public/files/${attachmentId}?expires=${expires}&sig=${sig}`;
}

export function signUrl(attachmentId: string, expires: number): string {
  const env = getEnv();
  const secret = env.FILE_SIGNING_SECRET || `url-sign:${env.JWT_SECRET}`;
  return createHmac('sha256', secret)
    .update(`${attachmentId}:${expires}`)
    .digest('hex');
}

export function verifySignedUrl(attachmentId: string, expires: number, sig: string): boolean {
  // Check expiry
  if (Date.now() > expires) return false;

  // Verify HMAC with timing-safe comparison
  const expected = signUrl(attachmentId, expires);
  const expectedBuf = Buffer.from(expected, 'utf8');
  const sigBuf = Buffer.from(sig, 'utf8');
  if (expectedBuf.length !== sigBuf.length) return false;
  return timingSafeEqual(expectedBuf, sigBuf);
}

// ── Attachment DB Operations ──

export interface AttachmentRecord {
  id: string;
  sessionId: string;
  originalFilename: string;
  storedFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  uploadContext: 'chat' | 'completion';
  uploaderId: string;
  messageId: string | null;
  createdAt: string;
}

interface AttachmentRow {
  id: string;
  session_id: string;
  original_filename: string;
  stored_filename: string;
  mime_type: string;
  file_size_bytes: number;
  upload_context: string;
  uploader_id: string;
  message_id: string | null;
  created_at: string;
}

function rowToAttachment(row: AttachmentRow): AttachmentRecord {
  return {
    id: row.id,
    sessionId: row.session_id,
    originalFilename: row.original_filename,
    storedFilename: row.stored_filename,
    mimeType: row.mime_type,
    fileSizeBytes: row.file_size_bytes,
    uploadContext: row.upload_context as 'chat' | 'completion',
    uploaderId: row.uploader_id,
    messageId: row.message_id,
    createdAt: row.created_at,
  };
}

export function saveAttachmentRecord(
  id: string,
  sessionId: string,
  originalFilename: string,
  storedFilename: string,
  mimeType: string,
  fileSizeBytes: number,
  uploadContext: 'chat' | 'completion',
  uploaderId: string,
  messageId?: string,
): AttachmentRecord {
  const db = getDb();
  db.prepare(
    `INSERT INTO session_attachments (id, session_id, original_filename, stored_filename, mime_type, file_size_bytes, upload_context, uploader_id, message_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, sessionId, sanitizeFilename(originalFilename), storedFilename, mimeType, fileSizeBytes, uploadContext, uploaderId, messageId ?? null);

  return getAttachmentById(id)!;
}

export function getAttachmentById(id: string): AttachmentRecord | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM session_attachments WHERE id = ?').get(id) as AttachmentRow | undefined;
  return row ? rowToAttachment(row) : null;
}

export function getSessionAttachments(sessionId: string): AttachmentRecord[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM session_attachments WHERE session_id = ? ORDER BY created_at ASC',
  ).all(sessionId) as AttachmentRow[];
  return rows.map(rowToAttachment);
}

// ── Avatar Storage ──

export const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2MB

const AVATAR_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;

export function isAllowedAvatarMime(mime: string): boolean {
  return (AVATAR_MIME_TYPES as readonly string[]).includes(mime);
}

function ensureAvatarDir(): string {
  const base = resolve(getUploadDir());
  const dir = resolve(base, 'avatars');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function deleteAvatar(expertId: string): boolean {
  const dir = ensureAvatarDir();
  // Remove any existing avatar file for this expert (any extension)
  const existing = readdirSync(dir).filter(f => f.startsWith(`${expertId}.`));
  for (const f of existing) {
    unlinkSync(join(dir, f));
  }
  return existing.length > 0;
}

export function saveAvatar(
  expertId: string,
  buffer: Buffer,
  originalFilename: string,
  declaredMime: string,
): string {
  if (!isAllowedAvatarMime(declaredMime)) {
    throw new Error(`Avatar type "${declaredMime}" is not allowed. Use PNG, JPEG, WebP, or GIF.`);
  }
  if (buffer.length > MAX_AVATAR_SIZE) {
    throw new Error(`Avatar exceeds maximum size of ${MAX_AVATAR_SIZE / 1024 / 1024}MB`);
  }
  if (!validateMagicBytes(buffer, declaredMime)) {
    throw new Error('File content does not match declared type');
  }

  // Delete old avatar before writing new one
  deleteAvatar(expertId);

  const ext = MIME_TO_EXTENSION[declaredMime] || '.png';
  const dir = ensureAvatarDir();
  const filePath = join(dir, `${expertId}${ext}`);
  writeFileSync(filePath, buffer);

  return `/api/public/avatars/${expertId}`;
}

export function readAvatar(expertId: string): { buffer: Buffer; mimeType: string } | null {
  const dir = ensureAvatarDir();
  // Try each image extension
  for (const mime of AVATAR_MIME_TYPES) {
    const ext = MIME_TO_EXTENSION[mime];
    if (!ext) continue;
    const filePath = join(dir, `${expertId}${ext}`);
    if (existsSync(filePath)) {
      return { buffer: readFileSync(filePath), mimeType: mime };
    }
  }
  return null;
}
