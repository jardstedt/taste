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

const factCheckVerificationFields: DeliverableFieldDef[] = [
  { key: 'overallAccuracy', label: 'Overall Accuracy', type: 'select', required: true, options: ['high', 'medium', 'low'] },
  { key: 'claimsChecked', label: 'Claims Checked', type: 'number', required: false, min: 0, max: 100 },
  { key: 'summary', label: 'Summary', type: 'textarea', required: true, placeholder: 'Summary of fact-check findings' },
  { key: 'flaggedClaims', label: 'Flagged Claims', type: 'textarea', required: false, placeholder: 'Claims that are inaccurate or misleading, one per line' },
  { key: 'corrections', label: 'Corrections', type: 'textarea', required: false, placeholder: 'Suggested corrections, one per line' },
];

const disputeArbitrationFields: DeliverableFieldDef[] = [
  { key: 'verdict', label: 'Verdict', type: 'select', required: true, options: ['approve', 'reject'] },
  { key: 'reasoning', label: 'Reasoning', type: 'textarea', required: true, placeholder: 'Detailed justification for your verdict' },
  { key: 'deliverableQuality', label: 'Deliverable Quality', type: 'select', required: false, options: ['excellent', 'adequate', 'poor', 'unacceptable'] },
  { key: 'contractAlignment', label: 'Contract Alignment', type: 'select', required: false, options: ['fully_met', 'partially_met', 'not_met'] },
  { key: 'summary', label: 'Summary', type: 'textarea', required: true, placeholder: 'Concise verdict summary for on-chain reason' },
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
  fact_check_verification: factCheckVerificationFields,
  dispute_arbitration: disputeArbitrationFields,
};

// Follow-up test data: positive "issues resolved" responses for second reviews
const FOLLOWUP_TEST_DATA: Record<string, Record<string, string>> = {
  content_quality_gate: {
    verdict: 'safe',
    culturalSensitivityScore: '9',
    brandSafetyScore: '9',
    summary: 'All previously flagged issues have been addressed. The revised content is culturally appropriate, brand-safe, and ready for publication.',
    flaggedIssues: '',
  },
  output_quality_gate: {
    qualityVerdict: 'approved',
    qualityScore: '9',
    summary: 'All issues from the previous review have been resolved. Structure is improved, links are fixed, and the content reads clearly.',
    issuesFound: '',
    suggestedImprovements: '',
  },
};

const TEST_DATA: Record<string, Record<string, string>> = {
  trust_evaluation: {
    verdict: 'legitimate',
    confidenceScore: '8',
    summary: 'The project shows strong fundamentals with verified team, audited contracts, and consistent community engagement over 6+ months.',
    keyFindings: 'Team fully doxxed with LinkedIn profiles\nSmart contract audited by CertiK\nActive Discord with 12k+ members\nRegular development updates on GitHub',
    redFlags: 'Token unlock schedule is aggressive in Q3\nSome promotional claims lack citations',
    positiveSignals: 'Transparent treasury management\nMulti-sig wallet with 3/5 signers\nPartnerships with established protocols',
  },
  output_quality_gate: {
    qualityVerdict: 'needs_revision',
    qualityScore: '6',
    summary: 'The content is factually accurate but lacks structure and has several grammatical issues that reduce readability.',
    issuesFound: 'Missing introduction section\nInconsistent heading hierarchy\nTwo broken hyperlinks in the references section',
    suggestedImprovements: 'Add executive summary at the top\nFix heading levels (H2 → H3 for subsections)\nReplace broken links or remove references',
  },
  option_ranking: {
    topPick: 'Option B — Hybrid staking model',
    summary: 'Option B balances yield potential with risk management. It avoids the lock-up concerns of Option A while providing better returns than Option C.',
    rankings: 'Option B — Hybrid staking model (best risk/reward)\nOption A — Full lock-up staking (highest yield but illiquid)\nOption C — Flexible staking (lowest risk, lowest returns)',
    tradeoffs: 'A offers 18% APY but 90-day lock-up may frustrate users\nB offers 12% APY with 7-day unstaking — good middle ground\nC offers 6% APY but instant withdrawal appeals to risk-averse users',
  },
  content_quality_gate: {
    verdict: 'needs_changes',
    culturalSensitivityScore: '7',
    brandSafetyScore: '8',
    summary: 'Content is largely brand-safe but uses a metaphor in paragraph 3 that could be misread in certain cultural contexts. Recommend rephrasing before publication.',
    flaggedIssues: 'Paragraph 3 metaphor ("crushing the competition") may read as aggressive in East Asian markets\nStock photo on slide 4 lacks demographic diversity',
  },
  audience_reaction_poll: {
    overallRating: '7',
    summary: 'The campaign concept resonates well with the 25-34 demographic but falls flat with older audiences. Visual style is strong; messaging needs refinement.',
    criteriaScores: 'Visual appeal: 9\nMessage clarity: 6\nCall-to-action strength: 7\nBrand alignment: 8\nEmotional impact: 5',
    comparisonNotes: 'Outperforms the Q4 campaign on visuals but underperforms on emotional hook. Similar engagement profile to Competitor X\'s recent launch.',
  },
  creative_direction_check: {
    verdict: 'revise',
    viabilityScore: '6',
    summary: 'The creative concept has potential but the current execution leans too heavily on irony, which may not translate well across the target markets.',
    culturalFlags: 'Sarcastic tone in headline may not translate to non-English markets\nColor palette (red + black) has negative connotations in some Southeast Asian cultures',
    tonalAlignment: 'Current tone is edgy/irreverent — brand guidelines call for "confident but approachable." Recommend softening the humor while keeping the bold visual style.',
  },
  fact_check_verification: {
    overallAccuracy: 'medium',
    claimsChecked: '12',
    summary: '9 of 12 claims verified accurate. Two claims use outdated statistics (2023 data cited as current), and one claim conflates correlation with causation.',
    flaggedClaims: '"Market grew 340% in 2024" — actual figure is 280% per CoinGecko\n"Users prefer decentralized options" — cited survey had 200 respondents, not statistically significant\n"Zero security incidents" — one minor incident was reported in August 2024',
    corrections: 'Update market growth figure to 280% with CoinGecko citation\nReframe user preference claim with proper sample size caveat\nChange "zero incidents" to "no major security incidents"',
  },
  dispute_arbitration: {
    verdict: 'approve',
    reasoning: 'The service provider delivered all 5 agreed-upon items listed in the original scope. While the client claims the quality was below expectations, the deliverables meet the objective criteria specified in the contract. The style guide was followed, deadlines were met, and revision rounds were completed as agreed.',
    deliverableQuality: 'adequate',
    contractAlignment: 'fully_met',
    summary: 'Deliverables meet contractual requirements. Dispute resolved in favor of the service provider.',
  },
};

