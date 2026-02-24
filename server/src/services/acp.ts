import acpModule, {
  AcpContractClientV2,
  AcpJob,
  AcpJobPhases,
  AcpMemo,
} from '@virtuals-protocol/acp-node';

// Handle double-nested default export in this SDK version
const AcpClient = (acpModule as unknown as { default: typeof acpModule }).default ?? acpModule;
import { getEnv } from '../config/env.js';
import { isOfferingEnabled, getEnabledSessionOfferings } from '../config/domains.js';
import {
  createSession, getSessionByAcpId, getSessionById,
  matchSession, startSession, formatSessionDeliverable, checkSessionTimeouts,
  checkAllIdleSessions, confirmSessionPayout,
} from './sessions.js';
import { notifyExpert } from './socket.js';

let _acpClient: InstanceType<typeof AcpClient> | null = null;
let _pollInterval: ReturnType<typeof setInterval> | null = null;

// ── Offering Type Mapping ──

// Session offering keywords → type mapping for discoverability
const OFFERING_NAME_MAP: Record<string, string> = {
  // trust_evaluation
  'trust evaluation': 'trust_evaluation',
  'scam check': 'trust_evaluation',
  'legitimacy review': 'trust_evaluation',
  'due diligence': 'trust_evaluation',
  'is this legit': 'trust_evaluation',
  // cultural_context
  'cultural context': 'cultural_context',
  'trend check': 'cultural_context',
  'cultural insight': 'cultural_context',
  'vibe check on trends': 'cultural_context',
  // output_quality_gate
  'output quality gate': 'output_quality_gate',
  'ai output review': 'output_quality_gate',
  'quality check': 'output_quality_gate',
  'human qa': 'output_quality_gate',
  'review my output': 'output_quality_gate',
  // option_ranking
  'option ranking': 'option_ranking',
  'a/b test': 'option_ranking',
  'compare options': 'option_ranking',
  'pick the best': 'option_ranking',
  'which is better': 'option_ranking',
  // blind_spot_check
  'blind spot check': 'blind_spot_check',
  'ai sanity check': 'blind_spot_check',
  'what am i missing': 'blind_spot_check',
  'gap analysis': 'blind_spot_check',
  // human_reaction_prediction
  'human reaction prediction': 'human_reaction_prediction',
  'audience reaction': 'human_reaction_prediction',
  'will people like this': 'human_reaction_prediction',
  'sentiment prediction': 'human_reaction_prediction',
  // expert_brainstorming
  'expert brainstorming': 'expert_brainstorming',
  'brainstorm session': 'expert_brainstorming',
  'idea generation': 'expert_brainstorming',
  'creative session': 'expert_brainstorming',
  // content_quality_gate
  'content quality gate': 'content_quality_gate',
  'pre-publish review': 'content_quality_gate',
  'content review': 'content_quality_gate',
  'brand safety check': 'content_quality_gate',
  // audience_reaction_poll
  'audience reaction poll': 'audience_reaction_poll',
  'quick poll': 'audience_reaction_poll',
  'rate my content': 'audience_reaction_poll',
  'thumbnail test': 'audience_reaction_poll',
  // creative_direction_check
  'creative direction check': 'creative_direction_check',
  'creative review': 'creative_direction_check',
  'concept check': 'creative_direction_check',
  'pre-production review': 'creative_direction_check',
  'creative brief': 'creative_direction_check',
};

