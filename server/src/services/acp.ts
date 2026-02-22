import acpModule, {
  AcpContractClientV2,
  AcpJob,
  AcpJobPhases,
  AcpMemo,
} from '@virtuals-protocol/acp-node';

// Handle double-nested default export in this SDK version
const AcpClient = (acpModule as unknown as { default: typeof acpModule }).default ?? acpModule;
import { getEnv } from '../config/env.js';
import { OFFERINGS } from '../config/domains.js';
import {
  createJob,
  getJobByAcpId,
  getJobById,
  formatDeliverable,
  getJudgmentForJob,
  checkTimeouts,
} from './judgments.js';
import type { OfferingType } from '../types/index.js';
import {
  createSession, getSessionByAcpId, getSessionById,
  matchSession, startSession, formatSessionDeliverable, checkSessionTimeouts,
} from './sessions.js';
import { notifyExpert } from './socket.js';

let _acpClient: InstanceType<typeof AcpClient> | null = null;
let _pollInterval: ReturnType<typeof setInterval> | null = null;

// ── Offering Type Mapping ──

const OFFERING_NAME_MAP: Record<string, OfferingType> = {
  'project vibes check': 'vibes_check',
  'narrative assessment': 'narrative',
  'creative/art review': 'creative_review',
  'creative art review': 'creative_review',
  'creative_art_review': 'creative_review',
  'community sentiment': 'community_sentiment',
  'general human judgment': 'general',
};

function resolveOfferingType(jobName: string): OfferingType {
  const lower = jobName.toLowerCase().trim().replace(/_/g, ' ');
  for (const [key, type] of Object.entries(OFFERING_NAME_MAP)) {
    const normalizedKey = key.replace(/_/g, ' ');
    if (lower.includes(normalizedKey)) return type;
  }
  return 'general';
}

// ── Initialization ──

export async function initAcp(): Promise<InstanceType<typeof AcpClient> | null> {
  const env = getEnv();

  if (!env.ACP_WALLET_PRIVATE_KEY || !env.ACP_SESSION_ENTITY_KEY_ID || !env.ACP_AGENT_WALLET_ADDRESS) {
    console.log('[ACP] Missing ACP credentials — running in local-only mode');
    return null;
  }

  const privateKey = env.ACP_WALLET_PRIVATE_KEY.startsWith('0x')
    ? env.ACP_WALLET_PRIVATE_KEY
    : `0x${env.ACP_WALLET_PRIVATE_KEY}`;

  const entityKeyId = parseInt(env.ACP_SESSION_ENTITY_KEY_ID, 10);

  const contractClient = await AcpContractClientV2.build(
    privateKey as `0x${string}`,
    entityKeyId,
    env.ACP_AGENT_WALLET_ADDRESS as `0x${string}`,
  );

  _acpClient = new AcpClient({
    acpContractClient: contractClient,
    onNewTask: handleNewTask,
    onEvaluate: handleEvaluate,
  });

  // Initialize WebSocket connection
  await _acpClient.init();
  console.log('[ACP] Connected via WebSocket');

  // Also start polling as a fallback (every 30 seconds)
  startPolling();

  return _acpClient;
}

// ── WebSocket Callbacks ──

