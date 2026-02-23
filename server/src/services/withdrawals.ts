import { getDb, generateId, auditLog } from '../db/database.js';
import { getExpertById } from './experts.js';
import type { Withdrawal, WithdrawalStatus } from '../types/index.js';

// ── Row ↔ Object Mapping ──

interface WithdrawalRow {
  id: string;
  expert_id: string;
  amount_usdc: number;
  status: string;
  wallet_address: string;
  wallet_chain: string;
  tx_hash: string | null;
  admin_notes: string | null;
  requested_at: string;
  processed_at: string | null;
  completed_at: string | null;
}

function rowToWithdrawal(row: WithdrawalRow): Withdrawal {
  return {
    id: row.id,
    expertId: row.expert_id,
    amountUsdc: row.amount_usdc,
    status: row.status as WithdrawalStatus,
    walletAddress: row.wallet_address,
    walletChain: row.wallet_chain as 'base' | 'ethereum',
    txHash: row.tx_hash,
    adminNotes: row.admin_notes,
    requestedAt: row.requested_at,
    processedAt: row.processed_at,
    completedAt: row.completed_at,
  };
}

// ── Withdrawal Operations ──

export function requestWithdrawal(expertId: string, amountUsdc: number): Withdrawal | { error: string } {
  const db = getDb();
  const expert = getExpertById(expertId);
  if (!expert) return { error: 'Expert not found' };
  if (!expert.walletAddress) return { error: 'No wallet address set. Please set your wallet address first.' };
  if (expert.earningsUsdc < amountUsdc) return { error: `Insufficient balance. Available: $${expert.earningsUsdc.toFixed(2)}` };
  if (amountUsdc > 1000) return { error: 'Maximum withdrawal is $1,000 per request' };

  const id = generateId();

  // Atomic: deduct earnings + create withdrawal in one transaction
  const run = db.transaction(() => {
    db.prepare(
      `UPDATE experts SET earnings_usdc = earnings_usdc - ?, updated_at = datetime('now') WHERE id = ?`,
    ).run(amountUsdc, expertId);

    db.prepare(
      `INSERT INTO withdrawals (id, expert_id, amount_usdc, status, wallet_address, wallet_chain)
       VALUES (?, ?, ?, 'pending', ?, ?)`,
    ).run(id, expertId, amountUsdc, expert.walletAddress, expert.walletChain);
  });
  run();

  auditLog('withdrawal', id, 'requested', { expertId, amountUsdc, walletAddress: expert.walletAddress });

  return getWithdrawalById(id)!;
}

export function approveWithdrawal(id: string, adminId: string): Withdrawal | { error: string } {
  const db = getDb();
  const withdrawal = getWithdrawalById(id);
  if (!withdrawal) return { error: 'Withdrawal not found' };
  if (withdrawal.status !== 'pending') return { error: `Cannot approve withdrawal with status: ${withdrawal.status}` };

  db.prepare(
    `UPDATE withdrawals SET status = 'approved', processed_at = datetime('now') WHERE id = ?`,
  ).run(id);

  auditLog('withdrawal', id, 'approved', { adminId });

  return getWithdrawalById(id)!;
}

export function completeWithdrawal(id: string, txHash: string, adminId: string): Withdrawal | { error: string } {
  const db = getDb();
  const withdrawal = getWithdrawalById(id);
  if (!withdrawal) return { error: 'Withdrawal not found' };
  if (withdrawal.status !== 'approved') {
    return { error: `Cannot complete withdrawal with status: ${withdrawal.status}. Must be approved first.` };
  }

  db.prepare(
    `UPDATE withdrawals SET status = 'completed', tx_hash = ?, processed_at = COALESCE(processed_at, datetime('now')), completed_at = datetime('now') WHERE id = ?`,
  ).run(txHash, id);

  auditLog('withdrawal', id, 'completed', { adminId, txHash });

  return getWithdrawalById(id)!;
}

export function rejectWithdrawal(id: string, adminId: string, reason: string): Withdrawal | { error: string } {
  const db = getDb();
  const withdrawal = getWithdrawalById(id);
  if (!withdrawal) return { error: 'Withdrawal not found' };
  if (withdrawal.status !== 'pending' && withdrawal.status !== 'approved') {
    return { error: `Cannot reject withdrawal with status: ${withdrawal.status}` };
  }

  // Atomic: refund earnings + update withdrawal status
  const run = db.transaction(() => {
    db.prepare(
      `UPDATE experts SET earnings_usdc = earnings_usdc + ?, updated_at = datetime('now') WHERE id = ?`,
    ).run(withdrawal.amountUsdc, withdrawal.expertId);

    db.prepare(
      `UPDATE withdrawals SET status = 'rejected', admin_notes = ?, processed_at = datetime('now') WHERE id = ?`,
    ).run(reason, id);
  });
  run();

  auditLog('withdrawal', id, 'rejected', { adminId, reason, refundedAmount: withdrawal.amountUsdc });

  return getWithdrawalById(id)!;
}

// ── Queries ──

export function getWithdrawalById(id: string): Withdrawal | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM withdrawals WHERE id = ?').get(id) as WithdrawalRow | undefined;
  return row ? rowToWithdrawal(row) : null;
}

export function getWithdrawals(expertId?: string): Withdrawal[] {
  const db = getDb();
  if (expertId) {
    const rows = db.prepare('SELECT * FROM withdrawals WHERE expert_id = ? ORDER BY requested_at DESC').all(expertId) as WithdrawalRow[];
    return rows.map(rowToWithdrawal);
  }
  const rows = db.prepare('SELECT * FROM withdrawals ORDER BY requested_at DESC').all() as WithdrawalRow[];
  return rows.map(rowToWithdrawal);
}

export function getPendingWithdrawals(): Withdrawal[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM withdrawals WHERE status IN ('pending', 'approved') ORDER BY requested_at ASC").all() as WithdrawalRow[];
  return rows.map(rowToWithdrawal);
}
