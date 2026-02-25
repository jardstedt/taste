import { useState, useEffect } from 'react';
import * as api from '../api/client.js';
import type { Session, SessionAttachment } from '../types/index.js';

// ── Field Definitions (mirrors server/src/config/deliverable-schemas.ts) ──

interface DeliverableFieldDef {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'number' | 'rating';
  required: boolean;
  options?: string[];
  min?: number;
  max?: number;
  placeholder?: string;
}

const trustEvaluationFields: DeliverableFieldDef[] = [
  { key: 'verdict', label: 'Verdict', type: 'select', required: true, options: ['legitimate', 'suspicious', 'scam', 'inconclusive'] },
  { key: 'confidenceScore', label: 'Confidence Score (1-10)', type: 'rating', required: true, min: 1, max: 10 },
  { key: 'summary', label: 'Summary', type: 'textarea', required: true, placeholder: 'Brief summary of your assessment' },
  { key: 'keyFindings', label: 'Key Findings', type: 'textarea', required: false, placeholder: 'One finding per line' },
  { key: 'redFlags', label: 'Red Flags', type: 'textarea', required: false, placeholder: 'One red flag per line' },
  { key: 'positiveSignals', label: 'Positive Signals', type: 'textarea', required: false, placeholder: 'One signal per line' },
];

const outputQualityGateFields: DeliverableFieldDef[] = [
  { key: 'qualityVerdict', label: 'Quality Verdict', type: 'select', required: true, options: ['approved', 'needs_revision', 'rejected'] },
  { key: 'qualityScore', label: 'Quality Score (1-10)', type: 'rating', required: true, min: 1, max: 10 },
  { key: 'summary', label: 'Summary', type: 'textarea', required: true, placeholder: 'Summary of quality assessment' },
  { key: 'issuesFound', label: 'Issues Found', type: 'textarea', required: false, placeholder: 'One issue per line' },
  { key: 'suggestedImprovements', label: 'Suggested Improvements', type: 'textarea', required: false, placeholder: 'One suggestion per line' },
];

const optionRankingFields: DeliverableFieldDef[] = [
  { key: 'topPick', label: 'Top Pick', type: 'text', required: true, placeholder: 'Your recommended option' },
  { key: 'summary', label: 'Summary', type: 'textarea', required: true, placeholder: 'Why this ranking' },
  { key: 'rankings', label: 'Rankings', type: 'textarea', required: true, placeholder: 'One option per line, best first' },
  { key: 'tradeoffs', label: 'Tradeoffs', type: 'textarea', required: false, placeholder: 'Key tradeoffs between options' },
];

const contentQualityGateFields: DeliverableFieldDef[] = [
  { key: 'verdict', label: 'Verdict', type: 'select', required: true, options: ['safe', 'needs_changes', 'do_not_publish'] },
  { key: 'culturalSensitivityScore', label: 'Cultural Sensitivity (1-10)', type: 'rating', required: true, min: 1, max: 10 },
  { key: 'brandSafetyScore', label: 'Brand Safety (1-10)', type: 'rating', required: true, min: 1, max: 10 },
  { key: 'summary', label: 'Summary', type: 'textarea', required: true, placeholder: 'Content review summary' },
  { key: 'flaggedIssues', label: 'Flagged Issues', type: 'textarea', required: false, placeholder: 'One issue per line' },
];

const audienceReactionPollFields: DeliverableFieldDef[] = [
  { key: 'overallRating', label: 'Overall Rating (1-10)', type: 'rating', required: true, min: 1, max: 10 },
  { key: 'summary', label: 'Summary', type: 'textarea', required: true, placeholder: 'Audience reaction summary' },
  { key: 'criteriaScores', label: 'Criteria Scores', type: 'textarea', required: false, placeholder: 'One criterion: score per line' },
  { key: 'comparisonNotes', label: 'Comparison Notes', type: 'textarea', required: false, placeholder: 'Notes comparing with similar content' },
];

