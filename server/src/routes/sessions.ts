import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import {
  validate,
  createSessionSchema,
  sendMessageSchema,
  createAddonSchema,
  respondAddonSchema,
} from '../middleware/validation.js';
import {
  createSession,
  getSessionById,
  getSessionsForExpert,
  getActiveSessions,
  getPendingSessions,
  getAllSessions,
  acceptSession,
  completeSession,
  declineSession,
  addMessage,
  getMessages,
  createAddon,
  respondToAddon,
  getAddons,
  matchSession,
  incrementTurnCount,
} from '../services/sessions.js';
import { emitToSession, notifyExpert } from '../services/socket.js';
import { sendPushToExpert } from '../services/push.js';
import { sessionCreateLimiter, messageLimiter } from '../middleware/rateLimit.js';
import type { AddonType } from '../types/index.js';

function param(val: string | string[] | undefined): string {
  return Array.isArray(val) ? val[0] : val ?? '';
}

const router = Router();

// Note: verifyToken is already applied by the parent api router

// GET /sessions — list sessions
router.get('/', (req, res) => {
  if (req.auth!.role === 'admin') {
    res.json({ success: true, data: getAllSessions() });
  } else {
    res.json({ success: true, data: getSessionsForExpert(req.auth!.expertId) });
  }
});

// GET /sessions/pending
router.get('/pending', (req, res) => {
  if (req.auth!.role === 'admin') {
    res.json({ success: true, data: getPendingSessions() });
  } else {
    const sessions = getSessionsForExpert(req.auth!.expertId).filter(
      s => s.status === 'pending' || s.status === 'matching',
    );
    res.json({ success: true, data: sessions });
  }
});

// GET /sessions/active
router.get('/active', (req, res) => {
  if (req.auth!.role === 'admin') {
    res.json({ success: true, data: getActiveSessions() });
  } else {
    const sessions = getSessionsForExpert(req.auth!.expertId).filter(
      s => s.status === 'active' || s.status === 'accepted' || s.status === 'wrapping_up',
    );
    res.json({ success: true, data: sessions });
  }
});

// GET /sessions/:id — session detail with messages and addons
router.get('/:id', (req, res) => {
  const session = getSessionById(param(req.params.id));
  if (!session) {
    res.status(404).json({ success: false, error: 'Session not found' });
    return;
  }
  if (req.auth!.role !== 'admin' && session.expertId !== req.auth!.expertId) {
    res.status(403).json({ success: false, error: 'Access denied' });
    return;
  }
  const messages = getMessages(session.id);
  const addons = getAddons(session.id);
  res.json({ success: true, data: { session, messages, addons } });
});

// POST /sessions/:id/accept
router.post('/:id/accept', (req, res) => {
  const session = acceptSession(param(req.params.id), req.auth!.expertId);
  if (!session) {
    res.status(400).json({ success: false, error: 'Cannot accept this session' });
    return;
  }
  emitToSession(session.id, 'session:updated', session);
  res.json({ success: true, data: session });
});

// POST /sessions/:id/messages — send message (agent REST + expert fallback)
router.post('/:id/messages', messageLimiter, validate(sendMessageSchema), (req, res) => {
  const session = getSessionById(param(req.params.id));
  if (!session) {
    res.status(404).json({ success: false, error: 'Session not found' });
    return;
  }

  // Block messages if grace period is exhausted
  if (session.turnCount >= session.maxTurns + 5) {
    res.status(400).json({ success: false, error: 'Grace period exhausted. Please complete or decline the session.' });
    return;
  }

  const { content, senderType } = req.body as { content: string; senderType?: string };

  // Determine sender type and ID
  let type: 'agent' | 'expert' = 'expert';
  let senderId = req.auth!.expertId;

  // Admin can send as agent (for testing or on behalf of ACP agent)
  if (senderType === 'agent' && req.auth!.role === 'admin') {
    type = 'agent';
    senderId = session.buyerAgent ?? 'agent';
  }

  const message = addMessage(session.id, type, senderId, content);
  const turnInfo = incrementTurnCount(session.id, type);

  emitToSession(session.id, 'message:new', message);

  // Push notification for agent messages to expert
  if (type === 'agent' && session.expertId) {
    const preview = content.length > 100 ? content.slice(0, 100) + '...' : content;
    sendPushToExpert(session.expertId, {
      title: 'New Message',
      body: preview,
      tag: `chat-${session.id}`,
      data: { url: `/dashboard/session/${session.id}`, sessionId: session.id, type: 'message' },
    });
  }

  // Always emit updated session so dashboard gets fresh turn count + status
  const updated = getSessionById(session.id);
  emitToSession(session.id, 'session:updated', updated);

  if (turnInfo.limitReached) {
    emitToSession(session.id, 'session:turn_limit', turnInfo);
  }

  res.status(201).json({ success: true, data: message });
});

