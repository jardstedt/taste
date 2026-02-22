import { useState } from 'react';

interface LoginFormProps {
  onLogin: (email: string, password: string) => Promise<string | null>;
}

export function LoginForm({ onLogin }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const err = await onLogin(email, password);
    if (err) setError(err);
    setLoading(false);
  };

  return (
    <div className="login-page">
      <form onSubmit={handleSubmit} className="login-card">
        <div className="login-brand">Taste</div>
        <p className="login-subtitle">Human Judgment Oracle — Expert Dashboard</p>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="form-group">
          <label className="form-label">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="input input-full"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="input input-full"
          />
        </div>

        <button type="submit" disabled={loading} className="btn btn-primary w-full">
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
