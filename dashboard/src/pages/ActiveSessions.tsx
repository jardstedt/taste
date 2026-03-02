import { useNavigate } from 'react-router-dom';
import { useSessions } from '../hooks/useSessions.js';
import { SessionCard } from '../components/SessionCard.js';

export function ActiveSessions() {
  const navigate = useNavigate();
  const { active, loading } = useSessions();

  return (
    <div>
      {loading && <p className="text-grey">Loading...</p>}

      <div className="flex flex-col gap-md">
        {active.map(session => (
          <SessionCard
            key={session.id}
            session={session}
            onClick={(id) => navigate(`/dashboard/session/${id}`)}
          />
        ))}
      </div>

      {!loading && active.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7A7670" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <div className="empty-state-title">No active jobs</div>
          <div className="empty-state-text">When you accept a request, the chat will appear here</div>
        </div>
      )}
    </div>
  );
}
