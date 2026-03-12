import { useState, useRef, useEffect } from 'react';
import { useChat } from '../hooks/useChat.js';
import { useAuth } from '../hooks/useAuth.js';
import { AddonDetail } from './AddonDetail.js';
import { CompletionForm } from './CompletionForm.js';
import * as api from '../api/client.js';
import type { ChatMessage } from '../types/index.js';
import { formatOffering, truncateAddress, parseDescription } from '../utils/format.js';
import { LinkifyText } from './LinkifyText.js';

const OFFERING_CHECKLIST: Record<string, string[]> = {
  trust_evaluation: ['Assess project legitimacy', 'Check community authenticity', 'Review team/partnership claims', 'Provide trust verdict'],
  cultural_context: ['Provide cultural context', 'Assess trend authenticity', 'Share relevant domain insights'],
  output_quality_gate: ['Review AI output quality', 'Check for errors or issues', 'Suggest improvements'],
  option_ranking: ['Compare all options', 'Rank with reasoning', 'Provide recommendation'],
  blind_spot_check: ['Identify gaps in AI analysis', 'Flag risks or blind spots', 'Provide expert perspective'],
  human_reaction_prediction: ['Predict audience reaction', 'Identify emotional triggers', 'Assess cultural fit'],
  expert_brainstorming: ['Explore creative angles', 'Challenge assumptions', 'Synthesize insights'],
  content_quality_gate: ['Review for cultural sensitivity', 'Check for derivative elements', 'Assess brand safety', 'Evaluate emotional resonance'],
  audience_reaction_poll: ['Rate content quality', 'Score against criteria', 'Provide comparison notes'],
  creative_direction_check: ['Review concept viability', 'Flag cultural red flags', 'Assess tonal alignment'],
  fact_check_verification: ['Verify factual claims', 'Check cited sources', 'Flag inaccuracies', 'Provide corrections'],
  dispute_arbitration: ['Review original contract terms', 'Assess deliverable against requirements', 'Evaluate fulfillment quality', 'Provide approve/reject verdict'],
};

interface ChatViewProps {
  sessionId: string;
  onBack?: () => void;
}

