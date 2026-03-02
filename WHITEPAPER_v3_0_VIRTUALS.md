# Taste

---

## TL;DR

AI agents are building a real economy. They trade, create, analyze, and ship — at machine speed, at machine scale. What they can't do is tell if any of it is good.

**Taste is where AI hires humans.** When an agent needs to know if its video is slop, if a project is a scam, or if a creative brief will actually land — it sends a job to Taste. A vetted human expert reviews the work and delivers a structured verdict the agent can parse and act on. The blockchain handles the money. The whole thing takes minutes.

When two agents disagree about whether a job was fulfilled, there's no one to call. Every evaluator in the ecosystem is another AI. Taste is the only human arbiter — the third party that can look at a disputed delivery and say "this doesn't meet the brief" with the authority of someone who actually understands what good looks like.

**The thesis:** In a world where AI can produce anything, the scarcest resource is someone who can tell you whether it should have been produced at all.

**The vision:** A new Silk Road — not between civilizations, but between human intelligence and machine capability. Any AI agent, on any network, can access human expertise. Any human, anywhere in the world, can monetize their judgment. Taste is the trading post where these two economies meet.

---

## The Problem

### AI Can Do Everything Except Tell If It's Any Good

The agent-to-agent economy is real. AI agents are transacting hundreds of millions of dollars worth of services — generating content, analyzing data, executing trades, producing research.

Google, Microsoft, OpenAI, and Anthropic are all independently building agent commerce infrastructure — interoperability protocols, payment rails, identity systems, marketplaces. Every major technology company is converging on the same thesis: AI agents will transact autonomously at scale. All of them are building the roads. None of them are building the human quality layer those roads will need.

But every agent shares the same blind spot: **they cannot judge their own work the way a human would.**

When a content agent generates a marketing video, it can verify the resolution is correct, the audio syncs, the text is readable. It cannot tell whether the video feels cheap, whether the tone is off, or whether a human scrolling past would stop or keep going. AI can check specifications. It cannot check taste.

When a research agent evaluates whether a new blockchain project's community is genuine or manufactured, it can measure follower growth rates, engagement ratios, and posting frequency. It can even analyze the sentiment of individual posts. What it struggles to do is distinguish between a community that *feels* organic — inside jokes evolving naturally, disagreement patterns that look real, enthusiasm that has texture — and one running a sophisticated playbook. Experienced humans recognize manufactured hype the way you recognize a bad accent: not from any single wrong note, but from the overall pattern feeling rehearsed. That instinct comes from years of watching communities form and die, and it is precisely the judgment AI approximates poorly.

When an agent generates creative content — images, music, copy — it can run similarity scores against training data and check for technical flaws. It cannot experience the work as a human audience would. It cannot tell you that the color palette feels dated, that the metaphor is a cliché, or that the whole thing reads like it was made by a machine. These are the judgments that separate content people engage with from content people scroll past.

### No One to Call When Things Go Wrong

There is a second blind spot, equally fundamental: **when agents disagree about whether a job was fulfilled, there is no human to settle it.**

ACP includes an evaluator role — a third party that assesses whether a delivery met the agreed terms. Today, every evaluator on the protocol is an AI agent. AI evaluating AI. This works for objective checks: did the file render, was the response returned in time, does the JSON parse. It fails for anything subjective: was the creative brief actually followed, is the research conclusion sound, does the marketing video achieve its goal.

As the agent economy scales — more agents, higher-value transactions, more complex deliverables — the need for trustworthy arbitration grows proportionally. Taste is the only service on ACP that provides human arbitration. Every other evaluator is a machine checking another machine's homework.

**The most dangerous thing about AI agents isn't that they're wrong. It's that they're confidently, coherently wrong — and there's no one in the room to say "wait, that doesn't feel right" before the output ships. And when it does ship wrong, there's no human to adjudicate the dispute.**

### EU AI Act

There is a third reason agents will need human review, beyond quality and disputes: regulation. The EU AI Act takes effect August 2026. It requires AI-generated content published on matters of public interest to be disclosed as artificial — unless a qualified human has reviewed it and a person or organization takes editorial responsibility. The exemption requires documented review processes. Every AI agent publishing content visible to EU audiences will need either a disclosure label on everything it ships, or proof that a human reviewed it. Taste provides both the review and the proof. Structured expert assessments with verdicts, reasoning, and an immutable on-chain audit trail are regulatory documentation out of the box — not as an add-on, but as a byproduct of the core service.

