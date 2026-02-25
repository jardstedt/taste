/**
 * Agent Simulator — Buyer ACP Client Service
 *
 * Wraps the ACP SDK as a buyer agent for testing/demo.
 * Reuses the whitelisted private key + entity key but connects with a different wallet address.
 *
 * Safety guards:
 *   - Hard max fee: 0.01 USDC
 *   - Gas price cap: 0.5 gwei on Base
 */

import acpModule, {
  AcpContractClientV2,
  AcpJobPhases,
} from '@virtuals-protocol/acp-node';

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getEnv } from '../config/env.js';

// Handle double-nested default export
const AcpClient = (acpModule as unknown as { default: typeof acpModule }).default ?? acpModule;

// ── Safety Limits ──

const MAX_FEE_USDC = 0.01;
const MAX_GAS_PRICE_GWEI = 0.5;
const BASE_RPC = 'https://mainnet.base.org';

// ── Default buyer wallet (test buyer from test-buyer.ts) ──

const DEFAULT_BUYER_WALLET = '0xB0047828089f2196528E116a7334f863b8E0364A';

// ── State ──

let _buyerClient: InstanceType<typeof AcpClient> | null = null;
let _buyerWallet: string = '';

interface TrackedJob {
  phase: number;
  memos: Array<{ content: string; sender: string }>;
  createdAt: string;
}

const _activeJobs = new Map<number, TrackedJob>();

// ── Offerings from Virtuals registration ──

interface OfferingSpec {
  name: string;
  description: string;
  requirement: string;
  jobInput: string;
  jobOutput: string;
}

let _offeringSpecs: OfferingSpec[] | null = null;

function loadOfferingSpecs(): OfferingSpec[] {
  if (_offeringSpecs) return _offeringSpecs;

  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const filePath = resolve(__dirname, '../../../offerings.json');
    const raw = JSON.parse(readFileSync(filePath, 'utf-8')) as {
      jobs: Array<{ name: string; description: string; requirement: string; jobInput: string; jobOutput: string }>;
    };
    _offeringSpecs = raw.jobs.map(j => ({
      name: j.name,
      description: j.description,
      requirement: j.requirement,
      jobInput: j.jobInput,
      jobOutput: j.jobOutput,
    }));
  } catch {
    _offeringSpecs = [];
  }

  return _offeringSpecs;
}

// ── Phase labels ──

function phaseLabel(phase: number): string {
  const labels: Record<number, string> = {
    [AcpJobPhases.REQUEST]: 'REQUEST',
    [AcpJobPhases.NEGOTIATION]: 'NEGOTIATION',
    [AcpJobPhases.TRANSACTION]: 'TRANSACTION',
    [AcpJobPhases.EVALUATION]: 'EVALUATION',
    [AcpJobPhases.COMPLETED]: 'COMPLETED',
    [AcpJobPhases.REJECTED]: 'REJECTED',
  };
  return labels[phase] ?? `UNKNOWN(${phase})`;
}

// ── Gas Price Check ──

async function checkGasPrice(): Promise<{ ok: boolean; gweiPrice: number }> {
  try {
    const res = await fetch(BASE_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_gasPrice', params: [], id: 1 }),
    });
    const json = await res.json() as { result: string };
    const weiPrice = BigInt(json.result);
    const gweiPrice = Number(weiPrice) / 1e9;
    return { ok: gweiPrice <= MAX_GAS_PRICE_GWEI, gweiPrice };
  } catch (err) {
    console.error('[AgentSim] Could not check gas price:', err);
    return { ok: false, gweiPrice: -1 };
  }
}

async function assertGasSafe(action: string): Promise<void> {
  const { ok, gweiPrice } = await checkGasPrice();
  if (!ok) {
    throw new Error(
      `Gas price ${gweiPrice.toFixed(4)} gwei exceeds limit of ${MAX_GAS_PRICE_GWEI} gwei. Refusing to execute: ${action}`,
    );
  }
}

// ── Public API ──

