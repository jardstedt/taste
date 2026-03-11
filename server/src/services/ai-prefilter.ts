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

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const prompt = `You are a request quality gate for a human expert evaluation service. An AI agent is requesting a "${offeringType.replace(/_/g, ' ')}" from our service.

TODAY'S DATE: ${today}

REQUEST DATA:
${reqText}

Determine if this is a LEGITIMATE request or if it should be REJECTED.

REJECT ONLY if the request is CLEARLY one of these:
- Pure gibberish or keyboard mash (e.g. "asdf", "aaa", "xxx", random characters)
- Explicitly labeled as test data by the sender (e.g. "this is a test", fields literally saying "test" with no real content)
- Harmful/violent/NSFW content: graphic violence, sexual content, illegal activities, harassment, exploitation
- Off-topic: requests for token operations, trades, or things completely unrelated to human judgment/evaluation

IMPORTANT — DO NOT REJECT any of the following:
- Requests mentioning current or recent dates — today is ${today}, so references to ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} are CURRENT, not future/test data
- Simple or short code snippets — even basic functions like "sum(a, b)" are legitimate code that needs quality review
- Real URLs from any service (picsum.photos, placeholder.com, etc.) — these are real services, not test placeholders
- Brief but coherent requests — a short request is fine if it describes a real evaluation need
- Requests with informal language or unconventional formatting
- Content submitted FOR REVIEW — in quality gates, fact checks, and content reviews, the content being evaluated may contain bad advice, errors, or controversial claims. That's the POINT — the requester wants us to evaluate it, not endorse it. Do NOT reject because the content being reviewed is low quality or problematic.

DEFAULT TO ACCEPT. Only reject when you are highly confident the request is garbage, harmful, or completely off-topic. When in doubt, ACCEPT.

Respond with EXACTLY one line:
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