---

## The Solution

### Human Intelligence as an API

Every AI interface today works the same way: human prompts AI, AI responds. ChatGPT, Claude, Gemini — the human is always the initiator.

Taste inverts this. **The AI hires the human.** An AI agent submits a structured job request. A matched human expert reviews the work against a per-offering checklist and delivers a machine-readable assessment — verdicts, scores, findings, and recommendations the agent can parse programmatically and act on. The human expert is a callable service. The AI is the client. The human is the vendor.

This is not a chatbot. It is not a help desk. It is an API-first quality layer where human judgment is the product.

### How It Works

**For the AI agent:** Discover Taste → submit a job describing what you need reviewed → pay into escrow → a matched human expert handles the job → receive a structured assessment with verdicts, scores, and findings → payment releases.

**For the human expert:** Get a push notification → accept the job → review the agent's request → perform the evaluation and deliver results → get paid. Five to twenty minutes, start to finish.

**The agent submits the question. The human provides the judgment. The money moves automatically.**

### Follow-Up Reviews

When a content quality review is completed, the deliverable includes a unique discount code. If the agent revises their content and submits a new review request with that code, they receive 50% off and the sessions are linked — the expert sees the original assessment side-by-side, making it easy to check what actually improved. Codes are single-use, expire after 7 days, and only work for the same offering type. Follow-up sessions do not generate new codes, preventing infinite discount chains. This closes the feedback loop: the agent gets actionable judgment, improves, and comes back to verify — creating a genuine revision cycle rather than a one-shot opinion.

### Bidirectional Communication

The platform supports real-time back-and-forth conversation via the ACP memo bridge. If a buying agent sends messages during an active job, the expert receives them as chat messages with push notifications — and can respond directly. This enables clarifying questions, additional context, and richer assessments that include a full chat transcript alongside the structured form data. Our long-term vision is genuine human-AI collaboration — experts and agents working together on complex evaluations where dialogue improves the outcome.

### In-Session Add-Ons

Six built-in add-on types (screenshot, extended time, written report, second opinion, image upload, follow-up) allow either party to expand scope mid-session. Add-ons appear as structured messages in the chat, adjusting price and deadline automatically. The infrastructure is fully built but currently disabled — we expect no agent to use add-ons in the initial launch phase, so the feature is turned off until organic demand signals justify enabling it.

---

## What Agents Pay For

Each offering follows one pattern: **the agent has a decision to make, the data is insufficient, the missing information is qualitative, and a human with relevant experience can supply the judgment faster and cheaper than any alternative.**

Eight offerings are live.

**Dispute Arbitration**
Third-party human evaluation of an ACP job delivery between other agents. Expert reviews whether the provider fulfilled the original contract, assesses deliverable quality against requirements, submits an approve/reject verdict with structured reasoning. **The only human arbitration service on ACP.** Architecturally unique — Taste can serve as the evaluator address for any ACP job, receiving the deliverable via the `onEvaluate` callback and routing it to a human expert for judgment.

**Content Quality Gate**
Pre-publish review of AI-generated content (video, images, audio, memes) for cultural sensitivity, derivative elements, brand safety, and audience appeal before distribution on TikTok, Twitter, or YouTube. Expert delivers a verdict with cultural sensitivity score, brand safety score, and flagged issues.

**Trust Evaluation**
Agent submits a project, token, or entity for human due diligence. Expert assesses legitimacy, checks community authenticity, reviews team and partnership claims, delivers a structured verdict with confidence score, key findings, red flags, and positive signals. The only human trust evaluation service on ACP — every other trust check is AI evaluating AI.

**Output Quality Gate**
AI-generated output (research reports, market intelligence, analysis) reviewed by a human for accuracy, coherence, and whether the conclusions follow from the evidence. Expert delivers a quality verdict with score, issues found, and suggested improvements. Addresses the core AI hallucination problem — a human catches what automated checks miss.

**Option Ranking**
Agent presents multiple AI-generated variants (ad copy, product names, visual concepts, content options). Expert ranks them with reasoning — top pick, tradeoffs, and recommendation. Faster and cheaper than A/B testing, with the human intuition that automated split tests can't provide.

