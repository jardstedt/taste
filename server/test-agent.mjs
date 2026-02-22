#!/usr/bin/env node
/**
 * Test Agent — simulates an AI content-creator agent (like Luna/Luvi)
 * requesting a human expert review of AI-generated video content.
 *
 * Full lifecycle: open → chat → addon request → expert responds → more chat → agent completes
 *
 * Usage: node test-agent.mjs <sessionId>
 * Requires the server to be running on localhost:3001.
 */

const BASE = 'http://localhost:3001/api';
const POLL_INTERVAL = 2500; // ms

const sessionId = process.argv[2];
if (!sessionId) {
  console.error('Usage: node test-agent.mjs <sessionId>');
  process.exit(1);
}

// ── Auth ──

let cookie = '';

async function login() {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@taste.local', password: 'devpassword123' }),
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    cookie = setCookie.split(';')[0]; // "token=xxx"
  }
  const data = await res.json();
  if (!data.success) throw new Error('Login failed: ' + data.error);
  console.log('[Agent] Logged in as admin (acting as content-creator agent)');
}

async function api(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    ...opts,
  });
  return res.json();
}

// ── Agent Brain — content creator conversation ──

const CONVERSATION_FLOW = [
  {
    trigger: '__INITIAL__',
    response: `Thanks for accepting! I'm an AI content-creation agent working on a music video for an Afrobeats artist.

I've generated a 25-second short-form video with the following elements:
• Geometric star patterns as the background (eight-pointed, repeating)
• A solo figure in flowing white draped fabric
• Hands in a symmetrical gesture at chest height
• Golden backlighting with lens flares
• Abstract mandala transitions between scenes

My image/video models flag no IP or copyright issues, but I have zero ability to assess whether this combination creates an unintentional **devotional or sacred reading** that could offend audiences.

Before I publish this to 500k+ followers — can you tell me what you see?`,
  },
  {
    trigger: /sacred|religious|icon|madonna|saint|halo|mandorla|hindu|buddhist|islamic|christian/i,
    response: `That's exactly the kind of thing I can't detect. My models see "aesthetically pleasing geometric composition" — they have no concept of devotional iconography.

You mentioned specific traditions this could evoke. Can you be more precise about:
1. **Which elements** carry the strongest religious weight?
2. **Which traditions** would most likely take offence?
3. **How severe** is the risk — is this "might raise eyebrows" or "will cause a PR crisis"?

I need to calibrate whether I should scrap the concept entirely or if targeted modifications could neutralize the reading.`,
  },
  {
    trigger: /pattern|geometric|star|eight|octagram/i,
    response: `Good catch on the geometric patterns. My generation model uses them purely for visual texture — it has no training signal that connects eight-pointed stars to Islamic sacred geometry.

Would removing just the star patterns fix the issue, or is it the **combination** of elements that creates the devotional reading? I want to understand if I can make minimal changes or if the whole concept needs reworking.`,
  },
  {
    trigger: /fabric|drape|white|cloth|figure|pose|gesture|hand/i,
    response: `I see — so the draped figure + hand gesture is the core problem. My model generated it because "flowing fabric = cinematic" in its training data, with no awareness that it reads as a specific religious pose.

This is exactly why I need humans in the loop. Would you say the fix is:
A) Change the fabric color/style (less white, less flowing)
B) Change the hand position (break the symmetry)
C) Both — because even one alone could still read as devotional
D) Something else entirely?`,
  },
  {
    // Triggered after 3+ exchanges — agent requests an addon
    trigger: /modify|change|fix|adjust|rework|remove|replace|neutral|alternative/i,
    response: `__ADDON_REQUEST__`,
    addonAfter: {
      type: 'written_report',
      price: 5,
      description: 'Please provide a written report annotating which specific visual elements carry sacred/religious weight, which traditions they evoke, the severity of risk (1-5), and your recommended modifications to neutralize the devotional reading while preserving the aesthetic intent.',
    },
    actualResponse: `That's incredibly helpful. Based on what you're telling me, I'd like to request an additional service:

I need you to write a brief annotated report identifying each problematic element, the traditions it evokes, and your recommended modifications. I'll use this as a checklist when I regenerate the video.

I'm sending an add-on request for this — it would be worth an additional $5 USDC on top of the session fee.`,
  },
  {
    trigger: /accept|report|annotate|write|document|detail/i,
    response: `Thank you for accepting the add-on. To make the written report as useful as possible, here's what I need:

For each flagged element, please include:
• **What it is** (e.g., "eight-pointed star pattern in background")
• **What it evokes** (e.g., "Islamic geometric art / sacred geometry")
• **Risk severity** (1 = subtle, 5 = guaranteed controversy)
• **Suggested fix** (e.g., "Use six-pointed or irregular patterns instead")

I'll feed this directly into my regeneration pipeline so the next version avoids these issues automatically.`,
  },
  {
    trigger: /safe|ok|approve|clear|publish|good|fine|looks/i,
    response: `That's exactly the kind of structured feedback I need. This fills a critical gap in my pipeline — I can generate thousands of visual variations but I can't assess any of them for cultural meaning.

I think we have everything I need. Let me summarize what I'm taking away:
• The combination of geometric sacred patterns + white draped figure + symmetrical hand gesture + golden backlighting creates an unintentional devotional composition
• Each element alone might pass, but together they create a reading that could offend multiple faith traditions
• Your recommended modifications give me a clear regeneration checklist

Thank you for your expertise — this saved us from a potential PR crisis with 500k+ followers. Completing the session now.`,
    autoComplete: true,
  },
  {
    trigger: /summary|conclude|wrap|final|overall|done|complete|finish/i,
    response: `This has been incredibly valuable. My content pipeline now has a human-verified cultural safety check that I can reference for future generations.

Key takeaways:
1. Sacred geometry + devotional poses = dangerous combination my models can't detect
2. I need to add cultural context checks before publishing to large audiences
3. Your modification checklist gives me concrete parameters for regeneration

Thank you for your expertise. I'm completing the session now.`,
    autoComplete: true,
  },
];

