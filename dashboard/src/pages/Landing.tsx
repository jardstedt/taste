import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { PublicStats } from '../types/index.js';
import * as api from '../api/client.js';

export function Landing() {
  const [stats, setStats] = useState<PublicStats | null>(null);

  useEffect(() => {
    api.getPublicStats().then(res => {
      if (res.success && res.data) setStats(res.data as PublicStats);
    });
  }, []);

  return (
    <div className="landing">
      {/* Hero */}
      <section className="landing-hero">
        <div className="landing-container">
          <h1 className="landing-title">Taste</h1>
          <p className="landing-tagline">
            Human judgment for the agentic economy.
          </p>
          <p className="landing-description">
            AI agents are powerful — but they can't judge vibes, authenticity, or creative quality.
            Taste connects autonomous agents with verified human experts who deliver structured
            qualitative opinions on-chain via Virtuals ACP.
          </p>
          <div className="landing-cta">
            <Link to="/experts" className="btn btn-primary">Meet Our Experts</Link>
            <Link to="/dashboard" className="btn btn-secondary">Expert Login</Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      {stats && (
        <section className="landing-section">
          <div className="landing-container">
            <div className="landing-stats">
              <div className="landing-stat">
                <div className="landing-stat-value">{stats.totalExperts}</div>
                <div className="landing-stat-label">Verified Experts</div>
              </div>
              <div className="landing-stat">
                <div className="landing-stat-value">{stats.totalSessions}</div>
                <div className="landing-stat-label">Sessions Completed</div>
              </div>
              <div className="landing-stat">
                <div className="landing-stat-value">{stats.domains.length}</div>
                <div className="landing-stat-label">Expertise Domains</div>
              </div>
              <div className="landing-stat">
                <div className="landing-stat-value">
                  {stats.avgResponseMins > 0 ? `${stats.avgResponseMins}m` : '<2h'}
                </div>
                <div className="landing-stat-label">Avg Response</div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Services */}
      <section className="landing-section landing-section-alt">
        <div className="landing-container">
          <h2 className="landing-section-title">What Agents Ask Us</h2>
          <div className="landing-services">
            <ServiceCard
              title="Project Vibes Check"
              price="$1.00"
              description="Is this crypto project legit, organic, or manufactured? Human experts evaluate community authenticity, founder credibility, and cultural signals."
            />
            <ServiceCard
              title="Narrative Assessment"
              price="$0.75"
              description="Is this market narrative real momentum or manufactured hype? Experts assess cultural backing and identify catalysts."
            />
            <ServiceCard
              title="Creative / Art Review"
              price="$1.50"
              description="Is this creative work genuine quality or AI slop? Musicians, artists, and designers evaluate originality and technical merit."
            />
            <ServiceCard
              title="Community Sentiment"
              price="$0.75"
              description="What's the real vibe of this community? Qualitative assessment of engagement authenticity and social dynamics."
            />
            <ServiceCard
              title="General Human Judgment"
              price="$0.50+"
              description="Any question requiring qualitative human opinion. From cultural analysis to taste assessment — if it needs human intuition, we deliver."
            />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="landing-section">
        <div className="landing-container">
          <h2 className="landing-section-title">How It Works</h2>
          <div className="landing-steps">
            <div className="landing-step">
              <div className="landing-step-number">1</div>
              <h3>Agent Discovers Taste</h3>
              <p>AI agents find Taste through the Virtuals ACP marketplace or Butler Agent.</p>
            </div>
            <div className="landing-step">
              <div className="landing-step-number">2</div>
              <h3>Submits a Request</h3>
              <p>The agent selects a service and submits a structured request with USDC payment.</p>
            </div>
            <div className="landing-step">
              <div className="landing-step-number">3</div>
              <h3>Expert Reviews</h3>
              <p>A domain-matched human expert reviews the request and submits a structured judgment.</p>
            </div>
            <div className="landing-step">
              <div className="landing-step-number">4</div>
              <h3>Judgment Delivered</h3>
              <p>Structured opinion with verdict, confidence score, reasoning, and evidence — delivered on-chain.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="landing-section landing-section-dark">
        <div className="landing-container" style={{ textAlign: 'center' }}>
          <h2 style={{ color: 'var(--color-white)', marginBottom: 'var(--space-md)' }}>
            Are you a creative professional?
          </h2>
          <p style={{ color: 'var(--color-grey-4)', maxWidth: 500, margin: '0 auto var(--space-xl)' }}>
            We're building a network of musicians, artists, designers, crypto natives, and cultural analysts.
            Earn USDC for your expert opinions.
          </p>
          <Link to="/experts" className="btn btn-primary">View Expert Profiles</Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <Link to="/terms">Terms</Link>
        <Link to="/privacy">Privacy</Link>
        <Link to="/agreement">Expert Agreement</Link>
      </footer>
    </div>
  );
}

function ServiceCard({ title, price, description }: { title: string; price: string; description: string }) {
  return (
    <div className="service-card">
      <div className="flex justify-between items-center mb-sm">
        <h3 style={{ margin: 0, fontSize: 'var(--font-size-base)' }}>{title}</h3>
        <span className="badge badge-sm">{price}</span>
      </div>
      <p className="text-sm" style={{ color: 'var(--color-grey-2)', margin: 0 }}>{description}</p>
    </div>
  );
}
