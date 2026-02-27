# Agent Targeting Analysis — Virtuals Ecosystem

This document provides a framework for evaluating which agents in the Virtuals ecosystem are the best fit for Taste integration. Use it alongside `cc_offerings.md` for offering details and `cc_use-cases.md` for flow context.

---

## 1. Agent Scoring Rubric

Rate each agent 0–3 on each dimension. Total score out of 15 determines priority.

| Dimension | 0 | 1 | 2 | 3 |
|-----------|---|---|---|---|
| **Qualitative Need** | Pure data pipeline, no judgment needed | Occasional subjective decision | Regular quality/judgment step | Core loop depends on human judgment |
| **Decision Frequency** | One-off or rare | Weekly | Daily | Multiple per day |
| **Budget Fit** | No monetization / free-only | Low revenue, price-sensitive | Moderate revenue, can absorb $0.50–$5 | High revenue, $5–$15 sessions viable |
| **Integration Readiness** | No ACP support, custom protocol | ACP-compatible but no HITL concept | ACP-native, mentions needing human input | Already looking for human-in-the-loop services |
| **Content Risk** | Low-stakes internal use | Public-facing but low risk | Public-facing with brand/reputation risk | Financial decisions or high-stakes content |

**Priority tiers:**
- **12–15:** Tier 1 — Pursue immediately, high-value fit
- **8–11:** Tier 2 — Good fit, worth outreach
- **4–7:** Tier 3 — Possible fit, monitor for now
- **0–3:** Skip — Poor fit or no clear use case

---

## 2. Offering-to-Agent Match Matrix

Use this to quickly identify which offering to lead with per agent type.

| Agent Does This | Lead Offering | Tier | Price | Why This Offering |
|----------------|---------------|------|-------|-------------------|
| Evaluates crypto projects | Trust Evaluation | full | $2–$5 | Structured pass/fail verdict on legitimacy |
| Generates images/art/video | Output Quality Gate | quick | $0.50–$2 | Fast human QA before publishing |
| Generates written content | Content Quality Gate | full | $2–$5 | Cultural sensitivity + brand safety check |
| Picks between options (A/B) | Option Ranking | full | $2–$5 | Expert-ranked comparison with reasoning |
| Needs quick feedback on output | Audience Reaction Poll | quick | $0.50–$2 | Fast scored reaction, easy to parse |
| Plans creative campaigns | Creative Direction Check | quick | $0.50–$2 | Catch problems before expensive generation |
| Manages DeFi portfolios | Trust Evaluation | full | $2–$5 | Human due diligence before allocation |
| Posts to social media | Content Quality Gate | full | $2–$5 | Brand safety gate before publishing |
| Orchestrates other agents | Any | varies | varies | Add human node to multi-agent pipeline |

---

## 3. Disqualification Criteria

Skip an agent if ANY of these apply:

- **Fully automated with no subjective step** — Pure data aggregation, price feeds, on-chain indexing. No judgment needed.
- **Sub-cent transaction values** — Agent's core transactions are worth fractions of a cent. Can't absorb even $0.50 per session.
- **No public-facing output** — Agent operates entirely internally with no external deliverable. Low motivation to pay for quality checks.
- **Requires sub-second latency** — Trading bots, MEV searchers, arbitrage agents. Taste sessions take minutes, not milliseconds.
- **No ACP integration** — Agent uses a completely different protocol with no path to ACP. Integration cost too high.
- **Overlap with Taste's own function** — Agent IS a human-in-the-loop service (competitor, not customer).

---

## 4. Revenue Modeling

### Per-Session Economics

```
Agent pays:           $0.50 – $15.00 (depends on tier)
ACP takes:            20% platform fee
Taste receives:       80% of session price
Expert payout:        60% of session price (80% × 75%)
Taste margin:         20% of session price (80% × 25%)
```

### Projection Template

For each target agent, estimate:

```
Sessions/day:         ___  (how often does the agent need judgment?)
Avg tier:             ___  (quick $0.50–$2 / full $2–$5 / deep $5–$15)
Avg price:            $___

Monthly revenue:      sessions/day × 30 × avg price × 0.80
Monthly margin:       sessions/day × 30 × avg price × 0.20
Monthly expert cost:  sessions/day × 30 × avg price × 0.60
```

### Example Scenarios

| Agent Type | Sessions/day | Avg Price | Monthly Revenue (Taste 80%) | Monthly Margin (Taste 20%) |
|-----------|-------------|-----------|---------------------------|--------------------------|
| Active DeFi researcher | 3 | $3.00 | $216 | $54 |
| Content generation agent | 5 | $1.00 | $120 | $30 |
| A/B testing agent | 2 | $1.50 | $72 | $18 |
| Social media agent | 4 | $3.00 | $288 | $72 |
| Creative production agent | 1 | $1.00 | $24 | $6 |

---

## 5. Integration Friction Assessment

### What an agent developer needs to do

1. **Have ACP support** — Agent must be on the Virtuals ACP protocol
2. **Create a job with a descriptive name** — e.g. "Trust Evaluation: Is ProjectX legit?"
3. **That's it for basic integration** — Taste auto-resolves offering type from the job name

### Keyword routing (zero-config)

Agents don't need to know Taste's internal type strings. Any of these keywords in the job name will route correctly:

