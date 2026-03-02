import { useState, useEffect } from 'react';
import { useSessions } from '../hooks/useSessions.js';
import type { AuthUser, Withdrawal } from '../types/index.js';
import * as api from '../api/client.js';

interface EarningsViewProps {
  user: AuthUser;
  onRefresh: () => void;
}

export function EarningsView({ user, onRefresh }: EarningsViewProps) {
  const { completed } = useSessions();

  const [walletInput, setWalletInput] = useState('');
  const [walletSaving, setWalletSaving] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);

  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);

  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);

  const totalPayout = completed.reduce((sum, s) => sum + s.expertPayoutUsdc, 0);

  useEffect(() => {
    api.getWithdrawals().then(res => {
      if (res.success && res.data) {
        setWithdrawals(res.data as Withdrawal[]);
      }
    });
  }, []);

  const handleSetWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    setWalletSaving(true);
    setWalletError(null);

    const res = await api.setWallet(user.expertId, walletInput, 'base');
    if (res.success) {
      setWalletInput('');
      onRefresh();
    } else {
      setWalletError(res.error ?? 'Failed to set wallet');
    }
    setWalletSaving(false);
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawing(true);
    setWithdrawError(null);

    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount < 1) {
      setWithdrawError('Minimum withdrawal is $1');
      setWithdrawing(false);
      return;
    }

    const res = await api.requestWithdrawal(amount);
    if (res.success) {
      setShowWithdrawModal(false);
      setWithdrawAmount('');
      onRefresh();
      // Refresh withdrawals list
      const wRes = await api.getWithdrawals();
      if (wRes.success && wRes.data) {
        setWithdrawals(wRes.data as Withdrawal[]);
      }
    } else {
      setWithdrawError(res.error ?? 'Withdrawal failed');
    }
    setWithdrawing(false);
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#2DD4BF';
      case 'rejected': return '#EF4444';
      case 'approved': case 'processing': return '#3B82F6';
      default: return '#F59E0B';
    }
  };

  const baseScanUrl = (txHash: string, chain: string) => {
    if (chain === 'ethereum') return `https://etherscan.io/tx/${txHash}`;
    return `https://basescan.org/tx/${txHash}`;
  };

  return (
    <div>
      {/* Total Earnings */}
      <div className="card mb-xl" style={{ padding: 20 }}>
        <div style={{ color: '#7A7670', fontSize: 12, marginBottom: 8 }}>Total earnings</div>
        <div style={{ color: '#E8E2DA', fontSize: 24, fontWeight: 700 }}>${totalPayout.toFixed(2)}</div>
        <div style={{ color: '#7A7670', fontSize: 12 }}>{completed.length} completed sessions</div>
      </div>

      {/* Wallet Setup */}
      {!user.walletAddress ? (
        <div className="card mb-xl" style={{ padding: 20 }}>
          <div style={{ color: '#7A7670', fontSize: 13, marginBottom: 12 }}>Set your wallet address</div>
          <form onSubmit={handleSetWallet}>
            <div style={{ marginBottom: 8 }}>
              <input
                type="text"
                value={walletInput}
                onChange={e => setWalletInput(e.target.value)}
                placeholder="0x..."
                pattern="^0x[a-fA-F0-9]{40}$"
                required
                className="input input-full"
                style={{ fontFamily: 'monospace' }}
              />
              <div style={{ fontSize: 11, color: '#7A7670', marginTop: 4 }}>Base (USDC)</div>
            </div>
            {walletError && <div style={{ color: '#F87171', fontSize: 12, marginBottom: 8 }}>{walletError}</div>}
            <button type="submit" disabled={walletSaving} className="btn btn-primary btn-sm">
              {walletSaving ? 'Saving...' : 'Save Wallet'}
            </button>
          </form>
        </div>
      ) : (
        <div className="card mb-xl" style={{ padding: 20 }}>
          <div style={{ color: '#7A7670', fontSize: 12, marginBottom: 4 }}>Wallet</div>
          <div className="wallet-address-display" style={{ fontFamily: 'monospace', fontSize: 13, color: '#E8E2DA', wordBreak: 'break-all' }}>
            {user.walletAddress}
          </div>
          <div style={{ color: '#7A7670', fontSize: 11, marginTop: 4 }}>Base</div>
        </div>
      )}

      {/* Withdrawal Card */}
      <div className="earnings-withdrawal mb-xl">
        <div style={{ color: '#7A7670', fontSize: 13, marginBottom: 8 }}>Available for withdrawal</div>
        <div className="earnings-balance">${user.earningsUsdc.toFixed(2)}</div>
        <div style={{ color: '#7A7670', fontSize: 12, marginBottom: 16 }}>USDC on Base</div>
        <button
          className="btn-green"
          disabled={!user.walletAddress || user.earningsUsdc < 1}
          onClick={() => setShowWithdrawModal(true)}
        >
          Withdraw to Wallet
        </button>
      </div>

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="card mb-xl" style={{ padding: 20, border: '1px solid rgba(251, 146, 60, 0.3)' }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Request Withdrawal</div>
          <form onSubmit={handleWithdraw}>
            <div className="form-group">
              <label className="form-label">Amount (USDC)</label>
              <input
                type="number"
                value={withdrawAmount}
                onChange={e => setWithdrawAmount(e.target.value)}
                min="1"
                max={user.earningsUsdc}
                step="0.01"
                required
                className="input input-full"
                placeholder={`Max: $${user.earningsUsdc.toFixed(2)}`}
              />
            </div>
            {withdrawError && <div style={{ color: '#F87171', fontSize: 12, marginBottom: 8 }}>{withdrawError}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" disabled={withdrawing} className="btn btn-primary btn-sm">
                {withdrawing ? 'Submitting...' : 'Submit Request'}
              </button>
              <button type="button" onClick={() => setShowWithdrawModal(false)} className="btn btn-secondary btn-sm">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Withdrawal History */}
      {withdrawals.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h3 style={{ marginBottom: 12 }}>Withdrawal History</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Amount</th>
                <th>Status</th>
                <th>TX</th>
              </tr>
            </thead>
            <tbody>
              {withdrawals.map(w => (
                <tr key={w.id}>
                  <td style={{ fontSize: 12 }}>{new Date(w.requestedAt).toLocaleDateString()}</td>
                  <td className="text-bold">${w.amountUsdc.toFixed(2)}</td>
                  <td>
                    <span style={{
                      color: statusColor(w.status),
                      textTransform: 'capitalize',
                      fontSize: 12,
                      fontWeight: 600,
                    }}>
                      {w.status}
                    </span>
                    {w.adminNotes && (
                      <div style={{ color: '#7A7670', fontSize: 11 }}>{w.adminNotes}</div>
                    )}
                  </td>
                  <td>
                    {w.txHash ? (
                      <a
                        href={baseScanUrl(w.txHash, w.walletChain)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#5EEAD4', fontSize: 12 }}
                      >
                        View TX
                      </a>
                    ) : (
                      <span style={{ color: '#7A7670', fontSize: 12 }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {completed.length === 0 && withdrawals.length === 0 && (
        <div className="empty-state" style={{ marginTop: 32 }}>
          <div className="empty-state-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7A7670" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <div className="empty-state-title">No earnings yet</div>
          <div className="empty-state-text">Complete sessions to earn USDC</div>
        </div>
      )}
    </div>
  );
}
