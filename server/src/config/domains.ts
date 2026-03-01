import type { Domain, SessionTier } from '../types/index.js';

export interface DomainDefinition {
  id: Domain;
  label: string;
  description: string;
}

export const DOMAINS: DomainDefinition[] = [
  { id: 'crypto', label: 'Crypto & Web3', description: 'Blockchain projects, tokens, DeFi, on-chain activity analysis' },
  { id: 'music', label: 'Music', description: 'Music production, composition, artist authenticity, audio quality' },
  { id: 'art', label: 'Visual Art', description: 'Digital art, NFT art, illustration, graphic design quality' },
  { id: 'design', label: 'Design', description: 'UX/UI design, branding, visual communication' },
  { id: 'culture', label: 'Writing & Culture', description: 'Written content, cultural trends, narrative analysis, memes' },
  { id: 'community', label: 'Community', description: 'Community health, engagement authenticity, social dynamics' },
  { id: 'business', label: 'Business & Economics', description: 'Market analysis, financial strategy, business evaluation' },
  { id: 'general', label: 'General', description: 'Catch-all for questions not fitting other domains' },
];

// ── Session Offerings ──

export interface SessionOfferingDefinition {
  type: string;
  name: string;
  description: string;
  defaultTier: SessionTier;
  relevantDomains: Domain[];
  enabled: boolean;
  basePrice?: number;
}

export const SESSION_OFFERINGS: SessionOfferingDefinition[] = [
  {
    type: 'trust_evaluation',
    name: 'Trust Evaluation',
    description: 'Evaluate the trustworthiness and legitimacy of a project, token, or entity. Supports optional back-and-forth conversation via memos',
    defaultTier: 'full',
    relevantDomains: ['crypto', 'community', 'business'],
    enabled: true,
  },
  {
    type: 'cultural_context',
    name: 'Cultural Context',
    description: 'Get real-time cultural and contextual insight on trends, narratives, or creative works',
    defaultTier: 'quick',
    relevantDomains: ['culture', 'community', 'art', 'music'],
    enabled: false, // v1 cut: medium rejection risk, moderate discoverability
  },
  {
    type: 'output_quality_gate',
    name: 'Output Quality Gate',
    description: 'Have an expert review and validate AI-generated outputs in real-time',
    defaultTier: 'quick',
    relevantDomains: ['design', 'art', 'culture', 'general'],
    enabled: true,
  },
  {
    type: 'option_ranking',
    name: 'Option Ranking',
    description: 'Expert ranks and compares multiple options with qualitative reasoning',
    defaultTier: 'full',
    relevantDomains: ['general', 'crypto', 'business', 'design', 'art', 'music'],
    enabled: true,
  },
  {
    type: 'blind_spot_check',
    name: 'Blind Spot Check',
    description: 'Expert identifies what an AI might be missing or getting wrong',
    defaultTier: 'quick',
    relevantDomains: ['general', 'crypto', 'culture', 'community'],
    enabled: false, // v1 cut: medium rejection risk, moderate discoverability
  },
  {
    type: 'human_reaction_prediction',
    name: 'Human Reaction Prediction',
    description: 'Expert predicts how humans will react to content, products, or strategies',
    defaultTier: 'full',
    relevantDomains: ['community', 'culture', 'design', 'art', 'music'],
    enabled: false, // v1 cut: high rejection risk, predictions unverifiable
  },
  {
    type: 'expert_brainstorming',
    name: 'Expert Brainstorming',
    description: 'Deep collaborative session where expert and AI brainstorm together',
    defaultTier: 'deep',
    relevantDomains: ['general', 'crypto', 'culture', 'community', 'design', 'art', 'music'],
    enabled: false, // v1 cut: medium rejection risk, open-ended, hard to quantify value
  },
  {
    type: 'content_quality_gate',
    name: 'Content Quality Gate',
    description: 'Pre-publish review of AI-generated content (video, image, audio) for cultural sensitivity, derivative elements, brand safety, and emotional resonance before distribution',
    defaultTier: 'full',
    relevantDomains: ['art', 'music', 'design', 'culture', 'community'],
    enabled: true,
    basePrice: 0.02,
  },
  {
    type: 'audience_reaction_poll',
    name: 'Audience Reaction Poll',
    description: 'Quick crowd poll where multiple humans rate, rank, or score AI-generated content. Fast turnaround, low cost — ideal for A/B testing visuals, thumbnails, or short-form video before publishing',
    defaultTier: 'quick',
    relevantDomains: ['art', 'music', 'design', 'community', 'general'],
    enabled: true,
  },
  {
    type: 'creative_direction_check',
    name: 'Creative Direction Check',
    description: 'Early-stage review of a creative brief, concept, or storyboard before expensive generation runs. Catch cultural red flags, derivative risks, or tonal mismatches before committing compute',
    defaultTier: 'quick',
    relevantDomains: ['art', 'music', 'design', 'culture'],
    enabled: true,
  },
  {
    type: 'fact_check_verification',
    name: 'Fact-Check & Source Verification',
    description: 'Human expert verifies factual claims, checks sources, and flags inaccuracies in AI-generated or user-submitted content',
    defaultTier: 'quick',
    relevantDomains: ['general', 'crypto', 'culture', 'business'],
    enabled: true,
  },
  {
    type: 'dispute_arbitration',
    name: 'Dispute Evaluation',
    description: 'Third-party human evaluation of an ACP job delivery. Expert reviews whether the provider fulfilled the original contract and submits an approve/reject verdict',
    defaultTier: 'quick',
    relevantDomains: ['general', 'crypto', 'business'],
    enabled: true,
  },
];

export interface SessionTierDefinition {
  id: SessionTier;
  name: string;
  priceRange: [number, number];
  durationMinutes: [number, number];
  maxTurns: number;
}

export const SESSION_TIERS: SessionTierDefinition[] = [
  {
    id: 'test',
    name: 'Test',
    priceRange: [0.01, 0.01],
    durationMinutes: [5, 5],
    maxTurns: 2,
  },
  {
    id: 'quick',
    name: 'Quick Consult',
    priceRange: [0.01, 0.01],
    durationMinutes: [5, 15],
    maxTurns: 10,
  },
  {
    id: 'full',
    name: 'Full Session',
    priceRange: [0.01, 0.01],
    durationMinutes: [15, 45],
    maxTurns: 20,
  },
  {
    id: 'deep',
    name: 'Deep Dive',
    priceRange: [0.01, 0.01],
    durationMinutes: [30, 90],
    maxTurns: 40,
  },
];

export function getSessionTier(tierId: SessionTier): SessionTierDefinition | undefined {
  return SESSION_TIERS.find(t => t.id === tierId);
}

export function getSessionOffering(type: string): SessionOfferingDefinition | undefined {
  return SESSION_OFFERINGS.find(o => o.type === type);
}

export function isOfferingEnabled(type: string): boolean {
  const offering = SESSION_OFFERINGS.find(o => o.type === type);
  return offering?.enabled ?? false;
}

export function getEnabledSessionOfferings(): SessionOfferingDefinition[] {
  return SESSION_OFFERINGS.filter(o => o.enabled);
}