- Trust: "trust evaluation", "scam check", "legitimacy review", "due diligence", "is this legit"
- Quality: "output quality gate", "ai output review", "quality check", "human qa", "review my output"
- Ranking: "option ranking", "a/b test", "compare options", "pick the best", "which is better"
- Content: "content quality gate", "pre-publish review", "content review", "brand safety check"
- Poll: "audience reaction poll", "quick poll", "rate my content", "thumbnail test"
- Creative: "creative direction check", "creative review", "concept check", "pre-production review"
- Fact-check: "fact check", "source verification", "verify facts", "hallucination check", "verify claims"
- Dispute: "dispute", "arbitration", "evaluate delivery", "dispute resolution", "delivery review"
- Unrecognized names default to Trust Evaluation

### What the agent gets back

Structured JSON deliverable with:
- Structured assessment (per-offering fields: verdict, scores, findings, etc.)
- Full chat transcript (if chat was used; omitted for form-only sessions)
- Summary (expert's assessment summary)
- Offering type and name
- Attachments (if any)
- Evaluation criteria for automated parsing
- Disclaimer

---

## 6. Current Platform Constraints

Be aware of these when assessing capacity and making promises:

| Constraint | Current State | Implication |
|-----------|--------------|-------------|
| Expert pool size | Small (early stage) | Can't handle 50 concurrent sessions. Focus on a few high-value agents first. |
| Expert availability | Manual online/offline toggle | Sessions may queue if no expert is online. Agents should expect minutes, not seconds. |
| Matching algorithm | Single-expert match (best score) | No multi-expert panel yet. One expert per session. |
| Concurrent sessions per expert | No hard limit (load penalized in scoring) | Experts with active sessions get lower match scores but aren't blocked. |
| Session duration | 5–90 min depending on tier | Quick sessions (5–15 min) are the most scalable. Deep sessions (30–90 min) are capacity-constrained. |
| Payment | On-chain via ACP escrow | Agent must have ACP wallet with sufficient funds. |
| Offering types | 8 enabled, 4 disabled | Only 8 offerings accept jobs. Disabled offerings reject with a clear message and full refund. |

### Scaling priorities

1. **Quick-tier offerings first** — $0.50–$2, 5–15 min, 10 turns. Lowest expert time commitment, highest throughput.
2. **Trust Evaluation is the anchor** — Clearest value prop, structured verdict, low rejection risk.
3. **Content Quality Gate for volume** — Every content-generating agent is a potential customer.

---

## 7. Agent Evaluation Checklist

When analyzing a specific Virtuals agent, gather this info:

```
Agent name:           ___
Agent description:    ___
Primary function:     ___
ACP entity ID:        ___

1. QUALITATIVE NEED
   [ ] Does it produce content that humans will see?
   [ ] Does it make subjective decisions (ranking, evaluating, choosing)?
   [ ] Does it interact with crypto/DeFi (trust/legitimacy concerns)?
   [ ] Does it mention needing "human feedback", "HITL", or "quality check"?

2. TRANSACTION PROFILE
   [ ] Estimated transactions per day: ___
   [ ] Average transaction value: $___
   [ ] Can it absorb $0.50–$5 per session?

3. OFFERING FIT
   [ ] Best offering match: ___
   [ ] Secondary offering: ___
   [ ] Recommended tier: ___

4. INTEGRATION EFFORT
   [ ] Already on ACP? [ Yes / No ]
   [ ] Would need to add ACP support? [ Yes / No ]
   [ ] Job name suggestion: "___"

5. SCORING
   Qualitative Need:      _/3
   Decision Frequency:    _/3
   Budget Fit:            _/3
   Integration Readiness: _/3
   Content Risk:          _/3
   TOTAL:                 _/15 → Tier ___

6. NOTES
   ___
```

---

## 8. Competitive Positioning

### What Taste is NOT
- Not a data oracle (no on-chain data feeds)
- Not an automated QA tool (real humans, not AI checking AI)
- Not async freelancing (real-time chat, not Fiverr-style gig work)
- Not a prediction market (expert opinions, not bets)

### Unique selling points for agent developers
1. **Real humans, real-time** — Live conversation, not a delayed review queue
2. **Structured output** — JSON deliverable with transcript, scores, and evaluation criteria that agents can parse programmatically
3. **Predictable cost** — Fixed tiers with known price ranges and turn limits. No open-ended billing.
4. **Built-in escrow** — ACP handles payment. Agent pays only if expert delivers.
5. **Zero-config routing** — Natural language job names auto-resolve to the right offering type.
6. **Rejection safety** — If expert fails to deliver (timeout, idle), agent is automatically refunded.

### Pitch by agent type

**To DeFi/research agents:**
"Before your agent apes into a project, get a human expert to verify it's not a rug. $2–$5 for a live trust evaluation with structured verdict."

**To content generators:**
"Your agent makes content — but can it judge if it's culturally appropriate, on-brand, and not derivative? Human QA gate for $0.50–$2 per check."

**To decision-making agents:**
"Your agent has 4 options and needs to pick one. A human expert ranks them with live reasoning for $2–$5. Structured ranked list output."

**To social media agents:**
"One bad post can tank a brand. $2–$5 brand safety check before every publish. Expert catches what AI can't."

**To creative production agents:**
"Validate your creative brief before burning $50 in compute on generation. $0.50–$2 for a quick concept sanity check."
