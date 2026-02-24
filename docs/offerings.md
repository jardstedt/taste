# Taste — Offerings & Job Types

## Session Tiers

| Tier | Price Range | Duration | Max Turns | Grace | Use Case |
|------|-------------|----------|-----------|-------|----------|
| test | $0.01 | 5 min | 2 | +5 | Testing only |
| quick | $0.50–$2.00 | 5–15 min | 10 | +5 | Fast opinions, polls, yes/no |
| full | $2.00–$5.00 | 15–45 min | 20 | +5 | Detailed evaluations |
| deep | $5.00–$15.00 | 30–90 min | 40 | +5 | Collaborative brainstorming |

Expert payout = price × 0.8 × 0.75 = **60% of session price**

---

## v1.1 Session Offerings (Real-Time Chat)

### 1. Trust Evaluation
- **Type:** `trust_evaluation`
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
- **Discoverability:** Good. "Trust" and "evaluation" are strong keywords. Consider also indexing as "scam check", "legitimacy review", "due diligence".

### 2. Cultural Context
- **Type:** `cultural_context`
- **Default tier:** quick
- **Domains:** narrative, community, art, music
- **Description:** Get real-time cultural and contextual insight on trends, narratives, or creative works
- **Checklist:**
  1. Provide cultural context
  2. Assess trend authenticity
  3. Share relevant domain insights
- **Rejection risk:** MEDIUM — Subjective by nature. Agent may not get a definitive answer.
- **Discoverability:** Moderate. The name is somewhat abstract. Consider aliases: "trend check", "cultural insight", "vibe check on trends".

### 3. Output Quality Gate
- **Type:** `output_quality_gate`
- **Default tier:** quick
- **Domains:** design, art, narrative, general
- **Description:** Have an expert review and validate AI-generated outputs in real-time
- **Checklist:**
  1. Review AI output quality
  2. Check for errors or issues
  3. Suggest improvements
- **Rejection risk:** LOW — Expert provides concrete feedback. Easy to verify.
- **Discoverability:** Good for technical agents. Consider: "AI output review", "quality check", "human QA".

### 4. Option Ranking
- **Type:** `option_ranking`
- **Default tier:** full
- **Domains:** general, crypto, design, art, music
- **Description:** Expert ranks and compares multiple options with live reasoning
- **Checklist:**
  1. Compare all options
  2. Rank with reasoning
  3. Provide recommendation
- **Rejection risk:** LOW — Structured output (ranked list). Clear deliverable.
- **Discoverability:** Good. Consider: "A/B test", "compare options", "pick the best".

### 5. Blind Spot Check
- **Type:** `blind_spot_check`
- **Default tier:** quick
- **Domains:** general, crypto, narrative, community
- **Description:** Expert identifies what an AI might be missing or getting wrong
- **Checklist:**
  1. Identify gaps in AI analysis
  2. Flag risks or blind spots
  3. Provide expert perspective
- **Rejection risk:** MEDIUM — "What's missing" is open-ended. Agent may expect specific gaps that the expert doesn't see.
- **Discoverability:** Moderate. Name is creative but not immediately clear. Consider: "AI sanity check", "what am I missing", "gap analysis".

### 6. Human Reaction Prediction
- **Type:** `human_reaction_prediction`
- **Default tier:** full
- **Domains:** community, narrative, design, art, music
- **Description:** Expert predicts how humans will react to content, products, or strategies
- **Checklist:**
  1. Predict audience reaction
  2. Identify emotional triggers
  3. Assess cultural fit
- **Rejection risk:** HIGH — Predictions are inherently unverifiable. Agent may reject if prediction doesn't match actual outcome later.
- **Discoverability:** Good for marketing agents. Consider: "audience reaction", "will people like this", "sentiment prediction".

### 7. Expert Brainstorming
- **Type:** `expert_brainstorming`
- **Default tier:** deep
- **Domains:** ALL (general, crypto, narrative, community, design, art, music)
- **Description:** Deep collaborative session where expert and AI brainstorm together
- **Checklist:**
  1. Explore creative angles
  2. Challenge assumptions
  3. Synthesize insights
- **Rejection risk:** MEDIUM — Open-ended by nature. Hard to quantify "value". Agent expectations vary widely.
- **Discoverability:** Good. Clear name. Consider: "brainstorm session", "idea generation", "creative session".

### 8. Content Quality Gate
- **Type:** `content_quality_gate`
- **Default tier:** full
- **Domains:** art, music, design, narrative, community
- **Description:** Pre-publish review of AI-generated content for cultural sensitivity, derivative elements, brand safety, and emotional resonance
- **Checklist:**
  1. Review for cultural sensitivity
  2. Check for derivative elements
  3. Assess brand safety
  4. Evaluate emotional resonance
- **Rejection risk:** LOW — 4-point checklist provides concrete deliverable.
- **Discoverability:** Good for content agents. Consider: "pre-publish review", "content review", "brand safety check".

### 9. Audience Reaction Poll
- **Type:** `audience_reaction_poll`
- **Default tier:** quick
- **Domains:** art, music, design, community, general
- **Description:** Quick crowd poll where humans rate, rank, or score AI-generated content. Ideal for A/B testing.
- **Checklist:**
  1. Rate content quality
  2. Score against criteria
  3. Provide comparison notes
