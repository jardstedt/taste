import { useState, useEffect, useCallback, useRef } from 'react';
import { ChatView } from '../components/ChatView.js';
import * as api from '../api/client.js';
import type { Session } from '../types/index.js';
import { formatOffering } from '../utils/format.js';

interface BuyerStatus {
  connected: boolean;
  wallet: string | null;
  gasPrice: number | null;
}

interface Offering {
  index: number;
  name: string;
  price: number;
  requirementFields: string;
  exampleInput: string;
}

interface TrackedJob {
  jobId: number;
  phase: string;
  createdAt: string;
}

interface JobDetail {
  id: number;
  phase: string;
  phaseNum: number;
  price: number;
  memos: Array<{ content: string }>;
}

// Phase badge colors
function phaseBadge(phase: string) {
  const colors: Record<string, { bg: string; fg: string }> = {
    REQUEST: { bg: '#FEF3C7', fg: '#92400E' },
    NEGOTIATION: { bg: '#DBEAFE', fg: '#1E40AF' },
    TRANSACTION: { bg: '#E0E7FF', fg: '#3730A3' },
    EVALUATION: { bg: '#FDE68A', fg: '#92400E' },
    COMPLETED: { bg: '#D1FAE5', fg: '#065F46' },
    REJECTED: { bg: '#FEE2E2', fg: '#991B1B' },
  };
  const c = colors[phase] ?? { bg: '#F3F4F6', fg: '#374151' };
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 4,
      fontSize: 11,
      fontWeight: 700,
      background: c.bg,
      color: c.fg,
      letterSpacing: '0.5px',
    }}>
      {phase}
    </span>
  );
}

