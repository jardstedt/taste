import type { Session } from '../types/index.js';

interface SessionRequestProps {
  session: Session;
  onAccept: (sessionId: string) => void;
  onDecline: (sessionId: string) => void;
}

function getInitials(name: string): string {
  return name.split(/[_\s]+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export function SessionRequest({ session, onAccept, onDecline }: SessionRequestProps) {
  const deadline = session.deadlineAt ? new Date(session.deadlineAt) : null;
  const now = Date.now();
  const remainingMs = deadline ? Math.max(0, deadline.getTime() - now) : 0;
  const remainingMins = Math.ceil(remainingMs / 60_000);
  const agentName = session.buyerAgentDisplay || session.buyerAgent || 'AI Agent';
  const initials = getInitials(agentName);

  return (
    <div className="session-request">
      {/* Top row: avatar + name | price + deadline */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'linear-gradient(135deg, #3B82F6, #06B6D4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color: '#fff'
          }}>
            {initials}
          </div>
          <div>
            <div style={{ color: '#1A1A2E', fontSize: 15, fontWeight: 600 }}>{agentName}</div>
            <div style={{ color: '#9CA3AF', fontSize: 12 }}>{session.offeringType.replace(/_/g, ' ')}</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: '#059669', fontSize: 20, fontWeight: 700 }}>${session.priceUsdc.toFixed(0)}</div>
          {deadline && (
            <div style={{ color: '#D97706', fontSize: 11, fontWeight: 500 }}>{remainingMins} min to accept</div>
          )}
        </div>
      </div>

      {/* Description */}
      {session.description && (
        <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, marginBottom: 16 }}>{session.description}</p>
      )}

      {/* Tags */}
      {session.tags.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {session.tags.map(tag => <span key={tag} className="tag-purple">{tag}</span>)}
        </div>
      )}

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={() => onDecline(session.id)}
          style={{
            flex: 1, padding: 10, borderRadius: 10,
            border: '1px solid #E5E7EB', background: '#fff',
            color: '#9CA3AF', fontSize: 14, cursor: 'pointer',
            fontFamily: 'var(--font-family)', fontWeight: 500
          }}
        >
          Decline
        </button>
        <button
          onClick={() => onAccept(session.id)}
          style={{
            flex: 2, padding: 10, borderRadius: 10,
            border: 'none', background: '#6B21A8',
            color: '#fff', fontSize: 14, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'var(--font-family)'
          }}
        >
          Accept Session
        </button>
      </div>
    </div>
  );
}
