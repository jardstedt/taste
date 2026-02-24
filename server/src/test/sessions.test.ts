import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDb } from './helpers.js';
import { getDb } from '../db/database.js';
import { createExpert, updateExpert, setExpertPassword, acceptAgreement } from '../services/experts.js';
import {
  createSession,
  getSessionById,
  matchSession,
  acceptSession,
  addMessage,
  completeSession,
  timeoutSession,
  cancelSession,
  declineSession,
  incrementTurnCount,
} from '../services/sessions.js';

function createOnlineExpert(name: string, email: string, domains: string[]) {
  const expert = createExpert(name, email, domains as any);
  setExpertPassword(expert.id, 'password123');
  acceptAgreement(expert.id);
  updateExpert(expert.id, { availability: 'online' });
  return expert;
}

function testSession() {
  return createSession({
    offeringType: 'trust_evaluation',
    tierId: 'quick',
    description: 'Test request',
    buyerAgent: 'agent-1',
    buyerAgentDisplay: 'TestAgent',
    priceUsdc: 0.01,
  });
}

/** Helper: create session, match, accept, then force to active status */
function createActiveSession() {
  createOnlineExpert('Alice', 'alice@test.com', ['crypto']);
  const session = testSession();
  matchSession(session.id);
  const matched = getSessionById(session.id)!;
  acceptSession(session.id, matched.expertId!);
  // Force status to active (normally triggered by socket/timer)
  getDb().prepare("UPDATE sessions SET status = 'active' WHERE id = ?").run(session.id);
  return getSessionById(session.id)!;
}

describe('sessions', () => {
  beforeEach(() => {
    setupTestDb();
  });

  describe('createSession', () => {
    it('creates a session with pending status', () => {
      const session = testSession();
      expect(session.id).toBeTruthy();
      expect(session.status).toBe('pending');
      expect(session.offeringType).toBe('trust_evaluation');
      expect(session.tierId).toBe('quick');
    });
  });

  describe('matchSession', () => {
    it('matches session to an online expert with matching domain', () => {
      createOnlineExpert('Alice', 'alice@test.com', ['crypto']);
      const session = testSession();

      const matched = matchSession(session.id);
      expect(matched).toBeTruthy();
      expect(matched!.status).toBe('matching');
      expect(matched!.expertId).toBeTruthy();
    });

    it('does not match deactivated experts', () => {
      const expert = createOnlineExpert('Alice', 'alice@test.com', ['crypto']);

      const db = getDb();
      db.prepare("UPDATE experts SET deactivated_at = datetime('now'), availability = 'offline' WHERE id = ?").run(expert.id);

      const session = testSession();
      const matched = matchSession(session.id);
      expect(matched!.expertId).toBeNull();
    });
  });

  describe('acceptSession', () => {
    it('sets session to accepted when expert accepts', () => {
      createOnlineExpert('Alice', 'alice@test.com', ['crypto']);
      const session = testSession();
      matchSession(session.id);
      const matched = getSessionById(session.id)!;

      const accepted = acceptSession(session.id, matched.expertId!);
      expect(accepted).toBeTruthy();
      expect(accepted!.status).toBe('accepted');
    });
  });

  describe('completeSession', () => {
    it('sets session to completed with payout', () => {
      const session = createActiveSession();

      const completed = completeSession(session.id);
      expect(completed).toBeTruthy();
      expect(completed!.status).toBe('completed');
      expect(completed!.expertPayoutUsdc).toBeGreaterThan(0);
    });
  });

  describe('timeoutSession', () => {
    it('sets session to timeout with zero payout', () => {
      const session = createActiveSession();

      const timedOut = timeoutSession(session.id);
      expect(timedOut).toBeTruthy();
      expect(timedOut!.status).toBe('timeout');
      expect(timedOut!.expertPayoutUsdc).toBe(0);
    });
  });

  describe('cancelSession', () => {
    it('sets session to cancelled', () => {
      const session = testSession();
      const cancelled = cancelSession(session.id, 'Test cancel');
      expect(cancelled).toBeTruthy();
      expect(cancelled!.status).toBe('cancelled');
    });
  });

  describe('declineSession', () => {
    it('sets session to cancelled when expert declines', () => {
      const session = createActiveSession();

      const declined = declineSession(session.id, 'Not in my area');
      expect(declined).toBeTruthy();
      expect(declined!.status).toBe('cancelled');
      expect(declined!.expertPayoutUsdc).toBe(0);
    });

    it('returns null for already-completed session', () => {
      const session = createActiveSession();
      completeSession(session.id);

      const result = declineSession(session.id);
      expect(result).toBeNull();
    });
  });

  describe('incrementTurnCount', () => {
    it('increments only when sender alternates', () => {
      const session = createActiveSession();

      // Agent sends first message
      addMessage(session.id, 'agent', null, 'Hello', 'text');
      const r1 = incrementTurnCount(session.id, 'agent');
      expect(r1.turnCount).toBe(1);

      // Agent sends another — should NOT increment (same sender)
      addMessage(session.id, 'agent', null, 'Hello again', 'text');
      const r2 = incrementTurnCount(session.id, 'agent');
      expect(r2.turnCount).toBe(1);

      // Expert replies — should increment (sender alternated)
      addMessage(session.id, 'expert', session.expertId, 'Hi', 'text');
      const r3 = incrementTurnCount(session.id, 'expert');
      expect(r3.turnCount).toBe(2);
    });

    it('reports locked when grace period exhausted', () => {
      const session = createActiveSession();

      // quick tier: 10 max turns, GRACE_TURNS = 5, locked at 15
      const db = getDb();
      db.prepare('UPDATE sessions SET turn_count = 15 WHERE id = ?').run(session.id);

      const result = incrementTurnCount(session.id, 'expert');
      expect(result.locked).toBe(true);
    });

    it('reports limitReached but not locked within grace period', () => {
      const session = createActiveSession();

      // quick tier: 10 max turns, at turn 12 → limitReached but not locked
      const db = getDb();
      db.prepare('UPDATE sessions SET turn_count = 12 WHERE id = ?').run(session.id);

      const result = incrementTurnCount(session.id, 'expert');
      expect(result.limitReached).toBe(true);
      expect(result.locked).toBe(false);
    });
  });

  describe('addMessage', () => {
    it('adds messages to a session', () => {
      const session = testSession();
      const msg = addMessage(session.id, 'agent', null, 'Hello expert', 'text');
      expect(msg).toBeTruthy();
      expect(msg!.content).toBe('Hello expert');
      expect(msg!.senderType).toBe('agent');
    });
  });
});
