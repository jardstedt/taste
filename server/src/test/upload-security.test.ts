import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDb } from './helpers.js';
import { getDb } from '../db/database.js';
import {
  saveFile,
  sanitizeFilename,
  validateMagicBytes,
  validateExtension,
  verifySignedUrl,
  signUrl,
  MAX_FILE_SIZE,
} from '../services/storage.js';
import { createSession, getSessionById } from '../services/sessions.js';

function testSession() {
  return createSession({
    offeringType: 'trust_evaluation',
    tierId: 'quick',
    description: 'Test',
    buyerAgent: 'agent-1',
    priceUsdc: 0.01,
  });
}

// Valid PNG
const VALID_PNG = Buffer.from([
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
  0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
  0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
  0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
  0x00, 0x00, 0x02, 0x00, 0x01, 0xE2, 0x21, 0xBC,
  0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,
  0x44, 0xAE, 0x42, 0x60, 0x82,
]);

// EXE header bytes (MZ)
const EXE_BYTES = Buffer.from([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);

describe('upload security', () => {
  beforeEach(() => {
    setupTestDb();
  });

  describe('path traversal', () => {
    it('sanitizes ../../../etc/passwd', () => {
      const sanitized = sanitizeFilename('../../../etc/passwd');
      expect(sanitized).not.toContain('..');
      expect(sanitized).not.toContain('/');
    });

    it('sanitizes ..\\..\\system32\\evil.exe', () => {
      const sanitized = sanitizeFilename('..\\..\\system32\\evil.exe');
      expect(sanitized).not.toContain('..');
      expect(sanitized).not.toContain('\\');
    });

    it('path traversal filename does not affect storage location', () => {
      const session = testSession();
      // This should still work — the user filename is never used for disk path
      const result = saveFile(session.id, VALID_PNG, '../../../etc/evil.png', 'image/png');
      expect(result.storedFilename).toMatch(/^[0-9a-f-]+\.png$/);
    });
  });

  describe('MIME spoofing', () => {
    it('rejects EXE bytes with PNG Content-Type', () => {
      const session = testSession();
      expect(() => saveFile(session.id, EXE_BYTES, 'virus.png', 'image/png'))
        .toThrow('does not match');
    });

    it('rejects PNG bytes with JPEG Content-Type', () => {
      const session = testSession();
      expect(() => saveFile(session.id, VALID_PNG, 'photo.jpg', 'image/jpeg'))
        .toThrow('does not match');
    });

    it('rejects random bytes with PDF Content-Type', () => {
      const session = testSession();
      const random = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04]);
      expect(() => saveFile(session.id, random, 'doc.pdf', 'application/pdf'))
        .toThrow('does not match');
    });
  });

  describe('double extensions', () => {
    it('double extension file.png.exe is rejected at MIME level', () => {
      const session = testSession();
      // Even if the original filename has double extension, we reject by MIME type
      expect(() => saveFile(session.id, EXE_BYTES, 'file.png.exe', 'application/x-msdownload'))
        .toThrow('not allowed');
    });

    it('extension mismatch does not prevent storage (UUID filename used)', () => {
      const session = testSession();
      // PNG content with wrong extension — magic bytes match PNG mime, extension doesn't
      // File still saves because we use UUID filenames with canonical extension
      const result = saveFile(session.id, VALID_PNG, 'wrong.gif', 'image/png');
      expect(result.storedFilename).toMatch(/\.png$/);
    });
  });

  describe('null byte injection', () => {
    it('sanitizes null bytes in filename', () => {
      const sanitized = sanitizeFilename('image.png\0.exe');
      expect(sanitized).not.toContain('\0');
      expect(sanitized).toBe('image.png.exe');
    });

    it('null byte in filename does not affect storage', () => {
      const session = testSession();
      const result = saveFile(session.id, VALID_PNG, 'image.png\0.exe', 'image/png');
      expect(result.storedFilename).toMatch(/\.png$/);
      expect(result.storedFilename).not.toContain('\0');
    });
  });

  describe('empty buffer', () => {
    it('rejects empty buffer for image types', () => {
      const session = testSession();
      const empty = Buffer.alloc(0);
      expect(() => saveFile(session.id, empty, 'empty.png', 'image/png'))
        .toThrow('does not match');
    });
  });

  describe('WebP vs RIFF differentiation', () => {
    it('rejects WAV disguised as WebP', () => {
      const session = testSession();
      const wavFile = Buffer.from([
        0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00,
        0x57, 0x41, 0x56, 0x45, 0x66, 0x6D, 0x74, 0x20,
      ]);
      expect(() => saveFile(session.id, wavFile, 'audio.webp', 'image/webp'))
        .toThrow('does not match');
    });
  });

  describe('file size limits', () => {
    it('rejects file exceeding MAX_FILE_SIZE', () => {
      const session = testSession();
      const oversized = Buffer.alloc(MAX_FILE_SIZE + 1);
      // Add PNG header so it passes magic byte check
      VALID_PNG.copy(oversized);

      expect(() => saveFile(session.id, oversized, 'big.png', 'image/png'))
        .toThrow('maximum size');
    });

    it('accepts file at exactly MAX_FILE_SIZE', () => {
      const session = testSession();
      const exact = Buffer.alloc(MAX_FILE_SIZE);
      // Add PNG header
      VALID_PNG.copy(exact);

      const result = saveFile(session.id, exact, 'exact.png', 'image/png');
      expect(result.fileSizeBytes).toBe(MAX_FILE_SIZE);
    });
  });

  describe('session total size enforcement', () => {
    it('rejects upload that would exceed session total', () => {
      const session = testSession();
      const db = getDb();

      // Fill up most of the session allowance with a big file
      const big = Buffer.alloc(4 * 1024 * 1024); // 4MB
      VALID_PNG.copy(big);

      // Save 5 files of 4MB each = 20MB
      for (let i = 0; i < 5; i++) {
        const result = saveFile(session.id, big, `file${i}.png`, 'image/png');
        // Save record so total is tracked in DB
        db.prepare(
          `INSERT INTO session_attachments (id, session_id, original_filename, stored_filename, mime_type, file_size_bytes, upload_context, uploader_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(result.id, session.id, `file${i}.png`, result.storedFilename, 'image/png', result.fileSizeBytes, 'chat', 'expert-1');
      }

      // Next upload should fail
      expect(() => saveFile(session.id, big, 'extra.png', 'image/png'))
        .toThrow('limit');
    });
  });

  describe('signed URL security', () => {
    it('rejects expired signed URL', () => {
      const id = 'attachment-123';
      const expired = Date.now() - 1000;
      const sig = signUrl(id, expired);

      expect(verifySignedUrl(id, expired, sig)).toBe(false);
    });

    it('rejects random signature', () => {
      const id = 'attachment-123';
      const expires = Date.now() + 60000;

      expect(verifySignedUrl(id, expires, 'aaaa1111bbbb2222')).toBe(false);
    });

    it('rejects tampered attachment ID', () => {
      const id = 'attachment-123';
      const expires = Date.now() + 60000;
      const sig = signUrl(id, expires);

      expect(verifySignedUrl('attachment-456', expires, sig)).toBe(false);
    });

    it('rejects tampered expiry', () => {
      const id = 'attachment-123';
      const expires = Date.now() + 60000;
      const sig = signUrl(id, expires);

      // Try with a different expiry
      expect(verifySignedUrl(id, expires + 1000, sig)).toBe(false);
    });

    it('accepts valid signature', () => {
      const id = 'attachment-123';
      const expires = Date.now() + 60000;
      const sig = signUrl(id, expires);

      expect(verifySignedUrl(id, expires, sig)).toBe(true);
    });
  });
});
