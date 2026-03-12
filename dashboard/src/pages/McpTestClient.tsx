import { useState, useEffect, useRef, useCallback } from 'react';
import { ChatView } from '../components/ChatView.js';
import * as api from '../api/client.js';
import * as mcp from '../api/mcp.js';
import type { Session } from '../types/index.js';
import { formatOffering } from '../utils/format.js';
import type { RpcResult, McpTool, McpOffering, PaymentStatus } from '../api/mcp.js';
import {
  connectBrowserWallet,
  connectPrivateKey,
  fetchUsdcBalance,
  truncateAddress,
  type WalletNetwork,
  type EvmSigner,
  type Address,
} from '../api/wallet.js';

// ── Sub-components ──

function StatusDot({ ok }: { ok: boolean }) {
  return <span className={`status-dot status-dot-${ok ? 'online' : 'offline'}`} />;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    completed: { bg: 'rgba(45, 212, 191, 0.12)', fg: '#2DD4BF' },
    active: { bg: 'rgba(59, 130, 246, 0.12)', fg: '#3B82F6' },
    accepted: { bg: 'rgba(59, 130, 246, 0.12)', fg: '#3B82F6' },
    pending: { bg: 'rgba(251, 146, 60, 0.12)', fg: '#FB923C' },
    matching: { bg: 'rgba(251, 146, 60, 0.12)', fg: '#FB923C' },
    cancelled: { bg: 'rgba(239, 68, 68, 0.12)', fg: '#EF4444' },
    timeout: { bg: 'rgba(239, 68, 68, 0.12)', fg: '#EF4444' },
  };
  const c = colors[status] ?? { bg: '#2A2A2E', fg: '#7A7670' };
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 4,
      fontSize: 11, fontWeight: 700, background: c.bg, color: c.fg, letterSpacing: '0.5px',
    }}>
      {status.toUpperCase()}
    </span>
  );
}

