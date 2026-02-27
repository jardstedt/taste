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
import { getDeliverableFields } from '../config/deliverable-schemas.js';
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
  qualityPolicy: string;
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
    qualityPolicy: 'Vetted domain experts. Requests that cannot be fulfilled with quality are declined with explanation and full refund.',
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

// ── Offering Catalog Resource ──

interface OfferingCatalogEntry {
  type: string;
  name: string;
  description: string;
  tier: string;
  priceRange: [number, number];
  slaMinutes: [number, number];
  maxTurns: number;
  domains: Domain[];
  requirementFields: string[];
  deliverableFields: Array<{ key: string; label: string; type: string; required: boolean; options?: string[] }>;
}

export function getOfferingCatalog(): { service: string; qualityPolicy: string; offerings: OfferingCatalogEntry[] } {
  const offerings = getEnabledSessionOfferings().map(o => {
    const tier = SESSION_TIERS.find(t => t.id === o.defaultTier);
    const fields = getDeliverableFields(o.type);

    return {
      type: o.type,
      name: o.name,
      description: o.description,
      tier: o.defaultTier,
      priceRange: tier?.priceRange ?? [0, 0] as [number, number],
      slaMinutes: tier?.durationMinutes ?? [0, 0] as [number, number],
      maxTurns: tier?.maxTurns ?? 0,
      domains: o.relevantDomains,
      requirementFields: OFFERING_REQUIREMENTS[o.type] ?? [],
      deliverableFields: fields.map(f => ({
        key: f.key,
        label: f.label,
        type: f.type,
        required: f.required,
        ...(f.options ? { options: f.options } : {}),
      })),
    };
  });

  return {
    service: 'Taste: Human Expert Consultation',
    qualityPolicy: 'All experts are vetted for domain expertise before activation. Experts will decline requests they cannot fulfill with quality — you are fully refunded if this happens. Every completed deliverable is backed by genuine human judgment.',
    offerings,
  };
}

/** Requirement field names per offering type (for catalog) */
const OFFERING_REQUIREMENTS: Record<string, string[]> = {
  trust_evaluation: ['projectName (string, required)', 'tokenAddress (string, optional)', 'socialLinks (array, optional)', 'specificQuestion (string, optional)'],
  output_quality_gate: ['aiOutput (string, required)', 'outputType (string, required)', 'intendedUse (string, required)', 'knownConstraints (string, optional)'],
  option_ranking: ['options (array of {id, description}, required)', 'evaluationCriteria (string, required)', 'context (string, optional)'],
  content_quality_gate: ['content (string or URL, required)', 'contentType (string, required)', 'targetAudience (string, required)', 'brandGuidelines (string, optional)'],
  audience_reaction_poll: ['content (string or URL, required)', 'contentType (string, required)', 'targetAudience (string, required)', 'question (string, optional)'],
  creative_direction_check: ['brief (string, required)', 'style (string, optional)', 'targetAudience (string, required)', 'medium (string, optional)'],
  fact_check_verification: ['content (string, required)', 'contentType (string, required)', 'focusAreas (string, optional)', 'sourceLinks (array, optional)'],
  dispute_arbitration: ['originalContract (string, required)', 'deliverable (string, required)', 'evaluatorContext (string, optional)'],
};

// ── Sample Deliverables Resource ──

