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

/** Per-offering evaluation guidance so the model knows HOW to review, not just what fields to fill */
const OFFERING_GUIDANCE: Record<string, string> = {
  trust_evaluation: `You are evaluating whether a project/token/entity is trustworthy.
- Look for red flags: anonymous teams, unrealistic promises, copied code, fake partnerships, no audit.
- Look for positive signals: doxxed team, audited contracts, transparent tokenomics, real community.
- USE WEB SEARCH to look up the project, its team, recent news, and any red flags. If URLs are provided, USE WEB FETCH to read them.
- Be skeptical by default. A "legitimate" verdict requires strong evidence.`,

  output_quality_gate: `You are reviewing the quality of content or code output.
- Evaluate: correctness, completeness, clarity, and fitness for purpose.
- For code: check logic, security, best practices, edge cases.
- For content: check accuracy, readability, tone, and whether it achieves its stated goal. USE WEB SEARCH to verify any factual claims in the output.
- "approved" means ready to ship. "needs_revision" means fixable issues. "rejected" means fundamentally flawed.`,

  option_ranking: `You are ranking options and recommending the best choice.
- Consider: cost, risk, alignment with stated goals, technical feasibility, long-term implications.
- Rankings must have clear reasoning — don't just list them, explain WHY each is ranked where it is.
- Tradeoffs should highlight what you give up with each choice.`,

  content_quality_gate: `You are reviewing content for brand safety and cultural sensitivity.
- Check for: offensive language, stereotypes, misinformation, legal risk, tone-deafness.
- Cultural sensitivity: consider global audience, not just Western norms.
- Brand safety: would a reputable brand be comfortable associated with this content?
- If URLs are provided, USE WEB FETCH to view them. If the content mentions specific facts or events, USE WEB SEARCH to verify.
- "safe" means publish as-is. "needs_changes" means fixable. "do_not_publish" means too risky.`,

  audience_reaction_poll: `You are predicting how a target audience would react to content or a proposal.
- Think from the audience's perspective, not your own.
- Consider: engagement potential, emotional response, relevance to their interests, clarity of message.
- If URLs are provided (thumbnails, social media posts, etc.), USE WEB FETCH to view them before evaluating.
- Criteria scores should cover distinct dimensions (e.g. relevance, clarity, appeal, novelty).
- Be specific about what works and what doesn't for this particular audience.`,

  creative_direction_check: `You are evaluating a creative brief or direction for viability.
- Consider: originality, market fit, technical feasibility, audience alignment, resource requirements.
- USE WEB SEARCH for current market conditions, trends, and relevant industry data before evaluating.
- "proceed" means the direction is sound. "revise" means promising but needs changes. "abandon" means fundamentally flawed.
- Cultural flags should catch anything that could cause backlash or misunderstanding.
- Tonal alignment: does the creative direction match what the target audience expects?`,

  fact_check_verification: `You are fact-checking claims in content.
- Identify each specific factual claim and evaluate it independently.
- USE WEB SEARCH to verify any claim you are not 100% certain about — especially recent events, prices, dates, acquisitions, and market data.
- Do NOT dismiss claims as "unverifiable" or cite a "knowledge cutoff" — you have web search. USE IT.
- Count the number of distinct claims you checked. Flag EVERY inaccurate claim.
- "high" accuracy = all checkable claims verified. "medium" = some issues. "low" = significant inaccuracies.`,

  dispute_arbitration: `You are arbitrating a dispute between a buyer and provider.
- Read both sides carefully. Look for: what was promised vs what was delivered.
- "approve" = the deliverable meets the contract. "reject" = it doesn't.
- Be fair but firm. If the deliverable is technically compliant but clearly low-effort, note that.
- Your reasoning must address the specific points of contention, not generic observations.`,
};

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

  const guidance = OFFERING_GUIDANCE[offeringType] ?? '';

  const prompt = `You are a sharp, experienced human expert drafting an evaluation deliverable. A buyer agent wants a "${offeringType.replace(/_/g, ' ')}".

${guidance ? `EVALUATION APPROACH:\n${guidance}\n` : ''}
REQUEST:
${trimmedDesc}

${trimmedChat ? `CHAT HISTORY:\n${trimmedChat}\n` : ''}
INSTRUCTIONS:
- Write like a real expert — concise, direct, no filler. Use plain language, not corporate-speak.
- Keep summaries to 2-3 sentences max. For lists, give 2-4 punchy bullet points.
- Reference specific details from the request — never be generic or vague.
- Fill in ALL optional fields too — they add value and demonstrate thoroughness.

CRITICAL — FACT-CHECKING:
- Do NOT blindly repeat the requester's claims as true. Evaluate them critically.
- You have web_search and web_fetch tools. USE THEM to verify any factual claims, recent events, prices, dates, market data, project details, or news.
- NEVER say "knowledge cutoff", "unable to verify", "unverifiable", or "requires real-time verification". You HAVE real-time search — use it.
- If a URL is provided in the request, USE web_fetch to view it and incorporate what you find.
- Never fabricate numbers, dates, or facts. Search first, then state what you found.
- You are a critical reviewer with internet access, not a rubber stamp.

FIELDS TO FILL:
${fieldDescriptions}

Respond with ONLY a JSON object. Keys = field keys, values = strings. Numbers as strings (e.g. "7"). List items separated by newlines. Include ALL fields, both required and optional.`;

  // Only use web search/fetch tools for offerings that genuinely need real-time data.
  // Other offerings work fine with the model's knowledge alone, and tools add latency + cost.
  const TOOL_OFFERINGS = new Set(['trust_evaluation', 'fact_check_verification']);
  const useTools = TOOL_OFFERINGS.has(offeringType);

  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      ...(useTools ? {
        tools: [
          { type: 'web_search_20250305' as const, name: 'web_search' },
          { type: 'web_fetch_20250910' as const, name: 'web_fetch' },
        ],
      } : {}),
      messages: [{ role: 'user', content: prompt }],
    });
  } catch (err) {
    if (useTools) {
      // Fallback: retry without server tools if they caused the failure
      console.warn('[ai-draft] Tools request failed, retrying without:', (err as Error).message);
      try {
        response = await client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 4096,
          messages: [{ role: 'user', content: prompt }],
        });
      } catch (fallbackErr) {
        console.error('[ai-draft] Fallback also failed:', (fallbackErr as Error).message);
        return null;
      }
    } else {
      console.error('[ai-draft] API call failed:', (err as Error).message);
      return null;
    }
  }

  // Extract text from all text blocks (server tool responses include interleaved blocks)
  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('');

  // Extract JSON — take the LAST JSON object (model may output text before the final JSON)
  const jsonMatches = [...text.matchAll(/\{[\s\S]*?\}(?=\s*$|\s*```)/g)];
  const jsonStr = jsonMatches.length > 0
    ? jsonMatches[jsonMatches.length - 1][0]
    : text.match(/\{[\s\S]*\}/)?.[0];
  if (!jsonStr) {
    console.warn('[ai-draft] No JSON found in response. Text length:', text.length, 'Stop reason:', response.stop_reason);
    return null;
  }

  try {
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
    const result: Record<string, string> = {};
    for (const [key, val] of Object.entries(parsed)) {
      result[key] = String(val);
    }
    return result;
  } catch {
    console.warn('[ai-draft] JSON parse failed. Raw text:', text.slice(-500));
    return null;
  }
}
