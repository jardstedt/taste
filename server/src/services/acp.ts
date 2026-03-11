import acpModule, {
  AcpContractClientV2,
  AcpJob,
  AcpJobPhases,
  AcpMemo,
} from '@virtuals-protocol/acp-node';
import { encodeFunctionData } from 'viem';

// Handle double-nested default export in this SDK version
const AcpClient = (acpModule as unknown as { default: typeof acpModule }).default ?? acpModule;
import { getEnv } from '../config/env.js';
import { isOfferingEnabled, getEnabledSessionOfferings, getSessionOffering } from '../config/domains.js';
import { MEMO_BRIDGE_POLL_MS, MAX_DESCRIPTION_LENGTH, MAX_MEMO_LENGTH, MAX_VERDICT_REASON_LENGTH } from '../config/constants.js';
import {
  createSession, getSessionByAcpId, getSessionById,
  matchSession, notifyEligibleExperts, startSession, formatSessionDeliverable, checkSessionTimeouts,
  confirmSessionPayout, addMessage,
  getActiveAcpSessions, markPaymentReceived, cancelSessionFromAcp, getStuckAcpSessions,
} from './sessions.js';
import { notifyExpert, emitToSession } from './socket.js';
import { sendPushToExpert } from './push.js';
import { validateReferenceCode, redeemReferenceCode } from './referral.js';
import { validateRequirementSchema } from '../config/input-schemas.js';
import { aiPrefilterRequest } from './ai-prefilter.js';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';


/** Pattern for off-chain memo content URLs (SDK beta.37+) */
const MEMO_CONTENT_URL_RE = /api\/memo-contents\/\d+$/;

/**
 * Resolve memo content that may be either inline text or an off-chain URL reference.
 * SDK beta.37+ stores large payloads off-chain and puts only the URL on-chain.
 * Mirrors the pattern in AcpJob.getDeliverable().
 */
async function resolveMemoContent(content: string): Promise<string> {
  if (!_acpClient || !MEMO_CONTENT_URL_RE.test(content)) {
    return content;
  }
  try {
    const resolved = await _acpClient.getMemoContent(content);
    return typeof resolved === 'string' ? resolved : JSON.stringify(resolved);
  } catch {
    // Fallback to raw content if fetch fails
    return content;
  }
}

/** Format a requirement value for human-readable display in chat messages */
function formatRequirementValue(v: unknown): string {
  if (Array.isArray(v)) {
    if (v.length > 0 && typeof v[0] === 'object' && v[0] !== null && 'id' in v[0] && 'description' in v[0]) {
      return '\n' + v.map((item: Record<string, unknown>) => `  ${item.id}: ${item.description}`).join('\n');
    }
    if (v.every(item => typeof item === 'string' || typeof item === 'number')) {
      return v.join(', ');
    }
  }
  return JSON.stringify(v);
}

/**
 * After delivering, check if the evaluator is the zero address.
 * If so, no evaluator will ever approve — confirm payout immediately.
 * Also claims escrowed budget on-chain so the provider actually gets paid.
 */
async function autoConfirmIfNoEvaluator(job: AcpJob, sessionId: string): Promise<void> {
  if (job.evaluatorAddress === ZERO_ADDRESS) {
    const confirmed = confirmSessionPayout(sessionId);
    console.log(`[ACP] No evaluator (zero address) for job ${job.id} — auto-confirmed payout: ${confirmed}`);
    await claimJobBudget(job.id);
  }
}

// ── Budget Claiming ──

const CLAIM_BUDGET_ABI = [{
  inputs: [{ name: 'id', type: 'uint256' }],
  name: 'claimBudget',
  outputs: [],
  stateMutability: 'nonpayable',
  type: 'function',
}] as const;

/** Track claimed job IDs to avoid redundant on-chain calls within a process lifetime. */
const _claimedJobs = new Set<number>();

/**
 * Call claimBudget(jobId) on the JobManager contract to release escrowed funds.
 * For zero-evaluator jobs, this is the ONLY way funds get released to the provider.
 * For evaluator-path jobs, funds are already released by signMemo — this is a harmless no-op/revert.
 */
async function claimJobBudget(jobId: number): Promise<void> {
  if (!_acpClient || _claimedJobs.has(jobId)) return;
  _claimedJobs.add(jobId);

  const contractClient = _acpClient.acpContractClient as InstanceType<typeof AcpContractClientV2>;
  // jobManagerAddress is private in TS but accessible at runtime
  const jobManagerAddress = (contractClient as unknown as { jobManagerAddress: `0x${string}` }).jobManagerAddress;
  if (!jobManagerAddress) {
    console.warn('[ACP] Cannot claim budget — jobManagerAddress not available');
    return;
  }

  try {
    const data = encodeFunctionData({
      abi: CLAIM_BUDGET_ABI,
      functionName: 'claimBudget',
      args: [BigInt(jobId)],
    });
    await contractClient.handleOperation([{ data, contractAddress: jobManagerAddress }]);
    console.log(`[ACP] Claimed budget for job ${jobId}`);
  } catch (err) {
    // Expected for evaluator-path jobs (already claimed via signMemo)
    console.log(`[ACP] Budget claim for job ${jobId} skipped: ${(err as Error).message?.slice(0, 200)}`);
  }
}

let _acpClient: InstanceType<typeof AcpClient> | null = null;
let _pollInterval: ReturnType<typeof setInterval> | null = null;
let _memoBridgeInterval: ReturnType<typeof setInterval> | null = null;

// ── Job Processing Lock ──
// Prevents the same ACP job from being processed concurrently by both WebSocket and polling.
// The atomic SQL in createSession already prevents double-creation, but this makes the
// dedup intent explicit and avoids redundant ACP accept/reject calls.
const _processingJobs = new Set<number>();

// ── Memo Bridge State ──
// Track which ACP memo IDs we've already injected into chat to avoid duplicates.
// Key = acpJobId (string), Value = Set of memo IDs already seen.
const _seenMemoIds = new Map<string, Set<number>>();

// Active bridge subscriptions: acpJobId → sessionId for jobs we're bridging.
// Only these jobs get polled, not all active sessions.
const _bridgedJobs = new Map<string, string>();

// ── Offering Type Mapping ──