const creativeDirectionCheckFields: DeliverableFieldDef[] = [
  { key: 'verdict', label: 'Verdict', type: 'select', required: true, options: ['proceed', 'revise', 'abandon'] },
  { key: 'viabilityScore', label: 'Viability Score (1-10)', type: 'rating', required: true, min: 1, max: 10 },
  { key: 'summary', label: 'Summary', type: 'textarea', required: true, placeholder: 'Creative direction assessment' },
  { key: 'culturalFlags', label: 'Cultural Flags', type: 'textarea', required: false, placeholder: 'Cultural concerns, one per line' },
  { key: 'tonalAlignment', label: 'Tonal Alignment', type: 'textarea', required: false, placeholder: 'How well does the tone match the target?' },
];

const fallbackFields: DeliverableFieldDef[] = [
  { key: 'summary', label: 'Summary', type: 'textarea', required: true, placeholder: 'Summarize your assessment' },
  { key: 'verdict', label: 'Verdict', type: 'text', required: false, placeholder: 'Your overall verdict (optional)' },
  { key: 'keyFindings', label: 'Key Findings', type: 'textarea', required: false, placeholder: 'One finding per line' },
];

const DELIVERABLE_SCHEMAS: Record<string, DeliverableFieldDef[]> = {
  trust_evaluation: trustEvaluationFields,
  output_quality_gate: outputQualityGateFields,
  option_ranking: optionRankingFields,
  content_quality_gate: contentQualityGateFields,
  audience_reaction_poll: audienceReactionPollFields,
  creative_direction_check: creativeDirectionCheckFields,
};

function getFields(offeringType: string): DeliverableFieldDef[] {
  return DELIVERABLE_SCHEMAS[offeringType] ?? fallbackFields;
}

// ── Component ──

interface CompletionFormProps {
  session: Session;
  onComplete: () => void;
  onCancel: () => void;
}