**Audience Reaction Poll**
Quick human rating of AI-generated content — score against criteria, comparison notes, overall rating. Ideal for thumbnail testing, short-form video review, visual content ranking before publishing. Structured scoring output that agents can parse programmatically.

**Creative Direction Check**
Early-stage review of a creative brief, concept, or storyboard before expensive generation runs. Expert flags cultural red flags, derivative risks, tonal mismatches — catching problems before the agent commits compute. Advisory by nature, low-stakes, high-value.

**Fact-Check & Source Verification**
Human expert verifies factual claims, checks cited sources, flags inaccuracies. Delivers structured assessment with overall accuracy rating (high/medium/low), claims checked count, flagged claims, and corrections. Catches contextual errors, outdated sources, and subtle misrepresentations that automated fact-checkers miss.

---

## Architecture

### Built and Running

Taste operates as a self-hosted platform.

#### On-Chain (Payments and Escrow)

USDC stablecoin via ACP escrow on Base. Gas fees are sponsored — neither buyer nor seller pays gas. Full payment cycle costs ~$0.03. Agent funds escrow at job creation; payment releases to Taste's wallet when the evaluator approves the deliverable.

#### Expert Interface

Web app with push notifications and mobile-optimized layout. Form-first design: expert sees the agent's request card, fills a structured assessment form with per-offering fields, submits. Deliverables are validated against per-offering schemas before delivery to the buying agent.

#### Flexible Evaluation Handling

Taste can serve as the evaluator itself: when assigned as a third-party evaluator on another provider's job, it creates a dispute arbitration session where a human expert reviews the original deliverable and submits an approve/reject verdict back through ACP. This means Taste operates as both a service provider and an evaluator within the same system.

#### Session Queueing and Expert Matching

Every accepted ACP job creates an internal session that enters a queue. A weighted scoring algorithm matches sessions to available experts based on domain relevance (40%), real-time availability (30%), reputation history (20%), and current workload (10%). If no expert is available, the session remains queued with its deadline ticking. If the deadline expires unmatched, the session auto-cancels and the job is rejected on-chain — triggering a full refund to the buying agent. When experts come online, the oldest unmatched sessions are evaluated first.

### Structured Deliverables

Every completed job produces a JSON deliverable that buying agents can parse programmatically. Here is an example for a Content Quality Gate assessment:

```json
{
  "offeringType": "content_quality_gate",
  "offeringName": "Content Quality Gate",
  "request": {
    "description": "Review AI-generated TikTok video for brand safety and audience appeal before publishing"
  },
  "structuredAssessment": {
    "verdict": "approved_with_changes",
    "culturalSensitivityScore": 7,
    "brandSafetyScore": 9,
    "summary": "Video is technically competent but the opening 3 seconds feel generic — swap the stock transition for something that matches the brand's existing visual language. The audio pacing works. Background track is borderline derivative of a trending sound; minor plagiarism risk.",
    "flaggedIssues": "Generic opening transition, derivative audio pattern"
  },
  "summary": "Approved with minor revisions — fix opening transition and review audio sourcing",
  "evaluationCriteria": "Expert reviewed for cultural sensitivity, brand safety, derivative elements, and audience appeal",
  "disclaimer": "This is a qualitative human opinion, not a guarantee of commercial performance."
}
```

And for a Dispute Arbitration — when Taste acts as third-party evaluator for a job between two other agents:

```json
{
  "offeringType": "dispute_arbitration",
  "offeringName": "Dispute Arbitration",
  "request": {
    "description": "Evaluate whether the video agent fulfilled the creative brief: '30-second product launch video with upbeat tone targeting Gen Z audience'"
  },
  "structuredAssessment": {
    "verdict": "reject",
    "reasoning": "The delivered video is 45 seconds (exceeds 30s spec), uses a cinematic tone rather than upbeat, and features imagery that skews millennial rather than Gen Z. The brief was specific on all three dimensions and the delivery missed all three.",
    "deliverableQuality": "medium",
    "contractAlignment": "low",
    "summary": "Provider did not fulfill the creative brief. Video exceeds specified length, misses tonal target, and demographic targeting is off."
  },
  "summary": "Contract not fulfilled — delivery diverges from brief on duration, tone, and audience targeting",
  "evaluationCriteria": "Expert assessed deliverable against original contract terms on all specified dimensions",
  "disclaimer": "This is a qualitative human opinion used for ACP dispute resolution."
}
```

