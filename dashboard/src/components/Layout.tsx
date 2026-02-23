import type { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { AuthUser } from '../types/index.js';
import { AvailabilityToggle } from './AvailabilityToggle.js';
import { NotificationPrompt } from './NotificationPrompt.js';
import { useNotifications } from '../hooks/useNotifications.js';

interface LayoutProps {
  children: ReactNode;
  user: AuthUser;
  onLogout: () => void;
  onRefresh?: () => void;
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function BottomNavIcon({ label }: { label: string }) {
  switch (label) {
    case 'Overview':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
        </svg>
      );
    case 'Active':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case 'History':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case 'Earnings':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      );
    case 'Profile':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
        </svg>
      );
    case 'Admin':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    default:
      return null;
  }
}

export function Layout({ children, user, onLogout, onRefresh }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { shouldPrompt, subscribe } = useNotifications();

  const navItems = [
    { path: '/dashboard', label: 'Overview' },
    { path: '/dashboard/active', label: 'Active' },
    { path: '/dashboard/history', label: 'History' },
    { path: '/dashboard/earnings', label: 'Earnings' },
    ...(user.role === 'admin' ? [{ path: '/dashboard/admin', label: 'Admin' }] : []),
  ];

  const bottomNavItems = [
    { path: '/dashboard', label: 'Overview' },
    { path: '/dashboard/active', label: 'Active' },
    { path: '/dashboard/earnings', label: 'Earnings' },
    ...(user.role === 'admin'
      ? [{ path: '/dashboard/admin', label: 'Admin' }]
      : [{ path: '/dashboard/history', label: 'History' }]),
  ];

  return (
    <div className="dashboard" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--color-bg)' }}>
      {/* Row 1: Logo + user controls */}
      <header className="header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', borderBottom: '1px solid #E5E7EB' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="header-logo-box">T</div>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#1A1A2E', letterSpacing: '-0.3px' }}>Taste</span>
          <span className="header-subtitle">Expert Dashboard</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {onRefresh && <AvailabilityToggle user={user} onUpdate={onRefresh} />}
          <button
            className="header-avatar"
            onClick={() => navigate('/dashboard/profile')}
            style={{ cursor: 'pointer', border: 'none' }}
            title="Profile"
            aria-label="Go to profile"
          >{getInitials(user.name)}</button>
          <button onClick={onLogout} className="btn btn-ghost btn-sm">
            Logout
          </button>
        </div>
      </header>

      {/* Row 2: Tab navigation (desktop only, hidden on mobile via CSS) */}
      <nav className="header-nav">
        {navItems.map(item => (
          <Link
            key={item.path}
            to={item.path}
            className={location.pathname === item.path ? 'active' : ''}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Notification prompt banner */}
      {shouldPrompt && <NotificationPrompt onEnable={subscribe} />}

      <main className="page" style={{ flex: 1 }}>
        {children}
      </main>
      <footer className="footer">
        <Link to="/terms">Terms</Link>
        <Link to="/privacy">Privacy</Link>
        <Link to="/agreement">Expert Agreement</Link>
      </footer>

      {/* Bottom navigation (mobile only, shown via CSS) */}
      <nav className="bottom-nav">
        {bottomNavItems.map(item => (
          <Link
            key={item.path}
            to={item.path}
            className={`bottom-nav-item${location.pathname === item.path ? ' active' : ''}`}
          >
            <BottomNavIcon label={item.label} />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
