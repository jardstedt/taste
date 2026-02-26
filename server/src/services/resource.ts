/**
 * ACP Resource endpoint — exposes live expert availability data.
 * Register this URL as a Resource offering on Virtuals so other agents
 * can check availability before creating a job.
 *
 * Endpoint: GET /api/public/resource/availability
 */

import { getAllExperts } from './experts.js';
import { getExpertReputationScores } from './reputation.js';
import { getEnabledSessionOfferings, SESSION_TIERS, DOMAINS } from '../config/domains.js';
import { getDb } from '../db/database.js';
import type { Domain } from '../types/index.js';

/** Operating hours config — all experts are currently in CET timezone */
const OPERATING_HOURS = {
  timezone: 'Europe/Stockholm',
  dailyStart: 9,   // 09:00 local
  dailyEnd: 23,     // 23:00 local
  description: 'Experts available 09:00–23:00 CET daily. Jobs submitted outside hours are queued and matched when experts come online.',
};

interface DomainAvailability {
  domain: Domain;
  label: string;
  onlineExperts: number;
  avgReputationScore: number;
  avgResponseMins: number;
}

interface OfferingInfo {
  type: string;
  name: string;
  description: string;
  tier: string;
  priceRange: [number, number];
  durationMinutes: [number, number];
  maxTurns: number;
  domains: Domain[];
}

interface OperatingHours {
  timezone: string;
  schedule: string;
  currentlyOpen: boolean;
  nextOpenAt: string | null;
  note: string;
}

export interface ResourceAvailability {
  service: string;
  status: 'available' | 'limited' | 'offline';
  timestamp: string;
  operatingHours: OperatingHours;
  capacity: {
    totalExperts: number;
    onlineExperts: number;
    busyExperts: number;
    activeSessions: number;
  };
  domains: DomainAvailability[];
  offerings: OfferingInfo[];
  estimatedResponseMins: number;
}

export function getResourceAvailability(): ResourceAvailability {
  const experts = getAllExperts().filter(e => e.agreementAcceptedAt && !e.deactivatedAt && e.consentToPublicProfile);

  const onlineExperts = experts.filter(e => e.availability === 'online');
  const busyExperts = experts.filter(e => e.availability === 'busy');

  // Count active sessions
  const db = getDb();
  const activeCount = (db.prepare(
    "SELECT COUNT(*) as count FROM sessions WHERE status IN ('pending', 'accepted', 'active', 'wrapping_up')",
  ).get() as { count: number }).count;

  // Per-domain availability
  const domainDefs = DOMAINS;
  const domains: DomainAvailability[] = domainDefs.map(d => {
    const domainExperts = onlineExperts.filter(e => e.domains.includes(d.id));
    const scores = domainExperts.map(e => {
      const rep = getExpertReputationScores(e.id);
      return rep[d.id] ?? 50;
    });
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const avgResponse = domainExperts.length > 0
      ? Math.round(domainExperts.reduce((sum, e) => sum + e.avgResponseTimeMins, 0) / domainExperts.length)
      : 0;

    return {
      domain: d.id,
      label: d.label,
      onlineExperts: domainExperts.length,
      avgReputationScore: avgScore,
      avgResponseMins: avgResponse,
    };
  }).filter(d => d.onlineExperts > 0);

  // Enabled offerings with tier info
  const offerings: OfferingInfo[] = getEnabledSessionOfferings().map(o => {
    const tier = SESSION_TIERS.find(t => t.id === o.defaultTier);
    return {
      type: o.type,
      name: o.name,
      description: o.description,
      tier: o.defaultTier,
      priceRange: tier?.priceRange ?? [0, 0],
      durationMinutes: tier?.durationMinutes ?? [0, 0],
      maxTurns: tier?.maxTurns ?? 0,
      domains: o.relevantDomains,
    };
  });

  // Overall response estimate
  const allResponseTimes = onlineExperts
    .filter(e => e.completedJobs > 0)
    .map(e => e.avgResponseTimeMins);
  const estimatedResponseMins = allResponseTimes.length > 0
    ? Math.round(allResponseTimes.reduce((a, b) => a + b, 0) / allResponseTimes.length)
    : 0;

  // Status determination
  let status: 'available' | 'limited' | 'offline' = 'offline';
  if (onlineExperts.length > 0) {
    status = onlineExperts.length >= 2 ? 'available' : 'limited';
  }

  return {
    service: 'Taste: Human Expert Consultation',
    status,
    timestamp: new Date().toISOString(),
    operatingHours: getOperatingHours(),
    capacity: {
      totalExperts: experts.length,
      onlineExperts: onlineExperts.length,
      busyExperts: busyExperts.length,
      activeSessions: activeCount,
    },
    domains,
    offerings,
    estimatedResponseMins,
  };
}

/**
 * Compute current operating hours status with next-open time.
 * Uses IANA timezone for reliable DST handling.
 */
function getOperatingHours(): OperatingHours {
  const { timezone, dailyStart, dailyEnd, description } = OPERATING_HOURS;

  // Get current hour in the expert timezone
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
  });
  const currentHour = parseInt(formatter.format(now), 10);
  const currentlyOpen = currentHour >= dailyStart && currentHour < dailyEnd;

  // Compute next open time when currently closed
  let nextOpenAt: string | null = null;
  if (!currentlyOpen) {
    // Build a date string in the target timezone to find next opening
    const dateParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now); // yields YYYY-MM-DD

    if (currentHour >= dailyEnd) {
      // Past closing — next open is tomorrow at dailyStart
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const tomorrowStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(tomorrow);
      nextOpenAt = `${tomorrowStr}T${String(dailyStart).padStart(2, '0')}:00:00 ${timezone}`;
    } else {
      // Before opening — next open is today at dailyStart
      nextOpenAt = `${dateParts}T${String(dailyStart).padStart(2, '0')}:00:00 ${timezone}`;
    }
  }

  return {
    timezone,
    schedule: `${String(dailyStart).padStart(2, '0')}:00–${String(dailyEnd).padStart(2, '0')}:00 daily`,
    currentlyOpen,
    nextOpenAt,
    note: description,
  };
}
