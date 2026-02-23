import { useState, useEffect } from 'react';
import { useSessions } from '../hooks/useSessions.js';
import { SessionRequest } from './SessionRequest.js';
import * as api from '../api/client.js';
import type { AuthUser } from '../types/index.js';

interface StatsOverviewProps {
  user: AuthUser;
  onNavigateSession: (sessionId: string) => void;
  onAcceptSession: (sessionId: string) => void;
}

function CircularScore({ score, max = 100, size = 80, color = '#6B21A8', label }: {
  score: number; max?: number; size?: number; color?: string; label?: string;
}) {
  const pct = (score / max) * 100;
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);
  return (
    <div className="circular-score">
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} className="circular-score-svg">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F0F0F5" strokeWidth="6" />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="6"
            strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
        </svg>
        <div style={{ position: 'absolute', top: 0, left: 0, width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="circular-score-value">{score}</span>
        </div>
      </div>
      {label && <div className="circular-score-label">{label}</div>}
    </div>
  );
}

export function StatsOverview({ onNavigateSession, onAcceptSession }: StatsOverviewProps) {
  const { sessions, pending, active, completed, loading } = useSessions();
  const [reputation, setReputation] = useState<Record<string, number>>({});

  useEffect(() => {
    api.getMyReputation().then(res => {
      if (res.success && res.data) {
        const data = res.data as { scores: Record<string, number> };
        setReputation(data.scores);
      }
    });
  }, []);

  const totalEarnings = completed.reduce((sum, s) => sum + s.expertPayoutUsdc, 0);
  const avgSessionValue = completed.length > 0 ? totalEarnings / completed.length : 0;

  // Group sessions by offering type for breakdown
  const offeringCounts: Record<string, number> = {};
  sessions.forEach(s => {
    const label = s.offeringType.replace(/_/g, ' ');
    offeringCounts[label] = (offeringCounts[label] || 0) + 1;
  });
  const totalForBreakdown = sessions.length || 1;
  const breakdownItems = Object.entries(offeringCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  const reputationEntries = Object.entries(reputation);
  const reputationColors = ['#6B21A8', '#3B82F6', '#059669', '#D97706', '#EC4899'];
  const avgReputation = reputationEntries.length > 0
    ? Math.round(reputationEntries.reduce((sum, [, v]) => sum + v, 0) / reputationEntries.length)
    : 0;

  return (
    <div>
      {/* Stat Cards */}
      <div className="stats-grid mb-xl">
        <div className="stat-card">
          <div className="stat-label">This Month</div>
          <div className="stat-value" style={{ marginTop: 8 }}>${totalEarnings.toFixed(0)}</div>
          <div className="stat-sub stat-sub-green">Earned from {completed.length} sessions</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Sessions Completed</div>
          <div className="stat-value" style={{ marginTop: 8 }}>{completed.length}</div>
          <div className="stat-sub stat-sub-purple">{avgReputation > 0 ? `${avgReputation} avg score` : 'No ratings yet'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Session Value</div>
          <div className="stat-value" style={{ marginTop: 8 }}>${avgSessionValue.toFixed(2)}</div>
          <div className="stat-sub stat-sub-amber">Per completed session</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Sessions</div>
          <div className="stat-value" style={{ marginTop: 8 }}>{sessions.length}</div>
          <div className="stat-sub stat-sub-blue">{active.length} active now</div>
        </div>
      </div>

      {/* 2-column: Reputation + Breakdown */}
      {(reputationEntries.length > 0 || breakdownItems.length > 0) && (
        <div className="grid-2col mb-xl">
          {/* Reputation by Domain */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ color: '#6B21A8', fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Reputation by Domain</div>
            {reputationEntries.length > 0 ? (
              <div className="reputation-scroll" style={{ display: 'flex', justifyContent: 'space-around', gap: 8 }}>
                {reputationEntries.map(([domain, score], i) => (
                  <CircularScore
                    key={domain}
                    score={score}
                    size={64}
                    color={reputationColors[i % reputationColors.length]}
                    label={domain.charAt(0).toUpperCase() + domain.slice(1)}
                  />
                ))}
              </div>
            ) : (
              <div style={{ color: '#9CA3AF', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
                Complete sessions to build reputation
              </div>
            )}
          </div>

          {/* Session Breakdown */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ color: '#6B21A8', fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Session Breakdown</div>
            {breakdownItems.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {breakdownItems.map(([label, count], i) => {
                  const pct = Math.round((count / totalForBreakdown) * 100);
                  return (
                    <div key={label} className="breakdown-item">
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, color: '#1A1A2E' }}>{label}</span>
                        <span style={{ fontSize: 12, color: '#9CA3AF' }}>{count} sessions</span>
                      </div>
                      <div className="breakdown-bar">
                        <div className="breakdown-fill" style={{ width: `${pct}%`, opacity: 1 - i * 0.15 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ color: '#9CA3AF', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
                No sessions yet
              </div>
            )}
          </div>
        </div>
      )}

      {/* Incoming Requests */}
      {pending.length > 0 && (
        <div className="mb-xl">
          <div className="section-header">Incoming Requests</div>
          <div className="flex flex-col gap-md">
            {pending.slice(0, 3).map(session => (
              <SessionRequest
                key={session.id}
                session={session}
                onAccept={onAcceptSession}
                onDecline={() => {}}
              />
            ))}
          </div>
        </div>
      )}

      {/* Recent Sessions */}
      {completed.length > 0 && (
        <div>
          <div className="section-header">Recent Sessions</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {completed.slice(0, 5).map(session => {
              const agentName = session.buyerAgentDisplay || session.buyerAgent || 'AI Agent';
              const offeringLabel = session.offeringType.replace(/_/g, ' ');
              const date = new Date(session.completedAt || session.createdAt).toLocaleDateString();
              return (
                <div
                  key={session.id}
                  className="session-card"
                  onClick={() => onNavigateSession(session.id)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <div>
                    <div style={{ color: '#1A1A2E', fontSize: 14, fontWeight: 500 }}>{agentName}</div>
                    <div style={{ color: '#9CA3AF', fontSize: 12 }}>{offeringLabel} · {date}</div>
                  </div>
                  <div style={{ color: '#059669', fontSize: 15, fontWeight: 600 }}>
                    ${session.expertPayoutUsdc.toFixed(2)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {sessions.length === 0 && !loading && (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <div className="empty-state-title">No sessions yet</div>
          <div className="empty-state-text">Sessions will appear here when AI agents request your expertise</div>
        </div>
      )}
    </div>
  );
}
