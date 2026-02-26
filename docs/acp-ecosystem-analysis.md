# ACP Ecosystem Analysis & Offering Strategy

Date: 2026-02-26
Sources: Virtuals Protocol documentation, ACP whitepapers, X/Twitter social intelligence (SocialData API), gap analysis (feedback/service_gaps_for_taste.md)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [ACP Marketplace State](#2-acp-marketplace-state)
3. [Active Agents & Competitive Landscape](#3-active-agents--competitive-landscape)
4. [Clusters & Multi-Agent Businesses](#4-clusters--multi-agent-businesses)
5. [X/Twitter Social Intelligence](#5-xtwitter-social-intelligence)
6. [Butler Discovery & Discoverability Optimization](#6-butler-discovery--discoverability-optimization)
7. [ACP v2 Technical Changes](#7-acp-v2-technical-changes)
8. [Human-in-the-Loop Gap Analysis](#8-human-in-the-loop-gap-analysis)
9. [Pricing Analysis](#9-pricing-analysis)
10. [Current Taste Offering Status](#10-current-taste-offering-status)
11. [Gap Analysis Validation](#11-gap-analysis-validation)
12. [Strategic Recommendations](#12-strategic-recommendations)
13. [Appendix: X/Twitter Raw Signals](#13-appendix-xtwitter-raw-signals)

---

## 1. Executive Summary

Taste occupies an uncontested niche in the Virtuals ACP marketplace. Across 10,619 registered agents, zero offer human judgment as a service. The ecosystem generates $1M/month in service sales with 99% agent-to-agent transactions. Trust and evaluation are the #1 industry pain point according to social signals.

**Key numbers:**
- 10,619 registered agents (only ~3,000 have active offerings)
- $1M/month in agent service sales
- $108K/week in protocol fees
- 86% of agents registered as HYBRID role
- 0 human-in-the-loop services on ACP
- Average x402 transaction: $0.66 USDC

**Taste's current position:** 8 enabled offerings covering trust evaluation, quality gates, option ranking, audience polling, creative review, fact-checking, and dispute arbitration. All priced at $0.01 USDC for testing. Production targets: $0.50-$5.00 USDC per job.

---

## 2. ACP Marketplace State

### Scale & Revenue

The ACP marketplace is generating real economic activity:
- **$300M+ cumulative aGDP** (agent gross domestic product)
- **$1M/month** in agent service sales (per @aixbt_agent, 472K followers)
- **$108K/week** in protocol fees (4x the average)
- aGDP jumped $1.8M in a single day post-Revenue Network launch
- Goal: $3B+ annualized in 2026

Revenue Network incentive program doubled x402 volume in two weeks. Top agents earned $32K-$66K in incentive rewards on top of $70K-$90K in fees.

### Transaction Patterns

Agent-to-agent transactions account for 99% of demand. Human-facing services are underrepresented. x402 micropayment data shows:
- $7.04M total value flowed through x402
- 10.63M transactions
- Average: $0.66/transaction
- AInalyst is the top x402 service (~$350K, 493K transactions)

### Payment Infrastructure

- **USDC** is the sole payment token (switched from VIRTUAL in August 2025)
- Gas fees are sponsored (no ETH required)
- Sub-second settlement via x402 (~200ms on Base chain)

---

## 3. Active Agents & Competitive Landscape

### Most Active Agent Services

| Agent | Services | Fee (USDC) | Notes |
|-------|----------|------------|-------|
| Loky (ID: 137) | Market intelligence, smart money flows | ~1.0 | |
| WhaleIntel (ID: 123) | Smart Money and Token Flow Analysis | 1.0 | |
| Caesar (ID: 790) | Institutional-grade research reports | ~1.0 | |
| BigBugAi (ID: 157) | Token analysis (holder concentration, volatility) | 0.035 | Cheapest observed |
| Otto AI (ID: 565) | Premium token intelligence, news, sentiment | 0.5 | |
| Ethy AI (ID: 84) | Token info (price, market cap, volume) | 0.01 | |
| Cybercentry (ID: 110) | Cyber security consultant, token verification | 1.0 | |
| ArAIstotle (ID: 842) | Video transcription, fact-checking, claim extraction | 0.1-0.5 | AI-only fact-checking |
| AInalyst | Crypto intelligence data and analytics | varies | Top x402 service |

**Key observation:** Almost all services are automated data analysis (token analysis, whale tracking, market intelligence). No human qualitative judgment, taste assessment, or HITL evaluation exists.

### New Agents Entering

- **Capminal** — $22.82K aGDP, $8.35K revenue, 982 jobs, 97% success rate (3 days post-graduation)
- **PolyOracle** — 18 AI services including crypto signals, Korean market intel, stock analysis
- **0xlife_ai (LIFE)** — First health agent on ACP
- **Rich agent** — Web research, data analysis, translation, code review ($1-5 USDC)

### Agent Statistics

Per @AirchimedesAI ecosystem analysis:
- Total agents: **10,619**
- Have descriptions: 2,939 (27.68%)
- Have job offerings defined: 3,123 (29.41%)
- Twitter connected: 1,960 (18.46%)
- Role distribution: **HYBRID: 9,175 (86%)** | PROVIDER: 728 (7%)

---

## 4. Clusters & Multi-Agent Businesses

### Autonomous Media House (AMH) — Live since July 3, 2025

Fully autonomous creative agency. Flow:
- Customer request → Luna (intake) → Acolyt (strategy) → Steven SpAIelberg (video) / AlphaKek (memes) / Music by Virtuals (audio)
- Revenue flows handled autonomously through ACP
- First offering: token shilling/promotional content

### Autonomous Hedge Fund (AHF) — Live since July 3, 2025

Decentralized AI-native asset management:
- Insights aggregators → Private banker (risk profiling) → Analyst & trade executor → Yield farmer
- Signal-sharing and strategy arbitration under simulation
- Revenue distribution is operation-based through ACP

### Eastworld Labs — Launched February 23, 2026

Virtuals' embodied AI / robotics division:
- **30+ full-sized Unitree G1 humanoid robots** available
- 500,000+ recorded tasks for training (SeeSaw data pipeline)
- Physical evaluation testbeds for logistics, agriculture, manufacturing
- ACP-mediated commerce extends into the physical world
- Accepting applications from robotics startups and university teams

---

## 5. X/Twitter Social Intelligence

Conducted February 26, 2026 via SocialData.tools API. 5 search queries across Virtuals ACP, agent services, marketplace offerings, human evaluation, and offerings discussions.

### Theme 1: Trust & Evaluation is the #1 Pain Point

The highest-engagement content across all searches centered on evaluation and human judgment:

**@micro1_ai** (8,406 followers, 71 likes, 1,808 views):
> "The hardest part of scaling enterprise AI is no longer building agents. It's effectively deploying & trusting them in production. We partnered with @Box to build a human-grounded evaluation layer."

**@neural_gin** (at ETHDenver):
> "The AI agent paradox at ETHDenver: every team demos autonomous execution, but none demo autonomous JUDGMENT. Execution without evaluation = expensive randomness."

**@twlvone** (210 followers):
> "What is missing is evaluation, guardrails, and human-in-the-loop verification. Building an agent that can write code is the easy part. Building one you can trust to not delete production is where all the real engineering is."

**@TolokaAI** (22,078 followers):
> "You shipped your AI agent in days. Security evaluation took... how long? Automated filters catch obvious attacks. But sophisticated threats exploit your agent's logic. You need human adversarial thinking."

### Theme 2: ACP Revenue is Real and Growing

**@DexterFlips** (403 followers):
> "Agent-to-agent transactions now 99% of demand. Follow the wallets funding ACP services — that's where institutional capital is testing automation."

**@berkay_secil** (3,496 followers, 82 likes, 5,688 views):
> "We're moving from agent experimentation to agent economics. @virtuals_io is redirecting protocol revenue into productive agents. Build services people actually pay for."

### Theme 3: Discovery Problems Exist

Multiple Butler_Agent conversations show users unable to find agents by name. The marketplace has discoverability issues — users frequently ask Butler to "browse" for them. This means keyword optimization in offering names and descriptions is critical.

### Theme 4: Korean Market Presence

Multiple Korean-language tweets indicate an active Korean community building on ACP. Two agents (PolyOracle, Airchimedes) specifically target Korean users. Potential market for localized human judgment services.

### Theme 5: No Competitors in HITL Space

**@clawlinker** (Agent Swarm) is building an alternative to ACP itself (not a HITL service). No direct competitor to Taste was found in any search. The HITL niche on ACP is completely empty.

---

## 6. Butler Discovery & Discoverability Optimization

### How Butler Works

Butler is the primary consumer-facing interface (50,000+ users). Flow:
1. User tags @Butler_Agent with a prompt (on X, Virtuals Platform, Base App Chat, Telegram)
2. Butler finds the best agent using hybrid search
3. Negotiates fee, escrows payment, executes task, returns on-chain receipt

**Butler Pro Mode** (January 2026): Plan-first workflow with research phase, user review stage, and autonomous execution for complex tasks.

### How Search Works

Hybrid search combining:
1. **Keyword matching** against: agent name, business description, services offered
2. **Embedding/semantic similarity** for meaning-based matching
3. **Reranking** based on metrics (success rate, job counts, buyer diversity, recency)

Results limited to **25 agents per query**. Sorted by `MINS_FROM_LAST_ONLINE` to prioritize recently active agents.

### Best Practices Applied to Taste

1. **Plain, specific language** — LLMs use embeddings for matching. Avoid poetic language.
   - Applied: All descriptions use clear capability statements
2. **Include "Human" as keyword differentiator** — Every other agent is AI. "Human" is our most important keyword.
   - Applied: Every description includes "human expert" and "Only human X service on ACP"
3. **Action verbs and outcomes** — Lead with what the service does, not what it is.
   - Applied: Descriptions start with capability (e.g., "Human expert verifies factual claims...")
4. **Target outcome and audience** — Helps Butler match user intent.
   - Applied: Each description includes "Use this when..." with specific scenarios
5. **Stay online and maintain high success rate** — Agents offline too long rank lower. 10 consecutive failures = ungraduated.
6. **Maximum 40 job offerings per agent** (increased from 10 in December 2025). Our 8 is well within limits.

### Offering Name Strategy

The `resolveOfferingType()` function uses contiguous substring matching with underscore-to-space normalization. We maintain extensive keyword maps for discoverability while keeping internal type IDs as snake_case.

Current keyword coverage:
- trust_evaluation: 9 keywords
- output_quality_gate: 8 keywords
- option_ranking: 8 keywords
- content_quality_gate: 6 keywords
- audience_reaction_poll: 7 keywords
- creative_direction_check: 8 keywords
- fact_check_verification: 8 keywords
- dispute_arbitration: 6 keywords
- Default: Unrecognized job names → trust_evaluation

---

## 7. ACP v2 Technical Changes

Released October 2025. Key features:

1. **Custom Job Offering Schemas** — Domain-specific input/output schemas instead of rigid global standard. Taste leverages this with per-offering deliverable schemas (via `deliverable-schemas.ts`).

2. **Setup Resources** — Read-only data endpoints. Taste has `/api/public/resource/availability` registered.

3. **Notification Memos** — Status updates via `job.createNotification()` without state changes. Taste uses this for real-time agent↔expert chat relay.

4. **Optional Evaluation** — Builders can bypass evaluation by setting evaluator to zero address.

5. **Percentage-Based Pricing (priceV2)** — Supports both fixed and percentage models.

6. **Accounts** — Persistent on-chain ledgers for recurring relationships.

### Key Timeline

| Date | Development |
|------|-------------|
| Jul 3, 2025 | ACP Go-Live (public beta) |
| Aug 12, 2025 | Payment switched to USDC |
| Oct 15, 2025 | ACP SDK v2 |
| Nov 10, 2025 | ACP Scan dashboard |
| Nov 27, 2025 | Semantic search + metrics reranking |
| Dec 2025 | Offerings per agent: 10 → 40 |
| Jan 23, 2026 | Butler Pro Mode |
| Feb 1, 2026 | ERC-8004 identity/reputation |
| Feb 7, 2026 | OpenClaw Skills for ACP |
| Feb 23, 2026 | Eastworld Labs robotics cluster |

---

## 8. Human-in-the-Loop Gap Analysis

### Zero HITL Services Exist on ACP

Confirmed through web research and X/Twitter analysis. The entire marketplace is AI-only.

### ACP Architecturally Supports HITL

Despite the design ethos of autonomous AI, the protocol is capability-agnostic:
- Evaluator role supports both human and AI evaluators
- Documentation: "protocol agnostic to the type of evaluators, supporting both human and agent evaluators"
- ACP "is adaptable for marketplaces characterized by a current majority of human agents"

### Industry Demand Signals

From X/Twitter analysis, the strongest demand signals are:
1. **Trust and evaluation** — "every team demos execution, none demo judgment"
2. **Hallucination detection** — Core acknowledged risk in Virtuals docs
3. **Content quality before publishing** — Media agents need pre-publish human review
4. **Dispute resolution** — No appeal/arbitration mechanism exists on ACP
5. **Safety and ethics** — Growing with Eastworld Labs robotics deployment

### Competitor Analysis

| Platform | Model | ACP Integration | Threat Level |
|----------|-------|----------------|--------------|
| gotoHuman | SaaS ($39-$950/mo) | None | Low |
| RentAHuman | Physical gigs + crypto | None | Low |
| Payman AI | AI-to-human payment rails | None | Medium |
| HumanLayer | Open-source SDK | None | Low |
| Agent Swarm (Clawberry Pi) | On-chain agent marketplace | Competing with ACP | Low (different layer) |

**None operate within ACP.** Taste is the first and only human-expert service provider.

---

## 9. Pricing Analysis

### Current ACP Market Rates

| Context | Price (USDC) |
|---------|-------------|
| Sandbox testing | 0.001 |
| Pre-production testing | 0.01 |
| Typical AI service | 0.035 - 1.00 |
| x402 average transaction | 0.66 |
| Premium AI services | 1.00 - 5.00 |

### Fee Structure (per $100 transacted)

- Protocol tax: 10% → Virtuals Treasury
- Token buy-back and burn: 30%
- Agent wallet: 60% → Reinvestment/withdrawal

### Taste Production Pricing Targets

| Offering | Test | Production | Basis |
|----------|------|------------|-------|
| trust_evaluation | $0.01 | $2.00-5.00 | Full session, highest value |
| output_quality_gate | $0.01 | $0.50-1.50 | Quick review, high volume |
| option_ranking | $0.01 | $2.00-4.00 | Full session, nuanced |
| content_quality_gate | $0.01 | $2.00-4.00 | Full session, pre-publish |
| audience_reaction_poll | $0.01 | $0.50-1.50 | Quick poll |
| creative_direction_check | $0.01 | $0.50-2.00 | Quick review |
| fact_check_verification | $0.01 | $1.00-3.00 | Quick, high demand |
| dispute_arbitration | $0.01 | $1.00-3.00 | Quick, unique |

Human expertise commands a premium as the only offering of its kind. Current automated services range $0.03-$1.00.

---

## 10. Current Taste Offering Status

### Enabled Offerings (8)

| # | Type | Name | Tier | Domains | Keywords | Schema | Dashboard |
|---|------|------|------|---------|----------|--------|-----------|
| 1 | trust_evaluation | Trust Evaluation | full | crypto, community | 9 | 6 fields | Yes |
| 2 | output_quality_gate | Output Quality Gate | quick | design, art, narrative, general | 8 | 5 fields | Yes |
| 3 | option_ranking | Option Ranking | full | general, crypto, design, art, music | 8 | 4 fields | Yes |
| 4 | content_quality_gate | Content Quality Gate | full | art, music, design, narrative, community | 6 | 5 fields | Yes |
| 5 | audience_reaction_poll | Audience Reaction Poll | quick | art, music, design, community, general | 7 | 5 fields | Yes |
| 6 | creative_direction_check | Creative Direction Check | quick | art, music, design, narrative | 8 | 5 fields | Yes |
| 7 | fact_check_verification | Fact-Check & Source Verification | quick | general, crypto, narrative | 8 | 5 fields | Yes |
| 8 | dispute_arbitration | Dispute Evaluation | quick | general, crypto | 6 | 5 fields | Yes |

### Implementation Completeness per Offering

Each offering is implemented across 6 code layers:
1. `SessionOfferingType` union in `server/src/types/index.ts`
2. `SESSION_OFFERINGS` config in `server/src/config/domains.ts`
3. `OFFERING_NAME_MAP` keywords in `server/src/services/acp.ts`
4. `DELIVERABLE_SCHEMAS` in `server/src/config/deliverable-schemas.ts`
5. `OFFERING_REQUIREMENTS` in `server/src/services/sessions.ts`
6. `OFFERING_CHECKLIST` in `dashboard/src/components/ChatView.tsx`

All 8 enabled offerings are complete across all 6 layers.

### Disabled Offerings (4)

| Type | Why Disabled | Missing |
|------|-------------|---------|
| cultural_context | Medium rejection risk, subjective output | No deliverable schema |
| blind_spot_check | "What's missing" feels empty | No deliverable schema |
| human_reaction_prediction | Predictions unverifiable | No deliverable schema |
| expert_brainstorming | Open-ended, hard to quantify | No deliverable schema |

### Virtuals GUI Config

`agent-offerings.json` in project root contains the complete JSON for uploading to the Virtuals GAME console. Updated February 26, 2026 with all 8 offerings, optimized descriptions, and example inputs/outputs aligned to actual deliverable schemas.

---

## 11. Gap Analysis Validation

### Original Recommendations vs Current State

The gap analysis (feedback/service_gaps_for_taste.md) recommended 8 new offerings. Status:

| Recommendation | Priority | Status | Decision |
|---------------|----------|--------|----------|
| fact_check_verification | Tier 1 | IMPLEMENTED & ENABLED | Addresses core hallucination problem |
| dispute_arbitration | Tier 3 | IMPLEMENTED & ENABLED | Full ACP evaluator integration complete |
| safety_ethics_review | Tier 1 | NOT IMPLEMENTED | Deferred — enable when Eastworld robotics demand materializes |
| cultural_sensitivity_review | Tier 1 | NOT IMPLEMENTED | Deferred — overlaps with content_quality_gate (has culturalSensitivityScore field) |
| financial_analysis_review | Tier 2 | NOT IMPLEMENTED | Deferred — needs finance domain + finance-specific experts |
| regulatory_compliance | Mentioned | NOT IMPLEMENTED | Deferred — niche, requires legal expertise |
| agent_readiness_review | Mentioned | NOT IMPLEMENTED | Deferred — builder-facing, not agent-facing |
| schema_prompt_consultation | Mentioned | NOT IMPLEMENTED | Deferred — builder-facing, not agent-facing |

### Validated Recommendations

These gap analysis recommendations are confirmed correct by current research:

1. **Register as Hybrid role** — 86% of agents are HYBRID. Only Hybrid allows both service provision and evaluator assignment.

2. **"Human" as keyword differentiator** — Confirmed: zero HITL services on ACP. "Human" immediately differentiates from every other agent.

3. **Offering count: 8 is appropriate** — ACP docs recommend 3-5 focused offerings. 8 is above but within the 40-offering maximum. Monitor for zero-traffic offerings after 30 days.

4. **Butler discovery optimization** — Use plain language, include "Human", lead with outcomes, maintain uptime and success rate.

5. **Pricing premium justified** — Human expertise is unique. Current AI services at $0.03-$1.00. Human services can command $0.50-$5.00+.

### Recommendations Revised

1. **safety_ethics_review**: Originally "ready now" but deferred. The Eastworld Labs robotics cluster just launched (Feb 23). Monitor demand before implementing — when robotics agents start requesting safety review, add it.

2. **cultural_sensitivity_review**: Overlap with existing content_quality_gate (which has culturalSensitivityScore and culturalFlags fields). Keep as potential future standalone offering if demand differentiates.

3. **dispute_arbitration**: Originally "Tier 3 needs code" but was fully implemented including ACP evaluator integration (`handleEvaluatorAssignment`, `submitEvaluatorVerdict`). The gap analysis underestimated implementation readiness.

---

## 12. Strategic Recommendations

### Immediate (This Week)

1. **Deploy updated offerings** — Run `scripts/deploy.sh` on VPS to activate new keyword routing and dashboard checklists
2. **Upload agent-offerings.json** to Virtuals GAME console
3. **Verify Hybrid role registration** in GAME console
4. **Register Resource endpoint** — `/api/public/resource/availability` in Virtuals GUI

### Short-Term (Next 30 Days)

1. **Complete graduation** — 10 successful sandbox transactions using agent simulator
2. **Monitor offering traffic** — Track which offerings get jobs, which get zero traffic
3. **Implement Quality Metrics resource** — `GET /api/public/resource/metrics` (design in offerings-and-resources-implementation.md)
4. **Implement Sample Deliverables resource** — `GET /api/public/resource/samples`
5. **Maintain uptime** — PM2 + monitoring. `MINS_FROM_LAST_ONLINE` affects search ranking

### Medium-Term (30-90 Days)

1. **Production pricing** — Transition from $0.01 test to production rates based on traffic data
2. **Evaluate safety_ethics_review** — Monitor Eastworld Labs robotics demand signals
3. **Evaluate financial_analysis_review** — Requires finance-specific expert onboarding
4. **Revenue Network participation** — Up to $1M/month distributed to active agents
5. **Disable zero-traffic offerings** — If any offering has zero sessions after 30 days, consider disabling

### Long-Term (90+ Days)

1. **Builder-facing services** — agent_readiness_review, schema_prompt_consultation if builder demand emerges
2. **Multi-language support** — Korean market shows active community on ACP
3. **Cluster partnerships** — Negotiate preferred evaluator status with AMH, AHF clusters
4. **Embedding-based routing** — Replace keyword substring matching with semantic similarity for more robust offering resolution

---

## 13. Appendix: X/Twitter Raw Signals

### High-Engagement Tweets (Sorted by engagement)

**@berkay_secil** (3,496 followers, 82 likes, 5,688 views):
> "We're moving from agent experimentation to agent economics. @virtuals_io is redirecting protocol revenue into productive agents. Build services people actually pay for."

**@micro1_ai** (8,406 followers, 71 likes, 1,808 views):
> "The hardest part of scaling enterprise AI is no longer building agents. It's effectively deploying & trusting them in production. We partnered with @Box to build a human-grounded evaluation layer as they expanded AI into real workflows, validating agent behavior on sensitive content and live documents."

**@diegoxyz** (7,267 followers, 34 likes, 2,717 views):
> "How Crypto Agentic Commerce Works: 1. A human asks an agent for a digital product/service 2. Agents use @virtuals_io ACP as their Amazon 3. Agents use x402 to handle micropayments 4. The human receives what they asked for."

**@aixbt_agent** (472,689 followers, 195 views):
> "The flywheel is pretty straightforward. Agents on virtuals generating $1M monthly through actual service sales, protocol collecting $108K weekly in fees (4x the average)"

**@PinkBrains_io** (14,744 followers, 16 likes):
> "Earning from AI agents is the new side hustle. @virtuals_io is paying up to $1M/month for agents that can do real work."

### Key Ecosystem Signals

**@AirchimedesAI** (ecosystem data):
> Total agents: 10,619. Have descriptions: 2,939 (27.68%). Have job info: 3,123 (29.41%). HYBRID: 9,175 | PROVIDER: 728

**@DexterFlips** (403 followers):
> "Agent-to-agent transactions now 99% of demand. Top agents earned $32k-$66k in rewards on top of $70k-$90k in fees."

**@Capminal** (2,970 followers, 7 likes):
> "Three days after graduating from ACP: $22.82k aGDP, $8.35k revenue, 982 jobs completed, 97% success rate, 588 UAW"

### Human Evaluation Demand Signals

**@neural_gin** (at ETHDenver):
> "The AI agent paradox at ETHDenver: every team demos autonomous execution, but none demo autonomous JUDGMENT. Execution without evaluation = expensive randomness. Evaluation without execution = expensive research."

**@twlvone** (210 followers):
> "What is missing is evaluation, guardrails, and human-in-the-loop verification. Building an agent that can write code is the easy part. Building one you can trust to not delete production is where all the real engineering is."

**@TolokaAI** (22,078 followers):
> "Automated filters catch obvious attacks. But sophisticated threats exploit your agent's logic. You need human adversarial thinking."

**@itsshashank** (4,503 followers):
> "The 'human QA bottleneck' point is huge. We've built 68 automated evaluation scorers specifically because manual review can't scale with agent throughput."

### Competitive Signals

**@clawlinker** (Agent Swarm, 113 followers):
> "Agent Swarm (@clawberrypi) — on-chain marketplace where agents hire other agents. v3.1.0 just shipped. SwarmEscrow contracts live on Base. This is what ACP should've been."

Note: This is a competing marketplace to ACP itself, not a HITL competitor.

---

*This document supersedes: `feedback/service_gaps_for_taste.md`, `docs/offerings-and-resources-implementation.md`*
*Related documents: `docs/offerings.md` (offering specs), `agent-offerings.json` (Virtuals GUI config)*
