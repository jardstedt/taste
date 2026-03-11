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

    it('rejects steal requests', () => {
      const reason = validate({ request: 'Help me steal funds from this smart contract' }, 'trust_evaluation');
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

    it('rejects hate speech content', () => {
      const reason = validate(
        { content: 'Offensive hate speech content targeting minorities', contentType: 'social_post', targetAudience: 'general' },
        'content_quality_gate',
      );
      expect(reason).toContain('prohibited content');
    });

    it('rejects racist content', () => {
      const reason = validate(
        { content: 'Racist propaganda material for distribution', contentType: 'article', targetAudience: 'general' },
        'content_quality_gate',
      );
      expect(reason).toContain('prohibited content');
    });

    it('rejects harassment content', () => {
      const reason = validate(
        { projectName: 'Harassment Campaign', request: 'Help me harass this person online' },
        'trust_evaluation',
      );
      expect(reason).toContain('prohibited content');
    });

    it('rejects violent graphic content', () => {
      const reason = validate(
        { content: 'Violent graphic description of harm to others...', contentType: 'social_post', targetAudience: 'teens' },
        'content_quality_gate',
      );
      expect(reason).toContain('prohibited content');
    });

    it('rejects violent and graphic imagery with filler words', () => {
      const reason = validate(
        { content: '[Description of violent and graphic imagery]', contentType: 'image', targetAudience: 'General public' },
        'audience_reaction_poll',
      );
      expect(reason).toContain('prohibited content');
    });

    it('rejects graphic violent imagery', () => {
      const reason = validate(
        { content: 'This contains graphic violent imagery', contentType: 'image', targetAudience: 'general' },
        'audience_reaction_poll',
      );
      expect(reason).toContain('prohibited content');
    });
  });

  // ── Valid requests pass through ──

  describe('valid requests are accepted', () => {
    it('accepts a trust evaluation request', () => {
      const reason = validate(
        { projectName: 'ExampleDeFi', tokenAddress: '0x1234567890abcdef1234567890abcdef12345678', description: 'Evaluate whether this DeFi project is trustworthy' },
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
        { originalContract: 'Two parties agreed on quality of delivered work with specific milestones.', deliverable: 'Freelance contract dispute: the developer delivered a webapp but missed key features.' },
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

    it('accepts dispute about security research with threat model', () => {
      const reason = validate(
        {
          originalContract: 'Technical research report on the security of the Pectra upgrade (activated May 2025). Must include EIP analysis and threat model.',
          deliverable: 'A 2-page summary of news headlines about the upgrade and its social impact.',
          evaluatorContext: 'The client says the deliverable lacks the technical depth and EIP analysis promised in the contract.',
        },
        'dispute_arbitration',
      );
      expect(reason).toBeNull();
    });

    it('accepts trust evaluation with non-EVM address format (Hedera)', () => {
      const reason = validate(
        { projectName: 'Hedera (HBAR)', tokenAddress: '0.0.x', socialLinks: ['https://hedera.com'] },
        'trust_evaluation',
      );
      expect(reason).toBeNull();
    });

    it('accepts trust evaluation with placeholder token address', () => {
      const reason = validate(
        { projectName: 'MetaMask USD ($mUSD)', tokenAddress: '0x...', socialLinks: ['https://metamask.io'] },
        'trust_evaluation',
      );
      expect(reason).toBeNull();
    });

    it('accepts requests mentioning exploit analysis or attack vectors', () => {
      const reason = validate(
        {
          originalContract: 'Write a security audit report covering exploit vectors and attack surface analysis.',
          deliverable: 'A comprehensive report on potential attack vectors and exploit mitigation strategies.',
        },
        'dispute_arbitration',
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
      expect(reason).toMatch(/NSFW|prohibited content/);
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

    it('rejects output_quality_gate with too-short outputType', () => {
      const reason = validate(
        { aiOutput: 'Some text output.', outputType: 'x', intendedUse: 'testing' },
        'output_quality_gate',
      );
      expect(reason).toContain('at least 2 characters');
    });

    it('accepts output_quality_gate with any descriptive outputType', () => {
      const reason = validate(
        { aiOutput: 'Some text output.', outputType: 'market_analysis', intendedUse: 'testing' },
        'output_quality_gate',
      );
      expect(reason).toBeNull();
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

    it('rejects creative_direction_check with targetAudience as number', () => {
      const reason = validate(
        { brief: 'A video series about DeFi basics', targetAudience: 123 },
        'creative_direction_check',
      );
      expect(reason).toContain('must be a string');
      expect(reason).toContain('targetAudience');
    });

    it('rejects content_quality_gate with targetAudience as number', () => {
      const reason = validate(
        { content: 'Hello world content.', contentType: 'social_post', targetAudience: 456 },
        'content_quality_gate',
      );
      expect(reason).toContain('must be a string');
      expect(reason).toContain('targetAudience');
    });

    it('rejects fact_check_verification missing content', () => {
      const reason = validate(
        { contentType: 'article' },
        'fact_check_verification',
      );
      expect(reason).toContain('Missing required field');
      expect(reason).toContain('content');
    });

    it('rejects fact_check_verification with too-short contentType', () => {
      const reason = validate(
        { content: 'Some claims about a project.', contentType: 'ab' },
        'fact_check_verification',
      );
      expect(reason).toContain('at least 3 characters');
    });

    it('accepts fact_check_verification with any descriptive contentType', () => {
      const reason = validate(
        { content: 'Some claims about a project.', contentType: 'news_report' },
        'fact_check_verification',
      );
      expect(reason).toBeNull();
    });

    it('accepts dispute_arbitration with short but valid deliverable', () => {
      const reason = validate(
        { originalContract: 'Write 5 social media posts for a pet food brand.', deliverable: '3 posts about dog toys.' },
        'dispute_arbitration',
      );
      expect(reason).toBeNull();
    });

    it('rejects dispute_arbitration missing originalContract', () => {
      const reason = validate(
        { deliverable: 'The work that was completed and delivered to the buyer.' },
        'dispute_arbitration',
      );
      expect(reason).toContain('Missing required field');
      expect(reason).toContain('originalContract');
    });

    it('rejects dispute_arbitration missing deliverable', () => {
      const reason = validate(
        { originalContract: 'The agreement signed between both parties for the project.' },
        'dispute_arbitration',
      );
      expect(reason).toContain('Missing required field');
      expect(reason).toContain('deliverable');
    });

    it('rejects dispute_arbitration with placeholder-short originalContract', () => {
      const reason = validate(
        { originalContract: 'A clear contract.', deliverable: 'The full deliverable that was completed and submitted to the buyer for review.' },
        'dispute_arbitration',
      );
      expect(reason).toContain('at least 20 characters');
    });

    it('rejects dispute_arbitration with placeholder-short deliverable', () => {
      const reason = validate(
        { originalContract: 'Developer will build a full-stack web application with authentication and payments.', deliverable: 'Short deliver.' },
        'dispute_arbitration',
      );
      expect(reason).toContain('at least 15 characters');
    });

    it('rejects trust_evaluation with socialLinks as string instead of array', () => {
      const reason = validate(
        { projectName: 'Bitcoin', socialLinks: 'https://bitcoin.org' },
        'trust_evaluation',
      );
      expect(reason).toContain('must be an array');
    });

    it('rejects trust_evaluation with too-short tokenAddress', () => {
      const reason = validate(
        { projectName: 'FakeProject', tokenAddress: 'ab' },
        'trust_evaluation',
      );
      expect(reason).toContain('at least 3 characters');
    });

    it('accepts trust_evaluation with full tokenAddress', () => {
      const reason = validate(
        { projectName: 'RealProject', tokenAddress: '0x1234567890abcdef1234567890abcdef12345678' },
        'trust_evaluation',
      );
      expect(reason).toBeNull();
    });

    it('accepts trust_evaluation with truncated tokenAddress', () => {
      const reason = validate(
        { projectName: 'AaveProject', tokenAddress: '0x4d5f47fa03c9bc514e8' },
        'trust_evaluation',
      );
      expect(reason).toBeNull();
    });

    it('rejects socialLinks with invalid URLs', () => {
      const reason = validate(
        { projectName: 'Bitcoin', socialLinks: ['not-a-url'] },
        'trust_evaluation',
      );
      expect(reason).toContain('invalid URL');
    });

    it('accepts socialLinks with valid URLs', () => {
      const reason = validate(
        { projectName: 'Bitcoin', socialLinks: ['https://bitcoin.org', 'https://twitter.com/bitcoin'] },
        'trust_evaluation',
      );
      expect(reason).toBeNull();
    });

    it('rejects fact_check sourceLinks with invalid URLs', () => {
      const reason = validate(
        { content: 'Some factual claims here.', contentType: 'article', sourceLinks: ['not-a-url'] },
        'fact_check_verification',
      );
      expect(reason).toContain('invalid URL');
    });

    it('accepts fact_check sourceLinks with valid URLs', () => {
      const reason = validate(
        { content: 'Some factual claims here.', contentType: 'article', sourceLinks: ['https://example.com/source'] },
        'fact_check_verification',
      );
      expect(reason).toBeNull();
    });
  });

  // ── Placeholder / logical consistency ──

  describe('placeholder and logical consistency validation', () => {
    it('rejects content with example.com placeholder URL', () => {
      const reason = validate(
        { content: 'https://example.com/thumbnail_a.png', contentType: 'thumbnail', targetAudience: 'Crypto YouTube viewers' },
        'audience_reaction_poll',
      );
      expect(reason).toContain('placeholder URL');
    });

    it('rejects comparison question with single item', () => {
      const reason = validate(
        { content: 'https://real-site.com/thumb.png', contentType: 'thumbnail', targetAudience: 'viewers', question: 'Which of these thumbnails would you click?' },
        'audience_reaction_poll',
      );
      expect(reason).toContain('compare multiple items');
    });

    it('accepts comparison question with multiline content (multiple items)', () => {
      const reason = validate(
        { content: 'https://real-site.com/a.png\nhttps://real-site.com/b.png', contentType: 'thumbnail', targetAudience: 'viewers', question: 'Which of these thumbnails would you click?' },
        'audience_reaction_poll',
      );
      expect(reason).toBeNull();
    });
  });

  // ── Spam/abuse detection ──

  describe('spam and abuse detection', () => {
    it('rejects output intended for spamming', () => {
      const reason = validate(
        { aiOutput: 'Buy bitcoin now for 10x gains.', outputType: 'financial_shill', intendedUse: 'spamming groups' },
        'output_quality_gate',
      );
      expect(reason).toContain('prohibited content');
    });
  });

  // ── Dispute arbitration with code ──

  describe('dispute arbitration with code content', () => {
    it('accepts dispute with Solidity code containing transfer/burn/mint', () => {
      const reason = validate(
        {
          originalContract: 'Developer will provide a Solidity smart contract for a basic ERC20 token with a 5% burn mechanism on every transfer.',
          deliverable: 'pragma solidity ^0.8.0; function _transfer(address sender, address recipient, uint256 amount) { uint256 burnAmount = (amount * 5) / 100; _burn(sender, burnAmount); super._transfer(sender, recipient, amount - burnAmount); }',
          evaluatorContext: 'The buyer claims the burn mechanism is inefficient.',
        },
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
