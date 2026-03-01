import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resetEnv, loadEnv } from '../config/env.js';
import { initDb, closeDb } from '../db/database.js';

// ── Mock the ACP SDK ──
// vi.hoisted runs before vi.mock hoisting, so these are available in the factory

const { mockInit, mockGetAgent, mockGetJobById, MockAcpClient, mockContractBuild } = vi.hoisted(() => {
  const mockInit = vi.fn().mockResolvedValue(undefined);
  const mockGetAgent = vi.fn();
  const mockGetJobById = vi.fn();

  const MockAcpClient = vi.fn().mockImplementation(function () {
    return { init: mockInit, getAgent: mockGetAgent, getJobById: mockGetJobById };
  });

  const mockContractBuild = vi.fn().mockResolvedValue({});

  return { mockInit, mockGetAgent, mockGetJobById, MockAcpClient, mockContractBuild };
});

vi.mock('@virtuals-protocol/acp-node', () => ({
  default: MockAcpClient,
  AcpContractClientV2: { build: mockContractBuild },
  AcpJobPhases: {
    REQUEST: 0,
    NEGOTIATION: 1,
    TRANSACTION: 2,
    EVALUATION: 3,
    COMPLETED: 4,
    REJECTED: 5,
  },
}));

// ── Mock fetch for gas price checks ──

const originalFetch = global.fetch;

function mockGasPrice(gweiPrice: number) {
  const weiPrice = BigInt(Math.round(gweiPrice * 1e9));
  global.fetch = vi.fn().mockResolvedValue({
    json: () => Promise.resolve({ result: '0x' + weiPrice.toString(16) }),
  }) as unknown as typeof fetch;
}

function mockGasPriceFail() {
  global.fetch = vi.fn().mockRejectedValue(new Error('Network error')) as unknown as typeof fetch;
}

// ── Import the module under test (after mocks are set up) ──

import {
  initBuyerClient,
  getBuyerStatus,
  discoverOfferings,
  createBuyerJob,
  getJobStatus,
  payForJob,
  acceptDeliverable,
  rejectDeliverable,
  evaluateJob,
  getActiveJobs,
  getSampleRequests,
  stopBuyerClient,
} from '../services/agent-sim.js';

