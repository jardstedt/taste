import { Router } from 'express';
import multer from 'multer';
import { requireRole } from '../middleware/auth.js';
import {
  validate,
  createSessionSchema,
  sendMessageSchema,
  createAddonSchema,
  respondAddonSchema,
  completeSessionSchema,
  declineSessionSchema,
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
  saveDeliverable,
} from '../services/sessions.js';
import {
  saveFile,
  deleteFile,
  saveAttachmentRecord,
  getSessionAttachments as getAttachments,
  getAttachmentById,
  readFile,
  isAllowedMimeType,
  sanitizeFilename,
  MAX_FILE_SIZE,
  ALLOWED_MIME_TYPES,
} from '../services/storage.js';
import { buildZodSchema } from '../config/deliverable-schemas.js';
import { emitToSession, notifyExpert } from '../services/socket.js';
import { sendPushToExpert } from '../services/push.js';
import { sessionCreateLimiter, messageLimiter, uploadLimiter } from '../middleware/rateLimit.js';
import type { AddonType } from '../types/index.js';
import { GRACE_TURNS } from '../config/constants.js';

// Multer setup — memory storage so we validate magic bytes before writing to disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (isAllowedMimeType(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type "${file.mimetype}" is not allowed. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`));
    }
  },
});

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
  if (session.turnCount >= session.maxTurns + GRACE_TURNS) {
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
    }).catch(err => console.error('[Push] Failed:', err));
  }

  // Relay expert message to buyer agent via ACP memo (non-blocking)
  if (type === 'expert' && session.acpJobId) {
    import('../services/acp.js').then(({ relayExpertMessageToAcp }) => {
      relayExpertMessageToAcp(session.id, content).catch(err => console.error('[Sessions] ACP relay failed:', err));
    }).catch(err => console.error('[Sessions] ACP import failed:', err));
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

// POST /sessions/:id/complete — now accepts optional { structuredData, summary }
router.post('/:id/complete', validate(completeSessionSchema), (req, res) => {
  const session = getSessionById(param(req.params.id));
  if (!session) {
    res.status(404).json({ success: false, error: 'Session not found' });
    return;
  }
  if (req.auth!.role !== 'admin' && session.expertId !== req.auth!.expertId) {
    res.status(403).json({ success: false, error: 'Access denied' });
    return;
  }

  // Only active/wrapping_up sessions can be completed
  if (!['active', 'wrapping_up'].includes(session.status)) {
    res.status(400).json({ success: false, error: 'Cannot complete this session' });
    return;
  }

  // Save structured deliverable if provided
  const body = req.body as { structuredData?: Record<string, unknown>; summary?: string } | undefined;
  if (body?.structuredData && Object.keys(body.structuredData).length > 0) {
    // Validate against offering schema
    const schema = buildZodSchema(session.offeringType);
    const parseResult = schema.safeParse(body.structuredData);
    if (!parseResult.success) {
      const errors = parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
      res.status(400).json({ success: false, error: 'Invalid structured data', details: errors });
      return;
    }
    saveDeliverable(session.id, session.offeringType, parseResult.data as Record<string, unknown>, body.summary);
  } else if (body?.summary) {
    // Summary only, no structured data
    saveDeliverable(session.id, session.offeringType, {}, body.summary);
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
router.post('/:id/decline', validate(declineSessionSchema), (req, res) => {
  const session = getSessionById(param(req.params.id));
  if (!session) {
    res.status(404).json({ success: false, error: 'Session not found' });
    return;
  }
  if (req.auth!.role !== 'admin' && session.expertId !== req.auth!.expertId) {
    res.status(403).json({ success: false, error: 'Access denied' });
    return;
  }

  const reason = req.body.reason as string | undefined;
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
    }).catch(err => console.error('[Push] Failed:', err));
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

// POST /sessions/:id/attachments — upload file
router.post('/:id/attachments', uploadLimiter, (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      res.status(400).json({ success: false, error: message });
      return;
    }
    next();
  });
}, (req, res) => {
  const session = getSessionById(param(req.params.id));
  if (!session) {
    res.status(404).json({ success: false, error: 'Session not found' });
    return;
  }

  // Only session expert or admin can upload
  if (req.auth!.role !== 'admin' && session.expertId !== req.auth!.expertId) {
    res.status(403).json({ success: false, error: 'Access denied' });
    return;
  }

  // Block uploads to completed/cancelled/timeout sessions
  if (['completed', 'cancelled', 'timeout'].includes(session.status)) {
    res.status(400).json({ success: false, error: 'Cannot upload to a finished session' });
    return;
  }

  const file = (req as Express.Request & { file?: Express.Multer.File }).file;
  if (!file) {
    res.status(400).json({ success: false, error: 'No file provided' });
    return;
  }

  try {
    const uploadContext = (req.body?.context === 'completion' ? 'completion' : 'chat') as 'chat' | 'completion';

    const { id, storedFilename, fileSizeBytes } = saveFile(
      session.id, file.buffer, file.originalname, file.mimetype,
    );

    // Create a chat message for chat-context uploads
    let messageId: string | undefined;
    if (uploadContext === 'chat') {
      const displayName = sanitizeFilename(file.originalname);
      const msg = addMessage(
        session.id, 'expert', req.auth!.expertId,
        `[File: ${displayName}]`,
        'file',
        { attachmentId: id, filename: displayName, mimeType: file.mimetype, fileSize: fileSizeBytes },
      );
      messageId = msg.id;
      emitToSession(session.id, 'message:new', msg);
    }

    try {
      const attachment = saveAttachmentRecord(
        id, session.id, file.originalname, storedFilename,
        file.mimetype, fileSizeBytes, uploadContext, req.auth!.expertId, messageId,
      );
      res.status(201).json({ success: true, data: attachment });
    } catch (dbErr) {
      // DB insert failed — clean up orphaned file on disk
      try { deleteFile(session.id, storedFilename); } catch { /* best effort */ }
      throw dbErr;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    res.status(400).json({ success: false, error: message });
  }
});

// GET /sessions/:id/attachments — list attachments
router.get('/:id/attachments', (req, res) => {
  const session = getSessionById(param(req.params.id));
  if (!session) {
    res.status(404).json({ success: false, error: 'Session not found' });
    return;
  }
  if (req.auth!.role !== 'admin' && session.expertId !== req.auth!.expertId) {
    res.status(403).json({ success: false, error: 'Access denied' });
    return;
  }
  const attachments = getAttachments(session.id);
  res.json({ success: true, data: attachments });
});

// GET /sessions/:id/attachments/:attachmentId/download — serve file (auth required)
router.get('/:id/attachments/:attachmentId/download', (req, res) => {
  const session = getSessionById(param(req.params.id));
  if (!session) {
    res.status(404).json({ success: false, error: 'Session not found' });
    return;
  }
  if (req.auth!.role !== 'admin' && session.expertId !== req.auth!.expertId) {
    res.status(403).json({ success: false, error: 'Access denied' });
    return;
  }

  const attachment = getAttachmentById(param(req.params.attachmentId));
  if (!attachment || attachment.sessionId !== session.id) {
    res.status(404).json({ success: false, error: 'Attachment not found' });
    return;
  }

  const buffer = readFile(session.id, attachment.storedFilename);
  if (!buffer) {
    res.status(404).json({ success: false, error: 'File not found on disk' });
    return;
  }

  res.setHeader('Content-Type', attachment.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(sanitizeFilename(attachment.originalFilename))}`);
  res.setHeader('Content-Length', buffer.length);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'");
  res.send(buffer);
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
    }).catch(err => console.error('[Push] Failed:', err));
  }

  res.status(201).json({ success: true, data: matched ?? session });
});

export default router;
