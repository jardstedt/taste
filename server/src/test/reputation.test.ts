import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDb } from './helpers.js';
import { createExpert } from '../services/experts.js';
import { recordEvent, getExpertReputationScores } from '../services/reputation.js';

describe('reputation', () => {
  beforeEach(() => {
    setupTestDb();
  });

  describe('initial scores', () => {
    it('starts at 50 for each domain', () => {
      const expert = createExpert('Alice', 'alice@test.com', ['crypto', 'music']);
      const scores = getExpertReputationScores(expert.id);
      expect(scores.crypto).toBe(50);
      expect(scores.music).toBe(50);
    });
  });

  describe('recordEvent', () => {
    it('increases score on job_completed (+2)', () => {
      const expert = createExpert('Alice', 'alice@test.com', ['crypto']);
      recordEvent(expert.id, 'crypto', 'job_completed');
      const scores = getExpertReputationScores(expert.id);
      expect(scores.crypto).toBe(52);
    });

    it('increases score on positive_feedback (+5)', () => {
      const expert = createExpert('Alice', 'alice@test.com', ['crypto']);
      recordEvent(expert.id, 'crypto', 'positive_feedback');
      const scores = getExpertReputationScores(expert.id);
      expect(scores.crypto).toBe(55);
    });

    it('decreases score on timeout (-5)', () => {
      const expert = createExpert('Alice', 'alice@test.com', ['crypto']);
      recordEvent(expert.id, 'crypto', 'timeout');
      const scores = getExpertReputationScores(expert.id);
      expect(scores.crypto).toBe(45);
    });

    it('decreases score on rejected (-10)', () => {
      const expert = createExpert('Alice', 'alice@test.com', ['crypto']);
      recordEvent(expert.id, 'crypto', 'rejected');
      const scores = getExpertReputationScores(expert.id);
      expect(scores.crypto).toBe(40);
    });

    it('clamps score at 0 (no negative scores)', () => {
      const expert = createExpert('Alice', 'alice@test.com', ['crypto']);
      // Score starts at 50, apply 11 rejected events (-10 each) = -110 total
      for (let i = 0; i < 11; i++) {
        recordEvent(expert.id, 'crypto', 'rejected');
      }
      const scores = getExpertReputationScores(expert.id);
      expect(scores.crypto).toBe(0);
    });

    it('clamps score at 100', () => {
      const expert = createExpert('Alice', 'alice@test.com', ['crypto']);
      // Score starts at 50, apply 20 positive_feedback (+5 each) = +100 total
      for (let i = 0; i < 20; i++) {
        recordEvent(expert.id, 'crypto', 'positive_feedback');
      }
      const scores = getExpertReputationScores(expert.id);
      expect(scores.crypto).toBe(100);
    });

    it('accumulates multiple events', () => {
      const expert = createExpert('Alice', 'alice@test.com', ['crypto']);
      recordEvent(expert.id, 'crypto', 'job_completed'); // +2 → 52
      recordEvent(expert.id, 'crypto', 'positive_feedback'); // +5 → 57
      recordEvent(expert.id, 'crypto', 'timeout'); // -5 → 52
      const scores = getExpertReputationScores(expert.id);
      expect(scores.crypto).toBe(52);
    });
  });
});
