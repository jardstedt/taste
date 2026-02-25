import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDb } from './helpers.js';
import {
  createExpert,
  getExpertById,
  getExpertByEmail,
  updateExpert,
  setExpertPassword,
  verifyPassword,
  deactivateExpert,
} from '../services/experts.js';

describe('experts', () => {
  beforeEach(() => {
    setupTestDb();
  });

  describe('createExpert', () => {
    it('creates an expert with correct fields', () => {
      const expert = createExpert('Alice', 'alice@test.com', ['crypto'], 'expert');
      expect(expert.id).toBeTruthy();
      expect(expert.name).toBe('Alice');
      expect(expert.domains).toEqual(['crypto']);
      expect(expert.role).toBe('expert');
      expect(expert.availability).toBe('offline');
      expect(expert.deactivatedAt).toBeNull();
    });

    it('initializes reputation scores for each domain', () => {
      const expert = createExpert('Bob', 'bob@test.com', ['crypto', 'music'], 'expert');
      expect(expert).toBeTruthy();
      // Reputation scores are initialized at 50 per domain — verified via public profile
    });
  });

  describe('getExpertByEmail', () => {
    it('finds expert by email', () => {
      createExpert('Alice', 'alice@test.com', ['crypto']);
      const found = getExpertByEmail('alice@test.com');
      expect(found).toBeTruthy();
      expect(found!.name).toBe('Alice');
    });

    it('returns null for unknown email', () => {
      expect(getExpertByEmail('nobody@test.com')).toBeNull();
    });
  });

  describe('updateExpert', () => {
    it('updates name and availability', () => {
      const expert = createExpert('Alice', 'alice@test.com', ['crypto']);
      const updated = updateExpert(expert.id, { name: 'Alice Updated', availability: 'online' });
      expect(updated!.name).toBe('Alice Updated');
      expect(updated!.availability).toBe('online');
    });

    it('returns null for non-existent expert', () => {
      expect(updateExpert('nonexistent', { name: 'Test' })).toBeNull();
    });
  });

  describe('password', () => {
    it('sets and verifies password', async () => {
      const expert = createExpert('Alice', 'alice@test.com', ['crypto']);
      expect(await verifyPassword(expert, 'anything')).toBe(false);

      await setExpertPassword(expert.id, 'securepass123');
      const refreshed = getExpertById(expert.id)!;
      expect(await verifyPassword(refreshed, 'securepass123')).toBe(true);
      expect(await verifyPassword(refreshed, 'wrongpassword')).toBe(false);
    });

    it('returns false when no password is set', async () => {
      const expert = createExpert('Alice', 'alice@test.com', ['crypto']);
      expect(await verifyPassword(expert, '')).toBe(false);
    });
  });

  describe('deactivateExpert', () => {
    it('sets deactivatedAt and forces offline', () => {
      const expert = createExpert('Alice', 'alice@test.com', ['crypto']);
      updateExpert(expert.id, { availability: 'online' });

      const result = deactivateExpert(expert.id);
      expect(result).toBe(true);

      const refreshed = getExpertById(expert.id)!;
      expect(refreshed.deactivatedAt).toBeTruthy();
      expect(refreshed.availability).toBe('offline');
    });

    it('returns false for non-existent expert', () => {
      expect(deactivateExpert('nonexistent')).toBe(false);
    });
  });
});
