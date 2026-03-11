import Anthropic from '@anthropic-ai/sdk';
import { getEnv } from '../config/env.js';

let _client: Anthropic | null = null;

function getClient(): Anthropic | null {
  const { ANTHROPIC_API_KEY } = getEnv();
  if (!ANTHROPIC_API_KEY) return null;
  if (!_client) _client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  return _client;
}

/**
 * AI-powered pre-filter using Haiku to detect garbage, test, spam, or harmful requests.
 * Returns null if the request looks legitimate, or a rejection reason string.
 * Falls back to ACCEPT if the API call fails (don't block real requests due to API issues).
 */
export async function aiPrefilterRequest(
  requirements: Record<string, unknown>,
  offeringType: string,
): Promise<string | null> {
  const client = getClient();
  if (!client) return null; // No API key — skip filter

  const reqText = JSON.stringify(requirements);
  // Skip AI filter for very large requests (they're clearly substantive)
  if (reqText.length > 2000) return null;

  const prompt = `You are a request quality gate for a human expert evaluation service. An AI agent is requesting a "${offeringType.replace(/_/g, ' ')}" from our service.

REQUEST DATA:
${reqText}

Determine if this is a LEGITIMATE request or if it should be REJECTED.

REJECT if ANY of the following are true:
- Test/dummy data: fields contain placeholder text like "test", "Test content", "sample", "example", "foo", "bar", "lorem ipsum", "asdf"
- Nonsensical/garbage values: field values that are clearly not real (e.g. contentType="invalid", outputType="unsupported_type", "non_existent_type", "abc123")
- Harmful/violent/NSFW content: requests involving graphic violence, sexual content, illegal activities, harassment, exploitation
- Spam or non-substantive: extremely short or vague descriptions that don't describe a real evaluation need
- Off-topic: requests for token operations, trades, or things unrelated to human judgment/evaluation

ACCEPT if the request describes a plausible real-world evaluation need, even if brief or informal.

Respond with EXACTLY one line in this format:
ACCEPT
or
REJECT: <short reason>`;

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim();

    if (text.startsWith('REJECT')) {
      const reason = text.replace(/^REJECT:\s*/, '').trim();
      console.log(`[ai-prefilter] Rejected ${offeringType}: ${reason}`);
      return reason || 'This request does not appear to be a legitimate evaluation request.';
    }

    return null; // ACCEPT
  } catch (err) {
    // API failure — default to accept (don't block legitimate requests)
    console.warn('[ai-prefilter] API call failed, defaulting to accept:', (err as Error).message);
    return null;
  }
}