function ToolCard({ tool }: { tool: McpTool }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{
      padding: '8px 12px', background: '#161618', border: '1px solid #2A2A2E',
      borderRadius: 6, marginBottom: 6, cursor: 'pointer',
    }} onClick={() => setExpanded(!expanded)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'monospace', color: '#2DD4BF' }}>{tool.name}</span>
        <span style={{ fontSize: 11, color: '#7A7670' }}>{expanded ? '\u25B2' : '\u25BC'}</span>
      </div>
      {expanded && (
        <div style={{ marginTop: 6 }}>
          <div style={{ fontSize: 12, color: '#7A7670', marginBottom: 6 }}>{tool.description}</div>
          <pre style={{
            background: '#1E1E22', borderRadius: 4, padding: 8,
            fontSize: 11, fontFamily: 'monospace', whiteSpace: 'pre-wrap', margin: 0, color: '#E8E2DA',
          }}>
            {JSON.stringify(tool.inputSchema, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function PaymentChallengeCard({ requirements, onPayNow, paying }: {
  requirements: mcp.PaymentRequirements;
  onPayNow?: () => void;
  paying?: boolean;
}) {
  const accept = requirements.accepts[0];
  if (!accept) return null;
  const amountUsdc = parseInt(accept.maxAmountRequired, 10) / 1_000_000;
  return (
    <div style={{
      background: 'rgba(251, 146, 60, 0.12)', border: '1px solid rgba(251, 146, 60, 0.3)',
      borderRadius: 8, padding: 12, marginTop: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#FB923C' }}>402 — Payment Required</div>
        {onPayNow && (
          <button
            onClick={onPayNow}
            disabled={paying}
            className="btn btn-primary btn-sm"
            style={{ fontSize: 11 }}
          >
            {paying ? 'Paying...' : `Pay $${amountUsdc.toFixed(2)}`}
          </button>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', fontSize: 12 }}>
        <div><span style={{ color: '#7A7670' }}>Network:</span> <span style={{ color: '#E8E2DA' }}>{accept.network}</span></div>
        <div><span style={{ color: '#7A7670' }}>Amount:</span> <span style={{ color: '#E8E2DA' }}>{amountUsdc} USDC</span></div>
        <div><span style={{ color: '#7A7670' }}>Asset:</span> <span style={{ color: '#E8E2DA', fontFamily: 'monospace', fontSize: 11 }}>{accept.asset.slice(0, 10)}...{accept.asset.slice(-4)}</span></div>
        <div><span style={{ color: '#7A7670' }}>Pay To:</span> <span style={{ color: '#E8E2DA', fontFamily: 'monospace', fontSize: 11 }}>{accept.payTo.slice(0, 10)}...{accept.payTo.slice(-4)}</span></div>
      </div>
      <div style={{ fontSize: 11, color: '#7A7670', marginTop: 6 }}>{accept.description}</div>
    </div>
  );
}

interface LogEntryData {
  id: number;
  timestamp: string;
  method: string;
  httpStatus: number;
  raw: { request: unknown; response: unknown };
}

function LogEntry({ entry }: { entry: LogEntryData }) {
  const [expanded, setExpanded] = useState(false);
  const statusColor = entry.httpStatus === 200 ? '#2DD4BF' : entry.httpStatus === 402 ? '#FB923C' : '#EF4444';
  return (
    <div style={{
      padding: '6px 10px', background: '#161618', border: '1px solid #2A2A2E',
      borderRadius: 4, marginBottom: 4, cursor: 'pointer',
    }} onClick={() => setExpanded(!expanded)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 10, color: '#7A7670', fontFamily: 'monospace' }}>{entry.timestamp}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#E8E2DA' }}>{entry.method}</span>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
          background: statusColor + '20', color: statusColor,
        }}>{entry.httpStatus}</span>
      </div>
      {expanded && (
        <pre style={{
          background: '#1E1E22', borderRadius: 4, padding: 8, marginTop: 6,
          fontSize: 10, fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          maxHeight: 300, overflow: 'auto', margin: 0, color: '#E8E2DA',
        }}>
          {JSON.stringify(entry.raw, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ── Main Component ──

export function McpTestClient() {
  // Server status
  const [connected, setConnected] = useState<boolean | null>(null);
  const [tools, setTools] = useState<McpTool[]>([]);
  const [checkingStatus, setCheckingStatus] = useState(false);

  // Offerings
  const [offerings, setOfferings] = useState<McpOffering[]>([]);
  const [loadingOfferings, setLoadingOfferings] = useState(false);

  // Request evaluation
  const [selectedOffering, setSelectedOffering] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTier, setSelectedTier] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [lastPaymentReqs, setLastPaymentReqs] = useState<mcp.PaymentRequirements | null>(null);
  const [lastSessionId, setLastSessionId] = useState<string | null>(null);

  // Get result
  const [pollSessionId, setPollSessionId] = useState('');
  const [pollResult, setPollResult] = useState<{ status: string; deliverable?: unknown; message?: string } | null>(null);
  const [polling, setPolling] = useState(false);
  const [autoPoll, setAutoPoll] = useState(false);
  const autoPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sessions (left panel)
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Request log
  const [log, setLog] = useState<LogEntryData[]>([]);
  const [showLog, setShowLog] = useState(true);
  const logIdRef = useRef(0);

  // Wallet
  const [walletMode, setWalletMode] = useState<'browser' | 'key'>('browser');
  const [network, setNetwork] = useState<WalletNetwork>('base-sepolia');
  const [signer, setSigner] = useState<EvmSigner | null>(null);
  const [walletAddress, setWalletAddress] = useState<Address | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [privateKeyInput, setPrivateKeyInput] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('idle');

  // Error
  const [error, setError] = useState<string | null>(null);

  const appendLog = useCallback((method: string, result: RpcResult) => {
    setLog(prev => [{
      id: ++logIdRef.current,
      timestamp: new Date().toLocaleTimeString(),
      method,
      httpStatus: result.httpStatus,
      raw: result.raw,
    }, ...prev].slice(0, 50));
  }, []);

  const loadSessions = useCallback(async () => {
    const res = await api.getSessions();
    if (res.success && res.data) {
      const all = res.data as Session[];
      setSessions(all.filter(s => s.buyerAgent === 'mcp-client' || s.tags?.includes('mcp')));
    }
  }, []);

  // ── On mount: check connectivity + load sessions ──
  useEffect(() => {
    handleCheckStatus();
    loadSessions();
    return () => {
      if (autoPollRef.current) clearInterval(autoPollRef.current);
    };
  }, []);

  // ── Auto-poll effect ──
  useEffect(() => {
    if (autoPollRef.current) clearInterval(autoPollRef.current);
    if (autoPoll && pollSessionId) {
      autoPollRef.current = setInterval(() => {
        handleGetResult(pollSessionId);
      }, 15_000);
    }
    return () => {
      if (autoPollRef.current) clearInterval(autoPollRef.current);
    };
  }, [autoPoll, pollSessionId]);

  // ── Handlers ──

  const handleCheckStatus = async () => {
    setCheckingStatus(true);
    setError(null);
    const result = await mcp.listTools();
    appendLog('tools/list', result);
    if (result.data && 'tools' in result.data) {
      setConnected(true);
      setTools(result.data.tools);
    } else {
      setConnected(false);
      setTools([]);
      if (result.error) setError(result.error);
    }
    setCheckingStatus(false);
  };

  const handleListOfferings = async () => {
    setLoadingOfferings(true);
    setError(null);
    const result = await mcp.listOfferings();
    appendLog('list_offerings', result);
    if (result.data && 'offerings' in result.data) {
      setOfferings(result.data.offerings);
      if (result.data.offerings.length > 0 && !selectedOffering) {
        setSelectedOffering(result.data.offerings[0].type);
      }
    } else {
      setError(result.error ?? 'Failed to list offerings');
    }
    setLoadingOfferings(false);
  };

  // ── Wallet handlers ──

  const handleConnectWallet = async () => {
    setConnecting(true);
    setError(null);
    try {
      const result = walletMode === 'browser'
        ? await connectBrowserWallet(network)
        : await connectPrivateKey(network, privateKeyInput);
      setSigner(result.signer);
      setWalletAddress(result.address);
      // Fetch balance in background
      fetchUsdcBalance(network, result.address)
        .then(setUsdcBalance)
        .catch(() => setUsdcBalance(null));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Wallet connection failed');
    } finally {
      setPrivateKeyInput('');
    }
    setConnecting(false);
  };

  const handleDisconnectWallet = () => {
    setSigner(null);
    setWalletAddress(null);
    setUsdcBalance(null);
    setPaymentStatus('idle');
  };

  const handleRequestEvaluation = async () => {
    if (!selectedOffering || !description.trim()) return;
    setRequesting(true);
    setError(null);
    setLastPaymentReqs(null);
    setLastSessionId(null);
    setPaymentStatus('idle');

    if (signer) {
      // Paid mode: use requestEvaluationWithPayment
      const result = await mcp.requestEvaluationWithPayment(
        selectedOffering,
        description.trim(),
        selectedTier || undefined,
        signer,
        setPaymentStatus,
      );
      appendLog('request_evaluation (paid)', result);

      if (result.data && 'sessionId' in result.data) {
        setLastSessionId(result.data.sessionId);
        setPollSessionId(result.data.sessionId);
        setTimeout(async () => {
          await loadSessions();
          setSelectedSessionId(result.data!.sessionId);
        }, 500);
        // Refresh balance after payment
        if (walletAddress) {
          fetchUsdcBalance(network, walletAddress)
            .then(setUsdcBalance)
            .catch(() => {});
        }
      } else {
        setError(result.error ?? 'Payment request failed');
      }
    } else {
      // Free mode
      const result = await mcp.requestEvaluation(
        selectedOffering,
        description.trim(),
        selectedTier || undefined,
      );
      appendLog('request_evaluation', result);

      if (result.httpStatus === 402 && result.paymentRequirements) {
        setLastPaymentReqs(result.paymentRequirements);
      } else if (result.data && 'sessionId' in result.data) {
        setLastSessionId(result.data.sessionId);
        setPollSessionId(result.data.sessionId);
        setTimeout(async () => {
          await loadSessions();
          setSelectedSessionId(result.data!.sessionId);
        }, 500);
      } else {
        setError(result.error ?? 'Request failed');
      }
    }
    setRequesting(false);
  };

  const handlePayNow = async () => {
    if (!signer || !lastPaymentReqs || !selectedOffering || !description.trim()) return;
    setRequesting(true);
    setError(null);
    setPaymentStatus('idle');

    const result = await mcp.requestEvaluationWithPayment(
      selectedOffering,
      description.trim(),
      selectedTier || undefined,
      signer,
      setPaymentStatus,
    );
    appendLog('request_evaluation (pay now)', result);

    if (result.data && 'sessionId' in result.data) {
      setLastSessionId(result.data.sessionId);
      setLastPaymentReqs(null);
      setPollSessionId(result.data.sessionId);
      setTimeout(async () => {
        await loadSessions();
        setSelectedSessionId(result.data!.sessionId);
      }, 500);
      if (walletAddress) {
        fetchUsdcBalance(network, walletAddress).then(setUsdcBalance).catch(() => {});
      }
    } else {
      setError(result.error ?? 'Payment failed');
    }
    setRequesting(false);
  };

  const handleGetResult = async (sid?: string) => {
    const id = sid ?? pollSessionId;
    if (!id) return;
    setPolling(true);
    const result = await mcp.getResult(id);
    appendLog('get_result', result);
    if (result.data) {
      setPollResult(result.data);
      if (result.data.status === 'completed' || result.data.status === 'cancelled' || result.data.status === 'timeout') {
        setAutoPoll(false);
      }
    } else {
      setError(result.error ?? 'Failed to get result');
    }
    setPolling(false);
  };

  return (
    <div>
      <h2 className="page-title" style={{ marginBottom: 16 }}>MCP Test Client</h2>
      <p style={{ color: '#7A7670', fontSize: 13, marginBottom: 20 }}>
        Test the MCP JSON-RPC interface: discover tools, list offerings, request evaluations, and poll results.
      </p>

      {error && (
        <div className="alert alert-error mb-md" style={{ padding: '8px 12px', fontSize: 13 }}>
          {error}
          <button onClick={() => setError(null)} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>x</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
        {/* ── LEFT: Expert Session ── */}
        <div>
          <div className="card" style={{ padding: 16, marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Expert Chat</h3>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: '#7A7670', display: 'block', marginBottom: 4 }}>MCP Session</label>
              <select
                value={selectedSessionId ?? ''}
                onChange={e => setSelectedSessionId(e.target.value || null)}
                className="input input-full"
                style={{ fontSize: 13 }}
              >
                <option value="">Select a session...</option>
                {sessions.map(s => (
                  <option key={s.id} value={s.id}>
                    {formatOffering(s.offeringType)} — {s.status} ({s.id.slice(0, 8)})
                  </option>
                ))}
              </select>
            </div>
            <button onClick={loadSessions} className="btn btn-ghost btn-sm" style={{ fontSize: 12 }}>
              Refresh Sessions
            </button>
          </div>

          {selectedSessionId ? (
            <div style={{ border: '1px solid #2A2A2E', borderRadius: 8, overflow: 'hidden' }}>
              <ChatView
                sessionId={selectedSessionId}
                onBack={() => setSelectedSessionId(null)}
              />
            </div>
          ) : (
            <div className="card" style={{ padding: 32, textAlign: 'center', color: '#7A7670' }}>
              Select a session to view the expert chat
            </div>
          )}
        </div>

        {/* ── RIGHT: MCP Controls ── */}
        <div>
          {/* Server Status */}
          <div className="card" style={{ padding: 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 15 }}>MCP Server</h3>
              <button
                onClick={handleCheckStatus}
                disabled={checkingStatus}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 12 }}
              >
                {checkingStatus ? 'Checking...' : 'Discover Tools'}
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <StatusDot ok={connected === true} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                {connected === null ? 'Unknown' : connected ? `Connected — ${tools.length} tools` : 'Disconnected'}
              </span>
            </div>
            {tools.length > 0 && (
              <div style={{ marginTop: 8 }}>
                {tools.map(t => <ToolCard key={t.name} tool={t} />)}
              </div>
            )}
          </div>

          {/* Wallet */}
          <div className="card" style={{ padding: 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 15 }}>Wallet</h3>
              {walletAddress && (
                <button onClick={handleDisconnectWallet} className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: '#EF4444' }}>
                  Disconnect
                </button>
              )}
            </div>

            {walletAddress ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <StatusDot ok={true} />
                  <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'monospace', color: '#E8E2DA' }}>
                    {truncateAddress(walletAddress)}
                  </span>
                  <span style={{ fontSize: 11, color: '#7A7670' }}>({network})</span>
                </div>
                {usdcBalance !== null && (
                  <div style={{ fontSize: 12, color: '#2DD4BF', marginLeft: 20 }}>
                    {usdcBalance} USDC
                  </div>
                )}
              </div>
            ) : (
              <div>
                {/* Network toggle */}
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 12, color: '#7A7670', display: 'block', marginBottom: 4 }}>Network</label>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {(['base-sepolia', 'base'] as const).map(n => (
                      <button
                        key={n}
                        onClick={() => setNetwork(n)}
                        className={`btn btn-sm ${network === n ? 'btn-secondary' : 'btn-ghost'}`}
                        style={{ fontSize: 11, flex: 1 }}
                      >
                        {n === 'base' ? 'Base' : 'Base Sepolia'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mode tabs */}
                <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                  {(['browser', 'key'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setWalletMode(m)}
                      style={{
                        flex: 1, padding: '4px 8px', fontSize: 11, fontWeight: 600,
                        background: walletMode === m ? '#2A2A2E' : 'transparent',
                        color: walletMode === m ? '#E8E2DA' : '#7A7670',
                        border: '1px solid #2A2A2E', borderRadius: 4, cursor: 'pointer',
                      }}
                    >
                      {m === 'browser' ? 'Browser Wallet' : 'Private Key'}
                    </button>
                  ))}
                </div>

                {walletMode === 'key' && (
                  <div style={{ marginBottom: 10 }}>
                    <input
                      type="password"
                      value={privateKeyInput}
                      onChange={e => setPrivateKeyInput(e.target.value)}
                      placeholder="0x... (hex private key)"
                      className="input input-full"
                      style={{ fontSize: 12, fontFamily: 'monospace' }}
                    />
                  </div>
                )}

                <button
                  onClick={handleConnectWallet}
                  disabled={connecting || (walletMode === 'key' && !privateKeyInput)}
                  className="btn btn-secondary"
                  style={{ width: '100%' }}
                >
                  {connecting ? 'Connecting...' : 'Connect'}
                </button>
              </div>
            )}
          </div>

          {/* Offerings */}
          <div className="card" style={{ padding: 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 15 }}>Offerings</h3>
              <button
                onClick={handleListOfferings}
                disabled={loadingOfferings}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 12 }}
              >
                {loadingOfferings ? 'Loading...' : 'List Offerings'}
              </button>
            </div>
            {offerings.length > 0 && (
              <div style={{ overflow: 'auto' }}>
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #2A2A2E', textAlign: 'left' }}>
                      <th style={{ padding: '4px 8px', color: '#7A7670', fontWeight: 600 }}>Type</th>
                      <th style={{ padding: '4px 8px', color: '#7A7670', fontWeight: 600 }}>Price</th>
                      <th style={{ padding: '4px 8px', color: '#7A7670', fontWeight: 600 }}>Experts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {offerings.map(o => (
                      <tr key={o.type} style={{ borderBottom: '1px solid #1E1E22' }}>
                        <td style={{ padding: '4px 8px', color: '#E8E2DA' }}>{o.name}</td>
                        <td style={{ padding: '4px 8px', color: '#2DD4BF' }}>${o.priceUsdc}</td>
                        <td style={{ padding: '4px 8px', color: '#7A7670' }}>{o.expertAvailability}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Request Evaluation */}
          <div className="card" style={{ padding: 16, marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Request Evaluation</h3>

            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, color: '#7A7670', display: 'block', marginBottom: 4 }}>Offering</label>
              <select
                value={selectedOffering}
                onChange={e => setSelectedOffering(e.target.value)}
                className="input input-full"
                style={{ fontSize: 13 }}
              >
                <option value="">Select offering...</option>
                {offerings.map(o => (
                  <option key={o.type} value={o.type}>{o.name} — ${o.priceUsdc}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, color: '#7A7670', display: 'block', marginBottom: 4 }}>Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe what you need evaluated (10-5000 chars)..."
                className="input input-full"
                style={{ fontSize: 12, fontFamily: 'monospace', minHeight: 100, resize: 'vertical' }}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: '#7A7670', display: 'block', marginBottom: 4 }}>Tier (optional)</label>
              <select
                value={selectedTier}
                onChange={e => setSelectedTier(e.target.value)}
                className="input input-full"
                style={{ fontSize: 13 }}
              >
                <option value="">Default</option>
                <option value="test">Test</option>
                <option value="quick">Quick</option>
                <option value="full">Full</option>
                <option value="deep">Deep</option>
              </select>
            </div>

            <button
              onClick={handleRequestEvaluation}
              disabled={requesting || !selectedOffering || description.trim().length < 10}
              className="btn btn-primary"
              style={{ width: '100%' }}
            >
              {requesting
                ? (paymentStatus === 'signing' ? 'Signing...'
                  : paymentStatus === 'submitting' ? 'Submitting...'
                  : 'Requesting...')
                : signer
                  ? `Pay & Request${selectedOffering && offerings.length > 0
                      ? ` ($${offerings.find(o => o.type === selectedOffering)?.priceUsdc ?? '?'})`
                      : ''}`
                  : 'Request Evaluation'}
            </button>

            {lastPaymentReqs && (
              <PaymentChallengeCard
                requirements={lastPaymentReqs}
                onPayNow={signer ? handlePayNow : undefined}
                paying={requesting}
              />
            )}

            {lastSessionId && (
              <div style={{
                background: 'rgba(45, 212, 191, 0.12)', borderRadius: 8, padding: 10, marginTop: 8,
              }}>
                <div style={{ fontSize: 12, color: '#2DD4BF', fontWeight: 600, marginBottom: 4 }}>Session Created</div>
                <div style={{ fontSize: 12, fontFamily: 'monospace', color: '#E8E2DA', wordBreak: 'break-all' }}>
                  {lastSessionId}
                </div>
              </div>
            )}
          </div>

          {/* Get Result */}
          <div className="card" style={{ padding: 16, marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Get Result</h3>

            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, color: '#7A7670', display: 'block', marginBottom: 4 }}>Session ID</label>
              <input
                type="text"
                value={pollSessionId}
                onChange={e => setPollSessionId(e.target.value)}
                placeholder="Session ID..."
                className="input input-full"
                style={{ fontSize: 12, fontFamily: 'monospace' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
              <button
                onClick={() => handleGetResult()}
                disabled={polling || !pollSessionId}
                className="btn btn-secondary btn-sm"
              >
                {polling ? 'Polling...' : 'Poll Now'}
              </button>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={autoPoll}
                  onChange={e => setAutoPoll(e.target.checked)}
                  disabled={!pollSessionId}
                  style={{ accentColor: '#2DD4BF' }}
                />
                Auto-poll (15s)
              </label>
            </div>

            {pollResult && (
              <div style={{
                background: '#161618', border: '1px solid #2A2A2E', borderRadius: 8, padding: 10,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: '#7A7670' }}>Status:</span>
                  <StatusBadge status={pollResult.status} />
                </div>
                {pollResult.message && (
                  <div style={{ fontSize: 12, color: '#7A7670', marginBottom: 6 }}>{pollResult.message}</div>
                )}
                {pollResult.deliverable != null && (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ fontSize: 11, color: '#7A7670', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Deliverable</div>
                    <pre style={{
                      background: '#1E1E22', borderRadius: 4, padding: 8,
                      fontSize: 11, fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                      maxHeight: 200, overflow: 'auto', margin: 0, color: '#E8E2DA',
                    }}>
                      {typeof pollResult.deliverable === 'string'
                        ? pollResult.deliverable
                        : JSON.stringify(pollResult.deliverable, null, 2) as string}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Request Log */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 15 }}>Request Log ({log.length})</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                {log.length > 0 && (
                  <button onClick={() => setLog([])} className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}>
                    Clear
                  </button>
                )}
                <button onClick={() => setShowLog(!showLog)} className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}>
                  {showLog ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            {showLog && log.length > 0 && (
              <div style={{ maxHeight: 300, overflow: 'auto' }}>
                {log.map(entry => <LogEntry key={entry.id} entry={entry} />)}
              </div>
            )}
            {showLog && log.length === 0 && (
              <div style={{ fontSize: 12, color: '#7A7670', fontStyle: 'italic' }}>
                No requests yet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
