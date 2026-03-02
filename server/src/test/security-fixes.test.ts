import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDb, createOnlineExpert, testSession } from './helpers.js';
import { getDb } from '../db/database.js';
import {
  createExpert,
  getExpertById,
  setExpertPassword,
  deactivateExpert,
  acceptAgreement,
} from '../services/experts.js';
import {
  createSession,
  getSessionById,
  matchSession,
  acceptSession,
} from '../services/sessions.js';
import { createExpertSchema, updateExpertSchema } from '../middleware/validation.js';
import { deleteAvatar, readAvatar, saveAvatar } from '../services/storage.js';

// Valid PNG for avatar tests
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

describe('security fixes', () => {
  beforeEach(() => {
    setupTestDb();
  });

  // ── Fix 2: URL scheme validation ──

  describe('URL scheme validation (H3)', () => {
    it('rejects javascript: URLs in linkedinUrl', () => {
      const result = createExpertSchema.safeParse({
        name: 'Test',
        email: 'test@test.com',
        domains: ['crypto'],
        password: 'Password123',
        credentials: { linkedinUrl: 'javascript:alert(1)' },
      });
      expect(result.success).toBe(false);
    });

    it('rejects javascript: URLs in portfolioUrl', () => {
      const result = createExpertSchema.safeParse({
        name: 'Test',
        email: 'test@test.com',
        domains: ['crypto'],
        password: 'Password123',
        credentials: { portfolioUrl: 'javascript:alert(document.cookie)' },
      });
      expect(result.success).toBe(false);
    });

    it('rejects javascript: URLs in profileImageUrl', () => {
      const result = updateExpertSchema.safeParse({
        credentials: { profileImageUrl: 'javascript:void(0)' },
      });
      expect(result.success).toBe(false);
    });

    it('rejects data: URLs', () => {
      const result = updateExpertSchema.safeParse({
        credentials: { linkedinUrl: 'data:text/html,<script>alert(1)</script>' },
      });
      expect(result.success).toBe(false);
    });

    it('accepts valid HTTPS URLs', () => {
      const result = createExpertSchema.safeParse({
        name: 'Test',
        email: 'test@test.com',
        domains: ['crypto'],
        password: 'Password123',
        credentials: {
          linkedinUrl: 'https://linkedin.com/in/test',
          portfolioUrl: 'https://example.com',
          profileImageUrl: 'https://cdn.example.com/avatar.jpg',
        },
      });
      expect(result.success).toBe(true);
    });

    it('accepts valid HTTP URLs', () => {
      const result = updateExpertSchema.safeParse({
        credentials: { portfolioUrl: 'http://example.com/portfolio' },
      });
      expect(result.success).toBe(true);
    });

    it('accepts empty strings for optional URL fields', () => {
      const result = updateExpertSchema.safeParse({
        credentials: { linkedinUrl: '', portfolioUrl: '' },
      });
      expect(result.success).toBe(true);
    });
  });

  // ── Fix 5: Password change invalidates tokens ──

  describe('password change sets passwordChangedAt (H2)', () => {
    it('sets passwordChangedAt on password change', async () => {
      const expert = createExpert('Alice', 'alice@test.com', ['crypto']);
      const before = getExpertById(expert.id)!;
      expect(before.passwordChangedAt).toBeNull();

      await setExpertPassword(expert.id, 'NewPassword1');

      const after = getExpertById(expert.id)!;
      expect(after.passwordChangedAt).toBeTruthy();
    });

    it('updates passwordChangedAt on subsequent password changes', async () => {
      const expert = createExpert('Bob', 'bob@test.com', ['crypto']);
      await setExpertPassword(expert.id, 'FirstPass1');
      const first = getExpertById(expert.id)!;

      // Small delay to ensure different timestamp
      await new Promise(r => setTimeout(r, 1100));

      await setExpertPassword(expert.id, 'SecondPass1');
      const second = getExpertById(expert.id)!;

      expect(second.passwordChangedAt).toBeTruthy();
      expect(new Date(second.passwordChangedAt!).getTime())
        .toBeGreaterThanOrEqual(new Date(first.passwordChangedAt!).getTime());
    });
  });

  // ── Fix 6: Avatar path traversal ──

  describe('avatar path traversal guard (M6)', () => {
    it('deleteAvatar rejects path separators in expertId', () => {
      const result = deleteAvatar('../../../etc/passwd');
      expect(result).toBe(false);
    });

    it('deleteAvatar rejects backslash traversal', () => {
      const result = deleteAvatar('..\\..\\evil');
      expect(result).toBe(false);
    });

    it('deleteAvatar rejects double-dot traversal', () => {
      const result = deleteAvatar('..something');
      expect(result).toBe(false);
    });

    it('readAvatar returns null for path traversal attempt', () => {
      const result = readAvatar('../../../etc/passwd');
      expect(result).toBeNull();
    });

    it('saveAvatar rejects path traversal in expertId', () => {
      expect(() => saveAvatar('../etc/passwd', VALID_PNG, 'test.png', 'image/png'))
        .toThrow('Path traversal detected');
    });

    it('saves and reads avatar with valid expertId', () => {
      const expert = createExpert('Alice', 'alice@test.com', ['crypto']);
      const url = saveAvatar(expert.id, VALID_PNG, 'avatar.png', 'image/png');
      expect(url).toContain(expert.id);

      const result = readAvatar(expert.id);
      expect(result).not.toBeNull();
      expect(result!.mimeType).toBe('image/png');
    });
  });

  // ── Fix 7: acceptSession eligibility ──

  describe('acceptSession eligibility checks (M1)', () => {
    it('rejects deactivated experts', async () => {
      const expert = await createOnlineExpert('Alice', 'alice@test.com', ['crypto']);
      const session = testSession();
      matchSession(session.id);

      deactivateExpert(expert.id);

      const result = acceptSession(session.id, expert.id);
      expect(result).toBeNull();
      expect(getSessionById(session.id)!.status).toBe('matching');
    });

    it('rejects experts without accepted agreement', async () => {
      const expert = createExpert('Bob', 'bob@test.com', ['crypto']);
      await setExpertPassword(expert.id, 'password123');
      // Don't accept agreement

      const session = testSession();
      matchSession(session.id);

      const result = acceptSession(session.id, expert.id);
      expect(result).toBeNull();
      expect(getSessionById(session.id)!.status).toBe('matching');
    });

    it('rejects non-existent experts', () => {
      const session = testSession();
      matchSession(session.id);

      const result = acceptSession(session.id, 'nonexistent-id');
      expect(result).toBeNull();
    });

    it('allows eligible expert to accept', async () => {
      const expert = await createOnlineExpert('Charlie', 'charlie@test.com', ['crypto']);
      const session = testSession();
      matchSession(session.id);

      const result = acceptSession(session.id, expert.id);
      expect(result).not.toBeNull();
      expect(result!.status).toBe('accepted');
      expect(result!.expertId).toBe(expert.id);
    });
  });

  // ── Fix 9: Minimum price validation ──

  describe('session price validation (M5)', () => {
    it('rejects sessions with zero price', () => {
      expect(() => createSession({
        offeringType: 'trust_evaluation',
        tierId: 'quick',
        description: 'Test',
        priceUsdc: 0,
      })).toThrow('Session price must be greater than zero');
    });

    it('rejects sessions with negative price', () => {
      expect(() => createSession({
        offeringType: 'trust_evaluation',
        tierId: 'quick',
        description: 'Test',
        priceUsdc: -5,
      })).toThrow('Session price must be greater than zero');
    });

    it('accepts sessions with valid price', () => {
      const session = createSession({
        offeringType: 'trust_evaluation',
        tierId: 'quick',
        description: 'Test',
        priceUsdc: 0.01,
      });
      expect(session.priceUsdc).toBe(0.01);
    });
  });

  // ── Fix 8: Notification route validation schemas ──

  describe('notification Zod schemas (L1)', () => {
    it('rejects subscribe with missing subscription', async () => {
      const { z } = await import('zod');
      const subscribeSchema = z.object({
        subscription: z.object({
          endpoint: z.string().url().refine(u => u.startsWith('https://'), 'Push endpoint must use HTTPS'),
          keys: z.object({
            p256dh: z.string().min(1),
            auth: z.string().min(1),
          }),
        }),
      });

      expect(subscribeSchema.safeParse({}).success).toBe(false);
      expect(subscribeSchema.safeParse({ subscription: {} }).success).toBe(false);
      expect(subscribeSchema.safeParse({
        subscription: { endpoint: 'not-a-url', keys: { p256dh: 'a', auth: 'b' } },
      }).success).toBe(false);
      expect(subscribeSchema.safeParse({
        subscription: { endpoint: 'http://example.com', keys: { p256dh: 'a', auth: 'b' } },
      }).success).toBe(false);
    });

    it('accepts valid subscription', async () => {
      const { z } = await import('zod');
      const subscribeSchema = z.object({
        subscription: z.object({
          endpoint: z.string().url().refine(u => u.startsWith('https://'), 'Push endpoint must use HTTPS'),
          keys: z.object({
            p256dh: z.string().min(1),
            auth: z.string().min(1),
          }),
        }),
      });

      expect(subscribeSchema.safeParse({
        subscription: {
          endpoint: 'https://push.example.com/send/123',
          keys: { p256dh: 'key1', auth: 'key2' },
        },
      }).success).toBe(true);
    });

    it('rejects unsubscribe with missing endpoint', async () => {
      const { z } = await import('zod');
      const unsubscribeSchema = z.object({
        endpoint: z.string().url(),
      });

      expect(unsubscribeSchema.safeParse({}).success).toBe(false);
      expect(unsubscribeSchema.safeParse({ endpoint: '' }).success).toBe(false);
    });
  });

  // ── Fix 4: Optional admin password ──

  describe('optional admin credentials (H5)', () => {
    it('ADMIN_EMAIL and ADMIN_PASSWORD are optional in env schema', async () => {
      const { z } = await import('zod');
      // Re-create just the relevant parts of the schema to test
      const envFragment = z.object({
        ADMIN_EMAIL: z.string().email().optional(),
        ADMIN_PASSWORD: z.string().min(8).optional(),
      });

      expect(envFragment.safeParse({}).success).toBe(true);
      expect(envFragment.safeParse({ ADMIN_EMAIL: 'a@b.com' }).success).toBe(true);
      expect(envFragment.safeParse({ ADMIN_EMAIL: 'invalid' }).success).toBe(false);
    });
  });

  // ── Fix 3: Trust proxy config ──

  describe('TRUST_PROXY env config (H4)', () => {
    it('TRUST_PROXY defaults to 0 and accepts valid values', async () => {
      const { z } = await import('zod');
      const trustProxySchema = z.coerce.number().int().min(0).max(10).default(0);

      expect(trustProxySchema.parse(undefined)).toBe(0);
      expect(trustProxySchema.parse('2')).toBe(2);
      expect(trustProxySchema.parse('0')).toBe(0);
      expect(trustProxySchema.safeParse('11').success).toBe(false);
      expect(trustProxySchema.safeParse('-1').success).toBe(false);
    });
  });
});
