import { Router } from 'express';
import { verifyToken, requireRole } from '../middleware/auth.js';
import {
  validate,
  createExpertSchema,
  updateExpertSchema,
  acceptAgreementSchema,
  setPasswordSchema,
  submitJudgmentSchema,
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
import {
  getPendingJobs,
  getJobsForExpert,
  getAllJobs,
  getJobById,
  submitJudgment,
  getJudgmentForJob,
  createJob,
  assignJob,
} from '../services/judgments.js';
import { getExpertReputationScores, getExpertReputationHistory } from '../services/reputation.js';
import { deliverToAcp, getOfferingDefinitions } from '../services/acp.js';
import type { Domain, ExpertCredentials, OfferingType, WalletChain } from '../types/index.js';
import sessionRoutes from './sessions.js';
import notificationRoutes from './notifications.js';

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
  const { name, email, domains, credentials } = req.body as {
    name: string;
    email: string;
    domains: Domain[];
    credentials?: ExpertCredentials;
  };

  const expert = createExpert(name, email, domains, 'expert', credentials);
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
router.post('/experts/:id/password', validate(setPasswordSchema), (req, res) => {
  if (req.auth!.role !== 'admin' && req.auth!.expertId !== param(req.params.id)) {
    res.status(403).json({ success: false, error: 'Cannot set another expert\'s password' });
    return;
  }

  const expert = getExpertById(param(req.params.id));
  if (!expert) {
    res.status(404).json({ success: false, error: 'Expert not found' });
    return;
  }

  setExpertPassword(param(req.params.id), (req.body as { password: string }).password);
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

// ── Jobs ──

// GET /api/jobs — list jobs
router.get('/jobs', (req, res) => {
  if (req.auth!.role === 'admin') {
    const jobs = getAllJobs();
    res.json({ success: true, data: jobs });
  } else {
    const jobs = getJobsForExpert(req.auth!.expertId);
    res.json({ success: true, data: jobs });
  }
});

// GET /api/jobs/pending — pending jobs for current expert
router.get('/jobs/pending', (req, res) => {
  if (req.auth!.role === 'admin') {
    const jobs = getPendingJobs();
    res.json({ success: true, data: jobs });
  } else {
    const jobs = getJobsForExpert(req.auth!.expertId, 'assigned');
    res.json({ success: true, data: jobs });
  }
});

// GET /api/jobs/:id — get job detail
router.get('/jobs/:id', (req, res) => {
  const job = getJobById(param(req.params.id));
  if (!job) {
    res.status(404).json({ success: false, error: 'Job not found' });
    return;
  }

  // Non-admins can only see their own jobs
  if (req.auth!.role !== 'admin' && job.expertId !== req.auth!.expertId) {
    res.status(403).json({ success: false, error: 'Access denied' });
    return;
  }

  const judgment = getJudgmentForJob(job.id);
  res.json({ success: true, data: { job, judgment } });
});

// POST /api/jobs/:id/assign — assign job to expert (admin only)
router.post('/jobs/:id/assign', requireRole('admin'), (req, res) => {
  const job = getJobById(param(req.params.id));
  if (!job) {
    res.status(404).json({ success: false, error: 'Job not found' });
    return;
  }
  const expertId = (req.body as { expertId?: string }).expertId ?? req.auth!.expertId;
  assignJob(job.id, expertId);
  res.json({ success: true, data: getJobById(job.id) });
});

// POST /api/jobs — create job manually (admin, for testing)
router.post('/jobs', requireRole('admin'), (req, res) => {
  const { offeringType, requirements } = req.body as {
    offeringType: OfferingType;
    requirements: Record<string, unknown>;
  };

  const job = createJob(offeringType, requirements, undefined, 'manual-test');
  res.status(201).json({ success: true, data: job });
});

// ── Judgments ──

// POST /api/judgments — submit a judgment
router.post('/judgments', validate(submitJudgmentSchema), async (req, res) => {
  const { jobId, content } = req.body as { jobId: string; content: Record<string, unknown> };

  const result = submitJudgment(jobId, req.auth!.expertId, content);

  if ('error' in result) {
    res.status(400).json({ success: false, error: result.error });
    return;
  }

  // Try to deliver to ACP
  await deliverToAcp(jobId);

  res.status(201).json({ success: true, data: result });
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
router.post('/withdrawals/request', validate(requestWithdrawalSchema), (req, res) => {
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

export default router;
