import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth.js';
import { Layout } from './components/Layout.js';
import { ProfileCard } from './components/ProfileCard.js';
import { StatsOverview } from './components/StatsOverview.js';
import { ChatView } from './components/ChatView.js';
import { EarningsView } from './components/EarningsView.js';
import { ActiveSessions } from './pages/ActiveSessions.js';
import { SessionHistory } from './pages/SessionHistory.js';
import { Terms } from './pages/Terms.js';
import { Privacy } from './pages/Privacy.js';
import { ExpertAgreement } from './pages/ExpertAgreement.js';
import { ExpertDirectory } from './pages/ExpertDirectory.js';
import { ExpertProfile } from './pages/ExpertProfile.js';
import { AcpDemo } from './pages/AcpDemo.js';
import { AcpInspector } from './pages/AcpInspector.js';
import { McpTestClient } from './pages/McpTestClient.js';
import { Landing } from './pages/Landing.js';
import { LoginPage } from './pages/LoginPage.js';
import { ApplyPage } from './pages/ApplyPage.js';
import { useState, useEffect } from 'react';
import * as api from './api/client.js';

function AppContent() {
  const { user, loading: authLoading, logout, refresh: refreshAuth } = useAuth();
  const navigate = useNavigate();

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0D0D0D', color: '#2DD4BF', fontFamily: "'JetBrains Mono', monospace" }}>
        Loading...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
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
        <Route path="/history" element={<SessionHistory />} />
        <Route path="/earnings" element={<EarningsView user={user} onRefresh={refreshAuth} />} />
        <Route path="/profile" element={
          <ProfileCard user={user} onRefresh={refreshAuth} />
        } />
        <Route path="/session/:sessionId" element={<SessionView />} />
        {user.role === 'admin' && (
          <>
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/admin/acp-demo" element={<AcpDemo />} />
            <Route path="/admin/acp-inspector" element={<AcpInspector />} />
            <Route path="/admin/mcp-test" element={<McpTestClient />} />
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

function AdminPanel() {
  const [experts, setExperts] = useState<Array<{ id: string; name: string; role: string; domains: string[]; availability: string; completedJobs: number; deactivatedAt: string | null; reputationScores: Record<string, number>; credentials?: { bio?: string; tagline?: string; twitterHandle?: string; profileImageUrl?: string } }>>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', domains: [] as string[], password: '', bio: '', tagline: '', twitterHandle: '' });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
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

  // Applications
  const [applications, setApplications] = useState<Array<{
    id: string; name: string; email: string; domains: string[];
    portfolioUrl: string | null; bio: string; motivation: string;
    status: string; createdAt: string;
  }>>([]);

  const loadApplications = async () => {
    const res = await api.getApplications();
    if (res.success && res.data) {
      setApplications(res.data as typeof applications);
    }
  };

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
    loadApplications();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.domains.length === 0) return;
    setCreating(true);

    // Build credentials from optional fields
    const credentials: Record<string, unknown> = {};
    if (form.bio.trim()) credentials.bio = form.bio.trim();
    if (form.tagline.trim()) credentials.tagline = form.tagline.trim();
    if (form.twitterHandle.trim()) credentials.twitterHandle = form.twitterHandle.trim().replace(/^@/, '');

    const createRes = await api.createExpert({
      name: form.name,
      email: form.email,
      domains: form.domains,
      password: form.password,
      credentials: Object.keys(credentials).length > 0 ? credentials : undefined,
    });

    // Upload avatar if selected and create succeeded
    if (avatarFile && createRes.success && createRes.data) {
      const newExpert = createRes.data as { id: string };
      await api.uploadExpertAvatar(newExpert.id, avatarFile);
    }

    const res = await api.getExperts();
    if (res.success && res.data) {
      setExperts(res.data as typeof experts);
    }
    setForm({ name: '', email: '', domains: [], password: '', bio: '', tagline: '', twitterHandle: '' });
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(null);
    setAvatarPreview(null);
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

  const pendingApps = applications.filter(a => a.status === 'pending');

  return (
    <div>
      {/* Expert Applications */}
      {pendingApps.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 className="page-title" style={{ marginBottom: 16 }}>Applications ({pendingApps.length})</h2>
          {pendingApps.map(app => (
            <div key={app.id} className="card mb-md" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                  <span className="text-bold">{app.name}</span>
                  <span style={{ fontSize: 12, marginLeft: 8, opacity: 0.6 }}>{app.email}</span>
                </div>
                <span style={{ fontSize: 11, opacity: 0.5 }}>
                  {new Date(app.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                {app.domains.map(d => <span key={d} className="chip">{d}</span>)}
              </div>
              <div style={{ fontSize: 13, marginBottom: 8, lineHeight: 1.5 }}>{app.bio}</div>
              <div style={{ fontSize: 12, fontStyle: 'italic', opacity: 0.7, marginBottom: 12 }}>{app.motivation}</div>
              {app.portfolioUrl && (
                <a href={app.portfolioUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
                  {app.portfolioUrl}
                </a>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={async () => { await api.updateApplication(app.id, 'approved'); loadApplications(); }}
                  className="btn btn-primary btn-sm"
                >Approve</button>
                <button
                  onClick={async () => { await api.updateApplication(app.id, 'rejected'); loadApplications(); }}
                  className="btn btn-ghost btn-sm"
                  style={{ color: 'var(--color-error, #EF4444)' }}
                >Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pending Withdrawals */}
      {pendingWithdrawals.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 className="page-title" style={{ marginBottom: 16 }}>Pending Withdrawals</h2>
          {pendingWithdrawals.map(w => (
            <div key={w.id} className="card mb-md" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div>
                  <span className="text-bold">{expertName(w.expertId)}</span>
                  <span style={{ color: '#7A7670', fontSize: 12, marginLeft: 8 }}>
                    {new Date(w.requestedAt).toLocaleString()}
                  </span>
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#FB923C' }}>
                  ${w.amountUsdc.toFixed(2)}
                </div>
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#7A7670', marginBottom: 8, wordBreak: 'break-all' }}>
                {w.walletAddress} ({w.walletChain === 'base' ? 'Base' : 'Ethereum'})
              </div>
              <div style={{
                fontSize: 11, fontWeight: 600, marginBottom: 12,
                color: w.status === 'approved' ? '#5EEAD4' : '#FB923C',
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
            <label className="form-label">Domains</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(['crypto', 'music', 'art', 'design', 'culture', 'community', 'business', 'general'] as const).map(d => (
                <label key={d} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, cursor: 'pointer' }}>
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
            {form.domains.length === 0 && <div style={{ color: '#EF4444', fontSize: 11, marginTop: 4 }}>Select at least one domain</div>}
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input type="password" value={form.password} onChange={e => setForm(prev => ({ ...prev, password: e.target.value }))} required minLength={8} className="input input-full" placeholder="Min 8 characters" />
          </div>

          {/* Profile fields */}
          <div className="form-group">
            <label className="form-label">Avatar</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%', overflow: 'hidden',
                background: '#1E1E22', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, fontWeight: 700, color: '#2DD4BF', flexShrink: 0,
              }}>
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  form.name.charAt(0).toUpperCase() || '?'
                )}
              </div>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={e => {
                  const file = e.target.files?.[0] ?? null;
                  if (avatarPreview) URL.revokeObjectURL(avatarPreview);
                  setAvatarFile(file);
                  setAvatarPreview(file ? URL.createObjectURL(file) : null);
                }}
                style={{ fontSize: 13 }}
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Tagline</label>
            <input type="text" value={form.tagline} onChange={e => setForm(prev => ({ ...prev, tagline: e.target.value }))} maxLength={200} className="input input-full" placeholder="e.g. Crypto native & music producer" />
          </div>
          <div className="form-group">
            <label className="form-label">Twitter / X</label>
            <input type="text" value={form.twitterHandle} onChange={e => setForm(prev => ({ ...prev, twitterHandle: e.target.value }))} maxLength={50} className="input input-full" placeholder="handle (without @)" />
          </div>
          <div className="form-group">
            <label className="form-label">Bio <span style={{ fontSize: 11, color: '#7A7670', fontWeight: 400 }}>({form.bio.length}/1000)</span></label>
            <textarea value={form.bio} onChange={e => setForm(prev => ({ ...prev, bio: e.target.value }))} maxLength={1000} rows={3} className="input input-full" placeholder="Brief professional background..." style={{ resize: 'vertical' }} />
          </div>

          <button type="submit" disabled={creating} className="btn btn-primary">
            {creating ? 'Creating...' : 'Create Expert'}
          </button>
        </form>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {experts.map(expert => (
          <div key={expert.id} className="card" style={{ padding: 16, opacity: expert.deactivatedAt ? 0.5 : 1 }}>
            {/* Row 1: Avatar + Name/Tagline/Twitter + Status */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
              {/* Avatar with upload overlay */}
              <div style={{ position: 'relative', flexShrink: 0, width: 44, height: 44 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%', overflow: 'hidden',
                  background: '#1E1E22', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, fontWeight: 700, color: '#2DD4BF',
                }}>
                  {expert.credentials?.profileImageUrl ? (
                    <img src={expert.credentials.profileImageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    expert.name.charAt(0).toUpperCase()
                  )}
                </div>
                <button
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/png,image/jpeg,image/webp,image/gif';
                    input.onchange = async () => {
                      const file = input.files?.[0];
                      if (!file) return;
                      await api.uploadExpertAvatar(expert.id, file);
                      const res = await api.getExperts();
                      if (res.success && res.data) setExperts(res.data as typeof experts);
                    };
                    input.click();
                  }}
                  title="Change avatar"
                  style={{
                    position: 'absolute', bottom: 0, right: 0,
                    width: 16, height: 16, borderRadius: '50%',
                    background: '#2DD4BF', color: '#0D0D0D', border: '2px solid #161618',
                    fontSize: 10, lineHeight: '10px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: 0,
                  }}
                >+</button>
              </div>

              {/* Name + meta */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="text-bold">{expert.name}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 600, textTransform: 'capitalize',
                    padding: '1px 6px', borderRadius: 4,
                    background: '#1E1E22', color: '#2DD4BF',
                  }}>{expert.role}</span>
                </div>
                {expert.credentials?.tagline && (
                  <div style={{ fontSize: 12, color: '#7A7670', marginTop: 2 }}>{expert.credentials.tagline}</div>
                )}
                {expert.credentials?.twitterHandle && (
                  <a
                    href={`https://x.com/${expert.credentials.twitterHandle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 12, color: '#2DD4BF', textDecoration: 'none', marginTop: 1, display: 'inline-block' }}
                  >
                    @{expert.credentials.twitterHandle}
                  </a>
                )}
              </div>

              {/* Status */}
              <div style={{ flexShrink: 0 }}>
                {expert.deactivatedAt ? (
                  <span style={{ color: 'var(--color-error, #EF4444)', fontSize: 12, fontWeight: 600 }}>Deactivated</span>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span className={`status-dot status-dot-${expert.availability}`} />
                    <span style={{ textTransform: 'capitalize', fontSize: 12, color: expert.availability === 'online' ? '#2DD4BF' : '#7A7670' }}>{expert.availability}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Bio */}
            {expert.credentials?.bio && (
              <div style={{ fontSize: 12, color: '#7A7670', marginBottom: 8, lineHeight: 1.4 }}>
                {expert.credentials.bio.length > 150 ? expert.credentials.bio.slice(0, 150) + '...' : expert.credentials.bio}
              </div>
            )}

            {/* Domains */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
              {expert.domains.map(d => (
                <span key={d} className="chip">{d}</span>
              ))}
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#7A7670' }}>{expert.completedJobs} jobs completed</span>
              {expert.role !== 'admin' && !expert.deactivatedAt && (
                <button
                  onClick={async () => {
                    if (!confirm(`Deactivate ${expert.name}? They will no longer be able to log in.`)) return;
                    await api.deleteExpert(expert.id);
                    const res = await api.getExperts();
                    if (res.success && res.data) setExperts(res.data as typeof experts);
                  }}
                  className="btn btn-ghost btn-sm"
                  style={{ color: 'var(--color-error, #EF4444)', fontSize: 12, padding: '3px 10px' }}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/apply" element={<ApplyPage />} />
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
