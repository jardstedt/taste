import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDb, testSession } from './helpers.js';
import {
  validateMagicBytes,
  validateExtension,
  sanitizeFilename,
  isAllowedMimeType,
  saveFile,
  readFile,
  createSignedUrl,
  verifySignedUrl,
  signUrl,
  saveAttachmentRecord,
  getAttachmentById,
  getSessionAttachments,
  MAX_FILE_SIZE,
  SIGNED_URL_EXPIRY_MS,
} from '../services/storage.js';

// Valid PNG: minimal 1x1 pixel PNG
const VALID_PNG = Buffer.from([
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
  0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1
  0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, // RGB
  0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, // IDAT
  0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
  0x00, 0x00, 0x02, 0x00, 0x01, 0xE2, 0x21, 0xBC,
  0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,
  0x44, 0xAE, 0x42, 0x60, 0x82, // IEND
]);

// Valid JPEG header
const VALID_JPEG = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]);

// Valid PDF header
const VALID_PDF = Buffer.from('%PDF-1.4 test content');

// Valid text
const VALID_TEXT = Buffer.from('Hello, this is a test text file.');

describe('storage', () => {
  beforeEach(() => {
    setupTestDb();
  });

  describe('validateMagicBytes', () => {
    it('validates PNG magic bytes', () => {
      expect(validateMagicBytes(VALID_PNG, 'image/png')).toBe(true);
    });

    it('validates JPEG magic bytes', () => {
      expect(validateMagicBytes(VALID_JPEG, 'image/jpeg')).toBe(true);
    });

    it('validates PDF magic bytes', () => {
      expect(validateMagicBytes(VALID_PDF, 'application/pdf')).toBe(true);
    });

    it('validates text files (no null bytes)', () => {
      expect(validateMagicBytes(VALID_TEXT, 'text/plain')).toBe(true);
    });

    it('rejects text files with null bytes', () => {
      const nullText = Buffer.from([0x48, 0x65, 0x00, 0x6C, 0x6C, 0x6F]); // He\0llo
      expect(validateMagicBytes(nullText, 'text/plain')).toBe(false);
    });

    it('rejects PNG when bytes are JPEG', () => {
      expect(validateMagicBytes(VALID_JPEG, 'image/png')).toBe(false);
    });

    it('rejects JPEG when bytes are PNG', () => {
      expect(validateMagicBytes(VALID_PNG, 'image/jpeg')).toBe(false);
    });

    it('rejects EXE bytes declared as PNG', () => {
      const exeBytes = Buffer.from([0x4D, 0x5A, 0x90, 0x00]); // MZ header
      expect(validateMagicBytes(exeBytes, 'image/png')).toBe(false);
    });

    it('validates WebP magic bytes (RIFF + WEBP)', () => {
      // Valid WebP: RIFF....WEBP
      const validWebP = Buffer.from([
        0x52, 0x49, 0x46, 0x46, // RIFF
        0x00, 0x00, 0x00, 0x00, // file size (placeholder)
        0x57, 0x45, 0x42, 0x50, // WEBP
        0x56, 0x50, 0x38, 0x20, // VP8 chunk
      ]);
      expect(validateMagicBytes(validWebP, 'image/webp')).toBe(true);
    });

    it('rejects WAV file declared as WebP (RIFF but not WEBP)', () => {
      // WAV: RIFF....WAVE
      const wavFile = Buffer.from([
        0x52, 0x49, 0x46, 0x46, // RIFF
        0x00, 0x00, 0x00, 0x00, // file size
        0x57, 0x41, 0x56, 0x45, // WAVE (not WEBP)
        0x66, 0x6D, 0x74, 0x20, // fmt chunk
      ]);
      expect(validateMagicBytes(wavFile, 'image/webp')).toBe(false);
    });

    it('rejects AVI file declared as WebP (RIFF but not WEBP)', () => {
      // AVI: RIFF....AVI
      const aviFile = Buffer.from([
        0x52, 0x49, 0x46, 0x46, // RIFF
        0x00, 0x00, 0x00, 0x00, // file size
        0x41, 0x56, 0x49, 0x20, // AVI (not WEBP)
      ]);
      expect(validateMagicBytes(aviFile, 'image/webp')).toBe(false);
    });

    it('rejects truncated RIFF file declared as WebP (< 12 bytes)', () => {
      const truncated = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00]);
      expect(validateMagicBytes(truncated, 'image/webp')).toBe(false);
    });

    it('rejects empty buffer for all binary types', () => {
      const empty = Buffer.alloc(0);
      expect(validateMagicBytes(empty, 'image/png')).toBe(false);
      expect(validateMagicBytes(empty, 'image/jpeg')).toBe(false);
      expect(validateMagicBytes(empty, 'image/webp')).toBe(false);
      expect(validateMagicBytes(empty, 'application/pdf')).toBe(false);
    });

    it('accepts empty buffer for text/plain (no null bytes to find)', () => {
      const empty = Buffer.alloc(0);
      expect(validateMagicBytes(empty, 'text/plain')).toBe(true);
    });
  });

  describe('validateExtension', () => {
    it('validates .png with image/png', () => {
      expect(validateExtension('photo.png', 'image/png')).toBe(true);
    });

    it('validates .jpg with image/jpeg', () => {
      expect(validateExtension('photo.jpg', 'image/jpeg')).toBe(true);
    });

    it('validates .jpeg with image/jpeg', () => {
      expect(validateExtension('photo.jpeg', 'image/jpeg')).toBe(true);
    });

    it('rejects .exe extension', () => {
      expect(validateExtension('virus.exe', 'image/png')).toBe(false);
    });

    it('rejects mismatched extension and MIME', () => {
      expect(validateExtension('photo.gif', 'image/png')).toBe(false);
    });
  });

  describe('sanitizeFilename', () => {
    it('strips path separators', () => {
      expect(sanitizeFilename('../../../etc/passwd')).toBe('______etc_passwd');
    });

    it('strips null bytes', () => {
      expect(sanitizeFilename('image.png\0.exe')).toBe('image.png.exe');
    });

    it('strips backslash path traversal', () => {
      const sanitized = sanitizeFilename('..\\..\\system32\\evil.exe');
      expect(sanitized).not.toContain('..');
      expect(sanitized).not.toContain('\\');
    });

    it('limits length to 255', () => {
      const long = 'a'.repeat(300) + '.png';
      expect(sanitizeFilename(long).length).toBeLessThanOrEqual(255);
    });

    it('strips control characters', () => {
      expect(sanitizeFilename('file\x01\x02name.txt')).toBe('filename.txt');
    });
  });

  describe('isAllowedMimeType', () => {
    it('allows image/png', () => {
      expect(isAllowedMimeType('image/png')).toBe(true);
    });

    it('allows application/pdf', () => {
      expect(isAllowedMimeType('application/pdf')).toBe(true);
    });

    it('rejects application/x-executable', () => {
      expect(isAllowedMimeType('application/x-executable')).toBe(false);
    });

    it('rejects application/javascript', () => {
      expect(isAllowedMimeType('application/javascript')).toBe(false);
    });
  });

  describe('saveFile + readFile', () => {
    it('saves and reads a file round-trip', () => {
      const session = testSession();
      const result = saveFile(session.id, VALID_PNG, 'test.png', 'image/png');

      expect(result.id).toBeTruthy();
      expect(result.storedFilename).toMatch(/\.png$/);
      expect(result.fileSizeBytes).toBe(VALID_PNG.length);

      const read = readFile(session.id, result.storedFilename);
      expect(read).not.toBeNull();
      expect(read!.length).toBe(VALID_PNG.length);
    });

    it('rejects disallowed MIME type', () => {
      const session = testSession();
      expect(() => saveFile(session.id, Buffer.from('test'), 'test.exe', 'application/x-msdownload'))
        .toThrow('not allowed');
    });

    it('rejects oversized files', () => {
      const session = testSession();
      const big = Buffer.alloc(MAX_FILE_SIZE + 1, 0x89);
      expect(() => saveFile(session.id, big, 'big.png', 'image/png'))
        .toThrow('maximum size');
    });

    it('rejects MIME spoofing (PNG header for JPEG mime)', () => {
      const session = testSession();
      expect(() => saveFile(session.id, VALID_PNG, 'photo.jpg', 'image/jpeg'))
        .toThrow('does not match');
    });
  });

  describe('signed URLs', () => {
    it('creates and verifies a signed URL', () => {
      const attachmentId = 'test-attachment-id';
      const url = createSignedUrl(attachmentId, 'http://localhost:3001');

      expect(url).toContain('/api/public/files/test-attachment-id');
      expect(url).toContain('expires=');
      expect(url).toContain('sig=');
    });

    it('verifies valid signature', () => {
      const id = 'att-123';
      const expires = Date.now() + 60000;
      const sig = signUrl(id, expires);

      expect(verifySignedUrl(id, expires, sig)).toBe(true);
    });

    it('rejects expired signature', () => {
      const id = 'att-123';
      const expires = Date.now() - 1000; // already expired
      const sig = signUrl(id, expires);

      expect(verifySignedUrl(id, expires, sig)).toBe(false);
    });

    it('rejects random signature', () => {
      const id = 'att-123';
      const expires = Date.now() + 60000;

      expect(verifySignedUrl(id, expires, 'random-fake-signature')).toBe(false);
    });

    it('rejects tampered attachment ID', () => {
      const id = 'att-123';
      const expires = Date.now() + 60000;
      const sig = signUrl(id, expires);

      // Try with different ID
      expect(verifySignedUrl('att-456', expires, sig)).toBe(false);
    });
  });

  describe('attachment DB operations', () => {
    it('saves and retrieves an attachment record', () => {
      const session = testSession();
      const file = saveFile(session.id, VALID_PNG, 'screenshot.png', 'image/png');

      const attachment = saveAttachmentRecord(
        file.id, session.id, 'screenshot.png', file.storedFilename,
        'image/png', file.fileSizeBytes, 'chat', 'expert-1',
      );

      expect(attachment.id).toBe(file.id);
      expect(attachment.originalFilename).toBe('screenshot.png');
      expect(attachment.mimeType).toBe('image/png');

      const fetched = getAttachmentById(file.id);
      expect(fetched).not.toBeNull();
      expect(fetched!.sessionId).toBe(session.id);
    });

    it('lists session attachments', () => {
      const session = testSession();
      const f1 = saveFile(session.id, VALID_PNG, 'a.png', 'image/png');
      const f2 = saveFile(session.id, VALID_TEXT, 'b.txt', 'text/plain');

      saveAttachmentRecord(f1.id, session.id, 'a.png', f1.storedFilename, 'image/png', f1.fileSizeBytes, 'chat', 'e1');
      saveAttachmentRecord(f2.id, session.id, 'b.txt', f2.storedFilename, 'text/plain', f2.fileSizeBytes, 'completion', 'e1');

      const list = getSessionAttachments(session.id);
      expect(list).toHaveLength(2);
    });
  });
});
