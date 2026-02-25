import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDb } from './helpers.js';
import { getDb } from '../db/database.js';
import { createExpert, updateExpert, setExpertPassword, acceptAgreement } from '../services/experts.js';
import { getResourceAvailability } from '../services/resource.js';
import { createSession, matchSession, getSessionById, acceptSession } from '../services/sessions.js';

async function createOnlineExpert(name: string, email: string, domains: string[]) {
  const expert = createExpert(name, email, domains as any);
  await setExpertPassword(expert.id, 'password123');
  acceptAgreement(expert.id);
  updateExpert(expert.id, { availability: 'online', consentToPublicProfile: true });
  return expert;
}

describe('resource availability', () => {
  beforeEach(() => {
    setupTestDb();
  });

  describe('status determination', () => {
    it('returns offline when no experts are online', async () => {
      const result = getResourceAvailability();
      expect(result.status).toBe('offline');
      expect(result.capacity.onlineExperts).toBe(0);
    });

    it('returns limited when exactly 1 expert is online', async () => {
      await createOnlineExpert('Alice', 'alice@test.com', ['crypto']);

      const result = getResourceAvailability();
      expect(result.status).toBe('limited');
      expect(result.capacity.onlineExperts).toBe(1);
    });

    it('returns available when 2+ experts are online', async () => {
      await createOnlineExpert('Alice', 'alice@test.com', ['crypto']);
      await createOnlineExpert('Bob', 'bob@test.com', ['crypto']);

      const result = getResourceAvailability();
      expect(result.status).toBe('available');
      expect(result.capacity.onlineExperts).toBe(2);
    });
  });

  describe('capacity counts', () => {
    it('counts busy experts separately', async () => {
      const expert = await createOnlineExpert('Alice', 'alice@test.com', ['crypto']);
      updateExpert(expert.id, { availability: 'busy' } as any);

      const result = getResourceAvailability();
      expect(result.capacity.busyExperts).toBe(1);
      expect(result.capacity.onlineExperts).toBe(0);
    });

    it('counts active sessions', async () => {
      await createOnlineExpert('Alice', 'alice@test.com', ['crypto']);
      const session = createSession({
        offeringType: 'trust_evaluation',
        tierId: 'quick',
        description: 'Test',
        buyerAgent: 'agent-1',
        buyerAgentDisplay: 'TestAgent',
        priceUsdc: 0.01,
      });
      matchSession(session.id);
      const matched = getSessionById(session.id)!;
      acceptSession(session.id, matched.expertId!);
      getDb().prepare("UPDATE sessions SET status = 'active' WHERE id = ?").run(session.id);

      const result = getResourceAvailability();
      expect(result.capacity.activeSessions).toBe(1);
    });

    it('excludes deactivated experts from total', async () => {
      const expert = await createOnlineExpert('Alice', 'alice@test.com', ['crypto']);
      getDb().prepare("UPDATE experts SET deactivated_at = datetime('now') WHERE id = ?").run(expert.id);

      const result = getResourceAvailability();
      expect(result.capacity.totalExperts).toBe(0);
    });
  });

  describe('privacy: consentToPublicProfile filter', () => {
    it('excludes experts who did not consent to public profile', async () => {
      const expert = createExpert('Alice', 'alice@test.com', ['crypto'] as any);
      await setExpertPassword(expert.id, 'password123');
      acceptAgreement(expert.id);
      updateExpert(expert.id, { availability: 'online', consentToPublicProfile: false });

      const result = getResourceAvailability();
      expect(result.capacity.onlineExperts).toBe(0);
      expect(result.capacity.totalExperts).toBe(0);
      expect(result.status).toBe('offline');
    });

    it('includes experts who consented to public profile', async () => {
      await createOnlineExpert('Alice', 'alice@test.com', ['crypto']);

      const result = getResourceAvailability();
      expect(result.capacity.onlineExperts).toBe(1);
      expect(result.capacity.totalExperts).toBe(1);
    });

    it('does not leak non-consenting expert availability in domain breakdown', async () => {
      // Private expert — online but no public consent
      const privateExpert = createExpert('Private', 'private@test.com', ['crypto'] as any);
      await setExpertPassword(privateExpert.id, 'password123');
      acceptAgreement(privateExpert.id);
      updateExpert(privateExpert.id, { availability: 'online', consentToPublicProfile: false });

      const result = getResourceAvailability();
      const cryptoDomain = result.domains.find(d => d.domain === 'crypto');
      expect(cryptoDomain).toBeUndefined(); // No online experts in crypto (private one excluded)
    });
  });

  describe('domain breakdown', () => {
    it('only includes domains with online experts', async () => {
      await createOnlineExpert('Alice', 'alice@test.com', ['crypto', 'community']);

      const result = getResourceAvailability();
      const domainNames = result.domains.map(d => d.domain);
      expect(domainNames).toContain('crypto');
      expect(domainNames).toContain('community');
      expect(domainNames).not.toContain('music');
    });

    it('reports correct expert count per domain', async () => {
      await createOnlineExpert('Alice', 'alice@test.com', ['crypto', 'community']);
      await createOnlineExpert('Bob', 'bob@test.com', ['crypto']);

      const result = getResourceAvailability();
      const crypto = result.domains.find(d => d.domain === 'crypto')!;
      const community = result.domains.find(d => d.domain === 'community')!;
      expect(crypto.onlineExperts).toBe(2);
      expect(community.onlineExperts).toBe(1);
    });
  });

  describe('offerings', () => {
    it('returns enabled offerings with tier info', async () => {
      const result = getResourceAvailability();
      expect(result.offerings.length).toBeGreaterThan(0);

      const trust = result.offerings.find(o => o.type === 'trust_evaluation');
      expect(trust).toBeTruthy();
      expect(trust!.name).toBe('Trust Evaluation');
      expect(trust!.priceRange[0]).toBeGreaterThan(0);
      expect(trust!.maxTurns).toBeGreaterThan(0);
    });

    it('does not include disabled offerings', async () => {
      const result = getResourceAvailability();
      const cultural = result.offerings.find(o => o.type === 'cultural_context');
      expect(cultural).toBeUndefined();
    });
  });

  describe('response shape', () => {
    it('includes all required top-level fields', async () => {
      const result = getResourceAvailability();
      expect(result.service).toBe('Taste: Human Expert Consultation');
      expect(result.timestamp).toBeTruthy();
      expect(typeof result.estimatedResponseMins).toBe('number');
      expect(result.capacity).toBeTruthy();
      expect(Array.isArray(result.domains)).toBe(true);
      expect(Array.isArray(result.offerings)).toBe(true);
    });

    it('does not leak expert IDs, emails, or wallet addresses', async () => {
      await createOnlineExpert('Alice', 'alice@test.com', ['crypto']);

      const result = getResourceAvailability();
      const json = JSON.stringify(result);

      // Should not contain any personal identifiers
      expect(json).not.toContain('alice@test.com');
      expect(json).not.toContain('password');
      expect(json).not.toContain('wallet');
      expect(json).not.toContain('emailEncrypted');
      // Expert IDs are UUIDs — check there's no uuid-like pattern outside of what's expected
      expect(json).not.toMatch(/"id"\s*:\s*"[a-f0-9-]{20,}"/);
    });
  });
});
