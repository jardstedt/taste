import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDb } from './helpers.js';
import {
  createExpert,
  getExpertByEmail,
  setExpertPassword,
  verifyPassword,
  deactivateExpert,
  getExpertById,
} from '../services/experts.js';

describe('auth', () => {
  beforeEach(() => {
    setupTestDb();
  });

  describe('login flow', () => {
    it('verifies correct password', () => {
      const expert = createExpert('Alice', 'alice@test.com', ['crypto']);
      setExpertPassword(expert.id, 'correctpass1');
      const found = getExpertByEmail('alice@test.com')!;
      expect(verifyPassword(found, 'correctpass1')).toBe(true);
    });

    it('rejects wrong password', () => {
      const expert = createExpert('Alice', 'alice@test.com', ['crypto']);
      setExpertPassword(expert.id, 'correctpass1');
      const found = getExpertByEmail('alice@test.com')!;
      expect(verifyPassword(found, 'wrongpassword')).toBe(false);
    });

    it('rejects login for user with no password', () => {
      createExpert('Alice', 'alice@test.com', ['crypto']);
      const found = getExpertByEmail('alice@test.com')!;
      expect(verifyPassword(found, 'anything')).toBe(false);
    });

    it('blocks deactivated users', () => {
      const expert = createExpert('Alice', 'alice@test.com', ['crypto']);
      setExpertPassword(expert.id, 'correctpass1');
      deactivateExpert(expert.id);

      const found = getExpertByEmail('alice@test.com')!;
      expect(found.deactivatedAt).toBeTruthy();
      // The auth route checks deactivatedAt before verifyPassword
      // Here we verify the field is set — the route-level test would be an integration test
    });
  });

  describe('password change', () => {
    it('allows changing password', () => {
      const expert = createExpert('Alice', 'alice@test.com', ['crypto']);
      setExpertPassword(expert.id, 'oldpassword1');
      setExpertPassword(expert.id, 'newpassword1');

      const refreshed = getExpertById(expert.id)!;
      expect(verifyPassword(refreshed, 'oldpassword1')).toBe(false);
      expect(verifyPassword(refreshed, 'newpassword1')).toBe(true);
    });
  });
});
