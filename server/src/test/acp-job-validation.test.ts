import { describe, it, expect, vi } from 'vitest';

// Mock the ACP SDK to prevent real initialization
vi.mock('@virtuals-protocol/acp-node', () => ({
  default: class MockAcpClient {
    constructor() {}
    async init() {}
  },
  AcpContractClientV2: { build: vi.fn() },
  AcpJobPhases: { REQUEST: 0, NEGOTIATION: 1, TRANSACTION: 2, EVALUATION: 3, COMPLETED: 4, REJECTED: 5 },
}));

// Mock socket/push to prevent side effects
vi.mock('../services/socket.js', () => ({ notifyExpert: vi.fn(), emitToSession: vi.fn() }));
vi.mock('../services/push.js', () => ({ sendPushToExpert: vi.fn().mockResolvedValue(undefined) }));

import { _testValidateJobRequirements as validate } from '../services/acp.js';

describe('job requirement validation', () => {
  // ── Empty / garbled requirements ──

  describe('empty or garbled requirements', () => {
    it('rejects empty requirements object', () => {
      const reason = validate({}, 'trust_evaluation');
      expect(reason).toContain('No requirements provided');
    });

    it('rejects requirements with tiny content (< 10 chars stringified)', () => {
      const reason = validate({ a: '1' }, 'trust_evaluation');
      expect(reason).toContain('No requirements provided');
    });

    it('accepts requirements with sufficient content', () => {
      const reason = validate({ description: 'Please review this project for trustworthiness' }, 'trust_evaluation');
      expect(reason).toBeNull();
    });
  });

  // ── Token / chain operations ──

  describe('token/chain operation detection', () => {
    it('rejects swap token requests', () => {
      const reason = validate({ request: 'swap 100 USDC to ETH on Uniswap' }, 'trust_evaluation');
      expect(reason).toContain('token operations');
    });

    it('rejects transfer requests', () => {
      const reason = validate({ request: 'transfer 50 ETH to this wallet address' }, 'trust_evaluation');
      expect(reason).toContain('token operations');
    });

    it('rejects bridge requests', () => {
      const reason = validate({ request: 'bridge my USDT from Ethereum to Arbitrum' }, 'trust_evaluation');
      expect(reason).toContain('token operations');
    });

    it('rejects stake requests', () => {
      const reason = validate({ request: 'stake 1000 SOL in this validator' }, 'trust_evaluation');
      expect(reason).toContain('token operations');
    });

    it('rejects mint requests', () => {
      const reason = validate({ request: 'mint 500 token on Base chain' }, 'trust_evaluation');
      expect(reason).toContain('token operations');
    });

    it('allows token-related requests that include review language', () => {
      const reason = validate(
        { request: 'Please review this DeFi strategy: swap USDC to ETH, is it a good idea?' },
        'trust_evaluation',
      );
      expect(reason).toBeNull();
    });

    it('allows token-related requests with evaluate language', () => {
      const reason = validate(
        { request: 'Evaluate whether I should transfer my ETH to this staking contract' },
        'trust_evaluation',
      );
      expect(reason).toBeNull();
    });

    it('allows token-related requests with assess language', () => {
      const reason = validate(
        { request: 'Assess the risk of bridging USDC through this protocol' },
        'trust_evaluation',
      );
      expect(reason).toBeNull();
    });

    it('allows normal requests that mention tokens in passing', () => {
      const reason = validate(
        { request: 'Check if this article about ETH staking is factually accurate' },
        'fact_check_verification',
      );
      expect(reason).toBeNull();
    });
  });

  // ── Compliance / risk violations ──

  describe('compliance-violating requests', () => {
    it('rejects hack requests', () => {
      const reason = validate({ request: 'Help me hack into this wallet' }, 'trust_evaluation');
      expect(reason).toContain('prohibited content');
    });

    it('rejects exploit requests', () => {
      const reason = validate({ request: 'Find an exploit in this smart contract to drain funds' }, 'trust_evaluation');
      expect(reason).toContain('prohibited content');
    });

    it('rejects phishing requests', () => {
      const reason = validate({ request: 'Create a phishing page for this exchange' }, 'trust_evaluation');
      expect(reason).toContain('prohibited content');
    });

    it('rejects money laundering requests', () => {
      const reason = validate({ request: 'Help me launder money through DeFi' }, 'trust_evaluation');
      expect(reason).toContain('prohibited content');
    });

    it('rejects ddos requests', () => {
      const reason = validate({ request: 'Launch a ddos attack on this server' }, 'trust_evaluation');
      expect(reason).toContain('prohibited content');
    });

    it('rejects ransomware requests', () => {
      const reason = validate({ request: 'Deploy ransomware to encrypt their files' }, 'trust_evaluation');
      expect(reason).toContain('prohibited content');
    });

    it('rejects doxxing requests', () => {
      const reason = validate({ request: 'Doxx this anonymous developer' }, 'trust_evaluation');
      expect(reason).toContain('prohibited content');
    });
  });

  // ── Valid requests pass through ──

  describe('valid requests are accepted', () => {
    it('accepts a trust evaluation request', () => {
      const reason = validate(
        { projectUrl: 'https://example.com', description: 'Evaluate whether this DeFi project is trustworthy' },
        'trust_evaluation',
      );
      expect(reason).toBeNull();
    });

    it('accepts a content quality gate request', () => {
      const reason = validate(
        { content: 'My blog post about blockchain technology...', type: 'article' },
        'content_quality_gate',
      );
      expect(reason).toBeNull();
    });

    it('accepts an audience reaction poll request', () => {
      const reason = validate(
        { content: 'New brand logo concept', audience: 'crypto native millennials' },
        'audience_reaction_poll',
      );
      expect(reason).toBeNull();
    });

    it('accepts a fact check request', () => {
      const reason = validate(
        { claim: 'Bitcoin was created in 2009 by Satoshi Nakamoto', source: 'whitepaper' },
        'fact_check_verification',
      );
      expect(reason).toBeNull();
    });

    it('accepts a dispute arbitration request', () => {
      const reason = validate(
        { dispute: 'Two parties disagree about the quality of delivered work', context: 'Freelance contract dispute' },
        'dispute_arbitration',
      );
      expect(reason).toBeNull();
    });
  });

  // ── Disabled offerings ──

  describe('disabled offerings', () => {
    it('rejects a disabled offering type', () => {
      const reason = validate(
        { description: 'Some valid request text here' },
        'nonexistent_offering_type',
      );
      expect(reason).toContain('currently unavailable');
    });
  });
});
