import { useState, useEffect } from 'react';
import * as api from '../api/client.js';

interface AcpMemoInspection {
  id: number;
  type: string;
  typeCode: number;
  status: string;
  senderAddress: string;
  content: string;
  nextPhase: string;
  txHash: string | null;
  signedTxHash: string | null;
}

interface AcpJobInspection {
  acpJobId: number;
  phase: string;
  phaseCode: number;
  clientAddress: string;
  providerAddress: string;
  evaluatorAddress: string;
  price: number;
  deliverable: string | null;
  rejectionReason: string | null;
  requirement: unknown;
  memos: AcpMemoInspection[];
  localSession: {
    id: string;
    status: string;
    expertId: string | null;
    offeringType: string;
    createdAt: string;
  } | null;
}

const PHASE_COLORS: Record<string, string> = {
  REQUEST: '#F59E0B',
  NEGOTIATION: '#3B82F6',
  TRANSACTION: '#FB923C',
  EVALUATION: '#F472B6',
  COMPLETED: '#2DD4BF',
  REJECTED: '#EF4444',
  EXPIRED: '#7A7670',
};

function truncateAddress(addr: string): string {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function tryParseJson(str: string): { parsed: unknown; isJson: boolean } {
  try {
    const parsed = JSON.parse(str);
    return { parsed, isJson: true };
  } catch {
    return { parsed: str, isJson: false };
  }
}

function JsonBlock({ data, label }: { data: unknown; label?: string }) {
  const [expanded, setExpanded] = useState(false);
  const str = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  const isLong = str.length > 200;

  return (
    <div style={{ marginTop: 4 }}>
      {label && <div style={{ fontSize: 11, color: '#7A7670', fontWeight: 600, marginBottom: 2 }}>{label}</div>}
      <pre style={{
        background: '#1E1E22', border: '1px solid #2A2A2E', borderRadius: 6,
        padding: '8px 10px', fontSize: 11, fontFamily: 'monospace',
        whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0,
        maxHeight: expanded ? 'none' : 160, overflow: 'hidden',
        position: 'relative',
      }}>
        {str}
      </pre>
      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            background: 'none', border: 'none', color: '#2DD4BF', cursor: 'pointer',
            fontSize: 11, padding: '2px 0', fontWeight: 600,
          }}
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}

