import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth.js';
import { useJobs } from './hooks/useJobs.js';
import { LoginForm } from './components/LoginForm.js';
import { Layout } from './components/Layout.js';
import { JudgmentForm } from './components/JudgmentForm.js';
import { ProfileCard } from './components/ProfileCard.js';
import { JobHistory } from './components/JobHistory.js';
import { StatsOverview } from './components/StatsOverview.js';
import { ChatView } from './components/ChatView.js';
import { EarningsView } from './components/EarningsView.js';
import { ActiveSessions } from './pages/ActiveSessions.js';
import { SessionHistory } from './pages/SessionHistory.js';
import { Terms } from './pages/Terms.js';
import { Privacy } from './pages/Privacy.js';
import { ExpertAgreement } from './pages/ExpertAgreement.js';
import { Landing } from './pages/Landing.js';
import { ExpertDirectory } from './pages/ExpertDirectory.js';
import { ExpertProfile } from './pages/ExpertProfile.js';
import { AcpDemo } from './pages/AcpDemo.js';
import { AcpInspector } from './pages/AcpInspector.js';
import { useState, useEffect } from 'react';
import type { Job, Judgment } from './types/index.js';
import * as api from './api/client.js';

function AppContent() {
  const { user, loading: authLoading, login, logout, refresh: refreshAuth } = useAuth();
  const { allJobs, loading: jobsLoading, refresh: refreshJobs } = useJobs();
  const navigate = useNavigate();

  if (authLoading) {
    return (
      <div className="login-page" style={{ color: 'var(--color-primary-light)' }}>
        Loading...
      </div>
    );
  }

  if (!user) {
    return <LoginForm onLogin={login} />;
  }

  const handleAcceptSession = async (sessionId: string) => {
    await api.acceptSessionRequest(sessionId);
    navigate(`/dashboard/session/${sessionId}`);
  };

  return (
    <Layout user={user} onLogout={logout} onRefresh={refreshAuth}>
      <Routes>
        <Route path="/" element={
          <StatsOverview
            user={user}
            onNavigateSession={(id) => navigate(`/dashboard/session/${id}`)}
            onAcceptSession={handleAcceptSession}
          />
        } />
        <Route path="/active" element={<ActiveSessions />} />
        <Route path="/history" element={
          <>
            <SessionHistory />
            <div className="mt-xl">
              <h3>Legacy Jobs</h3>
              <JobHistory jobs={allJobs} loading={jobsLoading} />
            </div>
          </>
        } />
        <Route path="/earnings" element={<EarningsView user={user} onRefresh={refreshAuth} />} />
        <Route path="/profile" element={
          <ProfileCard user={user} onRefresh={refreshAuth} />
        } />
        <Route path="/session/:sessionId" element={<SessionView />} />
        <Route path="/job/:jobId" element={
          <JobDetail onSubmitted={refreshJobs} />
        } />
        {user.role === 'admin' && (
          <>
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/admin/acp-demo" element={<AcpDemo />} />
            <Route path="/admin/acp-inspector" element={<AcpInspector />} />
          </>
        )}
      </Routes>
    </Layout>
  );
}

function SessionView() {
  const navigate = useNavigate();
  const sessionId = window.location.pathname.split('/session/')[1];

  if (!sessionId) return <p className="text-grey">Session not found.</p>;

  return <ChatView sessionId={sessionId} onBack={() => navigate('/dashboard/active')} />;
}

function JobDetail({ onSubmitted }: { onSubmitted: () => void }) {
  const [job, setJob] = useState<Job | null>(null);
  const [judgment, setJudgment] = useState<Judgment | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const jobId = window.location.pathname.split('/job/')[1];

  useEffect(() => {
    if (!jobId) return;
    api.getJob(jobId).then(res => {
      if (res.success && res.data) {
        const data = res.data as { job: Job; judgment: Judgment | null };
        setJob(data.job);
        setJudgment(data.judgment);
      }
      setLoading(false);
    });
  }, [jobId]);

  if (loading) return <p className="text-grey">Loading...</p>;
  if (!job) return <p className="text-grey">Job not found.</p>;

  if (judgment) {
    return (
      <div className="card">
        <button onClick={() => navigate('/dashboard')} className="btn btn-ghost btn-sm mb-lg">
          Back to Queue
        </button>
        <h3>Judgment Submitted</h3>
        <pre className="alert alert-info mt-md" style={{ whiteSpace: 'pre-wrap', fontSize: 'var(--font-size-sm)' }}>
          {JSON.stringify(judgment.content, null, 2)}
        </pre>
        <p className="text-xs text-grey mt-sm">
          Submitted: {new Date(judgment.submittedAt).toLocaleString()}
        </p>
      </div>
    );
  }

  return (
    <div>
      <button onClick={() => navigate('/dashboard')} className="btn btn-ghost btn-sm mb-lg">
        Back to Queue
      </button>
      <JudgmentForm
        job={job}
        onSubmitted={() => {
          onSubmitted();
          navigate('/dashboard');
        }}
      />
    </div>
  );
}

