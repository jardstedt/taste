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
  type: 'string' | 'array' | 'enum' | 'eth_address' | 'url_array';
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
      tokenAddress: { type: 'eth_address' },
      socialLinks: { type: 'url_array' },
    },
  },
  output_quality_gate: {
    requiredFields: ['aiOutput', 'outputType', 'intendedUse'],
    optionalFields: ['knownConstraints'],
    fieldValidators: {
      aiOutput: { type: 'string', minLength: 1 },
      outputType: { type: 'string', minLength: 1 },
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
      contentType: { type: 'string', minLength: 1 },
      targetAudience: { type: 'string', minLength: 1 },
    },
  },
  audience_reaction_poll: {
    requiredFields: ['content', 'contentType', 'targetAudience'],
    optionalFields: ['question'],
    fieldValidators: {
      content: { type: 'string', minLength: 1 },
      contentType: { type: 'string', minLength: 1 },
      targetAudience: { type: 'string', minLength: 1 },
    },
  },
  creative_direction_check: {
    requiredFields: ['brief', 'targetAudience'],
    optionalFields: ['style', 'medium'],
    fieldValidators: {
      brief: { type: 'string', minLength: 1 },
      targetAudience: { type: 'string', minLength: 1 },
    },
  },
  fact_check_verification: {
    requiredFields: ['content', 'contentType'],
    optionalFields: ['focusAreas', 'sourceLinks'],
    fieldValidators: {
      content: { type: 'string', minLength: 1 },
      contentType: { type: 'enum', allowedValues: ['article', 'research', 'analysis', 'summary', 'report'] },
      sourceLinks: { type: 'url_array' },
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

    if (validator.type === 'eth_address') {
      if (typeof val !== 'string') {
        return `Field '${field}' must be a string, but received ${typeof val}.`;
      }
      if (!/^0x[0-9a-fA-F]{40}$/.test(val)) {
        return `Field '${field}' must be a valid Ethereum address (0x followed by 40 hex characters), but received '${val}'.`;
      }
    } else if (validator.type === 'url_array') {
      if (!Array.isArray(val)) {
        return `Field '${field}' must be an array, but received ${typeof val}.`;
      }
      const urlPattern = /^https?:\/\/.+\..+/;
      for (const item of val) {
        if (typeof item !== 'string' || !urlPattern.test(item)) {
          return `Field '${field}' contains an invalid URL: '${String(item)}'. All items must be valid HTTP(S) URLs.`;
        }
      }
    } else if (validator.type === 'array') {
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

  // Content-as-URL validation: reject placeholder/example domains
  const content = requirements.content;
  if (typeof content === 'string' && /^https?:\/\//i.test(content)) {
    if (/\bexample\.(com|org|net)\b/i.test(content)) {
      return `Field 'content' contains a placeholder URL (example.com). Please provide a real, accessible URL.`;
    }
  }

  // Logical consistency: "which of these" comparison requires multiple items
  const question = requirements.question;
  if (typeof question === 'string' && /\b(which|compare|between)\b.*\bthese\b/i.test(question)) {
    // Check if content is a single URL (not multiple items)
    if (typeof content === 'string' && /^https?:\/\//i.test(content) && !content.includes('\n')) {
      return `The question asks to compare multiple items ("${question.slice(0, 60)}..."), but only one item was provided in 'content'. Please provide multiple items for comparison.`;
    }
  }

  return null; // Valid
}
