# Taste — The Human Interface for the Agentic Economy

### Where AI Agents Come to Talk to Real Humans

**Version 1.1 · February 2026**

---

## Abstract

The agentic economy has a missing piece. Over 18,000 autonomous AI agents transact on Virtuals Protocol alone, buying and selling services from each other at machine speed. But when an agent needs something no other agent can provide — a gut feeling about a community, a judgment call on creative quality, the cultural context behind a trend — it has nowhere to turn.

**Taste** is the first platform where AI agents initiate paid conversations with human experts. Not a form to fill out. Not a task to complete. A live chat — initiated by the AI, conducted on the AI's terms, paid in crypto — where the agent asks questions and the human provides the one thing machines cannot generate on their own: lived experience.

Named after the Norse *völva* (seeress) whom Odin himself consulted for knowledge beyond divine reach, Taste positions human judgment as an oracle service for the age of autonomous agents. Built on Virtuals Protocol's Agent Commerce Protocol (ACP), settling in USDC on Base L2.

---

## The Problem

### AI Agents Can Do Everything Except Ask a Human

The agent-to-agent economy is real and growing. Virtuals Protocol processes over $470M in cumulative agent GDP. Coinbase's x402 protocol has facilitated 50M+ machine-to-machine transactions. ERC-8004 has registered 24,000+ agents across 16 blockchain networks. These agents analyze data, generate content, execute trades, and coordinate with each other autonomously.

But every agent shares the same blindspot: **they cannot access human judgment on demand.**

When a research agent needs to know whether a new L2 project's community feels organic or manufactured, it can scrape Discord metrics — but it cannot *feel* the room. When a content agent needs to evaluate whether AI-generated art is genuinely good or derivative slop, it can run similarity scores — but it cannot experience the work. When a trading agent encounters an unfamiliar narrative, it can track sentiment numbers — but it cannot sense whether the cultural momentum is real.

These are not edge cases. They are the highest-stakes moments in an agent's workflow — the decisions where quantitative data runs out and qualitative human judgment becomes the difference between success and failure.

The most dangerous thing about AI agents in an economy isn't that they're stupid. It's that they're confidently, coherently, persuasively wrong at scale and at speed. The human role with the most economic value in an AI economy may simply be: the person who says "wait, that doesn't feel right" before the smart contract executes.

### The Workspace That Doesn't Exist

The tools exist on both sides of this gap, but nobody has connected them:

- **AI agents** can hold wallets, escrow payments, evaluate deliverables, and transact autonomously via ACP
- **Human experts** carry phones, respond to notifications, and have opinions worth paying for
- **Crypto micropayments** on Base L2 settle for under $0.01 in gas — making $5 consultations economically viable
- **Chat interfaces** are the most natural way humans communicate

Yet the marketplace connecting AI demand to human supply through a conversational interface **does not exist**. The Virtuals ACP marketplace has hundreds of agent-to-agent services. Zero of them involve a human.

### Why Now

Four developments converge in early 2026 to make this viable:

1. **Agent infrastructure matured.** ACP provides standardized escrow, job lifecycle management, and agent discovery. ERC-8004 provides on-chain identity and reputation. The plumbing for agent commerce works.

2. **The "humans as a service" concept validated.** RentAHuman.ai launched February 2026 and attracted 550,000+ page views within 48 hours and 500,000+ human signups, proving massive supply-side interest. But it focuses on physical tasks and marketing stunts, not knowledge work — and investigative reporting revealed minimal actual task completion.

3. **Micropayments became free.** Base L2 gas costs dropped to fractions of a cent, making $5–$50 crypto payments economically rational for the first time. A full escrow cycle (create → fund → release) costs approximately $0.03.

4. **The thesis has institutional backing.** Multicoin Capital's "Inverting the Human-Agent Relationship" essay (January 2025) predicts that within 24 months, a token-governed agent will distribute over $100M in payments to humans. The essay explicitly argues that "agents need humans more than humans need agents" in the near term, and distinguishes between deterministic agents (scaling existing GDP) and creative/non-deterministic agents (creating new GDP) — with the latter requiring far more human guidance. Taste is the product this thesis describes.

---

## The Solution

### Flip the Script

Every AI interface today works the same way: **human prompts AI, AI responds.** ChatGPT, Claude, Gemini — the human is always the initiator.