// Session offering keywords → type mapping for discoverability
const OFFERING_NAME_MAP: Record<string, string> = {
  // trust_evaluation
  'trust evaluation': 'trust_evaluation',
  'scam check': 'trust_evaluation',
  'legitimacy review': 'trust_evaluation',
  'due diligence': 'trust_evaluation',
  'is this legit': 'trust_evaluation',
  'scam': 'trust_evaluation',
  'legitimacy check': 'trust_evaluation',
  'rug pull': 'trust_evaluation',
  'project check': 'trust_evaluation',
  'token audit': 'trust_evaluation',
  'verify token': 'trust_evaluation',
  'token review': 'trust_evaluation',
  'project review': 'trust_evaluation',
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
  'human review': 'output_quality_gate',
  'ai review': 'output_quality_gate',
  'review ai output': 'output_quality_gate',
  'second opinion': 'output_quality_gate',
  'verify analysis': 'output_quality_gate',
  'validate output': 'output_quality_gate',
  'review report': 'output_quality_gate',
  'review analysis': 'output_quality_gate',
  'sanity check': 'output_quality_gate',
  'check output': 'output_quality_gate',
  // option_ranking
  'option ranking': 'option_ranking',
  'a/b test': 'option_ranking',
  'compare options': 'option_ranking',
  'pick the best': 'option_ranking',
  'which is better': 'option_ranking',
  'human a/b': 'option_ranking',
  'rank options': 'option_ranking',
  'human comparison': 'option_ranking',
  'compare content': 'option_ranking',
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
  'pre-publish': 'content_quality_gate',
  'publish review': 'content_quality_gate',
  'video review': 'content_quality_gate',
  'image review': 'content_quality_gate',
  'meme review': 'content_quality_gate',
  'review video': 'content_quality_gate',
  'review image': 'content_quality_gate',
  'check content': 'content_quality_gate',
  // audience_reaction_poll
  'audience reaction poll': 'audience_reaction_poll',
  'quick poll': 'audience_reaction_poll',
  'rate my content': 'audience_reaction_poll',
  'thumbnail test': 'audience_reaction_poll',
  'human poll': 'audience_reaction_poll',
  'human feedback': 'audience_reaction_poll',
  'get feedback': 'audience_reaction_poll',
  'rate this': 'audience_reaction_poll',
  'human rating': 'audience_reaction_poll',
  'score content': 'audience_reaction_poll',
  // creative_direction_check
  'creative direction check': 'creative_direction_check',
  'creative review': 'creative_direction_check',
  'concept check': 'creative_direction_check',
  'pre-production review': 'creative_direction_check',
  'creative brief': 'creative_direction_check',
  'concept review': 'creative_direction_check',
  'creative concept': 'creative_direction_check',
  'direction check': 'creative_direction_check',
  'creative check': 'creative_direction_check',
  // fact_check_verification
  'fact check': 'fact_check_verification',
  'source verification': 'fact_check_verification',
  'verify facts': 'fact_check_verification',
  'check accuracy': 'fact_check_verification',
  'human fact check': 'fact_check_verification',
  'hallucination check': 'fact_check_verification',
  'verify claims': 'fact_check_verification',
  'check sources': 'fact_check_verification',
  'verify research': 'fact_check_verification',
  'verify report': 'fact_check_verification',
  'human verification': 'fact_check_verification',
  // dispute_arbitration (evaluator jobs come via onEvaluate, not keyword — added for completeness)
  'dispute': 'dispute_arbitration',
  'arbitration': 'dispute_arbitration',
  'evaluate delivery': 'dispute_arbitration',
  'dispute resolution': 'dispute_arbitration',
  'delivery review': 'dispute_arbitration',
  'contract dispute': 'dispute_arbitration',
};

function resolveOfferingType(jobName: string): string | null {
  const lower = jobName.toLowerCase().trim().replace(/_/g, ' ');

  // Check if the name exactly matches an enabled offering type first
  const enabled = getEnabledSessionOfferings();
  const exactMatch = enabled.find(o => o.type === lower.replace(/ /g, '_'));
  if (exactMatch) return exactMatch.type;

  // Fuzzy keyword matching for agent-sent names
  for (const [key, type] of Object.entries(OFFERING_NAME_MAP)) {
    const normalizedKey = key.replace(/_/g, ' ');
    if (lower.includes(normalizedKey)) return type;
  }

  // No match — caller should reject
  return null;
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

  // Restore memo bridge for any active ACP sessions (server restart case)
  try {
    const activeSessions = getActiveAcpSessions();
    for (const row of activeSessions) {
      _bridgedJobs.set(row.acpJobId, row.id);
    }
    if (_bridgedJobs.size > 0) {
      startMemoBridge();
    }
  } catch {
    // Non-critical — bridge will start when next session goes active
  }

  return _acpClient;
}

// ── WebSocket Callbacks ──

