import { useState, useRef, useEffect } from 'react';
import { useChat } from '../hooks/useChat.js';
import { AddonDetail } from './AddonDetail.js';
import * as api from '../api/client.js';
import type { ChatMessage } from '../types/index.js';

interface ChatViewProps {
  sessionId: string;
  onBack: () => void;
}

export function ChatView({ sessionId, onBack }: ChatViewProps) {
  const { session, messages, addons, loading, sendMessage, acceptAddon } = useChat(sessionId);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
        <button onClick={onBack} className="btn btn-ghost btn-sm">Back</button>
        <div className="chat-header-info">
          <div className="chat-agent-avatar">
            {(session.buyerAgentDisplay || session.buyerAgent || 'AI')
              ?.split(/[_\s]+/).map(w => w[0]).join('').toUpperCase().slice(0, 2)}
          </div>
          <div>
            <div className="text-bold">{session.buyerAgentDisplay || session.buyerAgent || 'AI Agent'}</div>
            <div style={{ color: '#059669', fontSize: 11 }}>Live session · ${session.priceUsdc.toFixed(0)} USDC escrowed</div>
          </div>
        </div>
        <div className="chat-header-meta">
          <span className={`badge badge-sm ${
            session.status === 'active' ? 'badge-success' :
            session.status === 'wrapping_up' ? 'badge-warning' :
            session.status === 'completed' ? 'badge-info' : 'badge-grey'
          }`}>{session.status.replace(/_/g, ' ')}</span>
          <span className="text-sm text-bold">${session.priceUsdc.toFixed(2)}</span>
          {isActive && deadline && (
            <span className={`chat-timer ${remainingMins <= 5 ? 'chat-timer-urgent' : ''}`}>
              {remainingMins}m
            </span>
          )}
        </div>
      </div>

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

function ChatBubble({ message }: { message: ChatMessage }) {
  if (message.messageType === 'system_notice') {
    return (
      <div className="chat-system-notice">
        {message.content}
      </div>
    );
  }

  if (message.messageType === 'addon_request' || message.messageType === 'addon_response') {
    return (
      <div className="chat-system-notice chat-addon-notice">
        {message.content}
      </div>
    );
  }

  const isAgent = message.senderType === 'agent';
  const isExpert = message.senderType === 'expert';

  return (
    <div className={`chat-bubble ${isAgent ? 'chat-bubble-agent' : ''} ${isExpert ? 'chat-bubble-expert' : ''}`}>
      <div className="chat-bubble-content">{message.content}</div>
      <div className="chat-bubble-time">
        {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  );
}