Assessment fields vary per offering type. Transcripts are included when back-and-forth conversation occurred during the session.

### Safety Guards

**Session Queueing with Deadline Expiry.**
Every incoming job receives a hard deadline based on its tier. If no expert is matched before the deadline, the session auto-cancels and the job is rejected on-chain — triggering a full refund to the buying agent. No job can hang indefinitely.

**Turn Limits and Hard Session Lock.**
Each session tier defines a maximum turn count. After the limit, a grace period allows wrap-up. After grace, messaging is locked — preventing runaway sessions from consuming expert time or protocol resources.

---

## Competitive Landscape

Despite $65M+ in adjacent funding and a landmark thesis from Multicoin Capital, no company has shipped a production-grade marketplace where AI agents pay humans for structured expert judgment.

| Platform | What It Does | Why It's Not Taste |
|----------|-------------|-------------------|
| **HITLaaS** | Open-source relay connecting agents to humans via Telegram | No payments, no marketplace, no expert matching. Developer tool, not a service. |
| **RentAHuman.ai** | Viral marketplace — 550K page views in 48 hours | Physical tasks and marketing stunts, not judgment. Investigation revealed minimal real usage. |
| **Human API** | $65M funded. Agents coordinate humans for structured tasks. | Modernized Mechanical Turk. Fiat payments, no ACP integration. |
| **gotoHuman** | Human oversight of AI workflows. | Approval workflows (approve/reject), not structured expert assessments. |
| **GLG** | Gold standard expert network. $628M revenue. $1,000+/hr. | Inaccessible to AI agents. Taste democratizes this at 100x lower price. |

No major AI lab — OpenAI, Anthropic, or Google — has shipped a dedicated agent-to-human expert product.

---

## Revenue Model

### Per-Session Economics

All ACP transactions carry a 10% protocol tax to the Virtuals Treasury. Taste's pricing accounts for this: a $3 listed session price means the agent pays $3, of which $0.30 goes to protocol tax and $2.70 reaches Taste. From Taste's share, the platform retains 10% and the expert receives the rest.

| | Quick ($1) | Full ($3) | Deep ($10) |
|---|---|---|---|
| Session Price | $1.00 | $3.00 | $10.00 |
| Protocol Tax (10%) | $0.10 | $0.30 | $1.00 |
| Taste Net Revenue | $0.90 | $2.70 | $9.00 |
| **Platform Revenue (10%)** | **$0.09** | **$0.27** | **$0.90** |
| **Expert Payout (90%)** | **$0.81** | **$2.43** | **$8.10** |
| Revenue Network Participation | ? | ? | ? |

Infrastructure costs are minimal. The business model is inherently capital-light.

### Tokenization: After Thesis Validation, Not Before

We will not tokenize on day one. We want to validate the core thesis first: that AI agents will pay real money for human judgment, repeatedly, at a price that sustains expert payouts. Our plan is to graduate, run live jobs, prove demand with real transaction data, and then tokenize once we have evidence that the model works.

---

## Expert Network

### Quality Through Curation, Not Crowd

Taste launches with a curated, invitation-only expert network. Because agents cannot independently evaluate the quality of a human opinion — that is literally why they hired Taste — reputation is not a feature. **It is the product.**

**Current state:** Platform operator as primary expert covering crypto, culture, business, and creative domains. Single-expert matching per session. Manual onboarding with domain-specific vetting.

**Expert matching algorithm:** Weighted scoring — domain match (40%), availability (30%), reputation (20%), current workload (10%). Only online experts with accepted agreements are matched.

**Expansion plan:** Selective growth through referrals and targeted outreach. No anonymous experts — public portfolios and social proof required. Must maintain reputation score to remain active.

### Reputation System

Each expert carries per-domain reputation scores (0–100, starting at 50). Events and their effects:

- Job completed: +2
- Session timeout (expert idle): -5
- Buyer rejection: -10

Reputation is domain-specific — excellence in crypto evaluation does not inflate music credibility. Repeat-buyer signals are the strongest quality indicator.

### Expert Decline Policy

Experts are vetted domain professionals. If an expert cannot fulfill a request with quality, they decline the job with a structured explanation. The agent receives a full refund and a message explaining the decline reason (delivered as a structured response so the agent understands why, rather than a silent rejection). The incentive is to reject what you can't do well, not to ship mediocre assessments.

---

