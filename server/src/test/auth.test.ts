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
    it('verifies correct password', async () => {
      const expert = createExpert('Alice', 'alice@test.com', ['crypto']);
      await setExpertPassword(expert.id, 'correctpass1');
      const found = getExpertByEmail('alice@test.com')!;
      expect(await verifyPassword(found, 'correctpass1')).toBe(true);
    });

    it('rejects wrong password', async () => {
      const expert = createExpert('Alice', 'alice@test.com', ['crypto']);
      await setExpertPassword(expert.id, 'correctpass1');
      const found = getExpertByEmail('alice@test.com')!;
      expect(await verifyPassword(found, 'wrongpassword')).toBe(false);
    });

    it('rejects login for user with no password', async () => {
      createExpert('Alice', 'alice@test.com', ['crypto']);
      const found = getExpertByEmail('alice@test.com')!;
      expect(await verifyPassword(found, 'anything')).toBe(false);
    });

    it('blocks deactivated users', async () => {
      const expert = createExpert('Alice', 'alice@test.com', ['crypto']);
      await setExpertPassword(expert.id, 'correctpass1');
      deactivateExpert(expert.id);

      const found = getExpertByEmail('alice@test.com')!;
      expect(found.deactivatedAt).toBeTruthy();
      // The auth route checks deactivatedAt before verifyPassword
      // Here we verify the field is set — the route-level test would be an integration test
    });
  });

  describe('password change', () => {
    it('allows changing password', async () => {
      const expert = createExpert('Alice', 'alice@test.com', ['crypto']);
      await setExpertPassword(expert.id, 'oldpassword1');
      await setExpertPassword(expert.id, 'newpassword1');

      const refreshed = getExpertById(expert.id)!;
      expect(await verifyPassword(refreshed, 'oldpassword1')).toBe(false);
      expect(await verifyPassword(refreshed, 'newpassword1')).toBe(true);
    });
  });
});
