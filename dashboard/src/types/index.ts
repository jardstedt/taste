export type Domain = 'crypto' | 'music' | 'art' | 'design' | 'narrative' | 'community' | 'general';

export type OfferingType = 'vibes_check' | 'narrative' | 'creative_review' | 'community_sentiment' | 'general';

export type ExpertRole = 'admin' | 'expert';

export type Availability = 'online' | 'offline' | 'busy';

export type JobStatus = 'pending' | 'assigned' | 'in_progress' | 'delivered' | 'rejected' | 'timeout';

export interface ExpertCredentials {
  bio?: string;
  profileImageUrl?: string;
  twitterHandle?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  location?: string;
  tagline?: string;
}

export interface PublicStats {
  totalExperts: number;
  totalJudgments: number;
  domains: string[];
  avgResponseMins: number;
}

export type WalletChain = 'base' | 'ethereum';

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

export interface ReputationEvent {
  id: string;
  expertId: string;
  domain: string;
  eventType: string;
  scoreChange: number;
  jobId: string | null;
  reason: string | null;
  createdAt: string;
}

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

export interface AuthUser {
  expertId: string;
  name: string;
  email: string;
  role: ExpertRole;
  domains: Domain[];
  credentials: ExpertCredentials;
  availability: Availability;
  consentToPublicProfile: boolean;
  agreementAcceptedAt: string | null;
  completedJobs: number;
  earningsUsdc: number;
  walletAddress: string | null;
  walletChain: WalletChain;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  details?: string[];
}

export const OFFERING_LABELS: Record<OfferingType, string> = {
  vibes_check: 'Project Vibes Check',
  narrative: 'Narrative Assessment',
  creative_review: 'Creative/Art Review',
  community_sentiment: 'Community Sentiment',
  general: 'General Human Judgment',
};

export const PROHIBITED_PHRASES = [
  'buy', 'sell', 'invest in', 'financial advice', 'guaranteed returns',
  'should purchase', 'should invest', 'price target', 'price prediction',
  'allocation advice', 'not financial advice',
];

// ── v1.1 Session Types ──

export type SessionTier = 'quick' | 'full' | 'deep';

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

export const SESSION_TIER_LABELS: Record<SessionTier, string> = {
  quick: 'Quick Consult',
  full: 'Full Session',
  deep: 'Deep Dive',
};
