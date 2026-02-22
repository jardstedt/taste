// ── Domain Types ──

export type Domain = 'crypto' | 'music' | 'art' | 'design' | 'narrative' | 'community' | 'general';

export type OfferingType = 'vibes_check' | 'narrative' | 'creative_review' | 'community_sentiment' | 'general';

export type ExpertRole = 'admin' | 'expert';

export type Availability = 'online' | 'offline' | 'busy';

export type JobStatus = 'pending' | 'assigned' | 'in_progress' | 'delivered' | 'rejected' | 'timeout';

// ── Expert ──

export interface ExpertCredentials {
  bio?: string;
  profileImageUrl?: string;
  twitterHandle?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  location?: string;
  tagline?: string;
}

export type WalletChain = 'base' | 'ethereum';

export interface Expert {
  id: string;
  name: string;
  emailEncrypted: string;
  passwordHash: string | null;
  role: ExpertRole;
  domains: Domain[];
  credentials: ExpertCredentials;
  availability: Availability;
  consentToPublicProfile: boolean;
  agreementAcceptedAt: string | null;
  completedJobs: number;
  avgResponseTimeMins: number;
  earningsUsdc: number;
  walletAddress: string | null;
  walletChain: WalletChain;
  createdAt: string;
  updatedAt: string;
}

export interface ExpertPublic {
  id: string;
  name: string;
  role: ExpertRole;
  domains: Domain[];
  credentials: ExpertCredentials;
  availability: Availability;
  consentToPublicProfile: boolean;
  agreementAcceptedAt: string | null;
  completedJobs: number;
  avgResponseTimeMins: number;
  earningsUsdc: number;
  walletAddress: string | null;
  walletChain: WalletChain;
  reputationScores: Record<string, number>;
}

// ── Job ──

