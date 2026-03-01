import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDb, createOnlineExpert, testSession, createActiveSession } from './helpers.js';
import { getDb } from '../db/database.js';
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

describe('sessions', () => {
  beforeEach(() => {
    setupTestDb();
  });

  describe('createSession', () => {
    it('creates a session with pending status', async () => {
      const session = testSession();
      expect(session.id).toBeTruthy();
      expect(session.status).toBe('pending');
      expect(session.offeringType).toBe('trust_evaluation');
      expect(session.tierId).toBe('quick');
    });
  });

  describe('matchSession', () => {
    it('broadcasts session to all eligible experts', async () => {
      await createOnlineExpert('Alice', 'alice@test.com', ['crypto']);
      const session = testSession();

      const { session: matched, eligibleExpertIds } = matchSession(session.id);
      expect(matched).toBeTruthy();
      expect(matched!.status).toBe('matching');
      expect(matched!.expertId).toBeNull(); // broadcast — not assigned to anyone
      expect(eligibleExpertIds.length).toBeGreaterThan(0);
    });

    it('does not match deactivated experts', async () => {
      const expert = await createOnlineExpert('Alice', 'alice@test.com', ['crypto']);

      const db = getDb();
      db.prepare("UPDATE experts SET deactivated_at = datetime('now'), availability = 'offline' WHERE id = ?").run(expert.id);

      const session = testSession();
      const { eligibleExpertIds } = matchSession(session.id);
      expect(eligibleExpertIds.length).toBe(0);
    });
  });

  describe('acceptSession', () => {
    it('sets session to accepted when expert accepts', async () => {
      const expert = await createOnlineExpert('Alice', 'alice@test.com', ['crypto']);
      const session = testSession();
      matchSession(session.id);

      const accepted = acceptSession(session.id, expert.id);
      expect(accepted).toBeTruthy();
      expect(accepted!.status).toBe('accepted');
      expect(accepted!.expertId).toBe(expert.id);
    });
  });

  describe('completeSession', () => {
    it('sets session to completed with payout', async () => {
      const session = await createActiveSession();

      const completed = completeSession(session.id);
      expect(completed).toBeTruthy();
      expect(completed!.status).toBe('completed');
      expect(completed!.expertPayoutUsdc).toBeGreaterThan(0);
    });

    it('completes from accepted status (form-first flow)', async () => {
      const expert = await createOnlineExpert('Bob', 'bob@test.com', ['crypto']);
      const session = testSession();
      matchSession(session.id);
      acceptSession(session.id, expert.id);

      // Session is in 'accepted' — expert submits form without sending a message
      expect(getSessionById(session.id)!.status).toBe('accepted');
      const completed = completeSession(session.id);
      expect(completed).toBeTruthy();
      expect(completed!.status).toBe('completed');
      expect(completed!.expertPayoutUsdc).toBeGreaterThan(0);
    });

    it('rejects completion from pending status', () => {
      const session = testSession();
      const result = completeSession(session.id);
      expect(result).toBeNull();
    });
  });

  describe('timeoutSession', () => {
    it('sets session to timeout with zero payout', async () => {
      const session = await createActiveSession();

      const timedOut = timeoutSession(session.id);
      expect(timedOut).toBeTruthy();
      expect(timedOut!.status).toBe('timeout');
      expect(timedOut!.expertPayoutUsdc).toBe(0);
    });
  });

  describe('cancelSession', () => {
    it('sets session to cancelled', async () => {
      const session = testSession();
      const cancelled = cancelSession(session.id, 'Test cancel');
      expect(cancelled).toBeTruthy();
      expect(cancelled!.status).toBe('cancelled');
    });
  });

  describe('declineSession', () => {
    it('sets session to cancelled when expert declines', async () => {
      const session = await createActiveSession();

      const declined = declineSession(session.id, 'Not in my area');
      expect(declined).toBeTruthy();
      expect(declined!.status).toBe('cancelled');
      expect(declined!.expertPayoutUsdc).toBe(0);
    });

    it('returns null for already-completed session', async () => {
      const session = await createActiveSession();
      completeSession(session.id);

      const result = declineSession(session.id);
      expect(result).toBeNull();
    });
  });

  describe('incrementTurnCount', () => {
    it('increments only when sender alternates', async () => {
      const session = await createActiveSession();

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

    it('reports locked when grace period exhausted', async () => {
      const session = await createActiveSession();

      // quick tier: 10 max turns, GRACE_TURNS = 5, locked at 15
      const db = getDb();
      db.prepare('UPDATE sessions SET turn_count = 15 WHERE id = ?').run(session.id);

      const result = incrementTurnCount(session.id, 'expert');
      expect(result.locked).toBe(true);
    });

    it('reports limitReached but not locked within grace period', async () => {
      const session = await createActiveSession();

      // quick tier: 10 max turns, at turn 12 → limitReached but not locked
      const db = getDb();
      db.prepare('UPDATE sessions SET turn_count = 12 WHERE id = ?').run(session.id);

      const result = incrementTurnCount(session.id, 'expert');
      expect(result.limitReached).toBe(true);
      expect(result.locked).toBe(false);
    });
  });

  describe('addMessage', () => {
    it('adds messages to a session', async () => {
      const session = testSession();
      const msg = addMessage(session.id, 'agent', null, 'Hello expert', 'text');
      expect(msg).toBeTruthy();
      expect(msg!.content).toBe('Hello expert');
      expect(msg!.senderType).toBe('agent');
    });
  });

  describe('paymentReceivedAt', () => {
    it('is null on session creation', async () => {
      const session = testSession();
      expect(session.paymentReceivedAt).toBeNull();
    });

    it('is null for ACP sessions before payment', async () => {
      const session = createSession({
        offeringType: 'trust_evaluation',
        tierId: 'quick',
        description: 'ACP test',
        buyerAgent: 'agent-1',
        priceUsdc: 10,
        acpJobId: '999',
      });
      expect(session.acpJobId).toBe('999');
      expect(session.paymentReceivedAt).toBeNull();
    });

    it('is set when payment is received (simulating ACP TRANSACTION handler)', async () => {
      const session = createSession({
        offeringType: 'trust_evaluation',
        tierId: 'quick',
        description: 'ACP test',
        buyerAgent: 'agent-1',
        priceUsdc: 10,
        acpJobId: '888',
      });

      // Simulate what the ACP handler does
      const db = getDb();
      db.prepare(
        "UPDATE sessions SET payment_received_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND payment_received_at IS NULL",
      ).run(session.id);

      const updated = getSessionById(session.id)!;
      expect(updated.paymentReceivedAt).toBeTruthy();
    });

    it('is idempotent — second update does not overwrite first timestamp', async () => {
      const session = createSession({
        offeringType: 'trust_evaluation',
        tierId: 'quick',
        description: 'ACP test',
        buyerAgent: 'agent-1',
        priceUsdc: 10,
        acpJobId: '777',
      });

      const db = getDb();

      // First payment received
      db.prepare(
        "UPDATE sessions SET payment_received_at = '2026-01-01 00:00:00', updated_at = datetime('now') WHERE id = ? AND payment_received_at IS NULL",
      ).run(session.id);

      // Second attempt (e.g. from polling + websocket race)
      const result = db.prepare(
        "UPDATE sessions SET payment_received_at = '2026-02-01 00:00:00', updated_at = datetime('now') WHERE id = ? AND payment_received_at IS NULL",
      ).run(session.id);

      expect(result.changes).toBe(0); // No rows changed — already set

      const final = getSessionById(session.id)!;
      expect(final.paymentReceivedAt).toBe('2026-01-01 00:00:00'); // Original preserved
    });

    it('is included in session response for non-ACP sessions (null)', async () => {
      const session = testSession();
      const fetched = getSessionById(session.id)!;
      expect('paymentReceivedAt' in fetched).toBe(true);
      expect(fetched.paymentReceivedAt).toBeNull();
    });
  });
});
