import { getDb, generateId, auditLog } from '../db/database.js';
import type {
  Session, ChatMessage, Addon, SessionStatus, SessionTier,
  MessageSenderType, MessageType, AddonType, AddonStatus, Domain,
} from '../types/index.js';
import { getSessionTier, getSessionOffering, getDomainsForOffering } from '../config/domains.js';
import { getExpertById, findExpertsForDomain, incrementCompletedJobs } from './experts.js';
import { getExpertReputationScores, recordEvent } from './reputation.js';

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
  const domains = offering?.relevantDomains ?? getDomainsForOffering(session.offeringType as any);

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
  if (session.status !== 'active' && session.status !== 'wrapping_up') return null;

  const db = getDb();
  // Calculate expert payout: 80% from ACP, then 75% of that to expert
  const expertPayout = session.priceUsdc * 0.8 * 0.75;

  db.prepare(
    "UPDATE sessions SET status = 'completed', expert_payout_usdc = ?, completed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?",
  ).run(expertPayout, sessionId);

  // Update expert earnings
  if (session.expertId) {
    const startedAt = session.startedAt ? new Date(session.startedAt).getTime() : Date.now();
    const responseTimeMins = (Date.now() - startedAt) / 60_000;
    incrementCompletedJobs(session.expertId, responseTimeMins, expertPayout);

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
  }

  addMessage(sessionId, 'system', null, 'Session completed. Thank you for your expertise.', 'system_notice');

  auditLog('session', sessionId, 'completed', { expertPayout });

  return getSessionById(sessionId);
}

export function cancelSession(sessionId: string, reason?: string): Session | null {
  const session = getSessionById(sessionId);
  if (!session) return null;
  if (session.status === 'completed' || session.status === 'cancelled') return null;

  const db = getDb();
  db.prepare(
    "UPDATE sessions SET status = 'cancelled', completed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?",
  ).run(sessionId);

  addMessage(sessionId, 'system', null, `Session cancelled${reason ? ': ' + reason : ''}.`, 'system_notice');
  auditLog('session', sessionId, 'cancelled', { reason });

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

export function incrementTurnCount(sessionId: string): { turnCount: number; maxTurns: number; wrappingUp: boolean } {
  const db = getDb();
  db.prepare(
    "UPDATE sessions SET turn_count = turn_count + 1, idle_warned_at = NULL, updated_at = datetime('now') WHERE id = ?",
  ).run(sessionId);

  const session = getSessionById(sessionId)!;

  if (session.turnCount >= session.maxTurns && session.status === 'active') {
    db.prepare(
      "UPDATE sessions SET status = 'wrapping_up', updated_at = datetime('now') WHERE id = ?",
    ).run(sessionId);
    addMessage(sessionId, 'system', null, 'Turn limit reached. Please wrap up the conversation.', 'system_notice');
    return { turnCount: session.turnCount, maxTurns: session.maxTurns, wrappingUp: true };
  }

  return { turnCount: session.turnCount, maxTurns: session.maxTurns, wrappingUp: false };
}

export function checkIdleSession(sessionId: string): 'ok' | 'warned' | 'closed' {
  const session = getSessionById(sessionId);
  if (!session || session.status !== 'active') return 'ok';

  const lastMsg = getLatestMessage(sessionId);
  if (!lastMsg) return 'ok';

  const lastMsgTime = new Date(lastMsg.createdAt).getTime();
  const now = Date.now();
  const idleMs = now - lastMsgTime;

  const WARN_THRESHOLD = 3 * 60 * 1000; // 3 minutes
  const CLOSE_THRESHOLD = 5 * 60 * 1000; // 5 minutes after warning

  if (session.idleWarnedAt) {
    const warnedAt = new Date(session.idleWarnedAt).getTime();
    if (now - warnedAt > CLOSE_THRESHOLD) {
      completeSession(sessionId);
      return 'closed';
    }
  } else if (idleMs > WARN_THRESHOLD) {
    const db = getDb();
    db.prepare(
      "UPDATE sessions SET idle_warned_at = datetime('now'), updated_at = datetime('now') WHERE id = ?",
    ).run(sessionId);
    addMessage(sessionId, 'system', null, 'This session has been idle. It will auto-close in 5 minutes if no messages are sent.', 'system_notice');
    return 'warned';
  }

  return 'ok';
}

export function checkSessionTimeouts(): number {
  const db = getDb();
  const now = new Date().toISOString();

  const expiredSessions = db.prepare(
    "SELECT * FROM sessions WHERE status IN ('active', 'wrapping_up', 'accepted') AND deadline_at < ?",
  ).all(now) as SessionRow[];

  for (const row of expiredSessions) {
    const session = rowToSession(row);
    if (session.status === 'accepted') {
      cancelSession(session.id, 'Session expired before starting');
    } else {
      completeSession(session.id);
    }
  }

  return expiredSessions.length;
}

// ── Deliverable Formatting ──

export function formatSessionDeliverable(sessionId: string): Record<string, unknown> {
  const session = getSessionById(sessionId);
  if (!session) return {};

  const messages = getMessages(sessionId);
  const addons = getAddons(sessionId);
  const expert = session.expertId ? getExpertById(session.expertId) : null;

  const transcript = messages
    .filter(m => m.messageType === 'text')
    .map(m => ({
      role: m.senderType,
      content: m.content,
      timestamp: m.createdAt,
    }));

  return {
    sessionId: session.id,
    offeringType: session.offeringType,
    tier: session.tierId,
    status: session.status,
    transcript,
    turnCount: session.turnCount,
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
  };
}
