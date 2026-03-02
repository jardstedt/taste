import { useState } from 'react';

interface NotificationPromptProps {
  onEnable: () => void;
}

export function NotificationPrompt({ onEnable }: NotificationPromptProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="notification-prompt">
      <span className="notification-prompt-icon" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M10 2a5 5 0 0 0-5 5v3.586l-.707.707A1 1 0 0 0 5 13h10a1 1 0 0 0 .707-1.707L15 10.586V7a5 5 0 0 0-5-5Z" fill="#2DD4BF"/>
          <path d="M8 14a2 2 0 1 0 4 0H8Z" fill="#2DD4BF"/>
        </svg>
      </span>
      <div className="notification-prompt-text">
        <p className="notification-prompt-title">Enable push notifications?</p>
        <p className="notification-prompt-desc">Get notified about new sessions, messages, and add-on requests.</p>
      </div>
      <div className="notification-prompt-actions">
        <button onClick={() => setDismissed(true)} className="btn btn-ghost btn-sm">
          Later
        </button>
        <button onClick={onEnable} className="btn btn-primary btn-sm">
          Enable
        </button>
      </div>
    </div>
  );
}