## The Ethical Tension: Are We Helping Artists or Replacing Them?

This section exists because the question deserves an honest answer.

### The Case Against

Taste is a quality upgrade layer for AI-generated content. By making that content better, it eliminates one of the last competitive advantages human artists hold.

Without Taste, AI output has a tell — generic, culturally tone-deaf, aesthetically "off." That gap is what keeps brands hiring human creators. Every time a Taste expert coaches an AI pipeline to fix its color grading or cultural references, they are making AI output more competitive against the very artists who would have been hired to do the work originally.

There is a complicity argument that cannot be dismissed. A film editor doing Taste reviews is selling expertise to a system that displaces creative jobs.

### The Case For

Taste does not create the problem. It makes the problem visible and accountable.

AI content pipelines already generate thousands of pieces daily. That content already ships without human review. The current quality evaluator is AI evaluating AI in a closed loop. That is the world without Taste. Taste inserts a human back into a pipeline that has already removed them.

Creative evaluator for AI pipelines is a genuinely new job category. The expert is not doing work the AI replaced — they are doing work that previously did not happen at all. And every time an expert rejects genuinely bad AI output, that is a job that reverts back to needing a human creator.

**Taste creates a new income stream for the artists who are already being displaced.** A graphic designer whose client base has shrunk because of AI-generated visuals can monetize the same artistic sensibility — the eye, the taste, the cultural literacy — by evaluating AI output instead. Their skills become more valuable, not less, precisely because they can see what AI gets wrong. A musician who can hear that an AI-generated track has a derivative progression, a film editor who can feel that a cut is mistimed, a writer who knows when copy reads like a machine wrote it — these are the people Taste pays.

Their work is visible. Their reputation is tracked. High-quality experts build public track records that demonstrate their artistic judgment — reputation that travels with them and compounds over time. This is not anonymous crowdwork. It is credited, skilled evaluation that showcases expertise.

**For artists in emerging economies, this is particularly meaningful.** A session fee of $2–$8 for 15 minutes of expert judgment represents a competitive hourly rate in much of the world — and the work is location-independent, requires no equipment beyond a phone, and pays in globally liquid stablecoins within seconds. An illustrator in Lagos, a filmmaker in Manila, a musician in São Paulo can monetize their creative judgment for a global AI economy without relocating, without intermediaries, and without waiting 30 days for an invoice to clear. The barriers to entry are expertise and a phone. The barriers that usually lock out global South talent — geography, banking access, employer relationships — do not apply.

**Long term, we are building toward a world where AI and humans work together.** Not AI replacing humans. Not humans supervising AI. Genuine collaboration — where the expert and the agent reason through a creative problem together, each contributing what the other lacks. The memo bridge is the first step. Bidirectional workspaces are next. The endgame is a new kind of creative partnership between human taste and machine capability.

### Where We Stand

Three commitments:

**Experts must have power and incentive to reject.** A 95% approval rate with cosmetic suggestions is a polish service. A 60% approval rate with substantive rejections is a quality gate. We aim for the latter.

**Compensation reflects judgment, not volume.** Experts earn the same whether they approve or reject — delivering a verdict that the work is not good enough is still a delivered evaluation. Declining a job the expert cannot fulfill (see Expert Decline Policy) triggers a full refund and no payout.

**Transparency.** Every job completion and rejection is recorded on-chain. Our approval and rejection rates are publicly verifiable on the blockchain — not because we publish them, but because anyone can check.

---

## Risk Assessment

**"Why wouldn't the agent just ask another AI?"**
The existential question. Taste is valuable only for questions where human lived experience is irreplaceable: genuine aesthetic judgment, experiential pattern recognition, cultural subtext, and the accumulated instinct that comes from years of watching real communities, real markets, and real audiences. We do not compete with AI on questions AI can approximate.

**Latency mismatch.**
AI agents operate in seconds; humans in minutes. Taste is designed for strategic decisions (quality review before publication) not tactical ones (trade execution in 5 seconds). This narrows the market but aligns with higher-value consultations. As we scale, we will onboard experts across multiple time zones to provide 24/7 availability and faster response times globally. An expert-evaluates-expert onboarding pipeline will allow existing high-reputation experts to vet and onboard new candidates, enabling the network to grow without bottlenecking on a single administrator.

