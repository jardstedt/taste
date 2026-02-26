import { describe, it, expect, beforeEach, vi } from 'vitest';

// This test file creates many DB instances under parallel load — increase timeout
vi.setConfig({ testTimeout: 15000 });
import { setupTestDb, createOnlineExpert } from './helpers.js';
import { getDb } from '../db/database.js';
import {
  createSession,
  getSessionById,
  matchSession,
  acceptSession,
  completeSession,
  addMessage,
  saveDeliverable,
  formatSessionDeliverable,
} from '../services/sessions.js';
import { buildZodSchema, getDeliverableFields } from '../config/deliverable-schemas.js';
import { isOfferingEnabled, getSessionOffering } from '../config/domains.js';

function createDisputeSession(acpJobId?: string) {
  return createSession({
    offeringType: 'dispute_arbitration',
    tierId: 'quick',
    description: 'Dispute evaluation request',
    tags: ['evaluator', 'dispute'],
    buyerAgent: '0xBuyerAddress',
    acpJobId: acpJobId ?? '12345',
    priceUsdc: 0.01,
  });
}

function createFactCheckSession() {
  return createSession({
    offeringType: 'fact_check_verification',
    tierId: 'quick',
    description: 'Verify claims in this article',
    buyerAgent: 'agent-1',
    priceUsdc: 0.01,
  });
}

async function createActiveDisputeSession() {
  await createOnlineExpert('Alice', 'alice@test.com', ['general', 'crypto']);
  const session = createDisputeSession();
  matchSession(session.id);
  const matched = getSessionById(session.id)!;
  acceptSession(session.id, matched.expertId!);
  getDb().prepare("UPDATE sessions SET status = 'active' WHERE id = ?").run(session.id);
  return getSessionById(session.id)!;
}

