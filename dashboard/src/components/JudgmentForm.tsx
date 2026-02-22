import { useState } from 'react';
import type { Job, OfferingType } from '../types/index.js';
import { OFFERING_LABELS, PROHIBITED_PHRASES } from '../types/index.js';
import * as api from '../api/client.js';

interface JudgmentFormProps {
  job: Job;
  onSubmitted: () => void;
}

type FieldDef = { key: string; label: string; type: 'text' | 'textarea' | 'select' | 'number' | 'list'; options?: string[] };

const CONTENT_LABELS = ['Content A', 'Content B', 'Content C', 'Content D'];

function normalizeContentUrls(requirements: Record<string, unknown>): string[] {
  if (Array.isArray(requirements.contentUrls) && requirements.contentUrls.length > 0) {
    return requirements.contentUrls as string[];
  }
  if (typeof requirements.contentUrl === 'string' && requirements.contentUrl) {
    return [requirements.contentUrl];
  }
  return [];
}

function buildCreativeCompareFields(contentUrls: string[]): FieldDef[] {
  const winnerOptions = contentUrls.map((_, i) => CONTENT_LABELS[i]).filter(Boolean);
  return [
    { key: 'winner', label: 'Winner', type: 'select', options: winnerOptions },
    { key: 'rankings', label: 'Rankings (one label per line, best first)', type: 'list' },
    { key: 'comparisonNotes', label: 'Comparison Notes', type: 'textarea' },
    { key: 'reasoning', label: 'Reasoning', type: 'textarea' },
  ];
}

const CREATIVE_FEEDBACK_FIELDS: FieldDef[] = [
  { key: 'verdict', label: 'Verdict', type: 'textarea' },
  { key: 'qualityScore', label: 'Quality Score (0-10)', type: 'number' },
  { key: 'originality', label: 'Originality Assessment', type: 'textarea' },
  { key: 'technicalMerit', label: 'Technical Merit', type: 'textarea' },
  { key: 'reasoning', label: 'Overall Reasoning', type: 'textarea' },
  { key: 'improvements', label: 'Suggested Improvements (one per line)', type: 'list' },
];

