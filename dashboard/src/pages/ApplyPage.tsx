import { useState } from 'react';
import { Link } from 'react-router-dom';

const DOMAINS = ['crypto', 'music', 'art', 'design', 'culture', 'community', 'business', 'general'] as const;

export function ApplyPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    domains: [] as string[],
    portfolioUrl: '',
    bio: '',
    motivation: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.domains.length === 0) {
      setError('Select at least one expertise domain');
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/public/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
      } else {
        setError(data.error || 'Something went wrong');
      }
    } catch {
      setError('Network error — please try again');
    }
    setSubmitting(false);
  };

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-page-bg" />
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>&#10003;</div>
          <h2 style={{ marginBottom: 8 }}>Application Received</h2>
          <p style={{ color: '#7A7670', fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
            We'll review your application and get back to you. Keep an eye on your inbox.
          </p>
          <Link to="/" className="auth-back-link">&larr; Back to home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-page-bg" />
      <form onSubmit={handleSubmit} className="auth-card" style={{ width: 480 }}>
        <h2>Apply as Expert</h2>
        {error && <div className="alert alert-error">{error}</div>}

        <div className="form-group">
          <label className="form-label">Name</label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
            required
            maxLength={100}
            className="input input-full"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
            required
            className="input input-full"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Expertise Domains</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
            {DOMAINS.map(d => (
              <label key={d} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 12, color: form.domains.includes(d) ? '#2DD4BF' : '#7A7670',
                cursor: 'pointer', transition: 'color 0.2s',
              }}>
                <input
                  type="checkbox"
                  checked={form.domains.includes(d)}
                  onChange={e => setForm(prev => ({
                    ...prev,
                    domains: e.target.checked ? [...prev.domains, d] : prev.domains.filter(x => x !== d),
                  }))}
                  style={{ accentColor: '#2DD4BF' }}
                />
                {d.charAt(0).toUpperCase() + d.slice(1)}
              </label>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Portfolio URL <span style={{ opacity: 0.5 }}>(optional)</span></label>
          <input
            type="url"
            value={form.portfolioUrl}
            onChange={e => setForm(prev => ({ ...prev, portfolioUrl: e.target.value }))}
            className="input input-full"
            placeholder="https://"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Bio <span style={{ opacity: 0.5 }}>({form.bio.length}/1000)</span></label>
          <textarea
            value={form.bio}
            onChange={e => setForm(prev => ({ ...prev, bio: e.target.value }))}
            required
            maxLength={1000}
            rows={3}
            className="input input-full"
            placeholder="Your background and expertise..."
            style={{ resize: 'vertical' }}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Why Taste? <span style={{ opacity: 0.5 }}>({form.motivation.length}/500)</span></label>
          <textarea
            value={form.motivation}
            onChange={e => setForm(prev => ({ ...prev, motivation: e.target.value }))}
            required
            maxLength={500}
            rows={2}
            className="input input-full"
            placeholder="What makes you a great fit..."
            style={{ resize: 'vertical' }}
          />
        </div>

        <button type="submit" disabled={submitting} className="btn btn-primary w-full">
          {submitting ? 'Submitting...' : 'Submit Application'}
        </button>

        <Link to="/" className="auth-back-link">&larr; Back to home</Link>
      </form>
    </div>
  );
}