export function ChatView({ sessionId, onBack }: ChatViewProps) {
  const { session, messages, addons, deliverable, loading, sendMessage, acceptAddon } = useChat(sessionId);
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showRequirements, setShowRequirements] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});
  const [showChat, setShowChat] = useState(false);
  const [showDeclineDialog, setShowDeclineDialog] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [declining, setDeclining] = useState(false);
  const [expiring, setExpiring] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Reset state when session changes
  useEffect(() => {
    setCheckedItems({});
    setShowRequirements(false);
    setShowChat(false);
    setShowDeclineDialog(false);
    setDeclineReason('');
  }, [sessionId]);

  // Auto-scroll chat when expanded
  useEffect(() => {
    if (showChat) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, showChat]);

  if (loading) return <div className="text-grey">Loading session...</div>;
  if (!session) return <div className="text-grey">Session not found.</div>;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending) return;
    setSending(true);
    await sendMessage(input.trim());
    setInput('');
    setSending(false);
  };

  const handleDecline = async () => {
    if (!showDeclineDialog) {
      setShowDeclineDialog(true);
      return;
    }
    setDeclining(true);
    await api.declineSession(sessionId, declineReason.trim() || 'Expert unable to fulfill request');
    setDeclining(false);
    setShowDeclineDialog(false);
  };

  const handleExpire = async () => {
    if (!confirm('Expire this session now? This will trigger the timeout flow.')) return;
    setExpiring(true);
    await api.agentSim.expireSession(sessionId);
    setExpiring(false);
    window.location.reload();
  };

  // Timer
  const deadline = session.deadlineAt ? new Date(session.deadlineAt).getTime() : null;
  const now = Date.now();
  const remainingMs = deadline ? Math.max(0, deadline - now) : 0;
  const remainingMins = Math.ceil(remainingMs / 60_000);

  const isActive = session.status === 'active' || session.status === 'accepted' || session.status === 'wrapping_up';
  const awaitingPayment = !!session.acpJobId && !session.paymentReceivedAt && !['completed', 'cancelled', 'timeout'].includes(session.status);
  const graceTurns = 5;
  const isLocked = session.turnCount >= session.maxTurns + graceTurns;
  const pendingAddons = addons.filter(a => a.status === 'pending');

  const checklistItems = OFFERING_CHECKLIST[session.offeringType] || OFFERING_CHECKLIST['trust_evaluation'] || [];
  const checkedCount = Object.values(checkedItems).filter(Boolean).length;
  const totalItems = checklistItems.length;

  const desc = parseDescription(session.description);
  const userMessages = messages.filter(m => m.senderType === 'agent' || m.senderType === 'expert').length;
  const isFinished = session.status === 'completed' || session.status === 'cancelled' || session.status === 'timeout';

  return (
    <div className="chat-container">
      {/* ── Header ── */}
      <div className="chat-header">
        <div className="chat-header-info">
          <div style={{ minWidth: 0 }}>
            <div className="text-bold" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {formatOffering(session.offeringType)} for {truncateAddress(session.buyerAgent)}
            </div>
            <div style={{ fontSize: 11, color: '#7A7670', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {isActive ? (
                <>
                  <span style={{ color: '#2DD4BF', fontWeight: 600 }}>Live</span>
                  {session.acpJobId && (
                    <>
                      <span style={{ color: '#4A4A4E' }}>&middot;</span>
                      <span style={{
                        background: 'rgba(59, 130, 246, 0.12)', color: '#60A5FA', fontWeight: 600,
                        padding: '1px 5px', borderRadius: 4, fontSize: 10,
                      }}>ACP Agent</span>
                    </>
                  )}
                  {awaitingPayment && (
                    <>
                      <span style={{ color: '#4A4A4E' }}>&middot;</span>
                      <span style={{
                        background: 'rgba(251, 146, 60, 0.12)', color: '#FB923C', fontWeight: 600,
                        padding: '1px 5px', borderRadius: 4, fontSize: 10,
                      }}>Awaiting Payment</span>
                    </>
                  )}
                  <span style={{ color: '#4A4A4E' }}>&middot;</span>
                  {deadline && (
                    <>
                      <span className={remainingMins <= 5 ? 'chat-timer-urgent' : ''} style={{ fontWeight: 500 }}>
                        {remainingMins}min left
                      </span>
                      <span style={{ color: '#4A4A4E' }}>&middot;</span>
                    </>
                  )}
                  <span>${session.priceUsdc.toFixed(2)} escrowed</span>
                </>
              ) : (
                <span style={{ textTransform: 'capitalize' }}>{session.status.replace(/_/g, ' ')} · ${session.priceUsdc.toFixed(2)} USDC</span>
              )}
            </div>
          </div>
        </div>
        {user?.role === 'admin' && session.offeringType === 'audience_reaction_poll' && (isActive || session.status === 'matching' || session.status === 'pending') && (
          <button
            onClick={handleExpire}
            disabled={expiring}
            title="Force expire this session (demo)"
            style={{
              background: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 6,
              color: '#EF4444', fontSize: 11, fontWeight: 600, padding: '4px 8px',
              cursor: expiring ? 'wait' : 'pointer', flexShrink: 0,
            }}
          >
            {expiring ? '...' : 'Expire Now'}
          </button>
        )}
        {onBack && (
          <button onClick={onBack} aria-label="Close" style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 8,
            color: '#7A7670', fontSize: 18, lineHeight: 1, flexShrink: 0,
          }}>&times;</button>
        )}
      </div>

      {/* ── Scrollable body ── */}
      <div className="session-body">
        {/* ── Status badge (finished sessions) ── */}
        {isFinished && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 14px', borderRadius: 8,
            background: session.status === 'completed' ? 'rgba(45, 212, 191, 0.06)'
              : session.status === 'cancelled' ? 'rgba(239, 68, 68, 0.06)' : 'rgba(122, 118, 112, 0.06)',
            border: `1px solid ${session.status === 'completed' ? 'rgba(45, 212, 191, 0.2)'
              : session.status === 'cancelled' ? 'rgba(239, 68, 68, 0.2)' : '#2A2A2E'}`,
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
              background: session.status === 'completed' ? '#2DD4BF'
                : session.status === 'cancelled' ? '#EF4444' : '#7A7670',
            }} />
            <span style={{
              fontSize: 13, fontWeight: 600,
              color: session.status === 'completed' ? '#2DD4BF'
                : session.status === 'cancelled' ? '#EF4444' : '#7A7670',
            }}>
              {session.status === 'completed' ? 'Completed' : session.status === 'cancelled' ? 'Declined' : 'Timed out'}
            </span>
            {session.completedAt && (
              <span style={{ fontSize: 11, color: '#7A7670', marginLeft: 'auto' }}>
                {new Date(session.completedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        )}

        {/* ── Request section ── */}
        {desc.raw && (
          <div className="session-request">
            <div style={{ fontSize: 11, fontWeight: 600, color: '#7A7670', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              Request &middot; {session.offeringType.replace(/_/g, ' ')}
            </div>
            {desc.isJson ? (
              <div className="session-request-details">
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
              <div style={{ fontSize: 13, color: '#E8E2DA', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5 }}>
                <LinkifyText text={desc.raw} />
              </div>
            )}
          </div>
        )}

        {/* ── Pending addons (non-ACP only) ── */}
        {!session.acpJobId && pendingAddons.map(addon => (
          <AddonDetail
            key={addon.id}
            addon={addon}
            onRespond={acceptAddon}
          />
        ))}

        {/* ── Assessment form (inline, when active) ── */}
        {isActive && !isLocked && (
          <div className="session-assessment">
            <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#E8E2DA' }}>Assessment</h3>

            {/* Requirements checklist (collapsible) */}
            <div style={{ marginBottom: 16 }}>
              <button
                onClick={() => setShowRequirements(!showRequirements)}
                className="chat-collapse-toggle"
              >
                <span>Requirements {checkedCount}/{totalItems}</span>
                <span style={{ fontSize: 10, color: '#7A7670' }}>{showRequirements ? '\u25B2' : '\u25BC'}</span>
              </button>
              {showRequirements && (
                <div style={{ padding: '10px 0 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {checklistItems.map((item, i) => (
                    <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: checkedItems[i] ? '#7A7670' : '#E8E2DA', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={!!checkedItems[i]}
                        onChange={() => setCheckedItems(prev => ({ ...prev, [i]: !prev[i] }))}
                        style={{ accentColor: '#2DD4BF', width: 16, height: 16 }}
                      />
                      <span style={{ textDecoration: checkedItems[i] ? 'line-through' : 'none' }}>{item}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {showDeclineDialog ? (
              <div style={{
                background: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 8,
                padding: 16,
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#EF4444', marginBottom: 8 }}>
                  Why can't you fulfill this request?
                </div>
                <textarea
                  value={declineReason}
                  onChange={e => setDeclineReason(e.target.value)}
                  rows={3}
                  placeholder="Briefly explain why (e.g. outside expertise, unclear requirements, insufficient context)..."
                  className="input input-full"
                  style={{ fontSize: 13, resize: 'vertical', marginBottom: 12 }}
                  maxLength={1000}
                />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => { setShowDeclineDialog(false); setDeclineReason(''); }}
                    className="btn btn-ghost"
                    style={{ fontSize: 13 }}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleDecline}
                    disabled={declining}
                    className="btn"
                    style={{ fontSize: 13, background: '#EF4444', color: '#0D0D0D', border: 'none' }}
                  >
                    {declining ? 'Declining...' : 'Confirm Decline'}
                  </button>
                </div>
              </div>
            ) : (
              <CompletionForm
                session={session}
                onComplete={() => { if (onBack) onBack(); }}
                inline
                onDecline={handleDecline}
              />
            )}
          </div>
        )}

        {/* ── Locked state ── */}
        {isActive && isLocked && (
          <div className="chat-ended" style={{ color: 'var(--color-error, #EF4444)', margin: 16, borderRadius: 8 }}>
            Grace period exhausted — please complete or decline the job.
          </div>
        )}

        {/* ── Deliverable (finished sessions) ── */}
        {isFinished && (
          <>
            {deliverable && Object.keys(deliverable).length > 0 ? (
              <div style={{
                padding: 16,
                background: 'rgba(45, 212, 191, 0.06)', border: '1px solid rgba(45, 212, 191, 0.2)', borderRadius: 10,
              }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#2DD4BF', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 10 }}>
                  Expert Assessment
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {Object.entries(deliverable).map(([key, value]) => {
                    const label = key.replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' ').trim().replace(/\b\w/g, c => c.toUpperCase());
                    const display = typeof value === 'string' ? value
                      : typeof value === 'number' ? String(value)
                      : Array.isArray(value) ? value.join(', ')
                      : JSON.stringify(value);
                    return (
                      <div key={key}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#7A7670', marginBottom: 2 }}>{label}</div>
                        <div style={{ fontSize: 13, color: '#E8E2DA', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5 }}>
                          <LinkifyText text={display} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : session.status === 'completed' ? (
              <div style={{
                padding: 16,
                background: 'rgba(122, 118, 112, 0.06)', border: '1px solid #2A2A2E', borderRadius: 10,
                fontSize: 13, color: '#7A7670', fontStyle: 'italic',
              }}>
                No structured assessment recorded for this session.
              </div>
            ) : null}

            {/* Show chat messages for finished sessions */}
            {userMessages > 0 && (
              <div className="chat-collapse-section">
                <button
                  onClick={() => setShowChat(!showChat)}
                  className="chat-collapse-toggle"
                  style={{ width: '100%' }}
                >
                  <span>
                    Messages
                    <span className="chat-collapse-badge">{userMessages}</span>
                  </span>
                  <span style={{ fontSize: 10, color: '#7A7670' }}>{showChat ? '\u25B2' : '\u25BC'}</span>
                </button>
                {showChat && (
                  <div className="chat-collapse-body">
                    <div className="chat-messages" style={{ maxHeight: 300, flex: 'none' }}>
                      {messages.filter(m => m.messageType !== 'system_notice' || m.content !== messages[0]?.content).map(msg => (
                        <ChatBubble key={msg.id} message={msg} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ── Chat section (collapsible, at bottom) ── */}
        {isActive && (
          <div className="chat-collapse-section">
            <button
              onClick={() => setShowChat(!showChat)}
              className="chat-collapse-toggle"
              style={{ width: '100%' }}
            >
              <span>
                Messages
                {userMessages > 0 && (
                  <span className="chat-collapse-badge">{userMessages}</span>
                )}
              </span>
              <span style={{ fontSize: 10, color: '#7A7670' }}>{showChat ? '\u25B2' : '\u25BC'}</span>
            </button>
            {showChat && (
              <div className="chat-collapse-body">
                <div style={{ fontSize: 12, color: '#7A7670', padding: '4px 0 8px', fontStyle: 'italic' }}>
                  You can send messages to the agent. Responses are not guaranteed.
                </div>
                <div className="chat-messages" style={{ maxHeight: 300, flex: 'none' }}>
                  {messages.filter(m => m.messageType !== 'system_notice' || m.content !== messages[0]?.content).map(msg => (
                    <ChatBubble key={msg.id} message={msg} />
                  ))}
                  <div ref={messagesEndRef} />
                </div>
                {!isLocked && (
                  <form onSubmit={handleSend} className="chat-input-area">
                    <input
                      type="text"
                      className="chat-input"
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      placeholder="Type a message..."
                      disabled={sending}
                    />
                    <button type="submit" disabled={sending || !input.trim()} className="btn btn-primary btn-sm chat-send-btn">
                      {sending ? '...' : 'Send'}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function sanitizeContent(text: string): string {
  // Replace common UTF-8 corruption artifacts (e.g. em-dash showing as replacement char)
  return text.replace(/\uFFFD/g, '\u2014');
}

function ChatBubble({ message }: { message: ChatMessage }) {
  if (message.messageType === 'system_notice') {
    return (
      <div className="chat-system-notice">
        {sanitizeContent(message.content)}
      </div>
    );
  }

  if (message.messageType === 'addon_request' || message.messageType === 'addon_response') {
    return (
      <div className="chat-system-notice chat-addon-notice">
        {sanitizeContent(message.content)}
      </div>
    );
  }

  const isAgent = message.senderType === 'agent';
  const isExpert = message.senderType === 'expert';

  // File message — show inline preview or download link
  if (message.messageType === 'file') {
    const meta = message.metadata as { attachmentId?: string; filename?: string; mimeType?: string; fileSize?: number };
    const isImage = meta.mimeType?.startsWith('image/');
    const downloadUrl = meta.attachmentId
      ? `/api/sessions/${message.sessionId}/attachments/${meta.attachmentId}/download`
      : undefined;

    return (
      <div className={`chat-bubble ${isAgent ? 'chat-bubble-agent' : ''} ${isExpert ? 'chat-bubble-expert' : ''}`}>
        <div className="chat-bubble-content">
          {isImage && downloadUrl && (
            <img
              src={downloadUrl}
              alt={meta.filename ?? 'attachment'}
              style={{ maxWidth: '100%', maxHeight: 240, borderRadius: 6, marginBottom: 4, display: 'block' }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span>{isImage ? '\uD83D\uDDBC\uFE0F' : '\uD83D\uDCC4'}</span>
            {downloadUrl ? (
              <a href={downloadUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>
                {meta.filename ?? 'attachment'}
              </a>
            ) : (
              <span>{meta.filename ?? 'attachment'}</span>
            )}
            {meta.fileSize && (
              <span style={{ color: '#7A7670', fontSize: 11 }}>
                {meta.fileSize < 1024 ? `${meta.fileSize}B` : meta.fileSize < 1024 * 1024 ? `${(meta.fileSize / 1024).toFixed(1)}KB` : `${(meta.fileSize / (1024 * 1024)).toFixed(1)}MB`}
              </span>
            )}
          </div>
        </div>
        <div className="chat-bubble-time">
          {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    );
  }

  return (
    <div className={`chat-bubble ${isAgent ? 'chat-bubble-agent' : ''} ${isExpert ? 'chat-bubble-expert' : ''}`}>
      <div className="chat-bubble-content"><LinkifyText text={sanitizeContent(message.content)} /></div>
      <div className="chat-bubble-time">
        {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  );
}
