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

export interface ResourceAvailability {
  service: string;
  status: 'available' | 'limited' | 'offline';
  timestamp: string;
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
