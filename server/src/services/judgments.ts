import { getDb, generateId, auditLog } from '../db/database.js';
import type { Judgment, Job, OfferingType, Domain } from '../types/index.js';
import { JUDGMENT_DISCLAIMER, PROHIBITED_PHRASES } from '../types/index.js';
import { getOffering, getDomainsForOffering } from '../config/domains.js';
import { getExpertById, selectBestExpert, incrementCompletedJobs } from './experts.js';
import { recordEvent } from './reputation.js';

// ── Row Mapping ──

interface JobRow {
  id: string;
  acp_job_id: string | null;
  offering_type: string;
  status: string;
  expert_id: string | null;
  requirements: string;
  buyer_agent: string | null;
  price_usdc: number;
  sla_minutes: number;
  assigned_at: string | null;
  deadline_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
}

function rowToJob(row: JobRow): Job {
  return {
    id: row.id,
    acpJobId: row.acp_job_id,
    offeringType: row.offering_type as OfferingType,
    status: row.status as Job['status'],
    expertId: row.expert_id,
    requirements: JSON.parse(row.requirements),
    buyerAgent: row.buyer_agent,
    priceUsdc: row.price_usdc,
    slaMinutes: row.sla_minutes,
    assignedAt: row.assigned_at,
    deadlineAt: row.deadline_at,
    deliveredAt: row.delivered_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface JudgmentRow {
  id: string;
  job_id: string;
  expert_id: string;
  offering_type: string;
  content: string;
  disclaimer: string;
  expert_name: string;
  expert_public_profile: string | null;
  submitted_at: string;
}

function rowToJudgment(row: JudgmentRow): Judgment {
  return {
    id: row.id,
    jobId: row.job_id,
    expertId: row.expert_id,
    offeringType: row.offering_type as OfferingType,
    content: JSON.parse(row.content),
    disclaimer: row.disclaimer,
    expertName: row.expert_name,
    expertPublicProfile: row.expert_public_profile,
    submittedAt: row.submitted_at,
  };
}

// ── Job CRUD ──

export function createJob(
  offeringType: OfferingType,
  requirements: Record<string, unknown>,
  acpJobId?: string,
  buyerAgent?: string,
  priceUsdc?: number,
): Job {
  const db = getDb();
  const id = generateId();
  const offering = getOffering(offeringType);
  const price = priceUsdc ?? offering?.priceUsdc ?? 0.5;
  const slaMins = offering?.defaultSlaMins ?? 120;

  db.prepare(
    `INSERT INTO jobs (id, acp_job_id, offering_type, requirements, buyer_agent, price_usdc, sla_minutes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, acpJobId ?? null, offeringType, JSON.stringify(requirements), buyerAgent ?? null, price, slaMins);

  auditLog('job', id, 'created', { offeringType, buyerAgent, priceUsdc: price });

  // Auto-assign to best expert
  const domains = getDomainsForOffering(offeringType);
  let assigned = false;
  for (const domain of domains) {
    const expert = selectBestExpert(domain);
    if (expert) {
      assignJob(id, expert.id);
      assigned = true;
      break;
    }
  }

  if (!assigned) {
    auditLog('job', id, 'no_expert_available', { domains });
  }

  return getJobById(id)!;
}

export function assignJob(jobId: string, expertId: string): void {
  const db = getDb();
  const job = getJobById(jobId);
  if (!job) return;

  const deadlineAt = new Date(Date.now() + job.slaMinutes * 60 * 1000).toISOString();

  db.prepare(
    `UPDATE jobs
     SET expert_id = ?, status = 'assigned', assigned_at = datetime('now'), deadline_at = ?, updated_at = datetime('now')
     WHERE id = ?`,
  ).run(expertId, deadlineAt, jobId);

  auditLog('job', jobId, 'assigned', { expertId, deadlineAt });
}

export function getJobById(id: string): Job | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id) as JobRow | undefined;
  return row ? rowToJob(row) : null;
}

export function getJobByAcpId(acpJobId: string): Job | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM jobs WHERE acp_job_id = ?').get(acpJobId) as JobRow | undefined;
  return row ? rowToJob(row) : null;
}

export function getJobsForExpert(expertId: string, status?: string): Job[] {
  const db = getDb();
  let rows: JobRow[];
  if (status) {
    rows = db.prepare(
      'SELECT * FROM jobs WHERE expert_id = ? AND status = ? ORDER BY created_at DESC',
    ).all(expertId, status) as JobRow[];
  } else {
    rows = db.prepare(
      'SELECT * FROM jobs WHERE expert_id = ? ORDER BY created_at DESC',
    ).all(expertId) as JobRow[];
  }
  return rows.map(rowToJob);
}

export function getPendingJobs(): Job[] {
  const db = getDb();
  const rows = db.prepare(
    "SELECT * FROM jobs WHERE status IN ('pending', 'assigned') ORDER BY created_at ASC",
  ).all() as JobRow[];
  return rows.map(rowToJob);
}

export function getAllJobs(limit = 100): Job[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM jobs ORDER BY created_at DESC LIMIT ?',
  ).all(limit) as JobRow[];
  return rows.map(rowToJob);
}

export function updateJobStatus(jobId: string, status: Job['status']): void {
  const db = getDb();
  const extra = status === 'delivered' ? ", delivered_at = datetime('now')" : '';
  db.prepare(
    `UPDATE jobs SET status = ?, updated_at = datetime('now')${extra} WHERE id = ?`,
  ).run(status, jobId);

  auditLog('job', jobId, 'status_changed', { status });
}

// ── Judgment ──

export function submitJudgment(
  jobId: string,
  expertId: string,
  content: Record<string, unknown>,
): Judgment | { error: string } {
  // Validate prohibited language
  const contentStr = JSON.stringify(content).toLowerCase();
  for (const phrase of PROHIBITED_PHRASES) {
    if (contentStr.includes(phrase.toLowerCase())) {
      return { error: `Judgment contains prohibited phrase: "${phrase}". Please use qualitative language only.` };
    }
  }

  const job = getJobById(jobId);
  if (!job) return { error: 'Job not found' };
  if (job.expertId !== expertId) return { error: 'Job not assigned to this expert' };
  if (job.status !== 'assigned' && job.status !== 'in_progress') {
    return { error: `Job cannot accept judgments in status: ${job.status}` };
  }

  const expert = getExpertById(expertId);
  if (!expert) return { error: 'Expert not found' };

  const db = getDb();
  const id = generateId();

  db.prepare(
    `INSERT INTO judgments (id, job_id, expert_id, offering_type, content, disclaimer, expert_name, expert_public_profile)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id, jobId, expertId, job.offeringType,
    JSON.stringify(content), JUDGMENT_DISCLAIMER,
    expert.name,
    expert.consentToPublicProfile ? `/api/experts/${expert.id}/public` : null,
  );

  // Update job status to delivered
  updateJobStatus(jobId, 'delivered');

  // Calculate response time
  const assignedAt = job.assignedAt ? new Date(job.assignedAt).getTime() : Date.now();
  const responseTimeMins = (Date.now() - assignedAt) / 60_000;

  // Expert earnings: 80% from ACP, then 75% of that to expert
  const expertEarnings = job.priceUsdc * 0.8 * 0.75;
  incrementCompletedJobs(expertId, responseTimeMins, expertEarnings);

  // Reputation: +2 for completed job
  const domains = getDomainsForOffering(job.offeringType);
  for (const domain of domains) {
    if (expert.domains.includes(domain)) {
      recordEvent(expertId, domain, 'job_completed', jobId);
      break; // Only one domain event per job
    }
  }

  auditLog('judgment', id, 'submitted', { jobId, expertId });

  return getJudgmentById(id)!;
}

export function getJudgmentById(id: string): Judgment | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM judgments WHERE id = ?').get(id) as JudgmentRow | undefined;
  return row ? rowToJudgment(row) : null;
}

export function getJudgmentForJob(jobId: string): Judgment | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM judgments WHERE job_id = ?').get(jobId) as JudgmentRow | undefined;
  return row ? rowToJudgment(row) : null;
}

// ── Deliverable Formatting (for ACP) ──

export function formatDeliverable(judgment: Judgment): Record<string, unknown> {
  return {
    ...judgment.content,
    disclaimer: judgment.disclaimer,
    expert: {
      name: judgment.expertName,
      publicProfile: judgment.expertPublicProfile,
    },
    expertConsentToPublicAttribution: true,
  };
}

// ── Timeout Check ──

export function checkTimeouts(): number {
  const db = getDb();
  const now = new Date().toISOString();

  const expiredJobs = db.prepare(
    `SELECT * FROM jobs WHERE status IN ('assigned', 'in_progress') AND deadline_at < ?`,
  ).all(now) as JobRow[];

  for (const row of expiredJobs) {
    const job = rowToJob(row);
    updateJobStatus(job.id, 'timeout');

    if (job.expertId) {
      const domains = getDomainsForOffering(job.offeringType);
      const expert = getExpertById(job.expertId);
      if (expert) {
        for (const domain of domains) {
          if (expert.domains.includes(domain)) {
            recordEvent(job.expertId, domain, 'timeout', job.id, 'SLA exceeded');
            break;
          }
        }
      }
    }
  }

  return expiredJobs.length;
}
