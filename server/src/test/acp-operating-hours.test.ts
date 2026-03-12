import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

import { getOperatingHours } from '../services/resource.js';

describe('operating hours gate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns currentlyOpen: true during operating hours (08:00–23:00 CET)', () => {
    // 2026-03-02 14:00 UTC = 15:00 CET (within operating hours)
    vi.setSystemTime(new Date('2026-03-02T14:00:00Z'));

    const hours = getOperatingHours();
    expect(hours.currentlyOpen).toBe(true);
    expect(hours.nextOpenAt).toBeNull();
    expect(hours.schedule).toContain('08:00');
    expect(hours.schedule).toContain('23:00');
  });

  it('returns currentlyOpen: false before opening time', () => {
    // 2026-03-02 06:00 UTC = 07:00 CET (before 08:00 opening)
    vi.setSystemTime(new Date('2026-03-02T06:00:00Z'));

    const hours = getOperatingHours();
    expect(hours.currentlyOpen).toBe(false);
    expect(hours.nextOpenAt).not.toBeNull();
    expect(hours.nextOpenAt).toContain('08:00');
  });

  it('returns currentlyOpen: false after closing time', () => {
    // 2026-03-02 23:00 UTC = 00:00 CET next day (after 23:00 closing)
    vi.setSystemTime(new Date('2026-03-02T23:00:00Z'));

    const hours = getOperatingHours();
    expect(hours.currentlyOpen).toBe(false);
    expect(hours.nextOpenAt).not.toBeNull();
    expect(hours.nextOpenAt).toContain('08:00');
  });

  it('returns currentlyOpen: true at opening boundary (08:00 CET)', () => {
    // 2026-03-02 07:00 UTC = 08:00 CET (exactly at opening)
    vi.setSystemTime(new Date('2026-03-02T07:00:00Z'));

    const hours = getOperatingHours();
    expect(hours.currentlyOpen).toBe(true);
  });

  it('returns currentlyOpen: false at closing boundary (23:00 CET)', () => {
    // 2026-03-02 22:00 UTC = 23:00 CET (exactly at closing)
    vi.setSystemTime(new Date('2026-03-02T22:00:00Z'));

    const hours = getOperatingHours();
    expect(hours.currentlyOpen).toBe(false);
    expect(hours.nextOpenAt).not.toBeNull();
  });

  it('includes timezone info in response', () => {
    vi.setSystemTime(new Date('2026-03-02T14:00:00Z'));

    const hours = getOperatingHours();
    expect(hours.timezone).toBe('Europe/Stockholm');
    expect(hours.schedule).toMatch(/\d{2}:00–\d{2}:00 daily/);
  });
});
