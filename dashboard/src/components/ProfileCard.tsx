import { useState } from 'react';
import type { AuthUser, ExpertCredentials } from '../types/index.js';
import * as api from '../api/client.js';

interface ProfileCardProps {
  user: AuthUser;
  onRefresh: () => void;
}

export function ProfileCard({ user, onRefresh }: ProfileCardProps) {
  const [availability, setAvailability] = useState(user.availability);
  const [updating, setUpdating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [consent, setConsent] = useState(user.consentToPublicProfile);
  const [creds, setCreds] = useState<ExpertCredentials>({
    bio: user.credentials?.bio ?? '',
    tagline: user.credentials?.tagline ?? '',
    profileImageUrl: user.credentials?.profileImageUrl ?? '',
    twitterHandle: user.credentials?.twitterHandle ?? '',
    linkedinUrl: user.credentials?.linkedinUrl ?? '',
    portfolioUrl: user.credentials?.portfolioUrl ?? '',
    location: user.credentials?.location ?? '',
  });


  const toggleAvailability = async () => {
    const next = availability === 'online' ? 'offline' : 'online';
    setUpdating(true);
    const res = await api.updateExpert(user.expertId, { availability: next });
    if (res.success) {
      setAvailability(next);
      onRefresh();
    }
    setUpdating(false);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveMsg(null);

    // Clean empty strings to undefined
    const cleaned: ExpertCredentials = {};
    if (creds.bio?.trim()) cleaned.bio = creds.bio.trim();
    if (creds.tagline?.trim()) cleaned.tagline = creds.tagline.trim();
    if (creds.profileImageUrl?.trim()) cleaned.profileImageUrl = creds.profileImageUrl.trim();
    if (creds.twitterHandle?.trim()) cleaned.twitterHandle = creds.twitterHandle.trim().replace(/^@/, '');
    if (creds.linkedinUrl?.trim()) cleaned.linkedinUrl = creds.linkedinUrl.trim();
    if (creds.portfolioUrl?.trim()) cleaned.portfolioUrl = creds.portfolioUrl.trim();
    if (creds.location?.trim()) cleaned.location = creds.location.trim();

    const res = await api.updateExpert(user.expertId, {
      credentials: cleaned,
      consentToPublicProfile: consent,
    });

    if (res.success) {
      setSaveMsg('Profile saved.');
      setEditing(false);
      onRefresh();
    } else {
      setSaveMsg(res.error ?? 'Failed to save.');
    }
    setSaving(false);
  };

  const avatarInitial = user.name.charAt(0).toUpperCase();

  return (
    <div className="flex flex-col gap-lg">
      {/* Profile Header */}
      <div className="card">
        <div className="flex items-center justify-between mb-lg">
          <h2 style={{ margin: 0 }}>My Profile</h2>
          <button
            onClick={() => { setEditing(!editing); setSaveMsg(null); }}
            className={editing ? 'btn btn-secondary btn-sm' : 'btn btn-primary btn-sm'}
          >
            {editing ? 'Cancel' : 'Edit Profile'}
          </button>
        </div>

        {/* View mode */}
        {!editing && (
          <>
            {/* Centered: avatar, name, tagline, tags, location */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div className="expert-avatar expert-avatar-lg">
                {user.credentials?.profileImageUrl ? (
                  <img src={user.credentials.profileImageUrl} alt={user.name} className="expert-avatar-img" />
                ) : (
                  <div className="expert-avatar-placeholder expert-avatar-placeholder-lg">
                    {avatarInitial}
                  </div>
                )}
              </div>
              <h3 style={{ margin: '12px 0 4px' }}>{user.name}</h3>
              {user.credentials?.tagline && (
                <p className="text-sm text-grey" style={{ margin: '0 0 8px' }}>{user.credentials.tagline}</p>
              )}
              <div className="flex gap-sm" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
                {user.domains.map(d => (
                  <span key={d} className="chip">{d}</span>
                ))}
              </div>
              {user.credentials?.location && (
                <p className="text-xs text-grey mt-sm" style={{ margin: '6px 0 0' }}>{user.credentials.location}</p>
              )}

              {/* Centered: availability toggle */}
              <div className="flex items-center gap-sm" style={{ marginTop: 16 }}>
                <span className={`status-dot status-dot-${availability}`} />
                <span className="text-sm" style={{ textTransform: 'capitalize' }}>{availability}</span>
                <button
                  onClick={toggleAvailability}
                  disabled={updating}
                  className="btn btn-context btn-sm"
                >
                  Toggle
                </button>
              </div>
            </div>

            {/* Left-aligned: social links, bio, visibility */}
            {user.credentials?.twitterHandle && (
              <div style={{ marginTop: 24 }}>
                <div className="form-label">X / Twitter</div>
                <a href={`https://x.com/${user.credentials.twitterHandle}`} target="_blank" rel="noopener noreferrer" className="profile-social-link">
                  @{user.credentials.twitterHandle}
                </a>
              </div>
            )}
            {user.credentials?.linkedinUrl && (
              <div style={{ marginTop: user.credentials?.twitterHandle ? 12 : 24 }}>
                <div className="form-label">LinkedIn</div>
                <a href={user.credentials.linkedinUrl} target="_blank" rel="noopener noreferrer" className="profile-social-link">
                  {user.credentials.linkedinUrl}
                </a>
              </div>
            )}
            {user.credentials?.portfolioUrl && (
              <div style={{ marginTop: 12 }}>
                <div className="form-label">Portfolio</div>
                <a href={user.credentials.portfolioUrl} target="_blank" rel="noopener noreferrer" className="profile-social-link">
                  {user.credentials.portfolioUrl}
                </a>
              </div>
            )}

            {user.credentials?.bio && (
              <div style={{ marginTop: 20 }}>
                <div className="form-label">Bio</div>
                <p className="text-sm" style={{ color: 'var(--color-grey-2)', lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: '4px 0 0' }}>
                  {user.credentials.bio}
                </p>
              </div>
            )}

            <div className="mt-md text-xs text-grey">
              Public profile: {consent ? 'Visible' : 'Hidden'}
            </div>
          </>
        )}

        {/* Edit mode */}
        {editing && (
          <form onSubmit={handleSaveProfile}>
            {saveMsg && (
              <div className={`alert ${saveMsg.includes('saved') ? 'alert-success' : 'alert-error'} mb-md`}>
                {saveMsg}
              </div>
            )}

            <div className="profile-edit-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
              <div className="form-group">
                <label className="form-label">Tagline</label>
                <input
                  type="text"
                  value={creds.tagline ?? ''}
                  onChange={e => setCreds(p => ({ ...p, tagline: e.target.value }))}
                  placeholder="e.g. Crypto native & music producer"
                  maxLength={200}
                  className="input input-full"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Location</label>
                <input
                  type="text"
                  value={creds.location ?? ''}
                  onChange={e => setCreds(p => ({ ...p, location: e.target.value }))}
                  placeholder="e.g. Stockholm, Sweden"
                  maxLength={100}
                  className="input input-full"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Profile Image URL</label>
                <input
                  type="url"
                  value={creds.profileImageUrl ?? ''}
                  onChange={e => setCreds(p => ({ ...p, profileImageUrl: e.target.value }))}
                  placeholder="https://..."
                  className="input input-full"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Twitter/X Handle</label>
                <input
                  type="text"
                  value={creds.twitterHandle ?? ''}
                  onChange={e => setCreds(p => ({ ...p, twitterHandle: e.target.value }))}
                  placeholder="handle (without @)"
                  maxLength={50}
                  className="input input-full"
                />
              </div>
              <div className="form-group">
                <label className="form-label">LinkedIn URL</label>
                <input
                  type="url"
                  value={creds.linkedinUrl ?? ''}
                  onChange={e => setCreds(p => ({ ...p, linkedinUrl: e.target.value }))}
                  placeholder="https://linkedin.com/in/..."
                  className="input input-full"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Portfolio URL</label>
                <input
                  type="url"
                  value={creds.portfolioUrl ?? ''}
                  onChange={e => setCreds(p => ({ ...p, portfolioUrl: e.target.value }))}
                  placeholder="https://..."
                  className="input input-full"
                />
              </div>
            </div>

            <div className="form-group mt-md">
              <label className="form-label">Bio</label>
              <textarea
                value={creds.bio ?? ''}
                onChange={e => setCreds(p => ({ ...p, bio: e.target.value }))}
                placeholder="Tell agents and visitors about your expertise..."
                maxLength={1000}
                rows={4}
                className="input input-full"
                style={{ resize: 'vertical' }}
              />
              <div className="text-xs text-grey mt-xs">{(creds.bio ?? '').length}/1000</div>
            </div>

            <label className="flex items-center gap-sm mt-md" style={{ cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={consent}
                onChange={e => setConsent(e.target.checked)}
              />
              <span className="text-sm">Show my profile publicly on the Experts page</span>
            </label>

            <div className="flex gap-sm mt-lg">
              <button type="submit" disabled={saving} className="btn btn-primary">
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
              <button type="button" onClick={() => setEditing(false)} className="btn btn-ghost">
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

    </div>
  );
}