export function AcpDemo() {
  // ── Connection state ──
  const [status, setStatus] = useState<BuyerStatus | null>(null);
  const [initializing, setInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Offerings ──
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [selectedOffering, setSelectedOffering] = useState<number>(0);
  const [requirementJson, setRequirementJson] = useState('{}');
  const [creating, setCreating] = useState(false);

  // ── Jobs ──
  const [trackedJobs, setTrackedJobs] = useState<TrackedJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [jobDetail, setJobDetail] = useState<JobDetail | null>(null);
  const [jobLoading, setJobLoading] = useState(false);

  // ── Create All ──
  const [creatingAll, setCreatingAll] = useState(false);
  const [creatingProgress, setCreatingProgress] = useState(0);

  // ── Session (left panel) ──
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // ── Agent messaging (disabled until memo bridge is reliable) ──
  // const [agentMsg, setAgentMsg] = useState('');
  // const [sendingMsg, setSendingMsg] = useState(false);

  // ── Job filtering ──
  const [showFinishedJobs, setShowFinishedJobs] = useState(false);

  // ── Polling ref ──
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Auto-connect on mount ──
  useEffect(() => {
    loadSessions();
    // Check status first, then auto-init if not connected
    (async () => {
      const res = await api.agentSim.status();
      if (res.success && res.data) {
        const s = res.data as BuyerStatus;
        setStatus(s);
        if (!s.connected) {
          // Auto-init
          setInitializing(true);
          try {
            const initRes = await api.agentSim.init();
            if (!initRes.success) setError(initRes.error ?? 'Failed to initialize');
            await refreshStatus();
          } catch (err) {
            setError((err as Error).message);
          }
          setInitializing(false);
        }
      }
    })();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // ── Auto-discover offerings and fetch jobs once connected ──
  useEffect(() => {
    if (status?.connected && offerings.length === 0) {
      handleDiscoverOfferings();
      refreshJobs();
    }
  }, [status?.connected]);

  // ── Start polling when we have tracked jobs ──
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (trackedJobs.length > 0 && status?.connected) {
      pollRef.current = setInterval(() => {
        refreshJobs();
        if (selectedJobId !== null) refreshJobDetail(selectedJobId);
      }, 10_000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [trackedJobs.length, status?.connected, selectedJobId]);

  const refreshStatus = async () => {
    const res = await api.agentSim.status();
    if (res.success && res.data) setStatus(res.data as BuyerStatus);
  };

  const loadSessions = async () => {
    const res = await api.getSessions();
    if (res.success && res.data) {
      const all = res.data as Session[];
      // Show sessions with ACP jobs or active sessions
      setSessions(all.filter(s => s.acpJobId || ['active', 'accepted', 'wrapping_up', 'pending', 'matching'].includes(s.status)));
    }
  };

  const refreshJobs = async () => {
    const res = await api.agentSim.getJobs();
    if (res.success && res.data) {
      setTrackedJobs(res.data as TrackedJob[]);
    }
  };

  const refreshJobDetail = async (jobId: number) => {
    const res = await api.agentSim.getJob(jobId);
    if (res.success && res.data) {
      setJobDetail(res.data as JobDetail);
      // Also refresh tracked jobs list to update phases
      refreshJobs();
      // Refresh sessions in case new session was created
      loadSessions();
    }
  };

  // ── Handlers ──

  const handleInit = async () => {
    setInitializing(true);
    setError(null);
    try {
      const res = await api.agentSim.init();
      if (!res.success) {
        setError(res.error ?? 'Failed to initialize');
      }
      await refreshStatus();
    } catch (err) {
      setError((err as Error).message);
    }
    setInitializing(false);
  };

  const handleDiscoverOfferings = async () => {
    setError(null);
    try {
      const res = await api.agentSim.offerings();
      if (res.success && res.data) {
        const loaded = res.data as Offering[];
        setOfferings(loaded);
        // Pre-fill with first offering's example (use on-chain index, not array position)
        if (loaded.length > 0 && loaded[0].exampleInput) {
          setSelectedOffering(loaded[0].index);
          try {
            setRequirementJson(JSON.stringify(JSON.parse(loaded[0].exampleInput), null, 2));
          } catch {
            setRequirementJson(loaded[0].exampleInput);
          }
        }
      } else {
        setError(res.error ?? 'Failed to discover offerings');
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleCreateJob = async () => {
    setCreating(true);
    setError(null);
    try {
      let requirement: Record<string, unknown>;
      try {
        requirement = JSON.parse(requirementJson);
      } catch {
        setError('Invalid JSON in requirement field');
        setCreating(false);
        return;
      }
      const res = await api.agentSim.createJob(selectedOffering, requirement);
      if (res.success && res.data) {
        const { jobId } = res.data as { jobId: number };
        setSelectedJobId(jobId);
        await refreshJobs();
        await refreshJobDetail(jobId);
      } else {
        setError(res.error ?? 'Failed to create job');
      }
    } catch (err) {
      setError((err as Error).message);
    }
    setCreating(false);
  };

  const handleCreateAllJobs = async () => {
    setCreatingAll(true);
    setCreatingProgress(0);
    setError(null);
    try {
      for (let i = 0; i < offerings.length; i++) {
        setCreatingProgress(i + 1);
        const offering = offerings[i];
        let requirement: Record<string, unknown> = {};
        if (offering.exampleInput) {
          try { requirement = JSON.parse(offering.exampleInput); } catch { /* use empty */ }
        }
        const res = await api.agentSim.createJob(offering.index, requirement);
        if (!res.success) {
          setError(`Failed on offering "${offering.name}": ${res.error ?? 'Unknown error'}`);
          break;
        }
        // Select the last created job
        if (res.data) {
          const { jobId } = res.data as { jobId: number };
          setSelectedJobId(jobId);
        }
      }
      await refreshJobs();
      if (selectedJobId !== null) await refreshJobDetail(selectedJobId);
    } catch (err) {
      setError((err as Error).message);
    }
    setCreatingAll(false);
    setCreatingProgress(0);
  };

  const handlePay = async () => {
    if (selectedJobId === null) return;
    setError(null);
    try {
      const res = await api.agentSim.payJob(selectedJobId);
      if (!res.success) setError(res.error ?? 'Payment failed');
      await refreshJobDetail(selectedJobId);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleAccept = async () => {
    if (selectedJobId === null) return;
    setError(null);
    try {
      const res = await api.agentSim.acceptJob(selectedJobId);
      if (!res.success) setError(res.error ?? 'Accept failed');
      await refreshJobDetail(selectedJobId);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleReject = async () => {
    if (selectedJobId === null) return;
    setError(null);
    try {
      const res = await api.agentSim.rejectJob(selectedJobId);
      if (!res.success) setError(res.error ?? 'Reject failed');
      await refreshJobDetail(selectedJobId);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleSelectJob = async (jobId: number) => {
    setSelectedJobId(jobId);
    setJobLoading(true);
    await refreshJobDetail(jobId);
    setJobLoading(false);
  };

  // const handleSendAgentMessage = async () => {
  //   if (!selectedSessionId || !agentMsg.trim()) return;
  //   setSendingMsg(true);
  //   await api.sendSessionMessage(selectedSessionId, agentMsg.trim(), 'agent');
  //   setAgentMsg('');
  //   setSendingMsg(false);
  // };

  // Auto-fill requirement JSON from offering's example data when selection changes
  const handleOfferingChange = useCallback((idx: number) => {
    setSelectedOffering(idx);
    const offering = offerings.find(o => o.index === idx);
    if (offering?.exampleInput) {
      try {
        // Pretty-print the example JSON
        const parsed = JSON.parse(offering.exampleInput);
        setRequirementJson(JSON.stringify(parsed, null, 2));
      } catch {
        setRequirementJson(offering.exampleInput);
      }
    }
  }, [offerings]);

  // Find session linked to selected job
  const linkedSession = selectedJobId !== null
    ? sessions.find(s => s.acpJobId === String(selectedJobId))
    : null;

  return (
    <div>
      <h2 className="page-title" style={{ marginBottom: 16 }}>ACP Demo</h2>
      <p style={{ color: '#6B7280', fontSize: 13, marginBottom: 20 }}>
        Test the full ACP flow: create onchain jobs as a buyer agent, then complete them as an expert.
      </p>

      {error && (
        <div className="alert alert-error mb-md" style={{ padding: '8px 12px', fontSize: 13 }}>
          {error}
          <button onClick={() => setError(null)} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>x</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
        {/* ── LEFT: Expert Chat ── */}
        <div>
          <div className="card" style={{ padding: 16, marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Expert Chat</h3>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: '#6B7280', display: 'block', marginBottom: 4 }}>Session</label>
              <select
                value={selectedSessionId ?? ''}
                onChange={e => setSelectedSessionId(e.target.value || null)}
                className="input input-full"
                style={{ fontSize: 13 }}
              >
                <option value="">Select a session...</option>
                {sessions.map(s => (
                  <option key={s.id} value={s.id}>
                    {formatOffering(s.offeringType)} — {s.status} {s.acpJobId ? `(ACP #${s.acpJobId})` : ''}
                  </option>
                ))}
              </select>
            </div>
            {linkedSession && selectedSessionId !== linkedSession.id && (
              <button
                className="btn btn-ghost btn-sm mb-sm"
                onClick={() => setSelectedSessionId(linkedSession.id)}
                style={{ fontSize: 12 }}
              >
                Switch to linked session (ACP #{selectedJobId})
              </button>
            )}
          </div>

          {selectedSessionId ? (
            <div style={{ border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
              <ChatView
                sessionId={selectedSessionId}
                onBack={() => setSelectedSessionId(null)}
              />
            </div>
          ) : (
            <div className="card" style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>
              Select a session to view the expert chat
            </div>
          )}

          {/* Agent messaging — disabled until memo bridge is reliable
          {selectedSessionId && (
            <div className="card" style={{ padding: 12, marginTop: 12 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 13, color: '#6B7280' }}>Send as Agent</h4>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={agentMsg}
                  onChange={e => setAgentMsg(e.target.value)}
                  placeholder="Type agent message..."
                  className="input"
                  style={{ flex: 1, fontSize: 13 }}
                  onKeyDown={e => e.key === 'Enter' && handleSendAgentMessage()}
                />
                <button
                  onClick={handleSendAgentMessage}
                  disabled={sendingMsg || !agentMsg.trim()}
                  className="btn btn-primary btn-sm"
                >
                  Send
                </button>
              </div>
            </div>
          )}
          */}
        </div>

        {/* ── RIGHT: Agent Control Panel ── */}
        <div>
          {/* Connection */}
          <div className="card" style={{ padding: 16, marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Buyer Agent</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span className={`status-dot status-dot-${status?.connected ? 'online' : 'offline'}`} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                {status?.connected ? 'Connected' : 'Disconnected'}
              </span>
              {!status?.connected && (
                <button
                  onClick={handleInit}
                  disabled={initializing}
                  className="btn btn-primary btn-sm"
                >
                  {initializing ? 'Connecting...' : 'Initialize'}
                </button>
              )}
            </div>
            {status?.wallet && (
              <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#6B7280', marginBottom: 4, wordBreak: 'break-all' }}>
                Wallet: {status.wallet}
              </div>
            )}
            {status?.gasPrice !== null && status?.gasPrice !== undefined && (
              <div style={{ fontSize: 11, color: status.gasPrice > 0.5 ? '#DC2626' : '#059669' }}>
                Gas: {status.gasPrice.toFixed(4)} gwei {status.gasPrice > 0.5 ? '(HIGH)' : '(OK)'}
              </div>
            )}
          </div>

          {/* Discover Offerings */}
          {status?.connected && (
            <div className="card" style={{ padding: 16, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 15 }}>Create Job</h3>
                <button
                  onClick={handleDiscoverOfferings}
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: 12 }}
                >
                  Refresh Offerings
                </button>
              </div>

              {offerings.length === 0 ? (
                <button onClick={handleDiscoverOfferings} className="btn btn-secondary btn-sm">
                  Discover Offerings
                </button>
              ) : (
                <>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 12, color: '#6B7280', display: 'block', marginBottom: 4 }}>Offering</label>
                    <select
                      value={selectedOffering}
                      onChange={e => handleOfferingChange(parseInt(e.target.value, 10))}
                      className="input input-full"
                      style={{ fontSize: 13 }}
                    >
                      {offerings.map(o => (
                        <option key={o.index} value={o.index}>
                          {formatOffering(o.name)} — {o.price} USDC
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Requirement field descriptions from Virtuals registration */}
                  {offerings.find(o => o.index === selectedOffering)?.requirementFields && (
                    <div style={{
                      marginBottom: 8, padding: '8px 10px', background: '#F0FDF4', borderRadius: 6,
                      fontSize: 11, color: '#065F46', lineHeight: 1.5,
                    }}>
                      <strong>Fields:</strong> {offerings.find(o => o.index === selectedOffering)!.requirementFields}
                    </div>
                  )}

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 12, color: '#6B7280', display: 'block', marginBottom: 4 }}>
                      Requirement JSON (pre-filled from Virtuals offering)
                    </label>
                    <textarea
                      value={requirementJson}
                      onChange={e => setRequirementJson(e.target.value)}
                      className="input input-full"
                      style={{ fontSize: 12, fontFamily: 'monospace', minHeight: 150, resize: 'vertical' }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={handleCreateJob}
                      disabled={creating || creatingAll}
                      className="btn btn-primary"
                      style={{ flex: 1 }}
                    >
                      {creating ? 'Creating...' : 'Create Job (onchain)'}
                    </button>
                    <button
                      onClick={handleCreateAllJobs}
                      disabled={creating || creatingAll}
                      className="btn btn-secondary"
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      {creatingAll ? `Creating ${creatingProgress}/${offerings.length}...` : `Create All (${offerings.length})`}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Active Jobs */}
          {trackedJobs.length > 0 && (() => {
            const activeJobs = trackedJobs.filter(j => j.phase !== 'REJECTED' && j.phase !== 'COMPLETED');
            const finishedJobs = trackedJobs.filter(j => j.phase === 'REJECTED' || j.phase === 'COMPLETED');
            const visibleJobs = showFinishedJobs ? trackedJobs : activeJobs;
            return (
              <div className="card" style={{ padding: 16, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={{ margin: 0, fontSize: 15 }}>Jobs</h3>
                  {finishedJobs.length > 0 && (
                    <button
                      onClick={() => setShowFinishedJobs(!showFinishedJobs)}
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: 11 }}
                    >
                      {showFinishedJobs ? 'Hide finished' : `Show finished (${finishedJobs.length})`}
                    </button>
                  )}
                </div>
                {visibleJobs.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' }}>
                    No active jobs {finishedJobs.length > 0 && `(${finishedJobs.length} finished)`}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {visibleJobs.map(j => (
                      <button
                        key={j.jobId}
                        onClick={() => handleSelectJob(j.jobId)}
                        className={selectedJobId === j.jobId ? 'card' : ''}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 12px',
                          background: selectedJobId === j.jobId ? 'var(--color-primary-light, #EEF2FF)' : '#F9FAFB',
                          border: selectedJobId === j.jobId ? '1px solid var(--color-primary, #4F46E5)' : '1px solid #E5E7EB',
                          borderRadius: 6,
                          cursor: 'pointer',
                          textAlign: 'left',
                          width: '100%',
                        }}
                      >
                        <span style={{ fontSize: 13, fontWeight: 600 }}>Job #{j.jobId}</span>
                        {phaseBadge(j.phase)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Job Detail + Actions */}
          {selectedJobId !== null && (
            <div className="card" style={{ padding: 16, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 15 }}>Job #{selectedJobId}</h3>
                <button onClick={() => refreshJobDetail(selectedJobId)} className="btn btn-ghost btn-sm" style={{ fontSize: 12 }}>
                  Refresh
                </button>
              </div>

              {jobLoading ? (
                <p style={{ color: '#9CA3AF', fontSize: 13 }}>Loading...</p>
              ) : jobDetail ? (
                <>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 13 }}>Phase:</span>
                      {phaseBadge(jobDetail.phase)}
                    </div>
                    <div style={{ fontSize: 13, color: '#6B7280' }}>
                      Price: {jobDetail.price} USDC
                    </div>
                  </div>

                  {/* Memos */}
                  {jobDetail.memos.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>
                        Memos ({jobDetail.memos.length})
                      </div>
                      <div style={{
                        maxHeight: 150,
                        overflow: 'auto',
                        background: '#F9FAFB',
                        borderRadius: 6,
                        padding: 8,
                        fontSize: 11,
                        fontFamily: 'monospace',
                      }}>
                        {jobDetail.memos.map((m, i) => (
                          <div key={i} style={{ marginBottom: 4, wordBreak: 'break-word' }}>
                            {m.content}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Linked session */}
                  {linkedSession && (
                    <div style={{ marginBottom: 12, padding: '6px 10px', background: '#EEF2FF', borderRadius: 6, fontSize: 12 }}>
                      Job: <strong>{formatOffering(linkedSession.offeringType)}</strong> ({linkedSession.status})
                      {selectedSessionId !== linkedSession.id && (
                        <button
                          onClick={() => setSelectedSessionId(linkedSession.id)}
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: 11, marginLeft: 8, padding: '2px 6px' }}
                        >
                          View Chat
                        </button>
                      )}
                    </div>
                  )}

                  {/* Phase-specific actions */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {jobDetail.phase === 'NEGOTIATION' && (
                      <button onClick={handlePay} className="btn btn-primary btn-sm">
                        Pay & Accept ({jobDetail.price} USDC)
                      </button>
                    )}
                    {jobDetail.phase === 'EVALUATION' && (
                      <>
                        <button onClick={handleAccept} className="btn-green btn-sm">
                          Accept Deliverable
                        </button>
                        <button onClick={handleReject} className="btn btn-secondary btn-sm" style={{ color: '#DC2626' }}>
                          Reject
                        </button>
                      </>
                    )}
                    {(jobDetail.phase === 'COMPLETED' || jobDetail.phase === 'REJECTED') && (
                      <span style={{ fontSize: 12, color: '#6B7280', fontStyle: 'italic' }}>
                        Job finished ({jobDetail.phase.toLowerCase()})
                      </span>
                    )}
                    {(jobDetail.phase === 'REQUEST' || jobDetail.phase === 'TRANSACTION') && (
                      <span style={{ fontSize: 12, color: '#6B7280', fontStyle: 'italic' }}>
                        Waiting for {jobDetail.phase === 'REQUEST' ? 'provider to accept' : 'expert to complete'}...
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <p style={{ color: '#9CA3AF', fontSize: 13 }}>Select a job to view details</p>
              )}
            </div>
          )}

          {/* Safety info */}
          <div style={{ fontSize: 11, color: '#9CA3AF', padding: '0 4px' }}>
            Safety: max fee 0.01 USDC, gas cap 0.5 gwei. All signing server-side.
          </div>
        </div>
      </div>
    </div>
  );
}
