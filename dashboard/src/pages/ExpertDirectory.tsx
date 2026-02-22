import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { ExpertPublic } from '../types/index.js';
import * as api from '../api/client.js';

export function ExpertDirectory() {
  const [experts, setExperts] = useState<ExpertPublic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getPublicExperts().then(res => {
      if (res.success && res.data) setExperts(res.data as ExpertPublic[]);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      {/* Header */}
      <div className="landing-hero" style={{ padding: '48px 0' }}>
        <div className="landing-container">
          <Link to="/" className="header-brand">Taste</Link>
          <h1 style={{ fontSize: 'var(--font-size-xl)', marginTop: 'var(--space-lg)', color: 'var(--color-white)' }}>
            Our Experts
          </h1>
          <p style={{ color: 'var(--color-grey-4)', maxWidth: 600 }}>
            Verified human professionals who provide qualitative judgment to AI agents.
            Each expert is handpicked for their domain expertise.
          </p>
        </div>
      </div>

      <div className="page">
        {loading ? (
          <p className="text-grey">Loading experts...</p>
        ) : experts.length === 0 ? (
          <div className="empty-state">
            No public expert profiles yet. Check back soon.
          </div>
        ) : (
          <div className="expert-grid">
            {experts.map(expert => (
              <Link to={`/expert/${expert.id}`} key={expert.id} className="expert-card card-clickable">
                <div className="expert-card-header">
                  <div className="expert-avatar">
                    {expert.credentials.profileImageUrl ? (
                      <img src={expert.credentials.profileImageUrl} alt={expert.name} className="expert-avatar-img" />
                    ) : (
                      <div className="expert-avatar-placeholder">
                        {expert.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="expert-card-name">{expert.name}</h3>
                    {expert.credentials.tagline && (
                      <p className="expert-card-tagline">{expert.credentials.tagline}</p>
                    )}
                  </div>
                </div>

                <div className="expert-card-domains">
                  {expert.domains.map(d => (
                    <span key={d} className="chip">{d}</span>
                  ))}
                </div>

                {expert.credentials.bio && (
                  <p className="expert-card-bio">
                    {expert.credentials.bio.length > 120
                      ? expert.credentials.bio.slice(0, 120) + '...'
                      : expert.credentials.bio}
                  </p>
                )}

                <div className="expert-card-stats">
                  <div className="expert-card-stat">
                    <span className="text-bold">{expert.completedJobs}</span>
                    <span className="text-xs text-grey">Jobs</span>
                  </div>
                  {Object.entries(expert.reputationScores).length > 0 && (
                    <div className="expert-card-stat">
                      <span className="text-bold">
                        {Math.round(
                          Object.values(expert.reputationScores).reduce((a, b) => a + b, 0) /
                          Object.values(expert.reputationScores).length
                        )}
                      </span>
                      <span className="text-xs text-grey">Rep</span>
                    </div>
                  )}
                  {expert.credentials.location && (
                    <div className="expert-card-stat">
                      <span className="text-sm">{expert.credentials.location}</span>
                    </div>
                  )}
                </div>

                <div className="expert-card-links">
                  {expert.credentials.twitterHandle && (
                    <span className="text-xs text-grey">@{expert.credentials.twitterHandle}</span>
                  )}
                  {expert.credentials.linkedinUrl && (
                    <span className="text-xs text-primary">LinkedIn</span>
                  )}
                  {expert.credentials.portfolioUrl && (
                    <span className="text-xs text-primary">Portfolio</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <footer className="footer">
        <Link to="/">Home</Link>
        <Link to="/terms">Terms</Link>
        <Link to="/privacy">Privacy</Link>
      </footer>
    </div>
  );
}
