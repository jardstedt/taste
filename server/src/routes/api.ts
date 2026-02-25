import { Router } from 'express';
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
import { getOfferingDefinitions } from '../services/acp.js';
import type { Domain, ExpertCredentials, WalletChain } from '../types/index.js';
import { withdrawalLimiter, passwordLimiter } from '../middleware/rateLimit.js';
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
router.post('/experts', requireRole('admin'), validate(createExpertSchema), (req, res) => {
  const { name, email, domains, password, credentials } = req.body as {
    name: string;
    email: string;
    domains: Domain[];
    password: string;
    credentials?: ExpertCredentials;
  };

  const expert = createExpert(name, email, domains, 'expert', credentials);
  setExpertPassword(expert.id, password);
  res.status(201).json({ success: true, data: getExpertPublic(expert.id) });
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

// POST /api/experts/:id/password — set password
router.post('/experts/:id/password', passwordLimiter, validate(setPasswordSchema), (req, res) => {
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
    if (!verifyPassword(expert, currentPassword)) {
      res.status(403).json({ success: false, error: 'Current password is incorrect' });
      return;
    }
  }

  setExpertPassword(param(req.params.id), password);
  res.json({ success: true });
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

export default router;