function AdminPanel() {
  const [experts, setExperts] = useState<Array<{ id: string; name: string; role: string; domains: string[]; availability: string; completedJobs: number; deactivatedAt: string | null; reputationScores: Record<string, number> }>>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', domains: '', password: '' });
  const [creating, setCreating] = useState(false);

  // Withdrawals
  const [pendingWithdrawals, setPendingWithdrawals] = useState<Array<{
    id: string; expertId: string; amountUsdc: number; status: string;
    walletAddress: string; walletChain: string; txHash: string | null;
    requestedAt: string;
  }>>([]);
  const [txHashInputs, setTxHashInputs] = useState<Record<string, string>>({});
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadWithdrawals = async () => {
    const res = await api.getPendingWithdrawals();
    if (res.success && res.data) {
      setPendingWithdrawals(res.data as typeof pendingWithdrawals);
    }
  };

  useEffect(() => {
    api.getExperts().then(res => {
      if (res.success && res.data) {
        setExperts(res.data as typeof experts);
      }
    });
    loadWithdrawals();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    const domains = form.domains.split(',').map(d => d.trim()).filter(Boolean);
    await api.createExpert({ name: form.name, email: form.email, domains, password: form.password });
    const res = await api.getExperts();
    if (res.success && res.data) {
      setExperts(res.data as typeof experts);
    }
    setForm({ name: '', email: '', domains: '', password: '' });
    setShowCreate(false);
    setCreating(false);
  };

  const handleApprove = async (id: string) => {
    setProcessingId(id);
    await api.approveWithdrawal(id);
    await loadWithdrawals();
    setProcessingId(null);
  };

  const handleComplete = async (id: string) => {
    const txHash = txHashInputs[id];
    if (!txHash) return;
    setProcessingId(id);
    await api.completeWithdrawal(id, txHash);
    await loadWithdrawals();
    setProcessingId(null);
  };

  const handleReject = async (id: string) => {
    const reason = rejectReasons[id];
    if (!reason) return;
    setProcessingId(id);
    await api.rejectWithdrawal(id, reason);
    await loadWithdrawals();
    setProcessingId(null);
  };

  const expertName = (expertId: string) => {
    const expert = experts.find(e => e.id === expertId);
    return expert?.name ?? expertId.slice(0, 8);
  };

  return (
    <div>
      {/* Pending Withdrawals */}
      {pendingWithdrawals.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 className="page-title" style={{ marginBottom: 16 }}>Pending Withdrawals</h2>
          {pendingWithdrawals.map(w => (
            <div key={w.id} className="card mb-md" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div>
                  <span className="text-bold">{expertName(w.expertId)}</span>
                  <span style={{ color: '#9CA3AF', fontSize: 12, marginLeft: 8 }}>
                    {new Date(w.requestedAt).toLocaleString()}
                  </span>
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#D97706' }}>
                  ${w.amountUsdc.toFixed(2)}
                </div>
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#6B7280', marginBottom: 8, wordBreak: 'break-all' }}>
                {w.walletAddress} ({w.walletChain === 'base' ? 'Base L2' : 'Ethereum'})
              </div>
              <div style={{
                fontSize: 11, fontWeight: 600, marginBottom: 12,
                color: w.status === 'approved' ? '#3B82F6' : '#F59E0B',
                textTransform: 'capitalize',
              }}>
                Status: {w.status}
              </div>

              {w.status === 'pending' && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => handleApprove(w.id)}
                    disabled={processingId === w.id}
                    className="btn btn-primary btn-sm"
                  >
                    Approve
                  </button>
                  <input
                    type="text"
                    value={rejectReasons[w.id] ?? ''}
                    onChange={e => setRejectReasons(prev => ({ ...prev, [w.id]: e.target.value }))}
                    placeholder="Rejection reason..."
                    className="input"
                    style={{ flex: 1, minWidth: 150 }}
                  />
                  <button
                    onClick={() => handleReject(w.id)}
                    disabled={processingId === w.id || !rejectReasons[w.id]}
                    className="btn btn-secondary btn-sm"
                    style={{ color: '#EF4444' }}
                  >
                    Reject
                  </button>
                </div>
              )}

              {(w.status === 'approved' || w.status === 'pending') && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <input
                    type="text"
                    value={txHashInputs[w.id] ?? ''}
                    onChange={e => setTxHashInputs(prev => ({ ...prev, [w.id]: e.target.value }))}
                    placeholder="Enter tx hash after sending USDC..."
                    className="input"
                    style={{ flex: 1, fontFamily: 'monospace', fontSize: 12 }}
                  />
                  <button
                    onClick={() => handleComplete(w.id)}
                    disabled={processingId === w.id || !txHashInputs[w.id]}
                    className="btn-green btn-sm"
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    Complete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="page-header">
        <h2 className="page-title">Expert Management</h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className={showCreate ? 'btn btn-secondary btn-sm' : 'btn btn-primary btn-sm'}
        >
          {showCreate ? 'Cancel' : 'Add Expert'}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="card mb-lg">
          <div className="form-group">
            <label className="form-label">Name</label>
            <input type="text" value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} required className="input input-full" />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" value={form.email} onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))} required className="input input-full" />
          </div>
          <div className="form-group">
            <label className="form-label">Domains (comma-separated)</label>
            <input type="text" value={form.domains} onChange={e => setForm(prev => ({ ...prev, domains: e.target.value }))} placeholder="crypto, music, art" required className="input input-full" />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input type="password" value={form.password} onChange={e => setForm(prev => ({ ...prev, password: e.target.value }))} required minLength={8} className="input input-full" placeholder="Min 8 characters" />
          </div>
          <button type="submit" disabled={creating} className="btn btn-primary">
            {creating ? 'Creating...' : 'Create Expert'}
          </button>
        </form>
      )}

      <table className="table table-hover">
        <thead>
          <tr>
            <th>Name</th>
            <th>Role</th>
            <th>Domains</th>
            <th>Status</th>
            <th>Jobs</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {experts.map(expert => (
            <tr key={expert.id} style={expert.deactivatedAt ? { opacity: 0.5 } : undefined}>
              <td className="text-bold">{expert.name}</td>
              <td style={{ textTransform: 'capitalize' }}>{expert.role}</td>
              <td>
                <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
                  {expert.domains.map(d => (
                    <span key={d} className="chip">{d}</span>
                  ))}
                </div>
              </td>
              <td>
                {expert.deactivatedAt ? (
                  <span className="text-sm" style={{ color: 'var(--color-error, #DC2626)' }}>Deactivated</span>
                ) : (
                  <div className="flex items-center gap-sm">
                    <span className={`status-dot status-dot-${expert.availability}`} />
                    <span style={{ textTransform: 'capitalize' }}>{expert.availability}</span>
                  </div>
                )}
              </td>
              <td>{expert.completedJobs}</td>
              <td>
                {expert.role !== 'admin' && !expert.deactivatedAt && (
                  <button
                    onClick={async () => {
                      if (!confirm(`Deactivate ${expert.name}? They will no longer be able to log in.`)) return;
                      await api.deleteExpert(expert.id);
                      const res = await api.getExperts();
                      if (res.success && res.data) setExperts(res.data as typeof experts);
                    }}
                    className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--color-error, #DC2626)', fontSize: 12, padding: '3px 10px' }}
                  >
                    Remove
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Landing />} />
        <Route path="/experts" element={<ExpertDirectory />} />
        <Route path="/expert/:id" element={<ExpertProfile />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/agreement" element={<ExpertAgreement />} />

        {/* Dashboard (authenticated) */}
        <Route path="/dashboard/*" element={<AppContent />} />
      </Routes>
    </BrowserRouter>
  );
}