export async function initBuyerClient(): Promise<{ wallet: string }> {
  if (_buyerClient) {
    return { wallet: _buyerWallet };
  }

  const env = getEnv();

  if (!env.ACP_WALLET_PRIVATE_KEY || !env.ACP_SESSION_ENTITY_KEY_ID) {
    throw new Error('Missing required ACP configuration');
  }

  // Check gas before initializing (init itself costs gas for WebSocket registration)
  await assertGasSafe('initBuyerClient');

  const privateKey = env.ACP_WALLET_PRIVATE_KEY.startsWith('0x')
    ? env.ACP_WALLET_PRIVATE_KEY
    : `0x${env.ACP_WALLET_PRIVATE_KEY}`;

  const entityKeyId = parseInt(env.ACP_SESSION_ENTITY_KEY_ID, 10);
  _buyerWallet = process.env.ACP_BUYER_WALLET_ADDRESS ?? DEFAULT_BUYER_WALLET;

  const contractClient = await AcpContractClientV2.build(
    privateKey as `0x${string}`,
    entityKeyId,
    _buyerWallet as `0x${string}`,
  );

  _buyerClient = new AcpClient({
    acpContractClient: contractClient,
    onNewTask: (job: { id: number; phase: number }) => {
      console.log(`[AgentSim] Event — new task: job ${job.id}, phase ${phaseLabel(job.phase)}`);
      const existing = _activeJobs.get(job.id);
      if (existing) {
        existing.phase = job.phase;
      }
    },
    onEvaluate: (job: { id: number; phase: number }) => {
      console.log(`[AgentSim] Event — evaluate: job ${job.id}, phase ${phaseLabel(job.phase)}`);
      const existing = _activeJobs.get(job.id);
      if (existing) {
        existing.phase = job.phase;
      }
    },
  });

  await _buyerClient.init();
  console.log(`[AgentSim] Buyer client connected — wallet ${_buyerWallet}`);

  return { wallet: _buyerWallet };
}

export async function getBuyerStatus(): Promise<{
  connected: boolean;
  wallet: string | null;
  gasPrice: number | null;
}> {
  const { gweiPrice } = await checkGasPrice();
  return {
    connected: _buyerClient !== null,
    wallet: _buyerClient ? _buyerWallet : null,
    gasPrice: gweiPrice >= 0 ? gweiPrice : null,
  };
}

export async function discoverOfferings(): Promise<Array<{
  index: number;
  name: string;
  price: number;
  requirementFields: string;
  exampleInput: string;
}>> {
  if (!_buyerClient) throw new Error('Buyer client not initialized');

  const env = getEnv();
  const tasteWallet = env.ACP_AGENT_WALLET_ADDRESS;
  if (!tasteWallet) throw new Error('ACP_AGENT_WALLET_ADDRESS not configured');

  const tasteAgent = await _buyerClient.getAgent(tasteWallet as `0x${string}`);
  if (!tasteAgent) throw new Error('Could not find Taste agent at ' + tasteWallet);

  const specs = loadOfferingSpecs();

  return tasteAgent.jobOfferings.map((o: { name: string; price: number }, i: number) => {
    // Match by name to get the Virtuals-registered example data
    const spec = specs.find(s => s.name === o.name);
    return {
      index: i,
      name: o.name,
      price: o.price,
      requirementFields: spec?.requirement ?? '',
      exampleInput: spec?.jobInput ?? '{}',
    };
  });
}

export async function createBuyerJob(
  offeringIndex: number,
  requirementData: Record<string, unknown>,
): Promise<{ jobId: number }> {
  if (!_buyerClient) throw new Error('Buyer client not initialized');

  const env = getEnv();
  const tasteWallet = env.ACP_AGENT_WALLET_ADDRESS;
  if (!tasteWallet) throw new Error('ACP_AGENT_WALLET_ADDRESS not configured');

  const tasteAgent = await _buyerClient.getAgent(tasteWallet as `0x${string}`);
  if (!tasteAgent) throw new Error('Could not find Taste agent');

  if (offeringIndex < 0 || offeringIndex >= tasteAgent.jobOfferings.length) {
    throw new Error(`Invalid offering index ${offeringIndex}. Available: 0-${tasteAgent.jobOfferings.length - 1}`);
  }
  const offering = tasteAgent.jobOfferings[offeringIndex];

  // Safety: fee limit
  if (offering.price > MAX_FEE_USDC) {
    throw new Error(
      `Offering price ${offering.price} USDC exceeds hard limit of ${MAX_FEE_USDC} USDC`,
    );
  }

  // Safety: gas check
  await assertGasSafe('createBuyerJob');

  const jobId: number = await offering.initiateJob(requirementData);

  _activeJobs.set(jobId, {
    phase: AcpJobPhases.REQUEST,
    memos: [],
    createdAt: new Date().toISOString(),
  });

  console.log(`[AgentSim] Job created: ${jobId}`);
  return { jobId };
}

