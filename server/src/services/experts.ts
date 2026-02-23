import { getDb, generateId, encryptEmail, decryptEmail, auditLog } from '../db/database.js';
import type { Expert, ExpertPublic, Domain, Availability, ExpertCredentials, ExpertRole, WalletChain } from '../types/index.js';
import bcrypt from 'bcrypt';

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

  db.prepare(
    `INSERT INTO experts (id, name, email_encrypted, role, domains, credentials)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, name, emailEnc, role, JSON.stringify(domains), JSON.stringify(credentials ?? {}));

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
  // When no encryption key is set, email is stored as plaintext
  const rows = db.prepare('SELECT * FROM experts').all() as ExpertRow[];
  for (const row of rows) {
    const decrypted = decryptEmail(row.email_encrypted);
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
  const scores = getReputationScores(expertId);
  return expertToPublic(expert, scores);
}

export function getAllExpertsPublic(): ExpertPublic[] {
  const experts = getAllExperts();
  return experts.map(e => {
    const scores = getReputationScores(e.id);
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

  return getExpertById(id);
}

export function setExpertPassword(id: string, password: string): void {
  const db = getDb();
  const hash = bcrypt.hashSync(password, 12);
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

export function verifyPassword(expert: Expert, password: string): boolean {
  if (!expert.passwordHash) return false;
  return bcrypt.compareSync(password, expert.passwordHash);
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

export function selectBestExpert(domain: Domain): Expert | null {
  const candidates = findExpertsForDomain(domain);
  if (candidates.length === 0) return null;

  // Sort by reputation score for that domain (highest first)
  const scored = candidates.map(expert => {
    const scores = getReputationScores(expert.id);
    return { expert, score: scores[domain] ?? 50 };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].expert;
}

// ── Stats ──

export function incrementCompletedJobs(expertId: string, responseTimeMins: number, earningsUsdc: number): void {
  const db = getDb();
  const expert = getExpertById(expertId);
  if (!expert) return;

  const newCount = expert.completedJobs + 1;
  const newAvg = ((expert.avgResponseTimeMins * expert.completedJobs) + responseTimeMins) / newCount;
  const newEarnings = expert.earningsUsdc + earningsUsdc;

  db.prepare(
    `UPDATE experts
     SET completed_jobs = ?, avg_response_time_mins = ?, earnings_usdc = ?, updated_at = datetime('now')
     WHERE id = ?`,
  ).run(newCount, newAvg, newEarnings, expertId);
}

// ── Reputation Helpers ──

function getReputationScores(expertId: string): Record<string, number> {
  const db = getDb();
  const rows = db.prepare('SELECT domain, score FROM reputation_scores WHERE expert_id = ?').all(expertId) as Array<{ domain: string; score: number }>;
  const scores: Record<string, number> = {};
  for (const row of rows) {
    scores[row.domain] = row.score;
  }
  return scores;
}

// ── Admin Seeding ──

export function seedAdminExpert(email: string, password: string): Expert {
  const existing = getExpertByEmail(email);
  if (existing) return existing;

  const admin = createExpert(
    'Admin',
    email,
    ['crypto', 'narrative', 'community', 'general'],
    'admin',
    { bio: 'Platform administrator' },
  );

  setExpertPassword(admin.id, password);
  acceptAgreement(admin.id);

  // Set online by default
  updateExpert(admin.id, { availability: 'online', consentToPublicProfile: true });

  return getExpertById(admin.id)!;
}