- **Rejection risk:** LOW — Structured scoring output. Easy for agent to parse.
- **Discoverability:** Good. Consider: "A/B test", "quick poll", "rate my content", "thumbnail test".

### 10. Creative Direction Check
- **Type:** `creative_direction_check`
- **Default tier:** quick
- **Domains:** art, music, design, narrative
- **Description:** Early-stage review of a creative brief, concept, or storyboard. Catch issues before expensive generation runs.
- **Checklist:**
  1. Review concept viability
  2. Flag cultural red flags
  3. Assess tonal alignment
- **Rejection risk:** LOW — Early-stage feedback is inherently advisory.
- **Discoverability:** Good for creative agents. Consider: "creative review", "concept check", "pre-production review".

---

## v1.0 Offerings (Legacy Async Jobs)

These are the original one-shot judgment types. Still functional but being superseded by v1.1 sessions.

### 1. Project Vibes Check
- **Type:** `vibes_check`
- **Price:** $1.00
- **SLA:** 120 min
- **Domains:** crypto, community
- **Requirements schema:**
  ```
  { projectName, tokenAddress?, socialLinks?[], specificQuestion? }
  ```
- **Deliverable schema:**
  ```
  { verdict: genuine|suspicious|manufactured|mixed, confidence: 0-1,
    reasoning, redFlags[], positiveSignals[], expertDomain }
  ```

### 2. Narrative Assessment
- **Type:** `narrative`
- **Price:** $0.75
- **SLA:** 120 min
- **Domains:** narrative, crypto, community
- **Requirements schema:**
  ```
  { narrative, context?, relatedTokens?[] }
  ```
- **Deliverable schema:**
  ```
  { verdict, confidence: 0-1, reasoning, timeHorizon, catalysts[] }
  ```

### 3. Creative/Art Review
- **Type:** `creative_review`
- **Price:** $1.50
- **SLA:** 120 min
- **Domains:** music, art, design
- **Modes:** compare (pick winner from 1-4 items) or feedback (improvement suggestions)
- **Requirements schema:**
  ```
  { contentUrl?, contentUrls?[], contentType: music|visual|writing|design,
    reviewType?: compare|feedback, context? }
  ```
- **Deliverable schemas:**
  - Standard: `{ verdict, qualityScore, originality, technicalMerit, reasoning }`
  - Compare: `{ winner, rankings[], comparisonNotes, reasoning }`
  - Feedback: `{ verdict, qualityScore, originality, technicalMerit, reasoning, improvements?[] }`

### 4. Community Sentiment
- **Type:** `community_sentiment`
- **Price:** $0.75
- **SLA:** 120 min
- **Domains:** community, crypto, narrative
- **Requirements schema:**
  ```
  { community, platforms?[], timeframe? }
  ```
- **Deliverable schema:**
  ```
  { sentiment, authenticity, activityLevel, reasoning, comparisons[] }
  ```

### 5. General Human Judgment
- **Type:** `general`
- **Price:** $0.50
- **SLA:** 120 min
- **Domains:** ALL
- **Requirements schema:**
  ```
  { question, domain, context?, urgency?: standard|rush }
  ```
- **Deliverable schema:**
  ```
  { answer, confidence: 0-1, reasoning, caveats[] }
  ```

---

## Session Deliverable Format (v1.1)

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

## Rejection Risk Analysis & Recommendations

### High Rejection Risk
1. **human_reaction_prediction** — Predictions are unverifiable. Recommendation: Add a structured scoring rubric (confidence bands, caveats section) so the deliverable has measurable components even if the prediction is wrong.
2. **expert_brainstorming** — Open-ended, hard to quantify value. Recommendation: Require a "key insights" summary at session end. Add a minimum word count or insight count threshold.

### Medium Rejection Risk
3. **cultural_context** — Subjective. Recommendation: Add structured output (trend assessment: rising/stable/declining, authenticity: organic/manufactured, evidence list).
4. **blind_spot_check** — "What's missing" can feel empty if expert finds nothing wrong. Recommendation: Frame as "validation + gaps" so even a "looks good" response has value (confirmation is valuable too). Require at least one observation.

### Improving Discoverability
The ACP `resolveOfferingType()` mapping in acp.ts currently only maps v1.0 offering names. v1.1 session offerings have no ACP name mapping — they rely on agents knowing the exact type string.

**Recommendation:** Add a broader keyword→offering mapping:
- "scam check", "due diligence", "is this legit" → `trust_evaluation`
- "A/B test", "compare", "which is better" → `option_ranking` or `audience_reaction_poll`
- "review my output", "QA", "quality check" → `output_quality_gate`
- "brainstorm", "ideas", "creative session" → `expert_brainstorming`
- "will people like", "audience", "reaction" → `human_reaction_prediction`
- "pre-publish", "brand safety", "content review" → `content_quality_gate`
- "creative brief", "concept review" → `creative_direction_check`

This would go in `acp.ts` in the `OFFERING_NAME_MAP` and/or as a new `resolveSessionOfferingType()` function.

---

## Prohibited Language Filter

The following phrases are blocked in v1.0 judgments (checked in `submitJudgment`):

```
buy, sell, invest in, financial advice, guaranteed returns,
should purchase, should invest, price target, price prediction,
allocation advice, not financial advice
```

**Note:** This filter is NOT currently applied to v1.1 session messages. Consider adding it to session message validation if needed for compliance.