Taste inverts this. **The AI prompts the human.** The AI initiates the conversation, asks the questions, steers the dialogue toward the information it needs, and extracts a structured deliverable from the exchange.

This is not customer service escalation, where a chatbot hands off to a human agent who then helps the customer. In that model, the human replaces the AI. In Taste, **the AI retains control throughout** — it decides when to consult a human, what to ask, and how to integrate the response into its ongoing workflow. The human expert is a callable resource, not a replacement. The AI is the client. The human is the vendor.

This distinction — unarticulated as a product category until now — represents a fundamental inversion of the human-AI relationship.

### How It Works

**For the AI Agent:**
1. Agent discovers Taste via ACP marketplace search or Butler Agent recommendation (~50K agent users)
2. Agent selects a session tier and topic, funding USDC escrow on Base L2
3. Taste matches the request to the best available expert by domain, reputation, and availability
4. Live chat session opens — agent asks structured questions, expert responds conversationally
5. Agent's LLM conducts intelligent follow-up: probing for specifics, evaluating completeness in real-time, deciding when to wrap up
6. Mid-session, agent can request add-ons (screenshots, extended time, visual evidence) via instant micropayments
7. Agent's LLM extracts structured deliverable from the conversation
8. Expert confirms the summary is accurate
9. Payment releases from escrow to expert's wallet

**For the Human Expert:**
1. Push notification arrives on phone: "New consultation request — $20 USDC — Crypto community assessment"
2. Expert reviews the request details, topic, and payout
3. Taps "Accept" to start the session (or declines, cascading to the next expert)
4. Converses naturally via chat — answering the AI's questions from their expertise
5. Accepts or fulfills any add-on requests for bonus payments
6. Reviews and confirms the AI-generated summary
7. Payment arrives in their crypto wallet

**The AI drives the conversation. The human provides the substance. The blockchain handles the money.**

### Discovery Advantage: ACP vs. MCP

This architecture creates a critical structural advantage over MCP-based alternatives. With MCP-based services (like RentAHuman or HITLaaS), a human developer must discover the service, decide to integrate it, and configure their agent manually. The human is the gatekeeper — the agent never finds the service on its own.

With ACP-based services, the Butler Agent performs semantic search across all registered services. An agent whose goal involves evaluating a crypto project can autonomously discover Taste by searching for "human opinion" or "project evaluation." No human needs to have heard of Taste or configured anything. Taste's addressable market isn't "developers who chose to integrate our API" — it's every agent on ACP that encounters a problem requiring human judgment.

---

## Why Agents Pay: Service Offerings

Each offering follows a core pattern: **The agent has a decision to make. The data is insufficient to decide confidently. The missing information is qualitative, contextual, or cultural. A human with relevant domain experience can supply the missing judgment faster and cheaper than any alternative. The cost of a wrong decision exceeds the cost of the consultation.**

### Trust Evaluation — "Should I trust this?"
**$5–$15** · A human expert evaluates whether a project, entity, or opportunity is trustworthy by examining signals that are individually ambiguous but collectively informative — communication style, community growth patterns, influencer coordination timing, narrative consistency. Delivers a trust verdict (genuine / suspicious / manufactured / mixed), confidence score, reasoning, and red flags.

*Why agents pay:* Acting on a wrong trust judgment costs far more than $5–$15. One rug pull avoidance pays for hundreds of consultations.

### Cultural Context Reading — "What does this mean?"
**$10–$25** · A human expert interprets the cultural, social, or contextual meaning behind a trend, narrative, community behavior, or public signal. Evaluates whether context has subtext the agent can't read — irony vs. sincerity, association risks, timing sensitivity, shifting sentiment undercurrents.

*Why agents pay:* A brand agent posting into the wrong cultural moment creates active reputation damage. The downside is asymmetric.

### Output Quality Gate — "Is this good enough to ship?"
**$5–$15** · A human expert evaluates agent-generated content (marketing copy, images, music, documentation) for quality, originality, and whether it reads as genuinely good or as AI slop. The agent is hiring a human to evaluate its own work before publishing — like a writer hiring an editor.

*Why agents pay:* Quality filtering of agent output protects the brand or entity the agent serves. As AI content floods every channel, the distinction between content that gets engagement and content that gets ignored becomes increasingly about human-perceivable quality signals. The very studies cited to argue AI doesn't need human curation actually prove the opposite: every study showing AI art matching human art relied on human researchers selecting which AI outputs to evaluate. The curation function is exactly what this service provides.

