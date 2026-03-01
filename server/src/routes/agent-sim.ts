import { Router } from 'express';
import { verifyToken, requireRole } from '../middleware/auth.js';
import {
  initBuyerClient,
  getBuyerStatus,
  discoverOfferings,
  createBuyerJob,
  getJobStatus,
  payForJob,
  acceptDeliverable,
  rejectDeliverable,
  evaluateJob,
  getActiveJobs,
  getSampleRequests,
} from '../services/agent-sim.js';
import { shortenSessionDeadline, checkSessionTimeouts, getSessionById } from '../services/sessions.js';

const router = Router();

// All agent-sim routes require admin
router.use(verifyToken);
router.use(requireRole('admin'));

// POST /api/agent-sim/init — initialize buyer client
router.post('/init', async (_req, res) => {
  try {
    const result = await initBuyerClient();
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// GET /api/agent-sim/status — buyer client status + gas price
router.get('/status', async (_req, res) => {
  try {
    const status = await getBuyerStatus();
    res.json({ success: true, data: status });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// GET /api/agent-sim/offerings — discover Taste offerings
router.get('/offerings', async (_req, res) => {
  try {
    const offerings = await discoverOfferings();
    res.json({ success: true, data: offerings });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// GET /api/agent-sim/samples — get sample request data
router.get('/samples', (_req, res) => {
  res.json({ success: true, data: getSampleRequests() });
});

// POST /api/agent-sim/jobs — create a buyer job
router.post('/jobs', async (req, res) => {
  try {
    const { offeringIndex, requirement, evaluatorAddress } = req.body as {
      offeringIndex: number;
      requirement: Record<string, unknown>;
      evaluatorAddress?: string;
    };

    if (typeof offeringIndex !== 'number' || offeringIndex < 0) {
      res.status(400).json({ success: false, error: 'Invalid offeringIndex' });
      return;
    }
    if (!requirement || typeof requirement !== 'object' || Array.isArray(requirement)) {
      res.status(400).json({ success: false, error: 'requirement must be a plain object' });
      return;
    }
    // Guard against oversized payloads
    const reqStr = JSON.stringify(requirement);
    if (reqStr.length > 10_000) {
      res.status(400).json({ success: false, error: 'requirement too large (max 10KB)' });
      return;
    }
    // Validate evaluator address if provided
    if (evaluatorAddress !== undefined && (typeof evaluatorAddress !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(evaluatorAddress))) {
      res.status(400).json({ success: false, error: 'evaluatorAddress must be a valid Ethereum address' });
      return;
    }

    const result = await createBuyerJob(offeringIndex, requirement, evaluatorAddress);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// GET /api/agent-sim/jobs — list all tracked jobs
router.get('/jobs', (_req, res) => {
  res.json({ success: true, data: getActiveJobs() });
});

// GET /api/agent-sim/jobs/:jobId — get job status from ACP
router.get('/jobs/:jobId', async (req, res) => {
  try {
    const jobId = parseInt(req.params.jobId, 10);
    if (isNaN(jobId)) {
      res.status(400).json({ success: false, error: 'Invalid jobId' });
      return;
    }
    const status = await getJobStatus(jobId);
    res.json({ success: true, data: status });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// POST /api/agent-sim/jobs/:jobId/pay — pay and accept requirement
router.post('/jobs/:jobId/pay', async (req, res) => {
  try {
    const jobId = parseInt(req.params.jobId, 10);
    if (isNaN(jobId)) {
      res.status(400).json({ success: false, error: 'Invalid jobId' });
      return;
    }
    const result = await payForJob(jobId);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// POST /api/agent-sim/jobs/:jobId/accept — accept deliverable
router.post('/jobs/:jobId/accept', async (req, res) => {
  try {
    const jobId = parseInt(req.params.jobId, 10);
    if (isNaN(jobId)) {
      res.status(400).json({ success: false, error: 'Invalid jobId' });
      return;
    }
    const { memo } = (req.body ?? {}) as { memo?: string };
    const result = await acceptDeliverable(jobId, memo);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// POST /api/agent-sim/jobs/:jobId/evaluate — evaluate as third-party evaluator
router.post('/jobs/:jobId/evaluate', async (req, res) => {
  try {
    const jobId = parseInt(req.params.jobId, 10);
    if (isNaN(jobId)) {
      res.status(400).json({ success: false, error: 'Invalid jobId' });
      return;
    }
    const { approved, memo } = (req.body ?? {}) as { approved?: boolean; memo?: string };
    if (typeof approved !== 'boolean') {
      res.status(400).json({ success: false, error: 'approved must be a boolean' });
      return;
    }
    const result = await evaluateJob(jobId, approved, memo);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// POST /api/agent-sim/jobs/:jobId/reject — reject deliverable
router.post('/jobs/:jobId/reject', async (req, res) => {
  try {
    const jobId = parseInt(req.params.jobId, 10);
    if (isNaN(jobId)) {
      res.status(400).json({ success: false, error: 'Invalid jobId' });
      return;
    }
    const { memo } = (req.body ?? {}) as { memo?: string };
    const result = await rejectDeliverable(jobId, memo);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// POST /api/agent-sim/shorten-deadline — shorten session deadline for testing
router.post('/shorten-deadline', (req, res) => {
  const { sessionId, minutes } = req.body as { sessionId?: string; minutes?: number };
  if (!sessionId || typeof sessionId !== 'string') {
    res.status(400).json({ success: false, error: 'sessionId required' });
    return;
  }
  if (typeof minutes !== 'number' || minutes < 1 || minutes > 10) {
    res.status(400).json({ success: false, error: 'minutes must be 1-10' });
    return;
  }
  const newDeadline = shortenSessionDeadline(sessionId, minutes);
  if (!newDeadline) {
    res.status(404).json({ success: false, error: 'Session not found' });
    return;
  }
  res.json({ success: true, data: { sessionId, newDeadline } });
});

// POST /api/agent-sim/expire-session — expire a session immediately (for demo)
router.post('/expire-session', (req, res) => {
  const { sessionId } = req.body as { sessionId?: string };
  if (!sessionId || typeof sessionId !== 'string') {
    res.status(400).json({ success: false, error: 'sessionId required' });
    return;
  }
  const session = getSessionById(sessionId);
  if (!session) {
    res.status(404).json({ success: false, error: 'Session not found' });
    return;
  }
  if (['completed', 'cancelled', 'timeout'].includes(session.status)) {
    res.status(400).json({ success: false, error: `Session already ${session.status}` });
    return;
  }
  // Set deadline to 1 second ago and run timeout check
  shortenSessionDeadline(sessionId, -1);
  const expired = checkSessionTimeouts();
  res.json({ success: true, data: { sessionId, expired, previousStatus: session.status } });
});

export default router;
