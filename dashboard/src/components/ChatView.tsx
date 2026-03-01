import { useState, useRef, useEffect } from 'react';
import { useChat } from '../hooks/useChat.js';
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
  const { session, messages, addons, loading, sendMessage, acceptAddon } = useChat(sessionId);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showRequirements, setShowRequirements] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});
  const [showChat, setShowChat] = useState(false);
  const [showDeclineDialog, setShowDeclineDialog] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [declining, setDeclining] = useState(false);
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

  return (
    <div className="chat-container">
      {/* ── Header ── */}
      <div className="chat-header">
        <div className="chat-header-info">
          <div style={{ minWidth: 0 }}>
            <div className="text-bold" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {formatOffering(session.offeringType)} for {truncateAddress(session.buyerAgent)}
            </div>
            <div style={{ fontSize: 11, color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {isActive ? (
                <>
                  <span style={{ color: '#059669', fontWeight: 600 }}>Live</span>
                  {session.acpJobId && (
                    <>
                      <span style={{ color: '#D1D5DB' }}>&middot;</span>
                      <span style={{
                        background: '#DBEAFE', color: '#1D4ED8', fontWeight: 600,
                        padding: '1px 5px', borderRadius: 4, fontSize: 10,
                      }}>ACP Agent</span>
                    </>
                  )}
                  {awaitingPayment && (
                    <>
                      <span style={{ color: '#D1D5DB' }}>&middot;</span>
                      <span style={{
                        background: '#FEF3C7', color: '#92400E', fontWeight: 600,
                        padding: '1px 5px', borderRadius: 4, fontSize: 10,
                      }}>Awaiting Payment</span>
                    </>
                  )}
                  <span style={{ color: '#D1D5DB' }}>&middot;</span>
                  {deadline && (
                    <>
                      <span className={remainingMins <= 5 ? 'chat-timer-urgent' : ''} style={{ fontWeight: 500 }}>
                        {remainingMins}min left
                      </span>
                      <span style={{ color: '#D1D5DB' }}>&middot;</span>
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
        {onBack && (
          <button onClick={onBack} aria-label="Close" style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 8,
            color: '#9CA3AF', fontSize: 18, lineHeight: 1, flexShrink: 0,
          }}>&times;</button>
        )}
      </div>

      {/* ── Scrollable body ── */}
      <div className="session-body">
        {/* ── Request section ── */}
        {desc.raw && (
          <div className="session-request">
            <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              Request &middot; {session.offeringType.replace(/_/g, ' ')}
            </div>
            {desc.isJson ? (
              <div className="session-request-details">
                {desc.pairs.map(([label, value]) => {
                  const spanFull = desc.pairs.length === 1 || label.toLowerCase().includes('note');
                  return (
                    <div key={label} style={spanFull ? { gridColumn: '1 / -1' } : undefined}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', marginBottom: 2 }}>{label}</div>
                      <div style={{ fontSize: 13, color: '#1A1A2E', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}><LinkifyText text={value} /></div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: '#1A1A2E', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5 }}>
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
            <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#1A1A2E' }}>Assessment</h3>

            {/* Requirements checklist (collapsible) */}
            <div style={{ marginBottom: 16 }}>
              <button
                onClick={() => setShowRequirements(!showRequirements)}
                className="chat-collapse-toggle"
              >
                <span>Requirements {checkedCount}/{totalItems}</span>
                <span style={{ fontSize: 10, color: '#9CA3AF' }}>{showRequirements ? '\u25B2' : '\u25BC'}</span>
              </button>
              {showRequirements && (
                <div style={{ padding: '10px 0 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {checklistItems.map((item, i) => (
                    <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: checkedItems[i] ? '#9CA3AF' : '#1A1A2E', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={!!checkedItems[i]}
                        onChange={() => setCheckedItems(prev => ({ ...prev, [i]: !prev[i] }))}
                        style={{ accentColor: '#6B21A8', width: 16, height: 16 }}
                      />
                      <span style={{ textDecoration: checkedItems[i] ? 'line-through' : 'none' }}>{item}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {showDeclineDialog ? (
              <div style={{
                background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8,
                padding: 16,
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#991B1B', marginBottom: 8 }}>
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
                    style={{ fontSize: 13, background: '#DC2626', color: '#fff', border: 'none' }}
                  >
                    {declining ? 'Declining...' : 'Confirm Decline'}
                  </button>
                </div>
              </div>
            ) : (
              <CompletionForm
                session={session}
                onComplete={() => {/* session will update via WebSocket */}}
                inline
                onDecline={handleDecline}
              />
            )}
          </div>
        )}

        {/* ── Locked state ── */}
        {isActive && isLocked && (
          <div className="chat-ended" style={{ color: 'var(--color-error, #DC2626)', margin: 16, borderRadius: 8 }}>
            Grace period exhausted — please complete or decline the job.
          </div>
        )}

        {/* ── End states ── */}
        {session.status === 'completed' && (
          <div className="chat-ended" style={{ margin: 16, borderRadius: 8 }}>
            Job completed
          </div>
        )}
        {session.status === 'cancelled' && (
          <div className="chat-ended" style={{ margin: 16, borderRadius: 8, color: '#991B1B' }}>
            Job declined
          </div>
        )}
        {session.status === 'timeout' && (
          <div className="chat-ended" style={{ margin: 16, borderRadius: 8, color: '#6B7280' }}>
            Job timed out
          </div>
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
              <span style={{ fontSize: 10, color: '#9CA3AF' }}>{showChat ? '\u25B2' : '\u25BC'}</span>
            </button>
            {showChat && (
              <div className="chat-collapse-body">
                <div style={{ fontSize: 12, color: '#9CA3AF', padding: '4px 0 8px', fontStyle: 'italic' }}>
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
              <span style={{ color: '#9CA3AF', fontSize: 11 }}>
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
