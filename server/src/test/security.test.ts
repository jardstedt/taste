import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDb, createOnlineExpert, testSession as _testSession } from './helpers.js';
import { getDb } from '../db/database.js';
import { getExpertById, deactivateExpert, incrementCompletedJobs } from '../services/experts.js';
import {
  createSession,
  getSessionById,
  matchSession,
  acceptSession,
  completeSession,
  timeoutSession,
  cancelSession,
  declineSession,
  confirmSessionPayout,
} from '../services/sessions.js';
import { requestWithdrawal } from '../services/withdrawals.js';
import {
  completeWithdrawalSchema,
  createSessionSchema,
  completeSessionSchema,
  declineSessionSchema,
  loginSchema,
} from '../middleware/validation.js';

function testSession() { return _testSession('trust_evaluation', 100); }

async function createActiveSession() {
  await createOnlineExpert('Alice', 'alice@test.com', ['crypto']);
  const session = testSession();
  matchSession(session.id);
  const matched = getSessionById(session.id)!;
  acceptSession(session.id, matched.expertId!);
  getDb().prepare("UPDATE sessions SET status = 'active' WHERE id = ?").run(session.id);
  return getSessionById(session.id)!;
}

describe('security', () => {
  beforeEach(() => {
    setupTestDb();
  });

  describe('race condition: complete vs timeout', () => {
    it('only one of complete/timeout succeeds (no double-transition)', async () => {
      const session = await createActiveSession();

      // Both attempt to transition from active — only one should succeed
      const completed = completeSession(session.id);
      const timedOut = timeoutSession(session.id);

      // Exactly one should succeed, one should return null
      expect(
        (completed !== null && timedOut === null) ||
        (completed === null && timedOut !== null),
      ).toBe(true);

      // Final status should be whichever won
      const final = getSessionById(session.id)!;
      expect(['completed', 'timeout']).toContain(final.status);
    });

    it('timeout returns null if session already completed', async () => {
      const session = await createActiveSession();
      completeSession(session.id);

      const result = timeoutSession(session.id);
      expect(result).toBeNull();

      const final = getSessionById(session.id)!;
      expect(final.status).toBe('completed');
    });

    it('complete returns null if session already timed out', async () => {
      const session = await createActiveSession();
      timeoutSession(session.id);

      const result = completeSession(session.id);
      expect(result).toBeNull();

      const final = getSessionById(session.id)!;
      expect(final.status).toBe('timeout');
    });
  });

  describe('state transition validation', () => {
    it('cannot complete a pending session', async () => {
      const session = testSession();
      const result = completeSession(session.id);
      expect(result).toBeNull();
      expect(getSessionById(session.id)!.status).toBe('pending');
    });

    it('cannot timeout a pending session', async () => {
      const session = testSession();
      const result = timeoutSession(session.id);
      expect(result).toBeNull();
      expect(getSessionById(session.id)!.status).toBe('pending');
    });

    it('cannot cancel an already completed session', async () => {
      const session = await createActiveSession();
      completeSession(session.id);
      const result = cancelSession(session.id, 'too late');
      expect(result).toBeNull();
      expect(getSessionById(session.id)!.status).toBe('completed');
    });

    it('cannot cancel an already timed-out session', async () => {
      const session = await createActiveSession();
      timeoutSession(session.id);
      const result = cancelSession(session.id, 'too late');
      expect(result).toBeNull();
      expect(getSessionById(session.id)!.status).toBe('timeout');
    });

    it('cannot decline a completed session', async () => {
      const session = await createActiveSession();
      completeSession(session.id);
      const result = declineSession(session.id, 'changed mind');
      expect(result).toBeNull();
    });

    it('cannot decline a pending session', async () => {
      const session = testSession();
      const result = declineSession(session.id, 'no thanks');
      expect(result).toBeNull();
    });
  });

  describe('payout safety', () => {
    it('confirmSessionPayout is idempotent (no double-credit)', async () => {
      const session = await createActiveSession();
      completeSession(session.id);

      const expertBefore = getExpertById(session.expertId!)!;
      const earningsBefore = expertBefore.earningsUsdc;

      // First confirm (already done by completeSession for non-ACP)
      // Try again — should return false
      const secondConfirm = confirmSessionPayout(session.id);
      expect(secondConfirm).toBe(false);

      const expertAfter = getExpertById(session.expertId!)!;
      expect(expertAfter.earningsUsdc).toBe(earningsBefore);
    });

    it('timeout gives zero payout and no earnings', async () => {
      const session = await createActiveSession();
      const expertBefore = getExpertById(session.expertId!)!;

      timeoutSession(session.id);

      const final = getSessionById(session.id)!;
      expect(final.expertPayoutUsdc).toBe(0);

      const expertAfter = getExpertById(session.expertId!)!;
      expect(expertAfter.earningsUsdc).toBe(expertBefore.earningsUsdc);
    });

    it('completeSession records payout for non-ACP sessions', async () => {
      const session = await createActiveSession();
      const completed = completeSession(session.id)!;

      expect(completed.expertPayoutUsdc).toBeGreaterThan(0);
      expect(completed.payoutConfirmedAt).toBeTruthy();

      const expert = getExpertById(session.expertId!)!;
      expect(expert.earningsUsdc).toBeGreaterThan(0);
    });

    it('completeSession does NOT credit earnings for ACP sessions', async () => {
      await createOnlineExpert('Bob', 'bob@test.com', ['crypto']);
      const session = createSession({
        offeringType: 'trust_evaluation',
        tierId: 'quick',
        description: 'ACP test',
        buyerAgent: 'agent-1',
        buyerAgentDisplay: 'TestAgent',
        priceUsdc: 100,
        acpJobId: '12345', // ACP session
      });
      matchSession(session.id);
      const matched = getSessionById(session.id)!;
      acceptSession(session.id, matched.expertId!);
      getDb().prepare("UPDATE sessions SET status = 'active' WHERE id = ?").run(session.id);

      completeSession(session.id);

      const final = getSessionById(session.id)!;
      expect(final.status).toBe('completed');
      expect(final.payoutConfirmedAt).toBeNull(); // Not confirmed yet — waiting for ACP

      const expert = getExpertById(matched.expertId!)!;
      expect(expert.earningsUsdc).toBe(0); // No earnings until ACP confirms
    });
  });

  describe('paymentReceivedAt safety', () => {
    it('payment_received_at is not set on non-ACP session completion', async () => {
      const session = await createActiveSession();
      completeSession(session.id);

      const final = getSessionById(session.id)!;
      expect(final.paymentReceivedAt).toBeNull();
      // Non-ACP sessions never go through the TRANSACTION handler
    });

    it('payment_received_at survives session completion', async () => {
      // Simulate ACP session with payment already received
      await createOnlineExpert('Charlie', 'charlie@test.com', ['crypto']);
      const session = createSession({
        offeringType: 'trust_evaluation',
        tierId: 'quick',
        description: 'ACP test',
        buyerAgent: 'agent-1',
        priceUsdc: 100,
        acpJobId: '555',
      });
      matchSession(session.id);
      const matched = getSessionById(session.id)!;
      acceptSession(session.id, matched.expertId!);
      getDb().prepare("UPDATE sessions SET status = 'active' WHERE id = ?").run(session.id);

      // Simulate payment received
      getDb().prepare(
        "UPDATE sessions SET payment_received_at = datetime('now') WHERE id = ?",
      ).run(session.id);

      // Complete session
      completeSession(session.id);

      const final = getSessionById(session.id)!;
      expect(final.status).toBe('completed');
      expect(final.paymentReceivedAt).toBeTruthy(); // Not cleared by completion
    });
  });

  describe('incrementCompletedJobs atomicity', () => {
    it('uses atomic SQL to update earnings', async () => {
      const expert = await createOnlineExpert('Alice', 'alice@test.com', ['crypto']);

      // First job: $10 payout, 5 min response
      incrementCompletedJobs(expert.id, 5, 10);
      let updated = getExpertById(expert.id)!;
      expect(updated.completedJobs).toBe(1);
      expect(updated.earningsUsdc).toBe(10);
      expect(updated.avgResponseTimeMins).toBe(5);

      // Second job: $20 payout, 15 min response → avg should be (5+15)/2 = 10
      incrementCompletedJobs(expert.id, 15, 20);
      updated = getExpertById(expert.id)!;
      expect(updated.completedJobs).toBe(2);
      expect(updated.earningsUsdc).toBe(30);
      expect(updated.avgResponseTimeMins).toBe(10);
    });

    it('handles zero earnings gracefully', async () => {
      const expert = await createOnlineExpert('Bob', 'bob@test.com', ['crypto']);
      incrementCompletedJobs(expert.id, 3, 0);
      const updated = getExpertById(expert.id)!;
      expect(updated.completedJobs).toBe(1);
      expect(updated.earningsUsdc).toBe(0);
    });
  });

  describe('input validation hardening', () => {
    it('rejects invalid transaction hashes', () => {
      expect(completeWithdrawalSchema.safeParse({ txHash: 'not-a-hash' }).success).toBe(false);
      expect(completeWithdrawalSchema.safeParse({ txHash: '0x' + 'a'.repeat(64) }).success).toBe(true);
      expect(completeWithdrawalSchema.safeParse({ txHash: '0x' + 'g'.repeat(64) }).success).toBe(false);
    });

    it('limits createSession field lengths', () => {
      // Tags should be capped at 10 items with 50 char max per tag
      const tooManyTags = createSessionSchema.safeParse({
        offeringType: 'test',
        tags: Array(11).fill('tag'),
      });
      expect(tooManyTags.success).toBe(false);

      // Long tag should fail
      const longTag = createSessionSchema.safeParse({
        offeringType: 'test',
        tags: ['a'.repeat(51)],
      });
      expect(longTag.success).toBe(false);

      // buyerAgent should be bounded
      const longAgent = createSessionSchema.safeParse({
        offeringType: 'test',
        buyerAgent: 'a'.repeat(201),
      });
      expect(longAgent.success).toBe(false);
    });

    it('limits structured data value lengths', () => {
      const tooLong = completeSessionSchema.safeParse({
        structuredData: { key: 'a'.repeat(10001) },
      });
      expect(tooLong.success).toBe(false);

      const ok = completeSessionSchema.safeParse({
        structuredData: { key: 'a'.repeat(10000) },
      });
      expect(ok.success).toBe(true);
    });

    it('decline reason is bounded', () => {
      const tooLong = declineSessionSchema.safeParse({ reason: 'a'.repeat(1001) });
      expect(tooLong.success).toBe(false);

      const ok = declineSessionSchema.safeParse({ reason: 'Valid reason' });
      expect(ok.success).toBe(true);

      const empty = declineSessionSchema.safeParse({});
      expect(empty.success).toBe(true); // reason is optional
    });

    it('login password is bounded', () => {
      const tooLong = loginSchema.safeParse({ email: 'a@b.com', password: 'a'.repeat(129) });
      expect(tooLong.success).toBe(false);

      const ok = loginSchema.safeParse({ email: 'a@b.com', password: 'valid' });
      expect(ok.success).toBe(true);
    });
  });

  describe('withdrawal safety', () => {
    it('blocks withdrawal for deactivated expert', async () => {
      const expert = await createOnlineExpert('Alice', 'alice@test.com', ['crypto']);
      // Give expert some earnings
      getDb().prepare('UPDATE experts SET earnings_usdc = 100, wallet_address = ? WHERE id = ?').run('0x' + '1'.repeat(40), expert.id);
      deactivateExpert(expert.id);

      const result = requestWithdrawal(expert.id, 50);
      expect('error' in result).toBe(true);
      expect((result as { error: string }).error).toContain('deactivated');
    });

    it('blocks withdrawal exceeding balance', async () => {
      const expert = await createOnlineExpert('Alice', 'alice@test.com', ['crypto']);
      getDb().prepare('UPDATE experts SET earnings_usdc = 10, wallet_address = ? WHERE id = ?').run('0x' + '1'.repeat(40), expert.id);

      const result = requestWithdrawal(expert.id, 50);
      expect('error' in result).toBe(true);
      expect((result as { error: string }).error).toContain('Insufficient');
    });

    it('blocks withdrawal without wallet address', async () => {
      const expert = await createOnlineExpert('Alice', 'alice@test.com', ['crypto']);
      getDb().prepare('UPDATE experts SET earnings_usdc = 100 WHERE id = ?').run(expert.id);

      const result = requestWithdrawal(expert.id, 50);
      expect('error' in result).toBe(true);
      expect((result as { error: string }).error).toContain('wallet');
    });

    it('atomic balance deduction prevents over-withdrawal', async () => {
      const expert = await createOnlineExpert('Alice', 'alice@test.com', ['crypto']);
      getDb().prepare('UPDATE experts SET earnings_usdc = 100, wallet_address = ? WHERE id = ?').run('0x' + '1'.repeat(40), expert.id);

      // First withdrawal: $60
      const r1 = requestWithdrawal(expert.id, 60);
      expect('error' in r1).toBe(false);

      // Second withdrawal: $60 — should fail (only $40 left)
      const r2 = requestWithdrawal(expert.id, 60);
      expect('error' in r2).toBe(true);
      expect((r2 as { error: string }).error).toContain('Insufficient');

      // Expert should have $40 remaining
      const final = getExpertById(expert.id)!;
      expect(final.earningsUsdc).toBe(40);
    });

    it('enforces daily withdrawal limit', async () => {
      const expert = await createOnlineExpert('Alice', 'alice@test.com', ['crypto']);
      getDb().prepare('UPDATE experts SET earnings_usdc = 10000, wallet_address = ? WHERE id = ?').run('0x' + '1'.repeat(40), expert.id);

      // Withdraw $1000 five times (total $5000 = daily limit)
      for (let i = 0; i < 5; i++) {
        const r = requestWithdrawal(expert.id, 1000);
        expect('error' in r).toBe(false);
      }

      // Sixth withdrawal should hit daily limit
      const r6 = requestWithdrawal(expert.id, 100);
      expect('error' in r6).toBe(true);
      expect((r6 as { error: string }).error).toContain('Daily');
    });
  });
});