const OFFERING_FIELDS: Record<OfferingType, FieldDef[]> = {
  vibes_check: [
    { key: 'verdict', label: 'Verdict', type: 'select', options: ['genuine', 'suspicious', 'manufactured', 'mixed'] },
    { key: 'confidence', label: 'Confidence (0-1)', type: 'number' },
    { key: 'reasoning', label: 'Reasoning', type: 'textarea' },
    { key: 'redFlags', label: 'Red Flags (one per line)', type: 'list' },
    { key: 'positiveSignals', label: 'Positive Signals (one per line)', type: 'list' },
    { key: 'expertDomain', label: 'Your Domain Expertise', type: 'select', options: ['crypto', 'community', 'narrative', 'general'] },
  ],
  narrative: [
    { key: 'verdict', label: 'Verdict', type: 'textarea' },
    { key: 'confidence', label: 'Confidence (0-1)', type: 'number' },
    { key: 'reasoning', label: 'Reasoning', type: 'textarea' },
    { key: 'timeHorizon', label: 'Time Horizon', type: 'text' },
    { key: 'catalysts', label: 'Catalysts (one per line)', type: 'list' },
  ],
  creative_review: CREATIVE_FEEDBACK_FIELDS, // default; overridden dynamically
  community_sentiment: [
    { key: 'sentiment', label: 'Sentiment', type: 'text' },
    { key: 'authenticity', label: 'Authenticity', type: 'text' },
    { key: 'activityLevel', label: 'Activity Level', type: 'text' },
    { key: 'reasoning', label: 'Reasoning', type: 'textarea' },
    { key: 'comparisons', label: 'Comparisons (one per line)', type: 'list' },
  ],
  general: [
    { key: 'answer', label: 'Answer', type: 'textarea' },
    { key: 'confidence', label: 'Confidence (0-1)', type: 'number' },
    { key: 'reasoning', label: 'Reasoning', type: 'textarea' },
    { key: 'caveats', label: 'Caveats (one per line)', type: 'list' },
  ],
};

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|bmp|avif)(\?.*)?$/i;
const URL_PATTERN = /https?:\/\/[^\s"'<>]+/g;

function isImageUrl(url: string): boolean {
  return IMAGE_EXT.test(url);
}

function RequirementsView({ requirements }: { requirements: Record<string, unknown> }) {
  if (!requirements || Object.keys(requirements).length === 0) {
    return <p className="text-sm text-grey">No details provided.</p>;
  }

  const renderValue = (value: unknown): React.ReactNode => {
    if (value == null) return <span className="text-grey">—</span>;

    if (Array.isArray(value)) {
      return (
        <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
          {value.map((item, i) => (
            <li key={i}>{renderValue(item)}</li>
          ))}
        </ul>
      );
    }

    if (typeof value === 'string') {
      // Check if the entire value is a single URL
      const trimmed = value.trim();
      if (/^https?:\/\//.test(trimmed) && !trimmed.includes(' ')) {
        if (isImageUrl(trimmed)) {
          return (
            <div style={{ marginTop: 4 }}>
              <a href={trimmed} target="_blank" rel="noopener noreferrer" className="text-sm">
                {trimmed}
              </a>
              <img
                src={trimmed}
                alt="Content for review"
                style={{ display: 'block', marginTop: 8, maxWidth: '100%', maxHeight: 400, borderRadius: 8, border: '1px solid var(--color-grey-5)' }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
          );
        }
        return (
          <a href={trimmed} target="_blank" rel="noopener noreferrer">
            {trimmed}
          </a>
        );
      }

      // Check if the string contains embedded URLs
      const matches = trimmed.match(URL_PATTERN);
      if (matches) {
        const parts: React.ReactNode[] = [];
        let lastIndex = 0;
        for (const match of matches) {
          const idx = trimmed.indexOf(match, lastIndex);
          if (idx > lastIndex) {
            parts.push(trimmed.slice(lastIndex, idx));
          }
          parts.push(
            <a key={idx} href={match} target="_blank" rel="noopener noreferrer">
              {match}
            </a>
          );
          lastIndex = idx + match.length;
        }
        if (lastIndex < trimmed.length) {
          parts.push(trimmed.slice(lastIndex));
        }

        // Also render image previews for any image URLs found
        const imageUrls = matches.filter(isImageUrl);
        return (
          <>
            <span>{parts}</span>
            {imageUrls.map((url, i) => (
              <img
                key={i}
                src={url}
                alt="Content for review"
                style={{ display: 'block', marginTop: 8, maxWidth: '100%', maxHeight: 400, borderRadius: 8, border: '1px solid var(--color-grey-5)' }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ))}
          </>
        );
      }

      return <span>{value}</span>;
    }

    if (typeof value === 'object') {
      return (
        <pre className="text-sm" style={{ margin: '4px 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {JSON.stringify(value, null, 2)}
        </pre>
      );
    }

    return <span>{String(value)}</span>;
  };

  const formatKey = (key: string): string =>
    key.replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' ').replace(/^\w/, c => c.toUpperCase()).trim();

  const contentUrls = normalizeContentUrls(requirements);
  // Keys handled specially — skip in generic loop
  const skipKeys = contentUrls.length > 0 ? new Set(['contentUrl', 'contentUrls']) : new Set<string>();

  return (
    <div style={{ marginTop: 8 }}>
      {contentUrls.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <strong className="text-sm" style={{ color: 'var(--color-grey-3)' }}>
            {contentUrls.length === 1 ? 'Content' : 'Content Items'}:
          </strong>
          {contentUrls.map((url, i) => (
            <div key={i} style={{ marginTop: 8, paddingLeft: contentUrls.length > 1 ? 8 : 0, borderLeft: contentUrls.length > 1 ? '3px solid var(--color-grey-5)' : 'none' }}>
              {contentUrls.length > 1 && (
                <span className="text-sm" style={{ fontWeight: 600, color: 'var(--color-grey-3)', marginRight: 8 }}>
                  {CONTENT_LABELS[i]}
                </span>
              )}
              <div className="text-sm" style={{ marginTop: 2 }}>{renderValue(url)}</div>
            </div>
          ))}
        </div>
      )}
      {Object.entries(requirements).filter(([key]) => !skipKeys.has(key)).map(([key, value]) => (
        <div key={key} style={{ marginBottom: 8 }}>
          <strong className="text-sm" style={{ color: 'var(--color-grey-3)' }}>{formatKey(key)}:</strong>
          <div className="text-sm" style={{ marginTop: 2 }}>{renderValue(value)}</div>
        </div>
      ))}
    </div>
  );
}

function checkProhibitedLanguage(text: string): string | null {
  const lower = text.toLowerCase();
  for (const phrase of PROHIBITED_PHRASES) {
    if (lower.includes(phrase)) {
      return `Contains prohibited phrase: "${phrase}". Use qualitative language only — no investment advice.`;
    }
  }
  return null;
}

function getCreativeFields(requirements: Record<string, unknown>): FieldDef[] {
  const reviewType = (requirements.reviewType as string) ?? 'feedback';
  if (reviewType === 'compare') {
    const urls = normalizeContentUrls(requirements);
    return buildCreativeCompareFields(urls.length > 1 ? urls : ['', '']); // at least 2 options
  }
  return CREATIVE_FEEDBACK_FIELDS;
}

export function JudgmentForm({ job, onSubmitted }: JudgmentFormProps) {
  const fields = job.offeringType === 'creative_review'
    ? getCreativeFields(job.requirements)
    : (OFFERING_FIELDS[job.offeringType] ?? OFFERING_FIELDS.general);
  const [values, setValues] = useState<Record<string, string>>({});
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const updateField = (key: string, value: string) => {
    setValues(prev => ({ ...prev, [key]: value }));
    const langError = checkProhibitedLanguage(value);
    if (langError) {
      setError(langError);
    } else if (error?.startsWith('Contains prohibited')) {
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!disclaimerAccepted) {
      setError('You must accept the disclaimer before submitting.');
      return;
    }

    const content: Record<string, unknown> = {};
    for (const field of fields) {
      const raw = values[field.key] ?? '';
      if (field.type === 'number') {
        content[field.key] = parseFloat(raw) || 0;
      } else if (field.type === 'list') {
        content[field.key] = raw.split('\n').map(s => s.trim()).filter(Boolean);
      } else {
        content[field.key] = raw;
      }
    }

    const allText = JSON.stringify(content);
    const langError = checkProhibitedLanguage(allText);
    if (langError) {
      setError(langError);
      return;
    }

    setSubmitting(true);
    const res = await api.submitJudgment(job.id, content);

    if (res.success) {
      onSubmitted();
    } else {
      setError(res.error ?? 'Failed to submit judgment');
    }
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="card">
      <h3>Submit Judgment</h3>
      <p className="text-sm text-grey mb-lg">{OFFERING_LABELS[job.offeringType]}</p>

      <div className="card mb-lg" style={{ background: 'var(--color-grey-7)', border: '1px solid var(--color-grey-5)' }}>
        <strong className="text-sm">Request Details</strong>
        <RequirementsView requirements={job.requirements} />
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {fields.map(field => (
        <div key={field.key} className="form-group">
          <label className="form-label">{field.label}</label>
          {field.type === 'select' ? (
            <select
              value={values[field.key] ?? ''}
              onChange={e => updateField(field.key, e.target.value)}
              required
              className="input input-full"
            >
              <option value="">Select...</option>
              {field.options?.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ) : field.type === 'textarea' || field.type === 'list' ? (
            <textarea
              value={values[field.key] ?? ''}
              onChange={e => updateField(field.key, e.target.value)}
              required={field.type !== 'list'}
              rows={field.type === 'list' ? 4 : 3}
              placeholder={field.type === 'list' ? 'One item per line' : ''}
              className="input input-full"
            />
          ) : field.type === 'number' ? (
            <input
              type="number"
              step="0.01"
              min="0"
              max={field.label.includes('0-10') ? '10' : '1'}
              value={values[field.key] ?? ''}
              onChange={e => updateField(field.key, e.target.value)}
              required
              className="input input-full"
            />
          ) : (
            <input
              type="text"
              value={values[field.key] ?? ''}
              onChange={e => updateField(field.key, e.target.value)}
              required
              className="input input-full"
            />
          )}
        </div>
      ))}

      <div className="disclaimer-box mb-lg">
        <label className="flex items-center gap-sm" style={{ cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={disclaimerAccepted}
            onChange={e => setDisclaimerAccepted(e.target.checked)}
            style={{ marginTop: 2 }}
          />
          <span className="text-sm">
            I confirm this is my qualitative opinion only, not financial, investment, legal, or professional advice.
            I understand this opinion will be delivered to an AI agent and attributed to my public expert profile.
          </span>
        </label>
      </div>

      <button
        type="submit"
        disabled={submitting || !disclaimerAccepted}
        className="btn btn-primary"
      >
        {submitting ? 'Submitting...' : 'Submit Judgment'}
      </button>
    </form>
  );
}