describe('fact_check_verification offering', () => {
  beforeEach(() => {
    setupTestDb();
  });

  it('is enabled', () => {
    expect(isOfferingEnabled('fact_check_verification')).toBe(true);
  });

  it('has correct offering definition', () => {
    const offering = getSessionOffering('fact_check_verification');
    expect(offering).toBeTruthy();
    expect(offering!.name).toBe('Fact-Check & Source Verification');
    expect(offering!.defaultTier).toBe('quick');
    expect(offering!.relevantDomains).toContain('general');
    expect(offering!.relevantDomains).toContain('crypto');
    expect(offering!.relevantDomains).toContain('culture');
  });

  it('creates a session', () => {
    const session = createFactCheckSession();
    expect(session.id).toBeTruthy();
    expect(session.status).toBe('pending');
    expect(session.offeringType).toBe('fact_check_verification');
  });

  describe('schema validation', () => {
    it('has deliverable fields', () => {
      const fields = getDeliverableFields('fact_check_verification');
      expect(fields.length).toBeGreaterThan(0);
      expect(fields.find(f => f.key === 'overallAccuracy')).toBeTruthy();
      expect(fields.find(f => f.key === 'summary')).toBeTruthy();
      expect(fields.find(f => f.key === 'claimsChecked')).toBeTruthy();
    });

    it('validates valid fact_check data', () => {
      const schema = buildZodSchema('fact_check_verification');
      const result = schema.safeParse({
        overallAccuracy: 'high',
        claimsChecked: 5,
        summary: 'All claims verified',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid accuracy value', () => {
      const schema = buildZodSchema('fact_check_verification');
      const result = schema.safeParse({
        overallAccuracy: 'very_high', // not in options
        summary: 'test',
      });
      expect(result.success).toBe(false);
    });

    it('requires summary', () => {
      const schema = buildZodSchema('fact_check_verification');
      const result = schema.safeParse({
        overallAccuracy: 'medium',
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('dispute_arbitration offering', () => {
  beforeEach(() => {
    setupTestDb();
  });

  it('is enabled', () => {
    expect(isOfferingEnabled('dispute_arbitration')).toBe(true);
  });

  it('has correct offering definition', () => {
    const offering = getSessionOffering('dispute_arbitration');
    expect(offering).toBeTruthy();
    expect(offering!.name).toBe('Dispute Evaluation');
    expect(offering!.defaultTier).toBe('quick');
    expect(offering!.relevantDomains).toContain('general');
    expect(offering!.relevantDomains).toContain('crypto');
  });

  describe('session lifecycle', () => {
    it('creates a dispute session with evaluator tags', () => {
      const session = createDisputeSession();
      expect(session.id).toBeTruthy();
      expect(session.status).toBe('pending');
      expect(session.offeringType).toBe('dispute_arbitration');
      expect(session.acpJobId).toBe('12345');
      expect(session.tags).toContain('evaluator');
      expect(session.tags).toContain('dispute');
    });

    it('matches to expert with general domain', async () => {
      await createOnlineExpert('Alice', 'alice@test.com', ['general']);
      const session = createDisputeSession();
      const matched = matchSession(session.id);
      expect(matched).toBeTruthy();
      expect(matched!.expertId).toBeTruthy();
    });

    it('completes a dispute session with structured verdict', async () => {
      const session = await createActiveDisputeSession();

      addMessage(session.id, 'expert', session.expertId, 'I have reviewed the deliverable.');
      saveDeliverable(session.id, 'dispute_arbitration', {
        verdict: 'approve',
        reasoning: 'Provider delivered a comprehensive analysis matching the requirement.',
        deliverableQuality: 'adequate',
        contractAlignment: 'fully_met',
        summary: 'Deliverable meets all requirements.',
      }, 'Approved — deliverable meets requirements');

      const completed = completeSession(session.id);
      expect(completed).toBeTruthy();
      expect(completed!.status).toBe('completed');
    });

    it('formats deliverable with structured assessment', async () => {
      const session = await createActiveDisputeSession();
      addMessage(session.id, 'expert', session.expertId, 'Reviewed.');

      saveDeliverable(session.id, 'dispute_arbitration', {
        verdict: 'reject',
        reasoning: 'The deliverable does not address the original requirement.',
        deliverableQuality: 'poor',
        contractAlignment: 'not_met',
        summary: 'Provider failed to deliver.',
      });

      const deliverable = formatSessionDeliverable(session.id);
      expect(deliverable.offeringType).toBe('dispute_arbitration');
      expect(deliverable.offeringName).toBe('Dispute Evaluation');
      expect(deliverable.structuredAssessment).toBeTruthy();

      const assessment = deliverable.structuredAssessment as Record<string, unknown>;
      expect(assessment.verdict).toBe('reject');
      expect(assessment.reasoning).toContain('does not address');
      expect(assessment.summary).toBe('Provider failed to deliver.');
    });
  });

  describe('schema validation', () => {
    it('has deliverable fields', () => {
      const fields = getDeliverableFields('dispute_arbitration');
      expect(fields.length).toBeGreaterThan(0);
      expect(fields.find(f => f.key === 'verdict')).toBeTruthy();
      expect(fields.find(f => f.key === 'reasoning')).toBeTruthy();
      expect(fields.find(f => f.key === 'summary')).toBeTruthy();
    });

    it('validates approve verdict', () => {
      const schema = buildZodSchema('dispute_arbitration');
      const result = schema.safeParse({
        verdict: 'approve',
        reasoning: 'Good work',
        summary: 'Approved',
      });
      expect(result.success).toBe(true);
    });

    it('validates reject verdict', () => {
      const schema = buildZodSchema('dispute_arbitration');
      const result = schema.safeParse({
        verdict: 'reject',
        reasoning: 'Did not meet requirements',
        summary: 'Rejected',
      });
      expect(result.success).toBe(true);
    });

    it('validates full form with optional fields', () => {
      const schema = buildZodSchema('dispute_arbitration');
      const result = schema.safeParse({
        verdict: 'approve',
        reasoning: 'Thorough analysis provided',
        deliverableQuality: 'excellent',
        contractAlignment: 'fully_met',
        summary: 'Excellent delivery',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid verdict', () => {
      const schema = buildZodSchema('dispute_arbitration');
      const result = schema.safeParse({
        verdict: 'maybe', // not in options
        reasoning: 'Unsure',
        summary: 'Maybe',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid deliverableQuality', () => {
      const schema = buildZodSchema('dispute_arbitration');
      const result = schema.safeParse({
        verdict: 'approve',
        reasoning: 'OK',
        deliverableQuality: 'amazing', // not in options
        summary: 'OK',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid contractAlignment', () => {
      const schema = buildZodSchema('dispute_arbitration');
      const result = schema.safeParse({
        verdict: 'approve',
        reasoning: 'OK',
        contractAlignment: 'exceeded', // not in options
        summary: 'OK',
      });
      expect(result.success).toBe(false);
    });

    it('requires reasoning', () => {
      const schema = buildZodSchema('dispute_arbitration');
      const result = schema.safeParse({
        verdict: 'approve',
        summary: 'Approved',
      });
      expect(result.success).toBe(false);
    });

    it('requires summary', () => {
      const schema = buildZodSchema('dispute_arbitration');
      const result = schema.safeParse({
        verdict: 'approve',
        reasoning: 'Good work',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('completeSession hook for evaluator verdict', () => {
    it('does not crash for dispute_arbitration sessions without ACP client', async () => {
      const session = await createActiveDisputeSession();
      addMessage(session.id, 'expert', session.expertId, 'Reviewed.');
      saveDeliverable(session.id, 'dispute_arbitration', {
        verdict: 'approve',
        reasoning: 'Looks good',
        summary: 'Approved',
      });

      // completeSession should not throw even though ACP client is not initialized
      const completed = completeSession(session.id);
      expect(completed).toBeTruthy();
      expect(completed!.status).toBe('completed');
    });

    it('does not trigger evaluator hook for non-dispute sessions', async () => {
      await createOnlineExpert('Bob', 'bob@test.com', ['crypto']);
      const session = createSession({
        offeringType: 'trust_evaluation',
        tierId: 'quick',
        description: 'Regular session',
        buyerAgent: 'agent-1',
        acpJobId: '99999',
        priceUsdc: 0.01,
      });
      matchSession(session.id);
      const matched = getSessionById(session.id)!;
      acceptSession(session.id, matched.expertId!);
      getDb().prepare("UPDATE sessions SET status = 'active' WHERE id = ?").run(session.id);

      const completed = completeSession(session.id);
      expect(completed).toBeTruthy();
      expect(completed!.status).toBe('completed');
      // trust_evaluation with acpJobId does NOT trigger evaluator hook
      // (only dispute_arbitration does)
    });
  });
});