// GET /sessions/:id/messages
router.get('/:id/messages', (req, res) => {
  const session = getSessionById(param(req.params.id));
  if (!session) {
    res.status(404).json({ success: false, error: 'Session not found' });
    return;
  }
  if (req.auth!.role !== 'admin' && session.expertId !== req.auth!.expertId) {
    res.status(403).json({ success: false, error: 'Access denied' });
    return;
  }
  res.json({ success: true, data: getMessages(session.id) });
});

// POST /sessions/:id/complete
router.post('/:id/complete', (req, res) => {
  const session = getSessionById(param(req.params.id));
  if (!session) {
    res.status(404).json({ success: false, error: 'Session not found' });
    return;
  }
  if (req.auth!.role !== 'admin' && session.expertId !== req.auth!.expertId) {
    res.status(403).json({ success: false, error: 'Access denied' });
    return;
  }

  const completed = completeSession(session.id);
  if (!completed) {
    res.status(400).json({ success: false, error: 'Cannot complete this session' });
    return;
  }

  emitToSession(session.id, 'session:updated', completed);
  emitToSession(session.id, 'session:completed', completed);
  res.json({ success: true, data: completed });
});

// POST /sessions/:id/decline — expert can't fulfill, triggers refund
router.post('/:id/decline', (req, res) => {
  const session = getSessionById(param(req.params.id));
  if (!session) {
    res.status(404).json({ success: false, error: 'Session not found' });
    return;
  }
  if (req.auth!.role !== 'admin' && session.expertId !== req.auth!.expertId) {
    res.status(403).json({ success: false, error: 'Access denied' });
    return;
  }

  const reason = (req.body as { reason?: string })?.reason;
  const declined = declineSession(session.id, reason);
  if (!declined) {
    res.status(400).json({ success: false, error: 'Cannot decline this session' });
    return;
  }

  emitToSession(session.id, 'session:updated', declined);
  res.json({ success: true, data: declined });
});

// POST /sessions/:id/addons — create addon request
router.post('/:id/addons', validate(createAddonSchema), (req, res) => {
  const session = getSessionById(param(req.params.id));
  if (!session) {
    res.status(404).json({ success: false, error: 'Session not found' });
    return;
  }

  const { addonType, priceUsdc, description } = req.body as {
    addonType: string; priceUsdc: number; description?: string;
  };

  const addon = createAddon(session.id, addonType as AddonType, priceUsdc, description, req.auth!.expertId);
  emitToSession(session.id, 'addon:new', addon);

  // Push notification for addon request to expert
  if (session.expertId) {
    sendPushToExpert(session.expertId, {
      title: 'Add-on Requested',
      body: `${addonType} — $${priceUsdc} USDC`,
      tag: `addon-${session.id}`,
      data: { url: `/dashboard/session/${session.id}`, sessionId: session.id, type: 'addon_request' },
    });
  }

  res.status(201).json({ success: true, data: addon });
});

// POST /sessions/:id/addons/:addonId/respond
router.post('/:id/addons/:addonId/respond', validate(respondAddonSchema), (req, res) => {
  const { accepted } = req.body as { accepted: boolean };
  const addon = respondToAddon(param(req.params.addonId), accepted, req.auth!.expertId);
  if (!addon) {
    res.status(400).json({ success: false, error: 'Cannot respond to this addon' });
    return;
  }

  emitToSession(addon.sessionId, 'addon:updated', addon);
  const session = getSessionById(addon.sessionId);
  if (session) {
    emitToSession(addon.sessionId, 'session:updated', session);
  }

  res.json({ success: true, data: addon });
});

// POST /sessions — create session manually (admin/testing)
router.post('/', sessionCreateLimiter, requireRole('admin'), validate(createSessionSchema), (req, res) => {
  let session;
  try {
    session = createSession(req.body);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create session';
    res.status(400).json({ success: false, error: message });
    return;
  }

  // Auto-match expert
  const matched = matchSession(session.id);
  if (matched?.expertId) {
    notifyExpert(matched.expertId, 'session:new', matched);
    sendPushToExpert(matched.expertId, {
      title: 'New Session Request',
      body: `${matched.offeringType} — $${matched.priceUsdc} USDC`,
      tag: `session-${matched.id}`,
      data: { url: `/dashboard/session/${matched.id}`, sessionId: matched.id, type: 'session_request' },
    });
  }

  res.status(201).json({ success: true, data: matched ?? session });
});

export default router;