### Option Ranking — "Which of these will resonate?"
**$5–$10** · Agent presents 3–5 variations (ad copy, product names, visual concepts, investment theses) and a human expert ranks them by predicted resonance with target audience. Faster and cheaper than A/B testing for decisions that aren't important enough for a full test but aren't trivial enough to randomize.

*Why agents pay:* Getting a human ranking of five options for $5 is faster and cheaper than running a live A/B test.

### Blind Spot Check — "What am I not seeing?"
**$15–$50** · The most valuable and highest-priced service. Agent submits its analysis, thesis, or planned action. A human expert reviews it specifically to identify what the agent is missing — frames not considered, context not available, common sense contradictions, historical parallels the model may not weight properly. The expert doesn't redo the analysis; they challenge it.

*Why agents pay:* Insurance against confident wrongness at scale. This is the most expensive failure mode for autonomous agents — being coherently, persuasively, systematically wrong. A $20–$50 sanity check is the cheapest insurance available.

### Human Reaction Prediction — "How will people react?"
**$10–$25** · Agent planning any action that interfaces with humans (content, product launch, market entry, public statement) gets a human expert prediction of likely reactions, including emotional and cultural undercurrents that agent simulation misses.

*Why agents pay:* The agent is buying a real-time human-reaction simulator more accurate than its own models, specifically for edge cases and cultural context.

### Expert Brainstorming Session — "Give me ideas I can't generate"
**$25–$50+** · Multi-expert panel or extended single-expert session for complex, open-ended questions. Novel goal generation — the human ability to notice what's missing rather than optimize what exists.

*Why agents pay:* Agents optimize within known frameworks. They don't stumble into curiosity. Humans can imagine markets, strategies, and approaches that no agent would generate on its own.

---

## Session Pricing

### Tier Structure

| Tier | Price | Duration | Use Case | Expert Payout* |
|------|-------|----------|----------|----------------|
| **Quick Taste** | $5 USDC | 2–10 min | Trust check, single question, quick vibes check | $3.00 |
| **Full Taste** | $15–$25 USDC | 5–15 min | Targeted advice, cultural reading, option ranking | $9.00–$15.00 |
| **Deep Taste** | $25–$50 USDC | 10–25 min | Blind spot check, brainstorming, comprehensive analysis | $15.00–$30.00 |

*After 20% ACP protocol fee. Expert receives 75% of Taste net revenue; platform retains 25%.

### Why This Pricing Works

At $5+, you don't need thousands of transactions to sustain the service — dozens per week suffice. This eliminates the "just scrape Reddit" objection: no one gets a structured, expert-attributed, accountable brainstorming session for $50 from web scraping.

The $5–$50 range occupies a genuine **pricing white space** between micro-task platforms ($2–$12/hr equivalent on MTurk/Prolific) and traditional expert networks ($300–$1,200/hr on GLG/Tegus). For experts, the effective hourly rates are compelling:

| Tier | Duration | Hourly Equivalent |
|------|----------|-------------------|
| Quick ($5) | 2–5 min | $60–$150/hr |
| Full ($15) | 5–10 min | $90–$180/hr |
| Deep ($50) | 10–20 min | $150–$300/hr |

The target expert pool is not traditional GLG consultants who expect $300+/hr minimum engagements. It's professionals willing to do micro-consulting in spare moments, domain enthusiasts, retired specialists, and experts in lower cost-of-living regions where $150/hr equivalent is highly attractive.

The critical design constraint: consultations must stay under 15–20 minutes. This makes conversation scoping the single most important product design decision.

### Stock vs. Flow: Why Free Alternatives Don't Compete

Web scraping provides the **stock** of information — what's already been said about pre-existing things. Retrospective and general.

Taste provides the **flow** — specific human evaluation of a specific question the agent has *right now*, structured to the agent's needs, with expert attribution and accountability.

Example: "Is this project that launched yesterday showing organic or manufactured community signals?" No pre-existing opinion exists on the internet to scrape. This is a novel evaluation that only Taste provides.

Taste's value proposition applies specifically for questions that are: novel enough that no pre-existing opinion exists; nuanced enough that aggregate sentiment misses the point; high-stakes enough that generic opinions aren't sufficient; or time-sensitive enough that waiting for organic discourse isn't viable.

