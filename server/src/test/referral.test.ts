import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDb, createOnlineExpert, testSession, createActiveSession } from './helpers.js';
import { getDb } from '../db/database.js';
import {
  generateReferenceCode,
  validateReferenceCode,
  redeemReferenceCode,
  getReferenceCodeForSession,
} from '../services/referral.js';
import {
  createSession,
  completeSession,
  addMessage,
  saveDeliverable,
  formatSessionDeliverable,
  getSessionById,
} from '../services/sessions.js';

describe('referral / follow-up reference codes', () => {
  beforeEach(() => {
    setupTestDb();
  });

  describe('generateReferenceCode', () => {
    it('generates a TASTE- prefixed code with 24 hex chars', () => {
      const session = testSession('content_quality_gate', 0.02);
      const code = generateReferenceCode(session.id, 'content_quality_gate');

      expect(code).toMatch(/^TASTE-[a-f0-9]{24}$/);
    });

    it('stores code in database with correct fields', () => {
      const session = testSession('content_quality_gate', 0.02);
      const code = generateReferenceCode(session.id, 'content_quality_gate');

      const row = getDb().prepare('SELECT * FROM reference_codes WHERE code = ?').get(code) as Record<string, unknown>;
      expect(row).toBeTruthy();
      expect(row.source_session_id).toBe(session.id);
      expect(row.offering_type).toBe('content_quality_gate');
      expect(row.discount_pct).toBe(50);
      expect(row.redeemed_session_id).toBeNull();
      expect(row.expires_at).toBeTruthy();
    });
  });

  describe('validateReferenceCode', () => {
    it('validates a fresh code', () => {
      const session = testSession('content_quality_gate', 0.02);
      const code = generateReferenceCode(session.id, 'content_quality_gate');

      const result = validateReferenceCode(code, 'content_quality_gate');
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.sourceSessionId).toBe(session.id);
        expect(result.discountPct).toBe(50);
      }
    });

    it('rejects a non-existent code', () => {
      const result = validateReferenceCode('TASTE-000000000000000000000000');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toContain('not found');
      }
    });

    it('rejects an already-redeemed code', () => {
      const session = testSession('content_quality_gate', 0.02);
      const code = generateReferenceCode(session.id, 'content_quality_gate');
      const followup = testSession('content_quality_gate', 0.01);
      redeemReferenceCode(code, followup.id);

      const result = validateReferenceCode(code);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toContain('already redeemed');
      }
    });

    it('rejects an expired code', () => {
      const session = testSession('content_quality_gate', 0.02);
      const code = generateReferenceCode(session.id, 'content_quality_gate');

      // Manually expire the code
      getDb().prepare(
        "UPDATE reference_codes SET expires_at = datetime('now', '-1 day') WHERE code = ?",
      ).run(code);

      const result = validateReferenceCode(code);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toContain('expired');
      }
    });

    it('rejects a code for the wrong offering type', () => {
      const session = testSession('content_quality_gate', 0.02);
      const code = generateReferenceCode(session.id, 'content_quality_gate');

      const result = validateReferenceCode(code, 'trust_evaluation');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toContain('content_quality_gate');
      }
    });

    it('accepts code without offering type check', () => {
      const session = testSession('content_quality_gate', 0.02);
      const code = generateReferenceCode(session.id, 'content_quality_gate');

      const result = validateReferenceCode(code);
      expect(result.valid).toBe(true);
    });
  });

  describe('redeemReferenceCode', () => {
    it('marks code as redeemed', () => {
      const session = testSession('content_quality_gate', 0.02);
      const code = generateReferenceCode(session.id, 'content_quality_gate');
      const followup = testSession('content_quality_gate', 0.01);

      redeemReferenceCode(code, followup.id);

      const row = getDb().prepare('SELECT redeemed_session_id FROM reference_codes WHERE code = ?').get(code) as Record<string, unknown>;
      expect(row.redeemed_session_id).toBe(followup.id);
    });

    it('is idempotent — second redeem is a no-op', () => {
      const session = testSession('content_quality_gate', 0.02);
      const code = generateReferenceCode(session.id, 'content_quality_gate');
      const followup1 = testSession('content_quality_gate', 0.01);
      const followup2 = testSession('content_quality_gate', 0.01);

      redeemReferenceCode(code, followup1.id);
      redeemReferenceCode(code, followup2.id); // Should not overwrite

      const row = getDb().prepare('SELECT redeemed_session_id FROM reference_codes WHERE code = ?').get(code) as Record<string, unknown>;
      expect(row.redeemed_session_id).toBe(followup1.id);
    });
  });

  describe('getReferenceCodeForSession', () => {
    it('returns code for a session that generated one', () => {
      const session = testSession('content_quality_gate', 0.02);
      const code = generateReferenceCode(session.id, 'content_quality_gate');

      const found = getReferenceCodeForSession(session.id);
      expect(found).toBe(code);
    });

    it('returns null for session without a code', () => {
      const session = testSession('trust_evaluation');
      expect(getReferenceCodeForSession(session.id)).toBeNull();
    });
  });

  describe('completeSession integration', () => {
    it('generates code when completing a content_quality_gate session', async () => {
      const session = await createActiveSession('content_quality_gate');
      addMessage(session.id, 'expert', session.expertId, 'Content reviewed.');

      completeSession(session.id);

      const code = getReferenceCodeForSession(session.id);
      expect(code).toBeTruthy();
      expect(code).toMatch(/^TASTE-[a-f0-9]{24}$/);
    });

    it('does NOT generate code for non-content_quality_gate offerings', async () => {
      const session = await createActiveSession('trust_evaluation');
      addMessage(session.id, 'expert', session.expertId, 'Trust reviewed.');

      completeSession(session.id);

      const code = getReferenceCodeForSession(session.id);
      expect(code).toBeNull();
    });

    it('does NOT generate code for follow-up sessions (no chaining)', async () => {
      // Create an original session
      const original = await createActiveSession('content_quality_gate');
      addMessage(original.id, 'expert', original.expertId, 'Content reviewed.');
      completeSession(original.id);

      // Create a follow-up session
      const expert = (await import('../services/experts.js')).getExpertById(original.expertId!);
      const followup = createSession({
        offeringType: 'content_quality_gate',
        tierId: 'quick',
        description: 'Follow-up review',
        buyerAgent: 'agent-1',
        priceUsdc: 0.01,
        followupOf: original.id,
      });

      // Accept and start the follow-up
      const { matchSession, acceptSession } = await import('../services/sessions.js');
      matchSession(followup.id);
      acceptSession(followup.id, original.expertId!);
      getDb().prepare("UPDATE sessions SET status = 'active' WHERE id = ?").run(followup.id);
      addMessage(followup.id, 'expert', original.expertId, 'Revised content looks better.');
      completeSession(followup.id);

      const code = getReferenceCodeForSession(followup.id);
      expect(code).toBeNull();
    });
  });

  describe('basePrice / discount', () => {
    it('content_quality_gate sessions default to $0.02', () => {
      const session = createSession({
        offeringType: 'content_quality_gate',
        tierId: 'quick',
        description: 'Test',
        buyerAgent: 'agent-1',
      });
      expect(session.priceUsdc).toBe(0.02);
    });

    it('trust_evaluation sessions still default to tier price ($0.01)', () => {
      const session = createSession({
        offeringType: 'trust_evaluation',
        tierId: 'quick',
        description: 'Test',
        buyerAgent: 'agent-1',
      });
      expect(session.priceUsdc).toBe(0.01);
    });

    it('explicit priceUsdc overrides basePrice', () => {
      const session = createSession({
        offeringType: 'content_quality_gate',
        tierId: 'quick',
        description: 'Test',
        buyerAgent: 'agent-1',
        priceUsdc: 0.05,
      });
      expect(session.priceUsdc).toBe(0.05);
    });

    it('follow-up session at 50% discount = $0.01', () => {
      const original = testSession('content_quality_gate', 0.02);
      const followup = createSession({
        offeringType: 'content_quality_gate',
        description: 'Follow-up',
        buyerAgent: 'agent-1',
        priceUsdc: 0.01, // 50% of 0.02
        followupOf: original.id,
      });
      expect(followup.priceUsdc).toBe(0.01);
      expect(followup.followupOf).toBe(original.id);
    });
  });

  describe('formatSessionDeliverable integration', () => {
    it('includes followUpCode and followUpInstructions for content_quality_gate', async () => {
      const session = await createActiveSession('content_quality_gate');
      addMessage(session.id, 'expert', session.expertId, 'Content looks good.');
      saveDeliverable(session.id, 'content_quality_gate', {
        verdict: 'safe',
        culturalSensitivityScore: 8,
        brandSafetyScore: 9,
        summary: 'All clear',
      });
      completeSession(session.id);

      const deliverable = formatSessionDeliverable(session.id);

      expect(deliverable.followUpCode).toBeTruthy();
      expect(deliverable.followUpCode).toMatch(/^TASTE-[a-f0-9]{24}$/);
      expect(deliverable.followUpInstructions).toContain('50% discount');
      expect(deliverable.followUpInstructions).toContain('7 days');
      expect(deliverable.followUpInstructions).toContain(deliverable.followUpCode as string);
    });

    it('does NOT include followUpCode for non-content_quality_gate offerings', async () => {
      const session = await createActiveSession('trust_evaluation');
      addMessage(session.id, 'expert', session.expertId, 'Trust review done.');
      completeSession(session.id);

      const deliverable = formatSessionDeliverable(session.id);

      expect(deliverable.followUpCode).toBeUndefined();
      expect(deliverable.followUpInstructions).toBeUndefined();
    });

    it('includes previousAssessment for follow-up sessions', async () => {
      // Complete original session with deliverable
      const original = await createActiveSession('content_quality_gate');
      addMessage(original.id, 'expert', original.expertId, 'Needs changes.');
      saveDeliverable(original.id, 'content_quality_gate', {
        verdict: 'needs_changes',
        culturalSensitivityScore: 4,
        brandSafetyScore: 6,
        summary: 'Several issues found',
        flaggedIssues: 'Issue A\nIssue B',
      });
      completeSession(original.id);

      // Create follow-up session
      const followup = createSession({
        offeringType: 'content_quality_gate',
        tierId: 'quick',
        description: 'Revised content',
        buyerAgent: 'agent-1',
        priceUsdc: 0.01,
        followupOf: original.id,
      });
      // Make it active
      const { matchSession, acceptSession } = await import('../services/sessions.js');
      matchSession(followup.id);
      acceptSession(followup.id, original.expertId!);
      getDb().prepare("UPDATE sessions SET status = 'active' WHERE id = ?").run(followup.id);
      addMessage(followup.id, 'expert', original.expertId, 'Looks much better now.');
      saveDeliverable(followup.id, 'content_quality_gate', {
        verdict: 'safe',
        culturalSensitivityScore: 8,
        brandSafetyScore: 9,
        summary: 'Issues resolved',
      });

      const deliverable = formatSessionDeliverable(followup.id);

      // Should have previous assessment
      expect(deliverable.previousAssessment).toBeTruthy();
      const prev = deliverable.previousAssessment as Record<string, unknown>;
      expect(prev.verdict).toBe('needs_changes');
      expect(prev.flaggedIssues).toBe('Issue A\nIssue B');

      // Should NOT have follow-up code (no chaining)
      expect(deliverable.followUpCode).toBeUndefined();
      expect(deliverable.followUpInstructions).toBeUndefined();
    });
  });
});
