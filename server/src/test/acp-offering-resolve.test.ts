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

import { _testResolveOfferingType as resolveOfferingType } from '../services/acp.js';

describe('resolveOfferingType', () => {
  it('resolves exact keyword matches', () => {
    expect(resolveOfferingType('trust evaluation')).toBe('trust_evaluation');
    expect(resolveOfferingType('scam check')).toBe('trust_evaluation');
    expect(resolveOfferingType('quality check')).toBe('output_quality_gate');
    expect(resolveOfferingType('fact check')).toBe('fact_check_verification');
    expect(resolveOfferingType('dispute')).toBe('dispute_arbitration');
  });

  it('resolves underscore-separated offering names', () => {
    expect(resolveOfferingType('trust_evaluation')).toBe('trust_evaluation');
    expect(resolveOfferingType('output_quality_gate')).toBe('output_quality_gate');
    expect(resolveOfferingType('content_quality_gate')).toBe('content_quality_gate');
  });

  it('is case-insensitive', () => {
    expect(resolveOfferingType('Trust Evaluation')).toBe('trust_evaluation');
    expect(resolveOfferingType('SCAM CHECK')).toBe('trust_evaluation');
    expect(resolveOfferingType('Fact Check')).toBe('fact_check_verification');
  });

  it('matches keywords within longer strings', () => {
    expect(resolveOfferingType('Please do a trust evaluation of this project')).toBe('trust_evaluation');
    expect(resolveOfferingType('I need a quality check on this report')).toBe('output_quality_gate');
  });

  it('returns null for completely unrecognized names', () => {
    expect(resolveOfferingType('banana smoothie recipe')).toBeNull();
    expect(resolveOfferingType('random_unknown_type')).toBeNull();
    expect(resolveOfferingType('12345')).toBeNull();
  });

  it('returns null for empty strings', () => {
    expect(resolveOfferingType('')).toBeNull();
    expect(resolveOfferingType('   ')).toBeNull();
  });

  it('resolves all 8 enabled offering types by exact name', () => {
    const offeringTypes = [
      'trust_evaluation',
      'output_quality_gate',
      'option_ranking',
      'content_quality_gate',
      'audience_reaction_poll',
      'creative_direction_check',
      'fact_check_verification',
      'dispute_arbitration',
    ];
    for (const type of offeringTypes) {
      expect(resolveOfferingType(type)).toBe(type);
    }
  });
});
