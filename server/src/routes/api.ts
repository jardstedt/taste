import { Router } from 'express';
import multer from 'multer';
import { verifyToken, requireRole } from '../middleware/auth.js';
import {
  validate,
  createExpertSchema,
  updateExpertSchema,
  acceptAgreementSchema,
  setPasswordSchema,
  setWalletSchema,
  requestWithdrawalSchema,
  completeWithdrawalSchema,
  rejectWithdrawalSchema,
} from '../middleware/validation.js';
import {
  getAllExpertsPublic,
  getExpertPublic,
  getExpertById,
  createExpert,
  updateExpert,
  setExpertPassword,
  verifyPassword,
  deactivateExpert,
  acceptAgreement,
  setWalletAddress,
} from '../services/experts.js';
import {
  requestWithdrawal,
  approveWithdrawal,
  completeWithdrawal,
  rejectWithdrawal,
  getWithdrawals,
  getPendingWithdrawals,
} from '../services/withdrawals.js';
import { getExpertReputationScores, getExpertReputationHistory } from '../services/reputation.js';
import { getDb } from '../db/database.js';
import { getOfferingDefinitions, inspectAcpJob, inspectSessionAcp, listAcpJobs, claimAllCompletedJobs } from '../services/acp.js';
import type { Domain, ExpertCredentials, WalletChain } from '../types/index.js';
import { withdrawalLimiter, passwordLimiter, uploadLimiter } from '../middleware/rateLimit.js';
import { saveAvatar, isAllowedAvatarMime, MAX_AVATAR_SIZE } from '../services/storage.js';
import sessionRoutes from './sessions.js';
import notificationRoutes from './notifications.js';
import agentSimRoutes from './agent-sim.js';

function param(val: string | string[] | undefined): string {
  return Array.isArray(val) ? val[0] : val ?? '';
}

const router = Router();

// All API routes require authentication
router.use(verifyToken);

// ── Experts ──

// GET /api/experts — list all experts (admin only)
router.get('/experts', requireRole('admin'), (_req, res) => {
  const experts = getAllExpertsPublic();
  res.json({ success: true, data: experts });
});

// GET /api/experts/:id — get expert public profile
router.get('/experts/:id', (req, res) => {
  const expert = getExpertPublic(param(req.params.id));
  if (!expert) {
    res.status(404).json({ success: false, error: 'Expert not found' });
    return;
  }
  res.json({ success: true, data: expert });
});

// GET /api/experts/:id/public — public profile (no auth needed, re-mounted below)
// This is accessed via the judgment deliverable link