describe('agent-sim service', () => {
  beforeEach(() => {
    // Set ACP env vars BEFORE loading env
    process.env.ACP_WALLET_PRIVATE_KEY = '0x' + 'a'.repeat(64);
    process.env.ACP_SESSION_ENTITY_KEY_ID = '1';
    process.env.ACP_AGENT_WALLET_ADDRESS = '0x' + 'b'.repeat(40);

    // Reset and reload env with ACP vars present
    resetEnv();
    closeDb();
    loadEnv();
    initDb();

    // Reset mocks and module state
    vi.clearAllMocks();
    stopBuyerClient();
    mockGasPrice(0.01); // Safe gas by default
  });

  afterEach(() => {
    stopBuyerClient();
    global.fetch = originalFetch;
  });

  // ── Initialization ──

  describe('initBuyerClient', () => {
    it('initializes the buyer client and returns wallet', async () => {
      const result = await initBuyerClient();
      expect(result.wallet).toBeTruthy();
      expect(mockContractBuild).toHaveBeenCalledOnce();
      expect(mockInit).toHaveBeenCalledOnce();
    });

    it('returns cached wallet on second init (idempotent)', async () => {
      const r1 = await initBuyerClient();
      const r2 = await initBuyerClient();
      expect(r1.wallet).toBe(r2.wallet);
      expect(mockContractBuild).toHaveBeenCalledOnce();
    });

    it('rejects when gas price is too high', async () => {
      mockGasPrice(1.0);
      await expect(initBuyerClient()).rejects.toThrow(/gas price/i);
    });

    it('rejects when gas check fails (network error)', async () => {
      mockGasPriceFail();
      await expect(initBuyerClient()).rejects.toThrow(/gas price/i);
    });

    it('rejects when ACP credentials are missing', async () => {
      delete process.env.ACP_WALLET_PRIVATE_KEY;
      resetEnv();
      loadEnv();

      await expect(initBuyerClient()).rejects.toThrow(/Missing required ACP configuration/);
    });
  });

  // ── Status ──

  describe('getBuyerStatus', () => {
    it('reports disconnected before init', async () => {
      const status = await getBuyerStatus();
      expect(status.connected).toBe(false);
      expect(status.wallet).toBeNull();
    });

    it('reports connected after init', async () => {
      await initBuyerClient();
      const status = await getBuyerStatus();
      expect(status.connected).toBe(true);
      expect(status.wallet).toBeTruthy();
      expect(status.gasPrice).toBeGreaterThanOrEqual(0);
    });
  });

  // ── Discover Offerings ──

  describe('discoverOfferings', () => {
    it('throws if client not initialized', async () => {
      await expect(discoverOfferings()).rejects.toThrow(/not initialized/);
    });

    it('returns only enabled offerings from Taste agent', async () => {
      await initBuyerClient();
      mockGetAgent.mockResolvedValue({
        name: 'Taste',
        jobOfferings: [
          { name: 'trust_evaluation', price: 0.01 },
          { name: 'human_reaction_prediction', price: 0.01 }, // disabled
          { name: 'option_ranking', price: 0.01 },
        ],
      });

      const offerings = await discoverOfferings();
      expect(offerings).toHaveLength(2); // disabled one filtered out
      expect(offerings[0].index).toBe(0);
      expect(offerings[0].name).toBe('trust_evaluation');
      expect(offerings[0].price).toBe(0.01);
      expect(offerings[0]).toHaveProperty('requirementFields');
      expect(offerings[0]).toHaveProperty('exampleInput');
      expect(offerings[1].index).toBe(2); // on-chain index preserved (skips 1)
      expect(offerings[1].name).toBe('option_ranking');
    });

    it('throws when Taste agent not found', async () => {
      await initBuyerClient();
      mockGetAgent.mockResolvedValue(null);
      await expect(discoverOfferings()).rejects.toThrow(/Could not find Taste agent/);
    });
  });

  // ── Create Job ──

  describe('createBuyerJob', () => {
    const mockInitiateJob = vi.fn().mockResolvedValue(42);

    beforeEach(async () => {
      await initBuyerClient();
      mockGetAgent.mockResolvedValue({
        name: 'Taste',
        jobOfferings: [
          { name: 'Vibes Check', price: 0.005, initiateJob: mockInitiateJob },
          { name: 'Expensive', price: 1.0, initiateJob: mockInitiateJob },
        ],
      });
    });

    it('creates a job and tracks it', async () => {
      const result = await createBuyerJob(0, { question: 'test' });
      expect(result.jobId).toBe(42);
      expect(mockInitiateJob).toHaveBeenCalledWith({ question: 'test' });

      const active = getActiveJobs();
      expect(active).toHaveLength(1);
      expect(active[0].jobId).toBe(42);
      expect(active[0].phase).toBe('REQUEST');
    });

    it('rejects offering that exceeds fee limit', async () => {
      await expect(createBuyerJob(1, { question: 'test' })).rejects.toThrow(/exceeds hard limit/);
      expect(mockInitiateJob).not.toHaveBeenCalled();
    });

    it('rejects invalid offering index (too high)', async () => {
      await expect(createBuyerJob(99, { question: 'test' })).rejects.toThrow(/Invalid offering index/);
    });

    it('rejects invalid offering index (negative)', async () => {
      await expect(createBuyerJob(-1, { question: 'test' })).rejects.toThrow(/Invalid offering index/);
    });

    it('rejects when gas price is too high', async () => {
      mockGasPrice(1.0);
      await expect(createBuyerJob(0, { question: 'test' })).rejects.toThrow(/gas price/i);
    });

    it('throws if client not initialized', async () => {
      stopBuyerClient();
      await expect(createBuyerJob(0, { question: 'test' })).rejects.toThrow(/not initialized/);
    });

    it('passes evaluator address when provided', async () => {
      const evalAddr = '0x' + 'c'.repeat(40);
      await createBuyerJob(0, { question: 'test' }, evalAddr);
      expect(mockInitiateJob).toHaveBeenCalledWith({ question: 'test' }, evalAddr);
    });
  });

  // ── Evaluate Job ──

  describe('evaluateJob', () => {
    const mockEvaluate = vi.fn().mockResolvedValue(undefined);

    it('evaluates a job in EVALUATION phase', async () => {
      await initBuyerClient();
      mockGetJobById.mockResolvedValue({ id: 42, phase: 3, evaluate: mockEvaluate });

      const result = await evaluateJob(42, true, 'Looks good');
      expect(result.success).toBe(true);
      expect(mockEvaluate).toHaveBeenCalledWith(true, 'Looks good');
    });

    it('uses default memo when none provided', async () => {
      await initBuyerClient();
      mockGetJobById.mockResolvedValue({ id: 42, phase: 3, evaluate: mockEvaluate });

      await evaluateJob(42, false);
      expect(mockEvaluate).toHaveBeenCalledWith(false, 'Rejected via e2e test');
    });

    it('rejects if not in EVALUATION phase', async () => {
      await initBuyerClient();
      mockGetJobById.mockResolvedValue({ id: 42, phase: 2 });
      await expect(evaluateJob(42, true)).rejects.toThrow(/expected EVALUATION/);
    });

    it('throws if job not found', async () => {
      await initBuyerClient();
      mockGetJobById.mockResolvedValue(null);
      await expect(evaluateJob(42, true)).rejects.toThrow(/not found/);
    });
  });

  // ── Pay For Job ──

  describe('payForJob', () => {
    const mockPay = vi.fn().mockResolvedValue(undefined);

    it('pays for a job in NEGOTIATION phase', async () => {
      await initBuyerClient();
      mockGetJobById.mockResolvedValue({
        id: 42, phase: 1, price: 0.005,
        payAndAcceptRequirement: mockPay,
      });

      const result = await payForJob(42);
      expect(result.success).toBe(true);
      expect(mockPay).toHaveBeenCalledOnce();
    });

    it('rejects payment if job not in NEGOTIATION phase', async () => {
      await initBuyerClient();
      mockGetJobById.mockResolvedValue({ id: 42, phase: 0, price: 0.005 });
      await expect(payForJob(42)).rejects.toThrow(/expected NEGOTIATION/);
    });

    it('rejects payment if job price exceeds fee limit', async () => {
      await initBuyerClient();
      mockGetJobById.mockResolvedValue({
        id: 42, phase: 1, price: 1.0,
        payAndAcceptRequirement: mockPay,
      });

      await expect(payForJob(42)).rejects.toThrow(/exceeds limit/);
      expect(mockPay).not.toHaveBeenCalled();
    });

    it('rejects payment when gas is too high', async () => {
      await initBuyerClient();
      mockGasPrice(1.0);
      await expect(payForJob(42)).rejects.toThrow(/gas price/i);
    });

    it('throws if job not found', async () => {
      await initBuyerClient();
      mockGetJobById.mockResolvedValue(null);
      await expect(payForJob(999)).rejects.toThrow(/not found/);
    });
  });

  // ── Accept Deliverable ──

  describe('acceptDeliverable', () => {
    const mockAccept = vi.fn().mockResolvedValue(undefined);

    it('accepts deliverable in EVALUATION phase', async () => {
      await initBuyerClient();
      mockGetJobById.mockResolvedValue({ id: 42, phase: 3, accept: mockAccept });

      const result = await acceptDeliverable(42, 'Good work');
      expect(result.success).toBe(true);
      expect(mockAccept).toHaveBeenCalledWith('Good work');
    });

    it('uses default memo when none provided', async () => {
      await initBuyerClient();
      mockGetJobById.mockResolvedValue({ id: 42, phase: 3, accept: mockAccept });

      await acceptDeliverable(42);
      expect(mockAccept).toHaveBeenCalledWith('Accepted via admin demo');
    });

    it('truncates long memos to 500 chars', async () => {
      await initBuyerClient();
      mockGetJobById.mockResolvedValue({ id: 42, phase: 3, accept: mockAccept });

      await acceptDeliverable(42, 'x'.repeat(1000));
      expect(mockAccept.mock.calls[0][0].length).toBe(500);
    });

    it('rejects if not in EVALUATION phase', async () => {
      await initBuyerClient();
      mockGetJobById.mockResolvedValue({ id: 42, phase: 2 });
      await expect(acceptDeliverable(42)).rejects.toThrow(/expected EVALUATION/);
    });
  });

  // ── Reject Deliverable ──

  describe('rejectDeliverable', () => {
    const mockReject = vi.fn().mockResolvedValue(undefined);

    it('rejects deliverable in EVALUATION phase', async () => {
      await initBuyerClient();
      mockGetJobById.mockResolvedValue({ id: 42, phase: 3, reject: mockReject });

      const result = await rejectDeliverable(42, 'Not good');
      expect(result.success).toBe(true);
      expect(mockReject).toHaveBeenCalledWith('Not good');
    });

    it('truncates long rejection memos', async () => {
      await initBuyerClient();
      mockGetJobById.mockResolvedValue({ id: 42, phase: 3, reject: mockReject });

      await rejectDeliverable(42, 'y'.repeat(600));
      expect(mockReject.mock.calls[0][0].length).toBe(500);
    });

    it('rejects if not in EVALUATION phase', async () => {
      await initBuyerClient();
      mockGetJobById.mockResolvedValue({ id: 42, phase: 1 });
      await expect(rejectDeliverable(42)).rejects.toThrow(/expected EVALUATION/);
    });
  });

  // ── Job Status ──

  describe('getJobStatus', () => {
    it('returns job status with memo content', async () => {
      await initBuyerClient();
      mockGetJobById.mockResolvedValue({
        id: 42, phase: 2, price: 0.005,
        memos: [{ content: 'Hello from buyer' }, { content: 'Expert response' }],
      });

      const status = await getJobStatus(42);
      expect(status.id).toBe(42);
      expect(status.phase).toBe('TRANSACTION');
      expect(status.phaseNum).toBe(2);
      expect(status.price).toBe(0.005);
      expect(status.memos).toHaveLength(2);
    });

    it('truncates long memo content', async () => {
      await initBuyerClient();
      mockGetJobById.mockResolvedValue({
        id: 42, phase: 0, price: 0,
        memos: [{ content: 'z'.repeat(2000) }],
      });

      const status = await getJobStatus(42);
      expect(status.memos[0].content.length).toBe(1000);
    });

    it('handles non-string memo content', async () => {
      await initBuyerClient();
      mockGetJobById.mockResolvedValue({
        id: 42, phase: 0, price: 0,
        memos: [{ content: { nested: 'object' } }],
      });

      const status = await getJobStatus(42);
      expect(typeof status.memos[0].content).toBe('string');
    });

    it('throws if client not initialized', async () => {
      await expect(getJobStatus(42)).rejects.toThrow(/not initialized/);
    });

    it('throws if job not found', async () => {
      await initBuyerClient();
      mockGetJobById.mockResolvedValue(null);
      await expect(getJobStatus(999)).rejects.toThrow(/not found/);
    });
  });

  // ── Active Jobs Tracking ──

  describe('getActiveJobs', () => {
    it('returns empty array when no jobs', () => {
      expect(getActiveJobs()).toEqual([]);
    });

    it('tracks jobs after creation', async () => {
      const mockInitiateJob = vi.fn().mockResolvedValue(10);
      await initBuyerClient();
      mockGetAgent.mockResolvedValue({
        name: 'Taste',
        jobOfferings: [{ name: 'Vibes Check', price: 0.005, initiateJob: mockInitiateJob }],
      });

      await createBuyerJob(0, { q: 'test' });
      const jobs = getActiveJobs();
      expect(jobs).toHaveLength(1);
      expect(jobs[0].jobId).toBe(10);
    });
  });

  // ── Stop Client ──

  describe('stopBuyerClient', () => {
    it('disconnects and clears state', async () => {
      await initBuyerClient();
      stopBuyerClient();

      const status = await getBuyerStatus();
      expect(status.connected).toBe(false);
      expect(getActiveJobs()).toEqual([]);
    });
  });

  // ── Sample Requests ──

  describe('getSampleRequests', () => {
    it('returns sample request data', () => {
      const samples = getSampleRequests();
      expect(samples.length).toBeGreaterThan(0);
      expect(samples[0]).toHaveProperty('name');
      expect(samples[0]).toHaveProperty('data');
    });
  });
});