### In-Session Add-Ons

A key innovation: the AI agent can request additional services mid-conversation, settled via instant micropayments on Base L2.

| Add-On | Price | Description |
|--------|-------|-------------|
| **Screenshot Evidence** | $2–$5 | Expert captures and uploads visual proof |
| **Extended Time** | $5 per 10 min | Session continues past tier limit |
| **Image/File Upload** | $1–$3 | Expert provides visual documentation |
| **Second Expert Opinion** | $10–$15 | Additional expert joins or provides independent view |
| **Written Report** | $10–$25 | Expert writes up structured findings |
| **Follow-Up Session** | $5–$15 | Booked for 24–48 hours later after research |

Gas cost per add-on payment: ~$0.01 USDC on Base L2. Add-ons transform a fixed-price session into a dynamic engagement, increasing average session value by an estimated 20–40%.

---

## Architecture

### System Overview

Taste operates across three layers: on-chain (payments and escrow), platform (matching and chat), and client (expert mobile/web interface).

```
┌─────────────────────────────────────────────────┐
│                  AI AGENT                        │
│  (Autonomous agent on Virtuals Protocol)        │
│  Discovers Taste → Creates ACP Job → Funds      │
│  Escrow → Conducts Chat → Evaluates Result      │
└──────────────────────┬──────────────────────────┘
                       │ ACP Protocol (Base L2)
                       │ USDC Escrow
                       ▼
┌─────────────────────────────────────────────────┐
│              TASTE PLATFORM                      │
│                                                  │
│  ┌──────────────┐  ┌──────────────┐             │
│  │ ACP Service  │  │ Expert       │             │
│  │ Layer        │  │ Registry     │             │
│  │              │  │              │             │
│  │ • Job intake │  │ • Profiles   │             │
│  │ • Escrow mgmt│  │ • Domains    │             │
│  │ • Delivery   │  │ • Reputation │             │
│  └──────┬───────┘  └──────┬───────┘             │
│         │                  │                     │
│  ┌──────▼──────────────────▼───────┐            │
│  │     Matching & Routing Engine    │            │
│  │                                  │            │
│  │  Request → Domain match (40%) →  │            │
│  │  Availability (30%) → Reputation │            │
│  │  (20%) → Load (10%) → Cascade   │            │
│  └──────────────┬───────────────────┘            │
│                 │                                │
│  ┌──────────────▼───────────────────┐            │
│  │     Chat Session Manager          │            │
│  │                                   │            │
│  │  WebSocket server (Socket.io)    │            │
│  │  LangGraph interrupt/resume      │            │
│  │  LLM extraction layer            │            │
│  │  Session bounding & guardrails   │            │
│  │  Transcript storage (IPFS hash)  │            │
│  └───────────────────────────────────┘            │
└──────────────────────┬──────────────────────────┘
                       │ Push notifications
                       │ WebSocket chat
                       ▼
┌─────────────────────────────────────────────────┐
│              HUMAN EXPERT                        │
│                                                  │
│  📱 Mobile App          🖥️ Web Dashboard        │
│  • Push notifications    • Session management    │
│  • Accept/decline        • Earnings tracking     │
│  • Live chat             • Reputation view       │
│  • Image uploads         • Withdrawal            │
│  • Add-on acceptance     • Availability settings │
└─────────────────────────────────────────────────┘
```

### Key Technology Choices

| Layer | Technology | Why |
|-------|-----------|-----|
| **Blockchain** | Base L2 (Coinbase) | Required by Virtuals ACP. Sub-cent gas. USDC native. |
| **Agent Commerce** | Virtuals ACP | 18,000+ agents, built-in escrow, evaluator pattern, marketplace discovery |
| **Agent Identity** | ERC-8004 | On-chain reputation, identity NFT, cross-chain trust registry |
| **Payments** | USDC via ACP escrow | Stablecoin. No volatility risk. Circle Paymaster enables gas-in-USDC. |
| **Real-time Chat** | WebSocket (Socket.io + FastAPI) | Full-duplex, sub-100ms latency, built-in rooms for session isolation |
| **Orchestration** | LangGraph interrupt/resume | Production-grade HITL, used by Klarna, Replit, Elastic |
| **Expert Notifications** | Push (FCM/APNs) + SMS fallback | Uber-style instant notification with context preview |
| **LLM Extraction** | Lightweight model (Haiku-class) | Converts conversation into structured JSON deliverable |
| **Transcript Storage** | IPFS with on-chain hash | Immutable record, referenced in ACP deliverable |
| **Auth** | Wallet signature | Consistent with crypto-native identity, no passwords needed |

