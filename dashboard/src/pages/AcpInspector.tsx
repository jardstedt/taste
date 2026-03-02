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
  } | null;
}

const PHASE_COLORS: Record<string, string> = {
  REQUEST: '#F59E0B',
  NEGOTIATION: '#3B82F6',
  TRANSACTION: '#8B5CF6',
  EVALUATION: '#10B981',
  COMPLETED: '#059669',
  REJECTED: '#EF4444',
  EXPIRED: '#6B7280',
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
      {label && <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, marginBottom: 2 }}>{label}</div>}
      <pre style={{
        background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 6,
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
            background: 'none', border: 'none', color: '#6B21A8', cursor: 'pointer',
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
      padding: '10px 12px', background: '#fff', border: '1px solid #E5E7EB',
      borderRadius: 8, marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            background: '#EDE9FE', color: '#6B21A8', fontWeight: 600,
            padding: '1px 6px', borderRadius: 4, fontSize: 10,
          }}>
            #{memo.id}
          </span>
          <span style={{
            background: '#DBEAFE', color: '#1D4ED8', fontWeight: 600,
            padding: '1px 6px', borderRadius: 4, fontSize: 10,
          }}>
            {memo.type}
          </span>
          <span style={{
            background: memo.status === 'APPROVED' ? '#D1FAE5' : memo.status === 'REJECTED' ? '#FEE2E2' : '#FEF3C7',
            color: memo.status === 'APPROVED' ? '#065F46' : memo.status === 'REJECTED' ? '#991B1B' : '#92400E',
            fontWeight: 600, padding: '1px 6px', borderRadius: 4, fontSize: 10,
          }}>
            {memo.status}
          </span>
        </div>
        <span style={{ fontSize: 10, color: '#9CA3AF' }}>
          {truncateAddress(memo.senderAddress)}
        </span>
      </div>
      {isJson ? (
        <JsonBlock data={parsed} />
      ) : (
        <div style={{
          fontSize: 12, color: '#374151', marginTop: 4,
          maxHeight: 100, overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {memo.content.slice(0, 500)}{memo.content.length > 500 ? '...' : ''}
        </div>
      )}
      {memo.txHash && (
        <div style={{ fontSize: 10, color: '#6B7280', marginTop: 4, fontFamily: 'monospace' }}>
          TX: {memo.txHash.slice(0, 20)}...
        </div>
      )}
    </div>
  );
}

function JobCard({ job, defaultExpanded }: { job: AcpJobInspection; defaultExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? false);
  const phaseColor = PHASE_COLORS[job.phase] ?? '#6B7280';

  return (
    <div style={{
      border: '1px solid #E5E7EB', borderRadius: 10, marginBottom: 12,
      background: '#fff', overflow: 'hidden',
    }}>
      {/* Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', cursor: 'pointer',
          borderBottom: expanded ? '1px solid #E5E7EB' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#1A1A2E' }}>
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
              background: '#F3E8FF', color: '#6B21A8', fontWeight: 600,
              padding: '2px 8px', borderRadius: 6, fontSize: 11,
            }}>
              {job.localSession.offeringType.replace(/_/g, ' ')}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {job.price > 0 ? (
            <span style={{ fontSize: 13, fontWeight: 600, color: '#059669' }}>
              {job.price} USDC
            </span>
          ) : null}
          <span style={{ fontSize: 12, color: '#9CA3AF' }}>
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
              <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase' }}>Client (Buyer)</div>
              <div style={{ fontSize: 12, fontFamily: 'monospace', color: '#374151', wordBreak: 'break-all' }}>
                {job.clientAddress}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase' }}>Provider (Us)</div>
              <div style={{ fontSize: 12, fontFamily: 'monospace', color: '#374151', wordBreak: 'break-all' }}>
                {job.providerAddress}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase' }}>Evaluator</div>
              <div style={{ fontSize: 12, fontFamily: 'monospace', color: '#374151', wordBreak: 'break-all' }}>
                {job.evaluatorAddress}
              </div>
            </div>
          </div>

          {/* Local session link */}
          {job.localSession && (
            <div style={{
              background: '#F3E8FF', borderRadius: 8, padding: '8px 12px', marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: 12, color: '#6B21A8', fontWeight: 600 }}>Local Session:</span>
              <a
                href={`/dashboard/session/${job.localSession.id}`}
                style={{ fontSize: 12, color: '#6B21A8', fontFamily: 'monospace' }}
              >
                {job.localSession.id.slice(0, 12)}...
              </a>
              <span style={{
                background: job.localSession.status === 'timeout' || job.localSession.status === 'cancelled'
                  ? '#FEE2E2' : '#fff',
                padding: '1px 6px', borderRadius: 4,
                fontSize: 10, fontWeight: 600,
                color: job.localSession.status === 'timeout' || job.localSession.status === 'cancelled'
                  ? '#991B1B' : '#6B21A8',
              }}>
                {job.localSession.status === 'timeout' ? 'REJECTED (timeout)'
                  : job.localSession.status === 'cancelled' ? 'REJECTED (declined)'
                  : job.localSession.status}
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
              marginTop: 12, background: '#FEE2E2', borderRadius: 8, padding: '8px 12px',
            }}>
              <div style={{ fontSize: 10, color: '#991B1B', fontWeight: 600, textTransform: 'uppercase' }}>Rejection Reason</div>
              <div style={{ fontSize: 12, color: '#991B1B', marginTop: 2 }}>{job.rejectionReason}</div>
            </div>
          )}

          {/* Memos */}
          {job.memos.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>
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

export function AcpInspector() {
  const [jobs, setJobs] = useState<AcpJobInspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const load = async () => {
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

  useEffect(() => { load(); }, []);

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
        <button onClick={load} disabled={loading} className="btn btn-ghost btn-sm" style={{ fontSize: 12 }}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>
      )}

      {/* Phase filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
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
    </div>
  );
}
