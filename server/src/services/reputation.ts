import { getDb, generateId, auditLog } from '../db/database.js';
import type { ReputationEvent, ReputationEventType } from '../types/index.js';

const SCORE_CHANGES: Record<ReputationEventType, number> = {
  job_completed: 2,
  positive_feedback: 5,
  timeout: -5,
  rejected: -10,
};

const MIN_SCORE = 0;
const MAX_SCORE = 100;

export function recordEvent(
  expertId: string,
  domain: string,
  eventType: ReputationEventType,
  jobId?: string,
  reason?: string,
): ReputationEvent {
  const db = getDb();
  const id = generateId();
  const scoreChange = SCORE_CHANGES[eventType];

  // Insert event
  db.prepare(
    `INSERT INTO reputation_events (id, expert_id, domain, event_type, score_change, job_id, reason)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, expertId, domain, eventType, scoreChange, jobId ?? null, reason ?? null);

  // Update score (clamp to 0-100)
  db.prepare(
    `INSERT INTO reputation_scores (expert_id, domain, score)
     VALUES (?, ?, MAX(?, MIN(?, 50 + ?)))
     ON CONFLICT(expert_id, domain)
     DO UPDATE SET score = MAX(?, MIN(?, score + ?))`,
  ).run(
    expertId, domain,
    MIN_SCORE, MAX_SCORE, scoreChange,
    MIN_SCORE, MAX_SCORE, scoreChange,
  );

  auditLog('reputation', id, eventType, { expertId, domain, scoreChange, jobId });

  return {
    id,
    expertId,
    domain,
    eventType,
    scoreChange,
    jobId: jobId ?? null,
    reason: reason ?? null,
    createdAt: new Date().toISOString(),
  };
}

export function getExpertReputationScores(expertId: string): Record<string, number> {
  const db = getDb();
  const rows = db.prepare(
    'SELECT domain, score FROM reputation_scores WHERE expert_id = ?',
  ).all(expertId) as Array<{ domain: string; score: number }>;

  const scores: Record<string, number> = {};
  for (const row of rows) {
    scores[row.domain] = row.score;
  }
  return scores;
}

export function getExpertReputationHistory(expertId: string, limit = 50): ReputationEvent[] {
  const db = getDb();
  const rows = db.prepare(
    `SELECT * FROM reputation_events WHERE expert_id = ? ORDER BY created_at DESC LIMIT ?`,
  ).all(expertId, limit) as Array<{
    id: string;
    expert_id: string;
    domain: string;
    event_type: string;
    score_change: number;
    job_id: string | null;
    reason: string | null;
    created_at: string;
  }>;

  return rows.map(row => ({
    id: row.id,
    expertId: row.expert_id,
    domain: row.domain,
    eventType: row.event_type as ReputationEventType,
    scoreChange: row.score_change,
    jobId: row.job_id,
    reason: row.reason,
    createdAt: row.created_at,
  }));
}