function MemoCard({ memo }: { memo: AcpMemoInspection }) {
  const { parsed, isJson } = tryParseJson(memo.content);

  return (
    <div style={{
      padding: '10px 12px', background: '#161618', border: '1px solid #2A2A2E',
      borderRadius: 8, marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            background: 'rgba(45, 212, 191, 0.12)', color: '#2DD4BF', fontWeight: 600,
            padding: '1px 6px', borderRadius: 4, fontSize: 10,
          }}>
            #{memo.id}
          </span>
          <span style={{
            background: 'rgba(59, 130, 246, 0.12)', color: '#3B82F6', fontWeight: 600,
            padding: '1px 6px', borderRadius: 4, fontSize: 10,
          }}>
            {memo.type}
          </span>
          <span style={{
            background: memo.status === 'APPROVED' ? 'rgba(45, 212, 191, 0.12)' : memo.status === 'REJECTED' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(251, 146, 60, 0.12)',
            color: memo.status === 'APPROVED' ? '#2DD4BF' : memo.status === 'REJECTED' ? '#EF4444' : '#FB923C',
            fontWeight: 600, padding: '1px 6px', borderRadius: 4, fontSize: 10,
          }}>
            {memo.status}
          </span>
        </div>
        <span style={{ fontSize: 10, color: '#7A7670' }}>
          {truncateAddress(memo.senderAddress)}
        </span>
      </div>
      {isJson ? (
        <JsonBlock data={parsed} />
      ) : (
        <div style={{
          fontSize: 12, color: '#E8E2DA', marginTop: 4,
          maxHeight: 100, overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {memo.content.slice(0, 500)}{memo.content.length > 500 ? '...' : ''}
        </div>
      )}
      {memo.txHash && (
        <div style={{ fontSize: 10, color: '#7A7670', marginTop: 4, fontFamily: 'monospace' }}>
          TX: {memo.txHash.slice(0, 20)}...
        </div>
      )}
    </div>
  );
}

function JobCard({ job, defaultExpanded }: { job: AcpJobInspection; defaultExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? false);
  const phaseColor = PHASE_COLORS[job.phase] ?? '#7A7670';

  return (
    <div style={{
      border: '1px solid #2A2A2E', borderRadius: 10, marginBottom: 12,
      background: '#161618', overflow: 'hidden',
    }}>
      {/* Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', cursor: 'pointer',
          borderBottom: expanded ? '1px solid #2A2A2E' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#E8E2DA' }}>
            Job #{job.acpJobId}
          </span>
          <span style={{
            background: phaseColor + '20', color: phaseColor, fontWeight: 700,
            padding: '2px 8px', borderRadius: 6, fontSize: 11,
          }}>
            {job.phase}
          </span>
          {job.localSession && (
            <span style={{
              background: 'rgba(45, 212, 191, 0.12)', color: '#2DD4BF', fontWeight: 600,
              padding: '2px 8px', borderRadius: 6, fontSize: 11,
            }}>
              {job.localSession.offeringType.replace(/_/g, ' ')}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {job.localSession && (
            <span style={{
              fontSize: 10, color: '#7A7670', fontFamily: 'monospace',
            }}>
              {new Date(job.localSession.createdAt).toLocaleString('sv-SE', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {job.localSession && (
            <span style={{
              background: job.localSession.status === 'completed' ? 'rgba(45, 212, 191, 0.12)' :
                job.localSession.status === 'cancelled' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(251, 146, 60, 0.12)',
              color: job.localSession.status === 'completed' ? '#2DD4BF' :
                job.localSession.status === 'cancelled' ? '#EF4444' : '#FB923C',
              fontWeight: 600, padding: '2px 6px', borderRadius: 4, fontSize: 10,
            }}>
              {job.localSession.status}
            </span>
          )}
          {job.price > 0 ? (
            <span style={{ fontSize: 13, fontWeight: 600, color: '#2DD4BF' }}>
              {job.price} USDC
            </span>
          ) : null}
          <span style={{ fontSize: 12, color: '#7A7670' }}>
            {expanded ? '\u25B2' : '\u25BC'}
          </span>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{ padding: 16 }}>
          {/* Addresses */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 8, marginBottom: 16,
          }}>
            <div>
              <div style={{ fontSize: 10, color: '#7A7670', fontWeight: 600, textTransform: 'uppercase' }}>Client (Buyer)</div>
              <div style={{ fontSize: 12, fontFamily: 'monospace', color: '#E8E2DA', wordBreak: 'break-all' }}>
                {job.clientAddress}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#7A7670', fontWeight: 600, textTransform: 'uppercase' }}>Provider (Us)</div>
              <div style={{ fontSize: 12, fontFamily: 'monospace', color: '#E8E2DA', wordBreak: 'break-all' }}>
                {job.providerAddress}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#7A7670', fontWeight: 600, textTransform: 'uppercase' }}>Evaluator</div>
              <div style={{ fontSize: 12, fontFamily: 'monospace', color: '#E8E2DA', wordBreak: 'break-all' }}>
                {job.evaluatorAddress}
              </div>
            </div>
          </div>

          {/* Local session link */}
          {job.localSession && (
            <div style={{
              background: 'rgba(45, 212, 191, 0.12)', borderRadius: 8, padding: '8px 12px', marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: 12, color: '#2DD4BF', fontWeight: 600 }}>Local Session:</span>
              <a
                href={`/dashboard/session/${job.localSession.id}`}
                style={{ fontSize: 12, color: '#2DD4BF', fontFamily: 'monospace' }}
              >
                {job.localSession.id.slice(0, 12)}...
              </a>
              <span style={{
                background: '#161618', padding: '1px 6px', borderRadius: 4,
                fontSize: 10, fontWeight: 600, color: '#2DD4BF',
              }}>
                {job.localSession.status}
              </span>
            </div>
          )}

          {/* Requirement */}
          {job.requirement != null && (
            <JsonBlock data={job.requirement} label="REQUIREMENT" />
          )}

          {/* Deliverable */}
          {job.deliverable && (() => {
            const { parsed, isJson } = tryParseJson(job.deliverable);
            return (
              <div style={{ marginTop: 12 }}>
                <JsonBlock data={isJson ? parsed : job.deliverable} label="DELIVERABLE" />
              </div>
            );
          })()}

          {/* Rejection reason */}
          {job.rejectionReason && (
            <div style={{
              marginTop: 12, background: 'rgba(239, 68, 68, 0.12)', borderRadius: 8, padding: '8px 12px',
            }}>
              <div style={{ fontSize: 10, color: '#EF4444', fontWeight: 600, textTransform: 'uppercase' }}>Rejection Reason</div>
              <div style={{ fontSize: 12, color: '#EF4444', marginTop: 2 }}>{job.rejectionReason}</div>
            </div>
          )}

          {/* Memos */}
          {job.memos.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 11, color: '#7A7670', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>
                Memos ({job.memos.length})
              </div>
              {job.memos.map(memo => (
                <MemoCard key={memo.id} memo={memo} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Our Sessions Tab ──

interface OurSession {
  id: string;
  acpJobId: string | null;
  offeringType: string;
  status: string;
  buyerAgent: string | null;
  createdAt: string;
  completedAt: string | null;
  cancelReason: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  completed: '#2DD4BF',
  cancelled: '#EF4444',
  matching: '#F59E0B',
  active: '#3B82F6',
  timeout: '#7A7670',
};

function OurSessionsTab() {
  const [sessions, setSessions] = useState<OurSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [offeringFilter, setOfferingFilter] = useState<string>('all');
  const [chainStatus, setChainStatus] = useState<Record<string, { phase: string; loading: boolean }>>({});

  const load = async () => {
    setLoading(true);
    setError(null);
    const res = await api.getSessions(500);
    if (res.success && res.data) {
      const all = (res.data as OurSession[]).filter(s => s.acpJobId);
      setSessions(all);
    } else {
      setError(res.error ?? 'Failed to load sessions');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const checkOnChain = async (jobId: string) => {
    setChainStatus(prev => ({ ...prev, [jobId]: { phase: '...', loading: true } }));
    try {
      const res = await api.getAcpJob(Number(jobId));
      if (res.success && res.data) {
        const job = res.data as AcpJobInspection;
        setChainStatus(prev => ({ ...prev, [jobId]: { phase: job.phase, loading: false } }));
      } else {
        setChainStatus(prev => ({ ...prev, [jobId]: { phase: 'NOT_FOUND', loading: false } }));
      }
    } catch {
      setChainStatus(prev => ({ ...prev, [jobId]: { phase: 'ERROR', loading: false } }));
    }
  };

  const checkAllOnChain = async () => {
    for (const s of filtered) {
      if (s.acpJobId) await checkOnChain(s.acpJobId);
    }
  };

  // Unique agents and offerings for filters
  const agents = [...new Set(sessions.map(s => s.buyerAgent || 'unknown'))];
  const offerings = [...new Set(sessions.map(s => s.offeringType))].sort();

  const statusCounts = sessions.reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1;
    return acc;
  }, {});

  const filtered = sessions.filter(s => {
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    if (agentFilter !== 'all' && (s.buyerAgent || 'unknown') !== agentFilter) return false;
    if (offeringFilter !== 'all' && s.offeringType !== offeringFilter) return false;
    return true;
  });

  // Summary for filtered
  const filteredByOffering = filtered.reduce<Record<string, number>>((acc, s) => {
    acc[s.offeringType] = (acc[s.offeringType] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Status filter */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <button
            onClick={() => setStatusFilter('all')}
            className={`btn btn-sm ${statusFilter === 'all' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: 11, padding: '3px 10px', height: 'auto' }}
          >
            All ({sessions.length})
          </button>
          {Object.entries(statusCounts).sort().map(([status, count]) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`btn btn-sm ${statusFilter === status ? 'btn-primary' : 'btn-ghost'}`}
              style={{
                fontSize: 11, padding: '3px 10px', height: 'auto',
                color: statusFilter === status ? undefined : STATUS_COLORS[status] ?? '#7A7670',
              }}
            >
              {status} ({count})
            </button>
          ))}
        </div>

        {/* Agent filter */}
        {agents.length > 1 && (
          <select
            value={agentFilter}
            onChange={e => setAgentFilter(e.target.value)}
            style={{
              background: '#1E1E22', border: '1px solid #2A2A2E', borderRadius: 6,
              color: '#E8E2DA', fontSize: 11, padding: '4px 8px',
            }}
          >
            <option value="all">All agents</option>
            {agents.map(a => (
              <option key={a} value={a}>{truncateAddress(a)}</option>
            ))}
          </select>
        )}

        {/* Offering filter */}
        <select
          value={offeringFilter}
          onChange={e => setOfferingFilter(e.target.value)}
          style={{
            background: '#1E1E22', border: '1px solid #2A2A2E', borderRadius: 6,
            color: '#E8E2DA', fontSize: 11, padding: '4px 8px',
          }}
        >
          <option value="all">All offerings</option>
          {offerings.map(o => (
            <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>
          ))}
        </select>

        <button onClick={load} disabled={loading} className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
        <button onClick={checkAllOnChain} className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}>
          Check all on-chain
        </button>
      </div>

      {/* Summary */}
      <div style={{
        background: '#161618', border: '1px solid #2A2A2E', borderRadius: 8,
        padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#E8E2DA',
        display: 'flex', gap: 16, flexWrap: 'wrap',
      }}>
        <span style={{ fontWeight: 600 }}>Showing: {filtered.length}</span>
        {Object.entries(filteredByOffering).sort().map(([o, c]) => (
          <span key={o} style={{ color: '#7A7670' }}>{o.replace(/_/g, ' ')}: {c}</span>
        ))}
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #2A2A2E', textAlign: 'left' }}>
              <th style={{ padding: '8px 10px', color: '#7A7670', fontWeight: 600, fontSize: 10 }}>JOB ID</th>
              <th style={{ padding: '8px 10px', color: '#7A7670', fontWeight: 600, fontSize: 10 }}>OFFERING</th>
              <th style={{ padding: '8px 10px', color: '#7A7670', fontWeight: 600, fontSize: 10 }}>STATUS</th>
              <th style={{ padding: '8px 10px', color: '#7A7670', fontWeight: 600, fontSize: 10 }}>ON-CHAIN</th>
              <th style={{ padding: '8px 10px', color: '#7A7670', fontWeight: 600, fontSize: 10 }}>AGENT</th>
              <th style={{ padding: '8px 10px', color: '#7A7670', fontWeight: 600, fontSize: 10 }}>TIME</th>
              <th style={{ padding: '8px 10px', color: '#7A7670', fontWeight: 600, fontSize: 10 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => {
              const cs = s.acpJobId ? chainStatus[s.acpJobId] : undefined;
              const statusColor = STATUS_COLORS[s.status] ?? '#7A7670';
              const chainColor = cs ? (PHASE_COLORS[cs.phase] ?? '#7A7670') : undefined;
              return (
                <tr key={s.id} style={{ borderBottom: '1px solid #1E1E22' }}>
                  <td style={{ padding: '6px 10px', fontFamily: 'monospace', color: '#E8E2DA' }}>
                    {s.acpJobId ?? '-'}
                  </td>
                  <td style={{ padding: '6px 10px', color: '#2DD4BF' }}>
                    {s.offeringType.replace(/_/g, ' ')}
                  </td>
                  <td style={{ padding: '6px 10px' }}>
                    <span style={{
                      background: statusColor + '20', color: statusColor, fontWeight: 600,
                      padding: '1px 6px', borderRadius: 4, fontSize: 10,
                    }}>
                      {s.status}
                    </span>
                  </td>
                  <td style={{ padding: '6px 10px' }}>
                    {cs ? (
                      <span style={{
                        background: chainColor + '20', color: chainColor, fontWeight: 600,
                        padding: '1px 6px', borderRadius: 4, fontSize: 10,
                      }}>
                        {cs.loading ? '...' : cs.phase}
                      </span>
                    ) : (
                      <button
                        onClick={() => s.acpJobId && checkOnChain(s.acpJobId)}
                        style={{
                          background: 'none', border: '1px solid #2A2A2E', color: '#7A7670',
                          borderRadius: 4, fontSize: 10, padding: '1px 6px', cursor: 'pointer',
                        }}
                      >
                        check
                      </button>
                    )}
                  </td>
                  <td style={{ padding: '6px 10px', fontFamily: 'monospace', fontSize: 10, color: '#7A7670' }}>
                    {truncateAddress(s.buyerAgent || '')}
                  </td>
                  <td style={{ padding: '6px 10px', fontSize: 10, color: '#7A7670', fontFamily: 'monospace' }}>
                    {new Date(s.createdAt).toLocaleString('sv-SE', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td style={{ padding: '6px 10px' }}>
                    <a
                      href={`/dashboard/session/${s.id}`}
                      style={{ color: '#3B82F6', fontSize: 10, textDecoration: 'none' }}
                    >
                      view
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {loading && sessions.length === 0 && (
        <div className="text-grey" style={{ textAlign: 'center', padding: 40 }}>Loading sessions...</div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-grey" style={{ textAlign: 'center', padding: 40 }}>
          No sessions match the current filters.
        </div>
      )}
    </div>
  );
}

// ── Main Component ──

export function AcpInspector() {
  const [tab, setTab] = useState<'sessions' | 'onchain'>('sessions');
  const [jobs, setJobs] = useState<AcpJobInspection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const loadOnChain = async () => {
    setLoading(true);
    setError(null);
    const res = await api.getAcpJobs();
    if (res.success && res.data) {
      setJobs(res.data as AcpJobInspection[]);
    } else {
      setError(res.error ?? 'Failed to load ACP jobs');
    }
    setLoading(false);
  };

  useEffect(() => { if (tab === 'onchain') loadOnChain(); }, [tab]);

  const filtered = filter === 'all'
    ? jobs
    : jobs.filter(j => j.phase === filter);

  const phaseCounts = jobs.reduce<Record<string, number>>((acc, j) => {
    acc[j.phase] = (acc[j.phase] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 className="page-title" style={{ margin: 0 }}>ACP Inspector</h2>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #2A2A2E', paddingBottom: 0 }}>
        <button
          onClick={() => setTab('sessions')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '8px 16px', fontSize: 13, fontWeight: 600,
            color: tab === 'sessions' ? '#2DD4BF' : '#7A7670',
            borderBottom: tab === 'sessions' ? '2px solid #2DD4BF' : '2px solid transparent',
          }}
        >
          Our Sessions
        </button>
        <button
          onClick={() => setTab('onchain')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '8px 16px', fontSize: 13, fontWeight: 600,
            color: tab === 'onchain' ? '#2DD4BF' : '#7A7670',
            borderBottom: tab === 'onchain' ? '2px solid #2DD4BF' : '2px solid transparent',
          }}
        >
          On-Chain (latest 20)
        </button>
      </div>

      {tab === 'sessions' && <OurSessionsTab />}

      {tab === 'onchain' && (
        <>
          {error && (
            <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>
          )}

          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={() => setFilter('all')}
              className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: 11, padding: '3px 10px', height: 'auto' }}
            >
              All ({jobs.length})
            </button>
            {Object.entries(phaseCounts).sort().map(([phase, count]) => (
              <button
                key={phase}
                onClick={() => setFilter(phase)}
                className={`btn btn-sm ${filter === phase ? 'btn-primary' : 'btn-ghost'}`}
                style={{
                  fontSize: 11, padding: '3px 10px', height: 'auto',
                  color: filter === phase ? undefined : PHASE_COLORS[phase],
                }}
              >
                {phase} ({count})
              </button>
            ))}
            <button onClick={loadOnChain} disabled={loading} className="btn btn-ghost btn-sm" style={{ fontSize: 12 }}>
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {loading && jobs.length === 0 && (
            <div className="text-grey" style={{ textAlign: 'center', padding: 40 }}>Loading on-chain jobs...</div>
          )}

          {!loading && jobs.length === 0 && (
            <div className="text-grey" style={{ textAlign: 'center', padding: 40 }}>
              No ACP jobs found. Jobs appear here when agents create tasks through the ACP protocol.
            </div>
          )}

          {filtered.map(job => (
            <JobCard key={job.acpJobId} job={job} defaultExpanded={filtered.length === 1} />
          ))}
        </>
      )}
    </div>
  );
}
