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
      const reason = validate({ projectName: 'ExampleProject', description: 'Please review this project for trustworthiness' }, 'trust_evaluation');
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
        { projectName: 'DeFi Strategy Review', request: 'Please review this DeFi strategy: swap USDC to ETH, is it a good idea?' },
        'trust_evaluation',
      );
      expect(reason).toBeNull();
    });

    it('allows token-related requests with evaluate language', () => {
      const reason = validate(
        { projectName: 'ETH Staking', request: 'Evaluate whether I should transfer my ETH to this staking contract' },
        'trust_evaluation',
      );
      expect(reason).toBeNull();
    });

    it('allows token-related requests with assess language', () => {
      const reason = validate(
        { projectName: 'Bridge Risk', request: 'Assess the risk of bridging USDC through this protocol' },
        'trust_evaluation',
      );
      expect(reason).toBeNull();
    });

    it('allows normal requests that mention tokens in passing', () => {
      const reason = validate(
        { content: 'Check if this article about ETH staking is factually accurate', contentType: 'article' },
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
        { projectName: 'ExampleDeFi', tokenAddress: '0x123', description: 'Evaluate whether this DeFi project is trustworthy' },
        'trust_evaluation',
      );
      expect(reason).toBeNull();
    });

    it('accepts a content quality gate request', () => {
      const reason = validate(
        { content: 'My blog post about blockchain technology...', contentType: 'article', targetAudience: 'developers' },
        'content_quality_gate',
      );
      expect(reason).toBeNull();
    });

    it('accepts an audience reaction poll request', () => {
      const reason = validate(
        { content: 'New brand logo concept', contentType: 'thumbnail', targetAudience: 'crypto native millennials' },
        'audience_reaction_poll',
      );
      expect(reason).toBeNull();
    });

    it('accepts a fact check request', () => {
      const reason = validate(
        { content: 'Bitcoin was created in 2009 by Satoshi Nakamoto', contentType: 'article' },
        'fact_check_verification',
      );
      expect(reason).toBeNull();
    });

    it('accepts a dispute arbitration request', () => {
      const reason = validate(
        { originalContract: 'Two parties agreed on quality of delivered work', deliverable: 'Freelance contract dispute details here' },
        'dispute_arbitration',
      );
      expect(reason).toBeNull();
    });

    it('accepts an output quality gate request', () => {
      const reason = validate(
        { aiOutput: 'Bitcoin hit $73k in March 2024', outputType: 'analysis', intendedUse: 'blog post' },
        'output_quality_gate',
      );
      expect(reason).toBeNull();
    });

    it('accepts an option ranking request', () => {
      const reason = validate(
        { options: [{ id: '1', description: 'Option A' }, { id: '2', description: 'Option B' }], evaluationCriteria: 'clarity' },
        'option_ranking',
      );
      expect(reason).toBeNull();
    });

    it('accepts a creative direction check request', () => {
      const reason = validate(
        { brief: 'A series of 5 short videos explaining DeFi to beginners.', targetAudience: 'general public' },
        'creative_direction_check',
      );
      expect(reason).toBeNull();
    });
  });

  // ── NSFW / inappropriate content ──

  describe('NSFW content filtering', () => {
    it('rejects explicit NSFW content', () => {
      const reason = validate(
        { content: 'An image with extremely graphic NSFW violence.', contentType: 'image', targetAudience: 'crypto Twitter' },
        'audience_reaction_poll',
      );
      expect(reason).toContain('NSFW');
    });

    it('rejects adult film content', () => {
      const reason = validate(
        { brief: 'Highly inappropriate and explicit storyboard for an adult film.', targetAudience: 'adults' },
        'creative_direction_check',
      );
      expect(reason).toContain('NSFW');
    });

    it('rejects pornographic content', () => {
      const reason = validate(
        { content: 'Review this pornographic material', contentType: 'social_post', targetAudience: 'general' },
        'content_quality_gate',
      );
      expect(reason).toContain('NSFW');
    });

    it('rejects sexually explicit content', () => {
      const reason = validate(
        { content: 'This contains sexually explicit imagery', contentType: 'article', targetAudience: 'general' },
        'content_quality_gate',
      );
      expect(reason).toContain('NSFW');
    });

    it('allows content that mentions NSFW in a review context with different wording', () => {
      const reason = validate(
        { projectName: 'SafeContent Filter', specificQuestion: 'Is this content moderation tool reliable?' },
        'trust_evaluation',
      );
      expect(reason).toBeNull();
    });
  });

  // ── Input schema validation ──

  describe('input schema validation', () => {
    it('rejects trust_evaluation missing projectName', () => {
      const reason = validate(
        { tokenAddress: '0x1234567890abcdef1234567890abcdef12345678', socialLinks: ['https://example.com'] },
        'trust_evaluation',
      );
      expect(reason).toContain('Missing required field');
      expect(reason).toContain('projectName');
    });

    it('rejects output_quality_gate missing intendedUse', () => {
      const reason = validate(
        { aiOutput: 'Some text output.', outputType: 'text' },
        'output_quality_gate',
      );
      expect(reason).toContain('Missing required field');
      expect(reason).toContain('intendedUse');
    });

    it('rejects output_quality_gate with invalid outputType', () => {
      const reason = validate(
        { aiOutput: 'Some text output.', outputType: 'garbage', intendedUse: 'testing' },
        'output_quality_gate',
      );
      expect(reason).toContain('Invalid value');
      expect(reason).toContain('outputType');
    });

    it('rejects option_ranking with only 1 option', () => {
      const reason = validate(
        { options: [{ id: '1', description: 'Only one option.' }], evaluationCriteria: 'clarity' },
        'option_ranking',
      );
      expect(reason).toContain('at least 2 items');
    });

    it('rejects option_ranking missing evaluationCriteria', () => {
      const reason = validate(
        { options: [{ id: '1', description: 'Option A' }, { id: '2', description: 'Option B' }] },
        'option_ranking',
      );
      expect(reason).toContain('Missing required field');
      expect(reason).toContain('evaluationCriteria');
    });

    it('rejects content_quality_gate missing targetAudience', () => {
      const reason = validate(
        { content: 'Hello world content.', contentType: 'social_post' },
        'content_quality_gate',
      );
      expect(reason).toContain('Missing required field');
      expect(reason).toContain('targetAudience');
    });

    it('rejects audience_reaction_poll missing contentType', () => {
      const reason = validate(
        { content: 'A general headline.', targetAudience: 'general consumers' },
        'audience_reaction_poll',
      );
      expect(reason).toContain('Missing required field');
      expect(reason).toContain('contentType');
    });

    it('rejects creative_direction_check missing brief', () => {
      const reason = validate(
        { targetAudience: 'crypto Twitter' },
        'creative_direction_check',
      );
      expect(reason).toContain('Missing required field');
      expect(reason).toContain('brief');
    });

    it('rejects fact_check_verification missing content', () => {
      const reason = validate(
        { contentType: 'article' },
        'fact_check_verification',
      );
      expect(reason).toContain('Missing required field');
      expect(reason).toContain('content');
    });

    it('rejects fact_check_verification with invalid contentType', () => {
      const reason = validate(
        { content: 'Some claims about a project.', contentType: 'tweet' },
        'fact_check_verification',
      );
      expect(reason).toContain('Invalid value');
      expect(reason).toContain('contentType');
    });

    it('rejects dispute_arbitration missing originalContract', () => {
      const reason = validate(
        { deliverable: 'The work done.' },
        'dispute_arbitration',
      );
      expect(reason).toContain('Missing required field');
      expect(reason).toContain('originalContract');
    });

    it('rejects dispute_arbitration missing deliverable', () => {
      const reason = validate(
        { originalContract: 'The agreement signed.' },
        'dispute_arbitration',
      );
      expect(reason).toContain('Missing required field');
      expect(reason).toContain('deliverable');
    });

    it('rejects trust_evaluation with socialLinks as string instead of array', () => {
      const reason = validate(
        { projectName: 'Bitcoin', socialLinks: 'https://bitcoin.org' },
        'trust_evaluation',
      );
      expect(reason).toContain('must be an array');
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
