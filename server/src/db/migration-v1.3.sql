-- v1.3: Expert wallets and withdrawal system
-- Note: ALTER TABLE for wallet_address/wallet_chain is handled in database.ts

-- Withdrawal requests
CREATE TABLE IF NOT EXISTS withdrawals (
  id TEXT PRIMARY KEY,
  expert_id TEXT NOT NULL REFERENCES experts(id),
  amount_usdc REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'processing', 'completed', 'rejected')),
  wallet_address TEXT NOT NULL,
  wallet_chain TEXT NOT NULL DEFAULT 'base',
  tx_hash TEXT,
  admin_notes TEXT,
  requested_at TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at TEXT,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_expert_id ON withdrawals(expert_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);
