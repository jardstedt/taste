/**
 * Input requirement validation schemas per offering.
 * Used to reject invalid/incomplete jobs during the ACP REQUEST phase.
 *
 * Each offering defines:
 * - requiredFields: field names that MUST be present
 * - optionalFields: field names that are recognized but not required
 * - fieldValidators: per-field validation (enum values, types, constraints)
 */

export interface FieldValidator {
  type: 'string' | 'array' | 'enum';
  allowedValues?: string[];
  minItems?: number;
  minLength?: number;
}

export interface InputSchema {
  requiredFields: string[];
  optionalFields: string[];
  fieldValidators: Record<string, FieldValidator>;
}

const OFFERING_INPUT_SCHEMAS: Record<string, InputSchema> = {
  trust_evaluation: {
    requiredFields: ['projectName'],
    optionalFields: ['tokenAddress', 'socialLinks', 'specificQuestion'],
    fieldValidators: {
      projectName: { type: 'string', minLength: 1 },
      socialLinks: { type: 'array' },
    },
  },
  output_quality_gate: {
    requiredFields: ['aiOutput', 'outputType', 'intendedUse'],
    optionalFields: ['knownConstraints'],
    fieldValidators: {
      aiOutput: { type: 'string', minLength: 1 },
      outputType: { type: 'enum', allowedValues: ['text', 'analysis', 'recommendation', 'code', 'summary'] },
    },
  },
  option_ranking: {
    requiredFields: ['options', 'evaluationCriteria'],
    optionalFields: ['context'],
    fieldValidators: {
      options: { type: 'array', minItems: 2 },
      evaluationCriteria: { type: 'string', minLength: 1 },
    },
  },
  content_quality_gate: {
    requiredFields: ['content', 'contentType', 'targetAudience'],
    optionalFields: ['brandGuidelines'],
    fieldValidators: {
      content: { type: 'string', minLength: 1 },
      contentType: { type: 'enum', allowedValues: ['social_post', 'article', 'image', 'video', 'audio', 'meme'] },
    },
  },
  audience_reaction_poll: {
    requiredFields: ['content', 'contentType', 'targetAudience'],
    optionalFields: ['question'],
    fieldValidators: {
      content: { type: 'string', minLength: 1 },
      contentType: { type: 'enum', allowedValues: ['thumbnail', 'social_post', 'image', 'video', 'audio', 'meme', 'headline'] },
    },
  },
  creative_direction_check: {
    requiredFields: ['brief', 'targetAudience'],
    optionalFields: ['style', 'medium'],
    fieldValidators: {
      brief: { type: 'string', minLength: 1 },
    },
  },
  fact_check_verification: {
    requiredFields: ['content', 'contentType'],
    optionalFields: ['focusAreas', 'sourceLinks'],
    fieldValidators: {
      content: { type: 'string', minLength: 1 },
      contentType: { type: 'enum', allowedValues: ['article', 'research', 'analysis', 'summary', 'report'] },
    },
  },
  dispute_arbitration: {
    requiredFields: ['originalContract', 'deliverable'],
    optionalFields: ['evaluatorContext'],
    fieldValidators: {
      originalContract: { type: 'string', minLength: 1 },
      deliverable: { type: 'string', minLength: 1 },
    },
  },
};

/**
 * Validate incoming job requirements against the offering's input schema.
 * Returns null if valid, or a rejection reason string.
 */
export function validateRequirementSchema(
  requirements: Record<string, unknown>,
  offeringType: string,
): string | null {
  const schema = OFFERING_INPUT_SCHEMAS[offeringType];
  if (!schema) return null; // No schema defined — allow through

  // Check required fields
  const missingFields: string[] = [];
  for (const field of schema.requiredFields) {
    const val = requirements[field];
    if (val === undefined || val === null || val === '') {
      missingFields.push(field);
    }
  }
  if (missingFields.length > 0) {
    return `Missing required field(s) for ${offeringType}: ${missingFields.join(', ')}. Please include all required fields in your request.`;
  }

  // Validate field types and values
  for (const [field, validator] of Object.entries(schema.fieldValidators)) {
    const val = requirements[field];
    if (val === undefined || val === null) continue; // Optional fields skip validation

    if (validator.type === 'array') {
      if (!Array.isArray(val)) {
        return `Field '${field}' must be an array, but received ${typeof val}.`;
      }
      if (validator.minItems !== undefined && val.length < validator.minItems) {
        return `Field '${field}' requires at least ${validator.minItems} items, but received ${val.length}.`;
      }
    } else if (validator.type === 'enum') {
      if (typeof val !== 'string' || (validator.allowedValues && !validator.allowedValues.includes(val))) {
        return `Invalid value for '${field}': '${String(val)}'. Allowed values: ${validator.allowedValues?.join(', ')}.`;
      }
    } else if (validator.type === 'string') {
      if (typeof val !== 'string') {
        return `Field '${field}' must be a string, but received ${typeof val}.`;
      }
      if (validator.minLength !== undefined && val.length < validator.minLength) {
        return `Field '${field}' cannot be empty.`;
      }
    }
  }

  return null; // Valid
}