export async function getJobStatus(jobId: number): Promise<{
  id: number;
  phase: string;
  phaseNum: number;
  price: number;
  memos: Array<{ content: string }>;
}> {
  if (!_buyerClient) throw new Error('Buyer client not initialized');

  const job = await _buyerClient.getJobById(jobId);
  if (!job) throw new Error(`Job ${jobId} not found`);

  // Update local tracking
  const tracked = _activeJobs.get(jobId);
  if (tracked) {
    tracked.phase = job.phase;
  }

  return {
    id: job.id,
    phase: phaseLabel(job.phase),
    phaseNum: job.phase,
    price: job.price ?? 0,
    memos: (job.memos ?? []).map((m: { content: string }) => ({
      content: typeof m.content === 'string' ? m.content.slice(0, 1000) : JSON.stringify(m.content).slice(0, 1000),
    })),
  };
}

export async function payForJob(jobId: number): Promise<{ success: boolean }> {
  if (!_buyerClient) throw new Error('Buyer client not initialized');

  await assertGasSafe('payForJob');

  const job = await _buyerClient.getJobById(jobId);
  if (!job) throw new Error(`Job ${jobId} not found`);

  if (job.phase !== AcpJobPhases.NEGOTIATION) {
    throw new Error(`Job ${jobId} is in phase ${phaseLabel(job.phase)}, expected NEGOTIATION`);
  }

  // Double-check fee before paying
  if (job.price > MAX_FEE_USDC) {
    throw new Error(`Job price ${job.price} USDC exceeds limit of ${MAX_FEE_USDC} USDC`);
  }

  await job.payAndAcceptRequirement();
  console.log(`[AgentSim] Paid for job ${jobId}: ${job.price} USDC`);

  const tracked = _activeJobs.get(jobId);
  if (tracked) tracked.phase = AcpJobPhases.TRANSACTION;

  return { success: true };
}

export async function acceptDeliverable(jobId: number, memo?: string): Promise<{ success: boolean }> {
  if (!_buyerClient) throw new Error('Buyer client not initialized');

  await assertGasSafe('acceptDeliverable');

  const job = await _buyerClient.getJobById(jobId);
  if (!job) throw new Error(`Job ${jobId} not found`);

  if (job.phase !== AcpJobPhases.EVALUATION) {
    throw new Error(`Job ${jobId} is in phase ${phaseLabel(job.phase)}, expected EVALUATION`);
  }

  const safeMemo = (memo ?? 'Accepted via admin demo').slice(0, 500).trim();
  await job.accept(safeMemo);
  console.log(`[AgentSim] Accepted deliverable for job ${jobId}`);

  const tracked = _activeJobs.get(jobId);
  if (tracked) tracked.phase = AcpJobPhases.COMPLETED;

  return { success: true };
}

export async function rejectDeliverable(jobId: number, memo?: string): Promise<{ success: boolean }> {
  if (!_buyerClient) throw new Error('Buyer client not initialized');

  await assertGasSafe('rejectDeliverable');

  const job = await _buyerClient.getJobById(jobId);
  if (!job) throw new Error(`Job ${jobId} not found`);

  if (job.phase !== AcpJobPhases.EVALUATION) {
    throw new Error(`Job ${jobId} is in phase ${phaseLabel(job.phase)}, expected EVALUATION`);
  }

  const safeMemo = (memo ?? 'Rejected via admin demo').slice(0, 500).trim();
  await job.reject(safeMemo);
  console.log(`[AgentSim] Rejected deliverable for job ${jobId}`);

  const tracked = _activeJobs.get(jobId);
  if (tracked) tracked.phase = AcpJobPhases.REJECTED;

  return { success: true };
}

export function getActiveJobs(): Array<{
  jobId: number;
  phase: string;
  createdAt: string;
}> {
  return Array.from(_activeJobs.entries()).map(([jobId, info]) => ({
    jobId,
    phase: phaseLabel(info.phase),
    createdAt: info.createdAt,
  }));
}

export function getSampleRequests() {
  const specs = loadOfferingSpecs();
  return specs.map(s => ({
    name: s.name,
    data: safeJsonParse(s.jobInput),
    requirementFields: s.requirement,
  }));
}

function safeJsonParse(json: string): Record<string, unknown> {
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

export function stopBuyerClient(): void {
  _buyerClient = null;
  _buyerWallet = '';
  _activeJobs.clear();
  console.log('[AgentSim] Buyer client stopped');
}
