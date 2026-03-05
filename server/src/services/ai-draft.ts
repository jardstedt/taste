import Anthropic from '@anthropic-ai/sdk';
import { getEnv } from '../config/env.js';
import { getDeliverableFields, type DeliverableFieldDef } from '../config/deliverable-schemas.js';

let _client: Anthropic | null = null;

function getClient(): Anthropic | null {
  const { ANTHROPIC_API_KEY } = getEnv();
  if (!ANTHROPIC_API_KEY) return null;
  if (!_client) _client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  return _client;
}

function describeField(f: DeliverableFieldDef): string {
  let desc = `"${f.key}" (${f.label})`;
  if (f.type === 'select' && f.options) desc += ` — pick one of: ${f.options.join(', ')}`;
  else if (f.type === 'rating') desc += ` — integer ${f.min ?? 1}-${f.max ?? 10}`;
  else if (f.type === 'number') desc += ` — number${f.min !== undefined ? ` min ${f.min}` : ''}${f.max !== undefined ? ` max ${f.max}` : ''}`;
  else if (f.type === 'textarea') desc += ' — multi-line text';
  else desc += ' — short text';
  if (f.required) desc += ' [REQUIRED]';
  if (f.placeholder) desc += ` (hint: ${f.placeholder})`;
  return desc;
}

const MAX_DESCRIPTION_CHARS = 8000;
const MAX_CHAT_CHARS = 4000;

export async function generateDraft(
  offeringType: string,
  description: string,
  chatHistory?: string,
): Promise<Record<string, string> | null> {
  const client = getClient();
  if (!client) return null;

  const fields = getDeliverableFields(offeringType);
  const fieldDescriptions = fields.map(describeField).join('\n');

  const trimmedDesc = description.slice(0, MAX_DESCRIPTION_CHARS);
  const trimmedChat = chatHistory?.slice(0, MAX_CHAT_CHARS);

  const prompt = `You are an expert evaluator for a human judgment oracle service. A buyer agent has requested a "${offeringType.replace(/_/g, ' ')}" evaluation.

BUYER'S REQUEST:
${trimmedDesc}

${trimmedChat ? `CHAT HISTORY (messages exchanged during the session):\n${trimmedChat}\n` : ''}
YOUR TASK: Draft the evaluation response by filling in each field below. Be specific, substantive, and directly address the buyer's request. Do NOT give generic/boilerplate answers — reference specific details from the request.

FIELDS TO FILL:
${fieldDescriptions}

Respond with ONLY a valid JSON object where keys are the field keys and values are strings. For rating/number fields, use string representations of numbers (e.g. "7"). For textarea fields with multiple items, separate items with newlines.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('');

  // Extract JSON from the response (handle markdown code blocks)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    // Convert all values to strings
    const result: Record<string, string> = {};
    for (const [key, val] of Object.entries(parsed)) {
      result[key] = String(val);
    }
    return result;
  } catch {
    return null;
  }
}