async function handleNewTask(job: AcpJob, memoToSign?: AcpMemo): Promise<void> {
  try {
    // Phase 1: Incoming job request — accept it
    if (
      job.phase === AcpJobPhases.REQUEST &&
      memoToSign?.nextPhase === AcpJobPhases.NEGOTIATION
    ) {
      console.log(`[ACP] New job request: ${job.id} (name: ${job.name})`);

      // Determine offering type from job name
      const offeringType = resolveOfferingType(job.name ?? String(job.id));

      // Extract requirements from the first buyer memo or context
      let requirements: Record<string, unknown> = {};
      if (job.memos && job.memos.length > 0) {
        const firstMemo = job.memos[0];
        try {
          const parsed = JSON.parse(firstMemo.content);
          // ACP wraps the actual data under a "requirement" key
          if (parsed.requirement && typeof parsed.requirement === 'object') {
            requirements = parsed.requirement as Record<string, unknown>;
          } else {
            requirements = parsed;
          }
        } catch {
          // If not valid JSON, store as raw text
          requirements = { rawRequest: firstMemo.content };
        }
      }
      if (job.context && Object.keys(job.context).length > 0) {
        requirements = { ...requirements, ...job.context };
      }

      console.log(`[ACP] Offering type: ${offeringType}, requirements:`, JSON.stringify(requirements).slice(0, 200));

      // Guard against duplicate WebSocket callbacks
      const existing = getJobByAcpId(String(job.id));
      if (existing) {
        console.log(`[ACP] Job ${job.id} already exists internally, skipping creation`);
      } else {
        createJob(offeringType, requirements, String(job.id));
      }

      await job.accept('Human expert judgment service ready');
      await job.createRequirement('Payment required to proceed with human expert evaluation');

      console.log(`[ACP] Job ${job.id} accepted`);

      // Create v1.1 session alongside job
      try {
        const existingSession = getSessionByAcpId(String(job.id));
        if (!existingSession) {
          const internalJob = getJobByAcpId(String(job.id));
          const session = createSession({
            offeringType,
            acpJobId: String(job.id),
            jobId: internalJob?.id,
            buyerAgent: String(job.id),
            buyerAgentDisplay: job.name ?? `Agent ${job.id}`,
            description: JSON.stringify(requirements).slice(0, 500),
          });
          const matched = matchSession(session.id);
          if (matched?.expertId) {
            try { notifyExpert(matched.expertId, 'session:new', matched); } catch {}
          }
        }
      } catch (err) {
        console.error(`[ACP] Failed to create session for job ${job.id}:`, err);
      }
    }
    // Phase 2: Payment received — check if judgment is ready
    else if (
      job.phase === AcpJobPhases.TRANSACTION &&
      memoToSign?.nextPhase === AcpJobPhases.EVALUATION
    ) {
      console.log(`[ACP] Payment received for job ${job.id}, awaiting expert judgment`);

      // Check if judgment already exists (expert may have pre-submitted)
      const internalJob = getJobByAcpId(String(job.id));
      if (internalJob) {
        const judgment = getJudgmentForJob(internalJob.id);
        if (judgment) {
          const deliverable = formatDeliverable(judgment);
          await job.deliver(deliverable);
          console.log(`[ACP] Job ${job.id} delivered immediately (v1.0 judgment)`);
        }
      }

      // v1.1: Check session status
      const session = getSessionByAcpId(String(job.id));
      if (session) {
        if (session.status === 'completed') {
          const sessionDeliverable = formatSessionDeliverable(session.id);
          await job.deliver(JSON.stringify(sessionDeliverable));
          console.log(`[ACP] Job ${job.id} delivered via session ${session.id}`);
        } else if (session.status === 'accepted') {
          startSession(session.id);
          console.log(`[ACP] Session ${session.id} started (payment received)`);
        }
      }
    }
  } catch (err) {
    console.error(`[ACP] Error handling job ${job.id}:`, err);
  }
}

async function handleEvaluate(job: AcpJob): Promise<void> {
  try {
    console.log(`[ACP] Evaluation event for job ${job.id}, phase: ${job.phase}`);

    if (job.phase === AcpJobPhases.COMPLETED) {
      console.log(`[ACP] Job ${job.id} completed successfully`);
    } else if (job.phase === AcpJobPhases.REJECTED) {
      console.log(`[ACP] Job ${job.id} was rejected`);
      const internalJob = getJobByAcpId(String(job.id));
      if (internalJob) {
        const { updateJobStatus } = await import('./judgments.js');
        updateJobStatus(internalJob.id, 'rejected');
      }
    }
  } catch (err) {
    console.error(`[ACP] Error in evaluation for job ${job.id}:`, err);
  }
}

