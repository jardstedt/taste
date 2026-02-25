import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDb } from './helpers.js';
import { getAccountForAgent, getAccountForJob } from '../services/acp.js';

describe('ACP account tracking', () => {
  beforeEach(() => {
    setupTestDb();
  });

  describe('getAccountForAgent', () => {
    it('returns null when ACP client is not connected', async () => {
      const result = await getAccountForAgent('0x1234567890abcdef1234567890abcdef12345678');
      expect(result).toBeNull();
    });

    it('handles empty address gracefully', async () => {
      const result = await getAccountForAgent('');
      expect(result).toBeNull();
    });
  });

  describe('getAccountForJob', () => {
    it('returns null when ACP client is not connected', async () => {
      const result = await getAccountForJob(12345);
      expect(result).toBeNull();
    });

    it('handles zero job ID gracefully', async () => {
      const result = await getAccountForJob(0);
      expect(result).toBeNull();
    });
  });
});
