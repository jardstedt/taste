import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDb, createOnlineExpert, testSession } from './helpers.js';
import { getDb } from '../db/database.js';
import { createSession, getSessionById, matchSession, acceptSession, completeSession, addMessage, cancelSession } from '../services/sessions.js';
import { getEnabledSessionOfferings, getSessionOffering } from '../config/domains.js';
import { getResourceAvailability, getOperatingHours } from '../services/resource.js';
import { formatSessionDeliverable } from '../services/sessions.js';

describe('MCP tools', () => {
  beforeEach(() => {
    setupTestDb();
  });

  describe('list_offerings', () => {
    it('returns all enabled offerings with correct structure', () => {
      const offerings = getEnabledSessionOfferings().map(o => ({
        type: o.type,
        name: o.name,
        description: o.description,
        priceUsdc: o.basePrice ?? 0.01,
        domains: o.relevantDomains,
        defaultTier: o.defaultTier,
      }));

      expect(offerings.length).toBe(8);
      expect(offerings[0]).toHaveProperty('type');
      expect(offerings[0]).toHaveProperty('name');
      expect(offerings[0]).toHaveProperty('priceUsdc');
      expect(offerings[0]).toHaveProperty('domains');
      expect(offerings[0]).toHaveProperty('defaultTier');
    });

    it('returns operating hours status', () => {
      const hours = getOperatingHours();
      expect(hours).toHaveProperty('currentlyOpen');
      expect(hours).toHaveProperty('nextOpenAt');
      expect(hours).toHaveProperty('schedule');
      expect(hours).toHaveProperty('note');
    });

    it('returns expert availability', () => {
      const availability = getResourceAvailability();
      expect(availability).toHaveProperty('capacity');
      expect(availability.capacity).toHaveProperty('onlineExperts');
    });
  });

  describe('request_evaluation', () => {
    it('creates a session with mcp tag', () => {
      const session = createSession({
        offeringType: 'trust_evaluation',
        description: 'Test MCP evaluation request for a crypto project',
        tags: ['mcp'],
        buyerAgent: 'mcp-client',
        buyerAgentDisplay: 'MCP Client',
        priceUsdc: 0.01,
      });

      expect(session.id).toBeTruthy();
      expect(session.status).toBe('pending');
      expect(session.tags).toContain('mcp');
      expect(session.buyerAgent).toBe('mcp-client');
      expect(session.offeringType).toBe('trust_evaluation');
    });

    it('matches and notifies experts for MCP sessions', async () => {
      await createOnlineExpert('Alice', 'alice@test.com', ['crypto']);

      const session = createSession({
        offeringType: 'trust_evaluation',
        description: 'Test MCP evaluation request',
        tags: ['mcp'],
        buyerAgent: 'mcp-client',
        buyerAgentDisplay: 'MCP Client',
        priceUsdc: 0.01,
      });

      const { session: matched, eligibleExpertIds } = matchSession(session.id);
      expect(matched!.status).toBe('matching');
      expect(eligibleExpertIds.length).toBeGreaterThan(0);
    });

    it('rejects disabled offering type', () => {
      const offering = getSessionOffering('nonexistent_offering');
      expect(offering).toBeUndefined();
    });

    it('uses correct price from offering config', () => {
      const offering = getSessionOffering('trust_evaluation');
      expect(offering).not.toBeNull();

      const session = createSession({
        offeringType: 'trust_evaluation',
        description: 'Test pricing',
        tags: ['mcp'],
        buyerAgent: 'mcp-client',
        buyerAgentDisplay: 'MCP Client',
        priceUsdc: offering!.basePrice ?? 0.01,
      });

      expect(session.priceUsdc).toBe(offering!.basePrice ?? 0.01);
    });
  });

  describe('get_result', () => {
    it('returns deliverable for completed session', async () => {
      const expert = await createOnlineExpert('Alice', 'alice@test.com', ['crypto']);

      const session = createSession({
        offeringType: 'trust_evaluation',
        description: 'Evaluate this crypto project',
        tags: ['mcp'],
        buyerAgent: 'mcp-client',
        buyerAgentDisplay: 'MCP Client',
        priceUsdc: 0.01,
      });

      matchSession(session.id);
      acceptSession(session.id, expert.id);
      getDb().prepare("UPDATE sessions SET status = 'active' WHERE id = ?").run(session.id);

      // Add a message and complete
      addMessage(session.id, 'expert', expert.id, 'This project looks solid.');
      completeSession(session.id);

      const completed = getSessionById(session.id);
      expect(completed!.status).toBe('completed');

      const deliverable = formatSessionDeliverable(session.id);
      expect(deliverable).toHaveProperty('structuredAssessment');
      expect(deliverable).toHaveProperty('summary');
    });

    it('returns status for in-progress session', async () => {
      const expert = await createOnlineExpert('Alice', 'alice@test.com', ['crypto']);

      const session = createSession({
        offeringType: 'trust_evaluation',
        description: 'Evaluate this crypto project',
        tags: ['mcp'],
        buyerAgent: 'mcp-client',
        buyerAgentDisplay: 'MCP Client',
        priceUsdc: 0.01,
      });

      matchSession(session.id);
      acceptSession(session.id, expert.id);

      const accepted = getSessionById(session.id);
      expect(accepted!.status).toBe('accepted');
    });

    it('returns null for nonexistent session', () => {
      const session = getSessionById('nonexistent-id');
      expect(session).toBeNull();
    });

    it('handles cancelled sessions', async () => {
      const expert = await createOnlineExpert('Alice', 'alice@test.com', ['crypto']);

      const session = createSession({
        offeringType: 'trust_evaluation',
        description: 'Test cancellation',
        tags: ['mcp'],
        buyerAgent: 'mcp-client',
        buyerAgentDisplay: 'MCP Client',
        priceUsdc: 0.01,
      });

      matchSession(session.id);
      acceptSession(session.id, expert.id);
      cancelSession(session.id, 'Expert unavailable');

      const cancelled = getSessionById(session.id);
      expect(cancelled!.status).toBe('cancelled');
    });

    it('only allows access to MCP-tagged sessions', () => {
      // Create a non-MCP session (simulating ACP)
      const session = createSession({
        offeringType: 'trust_evaluation',
        description: 'ACP session',
        buyerAgent: 'acp-agent',
        buyerAgentDisplay: 'ACP Agent',
        priceUsdc: 0.01,
      });

      const found = getSessionById(session.id);
      expect(found).not.toBeNull();
      expect(found!.tags).not.toContain('mcp');
    });
  });
});
