export type Domain = 'crypto' | 'music' | 'art' | 'design' | 'narrative' | 'community' | 'general';

export type ExpertRole = 'admin' | 'expert';

export type Availability = 'online' | 'offline' | 'busy';

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
  totalSessions: number;
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
  deactivatedAt: string | null;
  reputationScores: Record<string, number>;
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

// ── v1.1 Session Types ──

export type SessionTier = 'test' | 'quick' | 'full' | 'deep';

export type SessionStatus = 'pending' | 'matching' | 'accepted' | 'active' | 'wrapping_up' | 'completed' | 'cancelled' | 'timeout';

export type MessageSenderType = 'agent' | 'expert' | 'system';

export type MessageType = 'text' | 'addon_request' | 'addon_response' | 'system_notice' | 'summary' | 'image' | 'file';

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
  paymentReceivedAt: string | null;
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

export interface SessionAttachment {
  id: string;
  sessionId: string;
  originalFilename: string;
  storedFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  uploadContext: 'chat' | 'completion';
  uploaderId: string;
  messageId: string | null;
  createdAt: string;
}

export const SESSION_TIER_LABELS: Record<SessionTier, string> = {
  test: 'Test',
  quick: 'Quick Consult',
  full: 'Full Session',
  deep: 'Deep Dive',
};