// ── Polling Fallback ──

function startPolling(): void {
  if (_pollInterval) return;

  _pollInterval = setInterval(async () => {
    try {
      await pollJobs();
      checkTimeouts();
      checkSessionTimeouts();
    } catch (err) {
      console.error('[ACP] Polling error:', err);
    }
  }, 30_000); // 30 seconds

  console.log('[ACP] Polling started (30s interval)');
}

async function pollJobs(): Promise<void> {
  if (!_acpClient) return;

  // Check for pending memo jobs that need our response
  const pendingJobs = await _acpClient.getPendingMemoJobs();

  for (const job of pendingJobs) {
    if (job.phase === AcpJobPhases.TRANSACTION) {
      // v1.0: Check for judgment delivery
      const internalJob = getJobByAcpId(String(job.id));
      if (internalJob && internalJob.status === 'delivered') {
        const judgment = getJudgmentForJob(internalJob.id);
        if (judgment) {
          const deliverable = formatDeliverable(judgment);
          await job.deliver(deliverable);
          console.log(`[ACP] Delivered judgment for job ${job.id} via polling`);
          continue;
        }
      }

      // v1.1: Check for completed session delivery
      const session = getSessionByAcpId(String(job.id));
      if (session && session.status === 'completed') {
        const deliverable = formatSessionDeliverable(session.id);
        await job.deliver(JSON.stringify(deliverable));
        console.log(`[ACP] Delivered session for job ${job.id} via polling`);
      }
    }
  }
}

// ── Deliver Judgment to ACP ──

export async function deliverToAcp(internalJobId: string): Promise<boolean> {
  if (!_acpClient) {
    console.log('[ACP] Not connected — judgment stored locally only');
    return false;
  }

  const internalJob = getJobById(internalJobId);
  if (!internalJob?.acpJobId) return false;

  const judgment = getJudgmentForJob(internalJobId);
  if (!judgment) return false;

  try {
    const acpJob = await _acpClient.getJobById(Number(internalJob.acpJobId));
    if (acpJob && acpJob.phase === AcpJobPhases.TRANSACTION) {
      const deliverable = formatDeliverable(judgment);
      await acpJob.deliver(deliverable);
      console.log(`[ACP] Delivered judgment for internal job ${internalJobId}`);
      return true;
    }
  } catch (err) {
    console.error(`[ACP] Failed to deliver job ${internalJobId}:`, err);
  }

  return false;
}

export async function deliverSessionToAcp(internalSessionId: string): Promise<boolean> {
  if (!_acpClient) {
    console.log('[ACP] Not connected — session stored locally only');
    return false;
  }

  const session = getSessionById(internalSessionId);
  if (!session?.acpJobId) return false;

  try {
    const acpJob = await _acpClient.getJobById(Number(session.acpJobId));
    if (acpJob && acpJob.phase === AcpJobPhases.TRANSACTION) {
      const deliverable = formatSessionDeliverable(internalSessionId);
      await acpJob.deliver(JSON.stringify(deliverable));
      console.log(`[ACP] Delivered session ${internalSessionId}`);
      return true;
    }
  } catch (err) {
    console.error(`[ACP] Failed to deliver session ${internalSessionId}:`, err);
  }

  return false;
}

// ── Getters ──

export function getAcpClient(): InstanceType<typeof AcpClient> | null {
  return _acpClient;
}

export function getOfferingDefinitions() {
  return OFFERINGS.map(o => ({
    name: o.name,
    description: o.description,
    priceUsdc: o.priceUsdc,
    defaultSlaMins: o.defaultSlaMins,
  }));
}

// ── Cleanup ──

export function stopAcp(): void {
  if (_pollInterval) {
    clearInterval(_pollInterval);
    _pollInterval = null;
  }
  _acpClient = null;
  console.log('[ACP] Stopped');
}