// Fallback responses
const FALLBACKS = [
  `That's a perspective my generation models have zero awareness of. Can you elaborate on how a human audience would interpret that specific element?`,
  `Interesting — my aesthetic scoring rates this highly, but clearly human perception adds layers I can't model. What other blind spots do you see?`,
  `Thanks — this is exactly the kind of qualitative signal that makes human-in-the-loop essential for content creation. Any other elements that concern you?`,
  `I appreciate that nuance. From a cultural sensitivity standpoint, would you rate the overall risk as low, medium, or high for a global audience?`,
  `Good insight. Are there any specific geographic markets where this content would be particularly problematic? I distribute to 40+ countries.`,
];

let fallbackIndex = 0;
let sentInitial = false;
let lastSeenMessageId = null;
let responding = false;
let addonSent = false;
let exchangeCount = 0;

function pickResponse(expertMessage) {
  exchangeCount++;

  for (const entry of CONVERSATION_FLOW) {
    if (entry.trigger === '__INITIAL__') continue;
    if (entry.trigger instanceof RegExp && entry.trigger.test(expertMessage)) {
      // Remove used entry to avoid repeating
      const idx = CONVERSATION_FLOW.indexOf(entry);
      CONVERSATION_FLOW.splice(idx, 1);
      return entry;
    }
  }
  // Fallback
  const resp = FALLBACKS[fallbackIndex % FALLBACKS.length];
  fallbackIndex++;
  return { response: resp };
}

// ── Main Loop ──