export function CompletionForm({ session, onComplete, onCancel }: CompletionFormProps) {
  const fields = getFields(session.offeringType);
  const [values, setValues] = useState<Record<string, string>>({});
  const [summaryText, setSummaryText] = useState('');
  const [attachments, setAttachments] = useState<SessionAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing attachments
  useEffect(() => {
    api.getSessionAttachments(session.id).then(res => {
      if (res.success && res.data) {
        setAttachments(res.data as SessionAttachment[]);
      }
    });
  }, [session.id]);

  const updateField = (key: string, value: string) => {
    setValues(prev => ({ ...prev, [key]: value }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);

    for (const file of Array.from(files)) {
      const res = await api.uploadAttachment(session.id, file, 'completion');
      if (res.success && res.data) {
        setAttachments(prev => [...prev, res.data as SessionAttachment]);
      } else {
        setError(res.error ?? 'Upload failed');
      }
    }

    setUploading(false);
    e.target.value = ''; // Reset input
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Check required fields
    for (const field of fields) {
      if (field.required && !values[field.key]?.trim()) {
        setError(`"${field.label}" is required`);
        return;
      }
    }

    // Build structured data
    const structuredData: Record<string, unknown> = {};
    for (const field of fields) {
      const raw = values[field.key] ?? '';
      if (!raw.trim() && !field.required) continue;
      if (field.type === 'rating' || field.type === 'number') {
        structuredData[field.key] = parseFloat(raw) || 0;
      } else {
        structuredData[field.key] = raw;
      }
    }

    setSubmitting(true);
    const res = await api.completeSession(session.id, {
      structuredData,
      summary: summaryText || undefined,
    });

    if (res.success) {
      onComplete();
    } else {
      setError(res.error ?? 'Failed to complete session');
      setSubmitting(false);
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, maxWidth: 560, width: '100%',
        maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid #E5E7EB',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          position: 'sticky', top: 0, background: '#fff', zIndex: 1, borderRadius: '12px 12px 0 0',
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16 }}>Complete Session</h3>
            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
              {session.offeringType.replace(/_/g, ' ')} &middot; ${session.priceUsdc.toFixed(0)} USDC
            </div>
          </div>
          <button onClick={onCancel} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 20, color: '#9CA3AF', padding: 4, lineHeight: 1,
          }}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 20 }}>
          {error && (
            <div style={{
              background: '#FEF2F2', color: '#DC2626', padding: '8px 12px',
              borderRadius: 6, fontSize: 13, marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          {/* Dynamic fields */}
          {fields.map(field => (
            <div key={field.key} style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                {field.label} {field.required && <span style={{ color: '#DC2626' }}>*</span>}
              </label>
              {field.type === 'select' ? (
                <select
                  value={values[field.key] ?? ''}
                  onChange={e => updateField(field.key, e.target.value)}
                  required={field.required}
                  className="input input-full"
                  style={{ fontSize: 13 }}
                >
                  <option value="">Select...</option>
                  {field.options?.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : field.type === 'textarea' ? (
                <textarea
                  value={values[field.key] ?? ''}
                  onChange={e => updateField(field.key, e.target.value)}
                  required={field.required}
                  rows={3}
                  placeholder={field.placeholder}
                  className="input input-full"
                  style={{ fontSize: 13, resize: 'vertical' }}
                />
              ) : field.type === 'rating' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="range"
                    min={field.min ?? 1}
                    max={field.max ?? 10}
                    step={1}
                    value={values[field.key] ?? String(field.min ?? 1)}
                    onChange={e => updateField(field.key, e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <span style={{
                    minWidth: 28, textAlign: 'center', fontSize: 14, fontWeight: 700,
                    color: '#6B21A8', background: '#F3E8FF', borderRadius: 6, padding: '2px 6px',
                  }}>
                    {values[field.key] || field.min || 1}
                  </span>
                </div>
              ) : field.type === 'number' ? (
                <input
                  type="number"
                  min={field.min}
                  max={field.max}
                  step="0.1"
                  value={values[field.key] ?? ''}
                  onChange={e => updateField(field.key, e.target.value)}
                  required={field.required}
                  placeholder={field.placeholder}
                  className="input input-full"
                  style={{ fontSize: 13 }}
                />
              ) : (
                <input
                  type="text"
                  value={values[field.key] ?? ''}
                  onChange={e => updateField(field.key, e.target.value)}
                  required={field.required}
                  placeholder={field.placeholder}
                  className="input input-full"
                  style={{ fontSize: 13 }}
                />
              )}
            </div>
          ))}

          {/* Summary */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
              Additional Notes
            </label>
            <textarea
              value={summaryText}
              onChange={e => setSummaryText(e.target.value)}
              rows={2}
              placeholder="Any additional context or notes (optional)"
              className="input input-full"
              style={{ fontSize: 13, resize: 'vertical' }}
            />
          </div>

          {/* Attachments */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Evidence & Attachments
            </label>

            {attachments.length > 0 && (
              <div style={{ marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {attachments.map(att => (
                  <div key={att.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 10px', background: '#F9FAFB', borderRadius: 6,
                    border: '1px solid #E5E7EB', fontSize: 12,
                  }}>
                    <span style={{ color: '#6B7280' }}>
                      {att.mimeType.startsWith('image/') ? '\uD83D\uDDBC\uFE0F' : '\uD83D\uDCC4'}
                    </span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {att.originalFilename}
                    </span>
                    <span style={{ color: '#9CA3AF', flexShrink: 0 }}>{formatSize(att.fileSizeBytes)}</span>
                    <span style={{
                      fontSize: 10, padding: '1px 5px', borderRadius: 4,
                      background: att.uploadContext === 'chat' ? '#DBEAFE' : '#F3E8FF',
                      color: att.uploadContext === 'chat' ? '#1D4ED8' : '#6B21A8',
                    }}>
                      {att.uploadContext}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <label style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '10px 16px', border: '2px dashed #D1D5DB', borderRadius: 8,
              cursor: uploading ? 'wait' : 'pointer', color: '#6B7280', fontSize: 13,
              transition: 'border-color 0.15s',
            }}>
              <input
                type="file"
                multiple
                accept="image/png,image/jpeg,image/gif,image/webp,application/pdf,text/plain"
                onChange={handleFileUpload}
                disabled={uploading}
                style={{ display: 'none' }}
              />
              {uploading ? 'Uploading...' : '+ Add files (images, PDF, text)'}
            </label>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>
              Max 5MB per file, 20MB total per session
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px solid #E5E7EB', paddingTop: 16 }}>
            <button type="button" onClick={onCancel} className="btn btn-ghost" style={{ fontSize: 13 }}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary"
              style={{ fontSize: 13 }}
            >
              {submitting ? 'Completing...' : 'Complete Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
