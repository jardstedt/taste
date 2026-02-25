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
  getActiveJobs,
  getSampleRequests,
} from '../services/agent-sim.js';

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
    const { offeringIndex, requirement } = req.body as {
      offeringIndex: number;
      requirement: Record<string, unknown>;
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

    const result = await createBuyerJob(offeringIndex, requirement);
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

export default router;
