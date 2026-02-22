import type { Domain, OfferingType, SessionTier } from '../types/index.js';

export interface DomainDefinition {
  id: Domain;
  label: string;
  description: string;
}

export const DOMAINS: DomainDefinition[] = [
  { id: 'crypto', label: 'Crypto/Web3', description: 'Blockchain projects, tokens, DeFi, on-chain activity analysis' },
  { id: 'music', label: 'Music', description: 'Music production, composition, artist authenticity, audio quality' },
  { id: 'art', label: 'Visual Art', description: 'Digital art, NFT art, illustration, graphic design quality' },
  { id: 'design', label: 'Design', description: 'UX/UI design, branding, visual communication' },
  { id: 'narrative', label: 'Narrative/Culture', description: 'Market narratives, cultural trends, meme analysis, zeitgeist' },
  { id: 'community', label: 'Community', description: 'Community health, engagement authenticity, social dynamics' },
  { id: 'general', label: 'General', description: 'Catch-all for questions not fitting other domains' },
];

export interface OfferingDefinition {
  type: OfferingType;
  name: string;
  description: string;
  priceUsdc: number;
  defaultSlaMins: number;
  relevantDomains: Domain[];
}

export const OFFERINGS: OfferingDefinition[] = [
  {
    type: 'vibes_check',
    name: 'Project Vibes Check',
    description: 'Is this crypto project legit, organic, or manufactured?',
    priceUsdc: 1.0,
    defaultSlaMins: 120,
    relevantDomains: ['crypto', 'community'],
  },
  {
    type: 'narrative',
    name: 'Narrative Assessment',
    description: 'Is this market narrative real momentum or manufactured hype?',
    priceUsdc: 0.75,
    defaultSlaMins: 120,
    relevantDomains: ['narrative', 'crypto', 'community'],
  },
  {
    type: 'creative_review',
    name: 'Creative/Art Review',
    description: 'Creative review with compare (pick a winner from 1-4 items) or feedback (actionable improvement suggestions) modes.',
    priceUsdc: 1.5,
    defaultSlaMins: 120,
    relevantDomains: ['music', 'art', 'design'],
  },
  {
    type: 'community_sentiment',
    name: 'Community Sentiment',
    description: "What's the real vibe of this community?",
    priceUsdc: 0.75,
    defaultSlaMins: 120,
    relevantDomains: ['community', 'crypto', 'narrative'],
  },
  {
    type: 'general',
    name: 'General Human Judgment',
    description: 'Any question requiring qualitative human opinion',
    priceUsdc: 0.5,
    defaultSlaMins: 120,
    relevantDomains: ['general', 'crypto', 'music', 'art', 'design', 'narrative', 'community'],
  },
];

export function getOffering(type: OfferingType): OfferingDefinition | undefined {
  return OFFERINGS.find(o => o.type === type);
}

export function getDomainsForOffering(type: OfferingType): Domain[] {
  return getOffering(type)?.relevantDomains ?? ['general'];
}

// ── v1.1 Session Offerings ──

export interface SessionOfferingDefinition {
  type: string;
  name: string;
  description: string;
  defaultTier: SessionTier;
  relevantDomains: Domain[];
}

export const SESSION_OFFERINGS: SessionOfferingDefinition[] = [
  {
    type: 'trust_evaluation',
    name: 'Trust Evaluation',
    description: 'Evaluate the trustworthiness and legitimacy of a project, token, or entity through live expert conversation',
    defaultTier: 'full',
    relevantDomains: ['crypto', 'community'],
  },
  {
    type: 'cultural_context',
    name: 'Cultural Context',
    description: 'Get real-time cultural and contextual insight on trends, narratives, or creative works',
    defaultTier: 'quick',
    relevantDomains: ['narrative', 'community', 'art', 'music'],
  },
  {
    type: 'output_quality_gate',
    name: 'Output Quality Gate',
    description: 'Have an expert review and validate AI-generated outputs in real-time',
    defaultTier: 'quick',
    relevantDomains: ['design', 'art', 'narrative', 'general'],
  },
  {
    type: 'option_ranking',
    name: 'Option Ranking',
    description: 'Expert ranks and compares multiple options with live reasoning',
    defaultTier: 'full',
    relevantDomains: ['general', 'crypto', 'design', 'art', 'music'],
  },
  {
    type: 'blind_spot_check',
    name: 'Blind Spot Check',
    description: 'Expert identifies what an AI might be missing or getting wrong',
    defaultTier: 'quick',
    relevantDomains: ['general', 'crypto', 'narrative', 'community'],
  },
  {
    type: 'human_reaction_prediction',
    name: 'Human Reaction Prediction',
    description: 'Expert predicts how humans will react to content, products, or strategies',
    defaultTier: 'full',
    relevantDomains: ['community', 'narrative', 'design', 'art', 'music'],
  },
  {
    type: 'expert_brainstorming',
    name: 'Expert Brainstorming',
    description: 'Deep collaborative session where expert and AI brainstorm together',
    defaultTier: 'deep',
    relevantDomains: ['general', 'crypto', 'narrative', 'community', 'design', 'art', 'music'],
  },
  {
    type: 'content_quality_gate',
    name: 'Content Quality Gate',
    description: 'Pre-publish review of AI-generated content (video, image, audio) for cultural sensitivity, derivative elements, brand safety, and emotional resonance before distribution',
    defaultTier: 'full',
    relevantDomains: ['art', 'music', 'design', 'narrative', 'community'],
  },
  {
    type: 'audience_reaction_poll',
    name: 'Audience Reaction Poll',
    description: 'Quick crowd poll where multiple humans rate, rank, or score AI-generated content. Fast turnaround, low cost — ideal for A/B testing visuals, thumbnails, or short-form video before publishing',
    defaultTier: 'quick',
    relevantDomains: ['art', 'music', 'design', 'community', 'general'],
  },
  {
    type: 'creative_direction_check',
    name: 'Creative Direction Check',
    description: 'Early-stage review of a creative brief, concept, or storyboard before expensive generation runs. Catch cultural red flags, derivative risks, or tonal mismatches before committing compute',
    defaultTier: 'quick',
    relevantDomains: ['art', 'music', 'design', 'narrative'],
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
    id: 'quick',
    name: 'Quick Consult',
    priceRange: [0.5, 2],
    durationMinutes: [5, 15],
    maxTurns: 10,
  },
  {
    id: 'full',
    name: 'Full Session',
    priceRange: [2, 5],
    durationMinutes: [15, 45],
    maxTurns: 20,
  },
  {
    id: 'deep',
    name: 'Deep Dive',
    priceRange: [5, 15],
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