export interface Job {
  id: string;
  acpJobId: string | null;
  offeringType: OfferingType;
  status: JobStatus;
  expertId: string | null;
  requirements: Record<string, unknown>;
  buyerAgent: string | null;
  priceUsdc: number;
  slaMinutes: number;
  assignedAt: string | null;
  deadlineAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Judgment ──

export interface Judgment {
  id: string;
  jobId: string;
  expertId: string;
  offeringType: OfferingType;
  content: Record<string, unknown>;
  disclaimer: string;
  expertName: string;
  expertPublicProfile: string | null;
  submittedAt: string;
}

// ── Reputation ──

export type ReputationEventType = 'job_completed' | 'positive_feedback' | 'timeout' | 'rejected';

export interface ReputationEvent {
  id: string;
  expertId: string;
  domain: string;
  eventType: ReputationEventType;
  scoreChange: number;
  jobId: string | null;
  reason: string | null;
  createdAt: string;
}

export interface ReputationScore {
  expertId: string;
  domain: string;
  score: number;
}

// ── Audit ──

export interface AuditEntry {
  id: number;
  entityType: string;
  entityId: string;
  action: string;
  details: Record<string, unknown> | null;
  performedBy: string | null;
  createdAt: string;
}

// ── ACP Offering Requirements/Deliverables ──

export interface VibesCheckRequirements {
  projectName: string;
  tokenAddress?: string;
  socialLinks?: string[];
  specificQuestion?: string;
}

export interface VibesCheckDeliverable {
  verdict: 'genuine' | 'suspicious' | 'manufactured' | 'mixed';
  confidence: number;
  reasoning: string;
  redFlags: string[];
  positiveSignals: string[];
  expertDomain: string;
}

export interface NarrativeRequirements {
  narrative: string;
  context?: string;
  relatedTokens?: string[];
}

export interface NarrativeDeliverable {
  verdict: string;
  confidence: number;
  reasoning: string;
  timeHorizon: string;
  catalysts: string[];
}

export interface CreativeReviewRequirements {
  contentUrl?: string;
  contentUrls?: string[];
  contentType: 'music' | 'visual' | 'writing' | 'design';
  reviewType?: 'compare' | 'feedback';
  context?: string;
}

export interface CreativeReviewDeliverable {
  verdict: string;
  qualityScore: number;
  originality: string;
  technicalMerit: string;
  reasoning: string;
}

export interface CreativeReviewCompareDeliverable {
  winner: string;
  rankings: string[];
  comparisonNotes: string;
  reasoning: string;
}

export interface CreativeReviewFeedbackDeliverable {
  verdict: string;
  qualityScore: number;
  originality: string;
  technicalMerit: string;
  reasoning: string;
  improvements?: string[];
}

export interface CommunitySentimentRequirements {
  community: string;
  platforms?: string[];
  timeframe?: string;
}

export interface CommunitySentimentDeliverable {
  sentiment: string;
  authenticity: string;
  activityLevel: string;
  reasoning: string;
  comparisons: string[];
}

export interface GeneralJudgmentRequirements {
  question: string;
  domain: string;
  context?: string;
  urgency?: 'standard' | 'rush';
}

export interface GeneralJudgmentDeliverable {
  answer: string;
  confidence: number;
  reasoning: string;
  caveats: string[];
}

// ── v1.1 Session Types ──

export type SessionTier = 'quick' | 'full' | 'deep';

export type SessionOfferingType =
  | 'trust_evaluation'
  | 'cultural_context'
  | 'output_quality_gate'
  | 'option_ranking'
  | 'blind_spot_check'
  | 'human_reaction_prediction'
  | 'expert_brainstorming'
  | 'content_quality_gate'
  | 'audience_reaction_poll'
  | 'creative_direction_check';

export type SessionStatus = 'pending' | 'matching' | 'accepted' | 'active' | 'wrapping_up' | 'completed' | 'cancelled' | 'timeout';

export type MessageSenderType = 'agent' | 'expert' | 'system';

export type MessageType = 'text' | 'addon_request' | 'addon_response' | 'system_notice' | 'summary' | 'image';

export type AddonType = 'screenshot' | 'extended_time' | 'written_report' | 'second_opinion' | 'image_upload' | 'follow_up' | 'crowd_poll';

export type AddonStatus = 'pending' | 'accepted' | 'declined' | 'completed';

export interface Session {
  id: string;
  jobId: string | null;
  acpJobId: string | null;
  tierId: SessionTier;
  offeringType: string;
  status: SessionStatus;
  expertId: string | null;
  buyerAgent: string | null;
  buyerAgentDisplay: string | null;
  priceUsdc: number;
  expertPayoutUsdc: number;
  description: string | null;
  tags: string[];
  turnCount: number;
  maxTurns: number;
  idleWarnedAt: string | null;
  acceptedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  deadlineAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  senderType: MessageSenderType;
  senderId: string | null;
  content: string;
  messageType: MessageType;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface Addon {
  id: string;
  sessionId: string;
  addonType: AddonType;
  status: AddonStatus;
  priceUsdc: number;
  description: string | null;
  requestedBy: string | null;
  messageId: string | null;
  completedAt: string | null;
  createdAt: string;
}

// ── API Types ──

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthPayload {
  expertId: string;
  role: ExpertRole;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ── Withdrawals ──

export type WithdrawalStatus = 'pending' | 'approved' | 'processing' | 'completed' | 'rejected';

export interface Withdrawal {
  id: string;
  expertId: string;
  amountUsdc: number;
  status: WithdrawalStatus;
  walletAddress: string;
  walletChain: WalletChain;
  txHash: string | null;
  adminNotes: string | null;
  requestedAt: string;
  processedAt: string | null;
  completedAt: string | null;
}

// ── Disclaimer ──

export const JUDGMENT_DISCLAIMER = 'This is a qualitative human opinion provided for informational purposes only. It does not constitute financial, investment, legal, or professional advice. The requesting party assumes all risk for decisions made based on this opinion.';

// ── Prohibited Language ──

export const PROHIBITED_PHRASES = [
  'buy',
  'sell',
  'invest in',
  'financial advice',
  'guaranteed returns',
  'should purchase',
  'should invest',
  'price target',
  'price prediction',
  'allocation advice',
  'not financial advice',
];