function getFields(offeringType: string): DeliverableFieldDef[] {
  return DELIVERABLE_SCHEMAS[offeringType] ?? fallbackFields;
}

// ── Component ──

interface CompletionFormProps {
  session: Session;
  onComplete: () => void;
  onCancel?: () => void;
  inline?: boolean;
  onDecline?: () => void;
}

export function CompletionForm({ session, onComplete, onCancel, inline, onDecline }: CompletionFormProps) {
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

  const formContent = (
    <form onSubmit={handleSubmit} style={inline ? { padding: 0 } : { padding: 20 }}>
      {error && (
        <div style={{
          background: '#FEF2F2', color: '#DC2626', padding: '8px 12px',
          borderRadius: 6, fontSize: 13, marginBottom: 16,
        }}>
          {error}
        </div>
      )}

      {/* Fill with test data */}
      {TEST_DATA[session.offeringType] && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setValues(TEST_DATA[session.offeringType])}
            className="btn btn-ghost"
            style={{ fontSize: 12, color: '#6B21A8' }}
          >
            Fill with test data
          </button>
          {session.followupOf && FOLLOWUP_TEST_DATA[session.offeringType] && (
            <button
              type="button"
              onClick={() => setValues(FOLLOWUP_TEST_DATA[session.offeringType])}
              className="btn btn-ghost"
              style={{ fontSize: 12, color: '#059669' }}
            >
              Fill follow-up (issues resolved)
            </button>
          )}
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
      <div style={{
        display: 'flex', gap: 8,
        justifyContent: inline ? 'space-between' : 'flex-end',
        borderTop: '1px solid #E5E7EB', paddingTop: 16,
      }}>
        {inline && onDecline ? (
          <button type="button" onClick={onDecline} className="btn btn-ghost" style={{ fontSize: 13, color: 'var(--color-error, #DC2626)' }}>
            Can't Fulfill
          </button>
        ) : !inline && onCancel ? (
          <button type="button" onClick={onCancel} className="btn btn-ghost" style={{ fontSize: 13 }}>
            Cancel
          </button>
        ) : null}
        <button
          type="submit"
          disabled={submitting}
          className="btn btn-primary"
          style={{ fontSize: 13 }}
        >
          {submitting ? 'Submitting...' : 'Submit Assessment'}
        </button>
      </div>
    </form>
  );

  if (inline) {
    return formContent;
  }

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
          {onCancel && (
            <button onClick={onCancel} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 20, color: '#9CA3AF', padding: 4, lineHeight: 1,
            }}>&times;</button>
          )}
        </div>

        {formContent}
      </div>
    </div>
  );
}
