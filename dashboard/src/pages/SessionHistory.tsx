import { useNavigate } from 'react-router-dom';
import { useSessions } from '../hooks/useSessions.js';
import { formatOffering } from '../utils/format.js';
import { JobStatusBadge } from '../components/JobStatusBadge.js';

export function SessionHistory() {
  const navigate = useNavigate();
  const { completed, loading } = useSessions();

  return (
    <div>
      {loading && <p className="text-grey">Loading...</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {completed.map((session, i) => {
          const date = new Date(session.completedAt || session.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const isSuccess = session.status === 'completed';
          return (
            <div
              key={session.id}
              className="session-card"
              onClick={() => navigate(`/dashboard/session/${session.id}`)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
            >
              <div>
                <div style={{ color: '#1A1A2E', fontSize: 14, fontWeight: 500 }}>Job #{completed.length - i}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <span style={{ fontSize: 12, color: '#9CA3AF' }}>{date} · {formatOffering(session.offeringType)}</span>
                  <JobStatusBadge status={session.status} acceptedAt={session.acceptedAt} />
                </div>
              </div>
              <div style={{ color: isSuccess ? '#059669' : '#9CA3AF', fontWeight: 600 }}>
                ${session.expertPayoutUsdc.toFixed(2)}
              </div>
            </div>
          );
        })}
      </div>

      {!loading && completed.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div className="empty-state-title">No completed jobs yet</div>
          <div className="empty-state-text">Your job history will appear here</div>
        </div>
      )}
    </div>
  );
}
