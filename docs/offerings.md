# Taste — Session Offerings

## Session Tiers

| Tier | Price Range | Duration | Max Turns | Grace | Use Case |
|------|-------------|----------|-----------|-------|----------|
| test | $0.01 | 5 min | 2 | +5 | Testing only |
| quick | $0.50–$2.00 | 5–15 min | 10 | +5 | Fast opinions, polls, yes/no |
| full | $2.00–$5.00 | 15–45 min | 20 | +5 | Detailed evaluations |
| deep | $5.00–$15.00 | 30–90 min | 40 | +5 | Collaborative brainstorming |

Expert payout = price × 0.8 × 0.75 = **60% of session price**

---

## Enabled Offerings (v1 Launch)

These 6 offerings are active and accepting ACP jobs. All have low rejection risk and structured deliverables.

### 1. Trust Evaluation
- **Type:** `trust_evaluation`
- **Status:** ENABLED
- **Default tier:** full
- **Domains:** crypto, community
- **Description:** Evaluate the trustworthiness and legitimacy of a project, token, or entity through live expert conversation
- **Checklist:**
  1. Assess project legitimacy
  2. Check community authenticity
  3. Review team/partnership claims
  4. Provide trust verdict
- **Deliverable format:** Transcript + expert summary + trust verdict
- **Rejection risk:** LOW — Clear pass/fail structure. Agent gets structured verdict.
- **ACP keywords:** "trust evaluation", "scam check", "legitimacy review", "due diligence", "is this legit"
- **Target agents:** DeFi research agents, portfolio managers, rug-pull detection agents, due diligence bots

### 2. Output Quality Gate
- **Type:** `output_quality_gate`
- **Status:** ENABLED
- **Default tier:** quick
- **Domains:** design, art, narrative, general
- **Description:** Have an expert review and validate AI-generated outputs in real-time
- **Checklist:**
  1. Review AI output quality
  2. Check for errors or issues
  3. Suggest improvements
- **Rejection risk:** LOW — Expert provides concrete feedback. Easy to verify.
- **ACP keywords:** "output quality gate", "ai output review", "quality check", "human qa", "review my output"
- **Target agents:** Content generation agents, AI art agents, writing agents, any agent that produces outputs needing human QA

### 3. Option Ranking
- **Type:** `option_ranking`
- **Status:** ENABLED
- **Default tier:** full
- **Domains:** general, crypto, design, art, music
- **Description:** Expert ranks and compares multiple options with live reasoning
- **Checklist:**
  1. Compare all options
  2. Rank with reasoning
  3. Provide recommendation
- **Rejection risk:** LOW — Structured output (ranked list). Clear deliverable.
- **ACP keywords:** "option ranking", "a/b test", "compare options", "pick the best", "which is better"
- **Target agents:** Decision-making agents, A/B testing agents, design selection agents, strategy agents

### 4. Content Quality Gate
- **Type:** `content_quality_gate`
- **Status:** ENABLED
- **Default tier:** full
- **Domains:** art, music, design, narrative, community
- **Description:** Pre-publish review of AI-generated content (video, image, audio) for cultural sensitivity, derivative elements, brand safety, and emotional resonance before distribution
- **Checklist:**
  1. Review for cultural sensitivity
  2. Check for derivative elements
  3. Assess brand safety
  4. Evaluate emotional resonance
- **Rejection risk:** LOW — 4-point checklist provides concrete deliverable.
- **ACP keywords:** "content quality gate", "pre-publish review", "content review", "brand safety check"
- **Target agents:** Social media agents, marketing agents, content publishing agents, brand management agents

### 5. Audience Reaction Poll
- **Type:** `audience_reaction_poll`
- **Status:** ENABLED
- **Default tier:** quick
- **Domains:** art, music, design, community, general
- **Description:** Quick crowd poll where humans rate, rank, or score AI-generated content. Fast turnaround, low cost — ideal for A/B testing visuals, thumbnails, or short-form video before publishing
- **Checklist:**
  1. Rate content quality
  2. Score against criteria
  3. Provide comparison notes
- **Rejection risk:** LOW — Structured scoring output. Easy for agent to parse.
- **ACP keywords:** "audience reaction poll", "quick poll", "rate my content", "thumbnail test"
- **Target agents:** Thumbnail generators, visual content agents, music release agents, any agent needing quick human feedback on outputs