function resolveOfferingType(jobName: string): string {
  const lower = jobName.toLowerCase().trim().replace(/_/g, ' ');

  for (const [key, type] of Object.entries(OFFERING_NAME_MAP)) {
    const normalizedKey = key.replace(/_/g, ' ');
    if (lower.includes(normalizedKey)) return type;
  }

  // Default to trust_evaluation as the most general session offering
  return 'trust_evaluation';
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

      console.log(`[ACP] Offering type: ${offeringType}, requirement keys: ${Object.keys(requirements).join(', ')}`);

      // Reject disabled offerings
      if (!isOfferingEnabled(offeringType)) {
        console.log(`[ACP] Offering "${offeringType}" is disabled — rejecting job ${job.id}`);
        await job.reject(`The "${offeringType}" offering is currently unavailable. Please try a different service type.`);
        return;
      }

      await job.accept('Human expert judgment service ready');
      await job.createRequirement('Payment required to proceed with human expert evaluation');

      console.log(`[ACP] Job ${job.id} accepted`);

      // Create session and match expert
      try {
        const existingSession = getSessionByAcpId(String(job.id));
        if (!existingSession) {
          const session = createSession({
            offeringType,
            acpJobId: String(job.id),
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
        console.error(`[ACP] Failed to create session for job ${job.id}`);
      }
    }
    // Phase 2: Payment received — check if judgment is ready
    else if (
      job.phase === AcpJobPhases.TRANSACTION &&
      memoToSign?.nextPhase === AcpJobPhases.EVALUATION
    ) {
      console.log(`[ACP] Payment received for job ${job.id}`);

      // Check session status
      const session = getSessionByAcpId(String(job.id));
      if (session) {
        if (session.status === 'completed') {
          const sessionDeliverable = formatSessionDeliverable(session.id);
          await job.deliver(JSON.stringify(sessionDeliverable));
          console.log(`[ACP] Job ${job.id} delivered via session ${session.id}`);
        } else if (session.status === 'timeout' || session.status === 'cancelled') {
          await job.reject(`Session ${session.status} — expert did not complete the task. You have been fully refunded. Please try again and a new expert will be assigned.`);
          console.log(`[ACP] Job ${job.id} rejected (session ${session.status}) — agent refunded`);
        } else if (session.status === 'accepted') {
          startSession(session.id);
          console.log(`[ACP] Session ${session.id} started (payment received)`);
        }
      }
    }
  } catch (err) {
    console.error(`[ACP] Error handling job ${job.id}`);
  }
}

async function handleEvaluate(job: AcpJob): Promise<void> {
  try {
    console.log(`[ACP] Evaluation event for job ${job.id}, phase: ${job.phase}`);

    if (job.phase === AcpJobPhases.COMPLETED) {
      console.log(`[ACP] Job ${job.id} completed successfully`);

      // Confirm expert payout now that ACP has verified delivery
      const session = getSessionByAcpId(String(job.id));
      if (session) {
        const confirmed = confirmSessionPayout(session.id);
        if (confirmed) {
          console.log(`[ACP] Payout confirmed for session ${session.id}`);
        }
      }
    } else if (job.phase === AcpJobPhases.EXPIRED) {
      console.log(`[ACP] Job ${job.id} expired on-chain`);

      // Treat like a cancellation — no expert payout, no reputation penalty
      const session = getSessionByAcpId(String(job.id));
      if (session && session.status !== 'cancelled' && session.status !== 'timeout') {
        const { getDb } = await import('../db/database.js');
        const db = getDb();
        db.prepare(
          "UPDATE sessions SET status = 'cancelled', expert_payout_usdc = 0, completed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?",
        ).run(session.id);

        const { addMessage } = await import('./sessions.js');
        addMessage(session.id, 'system', null, 'ACP job expired on-chain. Session closed, agent refunded.', 'system_notice');

        console.log(`[ACP] Session ${session.id} cancelled due to on-chain expiry`);
      }
    } else if (job.phase === AcpJobPhases.REJECTED) {
      console.log(`[ACP] Job ${job.id} was rejected by agent`);

      // Update session — agent disputed the result
      const session = getSessionByAcpId(String(job.id));
      if (session && session.status === 'completed') {
        const { getDb } = await import('../db/database.js');
        const db = getDb();
        // Revoke expert payout — agent rejected the deliverable
        db.prepare(
          "UPDATE sessions SET status = 'cancelled', expert_payout_usdc = 0, updated_at = datetime('now') WHERE id = ?",
        ).run(session.id);

        const { addMessage } = await import('./sessions.js');
        addMessage(session.id, 'system', null,
          `Agent disputed the result${job.rejectionReason ? ': ' + job.rejectionReason : ''}. Expert payout revoked.`,
          'system_notice');

        // Negative reputation for disputed delivery
        if (session.expertId) {
          const { getSessionOffering } = await import('../config/domains.js');
          const { getExpertById } = await import('./experts.js');
          const { recordEvent } = await import('./reputation.js');
          const offering = getSessionOffering(session.offeringType);
          const expert = getExpertById(session.expertId);
          if (offering && expert) {
            for (const domain of offering.relevantDomains) {
              if (expert.domains.includes(domain)) {
                recordEvent(session.expertId, domain, 'rejected', undefined, 'Agent disputed the delivered result');
                break;
              }
            }
          }
        }

        console.log(`[ACP] Session ${session.id} marked as disputed — expert payout revoked`);
      }
    }
  } catch (err) {
    console.error(`[ACP] Error in evaluation for job ${job.id}`);
  }
}

// ── Polling Fallback ──

function startPolling(): void {
  if (_pollInterval) return;

  _pollInterval = setInterval(async () => {
    try {
      await pollJobs();
      checkSessionTimeouts();
      checkAllIdleSessions();
      await reconcileStuckSessions();
    } catch (err) {
      console.error('[ACP] Polling error');
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
      // Check for session delivery or rejection
      const session = getSessionByAcpId(String(job.id));
      if (session) {
        if (session.status === 'completed') {
          const deliverable = formatSessionDeliverable(session.id);
          await job.deliver(JSON.stringify(deliverable));
          console.log(`[ACP] Delivered session for job ${job.id} via polling`);
        } else if (session.status === 'timeout' || session.status === 'cancelled') {
          await job.reject(`Session ${session.status} — expert did not complete the task. You have been fully refunded. Please try again and a new expert will be assigned.`);
          console.log(`[ACP] Rejected job ${job.id} via polling (session ${session.status}) — agent refunded`);
        }
      }
    }
  }
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
    console.error(`[ACP] Failed to deliver session ${internalSessionId}`);
  }

  return false;
}

export async function rejectSessionOnAcp(internalSessionId: string): Promise<boolean> {
  if (!_acpClient) {
    console.log('[ACP] Not connected — rejection stored locally only');
    return false;
  }

  const session = getSessionById(internalSessionId);
  if (!session?.acpJobId) return false;

  try {
    const acpJob = await _acpClient.getJobById(Number(session.acpJobId));
    if (acpJob && acpJob.phase === AcpJobPhases.TRANSACTION) {
      await acpJob.reject(`Session ${session.status} — expert did not complete the task. You have been fully refunded. Please try again and a new expert will be assigned.`);
      console.log(`[ACP] Rejected session ${internalSessionId} (${session.status}) — agent refunded`);
      return true;
    }
  } catch (err) {
    console.error(`[ACP] Failed to reject session ${internalSessionId}`);
  }

  return false;
}

// ── Stuck-State Reconciliation ──

/**
 * Detect sessions stuck in completed/cancelled/timeout whose ACP jobs
 * are still in TRANSACTION phase. Deliver or reject on ACP to unblock them.
 */
async function reconcileStuckSessions(): Promise<void> {
  if (!_acpClient) return;

  const { getDb } = await import('../db/database.js');
  const db = getDb();

  // Find completed sessions with ACP jobs that haven't been delivered yet
  const stuckRows = db.prepare(
    "SELECT * FROM sessions WHERE acp_job_id IS NOT NULL AND status IN ('completed', 'cancelled', 'timeout') AND completed_at < datetime('now', '-2 minutes')",
  ).all() as Array<{ id: string; acp_job_id: string; status: string }>;

  for (const row of stuckRows) {
    try {
      const acpJob = await _acpClient!.getJobById(Number(row.acp_job_id));
      if (!acpJob || acpJob.phase !== AcpJobPhases.TRANSACTION) continue;

      if (row.status === 'completed') {
        const deliverable = formatSessionDeliverable(row.id);
        await acpJob.deliver(JSON.stringify(deliverable));
        console.log(`[ACP] Reconciled: delivered stuck session ${row.id}`);
      } else {
        await acpJob.reject(`Session ${row.status} — expert did not complete the task. Agent refunded.`);
        console.log(`[ACP] Reconciled: rejected stuck session ${row.id} (${row.status})`);
      }
    } catch {
      // Will retry on next polling cycle
    }
  }
}

// ── Getters ──

export function getAcpClient(): InstanceType<typeof AcpClient> | null {
  return _acpClient;
}

export function getOfferingDefinitions() {
  return getEnabledSessionOfferings().map(o => ({
    type: o.type,
    name: o.name,
    description: o.description,
    defaultTier: o.defaultTier,
    relevantDomains: o.relevantDomains,
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