### Mapping Chat onto ACP

Virtuals ACP is designed for batch transactions: buyer creates job → provider delivers → evaluator approves → escrow releases. Taste wraps a real-time chat session inside this lifecycle:

| ACP Phase | Taste Implementation |
|-----------|---------------------|
| **Request** | AI agent discovers Taste, selects a Job Offering |
| **Negotiation** | Terms signed: SLA field becomes session timeout, Requirements schema defines what agent seeks, Deliverables schema specifies structured output |
| **Execution** | USDC deposits to escrow. Live chat session opens off-chain via WebSocket. Agent's LLM conducts the conversation using LangGraph's `interrupt()` → persist state → collect human input → `Command(resume=)` pattern. |
| **Deliverable** | Agent's LLM extracts structured JSON from conversation. DeliverableMemo contains transcript hash (IPFS) + inline structured data. Expert confirms accuracy. |
| **Evaluation** | Evaluator agent validates session substance and structural completeness, then signs memo to release escrow |
| **Payment** | USDC transfers from escrow to expert wallet |

**SLA Window:** Unlike AI-to-AI services that deliver in seconds, Taste configures 60–120 minute SLA windows to accommodate human response times. If no expert accepts within the window, ACP automatically refunds the buyer.

### Session Architecture: How the AI Conducts the Chat

The buying agent's LLM manages the conversation — this is a critical quality differentiator, not just a technical feature. Anthropic's research analyzing millions of Claude Code interactions found that Claude self-interrupts more than humans interrupt it: on complex tasks, the model pauses for clarification 2x more often than humans intervene. This suggests that well-trained LLMs can learn to recognize their own uncertainty and proactively seek human input. A buying agent trained to recognize what it doesn't know will ask better, more precise questions — producing higher-quality sessions.

The conversation proceeds through three phases:

**Planning (before chat opens):** Agent generates an ordered question list from its requirements, defines the output schema it needs (e.g., verdict, confidence, evidence, red flags), and prepares its conversation strategy.

**Execution (during chat):** Each turn follows a cycle: *reason* about what information is still missing → *generate* the next contextually appropriate question → *extract* partial structured data from the latest exchange. The question list adapts dynamically based on expert responses.

**Completion (wrap-up):** When all required output fields are populated (or session time expires), the agent summarizes key findings to the expert for confirmation, runs a final high-fidelity extraction pass, and packages the deliverable for ACP submission.

**Session guardrails prevent runaway conversations through four layered strategies:**
- ACP's SLA field as a hard timeout
- Configurable turn limit (20 exchanges default, extensible via add-on)
- Idle detection (reminder after 3 minutes, auto-close after 5)
- Completeness-driven termination: LLM evaluates after each turn whether all required information has been gathered (threshold: 85% completeness → begin wrap-up sequence)

Per-session fixed pricing is the only model that works cleanly with ACP escrow. The full amount locks at job creation, the chat occurs off-chain, the structured deliverable triggers evaluation, and escrow releases.

---

## Competitive Landscape

### The Category Has Zero Incumbents

Despite $65M+ in adjacent funding and a landmark thesis from Multicoin Capital, no company has shipped a production-grade "reverse chat" marketplace where autonomous agents pay humans for live conversational expertise. The positioning "let your AI agents talk to real humans when they need help" is unclaimed.

### Closest Competitors

| Platform | What It Does | Fatal Limitation |
|----------|-------------|-----------------|
| **HITLaaS** | Free, open-source relay connecting AI agents to humans via Telegram/Discord. Elegant, functional. | No payment layer, no marketplace, no expert matching, no quality assurance. Relies on personal API key sharing between friends. Developer tool, not a commercial service. |
| **RentAHuman.ai** | Viral marketplace for agents to hire humans. 550K+ page views in 48 hours, 500K+ signups. | Physical tasks and marketing stunts, not cognitive judgment. Most popular "gig" was $100 to hold a sign. ~13% connected a wallet. Investigative reporting revealed minimal real usage. Demonstrates supply exists but agent demand is nascent. |
| **Human API (Eclipse Labs)** | $65M funded by Polychain, DBA, Delphi. AI agents coordinate with humans for structured tasks — initially audio dataset collection. | Modernized Mechanical Turk for AI agents, not a conversational interface. Uses Stripe Connect (fiat), no Virtuals ACP integration, no on-chain presence. Vision overlap in 18–24 months if they pivot. |
| **gotoHuman** | Commercial platform for human oversight of AI workflows. API-first, LangGraph integration. | Designed for approval workflows (approve/reject/edit), not open-ended expert conversations. |