export function getSampleDeliverables(): { service: string; samples: Array<{ offeringType: string; offeringName: string; sampleDeliverable: Record<string, unknown> }> } {
  const samples = [
    {
      offeringType: 'trust_evaluation',
      offeringName: 'Trust Evaluation',
      sampleDeliverable: {
        structuredAssessment: {
          verdict: 'legitimate',
          confidenceScore: 8,
          summary: 'Community growth correlates with IP licensing deals and retail partnerships. Engagement shows organic discussion with substantive content rather than bot activity.',
          keyFindings: 'Active long-term holders in Discord. Organic meme creation. Developer activity on GitHub.',
          redFlags: 'Some repetitive shill posts from low-follower accounts',
          positiveSignals: 'Active long-term holders in Discord. Organic meme creation. Developer activity on GitHub.',
        },
        disclaimer: 'This is a qualitative human opinion, not financial or investment advice.',
      },
    },
    {
      offeringType: 'output_quality_gate',
      offeringName: 'Output Quality Gate',
      sampleDeliverable: {
        structuredAssessment: {
          qualityVerdict: 'needs_revision',
          qualityScore: 7,
          summary: 'Core explanation is accurate but contains a missing fee tier and an unqualified theoretical claim.',
          issuesFound: 'Missing the 1% fee tier added for volatile pairs (medium severity). 4000x efficiency claim is a theoretical maximum, not typical in practice (low severity).',
          suggestedImprovements: 'Add fourth fee tier: 0.01%, 0.05%, 0.30%, and 1.00%. Qualify 4000x with \'up to\' or cite typical ranges of 10-50x.',
        },
        disclaimer: 'This is a qualitative human opinion, not financial or investment advice.',
      },
    },
    {
      offeringType: 'option_ranking',
      offeringName: 'Option Ranking',
      sampleDeliverable: {
        structuredAssessment: {
          topPick: 'A',
          summary: 'Clean wordmark communicates professionalism and trust expected by institutional clients.',
          rankings: '1. Option A — Professional, versatile, institutional trust. 2. Option B — Eye-catching but less versatile. 3. Option C — Distinctive but wrong tone.',
          tradeoffs: 'Option A sacrifices visual distinctiveness for reliability. Option B is more eye-catching but less versatile.',
        },
        disclaimer: 'This is a qualitative human opinion, not financial or investment advice.',
      },
    },
    {
      offeringType: 'content_quality_gate',
      offeringName: 'Content Quality Gate',
      sampleDeliverable: {
        structuredAssessment: {
          verdict: 'needs_changes',
          culturalSensitivityScore: 5,
          brandSafetyScore: 3,
          summary: 'Strong concept but needs revision on urgency language and cultural framing before publishing.',
          flaggedIssues: 'BRAND_SAFETY (high): Urgency-based language implying financial opportunity. CULTURAL (medium): Cultural reference used without attribution.',
        },
        disclaimer: 'This is a qualitative human opinion, not financial or investment advice.',
      },
    },
    {
      offeringType: 'audience_reaction_poll',
      offeringName: 'Audience Reaction Poll',
      sampleDeliverable: {
        structuredAssessment: {
          overallRating: 6,
          summary: 'Clean layout but headline blends into background. Token logo too small at thumbnail size.',
          criteriaScores: 'Visual appeal: 6/10. Clarity: 5/10. Click-worthiness: 5/10.',
          comparisonNotes: 'Compared to trending crypto thumbnails, lacks a visual hook.',
        },
        disclaimer: 'This is a qualitative human opinion, not financial or investment advice.',
      },
    },
    {
      offeringType: 'creative_direction_check',
      offeringName: 'Creative Direction Check',
      sampleDeliverable: {
        structuredAssessment: {
          verdict: 'revise',
          viabilityScore: 5,
          summary: 'Competent concept but indistinguishable from existing cyberpunk AI art. Needs strong differentiators.',
          culturalFlags: 'Cyberpunk cityscape with neon is oversaturated in Web3 and AI art.',
          tonalAlignment: 'Tone matches genre expectations but offers nothing distinctive.',
        },
        disclaimer: 'This is a qualitative human opinion, not financial or investment advice.',
      },
    },
    {
      offeringType: 'fact_check_verification',
      offeringName: 'Fact-Check & Source Verification',
      sampleDeliverable: {
        structuredAssessment: {
          overallAccuracy: 'low',
          claimsChecked: 2,
          summary: 'Both claims contain hallucinated sources.',
          flaggedClaims: 'CLAIM 1: Fabricated Stanford study — FALSE. CLAIM 2: Non-existent blog post — PARTIALLY TRUE (real opinion, wrong source).',
          corrections: 'Replace claim 1 with Chainalysis 2023 data. Attribute claim 2 to January 2021 blog post.',
        },
        disclaimer: 'This is a qualitative human opinion, not financial or investment advice.',
      },
    },
    {
      offeringType: 'dispute_arbitration',
      offeringName: 'Dispute Evaluation',
      sampleDeliverable: {
        structuredAssessment: {
          verdict: 'reject',
          reasoning: 'Deliverable provides only basic token metrics. Original contract required holder distribution, whale activity, and BTC correlation — none delivered.',
          deliverableQuality: 'poor',
          contractAlignment: 'not_met',
          summary: 'Provider delivered basic stats but omitted all substantive requirements.',
        },
        disclaimer: 'This is a qualitative human opinion, not financial or investment advice.',
      },
    },
  ];

  return { service: 'Taste: Human Expert Consultation', samples };
}
