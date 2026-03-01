import { getDb, generateId, encryptEmail, decryptEmail, hashEmail, auditLog } from '../db/database.js';
import type { Expert, ExpertPublic, Domain, Availability, ExpertCredentials, ExpertRole, WalletChain } from '../types/index.js';
import { getExpertReputationScores } from './reputation.js';
import bcrypt from 'bcrypt';

// Callback hook for session re-matching when expert comes online.
// Set by sessions.ts at import time to avoid circular dependency.
let _onExpertOnlineHook: ((expertId: string) => void) | null = null;

export function setOnExpertOnlineHook(hook: (expertId: string) => void): void {
  _onExpertOnlineHook = hook;
}

// ── Row ↔ Object Mapping ──

interface ExpertRow {
  id: string;
  name: string;
  email_encrypted: string;
  password_hash: string | null;
  role: string;
  domains: string;
  credentials: string;
  availability: string;
  consent_to_public_profile: number;
  agreement_accepted_at: string | null;
  completed_jobs: number;
  avg_response_time_mins: number;
  earnings_usdc: number;
  wallet_address: string | null;
  wallet_chain: string;
  deactivated_at: string | null;
  created_at: string;
  updated_at: string;
}

function rowToExpert(row: ExpertRow): Expert {
  return {
    id: row.id,
    name: row.name,
    emailEncrypted: row.email_encrypted,
    passwordHash: row.password_hash,
    role: row.role as ExpertRole,
    domains: JSON.parse(row.domains) as Domain[],
    credentials: JSON.parse(row.credentials) as ExpertCredentials,
    availability: row.availability as Availability,
    consentToPublicProfile: row.consent_to_public_profile === 1,
    agreementAcceptedAt: row.agreement_accepted_at,
    completedJobs: row.completed_jobs,
    avgResponseTimeMins: row.avg_response_time_mins,
    earningsUsdc: row.earnings_usdc,
    walletAddress: row.wallet_address,
    walletChain: (row.wallet_chain || 'base') as WalletChain,
    deactivatedAt: row.deactivated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function expertToPublic(expert: Expert, reputationScores: Record<string, number>): ExpertPublic {
  return {
    id: expert.id,
    name: expert.name,
    role: expert.role,
    domains: expert.domains,
    credentials: expert.credentials,
    availability: expert.availability,
    consentToPublicProfile: expert.consentToPublicProfile,
    agreementAcceptedAt: expert.agreementAcceptedAt,
    completedJobs: expert.completedJobs,
    avgResponseTimeMins: expert.avgResponseTimeMins,
    earningsUsdc: 0,
    walletAddress: null,
    walletChain: expert.walletChain,
    deactivatedAt: expert.deactivatedAt,
    reputationScores,
  };
}

// ── CRUD ──

export function createExpert(
  name: string,
  email: string,
  domains: Domain[],
  role: ExpertRole = 'expert',
  credentials?: ExpertCredentials,
): Expert {
  const db = getDb();
  const id = generateId();
  const emailEnc = encryptEmail(email);
  const emailHash = hashEmail(email);

  db.prepare(
    `INSERT INTO experts (id, name, email_encrypted, email_hash, role, domains, credentials)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, name, emailEnc, emailHash, role, JSON.stringify(domains), JSON.stringify(credentials ?? {}));

  // Initialize reputation scores for each domain
  for (const domain of domains) {
    db.prepare(
      `INSERT OR IGNORE INTO reputation_scores (expert_id, domain, score) VALUES (?, ?, 50)`,
    ).run(id, domain);
  }

  auditLog('expert', id, 'created', { name, role, domains });

  return getExpertById(id)!;
}

export function getExpertById(id: string): Expert | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM experts WHERE id = ?').get(id) as ExpertRow | undefined;
  return row ? rowToExpert(row) : null;
}

export function getExpertByEmail(email: string): Expert | null {
  const db = getDb();
  const hash = hashEmail(email);

  // Fast path: lookup by indexed hash (O(1))
  const byHash = db.prepare('SELECT * FROM experts WHERE email_hash = ?').get(hash) as ExpertRow | undefined;
  if (byHash) return rowToExpert(byHash);

  // Fallback for legacy rows without email_hash: decrypt and backfill
  const rows = db.prepare('SELECT * FROM experts WHERE email_hash IS NULL').all() as ExpertRow[];
  for (const row of rows) {
    const decrypted = decryptEmail(row.email_encrypted);
    // Backfill the hash for future lookups
    const rowHash = hashEmail(decrypted);
    db.prepare('UPDATE experts SET email_hash = ? WHERE id = ?').run(rowHash, row.id);
    if (decrypted === email) {
      return rowToExpert(row);
    }
  }
  return null;
}

export function getAllExperts(): Expert[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM experts ORDER BY created_at').all() as ExpertRow[];
  return rows.map(rowToExpert);
}

export function getExpertPublic(expertId: string): ExpertPublic | null {
  const expert = getExpertById(expertId);
  if (!expert) return null;
  const scores = getExpertReputationScores(expertId);
  return expertToPublic(expert, scores);
}

export function getAllExpertsPublic(): ExpertPublic[] {
  const experts = getAllExperts();
  return experts.map(e => {
    const scores = getExpertReputationScores(e.id);
    return expertToPublic(e, scores);
  });
}

export function updateExpert(
  id: string,
  updates: Partial<{
    name: string;
    domains: Domain[];
    credentials: ExpertCredentials;
    availability: Availability;
    consentToPublicProfile: boolean;
  }>,
): Expert | null {
  const db = getDb();
  const setClauses: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) {
    setClauses.push('name = ?');
    values.push(updates.name);
  }
  if (updates.domains !== undefined) {
    setClauses.push('domains = ?');
    values.push(JSON.stringify(updates.domains));
    // Ensure reputation scores exist for new domains
    for (const domain of updates.domains) {
      db.prepare(
        `INSERT OR IGNORE INTO reputation_scores (expert_id, domain, score) VALUES (?, ?, 50)`,
      ).run(id, domain);
    }
  }
  if (updates.credentials !== undefined) {
    setClauses.push('credentials = ?');
    values.push(JSON.stringify(updates.credentials));
  }
  if (updates.availability !== undefined) {
    setClauses.push('availability = ?');
    values.push(updates.availability);
  }
  if (updates.consentToPublicProfile !== undefined) {
    setClauses.push('consent_to_public_profile = ?');
    values.push(updates.consentToPublicProfile ? 1 : 0);
  }

  if (setClauses.length === 0) return getExpertById(id);

  setClauses.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE experts SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);

  auditLog('expert', id, 'updated', updates as Record<string, unknown>);

  // When an expert comes online, re-match any waiting sessions
  if (updates.availability === 'online' && _onExpertOnlineHook) {
    _onExpertOnlineHook(id);
  }

  return getExpertById(id);
}

export async function setExpertPassword(id: string, password: string): Promise<void> {
  const db = getDb();
  const hash = await bcrypt.hash(password, 12);
  db.prepare('UPDATE experts SET password_hash = ?, updated_at = datetime(\'now\') WHERE id = ?').run(hash, id);
  auditLog('expert', id, 'password_set');
}

export function acceptAgreement(id: string): void {
  const db = getDb();
  db.prepare(
    'UPDATE experts SET agreement_accepted_at = datetime(\'now\'), updated_at = datetime(\'now\') WHERE id = ?',
  ).run(id);
  auditLog('expert', id, 'agreement_accepted');
}

export async function verifyPassword(expert: Expert, password: string): Promise<boolean> {
  if (!expert.passwordHash) return false;
  return bcrypt.compare(password, expert.passwordHash);
}

// ── Deactivation ──

export function deactivateExpert(id: string): boolean {
  const db = getDb();
  const expert = getExpertById(id);
  if (!expert) return false;

  db.prepare(
    "UPDATE experts SET deactivated_at = datetime('now'), availability = 'offline', updated_at = datetime('now') WHERE id = ?",
  ).run(id);

  auditLog('expert', id, 'deactivated');
  return true;
}

// ── Wallet ──

export function setWalletAddress(id: string, walletAddress: string, walletChain: WalletChain): Expert | null {
  const db = getDb();
  const expert = getExpertById(id);
  if (!expert) return null;

  db.prepare(
    `UPDATE experts SET wallet_address = ?, wallet_chain = ?, updated_at = datetime('now') WHERE id = ?`,
  ).run(walletAddress, walletChain, id);

  auditLog('expert', id, 'wallet_set', { walletAddress, walletChain });

  return getExpertById(id);
}

// ── Domain Matching ──

export function findExpertsForDomain(domain: Domain): Expert[] {
  const experts = getAllExperts();
  return experts
    .filter(e =>
      e.domains.includes(domain) &&
      e.availability === 'online' &&
      e.agreementAcceptedAt !== null,
    );
}

// ── Stats ──

export function incrementCompletedJobs(expertId: string, responseTimeMins: number, earningsUsdc: number): void {
  const db = getDb();

  // Atomic SQL arithmetic prevents race conditions from concurrent payout confirmations.
  // avg_response_time_mins uses running-average formula: ((old_avg * old_count) + new_value) / (old_count + 1)
  db.prepare(
    `UPDATE experts
     SET completed_jobs = completed_jobs + 1,
         avg_response_time_mins = ((avg_response_time_mins * completed_jobs) + ?) / (completed_jobs + 1),
         earnings_usdc = earnings_usdc + ?,
         updated_at = datetime('now')
     WHERE id = ?`,
  ).run(responseTimeMins, earningsUsdc, expertId);
}

// ── Admin Seeding ──

export async function seedAdminExpert(email: string, password: string): Promise<Expert> {
  const existing = getExpertByEmail(email);
  if (existing) return existing;

  const admin = createExpert(
    'Admin',
    email,
    ['crypto', 'design', 'culture', 'community', 'general'],
    'admin',
    { bio: 'Platform administrator' },
  );

  await setExpertPassword(admin.id, password);
  acceptAgreement(admin.id);

  // Set online by default
  updateExpert(admin.id, { availability: 'online', consentToPublicProfile: true });

  return getExpertById(admin.id)!;
}
