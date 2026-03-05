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
    summary: '$VIRTUAL on Base appears legitimate. The Virtuals Protocol team is publicly known, the project has significant traction ($470M+ cumulative GDP), and the token has deep liquidity on major DEXs. Community engagement is organic with active Discord and Twitter presence.',
    keyFindings: 'Team is publicly identified and has spoken at major crypto conferences\nSmart contracts audited — protocol handles real transaction volume\nToken listed on multiple CEXs with healthy trading volume\nActive developer ecosystem with 18,000+ agents built on the platform',
    redFlags: 'Token concentration — top wallets hold a significant percentage of supply\nRapid ecosystem growth makes it hard to verify all agent claims independently',
    positiveSignals: 'Real product with measurable usage (agent GDP, ACP transactions)\nStrong Base chain ecosystem integration\nTransparent protocol mechanics — agent creation and commerce are on-chain',
  },
  output_quality_gate: {
    qualityVerdict: 'needs_revision',
    qualityScore: '6',
    summary: 'The $ETH market analysis has directionally reasonable observations but makes overly specific claims without sufficient sourcing. The bullish divergence on 4H RSI is plausible but the price target and whale accumulation claim need verification.',
    issuesFound: 'The 12% whale wallet increase claim lacks a source — which analytics platform?\nPrice target of $4,500 "by end of month" is too specific without confidence intervals\n"Bullish divergence on 4H RSI" is correct terminology but should specify the exact RSI values',
    suggestedImprovements: 'Add source for whale wallet data (e.g., Nansen, Arkham, or on-chain data)\nReframe price target as a range with caveats rather than a single number\nInclude risk factors and bearish scenarios for balance',
  },
  option_ranking: {
    topPick: 'Option A — Quit and start fresh',
    summary: 'Quitting is the only option that preserves your dignity and mental health. Trying to get fired is risky and stressful, and keying the car is a felony. A clean exit lets you leave on your own terms with references intact.',
    rankings: 'A — Quit your job (cleanest exit, preserves references and self-respect)\nB — Try to get fired (risky — could backfire, unemployment not guaranteed)\nC — Key the boss\'s car (cathartic for 5 seconds, felony for the rest of your life)',
    tradeoffs: 'Quitting (A) means no unemployment benefits but you control the narrative and timing\nGetting fired (B) might get you unemployment but could result in a "terminated for cause" record that follows you\nKeying the car (C) is criminal property damage — potential arrest, lawsuit, and a record that makes future employment harder',
  },
  content_quality_gate: {
    verdict: 'needs_changes',
    culturalSensitivityScore: '6',
    brandSafetyScore: '4',
    summary: 'This tweet reads like a textbook crypto scam announcement. The vague "MAJOR exchange" partnership, urgency around token launch, promise of rewards for "early supporters," and Telegram funnel are all patterns associated with rug pulls. Needs significant revision before publishing.',
    flaggedIssues: '"MAJOR exchange" without naming it — looks like fabricated hype\n"Early supporters will be rewarded" — implies guaranteed returns, potentially securities violation\nTelegram funnel for "alpha" — associated with pump-and-dump schemes\nFire and rocket emojis reinforce scammy perception\nNo substance or verifiable claims in the entire tweet',
  },
  audience_reaction_poll: {
    overallRating: '7',
    summary: 'The thumbnail concept is attention-grabbing and the tax anxiety angle is relatable for crypto holders. The "IRS Is Watching Your Wallet" title creates urgency. However, it risks being perceived as fearmongering rather than helpful, which could hurt click-through from viewers seeking practical advice.',
    criteriaScores: 'Clickability: 8 — the IRS angle creates strong curiosity and urgency\nClarity: 7 — immediately clear what the video is about\nClickbait level: 6 — borderline too sensational, but acceptable for YouTube crypto\nEmotional hook: 8 — tax anxiety is a powerful motivator\nTrust factor: 5 — confused person visual may undermine credibility',
    comparisonNotes: 'Similar "IRS watching" thumbnails have performed well for channels like Coin Bureau and BitBoy (before rebrand). The confused person trope is overused — a more unique visual (e.g., wallet with eyes on it, or a split-screen of portfolio vs tax form) could differentiate.',
  },
  creative_direction_check: {
    verdict: 'proceed',
    viabilityScore: '8',
    summary: 'The satirical "financial advisor shiba inu" concept is well-suited for crypto Twitter. Self-aware humor about bad financial advice is a proven format in the space (see: degen meme culture). The concept has strong viral potential if executed with the right tone.',
    culturalFlags: 'Avoid any memes that could be read as genuine financial advice — even satirically, regulators are watching\n"Financial advisor" framing should be clearly absurd to avoid compliance issues\nDog-token space has some fatigue — need to feel fresh, not derivative of DOGE/SHIB marketing',
    tonalAlignment: 'The satirical "bad advice" angle fits crypto Twitter humor perfectly — the community loves self-deprecating degen humor. The shiba in a suit visual is strong. Key is making the advice obviously terrible (e.g., "buy the top, sell the bottom") rather than ambiguously bad. Lean into absurdity over subtlety.',
  },
  fact_check_verification: {
    overallAccuracy: 'medium',
    claimsChecked: '3',
    summary: 'Two of three claims are approximately correct but need updated figures. The ACP launch timeline claim is inaccurate. Overall the report cites real metrics but some numbers appear to be from older sources.',
    flaggedClaims: '"$470M in cumulative agent GDP" — this figure has been cited by Virtuals Protocol but is self-reported and methodology is unclear. Recommend adding "according to Virtuals Protocol" qualifier\n"18,000+ autonomous AI agents" — figure appears to include all registered agents, not just active ones. Many may be dormant or test deployments\n"ACP marketplace launched in Q4 2025" — ACP was announced in late 2025 but the full marketplace launch with agent-to-agent commerce rolled out in early 2026',
    corrections: 'Add attribution: "$470M in cumulative agent GDP (per Virtuals Protocol)"\nClarify: "18,000+ registered agents" rather than "autonomous AI agents" — distinguish active from registered\nCorrect timeline: ACP was announced Q4 2025 with phased rollout into Q1 2026',
  },
  dispute_arbitration: {
    verdict: 'approve',
    reasoning: 'The service provider delivered all agreed-upon items listed in the original scope. While the client claims the quality was below expectations, the deliverables meet the objective criteria specified in the contract. The style guide was followed, deadlines were met, and revision rounds were completed as agreed.',
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
  const [drafting, setDrafting] = useState(false);
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

  const handleAiDraft = async () => {
    setDrafting(true);
    setError(null);
    try {
      const res = await api.getAiDraft(session.id);
      if (res.success && res.data) {
        setValues(res.data as Record<string, string>);
      } else {
        setError(res.error ?? 'AI draft failed');
      }
    } catch {
      setError('AI draft request failed');
    }
    setDrafting(false);
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
    try {
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
    } catch {
      setError('Network error — please check your connection and try again');
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
          background: 'rgba(239, 68, 68, 0.1)', color: '#F87171', padding: '8px 12px',
          borderRadius: 6, fontSize: 13, marginBottom: 16,
        }}>
          {error}
        </div>
      )}

      {/* Quick fill buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={handleAiDraft}
          disabled={drafting}
          className="btn btn-ghost"
          style={{ fontSize: 12, color: '#A78BFA' }}
        >
          {drafting ? 'Drafting...' : 'AI Draft'}
        </button>
        {TEST_DATA[session.offeringType] && (
          <button
            type="button"
            onClick={() => setValues(TEST_DATA[session.offeringType])}
            className="btn btn-ghost"
            style={{ fontSize: 12, color: '#2DD4BF' }}
          >
            Fill with test data
          </button>
        )}
        {session.followupOf && FOLLOWUP_TEST_DATA[session.offeringType] && (
          <button
            type="button"
            onClick={() => setValues(FOLLOWUP_TEST_DATA[session.offeringType])}
            className="btn btn-ghost"
            style={{ fontSize: 12, color: '#5EEAD4' }}
          >
            Fill follow-up (issues resolved)
          </button>
        )}
      </div>

      {/* Dynamic fields */}
      {fields.map(field => (
        <div key={field.key} style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#E8E2DA', marginBottom: 4 }}>
            {field.label} {field.required && <span style={{ color: '#F472B6' }}>*</span>}
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
                <option key={opt} value={opt}>{opt.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
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
                color: '#2DD4BF', background: 'rgba(45, 212, 191, 0.12)', borderRadius: 6, padding: '2px 6px',
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
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#E8E2DA', marginBottom: 4 }}>
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
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#E8E2DA', marginBottom: 6 }}>
          Evidence & Attachments
        </label>

        {attachments.length > 0 && (
          <div style={{ marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {attachments.map(att => (
              <div key={att.id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 10px', background: '#1E1E22', borderRadius: 6,
                border: '1px solid #2A2A2E', fontSize: 12,
              }}>
                <span style={{ color: '#7A7670' }}>
                  {att.mimeType.startsWith('image/') ? '\uD83D\uDDBC\uFE0F' : '\uD83D\uDCC4'}
                </span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#E8E2DA' }}>
                  {att.originalFilename}
                </span>
                <span style={{ color: '#7A7670', flexShrink: 0 }}>{formatSize(att.fileSizeBytes)}</span>
                <span style={{
                  fontSize: 10, padding: '1px 5px', borderRadius: 4,
                  background: att.uploadContext === 'chat' ? 'rgba(45, 212, 191, 0.12)' : 'rgba(244, 114, 182, 0.12)',
                  color: att.uploadContext === 'chat' ? '#2DD4BF' : '#F472B6',
                }}>
                  {att.uploadContext}
                </span>
              </div>
            ))}
          </div>
        )}

        <label style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '10px 16px', border: '2px dashed #2A2A2E', borderRadius: 8,
          cursor: uploading ? 'wait' : 'pointer', color: '#7A7670', fontSize: 13,
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
        <div style={{ fontSize: 11, color: '#7A7670', marginTop: 4 }}>
          Max 5MB per file, 20MB total per session
        </div>
      </div>

      {/* Actions */}
      <div style={{
        display: 'flex', gap: 8,
        justifyContent: inline ? 'space-between' : 'flex-end',
        borderTop: '1px solid #2A2A2E', paddingTop: 16,
      }}>
        {inline && onDecline ? (
          <button type="button" onClick={onDecline} className="btn btn-ghost" style={{ fontSize: 13, color: 'var(--color-error, #EF4444)' }}>
            Decline
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
          {submitting ? 'Submitting...' : 'Submit'}
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
        background: '#161618', borderRadius: 12, maxWidth: 560, width: '100%',
        maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        border: '1px solid #2A2A2E',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid #2A2A2E',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          position: 'sticky', top: 0, background: '#161618', zIndex: 1, borderRadius: '12px 12px 0 0',
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, color: '#E8E2DA' }}>Complete Session</h3>
            <div style={{ fontSize: 12, color: '#7A7670', marginTop: 2 }}>
              {session.offeringType.replace(/_/g, ' ')} &middot; ${session.priceUsdc.toFixed(0)} USDC
            </div>
          </div>
          {onCancel && (
            <button onClick={onCancel} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 20, color: '#7A7670', padding: 4, lineHeight: 1,
            }}>&times;</button>
          )}
        </div>

        {formContent}
      </div>
    </div>
  );
}