// POST /api/experts — create expert (admin only)
router.post('/experts', requireRole('admin'), validate(createExpertSchema), async (req, res, next) => {
  try {
    const { name, email, domains, password, credentials } = req.body as {
      name: string;
      email: string;
      domains: Domain[];
      password: string;
      credentials?: ExpertCredentials;
    };

    const expert = createExpert(name, email, domains, 'expert', credentials);
    await setExpertPassword(expert.id, password);
    // Auto-accept agreement for admin-created experts so they're immediately eligible for matching
    acceptAgreement(expert.id);
    res.status(201).json({ success: true, data: getExpertPublic(expert.id) });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/experts/:id — update expert profile
router.patch('/experts/:id', validate(updateExpertSchema), (req, res) => {
  // Experts can only update themselves; admins can update anyone
  if (req.auth!.role !== 'admin' && req.auth!.expertId !== param(req.params.id)) {
    res.status(403).json({ success: false, error: 'Cannot update another expert' });
    return;
  }

  const updated = updateExpert(param(req.params.id), req.body);
  if (!updated) {
    res.status(404).json({ success: false, error: 'Expert not found' });
    return;
  }

  res.json({ success: true, data: getExpertPublic(updated.id) });
});

// POST /api/experts/:id/avatar — upload avatar image (admin only)
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AVATAR_SIZE },
  fileFilter: (_req, file, cb) => {
    if (isAllowedAvatarMime(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Avatar type "${file.mimetype}" is not allowed. Use PNG, JPEG, WebP, or GIF.`));
    }
  },
});

router.post('/experts/:id/avatar', requireRole('admin'), uploadLimiter, avatarUpload.single('avatar'), async (req, res, next) => {
  try {
    const expertId = param(req.params.id);
    const expert = getExpertById(expertId);
    if (!expert) {
      res.status(404).json({ success: false, error: 'Expert not found' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ success: false, error: 'No avatar file provided' });
      return;
    }

    const avatarUrl = saveAvatar(expertId, req.file.buffer, req.file.originalname, req.file.mimetype);

    // Update expert credentials with avatar URL
    const currentCreds = expert.credentials || {};
    updateExpert(expertId, {
      credentials: { ...currentCreds, profileImageUrl: avatarUrl },
    });

    res.json({ success: true, data: { avatarUrl } });
  } catch (err) {
    next(err);
  }
});

// POST /api/experts/:id/password — set password
router.post('/experts/:id/password', passwordLimiter, validate(setPasswordSchema), async (req, res, next) => {
  try {
    if (req.auth!.role !== 'admin' && req.auth!.expertId !== param(req.params.id)) {
      res.status(403).json({ success: false, error: 'Cannot set another expert\'s password' });
      return;
    }

    const expert = getExpertById(param(req.params.id));
    if (!expert) {
      res.status(404).json({ success: false, error: 'Expert not found' });
      return;
    }

    const { password, currentPassword } = req.body as { password: string; currentPassword?: string };

    // Non-admin users must verify their current password
    if (req.auth!.role !== 'admin') {
      if (!currentPassword) {
        res.status(400).json({ success: false, error: 'Current password is required' });
        return;
      }
      if (!(await verifyPassword(expert, currentPassword))) {
        res.status(403).json({ success: false, error: 'Current password is incorrect' });
        return;
      }
    }

    await setExpertPassword(param(req.params.id), password);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/experts/:id — deactivate expert (admin only)
router.delete('/experts/:id', requireRole('admin'), (req, res) => {
  const targetId = param(req.params.id);

  // Prevent admin from deactivating themselves
  if (req.auth!.expertId === targetId) {
    res.status(400).json({ success: false, error: 'Cannot deactivate your own account' });
    return;
  }

  const success = deactivateExpert(targetId);
  if (!success) {
    res.status(404).json({ success: false, error: 'Expert not found' });
    return;
  }

  res.json({ success: true });
});

// POST /api/experts/:id/accept-agreement — accept expert agreement
router.post('/experts/:id/accept-agreement', validate(acceptAgreementSchema), (req, res) => {
  if (req.auth!.expertId !== param(req.params.id)) {
    res.status(403).json({ success: false, error: 'Can only accept your own agreement' });
    return;
  }

  acceptAgreement(param(req.params.id));
  res.json({ success: true });
});

// ── Expert Applications (admin) ──

interface ApplicationRow {
  id: string; name: string; email: string; domains: string;
  portfolio_url: string | null; bio: string; motivation: string;
  status: string; created_at: string;
}

// GET /api/applications — list all applications (admin only)
router.get('/applications', requireRole('admin'), (_req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM expert_applications ORDER BY created_at DESC').all() as ApplicationRow[];
  const data = rows.map(r => ({
    id: r.id, name: r.name, email: r.email,
    domains: JSON.parse(r.domains) as string[],
    portfolioUrl: r.portfolio_url, bio: r.bio, motivation: r.motivation,
    status: r.status, createdAt: r.created_at,
  }));
  res.json({ success: true, data });
});

// PATCH /api/applications/:id — update application status (admin only)
router.patch('/applications/:id', requireRole('admin'), (req, res) => {
  const db = getDb();
  const { status } = req.body as { status: string };
  if (!['approved', 'rejected'].includes(status)) {
    res.status(400).json({ success: false, error: 'Invalid status' });
    return;
  }
  const result = db.prepare('UPDATE expert_applications SET status = ? WHERE id = ?').run(status, param(req.params.id));
  if (result.changes === 0) {
    res.status(404).json({ success: false, error: 'Application not found' });
    return;
  }
  res.json({ success: true });
});

// ── Reputation ──

// GET /api/reputation — my reputation
router.get('/reputation', (req, res) => {
  const scores = getExpertReputationScores(req.auth!.expertId);
  const history = getExpertReputationHistory(req.auth!.expertId);
  res.json({ success: true, data: { scores, history } });
});

// GET /api/reputation/:expertId — expert reputation (admin)
router.get('/reputation/:expertId', requireRole('admin'), (req, res) => {
  const scores = getExpertReputationScores(param(req.params.expertId));
  const history = getExpertReputationHistory(param(req.params.expertId));
  res.json({ success: true, data: { scores, history } });
});

// ── Offerings ──

// GET /api/offerings — list available offerings
router.get('/offerings', (_req, res) => {
  res.json({ success: true, data: getOfferingDefinitions() });
});

// ── Wallets (v1.3) ──

// POST /api/experts/:id/wallet — set wallet address
router.post('/experts/:id/wallet', validate(setWalletSchema), (req, res) => {
  if (req.auth!.role !== 'admin' && req.auth!.expertId !== param(req.params.id)) {
    res.status(403).json({ success: false, error: 'Cannot set another expert\'s wallet' });
    return;
  }

  const { walletAddress, walletChain } = req.body as { walletAddress: string; walletChain: WalletChain };
  const expert = setWalletAddress(param(req.params.id), walletAddress, walletChain);
  if (!expert) {
    res.status(404).json({ success: false, error: 'Expert not found' });
    return;
  }

  res.json({ success: true, data: getExpertPublic(expert.id) });
});

// ── Withdrawals (v1.3) ──

// POST /api/withdrawals/request — request withdrawal
router.post('/withdrawals/request', withdrawalLimiter, validate(requestWithdrawalSchema), (req, res) => {
  const { amountUsdc } = req.body as { amountUsdc: number };
  const result = requestWithdrawal(req.auth!.expertId, amountUsdc);

  if ('error' in result) {
    res.status(400).json({ success: false, error: result.error });
    return;
  }

  res.status(201).json({ success: true, data: result });
});

// GET /api/withdrawals — list withdrawals
router.get('/withdrawals', (req, res) => {
  if (req.auth!.role === 'admin') {
    res.json({ success: true, data: getWithdrawals() });
  } else {
    res.json({ success: true, data: getWithdrawals(req.auth!.expertId) });
  }
});

// GET /api/withdrawals/pending — pending withdrawals (admin)
router.get('/withdrawals/pending', requireRole('admin'), (_req, res) => {
  res.json({ success: true, data: getPendingWithdrawals() });
});

// POST /api/withdrawals/:id/approve — approve withdrawal (admin)
router.post('/withdrawals/:id/approve', requireRole('admin'), (req, res) => {
  const result = approveWithdrawal(param(req.params.id), req.auth!.expertId);

  if ('error' in result) {
    res.status(400).json({ success: false, error: result.error });
    return;
  }

  res.json({ success: true, data: result });
});

// POST /api/withdrawals/:id/reject — reject withdrawal (admin)
router.post('/withdrawals/:id/reject', requireRole('admin'), validate(rejectWithdrawalSchema), (req, res) => {
  const { reason } = req.body as { reason: string };
  const result = rejectWithdrawal(param(req.params.id), req.auth!.expertId, reason);

  if ('error' in result) {
    res.status(400).json({ success: false, error: result.error });
    return;
  }

  res.json({ success: true, data: result });
});

// POST /api/withdrawals/:id/complete — complete withdrawal with tx hash (admin)
router.post('/withdrawals/:id/complete', requireRole('admin'), validate(completeWithdrawalSchema), (req, res) => {
  const { txHash } = req.body as { txHash: string };
  const result = completeWithdrawal(param(req.params.id), txHash, req.auth!.expertId);

  if ('error' in result) {
    res.status(400).json({ success: false, error: result.error });
    return;
  }

  res.json({ success: true, data: result });
});

// ── Push Notifications ──
router.use('/notifications', notificationRoutes);

// ── Sessions (v1.1) ──
router.use('/sessions', sessionRoutes);

// ── Agent Simulator (admin demo) ──
router.use('/agent-sim', agentSimRoutes);

// ── ACP Inspector (admin, read-only, no gas) ──

// GET /api/acp/jobs — list all on-chain jobs for our provider
router.get('/acp/jobs', requireRole('admin'), async (_req, res) => {
  try {
    const jobs = await listAcpJobs();
    res.json({ success: true, data: jobs });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch ACP jobs';
    res.status(500).json({ success: false, error: message });
  }
});

// GET /api/acp/jobs/:jobId — inspect a specific on-chain job
router.get('/acp/jobs/:jobId', requireRole('admin'), async (req, res) => {
  const jobId = parseInt(param(req.params.jobId), 10);
  if (isNaN(jobId)) {
    res.status(400).json({ success: false, error: 'Invalid job ID' });
    return;
  }
  try {
    const inspection = await inspectAcpJob(jobId);
    if (!inspection) {
      res.status(404).json({ success: false, error: 'Job not found or ACP not connected' });
      return;
    }
    res.json({ success: true, data: inspection });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to inspect job';
    res.status(500).json({ success: false, error: message });
  }
});

// GET /api/acp/sessions/:sessionId — inspect on-chain data for a local session
router.get('/acp/sessions/:sessionId', requireRole('admin'), async (req, res) => {
  try {
    const inspection = await inspectSessionAcp(param(req.params.sessionId));
    if (!inspection) {
      res.status(404).json({ success: false, error: 'Session has no ACP job or ACP not connected' });
      return;
    }
    res.json({ success: true, data: inspection });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to inspect session';
    res.status(500).json({ success: false, error: message });
  }
});

// POST /api/acp/claim-all — retroactively claim budget for all completed jobs
router.post('/acp/claim-all', requireRole('admin'), async (_req, res) => {
  try {
    const result = await claimAllCompletedJobs();
    res.json({ success: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to claim budgets';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