### 6. Creative Direction Check
- **Type:** `creative_direction_check`
- **Status:** ENABLED
- **Default tier:** quick
- **Domains:** art, music, design, narrative
- **Description:** Early-stage review of a creative brief, concept, or storyboard before expensive generation runs. Catch cultural red flags, derivative risks, or tonal mismatches before committing compute
- **Checklist:**
  1. Review concept viability
  2. Flag cultural red flags
  3. Assess tonal alignment
- **Rejection risk:** LOW — Early-stage feedback is inherently advisory.
- **ACP keywords:** "creative direction check", "creative review", "concept check", "pre-production review", "creative brief"
- **Target agents:** Creative production agents, storyboard agents, campaign planning agents, music production agents

---

## Disabled Offerings (Available for Future Release)

These 4 offerings are fully implemented but disabled via `enabled: false` in `config/domains.ts`. Flip to `enabled: true` to activate.

### 7. Cultural Context
- **Type:** `cultural_context`
- **Status:** DISABLED
- **Default tier:** quick
- **Domains:** narrative, community, art, music
- **Why disabled:** Medium rejection risk — subjective output, no structured deliverable format
- **Recommendation to enable:** Add structured output (trend assessment: rising/stable/declining, authenticity: organic/manufactured, evidence list)

### 8. Blind Spot Check
- **Type:** `blind_spot_check`
- **Status:** DISABLED
- **Default tier:** quick
- **Domains:** general, crypto, narrative, community
- **Why disabled:** Medium rejection risk — "what's missing" can feel empty if expert finds nothing wrong
- **Recommendation to enable:** Frame as "validation + gaps" so even "looks good" has value. Require at least one observation.

### 9. Human Reaction Prediction
- **Type:** `human_reaction_prediction`
- **Status:** DISABLED
- **Default tier:** full
- **Domains:** community, narrative, design, art, music
- **Why disabled:** HIGH rejection risk — predictions are inherently unverifiable
- **Recommendation to enable:** Add structured scoring rubric (confidence bands, caveats section) so deliverable has measurable components even if prediction is wrong

### 10. Expert Brainstorming
- **Type:** `expert_brainstorming`
- **Status:** DISABLED
- **Default tier:** deep
- **Domains:** ALL
- **Why disabled:** Medium rejection risk — open-ended, hard to quantify value
- **Recommendation to enable:** Require "key insights" summary at session end. Add minimum word count or insight count threshold.

---

## Session Deliverable Format

When a session completes, `formatSessionDeliverable()` produces:

```json
{
  "sessionId": "abc123",
  "offeringType": "trust_evaluation",
  "offeringName": "Trust Evaluation",
  "tier": "full",
  "status": "completed",

  "request": {
    "description": "Evaluate legitimacy of ProjectX",
    "requirements": ["Assess project legitimacy", "Check community...", ...],
    "offeringDescription": "Evaluate the trustworthiness..."
  },

  "result": {
    "expertResponseCount": 5,
    "expertWordCount": 342,
    "summary": "<last expert message, max 500 chars>"
  },

  "transcript": [
    { "role": "agent", "content": "...", "timestamp": "..." },
    { "role": "expert", "content": "...", "timestamp": "..." }
  ],

  "turnCount": 12,
  "maxTurns": 20,

  "addons": [
    { "type": "extended_time", "status": "accepted", "price": 1.0 }
  ],

  "expert": {
    "name": "Alice",
    "publicProfile": "/api/public/experts/abc123"
  },

  "totalPrice": 4.0,
  "duration": 23,
  "disclaimer": "This is a qualitative human opinion...",

  "evaluationCriteria": "Verify the expert addressed the following requirements..."
}
```

---

## ACP Keyword Mapping (for Virtuals Agent Discovery)

The `OFFERING_NAME_MAP` in `acp.ts` resolves agent job names to offering types. Agents don't need to know exact type strings — any of these keywords in the job name will route correctly:

| Keywords | Resolves To |
|----------|------------|
| "trust evaluation", "scam check", "legitimacy review", "due diligence", "is this legit" | `trust_evaluation` |
| "output quality gate", "ai output review", "quality check", "human qa", "review my output" | `output_quality_gate` |
| "option ranking", "a/b test", "compare options", "pick the best", "which is better" | `option_ranking` |
| "content quality gate", "pre-publish review", "content review", "brand safety check" | `content_quality_gate` |
| "audience reaction poll", "quick poll", "rate my content", "thumbnail test" | `audience_reaction_poll` |
| "creative direction check", "creative review", "concept check", "pre-production review", "creative brief" | `creative_direction_check` |
| "cultural context", "trend check", "cultural insight", "vibe check on trends" | `cultural_context` (disabled) |
| "blind spot check", "ai sanity check", "what am i missing", "gap analysis" | `blind_spot_check` (disabled) |
| "human reaction prediction", "audience reaction", "will people like this", "sentiment prediction" | `human_reaction_prediction` (disabled) |
| "expert brainstorming", "brainstorm session", "idea generation", "creative session" | `expert_brainstorming` (disabled) |

**Default:** Unrecognized job names route to `trust_evaluation`.

**Note:** Disabled offerings are rejected at ACP intake with a clear message to the agent.

---

## Virtuals Ecosystem — Agent Targeting Guide

This section provides context for identifying which agents in the Virtuals ecosystem are the best fit for Taste's offerings.

### What Taste Offers to Agents

Taste is the **human-in-the-loop layer** for AI agents. Agents are good at data processing but bad at qualitative judgment — taste, cultural fit, legitimacy assessment, and creative evaluation. Taste fills that gap via real-time expert sessions.

### Value Propositions by Agent Type

| Agent Category | Best Offering | Value Proposition |
|---------------|--------------|-------------------|
| **DeFi / Research agents** | Trust Evaluation | "Before aping into a project, get a human expert to verify it's not a rug" |
| **Content generators** (art, music, video) | Output Quality Gate, Content Quality Gate | "Human QA before publishing — catch cultural issues AI can't see" |
| **A/B testing / optimization agents** | Audience Reaction Poll, Option Ranking | "Quick human poll on which variant performs better" |
| **Creative production agents** | Creative Direction Check | "Validate your creative brief before burning compute on generation" |
| **Social media / marketing agents** | Content Quality Gate, Audience Reaction Poll | "Brand safety check before posting, audience gut-check on content" |
| **Trading / portfolio agents** | Trust Evaluation | "Human due diligence on projects before allocation decisions" |
| **Multi-agent orchestrators** | Any offering | "Add a human expert node to your agent pipeline" |

### Key Differentiators for Agent Developers

1. **Real-time chat, not async** — Agent gets a live conversation with a human expert, not a delayed one-shot review
2. **Structured deliverables** — Every session produces a JSON deliverable with transcript, checklist completion, and evaluation criteria that agents can parse programmatically
3. **ACP-native** — Built on Virtuals ACP, so payment, escrow, and delivery are handled on-chain
4. **Turn-limited and timed** — Agents can predict cost and duration upfront; no open-ended billing
5. **Rejection safety** — If expert fails to deliver, agent is automatically refunded via ACP

### Integration Pattern for Agent Developers

```
Agent detects need for human judgment
  → Creates ACP job with descriptive name (e.g., "Trust Evaluation: ProjectX legitimacy check")
  → Taste auto-resolves offering type from job name
  → Expert matched, session created
  → Agent sends context/questions via REST messages
  → Expert responds in real-time
  → Session completes → structured deliverable returned
  → Agent parses deliverable and acts on expert judgment
```

### Signals to Look For in Virtuals Agents

When evaluating which agents to target for partnerships/integration:
- **Agents that produce content** → Output Quality Gate, Content Quality Gate
- **Agents that make decisions between options** → Option Ranking, Audience Reaction Poll
- **Agents that interact with crypto/DeFi** → Trust Evaluation
- **Agents that have creative pipelines** → Creative Direction Check
- **Agents that mention "human feedback" or "HITL" in their description** → Any offering
- **Agents with high transaction volume** → Quick tier offerings (lower price, faster turnaround)
- **Agents that explicitly mention quality concerns** → Quality Gate offerings

### Prohibited Language

The following phrases are blocked in expert responses for compliance:

```
buy, sell, invest in, financial advice, guaranteed returns,
should purchase, should invest, price target, price prediction,
allocation advice, not financial advice
```

**Note:** Currently enforced in v1.0 judgments only. Session message filtering is planned.
