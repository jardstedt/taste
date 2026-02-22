import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { ExpertPublic } from '../types/index.js';
import * as api from '../api/client.js';

export function ExpertProfile() {
  const { id } = useParams<{ id: string }>();
  const [expert, setExpert] = useState<ExpertPublic | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api.getPublicExpert(id).then(res => {
      if (res.success && res.data) setExpert(res.data as ExpertPublic);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <div className="page" style={{ textAlign: 'center', paddingTop: 80 }}>
        <p className="text-grey">Loading profile...</p>
      </div>
    );
  }

  if (!expert) {
    return (
      <div className="page" style={{ textAlign: 'center', paddingTop: 80 }}>
        <p className="text-grey">Expert profile not found.</p>
        <Link to="/experts" className="btn btn-ghost btn-sm mt-lg">Back to Experts</Link>
      </div>
    );
  }

  const avgReputation = Object.values(expert.reputationScores).length > 0
    ? Math.round(Object.values(expert.reputationScores).reduce((a, b) => a + b, 0) / Object.values(expert.reputationScores).length)
    : null;

  return (
    <div>
      {/* Header bar */}
      <div style={{ background: 'var(--color-white)', borderBottom: '1px solid var(--color-grey-5)', padding: '12px var(--space-xl)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link to="/" className="header-brand">Taste</Link>
          <Link to="/experts" className="text-sm">All Experts</Link>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: 'var(--space-xl)' }}>
        {/* Profile header */}
        <div className="profile-hero">
          <div className="profile-hero-main">
            <div className="expert-avatar expert-avatar-lg">
              {expert.credentials.profileImageUrl ? (
                <img src={expert.credentials.profileImageUrl} alt={expert.name} className="expert-avatar-img" />
              ) : (
                <div className="expert-avatar-placeholder expert-avatar-placeholder-lg">
                  {expert.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <h1 style={{ margin: '0 0 4px', fontSize: 'var(--font-size-xl)' }}>{expert.name}</h1>
              {expert.credentials.tagline && (
                <p className="text-sm text-grey" style={{ margin: '0 0 8px' }}>{expert.credentials.tagline}</p>
              )}
              <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
                {expert.domains.map(d => (
                  <span key={d} className="chip">{d}</span>
                ))}
              </div>
              {expert.credentials.location && (
                <p className="text-xs text-grey mt-sm">{expert.credentials.location}</p>
              )}
            </div>
          </div>

          {/* Social links */}
          <div className="profile-social">
            {expert.credentials.twitterHandle && (
              <a
                href={`https://x.com/${expert.credentials.twitterHandle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="profile-social-link"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                @{expert.credentials.twitterHandle}
              </a>
            )}
            {expert.credentials.linkedinUrl && (
              <a
                href={expert.credentials.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="profile-social-link"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                LinkedIn
              </a>
            )}
            {expert.credentials.portfolioUrl && (
              <a
                href={expert.credentials.portfolioUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="profile-social-link"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
                Portfolio
              </a>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="stats-grid mt-xl">
          <div className="stat-card">
            <div className="stat-value stat-value-primary">{expert.completedJobs}</div>
            <div className="stat-label">Jobs Completed</div>
          </div>
          {avgReputation !== null && (
            <div className="stat-card">
              <div className="stat-value stat-value-success">{avgReputation}</div>
              <div className="stat-label">Avg Reputation</div>
            </div>
          )}
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--color-grey-2)' }}>
              {expert.avgResponseTimeMins > 0
                ? `${Math.round(expert.avgResponseTimeMins)}m`
                : '<2h'}
            </div>
            <div className="stat-label">Avg Response</div>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between" style={{ width: '100%' }}>
              <span className={`status-dot status-dot-${expert.availability}`} />
              <span className="stat-value" style={{
                color: expert.availability === 'online' ? 'var(--color-success)' : 'var(--color-grey-3)',
                fontSize: 'var(--font-size-lg)',
                textTransform: 'capitalize',
              }}>
                {expert.availability}
              </span>
            </div>
            <div className="stat-label">Status</div>
          </div>
        </div>

        {/* Bio */}
        {expert.credentials.bio && (
          <div className="card mt-xl">
            <h3 className="mb-md">About</h3>
            <p className="text-sm" style={{ color: 'var(--color-grey-2)', lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0 }}>
              {expert.credentials.bio}
            </p>
          </div>
        )}

        {/* Reputation by domain */}
        {Object.keys(expert.reputationScores).length > 0 && (
          <div className="card mt-lg">
            <h3 className="mb-md">Reputation by Domain</h3>
            <div className="reputation-grid">
              {Object.entries(expert.reputationScores).map(([domain, score]) => (
                <div
                  key={domain}
                  className={`reputation-card ${score >= 70 ? 'reputation-card-high' : score >= 40 ? 'reputation-card-mid' : 'reputation-card-low'}`}
                >
                  <div className="reputation-score">{score}</div>
                  <div className="reputation-domain">{domain}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <footer className="footer">
        <Link to="/">Home</Link>
        <Link to="/experts">Experts</Link>
        <Link to="/terms">Terms</Link>
        <Link to="/privacy">Privacy</Link>
      </footer>
    </div>
  );
}
