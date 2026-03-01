import { describe, it, expect, beforeEach, vi } from 'vitest';
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
} from '../services/sessions.js';

// Mock the ACP module — dynamic import('./acp.js') in completeSession resolves to this
const mockDeliverSessionToAcp = vi.fn().mockResolvedValue(true);
const mockSubmitEvaluatorVerdict = vi.fn().mockResolvedValue(undefined);

vi.mock('../services/acp.js', () => ({
  deliverSessionToAcp: mockDeliverSessionToAcp,
  submitEvaluatorVerdict: mockSubmitEvaluatorVerdict,
}));

/** Create an active ACP session of any offering type */
async function createActiveAcpSession(offeringType: string, acpJobId = '12345') {
  const domains = offeringType === 'dispute_arbitration' ? ['general', 'crypto'] : ['crypto'];
  const expert = await createOnlineExpert('Alice', 'alice@test.com', domains);
  const session = createSession({
    offeringType,
    tierId: 'quick',
    description: 'Test ACP session',
    buyerAgent: '0xAgent',
    acpJobId,
    priceUsdc: 0.01,
  });
  matchSession(session.id);
  acceptSession(session.id, expert.id);
  getDb().prepare("UPDATE sessions SET status = 'active' WHERE id = ?").run(session.id);
  return getSessionById(session.id)!;
}

/** Create an active local session (no ACP) */
async function createActiveLocalSession(offeringType = 'trust_evaluation') {
  const expert = await createOnlineExpert('Bob', 'bob@test.com', ['crypto']);
  const session = createSession({
    offeringType,
    tierId: 'quick',
    description: 'Test local session',
    buyerAgent: 'local-agent',
    priceUsdc: 0.01,
  });
  matchSession(session.id);
  acceptSession(session.id, expert.id);
  getDb().prepare("UPDATE sessions SET status = 'active' WHERE id = ?").run(session.id);
  return getSessionById(session.id)!;
}

describe('completeSession ACP delivery', () => {
  beforeEach(() => {
    setupTestDb();
    mockDeliverSessionToAcp.mockClear();
    mockSubmitEvaluatorVerdict.mockClear();
  });

  it('calls deliverSessionToAcp for regular ACP sessions', async () => {
    const session = await createActiveAcpSession('trust_evaluation');
    addMessage(session.id, 'expert', session.expertId, 'Analysis complete.');

    completeSession(session.id);

    // Dynamic import is a microtask — wait for mock to be called
    await vi.waitFor(() => {
      expect(mockDeliverSessionToAcp).toHaveBeenCalledWith(session.id);
    });
    expect(mockSubmitEvaluatorVerdict).not.toHaveBeenCalled();
  });

  it('calls submitEvaluatorVerdict for dispute_arbitration ACP sessions', async () => {
    const session = await createActiveAcpSession('dispute_arbitration');
    addMessage(session.id, 'expert', session.expertId, 'Reviewed.');
    saveDeliverable(session.id, 'dispute_arbitration', {
      verdict: 'approve',
      reasoning: 'Good delivery',
      summary: 'Approved',
    });

    completeSession(session.id);

    await vi.waitFor(() => {
      expect(mockSubmitEvaluatorVerdict).toHaveBeenCalledWith(session.id);
    });
    expect(mockDeliverSessionToAcp).not.toHaveBeenCalled();
  });

  it('does not call ACP functions for local sessions (no acpJobId)', async () => {
    const session = await createActiveLocalSession();
    addMessage(session.id, 'expert', session.expertId, 'Done.');

    const completed = completeSession(session.id);

    // Flush microtask queue to ensure no async calls were triggered
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(completed).toBeTruthy();
    expect(completed!.status).toBe('completed');
    expect(mockDeliverSessionToAcp).not.toHaveBeenCalled();
    expect(mockSubmitEvaluatorVerdict).not.toHaveBeenCalled();
  });

  it('confirms payout immediately for local sessions', async () => {
    const session = await createActiveLocalSession();

    completeSession(session.id);

    const refreshed = getSessionById(session.id)!;
    expect(refreshed.payoutConfirmedAt).toBeTruthy();
  });

  it('does not confirm payout immediately for ACP sessions', async () => {
    const session = await createActiveAcpSession('trust_evaluation');

    completeSession(session.id);

    // ACP sessions wait for on-chain COMPLETED phase before confirming payout
    const refreshed = getSessionById(session.id)!;
    expect(refreshed.payoutConfirmedAt).toBeNull();
  });

  it('calls deliverSessionToAcp for non-dispute ACP offerings', async () => {
    const session = await createActiveAcpSession('output_quality_gate');
    addMessage(session.id, 'expert', session.expertId, 'Reviewed output.');

    completeSession(session.id);

    await vi.waitFor(() => {
      expect(mockDeliverSessionToAcp).toHaveBeenCalledWith(session.id);
    });
    expect(mockSubmitEvaluatorVerdict).not.toHaveBeenCalled();
  });

  it('does not call ACP functions if session is already completed', async () => {
    const session = await createActiveAcpSession('trust_evaluation');

    // Complete once
    completeSession(session.id);
    await vi.waitFor(() => {
      expect(mockDeliverSessionToAcp).toHaveBeenCalledTimes(1);
    });

    mockDeliverSessionToAcp.mockClear();
    mockSubmitEvaluatorVerdict.mockClear();

    // Second call returns null (already transitioned)
    const secondResult = completeSession(session.id);
    expect(secondResult).toBeNull();

    // Flush microtasks — no new ACP calls should have been made
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(mockDeliverSessionToAcp).not.toHaveBeenCalled();
    expect(mockSubmitEvaluatorVerdict).not.toHaveBeenCalled();
  });
});
