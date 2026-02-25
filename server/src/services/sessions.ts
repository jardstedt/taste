import { getDb, generateId, auditLog } from '../db/database.js';
import type {
  Session, ChatMessage, Addon, SessionStatus, SessionTier,
  MessageSenderType, MessageType, AddonType, AddonStatus, Domain,
  SessionDeliverable,
} from '../types/index.js';
import { getSessionTier, getSessionOffering, isOfferingEnabled } from '../config/domains.js';
import { getExpertById, findExpertsForDomain, incrementCompletedJobs } from './experts.js';
import { getExpertReputationScores, recordEvent } from './reputation.js';
import { getSessionAttachments, createSignedUrl } from './storage.js';
import { getEnv } from '../config/env.js';

// ── Row Mapping ──

interface SessionRow {
  id: string;
  job_id: string | null;
  acp_job_id: string | null;
  tier_id: string;
  offering_type: string;
  status: string;
  expert_id: string | null;
  buyer_agent: string | null;
  buyer_agent_display: string | null;
  price_usdc: number;
  expert_payout_usdc: number;
  description: string | null;
  tags: string;
  turn_count: number;
  max_turns: number;
  idle_warned_at: string | null;
  accepted_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  deadline_at: string | null;
  payout_confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

function rowToSession(row: SessionRow): Session {
  return {
    id: row.id,
    jobId: row.job_id,
    acpJobId: row.acp_job_id,
    tierId: row.tier_id as SessionTier,
    offeringType: row.offering_type,
    status: row.status as SessionStatus,
    expertId: row.expert_id,
    buyerAgent: row.buyer_agent,
    buyerAgentDisplay: row.buyer_agent_display,
    priceUsdc: row.price_usdc,
    expertPayoutUsdc: row.expert_payout_usdc,
    description: row.description,
    tags: JSON.parse(row.tags),
    turnCount: row.turn_count,
    maxTurns: row.max_turns,
    idleWarnedAt: row.idle_warned_at,
    acceptedAt: row.accepted_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    deadlineAt: row.deadline_at,
    payoutConfirmedAt: row.payout_confirmed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface MessageRow {
  id: string;
  session_id: string;
  sender_type: string;
  sender_id: string | null;
  content: string;
  message_type: string;
  metadata: string;
  created_at: string;
}

function rowToMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    sessionId: row.session_id,
    senderType: row.sender_type as MessageSenderType,
    senderId: row.sender_id,
    content: row.content,
    messageType: row.message_type as MessageType,
    metadata: JSON.parse(row.metadata),
    createdAt: row.created_at,
  };
}

interface AddonRow {
  id: string;
  session_id: string;
  addon_type: string;
  status: string;
  price_usdc: number;
  description: string | null;
  requested_by: string | null;
  message_id: string | null;
  completed_at: string | null;
  created_at: string;
}

function rowToAddon(row: AddonRow): Addon {
  return {
    id: row.id,
    sessionId: row.session_id,
    addonType: row.addon_type as AddonType,
    status: row.status as AddonStatus,
    priceUsdc: row.price_usdc,
    description: row.description,
    requestedBy: row.requested_by,
    messageId: row.message_id,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}

// ── Session CRUD ──

export function createSession(opts: {
  offeringType: string;
  tierId?: SessionTier;
  description?: string;
  tags?: string[];
  buyerAgent?: string;
  buyerAgentDisplay?: string;
  priceUsdc?: number;
  acpJobId?: string;
  jobId?: string;
}): Session {
  if (!isOfferingEnabled(opts.offeringType)) {
    throw new Error(`Offering "${opts.offeringType}" is currently disabled`);
  }

  const db = getDb();
  const id = generateId();
  const offering = getSessionOffering(opts.offeringType);
  const tierId = opts.tierId ?? offering?.defaultTier ?? 'quick';
  const tier = getSessionTier(tierId);
  const price = opts.priceUsdc ?? (tier ? tier.priceRange[0] : 1);
  const maxTurns = tier?.maxTurns ?? 20;
  const durationMins = tier ? tier.durationMinutes[1] : 30;
  const deadlineAt = new Date(Date.now() + durationMins * 60 * 1000).toISOString();

  db.prepare(
    `INSERT INTO sessions (id, job_id, acp_job_id, tier_id, offering_type, description, tags, buyer_agent, buyer_agent_display, price_usdc, max_turns, deadline_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    opts.jobId ?? null,
    opts.acpJobId ?? null,
    tierId,
    opts.offeringType,
    opts.description ?? null,
    JSON.stringify(opts.tags ?? []),
    opts.buyerAgent ?? null,
    opts.buyerAgentDisplay ?? null,
    price,
    maxTurns,
    deadlineAt,
  );

  auditLog('session', id, 'created', { offeringType: opts.offeringType, tierId, buyerAgent: opts.buyerAgent });

  return getSessionById(id)!;
}

export function getSessionById(id: string): Session | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as SessionRow | undefined;
  return row ? rowToSession(row) : null;
}

export function getSessionByAcpId(acpJobId: string): Session | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM sessions WHERE acp_job_id = ?').get(acpJobId) as SessionRow | undefined;
  return row ? rowToSession(row) : null;
}

export function getSessionsForExpert(expertId: string, status?: string): Session[] {
  const db = getDb();
  let rows: SessionRow[];
  if (status) {
    rows = db.prepare(
      'SELECT * FROM sessions WHERE expert_id = ? AND status = ? ORDER BY created_at DESC',
    ).all(expertId, status) as SessionRow[];
  } else {
    rows = db.prepare(
      'SELECT * FROM sessions WHERE expert_id = ? ORDER BY created_at DESC',
    ).all(expertId) as SessionRow[];
  }
  return rows.map(rowToSession);
}

export function getActiveSessions(): Session[] {
  const db = getDb();
  const rows = db.prepare(
    "SELECT * FROM sessions WHERE status IN ('active', 'wrapping_up') ORDER BY created_at DESC",
  ).all() as SessionRow[];
  return rows.map(rowToSession);
}

export function getPendingSessions(): Session[] {
  const db = getDb();
  const rows = db.prepare(
    "SELECT * FROM sessions WHERE status IN ('pending', 'matching') ORDER BY created_at ASC",
  ).all() as SessionRow[];
  return rows.map(rowToSession);
}

export function getAllSessions(limit = 100): Session[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM sessions ORDER BY created_at DESC LIMIT ?',
  ).all(limit) as SessionRow[];
  return rows.map(rowToSession);
}

// ── Session Lifecycle ──

export function matchSession(sessionId: string): Session | null {
  const session = getSessionById(sessionId);
  if (!session) return null;

  const offering = getSessionOffering(session.offeringType);
  const domains = offering?.relevantDomains ?? ['general'];

  // Gather all candidate experts across relevant domains
  const candidateMap = new Map<string, { expert: ReturnType<typeof getExpertById>; domainScore: number }>();

  for (const domain of domains) {
    const experts = findExpertsForDomain(domain);
    for (const expert of experts) {
      if (!candidateMap.has(expert.id)) {
        candidateMap.set(expert.id, { expert, domainScore: 0 });
      }
      // More relevant domains = higher domain score
      candidateMap.get(expert.id)!.domainScore += 1;
    }
  }

  if (candidateMap.size === 0) {
    updateSessionStatus(sessionId, 'matching');
    return getSessionById(sessionId);
  }

  // Weighted scoring: domain 40%, availability 30%, reputation 20%, load 10%
  const db = getDb();
  let bestExpertId: string | null = null;
  let bestScore = -1;

  for (const [expertId, { expert, domainScore }] of candidateMap) {
    if (!expert) continue;
    if (expert.deactivatedAt) continue;

    // Domain match: normalized 0-1
    const domainNorm = domainScore / domains.length;

    // Availability: online=1, busy=0.3, offline=0
    const availScore = expert.availability === 'online' ? 1 : expert.availability === 'busy' ? 0.3 : 0;

    // Reputation: average across relevant domains, normalized 0-1
    const repScores = getExpertReputationScores(expertId);
    const repValues = domains.map(d => repScores[d] ?? 50);
    const repAvg = repValues.reduce((a, b) => a + b, 0) / repValues.length;
    const repNorm = repAvg / 100;

    // Load: inverse of active session count
    const activeCount = (db.prepare(
      "SELECT COUNT(*) as cnt FROM sessions WHERE expert_id = ? AND status IN ('active', 'wrapping_up')",
    ).get(expertId) as { cnt: number }).cnt;
    const loadNorm = 1 / (1 + activeCount);

    const totalScore = (domainNorm * 0.4) + (availScore * 0.3) + (repNorm * 0.2) + (loadNorm * 0.1);

    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestExpertId = expertId;
    }
  }

  if (bestExpertId) {
    db.prepare(
      "UPDATE sessions SET expert_id = ?, status = 'matching', updated_at = datetime('now') WHERE id = ?",
    ).run(bestExpertId, sessionId);
    auditLog('session', sessionId, 'matched', { expertId: bestExpertId, score: bestScore });
  }

  return getSessionById(sessionId);
}

export function acceptSession(sessionId: string, expertId: string): Session | null {
  const session = getSessionById(sessionId);
  if (!session) return null;
  if (session.status !== 'pending' && session.status !== 'matching') return null;
  // If session is already assigned to a specific expert, only that expert can accept
  if (session.expertId && session.expertId !== expertId) return null;

  const db = getDb();
  const tier = getSessionTier(session.tierId);
  const durationMins = tier ? tier.durationMinutes[1] : 30;
  const deadlineAt = new Date(Date.now() + durationMins * 60 * 1000).toISOString();

  db.prepare(
    `UPDATE sessions SET expert_id = ?, status = 'accepted', accepted_at = datetime('now'), deadline_at = ?, updated_at = datetime('now') WHERE id = ?`,
  ).run(expertId, deadlineAt, sessionId);

  auditLog('session', sessionId, 'accepted', { expertId });

  return getSessionById(sessionId);
}

export function startSession(sessionId: string): Session | null {
  const session = getSessionById(sessionId);
  if (!session) return null;
  if (session.status !== 'accepted') return null;

  const db = getDb();
  db.prepare(
    "UPDATE sessions SET status = 'active', started_at = datetime('now'), updated_at = datetime('now') WHERE id = ?",
  ).run(sessionId);

  auditLog('session', sessionId, 'started');

  // Add system message
  addMessage(sessionId, 'system', null, 'Session started. The expert is now available for conversation.', 'system_notice');

  return getSessionById(sessionId);
}

export function completeSession(sessionId: string): Session | null {
  const session = getSessionById(sessionId);
  if (!session) return null;

  const db = getDb();
  const expertPayout = session.priceUsdc * 0.8 * 0.75;

  // Atomic conditional update — prevents race between complete and timeout
  const result = db.prepare(
    "UPDATE sessions SET status = 'completed', expert_payout_usdc = ?, completed_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND status IN ('active', 'wrapping_up')",
  ).run(expertPayout, sessionId);

  if (result.changes === 0) return null; // Already transitioned by another path

  addMessage(sessionId, 'system', null, 'Session completed. Thank you for your expertise.', 'system_notice');
  auditLog('session', sessionId, 'completed', { expertPayout });

  // For local sessions (no ACP), confirm payout immediately.
  // ACP sessions get payout confirmed after on-chain COMPLETED phase.
  if (!session.acpJobId) {
    confirmSessionPayout(sessionId);
  }

  return getSessionById(sessionId);
}

/**
 * Confirm expert payout after ACP delivery is verified.
 * Atomically guarded — safe to call multiple times (idempotent).
 */
export function confirmSessionPayout(sessionId: string): boolean {
  const db = getDb();

  // Atomic: only confirm once (prevents double-credit from polling + WebSocket)
  const result = db.prepare(
    "UPDATE sessions SET payout_confirmed_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND status = 'completed' AND payout_confirmed_at IS NULL",
  ).run(sessionId);

  if (result.changes === 0) return false;

  const session = getSessionById(sessionId)!;
  if (!session.expertId || session.expertPayoutUsdc <= 0) return false;

  const startedAt = session.startedAt ? new Date(session.startedAt).getTime() : Date.now();
  const responseTimeMins = (Date.now() - startedAt) / 60_000;
  incrementCompletedJobs(session.expertId, responseTimeMins, session.expertPayoutUsdc);

  // Reputation event
  const offering = getSessionOffering(session.offeringType);
  const expert = getExpertById(session.expertId);
  if (offering && expert) {
    for (const domain of offering.relevantDomains) {
      if (expert.domains.includes(domain)) {
        recordEvent(session.expertId, domain, 'job_completed', undefined, 'Session completed');
        break;
      }
    }
  }

  auditLog('session', sessionId, 'payout_confirmed', { expertPayout: session.expertPayoutUsdc, expertId: session.expertId });
  return true;
}

export function cancelSession(sessionId: string, reason?: string): Session | null {
  const session = getSessionById(sessionId);
  if (!session) return null;

  const db = getDb();
  // Atomic: only cancel from non-terminal states
  const result = db.prepare(
    "UPDATE sessions SET status = 'cancelled', completed_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND status NOT IN ('completed', 'cancelled', 'timeout')",
  ).run(sessionId);

  if (result.changes === 0) return null;

  addMessage(sessionId, 'system', null, `Session cancelled${reason ? ': ' + reason : ''}.`, 'system_notice');
  auditLog('session', sessionId, 'cancelled', { reason });

  return getSessionById(sessionId);
}

export function timeoutSession(sessionId: string): Session | null {
  const session = getSessionById(sessionId);
  if (!session) return null;

  const db = getDb();

  // Check who was idle — only penalize expert if they were the one not responding
  const lastMsg = getLatestMessage(sessionId);
  const expertWasIdle = !lastMsg || lastMsg.senderType === 'agent' || lastMsg.senderType === 'system';

  // Atomic conditional update — prevents race between timeout and complete
  const result = db.prepare(
    "UPDATE sessions SET status = 'timeout', expert_payout_usdc = 0, completed_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND status IN ('active', 'wrapping_up')",
  ).run(sessionId);

  if (result.changes === 0) return null; // Already transitioned by another path

  if (expertWasIdle) {
    // Expert didn't respond — reputation penalty
    if (session.expertId) {
      const offering = getSessionOffering(session.offeringType);
      const expert = getExpertById(session.expertId);
      if (offering && expert) {
        for (const domain of offering.relevantDomains) {
          if (expert.domains.includes(domain)) {
            recordEvent(session.expertId, domain, 'timeout', undefined, 'Session timed out due to expert inactivity');
            break;
          }
        }
      }
    }
    addMessage(sessionId, 'system', null, 'Session timed out due to expert inactivity.', 'system_notice');
  } else {
    // Expert was waiting on the agent — no reputation penalty
    addMessage(sessionId, 'system', null, 'Session timed out — agent stopped responding.', 'system_notice');
  }

  auditLog('session', sessionId, 'timeout', { expertId: session.expertId, expertWasIdle });

  return getSessionById(sessionId);
}

export function declineSession(sessionId: string, reason?: string): Session | null {
  const session = getSessionById(sessionId);
  if (!session) return null;

  const db = getDb();

  // Atomic: only decline from active states
  const result = db.prepare(
    "UPDATE sessions SET status = 'cancelled', expert_payout_usdc = 0, completed_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND status IN ('active', 'wrapping_up', 'accepted')",
  ).run(sessionId);

  if (result.changes === 0) return null;

  addMessage(sessionId, 'system', null,
    `Expert declined to fulfill this request${reason ? ': ' + reason : ''}. Agent will be refunded.`,
    'system_notice');

  auditLog('session', sessionId, 'declined', { expertId: session.expertId, reason });

  return getSessionById(sessionId);
}

function updateSessionStatus(sessionId: string, status: SessionStatus): void {
  const db = getDb();
  db.prepare(
    "UPDATE sessions SET status = ?, updated_at = datetime('now') WHERE id = ?",
  ).run(status, sessionId);
}

// ── Messages ──

export function addMessage(
  sessionId: string,
  senderType: MessageSenderType,
  senderId: string | null,
  content: string,
  messageType: MessageType = 'text',
  metadata: Record<string, unknown> = {},
): ChatMessage {
  const db = getDb();
  const id = generateId();

  db.prepare(
    `INSERT INTO messages (id, session_id, sender_type, sender_id, content, message_type, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, sessionId, senderType, senderId, content, messageType, JSON.stringify(metadata));

  // Auto-start session on first non-system message if accepted
  const session = getSessionById(sessionId);
  if (session && session.status === 'accepted' && senderType !== 'system') {
    startSession(sessionId);
  }

  return getMessageById(id)!;
}

export function getMessages(sessionId: string, limit = 200): ChatMessage[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC LIMIT ?',
  ).all(sessionId, limit) as MessageRow[];
  return rows.map(rowToMessage);
}

export function getMessageById(id: string): ChatMessage | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as MessageRow | undefined;
  return row ? rowToMessage(row) : null;
}

export function getLatestMessage(sessionId: string): ChatMessage | null {
  const db = getDb();
  const row = db.prepare(
    'SELECT * FROM messages WHERE session_id = ? ORDER BY created_at DESC LIMIT 1',
  ).get(sessionId) as MessageRow | undefined;
  return row ? rowToMessage(row) : null;
}

// ── Add-ons ──

export function createAddon(
  sessionId: string,
  addonType: AddonType,
  priceUsdc: number,
  description?: string,
  requestedBy?: string,
): Addon {
  const db = getDb();
  const id = generateId();

  db.prepare(
    `INSERT INTO addons (id, session_id, addon_type, price_usdc, description, requested_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, sessionId, addonType, priceUsdc, description ?? null, requestedBy ?? null);

  // Add a message about the addon request
  const msg = addMessage(
    sessionId, 'system', null,
    `Add-on requested: ${addonType.replace(/_/g, ' ')} ($${priceUsdc} USDC)${description ? ' — ' + description : ''}`,
    'addon_request',
    { addonId: id, addonType, priceUsdc },
  );

  // Link message to addon
  db.prepare('UPDATE addons SET message_id = ? WHERE id = ?').run(msg.id, id);

  auditLog('addon', id, 'created', { sessionId, addonType, priceUsdc });

  return getAddonById(id)!;
}

export function respondToAddon(addonId: string, accepted: boolean, expertId: string): Addon | null {
  const addon = getAddonById(addonId);
  if (!addon || addon.status !== 'pending') return null;

  const db = getDb();
  const newStatus: AddonStatus = accepted ? 'accepted' : 'declined';

  db.prepare(
    "UPDATE addons SET status = ?, completed_at = datetime('now') WHERE id = ?",
  ).run(newStatus, addonId);

  // Update session price if accepted
  if (accepted) {
    db.prepare(
      "UPDATE sessions SET price_usdc = price_usdc + ?, updated_at = datetime('now') WHERE id = ?",
    ).run(addon.priceUsdc, addon.sessionId);

    // Extend deadline by 15 minutes for extended_time addon
    if (addon.addonType === 'extended_time') {
      const session = getSessionById(addon.sessionId);
      if (session) {
        const currentDeadline = session.deadlineAt ? new Date(session.deadlineAt).getTime() : Date.now();
        const newDeadline = new Date(currentDeadline + 15 * 60 * 1000).toISOString();
        db.prepare(
          "UPDATE sessions SET deadline_at = ?, updated_at = datetime('now') WHERE id = ?",
        ).run(newDeadline, addon.sessionId);
      }
    }
  }

  addMessage(
    addon.sessionId, 'system', null,
    `Add-on ${addonId.slice(0, 8)} ${accepted ? 'accepted' : 'declined'} by expert.`,
    'addon_response',
    { addonId, accepted },
  );

  auditLog('addon', addonId, accepted ? 'accepted' : 'declined', { expertId });

  return getAddonById(addonId);
}

export function getAddons(sessionId: string): Addon[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM addons WHERE session_id = ? ORDER BY created_at ASC',
  ).all(sessionId) as AddonRow[];
  return rows.map(rowToAddon);
}

function getAddonById(id: string): Addon | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM addons WHERE id = ?').get(id) as AddonRow | undefined;
  return row ? rowToAddon(row) : null;
}

// ── Guardrails ──

const GRACE_TURNS = 5;

export function incrementTurnCount(sessionId: string, senderType: MessageSenderType): { turnCount: number; maxTurns: number; limitReached: boolean; locked: boolean } {
  const db = getDb();

  // Only increment when the sender alternates (agent→expert or expert→agent)
  // This prevents gaming by spamming messages from one side
  const prevMsg = db.prepare(
    "SELECT sender_type FROM messages WHERE session_id = ? AND sender_type IN ('agent', 'expert') ORDER BY created_at DESC LIMIT 1 OFFSET 1",
  ).get(sessionId) as { sender_type: string } | undefined;

  const shouldIncrement = !prevMsg || prevMsg.sender_type !== senderType;

  if (shouldIncrement) {
    db.prepare(
      "UPDATE sessions SET turn_count = turn_count + 1, updated_at = datetime('now') WHERE id = ?",
    ).run(sessionId);
  } else {
    db.prepare(
      "UPDATE sessions SET updated_at = datetime('now') WHERE id = ?",
    ).run(sessionId);
  }

  const session = getSessionById(sessionId)!;
  const limitReached = session.turnCount >= session.maxTurns;
  const locked = session.turnCount >= session.maxTurns + GRACE_TURNS;

  // System messages at key thresholds
  if (shouldIncrement && session.turnCount === session.maxTurns) {
    addMessage(sessionId, 'system', null,
      `Turn limit reached. You have ${GRACE_TURNS} more turns to wrap up, or request an extension.`,
      'system_notice');
  } else if (shouldIncrement && locked) {
    addMessage(sessionId, 'system', null,
      'Grace period exhausted. Please complete the session or request an extension.',
      'system_notice');
  }

  return { turnCount: session.turnCount, maxTurns: session.maxTurns, limitReached, locked };
}

export function checkSessionTimeouts(): number {
  const db = getDb();
  const now = new Date().toISOString();

  const expiredSessions = db.prepare(
    "SELECT * FROM sessions WHERE status IN ('pending', 'matching', 'accepted', 'active', 'wrapping_up') AND deadline_at < ?",
  ).all(now) as SessionRow[];

  for (const row of expiredSessions) {
    const session = rowToSession(row);
    if (session.status === 'pending' || session.status === 'matching') {
      cancelSession(session.id, 'No expert available — session expired');
    } else if (session.status === 'accepted') {
      cancelSession(session.id, 'Expert did not start the session in time');
    } else {
      timeoutSession(session.id);
    }
  }

  return expiredSessions.length;
}

// ── Structured Deliverables ──

interface DeliverableRow {
  id: string;
  session_id: string;
  offering_type: string;
  structured_data: string;
  summary: string | null;
  created_at: string;
  updated_at: string;
}

function rowToDeliverable(row: DeliverableRow): SessionDeliverable {
  return {
    id: row.id,
    sessionId: row.session_id,
    offeringType: row.offering_type,
    structuredData: JSON.parse(row.structured_data),
    summary: row.summary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function saveDeliverable(
  sessionId: string,
  offeringType: string,
  structuredData: Record<string, unknown>,
  summary?: string,
): SessionDeliverable {
  const db = getDb();
  const id = generateId();

  db.prepare(
    `INSERT INTO session_deliverables (id, session_id, offering_type, structured_data, summary)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(session_id) DO UPDATE SET
       structured_data = excluded.structured_data,
       summary = excluded.summary,
       updated_at = datetime('now')`,
  ).run(id, sessionId, offeringType, JSON.stringify(structuredData), summary ?? null);

  return getDeliverable(sessionId)!;
}

export function getDeliverable(sessionId: string): SessionDeliverable | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM session_deliverables WHERE session_id = ?').get(sessionId) as DeliverableRow | undefined;
  return row ? rowToDeliverable(row) : null;
}

// ── Deliverable Formatting ──

// Checklist items per offering — must match dashboard OFFERING_CHECKLIST
const OFFERING_REQUIREMENTS: Record<string, string[]> = {
  trust_evaluation: ['Assess project legitimacy', 'Check community authenticity', 'Review team/partnership claims', 'Provide trust verdict'],
  cultural_context: ['Provide cultural context', 'Assess trend authenticity', 'Share relevant domain insights'],
  output_quality_gate: ['Review AI output quality', 'Check for errors or issues', 'Suggest improvements'],
  option_ranking: ['Compare all options', 'Rank with reasoning', 'Provide recommendation'],
  blind_spot_check: ['Identify gaps in AI analysis', 'Flag risks or blind spots', 'Provide expert perspective'],
  human_reaction_prediction: ['Predict audience reaction', 'Identify emotional triggers', 'Assess cultural fit'],
  expert_brainstorming: ['Explore creative angles', 'Challenge assumptions', 'Synthesize insights'],
  content_quality_gate: ['Review for cultural sensitivity', 'Check for derivative elements', 'Assess brand safety', 'Evaluate emotional resonance'],
  audience_reaction_poll: ['Rate content quality', 'Score against criteria', 'Provide comparison notes'],
  creative_direction_check: ['Review concept viability', 'Flag cultural red flags', 'Assess tonal alignment'],
};

export function formatSessionDeliverable(sessionId: string): Record<string, unknown> {
  const session = getSessionById(sessionId);
  if (!session) return {};

  const messages = getMessages(sessionId);
  const addons = getAddons(sessionId);
  const expert = session.expertId ? getExpertById(session.expertId) : null;
  const offering = getSessionOffering(session.offeringType);

  const transcript = messages
    .filter(m => m.messageType === 'text' || m.messageType === 'file')
    .map(m => ({
      role: m.senderType,
      content: m.content,
      timestamp: m.createdAt,
    }));

  // Extract expert-only messages for evaluation summary
  const expertMessages = messages
    .filter(m => m.senderType === 'expert' && m.messageType === 'text')
    .map(m => m.content);

  const requirements = OFFERING_REQUIREMENTS[session.offeringType] ?? [];

  // Check for structured deliverable
  const deliverable = getDeliverable(sessionId);

  // Generate signed URLs for attachments
  const attachments = getSessionAttachments(sessionId);
  const env = getEnv();
  const baseUrl = (env as Record<string, string>).BASE_URL || env.CORS_ORIGIN;
  const attachmentUrls = attachments.map(a => ({
    filename: a.originalFilename,
    mimeType: a.mimeType,
    url: createSignedUrl(a.id, baseUrl),
    context: a.uploadContext,
  }));

  // Use structured summary if available, otherwise fall back to last expert message
  const summary = deliverable?.summary
    ?? (expertMessages.length > 0 ? expertMessages[expertMessages.length - 1].slice(0, 500) : null);

  return {
    sessionId: session.id,
    offeringType: session.offeringType,
    offeringName: offering?.name ?? session.offeringType,
    tier: session.tierId,
    status: session.status,

    // What was requested
    request: {
      description: session.description,
      requirements,
      offeringDescription: offering?.description ?? null,
    },

    // What was delivered — structured assessment (primary) or transcript-based (fallback)
    structuredAssessment: deliverable ? deliverable.structuredData : null,
    result: {
      expertResponseCount: expertMessages.length,
      expertWordCount: expertMessages.join(' ').split(/\s+/).length,
      summary,
    },

    // Attachments (signed URLs for ACP agents)
    attachments: attachmentUrls.length > 0 ? attachmentUrls : null,

    // Full conversation
    transcript,
    turnCount: session.turnCount,
    maxTurns: session.maxTurns,

    addons: addons.map(a => ({
      type: a.addonType,
      status: a.status,
      price: a.priceUsdc,
    })),
    expert: expert ? {
      name: expert.name,
      publicProfile: expert.consentToPublicProfile ? `/api/public/experts/${expert.id}` : null,
    } : null,
    totalPrice: session.priceUsdc,
    duration: session.startedAt && session.completedAt
      ? Math.round((new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime()) / 60_000)
      : null,
    disclaimer: 'This is a qualitative human opinion provided for informational purposes only. It does not constitute financial, investment, legal, or professional advice.',

    // Evaluation hint for ACP evaluators
    evaluationCriteria: deliverable
      ? `The expert provided a structured assessment with the following fields: ${Object.keys(deliverable.structuredData).join(', ')}. Verify these fields are substantive and address the "${offering?.name ?? session.offeringType}" requirements: ${requirements.join('; ')}.`
      : `Verify the expert addressed the following requirements for a "${offering?.name ?? session.offeringType}" session: ${requirements.join('; ')}. The expert's responses should be substantive and relevant to the request description.`,
  };
}