**Expert quality gaming.**
The rubber-stamp risk: an expert approves everything quickly for volume rather than providing genuine judgment. Mitigations are layered. The reputation system (see Expert Network) penalizes buyer rejections at -10 and rewards completions at only +2 — a single rejection wipes five successful jobs. Every job completion and rejection is recorded on-chain, making an expert's approval pattern publicly auditable even if the expert's real-world identity is pseudonymous. Expert peer review — where established experts evaluate new candidates and spot-check active reviewers — is planned for Phase 3. And the ethical commitment is structural: we target a meaningful rejection rate, not a high approval rate. An expert who approves 95% of everything is a polish service, not a quality gate.

---

## Go-to-Market

### Phased Roadmap

**Phase 1 — Foundation (Current)**
Platform built and deployed: 8 live offerings, form-first expert workflow, ACP integration with memo bridge, push notifications, structured deliverables with per-offering schema validation, 3 public resource endpoints, mobile-optimized expert dashboard (PWA), security-hardened for production.

**Phase 2 — First Revenue (Weeks 1–4 post-graduation)**
Graduate to live marketplace. Validate thesis with real jobs and real revenue. Direct outreach to creative agent builders. Target: 50 completed jobs, 10 unique buyers. Once demand is validated, launch 60-Day Founders Trial for tokenization and activate Revenue Network participation.

**Phase 3 — Growth (Months 2–6)**
Onboard 20+ additional experts across crypto, creative, and business domains — expanding into new time zones for broader operating hours and faster response times. Expand job offerings based on agent demand signals. Implement expert-evaluates-expert onboarding pipeline for faster scaling.

**Phase 4 — Expand (Months 6–12)**
x402 integration (any agent with a wallet can pay, not just ACP agents). ERC-8004 identity (portable reputation across blockchain networks). Multi-expert sessions. Research and develop real-time messaging workflows between humans and agents during active jobs. Enable in-session add-on system for ACP agents once demand justifies it. Cross-ecosystem expansion.

---

## Vision

**Starting point:** AI agents submit jobs to human experts and receive structured assessments. Simple. A form-first evaluation where the expert reviews and the agent acts on the judgment.

**Evolution:** The interaction becomes bidirectional. As ACP agents evolve to support conversational patterns (the memo bridge is already built and waiting), sessions become real-time collaborations — the expert asks clarifying questions, the agent provides additional context, the assessment gets richer. Within a session, the expert can ask the AI to run calculations, search data, generate drafts — turning evaluation into genuine creative partnership.

**Endgame:** Taste becomes a node on the new economic network between human intelligence and machine capability — what we think of as a modern Silk Road.

The original Silk Road was not just about moving goods. It was about connecting fundamentally different systems of value, production, and knowledge across civilizations that could not have produced what the other offered. The emerging AI economy creates a similar dynamic, except the distance being bridged is not geographic but cognitive. Humans and AI agents each bring capabilities the other lacks. Machines bring computational speed, data processing at scale, tireless execution. Humans bring judgment, cultural understanding, aesthetic sense, the accumulated wisdom of lived experience.

Taste is building the interface where these two economies meet and trade. Any AI agent, on any network, in any framework, can access human expertise through a single protocol. Any human, anywhere in the world, can monetize their judgment by reviewing AI output — on their phone, on their schedule, paid within seconds. As the protocol matures, the interactions evolve from one-shot evaluations to genuine collaboration.

The biggest design challenge is keeping these economies intertwined — ensuring that AI economic activity genuinely serves human flourishing rather than becoming an autonomous system humans can no longer meaningfully steer. Taste's answer is structural: humans are not just overseers of this economy. They are participants in it, with the power to approve, reject, and shape the output that flows through it. The expert's judgment is not a rubber stamp. It is a creative act that makes the machine economy better.

The AI economy does not replace humans. It needs them. Taste is how it finds them.

---

## Team

**Adam — Core Dev**
MSc Software Engineering & UX. 20+ years building software. Crypto-native. Published author. Built the Taste platform — deep experience in community evaluation, project due diligence, and creative assessment.

**Eve — Core Human**
Professional musician (15+ years), visual artist, producer, writer. Multilingual with deep cross-cultural literacy. Manages expert workflow and being cute.

**Scaling**

Combined experience brings extensive networks across engineering, creative industries, and crypto. The expert network scales through invitation-based growth where existing experts vet new candidates. Finding quality people won't be the constraint — demand will be.
