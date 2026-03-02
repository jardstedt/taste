import type { Session } from '../types/index.js';
import { formatOffering, truncateAddress } from '../utils/format.js';

interface SessionCardProps {
  session: Session;
  onClick?: (sessionId: string) => void;
}

export function SessionCard({ session, onClick }: SessionCardProps) {
  const date = new Date(session.completedAt || session.createdAt).toLocaleDateString();
  const awaitingPayment = !!session.acpJobId && !session.paymentReceivedAt && !['completed', 'cancelled', 'timeout'].includes(session.status);

  return (
    <div
      className="session-card"
      onClick={() => onClick?.(session.id)}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: '#E8E2DA', fontSize: 14, fontWeight: 500 }}>
            {formatOffering(session.offeringType)} for {truncateAddress(session.buyerAgent)}
          </span>
          {awaitingPayment && (
            <span style={{
              background: 'rgba(251, 146, 60, 0.12)', color: '#FB923C', fontWeight: 600,
              padding: '1px 6px', borderRadius: 4, fontSize: 10, whiteSpace: 'nowrap',
            }}>Awaiting Payment</span>
          )}
        </div>
        <div style={{ color: '#7A7670', fontSize: 12 }}>{date}</div>
      </div>
      <div style={{ color: '#2DD4BF', fontSize: 15, fontWeight: 600, flexShrink: 0 }}>
        ${session.expertPayoutUsdc.toFixed(2)}
      </div>
    </div>
  );
}