async function handleNewTask(job: AcpJob, memoToSign?: AcpMemo): Promise<void> {
  // Dedup: skip if this job is already being processed (WebSocket + polling overlap)
  if (_processingJobs.has(job.id)) {
    console.log(`[ACP] Skipping job ${job.id} — already processing`);
    return;
  }
  _processingJobs.add(job.id);

  try {
    // Phase 1: Incoming job request — accept it
    if (
      job.phase === AcpJobPhases.REQUEST &&
      memoToSign?.nextPhase === AcpJobPhases.NEGOTIATION
    ) {
      console.log(`[ACP] New job request: ${job.id} (name: ${job.name})`);

      // Determine offering type from job name
      const offeringType = resolveOfferingType(job.name ?? String(job.id));

      // Reject unrecognized offering types
      if (!offeringType) {
        const available = getEnabledSessionOfferings().map(o => o.type).join(', ');
        console.log(`[ACP] Unrecognized offering in job ${job.id} (name: "${job.name}") — rejecting`);
        await job.reject(`Unrecognized offering type. Available offerings: ${available}`);
        return;
      }

      // Extract requirements from the first buyer memo or context
      let requirements: Record<string, unknown> = {};
      if (job.memos && job.memos.length > 0) {
        const firstMemo = job.memos[0];
        try {
          // Resolve off-chain content if memo is a URL reference (SDK beta.37+)
          const memoText = await resolveMemoContent(firstMemo.content);
          const parsed = JSON.parse(memoText);
          // ACP wraps the actual data under a "requirement" key
          if (parsed.requirement && typeof parsed.requirement === 'object') {
            requirements = parsed.requirement as Record<string, unknown>;
          } else {
            requirements = parsed;
          }
        } catch {
          // If not valid JSON, store as raw text (resolve in case it's a URL)
          const fallbackText = await resolveMemoContent(firstMemo.content);
          requirements = { rawRequest: fallbackText };
        }
      }
      if (job.context && Object.keys(job.context).length > 0) {
        requirements = { ...requirements, ...job.context };
      }

      console.log(`[ACP] Offering type: ${offeringType}, requirement keys: ${Object.keys(requirements).join(', ')}`);

      // Validate requirements (disabled offerings, empty input, token ops, compliance)
      const rejectionReason = _testValidateJobRequirements(requirements, offeringType);
      if (rejectionReason) {
        console.log(`[ACP] Job ${job.id} rejected: ${rejectionReason.slice(0, 80)}...`);
        await job.reject(rejectionReason);
        return;
      }

      // AI-powered pre-filter: catch garbage/test/spam that slips past regex patterns
      const aiRejection = await aiPrefilterRequest(requirements, offeringType);
      if (aiRejection) {
        console.log(`[ACP] Job ${job.id} AI-rejected: ${aiRejection.slice(0, 80)}...`);
        await job.reject(aiRejection);
        return;
      }

      // Detect follow-up reference code in requirements
      let followupOf: string | undefined;
      let discountedPrice: number | undefined;
      let detectedRefCode: string | undefined;

      const refCodeFromField = typeof requirements.referenceCode === 'string' ? requirements.referenceCode : undefined;
      const refCodeFromScan = !refCodeFromField
        ? JSON.stringify(requirements).match(/TASTE-[a-f0-9]{24}/)?.[0]
        : undefined;
      detectedRefCode = refCodeFromField ?? refCodeFromScan;

      if (detectedRefCode) {
        const validation = validateReferenceCode(detectedRefCode, offeringType);
        if (validation.valid) {
          followupOf = validation.sourceSessionId;
          const offering = getSessionOffering(offeringType);
          const basePrice = offering?.basePrice ?? 0.01;
          discountedPrice = Math.max(0.01, basePrice * (1 - validation.discountPct / 100));
          console.log(`[ACP] Follow-up code ${detectedRefCode} valid — ${validation.discountPct}% discount ($${discountedPrice})`);
        } else {
          console.log(`[ACP] Reference code ${detectedRefCode} invalid: ${validation.reason} — continuing at full price`);
          detectedRefCode = undefined; // Don't redeem
        }
      }

      // Create local session BEFORE accepting on-chain — if this fails, reject the job
      // so it doesn't get stuck in an accepted-but-untracked state
      let session;
      try {
        const existingSession = getSessionByAcpId(String(job.id));
        if (existingSession) {
          session = existingSession;
        } else {
          session = createSession({
            offeringType,
            acpJobId: String(job.id),
            buyerAgent: job.clientAddress ?? String(job.id),
            buyerAgentDisplay: job.name ?? `Agent ${job.id}`,
            description: JSON.stringify(requirements).slice(0, MAX_DESCRIPTION_LENGTH),
            followupOf,
            priceUsdc: discountedPrice,
          });
        }
      } catch (err) {
        console.error(`[ACP] Failed to create session for job ${job.id}:`, (err as Error).message ?? err);
        await job.reject('Internal error — please retry. Our service encountered an issue processing this request.');
        return;
      }

      // Session created successfully — now accept on-chain
      await job.accept('Human expert judgment service ready');
      await job.createRequirement('Payment required to proceed with human expert evaluation');

      console.log(`[ACP] Job ${job.id} accepted, session ${session.id} created`);

      // Track recurring buyer relationships (non-blocking)
      trackBuyerAccount(job).catch(err => console.error('[ACP] trackBuyerAccount failed:', err));

      // Redeem the reference code now that the session exists
      if (detectedRefCode && followupOf) {
        redeemReferenceCode(detectedRefCode, session.id);
        addMessage(session.id, 'system', null,
          'Follow-up review — 50% discount applied via reference code', 'system_notice');
      }

      // Seed chat with the buyer's requirement as the first message
      if (Object.keys(requirements).length > 0) {
        const reqText = Object.entries(requirements)
          .map(([k, v]) => `**${k}:** ${typeof v === 'string' ? v : formatRequirementValue(v)}`)
          .join('\n');
        addMessage(session.id, 'agent', null, reqText);
      }

      // Record all current memo IDs so the bridge doesn't re-inject them
      const seenIds = new Set(job.memos.map((m: AcpMemo) => m.id));
      _seenMemoIds.set(String(job.id), seenIds);

      const { session: matched, eligibleExpertIds } = matchSession(session.id);
      if (matched && eligibleExpertIds.length > 0) {
        notifyEligibleExperts(matched, eligibleExpertIds);
      }
    }
    // Phase 2: Payment received — check if judgment is ready
    else if (
      job.phase === AcpJobPhases.TRANSACTION &&
      memoToSign?.nextPhase === AcpJobPhases.EVALUATION
    ) {
      console.log(`[ACP] Payment received for job ${job.id}`);

      // Check session status — if no session exists, create one on the fly
      let session = getSessionByAcpId(String(job.id));
      if (!session) {
        console.warn(`[ACP] Payment received for job ${job.id} but no local session — creating recovery session`);
        try {
          const reqContent = job.memos?.find((m: AcpMemo) => m.nextPhase === AcpJobPhases.NEGOTIATION)?.content;
          let recoveryReqs: Record<string, unknown> = {};
          if (reqContent) {
            try {
              const parsed = JSON.parse(typeof reqContent === 'string' ? reqContent : JSON.stringify(reqContent));
              recoveryReqs = parsed.requirement ?? parsed;
            } catch { recoveryReqs = { rawRequest: String(reqContent) }; }
          }
          const recoveryType = resolveOfferingType(job.name ?? '') ?? 'trust_evaluation';
          session = createSession({
            offeringType: recoveryType,
            acpJobId: String(job.id),
            buyerAgent: job.clientAddress ?? String(job.id),
            buyerAgentDisplay: job.name ?? `Agent ${job.id}`,
            description: JSON.stringify(recoveryReqs).slice(0, MAX_DESCRIPTION_LENGTH),
          });
          console.log(`[ACP] Recovery session ${session.id} created for job ${job.id}`);
        } catch (err) {
          console.error(`[ACP] Failed to create recovery session for job ${job.id}:`, (err as Error).message ?? err);
        }
      }
      if (session) {
        markPaymentReceived(session.id);
        if (session.status === 'completed') {
          const sessionDeliverable = formatSessionDeliverable(session.id);
          await job.deliver(JSON.stringify(sessionDeliverable));
          console.log(`[ACP] Job ${job.id} delivered via session ${session.id}`);
          await autoConfirmIfNoEvaluator(job, session.id);
        } else if (session.status === 'timeout' || session.status === 'cancelled') {
          // Expert explicitly declined → deliver a decline response so the buyer
          // sees the reason instead of treating it as a generic rejection/retry
          if (session.cancelReason) {
            const declineDeliverable = {
              status: 'declined',
              summary: `Expert reviewed the request but could not fulfill it: ${session.cancelReason}`,
              offering: session.offeringType,
              reason: session.cancelReason,
              recommendation: 'Please resubmit the job — a different expert will be assigned.',
            };
            await job.deliver(JSON.stringify(declineDeliverable));
            console.log(`[ACP] Job ${job.id} delivered decline for session ${session.id}: ${session.cancelReason}`);
            await autoConfirmIfNoEvaluator(job, session.id);
          } else {
            const reason = session.status === 'timeout'
              ? 'Expert ran out of time and could not complete the review. Funds fully refunded. Please resubmit — a different expert will be assigned.'
              : session.expertId
                ? 'Expert accepted but did not complete the task in time. Funds fully refunded. Please resubmit — a different expert will be assigned.'
                : 'No expert was available within the time window. Funds fully refunded. Please resubmit — experts are notified in real-time and availability varies.';
            await job.reject(reason);
            console.log(`[ACP] Job ${job.id} rejected (session ${session.status}) — agent refunded`);
          }
        } else if (session.status === 'accepted') {
          startSession(session.id);
          // Register for memo bridging and seed seen-memo state
          const seenIds = _seenMemoIds.get(String(job.id)) ?? new Set<number>();
          for (const m of job.memos) seenIds.add(m.id);
          _seenMemoIds.set(String(job.id), seenIds);
          _bridgedJobs.set(String(job.id), session.id);
          startMemoBridge();
          console.log(`[ACP] Session ${session.id} started (payment received)`);
        }
        // Notify dashboard so "Awaiting payment" badge clears in real time
        const updated = getSessionById(session.id);
        if (updated) emitToSession(session.id, 'session:updated', updated);
      }
    }
  } catch (err) {
    console.error(`[ACP] Error handling job ${job.id}`);
  } finally {
    _processingJobs.delete(job.id);
  }
}

