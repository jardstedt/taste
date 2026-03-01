import { randomBytes } from 'crypto';
import { getDb } from '../db/database.js';

const CODE_PREFIX = 'TASTE-';
const CODE_BYTES = 12; // 24 hex chars
const EXPIRY_DAYS = 7;

interface ReferenceCodeRow {
  code: string;
  source_session_id: string;
  offering_type: string;
  discount_pct: number;
  redeemed_session_id: string | null;
  expires_at: string;
  created_at: string;
}

export function generateReferenceCode(sourceSessionId: string, offeringType: string): string {
  const db = getDb();
  const code = CODE_PREFIX + randomBytes(CODE_BYTES).toString('hex');
  const expiresAt = new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(
    `INSERT INTO reference_codes (code, source_session_id, offering_type, expires_at)
     VALUES (?, ?, ?, ?)`,
  ).run(code, sourceSessionId, offeringType, expiresAt);

  return code;
}

export function validateReferenceCode(
  code: string,
  offeringType?: string,
): { valid: true; sourceSessionId: string; discountPct: number } | { valid: false; reason: string } {
  const db = getDb();
  const row = db.prepare('SELECT * FROM reference_codes WHERE code = ?').get(code) as ReferenceCodeRow | undefined;

  if (!row) return { valid: false, reason: 'Reference code not found' };
  if (row.redeemed_session_id) return { valid: false, reason: 'Reference code already redeemed' };
  if (new Date(row.expires_at) < new Date()) return { valid: false, reason: 'Reference code expired' };
  if (offeringType && row.offering_type !== offeringType) {
    return { valid: false, reason: `Reference code is for ${row.offering_type}, not ${offeringType}` };
  }

  return { valid: true, sourceSessionId: row.source_session_id, discountPct: row.discount_pct };
}

export function redeemReferenceCode(code: string, redeemedSessionId: string): boolean {
  const db = getDb();
  const result = db.prepare(
    'UPDATE reference_codes SET redeemed_session_id = ? WHERE code = ? AND redeemed_session_id IS NULL',
  ).run(redeemedSessionId, code);
  return result.changes > 0;
}

export function getReferenceCodeForSession(sessionId: string): string | null {
  const db = getDb();
  const row = db.prepare(
    'SELECT code FROM reference_codes WHERE source_session_id = ?',
  ).get(sessionId) as { code: string } | undefined;
  return row?.code ?? null;
}
