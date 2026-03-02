import type { Session } from '../types/index.js';
import { formatOffering, truncateAddress, parseDescription } from '../utils/format.js';
import { LinkifyText } from './LinkifyText.js';

interface SessionRequestProps {
  session: Session;
  onAccept: (sessionId: string) => void;
  onDecline: (sessionId: string) => void;
}

export function SessionRequest({ session, onAccept, onDecline }: SessionRequestProps) {
  const deadline = session.deadlineAt ? new Date(session.deadlineAt) : null;
  const now = Date.now();
  const remainingMs = deadline ? Math.max(0, deadline.getTime() - now) : 0;
  const remainingMins = Math.ceil(remainingMs / 60_000);
  const desc = parseDescription(session.description);

  return (
    <div className="session-request">
      {/* Top row: title | price + deadline */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ color: '#E8E2DA', fontSize: 15, fontWeight: 600 }}>
            {formatOffering(session.offeringType)} for {truncateAddress(session.buyerAgent)}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ color: '#2DD4BF', fontSize: 20, fontWeight: 700 }}>${session.priceUsdc.toFixed(2)}</div>
          {deadline && (
            <div style={{ color: '#FB923C', fontSize: 11, fontWeight: 500 }}>{remainingMins} min to accept</div>
          )}
        </div>
      </div>

      {/* Description — parsed */}
      {desc.raw && (
        desc.isJson ? (
          <div className="session-request-details" style={{ marginBottom: 16 }}>
            {desc.pairs.map(([label, value]) => {
              const spanFull = desc.pairs.length === 1 || label.toLowerCase().includes('note');
              return (
                <div key={label} style={spanFull ? { gridColumn: '1 / -1' } : undefined}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#7A7670', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 13, color: '#E8E2DA', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}><LinkifyText text={value} /></div>
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: '#7A7670', lineHeight: 1.6, marginBottom: 16 }}><LinkifyText text={desc.raw} /></p>
        )
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
            border: '1px solid #2A2A2E', background: '#161618',
            color: '#7A7670', fontSize: 14, cursor: 'pointer',
            fontFamily: 'var(--font-family)', fontWeight: 500
          }}
        >
          Decline
        </button>
        <button
          onClick={() => onAccept(session.id)}
          style={{
            flex: 2, padding: 10, borderRadius: 10,
            border: 'none', background: '#2DD4BF',
            color: '#0D0D0D', fontSize: 14, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'var(--font-family)'
          }}
        >
          Accept Job
        </button>
      </div>
    </div>
  );
}
