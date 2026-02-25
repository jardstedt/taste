import { z } from 'zod';

// ── Field Definition ──

export interface DeliverableFieldDef {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'number' | 'rating';
  required: boolean;
  options?: string[];
  min?: number;
  max?: number;
  placeholder?: string;
}

// ── Per-Offering Schemas ──

const trustEvaluationFields: DeliverableFieldDef[] = [
  { key: 'verdict', label: 'Verdict', type: 'select', required: true, options: ['legitimate', 'suspicious', 'scam', 'inconclusive'] },
  { key: 'confidenceScore', label: 'Confidence Score', type: 'rating', required: true, min: 1, max: 10 },
  { key: 'summary', label: 'Summary', type: 'textarea', required: true, placeholder: 'Brief summary of your assessment' },
  { key: 'keyFindings', label: 'Key Findings', type: 'textarea', required: false, placeholder: 'One finding per line' },
  { key: 'redFlags', label: 'Red Flags', type: 'textarea', required: false, placeholder: 'One red flag per line' },
  { key: 'positiveSignals', label: 'Positive Signals', type: 'textarea', required: false, placeholder: 'One signal per line' },
];

const outputQualityGateFields: DeliverableFieldDef[] = [
  { key: 'qualityVerdict', label: 'Quality Verdict', type: 'select', required: true, options: ['approved', 'needs_revision', 'rejected'] },
  { key: 'qualityScore', label: 'Quality Score', type: 'rating', required: true, min: 1, max: 10 },
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
  { key: 'culturalSensitivityScore', label: 'Cultural Sensitivity Score', type: 'rating', required: true, min: 1, max: 10 },
  { key: 'brandSafetyScore', label: 'Brand Safety Score', type: 'rating', required: true, min: 1, max: 10 },
  { key: 'summary', label: 'Summary', type: 'textarea', required: true, placeholder: 'Content review summary' },
  { key: 'flaggedIssues', label: 'Flagged Issues', type: 'textarea', required: false, placeholder: 'One issue per line' },
];

const audienceReactionPollFields: DeliverableFieldDef[] = [
  { key: 'overallRating', label: 'Overall Rating', type: 'rating', required: true, min: 1, max: 10 },
  { key: 'summary', label: 'Summary', type: 'textarea', required: true, placeholder: 'Audience reaction summary' },
  { key: 'criteriaScores', label: 'Criteria Scores', type: 'textarea', required: false, placeholder: 'One criterion: score per line' },
  { key: 'comparisonNotes', label: 'Comparison Notes', type: 'textarea', required: false, placeholder: 'Notes comparing with similar content' },
];

const creativeDirectionCheckFields: DeliverableFieldDef[] = [
  { key: 'verdict', label: 'Verdict', type: 'select', required: true, options: ['proceed', 'revise', 'abandon'] },
  { key: 'viabilityScore', label: 'Viability Score', type: 'rating', required: true, min: 1, max: 10 },
  { key: 'summary', label: 'Summary', type: 'textarea', required: true, placeholder: 'Creative direction assessment' },
  { key: 'culturalFlags', label: 'Cultural Flags', type: 'textarea', required: false, placeholder: 'Cultural concerns, one per line' },
  { key: 'tonalAlignment', label: 'Tonal Alignment', type: 'textarea', required: false, placeholder: 'How well does the tone match the target?' },
];

const fallbackFields: DeliverableFieldDef[] = [
  { key: 'summary', label: 'Summary', type: 'textarea', required: true, placeholder: 'Summarize your assessment' },
  { key: 'verdict', label: 'Verdict', type: 'text', required: false, placeholder: 'Your overall verdict (optional)' },
  { key: 'keyFindings', label: 'Key Findings', type: 'textarea', required: false, placeholder: 'One finding per line' },
];

// ── Schema Registry ──

const DELIVERABLE_SCHEMAS: Record<string, DeliverableFieldDef[]> = {
  trust_evaluation: trustEvaluationFields,
  output_quality_gate: outputQualityGateFields,
  option_ranking: optionRankingFields,
  content_quality_gate: contentQualityGateFields,
  audience_reaction_poll: audienceReactionPollFields,
  creative_direction_check: creativeDirectionCheckFields,
};

export function getDeliverableFields(offeringType: string): DeliverableFieldDef[] {
  return DELIVERABLE_SCHEMAS[offeringType] ?? fallbackFields;
}

export function getAllDeliverableSchemas(): Record<string, DeliverableFieldDef[]> {
  return { ...DELIVERABLE_SCHEMAS };
}

// ── Zod Validation ──

function fieldToZod(field: DeliverableFieldDef): z.ZodTypeAny {
  switch (field.type) {
    case 'rating':
    case 'number': {
      let schema = z.number();
      if (field.min !== undefined) schema = schema.min(field.min);
      if (field.max !== undefined) schema = schema.max(field.max);
      return field.required ? schema : schema.optional();
    }
    case 'select': {
      if (field.options && field.options.length > 0) {
        const enumSchema = z.enum(field.options as [string, ...string[]]);
        return field.required ? enumSchema : enumSchema.optional();
      }
      const strSchema = z.string().min(1);
      return field.required ? strSchema : strSchema.optional();
    }
    default: {
      const strSchema = field.required ? z.string().min(1) : z.string().optional();
      return strSchema;
    }
  }
}

export function buildZodSchema(offeringType: string): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const fields = getDeliverableFields(offeringType);
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of fields) {
    shape[field.key] = fieldToZod(field);
  }
  return z.object(shape).strip(); // strip unknown keys silently
}