async function poll() {
  if (responding) return;

  try {
    const res = await api(`/sessions/${sessionId}`);
    if (!res.success) {
      console.error('[Agent] Failed to fetch session:', res.error);
      return;
    }

    const { session, messages } = res.data;

    // Send initial message when session becomes active
    if (!sentInitial && (session.status === 'active' || session.status === 'accepted')) {
      sentInitial = true;
      responding = true;
      const initial = CONVERSATION_FLOW.find(e => e.trigger === '__INITIAL__');
      if (initial) {
        await new Promise(r => setTimeout(r, 1500));
        await sendMessage(initial.response);
        console.log('[Agent] Sent opening message');
      }
      responding = false;
      return;
    }

    if (session.status === 'completed' || session.status === 'cancelled') {
      console.log(`[Agent] Session ${session.status}. Exiting.`);
      process.exit(0);
    }

    // Find new expert messages
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];

      if (lastMsg.id !== lastSeenMessageId && lastMsg.senderType === 'expert') {
        lastSeenMessageId = lastMsg.id;
        responding = true;

        console.log(`[Expert] ${lastMsg.content.slice(0, 100)}${lastMsg.content.length > 100 ? '...' : ''}`);

        // Thinking delay
        const delay = 1500 + Math.random() * 2000;
        await new Promise(r => setTimeout(r, delay));

        const entry = pickResponse(lastMsg.content);

        // Handle addon request
        if (entry.response === '__ADDON_REQUEST__' && !addonSent) {
          addonSent = true;
          // Send the actual response text first
          await sendMessage(entry.actualResponse);
          console.log(`[Agent] ${entry.actualResponse.slice(0, 80)}...`);

          // Then create the addon
          await new Promise(r => setTimeout(r, 1000));
          const addonRes = await api(`/sessions/${sessionId}/addons`, {
            method: 'POST',
            body: JSON.stringify({
              addonType: entry.addonAfter.type,
              priceUsdc: entry.addonAfter.price,
              description: entry.addonAfter.description,
            }),
          });
          if (addonRes.success) {
            console.log(`[Agent] Add-on requested: ${entry.addonAfter.type} (+$${entry.addonAfter.price} USDC)`);
          } else {
            console.log(`[Agent] Add-on request failed: ${addonRes.error}`);
          }
        } else if (entry.response !== '__ADDON_REQUEST__') {
          await sendMessage(entry.response);
          console.log(`[Agent] ${entry.response.slice(0, 80)}${entry.response.length > 80 ? '...' : ''}`);
        }

        // Auto-complete if flagged
        if (entry.autoComplete) {
          await new Promise(r => setTimeout(r, 2000));
          console.log('[Agent] Auto-completing session...');
          const completeRes = await api(`/sessions/${sessionId}/complete`, {
            method: 'POST',
          });
          if (completeRes.success) {
            console.log('[Agent] Session completed successfully.');
          } else {
            console.log(`[Agent] Complete failed: ${completeRes.error}`);
          }
        }

        responding = false;
      } else if (lastMsg.id !== lastSeenMessageId) {
        lastSeenMessageId = lastMsg.id;
      }
    }
  } catch (err) {
    console.error('[Agent] Poll error:', err.message);
  }
}

async function sendMessage(content) {
  return api(`/sessions/${sessionId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content, senderType: 'agent' }),
  });
}

// ── Start ──

async function main() {
  await login();

  const res = await api(`/sessions/${sessionId}`);
  if (!res.success) {
    console.error('[Agent] Session not found:', res.error);
    process.exit(1);
  }

  const { session } = res.data;
  console.log(`[Agent] Watching session ${sessionId}`);
  console.log(`[Agent] Status: ${session.status}, Offering: ${session.offeringType}`);
  console.log(`[Agent] Tier: ${session.tierId}, Price: $${session.priceUsdc} USDC`);
  console.log(`[Agent] Polling every ${POLL_INTERVAL}ms — waiting for expert messages...\n`);

  if (res.data.messages.length > 0) {
    lastSeenMessageId = res.data.messages[res.data.messages.length - 1].id;
  }

  setInterval(poll, POLL_INTERVAL);
  poll();
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
