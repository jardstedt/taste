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

  const prompt = `You are a sharp, experienced human reviewer drafting an evaluation. A buyer agent wants a "${offeringType.replace(/_/g, ' ')}".

REQUEST:
${trimmedDesc}

${trimmedChat ? `CHAT HISTORY:\n${trimmedChat}\n` : ''}
Fill in each field below. Write like a real person — concise, direct, no filler. Use plain language, not corporate-speak. Keep summaries to 2-3 sentences max. For lists, give 2-4 punchy bullet points, not exhaustive catalogs. Reference specific details from the request — never be generic.

CRITICAL — FACT-CHECKING RULES:
- If the request mentions specific claims, news, prices, dates, people, or events, you MUST evaluate whether they are plausible based on what you know. Do NOT blindly repeat the requester's claims as true.
- If you are unsure whether a claim is true, say so explicitly (e.g. "This claim could not be verified" or "Unable to confirm current accuracy").
- For price claims, market data, or recent events: state your knowledge cutoff and note that verification is needed.
- Never fabricate specific numbers, dates, or facts you don't know. Say "unverified" rather than guessing.
- Your job is to be a critical reviewer, not a rubber stamp. Evaluate the content, don't just summarize it.

FIELDS:
${fieldDescriptions}

Respond with ONLY a JSON object. Keys = field keys, values = strings. Numbers as strings (e.g. "7"). List items separated by newlines.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
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
