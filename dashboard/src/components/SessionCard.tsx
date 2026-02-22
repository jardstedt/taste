import type { Session } from '../types/index.js';

interface SessionCardProps {
  session: Session;
  onClick?: (sessionId: string) => void;
}

function getInitials(name: string): string {
  return name.split(/[_\s]+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export function SessionCard({ session, onClick }: SessionCardProps) {
  const agentName = session.buyerAgentDisplay || session.buyerAgent || 'AI Agent';
  const initials = getInitials(agentName);
  const offeringLabel = session.offeringType.replace(/_/g, ' ');
  const date = new Date(session.completedAt || session.createdAt).toLocaleDateString();

  return (
    <div
      className="session-card"
      onClick={() => onClick?.(session.id)}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'linear-gradient(135deg, #EC4899, #F59E0B)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0
        }}>
          {initials}
        </div>
        <div>
          <div style={{ color: '#1A1A2E', fontSize: 14, fontWeight: 500 }}>{agentName}</div>
          <div style={{ color: '#9CA3AF', fontSize: 12 }}>{offeringLabel} · {date}</div>
        </div>
      </div>
      <div style={{ color: '#059669', fontSize: 15, fontWeight: 600 }}>
        ${session.expertPayoutUsdc.toFixed(2)}
      </div>
    </div>
  );
}