async function handleEvaluate(job: AcpJob): Promise<void> {
  try {
    console.log(`[ACP] Evaluation event for job ${job.id}, phase: ${job.phase}`);

    // Check if this is a third-party evaluator assignment (not our own provider job)
    const existingSession = getSessionByAcpId(String(job.id));
    const jobDeliverable = await job.getDeliverable();
    if (!existingSession && jobDeliverable) {
      await handleEvaluatorAssignment(job, jobDeliverable);
      return;
    }

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

      // Release escrowed funds on-chain (critical for zero-evaluator jobs)
      claimJobBudget(job.id).catch(() => {});
    } else if (job.phase === AcpJobPhases.EXPIRED) {
      console.log(`[ACP] Job ${job.id} expired on-chain`);

      // Treat like a cancellation — no expert payout, no reputation penalty
      const session = getSessionByAcpId(String(job.id));
      if (session && session.status !== 'cancelled' && session.status !== 'timeout') {
        cancelSessionFromAcp(session.id, 'ACP job expired on-chain. Session closed, agent refunded.');
        console.log(`[ACP] Session ${session.id} cancelled due to on-chain expiry`);
      }
    } else if (job.phase === AcpJobPhases.REJECTED) {
      console.log(`[ACP] Job ${job.id} was rejected by agent`);

      // Update session — agent disputed the result
      const session = getSessionByAcpId(String(job.id));
      if (session && session.status === 'completed') {
        cancelSessionFromAcp(session.id,
          `Agent disputed the result${job.rejectionReason ? ': ' + job.rejectionReason : ''}. Expert payout revoked.`);

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

// ── Evaluator Assignment ──

async function handleEvaluatorAssignment(job: AcpJob, rawDeliverable: unknown): Promise<void> {
  let deliverable: unknown;
  const deliverableStr = typeof rawDeliverable === 'string' ? rawDeliverable : JSON.stringify(rawDeliverable);
  try { deliverable = JSON.parse(deliverableStr); } catch { deliverable = rawDeliverable; }

  const description = [
    `**Dispute Evaluation Request** (ACP Job #${job.id})`,
    ``,
    `**Provider:** ${job.providerAddress}`,
    `**Buyer:** ${job.clientAddress}`,
    ``,
    `**Original Job Name:** ${job.name ?? 'Unknown'}`,
    `**Original Requirement:**`,
    JSON.stringify(job.requirement ?? 'Not provided', null, 2),
    ``,
    `**Provider's Deliverable:**`,
    JSON.stringify(deliverable, null, 2),
    ``,
    `Please review whether the provider's deliverable satisfactorily fulfills the original requirement. Submit your verdict using the structured form.`,
  ].join('\n');

  const session = createSession({
    offeringType: 'dispute_arbitration',
    tierId: 'quick',
    description,
    tags: ['evaluator', 'dispute'],
    buyerAgent: job.clientAddress,
    acpJobId: String(job.id),
    priceUsdc: 0.01,
  });

  addMessage(session.id, 'system', null, description, 'system_notice');

  const { session: matched, eligibleExpertIds } = matchSession(session.id);
  if (matched && eligibleExpertIds.length > 0) {
    notifyEligibleExperts(matched, eligibleExpertIds, 'Dispute Evaluation');
  }

  console.log(`[ACP] Created evaluator session ${session.id} for job ${job.id}`);
}

export async function submitEvaluatorVerdict(sessionId: string): Promise<void> {
  if (!_acpClient) return;

  const session = getSessionById(sessionId);
  if (!session || session.offeringType !== 'dispute_arbitration' || !session.acpJobId) return;

  const deliverable = formatSessionDeliverable(sessionId);
  if (!deliverable) return;

  const structuredAssessment = deliverable.structuredAssessment as Record<string, unknown> | null;
  const verdict = structuredAssessment?.verdict;
  const approved = verdict === 'approve';
  const reason = String(
    structuredAssessment?.summary
    || deliverable.summary
    || (approved ? 'Deliverable meets requirements' : 'Deliverable does not meet requirements'),
  ).slice(0, MAX_VERDICT_REASON_LENGTH);

  try {
    const job = await _acpClient.getJobById(Number(session.acpJobId));
    if (!job) {
      console.error(`[ACP] Evaluator: job ${session.acpJobId} not found`);
      return;
    }
    await job.evaluate(approved, reason);
    console.log(`[ACP] Evaluator verdict submitted for job ${session.acpJobId}: ${approved ? 'APPROVED' : 'REJECTED'}`);
  } catch (err) {
    console.error(`[ACP] Failed to submit evaluator verdict for job ${session.acpJobId}:`, err);
  }
}

// ── Polling Fallback ──

function startPolling(): void {
  if (_pollInterval) return;

  _pollInterval = setInterval(async () => {
    try {
      await pollJobs();
      checkSessionTimeouts();
      await reconcileStuckSessions();
    } catch (err) {
      console.error('[ACP] Polling error');
    }
  }, 30_000); // 30 seconds

  console.log('[ACP] Polling started (30s interval)');
}

// Track ACP job IDs that we've already delivered/rejected via polling so we
// don't keep retrying them if getPendingMemoJobs() returns them again.
const _resolvedPollingJobs = new Set<number>();

async function pollJobs(): Promise<void> {
  if (!_acpClient) return;

  // Check for pending memo jobs that need our response
  const pendingJobs = await _acpClient.getPendingMemoJobs();

  for (const job of pendingJobs) {
    if (_resolvedPollingJobs.has(job.id)) continue;

    if (job.phase === AcpJobPhases.TRANSACTION) {
      // Check for session delivery or rejection
      const session = getSessionByAcpId(String(job.id));
      if (session) {
        try {
          if (session.status === 'completed') {
            const deliverable = formatSessionDeliverable(session.id);
            await job.deliver(JSON.stringify(deliverable));
            console.log(`[ACP] Delivered session for job ${job.id} via polling`);
            await autoConfirmIfNoEvaluator(job, session.id);
            _resolvedPollingJobs.add(job.id);
          } else if (session.status === 'timeout' || session.status === 'cancelled') {
            await job.reject(`Session ${session.status} — expert did not complete the task. You have been fully refunded. Please try again and a new expert will be assigned.`);
            console.log(`[ACP] Rejected job ${job.id} via polling (session ${session.status}) — agent refunded`);
            _resolvedPollingJobs.add(job.id);
          }
        } catch {
          // Will retry next cycle — don't add to resolved set
        }
      }
    }
  }

}

// ── Memo Bridge ──

/**
 * Start the memo bridge polling loop (10s).
 * Auto-stops when there are no active ACP sessions to avoid wasted cycles.
 * Called when a new ACP-linked session is created or payment is received.
 */
export function startMemoBridge(): void {
  if (_memoBridgeInterval || !_acpClient) return;

  _memoBridgeInterval = setInterval(async () => {
    try {
      const hadSessions = await bridgeInboundMemos();
      if (!hadSessions) {
        // No active ACP sessions — stop polling until needed again
        stopMemoBridge();
        console.log('[ACP] Memo bridge stopped — no active ACP sessions');
      }
    } catch {
      // Non-critical — will retry next cycle
    }
  }, MEMO_BRIDGE_POLL_MS);

  console.log(`[ACP] Memo bridge started (${MEMO_BRIDGE_POLL_MS / 1000}s interval)`);
}

function stopMemoBridge(): void {
  if (_memoBridgeInterval) {
    clearInterval(_memoBridgeInterval);
    _memoBridgeInterval = null;
  }
}

/**
 * Memo Bridge — Inbound
 * Poll only the registered bridged jobs for new buyer memos.
 * Returns true if there are still jobs to bridge (so caller knows whether to keep polling).
 */
async function bridgeInboundMemos(): Promise<boolean> {
  if (!_acpClient || _bridgedJobs.size === 0) return false;

  const providerAddress = _acpClient.walletAddress?.toLowerCase();
  if (!providerAddress) return false;

  for (const [acpJobId, sessionId] of _bridgedJobs) {
    try {
      // Verify session is still active
      const session = getSessionById(sessionId);
      if (!session || !['active', 'wrapping_up'].includes(session.status)) {
        _bridgedJobs.delete(acpJobId);
        _seenMemoIds.delete(acpJobId);
        continue;
      }

      const job = await _acpClient!.getJobById(Number(acpJobId));
      if (!job || job.phase !== AcpJobPhases.TRANSACTION) {
        _bridgedJobs.delete(acpJobId);
        _seenMemoIds.delete(acpJobId);
        continue;
      }

      const seen = _seenMemoIds.get(acpJobId) ?? new Set<number>();

      for (const memo of job.memos) {
        if (seen.has(memo.id)) continue;
        seen.add(memo.id);

        // Only inject memos from the buyer (not our own provider memos)
        if (memo.senderAddress.toLowerCase() === providerAddress) continue;

        // Resolve content — may be inline text or an off-chain URL (SDK beta.37+)
        const rawContent = await resolveMemoContent(memo.content);
        const content = rawContent.slice(0, MAX_MEMO_LENGTH);
        const message = addMessage(sessionId, 'agent', null, content);
        emitToSession(sessionId, 'message:new', message);

        // Push notification so expert sees it even with tab closed
        if (session.expertId) {
          const preview = content.length > 100 ? content.slice(0, 100) + '...' : content;
          sendPushToExpert(session.expertId, {
            title: 'New Message',
            body: preview,
            tag: `chat-${sessionId}`,
            data: { url: `/dashboard/session/${sessionId}`, sessionId, type: 'message' },
          }).catch(err => console.error('[ACP] Push failed for memo bridge:', err));
        }

        console.log(`[ACP] Memo bridge: injected memo ${memo.id} from buyer into session ${sessionId}`);
      }

      _seenMemoIds.set(acpJobId, seen);
    } catch {
      // Non-critical — will retry next poll cycle
    }
  }

  return _bridgedJobs.size > 0;
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
      await autoConfirmIfNoEvaluator(acpJob, internalSessionId);
      return true;
    }
  } catch (err) {
    console.error(`[ACP] Failed to deliver session ${internalSessionId}`);
  }

  return false;
}

/**
 * Memo Bridge — Outbound
 * Relay an expert's chat message to the buying agent as an ACP notification memo.
 * Called from socket handler and REST route when an expert sends a message
 * on an ACP-linked session.
 */
// Toggle: use MESSAGE (type 0, unsecured) instead of NOTIFICATION (type 9, secured).
// MESSAGE memos are the standard type used throughout ACP and more likely to be
// processed by buyer agents like Butler. Set to false to revert to createNotification.
const USE_MESSAGE_MEMO_FOR_RELAY = true;

export async function relayExpertMessageToAcp(
  internalSessionId: string,
  content: string,
): Promise<boolean> {
  if (!_acpClient) return false;

  const session = getSessionById(internalSessionId);
  if (!session?.acpJobId) return false;

  try {
    const acpJob = await _acpClient.getJobById(Number(session.acpJobId));
    if (!acpJob || acpJob.phase !== AcpJobPhases.TRANSACTION) return false;

    const safeMemo = content.slice(0, MAX_MEMO_LENGTH);

    if (USE_MESSAGE_MEMO_FOR_RELAY) {
      // Send as MESSAGE memo (type 0, unsecured) — stays in TRANSACTION phase.
      // More likely to be read by buyer agents than NOTIFICATION type.
      const contractClient = _acpClient.acpContractClient as InstanceType<typeof AcpContractClientV2>;
      const payload = contractClient.createMemo(
        Number(session.acpJobId),
        safeMemo,
        0,    // MESSAGE type
        false, // unsecured — publicly readable
        AcpJobPhases.TRANSACTION, // stay in current phase
      );
      await contractClient.handleOperation([payload]);
    } else {
      // Original: NOTIFICATION memo (type 9, secured)
      await acpJob.createNotification(safeMemo);
    }

    // Record the memo we just sent so the inbound bridge ignores it
    // (next poll will see our own memo — we skip it via senderAddress check,
    // but also add to seen set as extra protection)
    const seen = _seenMemoIds.get(session.acpJobId) ?? new Set<number>();
    _seenMemoIds.set(session.acpJobId, seen);

    console.log(`[ACP] Memo bridge: relayed expert message to buyer for job ${session.acpJobId}`);
    return true;
  } catch (err) {
    console.error(`[ACP] Memo bridge: failed to relay expert message for session ${internalSessionId}:`, err);
    return false;
  }
}

export async function rejectSessionOnAcp(internalSessionId: string, reason?: string): Promise<boolean> {
  if (!_acpClient) {
    console.log('[ACP] Not connected — decline stored locally only, reconciler will retry');
    return false;
  }

  const session = getSessionById(internalSessionId);
  if (!session?.acpJobId) return false;

  const declineReason = reason ?? 'Expert could not fulfill this request';

  try {
    const acpJob = await _acpClient.getJobById(Number(session.acpJobId));
    if (!acpJob) {
      console.log(`[ACP] Job ${session.acpJobId} not found — reconciler will retry`);
      return false;
    }

    // Pre-payment: safe to reject since no funds are at stake
    if (acpJob.phase === AcpJobPhases.NEGOTIATION) {
      await acpJob.reject(`Expert declined: ${declineReason}`);
      console.log(`[ACP] Rejected session ${internalSessionId} in NEGOTIATION phase (pre-payment decline)`);
      return true;
    }

    // Post-payment: deliver a decline response instead of rejecting.
    // ACP rejection triggers buyer retry; a deliverable lets the buyer
    // read the reason and decide what to do.
    if (acpJob.phase === AcpJobPhases.TRANSACTION) {
      const declineDeliverable = {
        status: 'declined',
        summary: `Expert reviewed the request but could not fulfill it: ${declineReason}`,
        offering: session.offeringType,
        reason: declineReason,
        recommendation: 'Please resubmit the job — a different expert will be assigned.',
      };
      await acpJob.deliver(JSON.stringify(declineDeliverable));
      console.log(`[ACP] Delivered decline for session ${internalSessionId}: ${declineReason}`);
      await autoConfirmIfNoEvaluator(acpJob, internalSessionId);
      return true;
    }

    console.log(`[ACP] Cannot process decline for session ${internalSessionId} — job ${session.acpJobId} in unexpected phase: ${acpJob.phase}. Reconciler will retry if applicable.`);
    return false;
  } catch (err) {
    console.error(`[ACP] Failed to decline session ${internalSessionId}:`, err);
    return false;
  }
}

// ── Stuck-State Reconciliation ──

/**
 * Detect sessions stuck in completed/cancelled/timeout whose ACP jobs
 * are still in TRANSACTION phase. Deliver or reject on ACP to unblock them.
 */
// Track session IDs that have been reconciled (or confirmed terminal) so we
// don't retry them every polling cycle.  Persists until process restart, at
// which point the ACP jobs will already be in a terminal phase.
const _reconciledSessionIds = new Set<string>();

async function reconcileStuckSessions(): Promise<void> {
  if (!_acpClient) return;

  const stuckRows = getStuckAcpSessions();

  for (const row of stuckRows) {
    if (_reconciledSessionIds.has(row.id)) continue;

    try {
      const acpJob = await _acpClient!.getJobById(Number(row.acpJobId));
      if (!acpJob) {
        _reconciledSessionIds.add(row.id);
        continue;
      }

      // Job already in a terminal phase — nothing to do, stop retrying
      if (acpJob.phase !== AcpJobPhases.TRANSACTION) {
        _reconciledSessionIds.add(row.id);
        continue;
      }

      if (row.status === 'completed') {
        const deliverable = formatSessionDeliverable(row.id);
        await acpJob.deliver(JSON.stringify(deliverable));
        console.log(`[ACP] Reconciled: delivered stuck session ${row.id}`);
        await autoConfirmIfNoEvaluator(acpJob, row.id);
      } else if (row.cancelReason) {
        // Expert explicitly declined — deliver a decline response instead of rejecting
        const declineDeliverable = {
          status: 'declined',
          summary: `Expert reviewed the request but could not fulfill it: ${row.cancelReason}`,
          offering: row.status,
          reason: row.cancelReason,
          recommendation: 'Please resubmit the job — a different expert will be assigned.',
        };
        await acpJob.deliver(JSON.stringify(declineDeliverable));
        console.log(`[ACP] Reconciled: delivered decline for session ${row.id}: ${row.cancelReason}`);
        await autoConfirmIfNoEvaluator(acpJob, row.id);
      } else {
        // Timeouts and cancellations: deliver a structured response so Butler
        // sees the reason instead of interpreting a reject() as "try again".
        const timeoutReason = row.status === 'timeout'
          ? 'Expert ran out of time and could not complete the review.'
          : 'No expert was available or the task was not completed in time.';
        const timeoutDeliverable = {
          status: row.status === 'timeout' ? 'timeout' : 'cancelled',
          summary: timeoutReason,
          offering: row.offeringType ?? 'unknown',
          reason: timeoutReason,
          recommendation: 'Please resubmit the job — a different expert will be assigned. You are fully refunded.',
        };
        await acpJob.deliver(JSON.stringify(timeoutDeliverable));
        console.log(`[ACP] Reconciled: delivered ${row.status} for session ${row.id}`);
        await autoConfirmIfNoEvaluator(acpJob, row.id);
      }

      _reconciledSessionIds.add(row.id);
    } catch {
      // Will retry on next polling cycle — do NOT add to reconciled set
    }
  }
}

// ── Account Tracking ──

/** ACP Account shape (not directly exported from SDK) */
interface AcpAccountInfo {
  id: number;
  clientAddress: string;
  providerAddress: string;
  metadata: Record<string, unknown>;
}

/**
 * Look up the ACP Account relationship between a buyer and Taste.
 * Returns the Account if one exists (persistent agent-agent relationship).
 */
export async function getAccountForAgent(clientAddress: string): Promise<AcpAccountInfo | null> {
  if (!_acpClient) return null;

  try {
    const account = await _acpClient.getByClientAndProvider(
      clientAddress as `0x${string}`,
      _acpClient.walletAddress,
    );
    if (!account) return null;
    return {
      id: account.id,
      clientAddress: account.clientAddress,
      providerAddress: account.providerAddress,
      metadata: account.metadata,
    };
  } catch {
    return null;
  }
}

/**
 * Look up the ACP Account associated with a specific job.
 */
export async function getAccountForJob(jobId: number): Promise<AcpAccountInfo | null> {
  if (!_acpClient) return null;

  try {
    const account = await _acpClient.getAccountByJobId(jobId);
    if (!account) return null;
    return {
      id: account.id,
      clientAddress: account.clientAddress,
      providerAddress: account.providerAddress,
      metadata: account.metadata,
    };
  } catch {
    return null;
  }
}

/**
 * Track recurring buyer agents. Called when a new job arrives.
 * Logs account relationship info for monitoring.
 */
async function trackBuyerAccount(job: AcpJob): Promise<void> {
  if (!_acpClient) return;

  try {
    const account = await _acpClient.getByClientAndProvider(
      job.clientAddress,
      _acpClient.walletAddress,
    );

    if (account) {
      console.log(`[ACP] Recurring buyer: account #${account.id} with ${job.clientAddress.slice(0, 10)}...`);
      if (account.metadata && Object.keys(account.metadata).length > 0) {
        console.log(`[ACP] Account metadata: ${JSON.stringify(account.metadata)}`);
      }
    }
  } catch {
    // Non-critical — don't fail the job handling
  }
}

// ── Getters ──

/** Exposed for unit testing only */
export const _testResolveOfferingType = resolveOfferingType;

/**
 * Validate job requirements before accepting. Returns null if valid,
 * or a rejection reason string if the job should be rejected.
 * Extracted for testability — mirrors the inline checks in handleNewTask().
 */
export function _testValidateJobRequirements(
  requirements: Record<string, unknown>,
  offeringType: string,
): string | null {
  // Disabled offering
  if (!isOfferingEnabled(offeringType)) {
    return `The "${offeringType}" offering is currently unavailable. Please try a different service type.`;
  }

  // Empty/garbled requirements (LLM ambiguity guard)
  const reqText = JSON.stringify(requirements).toLowerCase();
  if (Object.keys(requirements).length === 0 || reqText.length < 10) {
    return 'No requirements provided. Please include a description of what you need reviewed or evaluated.';
  }

  // Token/chain operations — not our service (skip for dispute_arbitration which may contain code)
  const TOKEN_OP_PATTERNS = /\b(swap|transfer|send|bridge|stake|unstake|mint|burn|approve|withdraw)\b.*\b(token|eth|usdc|usdt|sol|bnb|matic|avax)\b/i;
  if (offeringType !== 'dispute_arbitration' && TOKEN_OP_PATTERNS.test(reqText) && !/\b(review|evaluate|check|assess|opinion|judge|rate|rank|dispute|arbitrat|contract|deliverable)\b/i.test(reqText)) {
    return 'Taste provides human expert judgment, not token operations. We cannot execute swaps, transfers, or other blockchain transactions. If you need a human review of a DeFi strategy, please rephrase your request as an evaluation.';
  }

  // Risk/compliance-violating requests
  const COMPLIANCE_PATTERNS = /\b(hack|exploit|phishing|steal|launder|money.?launder|illegal|child|csam|doxx|attack|ddos|ransomware|hate\s*speech|racist|racism|bigot\w*|discriminat\w*|harass\w*|threaten\w*|threat\w*|terroris\w*|extremis\w*|gore|torture|self.?harm|suicide|spamming|spam\s+groups?|shill\w*)\b/i;
  // Violent/harmful content — match phrases describing harmful content itself
  const HARMFUL_CONTENT = /\b(violent\s+(\w+\s+)?(graphic|content|material|description|imagery|video|image|depiction)|graphic\s+(\w+\s+)?(violent|violence|imagery|image|content|depiction|description)|visible\s+(casualt|injur|dead|death|wound)|harm\s+to\s+others|graphic\s+description\s+of\s+harm)\b/i;
  if (HARMFUL_CONTENT.test(reqText)) {
    return 'This request appears to involve prohibited content or activities. Taste cannot process requests related to illegal activities, exploitation, or attacks.';
  }
  if (COMPLIANCE_PATTERNS.test(reqText)) {
    return 'This request appears to involve prohibited content or activities. Taste cannot process requests related to illegal activities, exploitation, or attacks.';
  }

  // NSFW / inappropriate content filter
  const NSFW_PATTERNS = /\b(nsfw|nude|nudity|naked|porn\w*|explicit\s+(\w+\s+)?(sexual|content|material|image|imagery|video|photo)|non.?consensual|adult\s+(film|content|material|video)|sexually\s+explicit|graphic\s+(sexual|violence|nsfw)|xxx|erotic\w*|hentai|sex\s+scene)\b/i;
  if (NSFW_PATTERNS.test(reqText)) {
    return 'This request contains NSFW or inappropriate content. Taste cannot process requests involving explicit sexual content, graphic violence, or adult material.';
  }

  // Validate requirement fields against offering input schema
  const schemaError = validateRequirementSchema(requirements, offeringType);
  if (schemaError) {
    return schemaError;
  }

  return null; // Valid — no rejection
}

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

// ── On-Chain Inspector (read-only, no gas) ──

const PHASE_NAMES: Record<number, string> = {
  [AcpJobPhases.REQUEST]: 'REQUEST',
  [AcpJobPhases.NEGOTIATION]: 'NEGOTIATION',
  [AcpJobPhases.TRANSACTION]: 'TRANSACTION',
  [AcpJobPhases.EVALUATION]: 'EVALUATION',
  [AcpJobPhases.COMPLETED]: 'COMPLETED',
  [AcpJobPhases.REJECTED]: 'REJECTED',
  [AcpJobPhases.EXPIRED]: 'EXPIRED',
};

const MEMO_TYPE_NAMES: Record<number, string> = {
  0: 'MESSAGE',
  1: 'CONTEXT_URL',
  2: 'IMAGE_URL',
  3: 'VOICE_URL',
  4: 'OBJECT_URL',
  5: 'TXHASH',
  6: 'PAYABLE_REQUEST',
  7: 'PAYABLE_TRANSFER',
  8: 'PAYABLE_TRANSFER_ESCROW',
  9: 'NOTIFICATION',
  10: 'PAYABLE_NOTIFICATION',
};

const MEMO_STATUS_NAMES: Record<string, string> = {
  '0': 'PENDING',
  '1': 'APPROVED',
  '2': 'REJECTED',
};

export interface AcpJobInspection {
  acpJobId: number;
  phase: string;
  phaseCode: number;
  clientAddress: string;
  providerAddress: string;
  evaluatorAddress: string;
  price: number;
  deliverable: string | Record<string, unknown> | null;
  rejectionReason: string | null;
  requirement: unknown;
  memos: Array<{
    id: number;
    type: string;
    typeCode: number;
    status: string;
    senderAddress: string;
    content: string;
    nextPhase: string;
    txHash: string | null;
    signedTxHash: string | null;
  }>;
  localSession: {
    id: string;
    status: string;
    expertId: string | null;
    offeringType: string;
    createdAt: string;
  } | null;
}

export async function inspectAcpJob(acpJobId: number): Promise<AcpJobInspection | null> {
  if (!_acpClient) return null;

  const job = await _acpClient.getJobById(acpJobId);
  if (!job) return null;

  // Find local session linked to this ACP job
  const session = getSessionByAcpId(String(acpJobId));
  const jobDeliverable = await job.getDeliverable();

  return {
    acpJobId: job.id,
    phase: PHASE_NAMES[job.phase] ?? `UNKNOWN(${job.phase})`,
    phaseCode: job.phase,
    clientAddress: job.clientAddress,
    providerAddress: job.providerAddress,
    evaluatorAddress: job.evaluatorAddress,
    price: job.price,
    deliverable: jobDeliverable ?? null,
    rejectionReason: job.rejectionReason ?? null,
    requirement: job.requirement ?? null,
    memos: (job.memos ?? []).map(m => ({
      id: m.id,
      type: MEMO_TYPE_NAMES[m.type] ?? `UNKNOWN(${m.type})`,
      typeCode: m.type,
      status: MEMO_STATUS_NAMES[String(m.status)] ?? String(m.status),
      senderAddress: m.senderAddress,
      content: m.content,
      nextPhase: PHASE_NAMES[m.nextPhase] ?? `UNKNOWN(${m.nextPhase})`,
      txHash: m.txHash ?? null,
      signedTxHash: m.signedTxHash ?? null,
    })),
    localSession: session ? {
      id: session.id,
      status: session.status,
      expertId: session.expertId,
      offeringType: session.offeringType,
      createdAt: session.createdAt,
    } : null,
  };
}

export async function inspectSessionAcp(sessionId: string): Promise<AcpJobInspection | null> {
  const session = getSessionById(sessionId);
  if (!session?.acpJobId) return null;
  return inspectAcpJob(Number(session.acpJobId));
}

export async function listAcpJobs(): Promise<AcpJobInspection[]> {
  if (!_acpClient) return [];

  const results: AcpJobInspection[] = [];

  // Fetch from all categories
  const [active, pending, completed, cancelled] = await Promise.all([
    _acpClient.getActiveJobs().catch(() => [] as AcpJob[]),
    _acpClient.getPendingMemoJobs().catch(() => [] as AcpJob[]),
    _acpClient.getCompletedJobs().catch(() => [] as AcpJob[]),
    _acpClient.getCancelledJobs().catch(() => [] as AcpJob[]),
  ]);

  // Deduplicate by job ID
  const seen = new Set<number>();
  const allJobs = [...active, ...pending, ...completed, ...cancelled];

  for (const job of allJobs) {
    if (seen.has(job.id)) continue;
    seen.add(job.id);

    const session = getSessionByAcpId(String(job.id));
    const jobDeliverable = await job.getDeliverable();

    results.push({
      acpJobId: job.id,
      phase: PHASE_NAMES[job.phase] ?? `UNKNOWN(${job.phase})`,
      phaseCode: job.phase,
      clientAddress: job.clientAddress,
      providerAddress: job.providerAddress,
      evaluatorAddress: job.evaluatorAddress,
      price: job.price,
      deliverable: jobDeliverable ?? null,
      rejectionReason: job.rejectionReason ?? null,
      requirement: job.requirement ?? null,
      memos: (job.memos ?? []).map(m => ({
        id: m.id,
        type: MEMO_TYPE_NAMES[m.type] ?? `UNKNOWN(${m.type})`,
        typeCode: m.type,
        status: MEMO_STATUS_NAMES[String(m.status)] ?? String(m.status),
        senderAddress: m.senderAddress,
        content: m.content,
        nextPhase: PHASE_NAMES[m.nextPhase] ?? `UNKNOWN(${m.nextPhase})`,
        txHash: m.txHash ?? null,
        signedTxHash: m.signedTxHash ?? null,
      })),
      localSession: session ? {
        id: session.id,
        status: session.status,
        expertId: session.expertId,
        offeringType: session.offeringType,
        createdAt: session.createdAt,
      } : null,
    });
  }

  return results.sort((a, b) => b.acpJobId - a.acpJobId);
}

// ── Retroactive Budget Claiming ──

/**
 * Claim escrowed budget for all completed ACP jobs.
 * Use this to retroactively release funds for jobs that completed
 * before the claimBudget logic was deployed.
 */
export async function claimAllCompletedJobs(): Promise<{ claimed: number[]; skipped: number[]; failed: number[] }> {
  if (!_acpClient) throw new Error('ACP not connected');

  const result = { claimed: [] as number[], skipped: [] as number[], failed: [] as number[] };

  const completedJobs = await _acpClient.getCompletedJobs().catch(() => [] as AcpJob[]);
  console.log(`[ACP] Claiming budget for ${completedJobs.length} completed jobs`);

  for (const job of completedJobs) {
    if (_claimedJobs.has(job.id)) {
      result.skipped.push(job.id);
      continue;
    }

    // Only claim for jobs where we are the provider
    if (job.providerAddress.toLowerCase() !== _acpClient.walletAddress.toLowerCase()) {
      result.skipped.push(job.id);
      continue;
    }

    try {
      // Temporarily remove from set so claimJobBudget doesn't skip
      _claimedJobs.delete(job.id);
      await claimJobBudget(job.id);
      result.claimed.push(job.id);
    } catch {
      result.failed.push(job.id);
    }
  }

  console.log(`[ACP] Claim sweep: ${result.claimed.length} claimed, ${result.skipped.length} skipped, ${result.failed.length} failed`);
  return result;
}

// ── Stuck Job Scanner ──

/**
 * Check on-chain status for all our DB sessions that have ACP job IDs.
 * Returns a summary grouped by on-chain phase plus details for each job.
 */
export async function checkOurJobStatuses(
  since?: string,
): Promise<{ summary: Record<string, number>; jobs: Array<{ jobId: number; phase: string; localStatus: string; offeringType: string; createdAt: string }> }> {
  if (!_acpClient) throw new Error('ACP not connected');

  const db = (await import('../db/database.js')).getDb();
  const query = since
    ? `SELECT acp_job_id, status, offering_type, created_at FROM sessions WHERE acp_job_id IS NOT NULL AND created_at >= ? ORDER BY created_at DESC`
    : `SELECT acp_job_id, status, offering_type, created_at FROM sessions WHERE acp_job_id IS NOT NULL ORDER BY created_at DESC LIMIT 100`;
  const rows = (since ? db.prepare(query).all(since) : db.prepare(query).all()) as Array<{
    acp_job_id: number; status: string; offering_type: string; created_at: string;
  }>;

  const summary: Record<string, number> = {};
  const jobs: Array<{ jobId: number; phase: string; localStatus: string; offeringType: string; createdAt: string }> = [];

  for (const row of rows) {
    try {
      const job = await _acpClient.getJobById(Number(row.acp_job_id));
      const phase = job ? (PHASE_NAMES[job.phase] ?? `UNKNOWN(${job.phase})`) : 'NOT_FOUND';
      summary[phase] = (summary[phase] || 0) + 1;
      jobs.push({ jobId: row.acp_job_id, phase, localStatus: row.status, offeringType: row.offering_type, createdAt: row.created_at });
    } catch {
      summary['ERROR'] = (summary['ERROR'] || 0) + 1;
      jobs.push({ jobId: row.acp_job_id, phase: 'ERROR', localStatus: row.status, offeringType: row.offering_type, createdAt: row.created_at });
    }
  }

  return { summary, jobs };
}

/**
 * Scan a range of job IDs and process any that are stuck (not in terminal phase).
 * Used when the SDK's list methods don't return older jobs.
 */
export async function scanAndProcessStuckJobs(
  startId: number,
  endId: number,
): Promise<{ processed: number[]; skipped: number[]; failed: Array<{ id: number; error: string }> }> {
  if (!_acpClient) throw new Error('ACP not connected');

  const result = {
    processed: [] as number[],
    skipped: [] as number[],
    failed: [] as Array<{ id: number; error: string }>,
  };

  for (let id = startId; id <= endId; id++) {
    try {
      const job = await _acpClient.getJobById(id);
      if (!job) { result.skipped.push(id); continue; }

      // Skip jobs not addressed to us
      if (job.providerAddress.toLowerCase() !== _acpClient.walletAddress.toLowerCase()) {
        result.skipped.push(id);
        continue;
      }

      // Skip terminal phases
      if (job.phase === AcpJobPhases.COMPLETED || job.phase === AcpJobPhases.REJECTED) {
        result.skipped.push(id);
        continue;
      }

      console.log(`[ACP] Scan found stuck job ${id} in phase ${PHASE_NAMES[job.phase]}, memos: ${job.memos?.length ?? 0}`);

      // For TRANSACTION or EVALUATION phase: try direct delivery if we have a completed session
      if (job.phase === AcpJobPhases.TRANSACTION || job.phase === AcpJobPhases.EVALUATION) {
        const session = getSessionByAcpId(String(id));
        if (session?.status === 'completed') {
          const deliverable = formatSessionDeliverable(session.id);
          await job.deliver(JSON.stringify(deliverable));
          console.log(`[ACP] Scan: delivered completed session ${session.id} for job ${id}`);
          await autoConfirmIfNoEvaluator(job, session.id);
          result.processed.push(id);
          continue;
        }
        // Session exists but not completed — log and skip
        if (session) {
          console.log(`[ACP] Scan: job ${id} has session ${session.id} in status ${session.status} — waiting for completion`);
          result.skipped.push(id);
          continue;
        }
        // No session — fall through to handleNewTask to create one
        console.log(`[ACP] Scan: job ${id} in TRANSACTION but no local session — creating via handleNewTask`);
      }

      // Try to process through the normal handler (finds pending memo by status)
      _processingJobs.delete(id); // Clear dedup lock
      const pendingMemo = job.memos?.find((m: AcpMemo) =>
        String(m.status) === '0' || String(m.status).toUpperCase() === 'PENDING'
      );
      console.log(`[ACP] Scan: pending memo for job ${id}: ${pendingMemo ? `id=${pendingMemo.id} nextPhase=${pendingMemo.nextPhase}` : 'none found'}`);
      await handleNewTask(job, pendingMemo);
      result.processed.push(id);
    } catch (err) {
      result.failed.push({ id, error: (err as Error).message?.slice(0, 100) ?? 'unknown' });
    }
  }

  console.log(`[ACP] Scan complete: ${result.processed.length} processed, ${result.skipped.length} skipped, ${result.failed.length} failed`);
  return result;
}

// ── Cleanup ──

export function stopAcp(): void {
  if (_pollInterval) {
    clearInterval(_pollInterval);
    _pollInterval = null;
  }
  stopMemoBridge();
  _acpClient = null;
  _seenMemoIds.clear();
  _bridgedJobs.clear();
  _processingJobs.clear();
  _reconciledSessionIds.clear();
  _resolvedPollingJobs.clear();
  _claimedJobs.clear();
  console.log('[ACP] Stopped');
}
