import { useState, useRef, useEffect } from 'react';
import { useChat } from '../hooks/useChat.js';
import { AddonDetail } from './AddonDetail.js';
import * as api from '../api/client.js';
import type { ChatMessage } from '../types/index.js';

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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Reset checklist when session changes
  useEffect(() => {
    setCheckedItems({});
    setShowRequirements(false);
  }, [sessionId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  const handleComplete = async () => {
    await api.completeSession(sessionId);
  };

  // Timer
  const deadline = session.deadlineAt ? new Date(session.deadlineAt).getTime() : null;
  const now = Date.now();
  const remainingMs = deadline ? Math.max(0, deadline - now) : 0;
  const remainingMins = Math.ceil(remainingMs / 60_000);

  const isActive = session.status === 'active' || session.status === 'accepted' || session.status === 'wrapping_up';
  const pendingAddons = addons.filter(a => a.status === 'pending');

  return (
    <div className="chat-container">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-info">
          <div className="chat-agent-avatar">
            {(session.buyerAgentDisplay || session.buyerAgent || 'AI')
              ?.split(/[_\s]+/).map(w => w[0]).join('').toUpperCase().slice(0, 2)}
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="text-bold" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {session.buyerAgentDisplay || session.buyerAgent || 'AI Agent'}
            </div>
            <div style={{ fontSize: 11, color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {isActive ? (
                <>
                  <span style={{ color: '#059669', fontWeight: 600 }}>Live</span>
                  <span style={{ color: '#D1D5DB' }}>&middot;</span>
                  {deadline && (
                    <>
                      <span className={remainingMins <= 5 ? 'chat-timer-urgent' : ''} style={{ fontWeight: 500 }}>
                        {remainingMins}min left
                      </span>
                      <span style={{ color: '#D1D5DB' }}>&middot;</span>
                    </>
                  )}
                  <span>${session.priceUsdc.toFixed(0)} escrowed</span>
                </>
              ) : (
                <span style={{ textTransform: 'capitalize' }}>{session.status.replace(/_/g, ' ')} · ${session.priceUsdc.toFixed(0)} USDC</span>
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

      {/* Requirements panel */}
      {(() => {
        const checklistItems = OFFERING_CHECKLIST[session.offeringType] || OFFERING_CHECKLIST['trust_evaluation'] || [];
        const checkedCount = Object.values(checkedItems).filter(Boolean).length;
        const totalItems = checklistItems.length;
        return (
          <div style={{ borderBottom: '1px solid #E5E7EB', background: '#FAFAFA', flexShrink: 0 }}>
            <button
              onClick={() => setShowRequirements(!showRequirements)}
              style={{
                width: '100%', border: 'none', background: 'transparent', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 16px', fontFamily: 'inherit', fontSize: 12, color: '#6B7280',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 600, color: '#6B21A8' }}>
                  Requirements {checkedCount}/{totalItems}
                </span>
                {session.description && (
                  <span style={{ color: '#9CA3AF', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {!showRequirements && `— ${session.description.slice(0, 60)}...`}
                  </span>
                )}
              </span>
              <span style={{ fontSize: 10, color: '#9CA3AF' }}>{showRequirements ? '\u25B2' : '\u25BC'}</span>
            </button>
            {showRequirements && (
              <div style={{ padding: '0 16px 12px' }}>
                {session.description && (
                  <div style={{ fontSize: 12, color: '#4B5563', lineHeight: 1.5, marginBottom: 10, padding: '8px 10px', background: '#fff', borderRadius: 6, border: '1px solid #E5E7EB' }}>
                    {sanitizeContent(session.description)}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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
              </div>
            )}
          </div>
        );
      })()}

      {/* Messages */}
      <div className="chat-messages">
        {messages.map(msg => (
          <ChatBubble key={msg.id} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Pending addons */}
      {pendingAddons.map(addon => (
        <AddonDetail
          key={addon.id}
          addon={addon}
          onRespond={acceptAddon}
        />
      ))}

      {/* Input */}
      {isActive && (
        <form onSubmit={handleSend} className="chat-input-area">
          <input
            type="text"
            className="chat-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Type your response..."
            disabled={sending}
          />
          <button type="submit" disabled={sending || !input.trim()} className="btn btn-primary btn-sm chat-send-btn">
            {sending ? '...' : 'Send'}
          </button>
        </form>
      )}

      {/* Footer info */}
      {isActive && (
        <div className="chat-footer">
          <span className="text-xs text-grey">
            Turn {session.turnCount}/{session.maxTurns}
          </span>
          {session.status === 'wrapping_up' && (
            <button onClick={handleComplete} className="btn btn-primary btn-sm">
              Complete Session
            </button>
          )}
          {session.status === 'active' && (
            <button onClick={handleComplete} className="btn btn-ghost btn-sm">
              End Session
            </button>
          )}
        </div>
      )}

      {session.status === 'completed' && (
        <div className="chat-ended">
          Session completed
        </div>
      )}
      {session.status === 'cancelled' && (
        <div className="chat-ended">
          Session cancelled
        </div>
      )}
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

  return (
    <div className={`chat-bubble ${isAgent ? 'chat-bubble-agent' : ''} ${isExpert ? 'chat-bubble-expert' : ''}`}>
      <div className="chat-bubble-content">{sanitizeContent(message.content)}</div>
      <div className="chat-bubble-time">
        {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  );
}