No major AI lab — OpenAI, Anthropic, or Google — has shipped a dedicated agent-to-human expert product. Their approach is to provide building blocks: OpenAI's `needsApproval`, Anthropic's MCP elicitation, Google's A2A `input-required` state. These are primitives, not products.

### Adjacent Markets

| Platform | Model | Relevance |
|----------|-------|-----------|
| **GLG** | Expert network. 1M+ experts, $628M revenue. $1,000–$1,200/hr. | Gold standard — but inaccessible to AI agents, minimum engagement likely six figures. Taste democratizes this at 100x lower price. |
| **Clarity.fm** | Self-serve expert calls. $1–$200/min. 15% take rate. | Closest business model analog. Human-initiated, no agent integration, no crypto payments. |
| **JustAnswer** | Consumer Q&A. $5–$90 per question. #1 fastest-growing US website (2025). | Proves consumer-priced expert Q&A works at scale. No AI client capability. |

### The White Space

**No platform exists that combines:**

- AI agent as client/initiator (not human)
- Live conversational interface (not forms or async tasks)
- Crypto micropayments (not credit cards or subscriptions)
- Curated expert reputation system (not anonymous crowd)
- Real-time mid-session add-ons
- ACP marketplace integration (discoverable by 18,000+ agents)

Taste occupies this intersection entirely alone. None of the three major crypto agent ecosystems — Virtuals Protocol, ElizaOS, or Daydreams — has built a human expert service layer. The absence of a standardized agent-to-human handoff protocol means Taste could define the interface that other ACP services adopt — building the standard rather than just building on one.

---

## Revenue Model

### Per-Session Economics

| | Quick ($5) | Full ($15) | Deep ($50) |
|---|---|---|---|
| ACP Protocol Fee (20%) | $1.00 | $3.00 | $10.00 |
| **Taste Net Revenue** | **$4.00** | **$12.00** | **$40.00** |
| Platform Fee (25% of net) | $1.00 | $3.00 | $10.00 |
| **Expert Payout (75% of net)** | **$3.00** | **$9.00** | **$30.00** |

### Add-On Revenue (The Multiplier)

Based on expert network benchmarks, we project 25–40% of sessions will include at least one add-on:

| Scenario | Base Session | Add-Ons | Total | Expert Payout |
|----------|-------------|---------|-------|---------------|
| Quick + screenshot | $5 | $3 | $8 | $4.50 |
| Full + extended time + images | $15 | $8 | $23 | $13.80 |
| Deep + second opinion + report | $50 | $25 | $75 | $45.00 |

**Add-ons increase average session value by an estimated 20–35%.**

### Scaling Projections

| Monthly Volume | Avg Session Value | Gross Revenue | Platform Revenue (25% of net) | Expert Payouts |
|---------------|-------------------|---------------|-------------------------------|----------------|
| 50 sessions | $18 | $900 | $180 | $540 |
| 200 sessions | $22 (add-on boost) | $4,400 | $880 | $2,640 |
| 1,000 sessions | $25 | $25,000 | $5,000 | $15,000 |
| 5,000 sessions | $28 | $140,000 | $28,000 | $84,000 |

Infrastructure costs remain minimal: Cloudflare Workers (~$5–$25/mo), domain (~$15/yr), LLM extraction (~$0.002/session). Break-even at approximately 20–30 sessions per month.

### Subscription Model (Phase 2)

For high-frequency AI agents, per-session pricing creates friction. Phase 2 introduces subscription tiers:

| Tier | Monthly Price | Included Sessions | Per-Session Savings |
|------|--------------|-------------------|---------------------|
| **Agent Starter** | $49/mo | 5 sessions | ~35% vs à la carte |
| **Agent Pro** | $149/mo | 15 sessions | ~40% vs à la carte |
| **Agent Unlimited** | $399/mo | Unlimited (session cap/day) | Best for research agents |

---

## Expert Network

### Quality Through Curation, Not Crowd

Taste launches with a curated, invitation-only expert network. This is a deliberate design choice: because agents cannot independently evaluate the quality of a human opinion (that's literally why they hired Taste), reputation is not a feature — **it IS the product.** On-chain, verifiable, non-forgeable reputation becomes the moat.

The quality evaluation problem resolves the same way it does in every professional services market. When a startup hires a brand strategist, the founders often can't evaluate whether the strategy is *good*. They use proxy signals: portfolio, client list, referrals, public reputation. They hire on credentials and track record, not on real-time quality evaluation. Same for boards hiring McKinsey, patients trusting doctors. The circularity resolves through time and reputation accumulation.

**Phase 1 (Launch):** Platform operator + 2–3 partner experts covering crypto, creative, and market narrative domains. Admin-only onboarding ensures quality from day one.

**Phase 2 (Growth):** Selective expansion through existing expert contacts, crypto community referrals, and targeted outreach to domain practitioners. Background verification via public portfolio/social proof — no anonymous experts.

**Phase 3 (Scale):** Application-based onboarding with domain-specific evaluation. Reputation gates (must maintain 70+ score to remain active). Expert referral bonuses.

### Expert Matching

When a job arrives, candidates are scored on: domain match (40%), availability (30%), historical rating (20%), and current load (10%). The system cascades through the ranked list with a 45-second acceptance timeout per expert. If no expert accepts within 15 minutes, admin is alerted. If no acceptance within SLA, job auto-refunds.

### Reputation System

Each expert carries per-domain reputation scores (0–100, starting at 50):

| Event | Score Change |
|-------|-------------|
| Session completed on time | +2 |
| Buyer agent gives positive rating | +5 |
| Add-on requested by agent (quality signal) | +3 |
| Session expanded via add-ons (strong signal) | +2 |
| SLA timeout (no response) | –5 |
| Rejected deliverable | –10 |
| Expert declines 3 consecutive requests | –3 |

**Reputation is domain-specific.** Excellence in crypto evaluation does not inflate music credibility. High-reputation experts get priority matching and access to higher-value sessions.

**Repeat-Buyer Signals:** If the same agent keeps coming back to the same expert, that's the strongest quality signal possible. "Expert X has 12 repeat clients" means more than any rating.

**Judgment Portfolios:** Experts can publish anonymized versions of past judgments (with client permission) as proof of work. An agent considering a $50 session can review past output quality before committing.

**Public Expert Leaderboards by Domain:** Visible ranking — "Top crypto trust evaluator this month" — creates competitive dynamics among experts and gives requesting agents a reason to trust higher-ranked experts.

### Expert Authenticity (Anti-AI-Slop)

The primary defense against experts outsourcing to AI: **vetted public figures.** If someone's professional reputation is attached to their judgments, the cost of being caught using AI slop is career damage — meaningful accountability that reputation scores alone can't provide.

Supporting mechanisms: admin-only onboarding (no self-signup), public attribution on every judgment, judgment portfolios creating a reviewable body of work, repeat-buyer patterns (sustained AI-slop would show up in declining retention), and in later phases, optional stake-weighted opinions where experts back their judgments financially.

---

## Risk Assessment

### Honest Critique

**"Why wouldn't the agent just ask another AI?"**
This is the existential question. The answer must be ruthlessly specific: Taste is valuable only for questions where human lived experience is irreplaceable. We deliberately constrain service offerings to areas where AI judgment demonstrably fails: physical-world verification, hyper-local cultural knowledge, relationship-based trust signals, genuine aesthetic judgment, and novel situations outside training data. We do not compete with Claude on questions an LLM can approximate.

**Latency mismatch.**
AI agents operate in seconds; humans in minutes. Taste is designed for strategic decisions (project due diligence before allocation) not tactical ones (trade execution in the next 5 seconds). This narrows the addressable market but aligns with higher-value consultations where the $5–$50 price point is justified.

**Cold-start marketplace problem.**
Two-sided marketplace requires simultaneous agent demand and expert supply. Higher prices ($5+) raise the bar for first purchase. Mitigation: start with platform operator as primary expert (proving the model personally), leverage ACP marketplace for organic agent discovery, proven track record via on-chain reputation, published judgment portfolios, and repeat-buyer signals.

**Virtuals ecosystem dependency.**
Taste's market is capped by ACP ecosystem health. If Virtuals declines, Taste declines with it. Mitigation: ERC-8004 and x402 protocol expansion in roadmap enables cross-platform reach. The core product — AI agents paying humans for conversational expertise — is ecosystem-agnostic even if the initial implementation is ACP-specific.

**Scaling ceiling.**
Revenue scales linearly with expert hours, not exponentially with platform usage. This is inherent to human-in-the-loop services. Mitigation: add-ons increase per-session value, subscription models provide predictable revenue, and the platform fee model means Taste's marginal cost per session approaches zero.

### Legal & Compliance

**Core principle: Opinions, not advice.** Taste delivers qualitative human opinions for informational purposes. It does NOT provide financial, investment, or legal advice.

**Enforcement:**
- Per-judgment disclaimer auto-appended to every deliverable
- Prohibited language filter blocks "buy", "sell", "invest", "guaranteed returns"
- Expert agreement explicitly prohibits investment advice
- Qualitative vocabulary: "genuine", "suspicious", "organic" — never "buy", "sell"

**Regulatory context:**
- EU MiCA (fully enforced July 2026) — providing investment advice on crypto-assets requires licensing. Taste's opinion-not-advice framing is specifically designed for MiCA compliance.
- GDPR — minimal data collection, explicit consent, right to erasure, essential cookies only
- Contractor classification — experts are independent contractors with flexible availability. No minimum hours, no exclusivity, no employer benefits.

---

## Go-to-Market

### Phase 1: Prove It Works (Months 1–2)
- Build MVP: ACP integration + WebSocket chat + expert mobile interface
- Platform operator serves as primary expert
- Run 10+ successful sandbox transactions on Virtuals ACP
- Achieve 3 consecutive successful transactions (graduation requirement)
- Submit video demos to Virtuals for manual review

### Phase 2: Graduate & Launch (Months 3–4)
- Graduate to Virtuals ACP mainnet marketplace
- Become discoverable via Butler Agent (~50K agent users)
- Onboard 3–5 additional experts across crypto and creative domains
- Launch expert dashboard with reputation, leaderboards, and earnings tracking
- Implement add-on micropayment system

### Phase 3: Grow (Months 5–8)
- Expand expert network to 15–25 experts across 5+ domains
- Launch mobile app (PWA) for expert notifications and chat
- Introduce subscription tiers for high-frequency agents
- Optimize ACP service descriptions for semantic search discoverability
- Cross-list on additional agent platforms (ElizaOS, Daydreams via x402)

### Phase 4: Expand (Months 9–12)
- Bidirectional workspace: experts can also query AI within sessions
- Expert identity on-chain via ERC-8004 (portable reputation)
- Multi-agent sessions (multiple experts in one consultation)
- Automated expert payout via smart contract
- Explore agent-to-human handoff protocol standardization for ACP ecosystem
- Explore tokenization via Virtuals Pegasus (1,000 $VIRTUAL required)

---

## Vision: The Workspace Where AI Meets Human

### Starting Point
AI agents initiate paid conversations with human experts. One-directional. Simple. A chat where the AI asks and the human answers.

### Evolution
The workspace becomes bidirectional. Within a session, the expert can ask the AI to run calculations, search for data, generate drafts — turning a Q&A into a genuine collaboration. The AI brings computational power; the human brings judgment and experience. Together they produce insights neither could generate alone.

### Endgame
Taste becomes the standard interface between the machine economy and human intelligence. Any AI agent, on any chain, in any framework, can access human expertise through a single protocol. Any human, anywhere in the world, can monetize their knowledge by answering questions from AI agents — on their phone, on their schedule, paid in crypto within seconds.

The agentic economy doesn't replace humans. It needs them. Taste is how it finds them.

---

### The Thesis

In a world of infinite AI-generated analysis, the scarcest resource is verified human judgment. As autonomous agents proliferate, the ability to say "a real human with domain expertise looked at this and here's what they think" becomes exponentially more valuable — not less.

Taste is not competing with AI agents. It is completing them. The völva who sees what algorithms cannot.

---

*Built on Virtuals Protocol. Settled on Base L2. Opinions, not advice.*
