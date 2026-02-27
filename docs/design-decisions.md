# Design Decisions Log

Captures the **why** behind non-obvious choices. Updated as we tune the system.
Check this before changing deliverable format, offering schemas, or ACP integration.

---

## Deliverable Format (ACP output)

The JSON delivered to buying agents via `job.deliver()`.

### 2025-02-25: Slim deliverable — remove internal noise

**Context:** First real deliverable from a live ACP session had 15+ fields. Half were internal metadata (turnCount, maxTurns, tier, addons, expert name, sessionId) that buying agents can't use. ACP agents need to parse the JSON programmatically — every irrelevant field is noise.

**Decision:** Strip to essential fields only:
- `structuredAssessment` — the core value (verdict, scores, findings)
- `summary` — human-readable summary (top-level, not nested in `result`)
- `offeringType` / `offeringName` — what service was performed
- `request` — what was asked (parsed as object if JSON, string otherwise)
- `attachments` — signed evidence URLs if present
- `evaluationCriteria` — hints for the ACP evaluator to verify quality
- `transcript` — only when there was actual expert-agent conversation (>0 expert messages)
- `disclaimer` — legal boilerplate (kept for liability)

**Removed:**
- `sessionId` — internal ID, useless to external agent
- `tier` — internal pricing concept
- `turnCount` / `maxTurns` — internal guardrails
- `addons` — internal billing, not relevant to deliverable quality
- `expert.name` / `expert.publicProfile` — privacy concern + agents don't care who reviewed
- `result.expertResponseCount` / `result.expertWordCount` — vanity metrics
- `totalPrice` — agent already knows what they paid
- `duration` — nice-to-know but not actionable
- `status` — always "completed" when delivered (redundant)

**Rationale:** ACP deliverables are consumed by AI agents, not humans. Agents need structured data they can parse and act on. Every unnecessary field increases the chance of parsing errors and wastes tokens if the agent feeds the deliverable to an LLM.

### 2025-02-25: Parse JSON descriptions

**Context:** Agents send structured JSON as their requirement (e.g. `{"aiOutput":"...", "outputType":"analysis"}`). We stored it via `JSON.stringify(requirements).slice(0, 500)`, so the deliverable had a JSON-string-inside-JSON: `"description": "{\"aiOutput\":\"...\"}"`.

**Decision:** Try `JSON.parse()` on the description before including it in the deliverable. If valid JSON, include as object. If not, keep as string. Zero risk — worst case is the same string.

### 2025-02-25: Summary fallback chain

**Context:** When expert fills structured form but no separate summary and no chat messages, `result.summary` was null. The structured data's own `summary` field had content but wasn't checked.

**Decision:** Fallback chain: form summary field → `structuredData.summary` → last expert chat message → null. This ensures the summary is never null when the expert provided one anywhere.

### 2025-02-25: expertWordCount fix

**Context:** `"".split(/\s+/).length` returns 1 (splits to `[""]`), so sessions with zero expert messages showed `expertWordCount: 1`.

**Decision:** Check `expertMessages.length > 0` before computing word count. Return 0 for no messages. (Note: this field was later removed in the slim deliverable, but the fix remains in the code for internal use.)

### 2025-02-25: Transcript only when meaningful

**Context:** Many sessions have zero expert chat messages — the expert fills the structured form directly without chatting. The transcript in these cases contains only the seeded agent requirement message (which is already in `request.description`). This is pure noise.

**Decision:** Only include `transcript` in the deliverable when there are expert messages. If the expert only used the structured form, the transcript adds nothing. The agent already has the request in `request.description` and the assessment in `structuredAssessment`.

---

## Offering Schemas

### 2025-02-25: Per-offering field definitions

**Context:** Different offerings need different structured fields (trust_evaluation needs verdict + confidence, output_quality_gate needs qualityVerdict + qualityScore, etc.)

**Decision:** Field definitions live in `config/deliverable-schemas.ts` with a `DeliverableFieldDef` interface. Each offering has its own field set. Unknown offerings get a fallback schema with just `summary` + optional `verdict` + `keyFindings`. Zod schemas are built dynamically from field definitions for server-side validation.

**Trade-off:** Adding a new offering requires adding its fields to `deliverable-schemas.ts`. But this is intentional — we want explicit control over what fields each offering produces, not a generic catch-all.

---

## File Attachments

### 2025-02-25: HMAC signed URLs for ACP access

**Context:** ACP agents can't authenticate against our API (no JWT). They need to access uploaded evidence files.

**Decision:** Stateless HMAC-signed URLs: `/api/public/files/{attachmentId}?expires={ts}&sig={hmac}`. HMAC = SHA256(JWT_SECRET, attachmentId + expires). 24h expiry.

**Rationale:** No database table for tokens, no cleanup cron. Reuses existing JWT_SECRET. 24h covers the evaluation window. If we need to revoke, we can rotate the secret (nuclear option) or add a revocation check later.

### 2025-02-25: Local disk storage with UUID filenames

**Context:** Files uploaded by experts as evidence during sessions.

**Decision:** Store at `{UPLOAD_DIR}/{sessionId}/{uuid}.{ext}`. Original filename in DB only. Magic byte validation before write. 5MB per file, 20MB per session.

**Rationale:** Single-server architecture (SQLite). Clean `StorageBackend` interface for future S3 swap. UUID filenames prevent path traversal even if sanitization fails.

---

## ACP Integration

### 2025-02-25: Offering routing via keyword map

**Context:** ACP jobs arrive with a `name` field set by the buying agent. We need to route to the correct offering type.

**Decision:** `OFFERING_NAME_MAP` in `services/acp.ts` maps keyword substrings to offering types. Underscores normalized to spaces. Case-insensitive. Falls back to `trust_evaluation` if no match.

**Trade-off:** Fragile with many keywords — substring matching can have false positives. But robust matching (embeddings, fuzzy) is overkill for MVP. The keyword map is easy to extend and debug.

### 2025-02-25: Push notifications for ACP sessions

**Context:** ACP sessions only called `notifyExpert()` (WebSocket) when a new session was matched or a buyer memo arrived. If the expert's browser tab was closed, they had no idea about new jobs or messages — push notifications were only wired up for dashboard-created sessions in `routes/sessions.ts`.

**Decision:** Added `sendPushToExpert()` calls to `services/acp.ts` in two places:
1. New ACP session matched to expert (alongside existing `notifyExpert`)
2. Memo bridge injecting buyer agent messages into chat

All `sendPushToExpert` calls (both ACP and dashboard routes) now have `.catch()` to log errors instead of creating unhandled promise rejections.

**Rationale:** ACP is the primary traffic source. Experts need to know about incoming work even when their phone/laptop is locked. Fire-and-forget with `.catch()` is correct — push failures shouldn't block the main flow, but silent swallowing makes debugging impossible.

### 2025-02-25: Awaiting Payment indicator

**Context:** ACP sessions have a gap between session creation (REQUEST phase) and payment (TRANSACTION phase). During this time, the expert sees the session but payment hasn't arrived.

**Decision:** `payment_received_at` column on sessions table. Set idempotently in TRANSACTION handler with `WHERE payment_received_at IS NULL`. Dashboard shows amber "Awaiting Payment" badge for ACP sessions without payment.

**Rationale:** Idempotent guard prevents double-set from WebSocket + polling race. Expert needs visibility into payment status to manage expectations.

### 2026-02-26: Test pricing ($0.01 all tiers)

**Context:** Pre-launch testing on mainnet. Real on-chain transactions needed but don't want to burn dollars per test session.

**Decision:** All tier price ranges set to `[0.01, 0.01]` (quick, full, deep). Test tier already at 0.01. Will revert to production prices after validation.

### 2026-02-26: Fact-Check & Source Verification offering

**Context:** Agents need to verify factual claims before publishing or acting on AI-generated content. Common use case: "Is this claim true? What are the sources?"

**Decision:** `fact_check_verification` offering with fields: overallAccuracy (high/medium/low), claimsChecked (count), summary, flaggedClaims, corrections. Enabled by default, routed via keywords: "fact check", "source verification", "verify facts", "check accuracy".

### 2026-02-26: Dispute Arbitration (evaluator feature)

**Context:** ACP SDK supports a third-party evaluator role. When another agent creates a job with Taste's wallet as `evaluatorAddress`, the SDK fires `onEvaluate`. Previously, `handleEvaluate()` only handled post-delivery outcomes for our OWN provider jobs (COMPLETED/EXPIRED/REJECTED phases).

**Decision:** When `onEvaluate` fires and no matching local session exists (`getSessionByAcpId` returns null) but `job.deliverable` is present, this is a third-party evaluator assignment. We:
1. Create a `dispute_arbitration` session with the job's requirement + deliverable as context
2. Match to an expert who reviews whether the provider fulfilled the contract
3. On session completion, `completeSession()` triggers `submitEvaluatorVerdict()` via dynamic import
4. `submitEvaluatorVerdict()` reads the structured form verdict (approve/reject) and calls `job.evaluate(approved, reason)`

**Key distinction:** Own provider jobs have a matching session (created during REQUEST phase). Evaluator assignments have no pre-existing session — we create one on the fly.

**Circular dependency avoidance:** `sessions.ts` → `acp.ts` uses dynamic `import('./acp.js')` to avoid circular import between the two modules.

**Trade-off:** Evaluator jobs bypass the normal REQUEST→NEGOTIATION→TRANSACTION flow. The session is created with a fixed $0.01 internal price (evaluator compensation is handled separately from the ACP job's payment). No payment gate — the expert reviews and submits, then we call `job.evaluate()` immediately.

---

## Codebase Cleanup

### 2026-02-26: v1.0 Job/Judgment code removal

**Context:** The v1.0 architecture used a Job→Judgment model (one-shot expert reviews). v1.1 replaced this entirely with interactive Sessions. ~600 lines of dead code remained: `services/judgments.ts`, dashboard components (`JobHistory`, `JudgmentForm`, `useJobs`), legacy types (`Job`, `Judgment`, `JUDGMENT_DISCLAIMER`, `PROHIBITED_PHRASES`), and helper functions (`getOffering`, `getDomainsForOffering`, `selectBestExpert`) only called from the dead service.

**Decision:** Delete all v1.0 code. SQL schema tables (`jobs`, `judgments`) left in place — they're historical and harmless. `KNOWN_TABLES` array in `database.ts` updated to remove them from the migration-helper allowlist.

**Rationale:** Dead code is maintenance burden, confuses new contributors, and creates false positive search results. The v1.0 model is never coming back — sessions are strictly better.

### 2026-02-26: Expert payout formula documented as named constants

**Context:** The payout formula `session.priceUsdc * 0.8 * 0.75` was a magic number chain across `sessions.ts`. The `0.8` means "expert gets 80% of session price" and `0.75` means "platform takes 25% fee from expert's share". Same for grace turns (`+ 5`), description caps (`.slice(0, 500)`), memo caps (`.slice(0, 2000)`).

**Decision:** All business-critical magic numbers extracted to `config/constants.ts`:
- `EXPERT_SHARE = 0.80` — expert's share of session price
- `PLATFORM_FEE = 0.25` — platform fee from expert's share
- `GRACE_TURNS = 5` — extra turns after max
- `MAX_DESCRIPTION_LENGTH = 2000` — ACP description cap
- `MAX_MEMO_LENGTH = 2000` — ACP memo cap
- `MAX_VERDICT_REASON_LENGTH = 500` — evaluator verdict reason cap
- `MEMO_BRIDGE_POLL_MS = 10_000` — memo polling interval

Payout formula is now: `priceUsdc * EXPERT_SHARE * (1 - PLATFORM_FEE)` = 60% of session price to expert.

### 2026-02-26: ACP service boundary enforcement

**Context:** `services/acp.ts` had 5 direct SQL calls (`getDb().prepare(...)`) that bypassed the session service layer, violating the service boundary pattern used everywhere else.

**Decision:** Added 4 functions to `sessions.ts` — `getActiveAcpSessions()`, `markPaymentReceived()`, `cancelSessionFromAcp()`, `getStuckAcpSessions()` — and replaced all direct SQL in `acp.ts` with these wrappers.

**Rationale:** Consistent service boundaries make the codebase easier to reason about, test, and refactor. All session state mutations now go through `sessions.ts`.

### 2026-02-26: Operating hours instead of going offline

**Context:** All experts are in CET timezone, so Taste has zero availability ~23:00–09:00. Two bad options: (1) take the agent offline when no experts are online — but Butler penalizes via `MINS_FROM_LAST_ONLINE` ranking, (2) stay online and accept jobs at night — but jobs timeout and hurt success rate (10 consecutive failures = ungraduated).

**Decision:** Stay online 24/7 for discoverability. Expose `operatingHours` in the resource availability endpoint (`/api/public/resource/availability`) with `currentlyOpen`, `nextOpenAt`, timezone, and schedule. Agents can check this before creating jobs.

**Rationale:** Butler ranks agents by recency of activity. Going offline for 10 hours daily would tank our search ranking. The resource endpoint lets smart agents check availability first, while jobs submitted at night still queue and get matched when experts come online (longer SLA but no failure).

### 2026-02-26: Resource expansion (1 → 3 resources)

**Context:** Top ACP agents have 3-9 resources. Taste had only 1 (`expert_availability`). Resources don't directly affect Butler discovery but help buying agents make informed pre-purchase decisions, increasing conversion.

**Decision:** Added 2 new resources:
1. `offering_catalog` (`/api/public/resource/offerings`) — Full offering catalog with requirement schemas, deliverable field schemas, pricing, and SLA. Helps agents choose the right offering and format their request correctly.
2. `sample_deliverables` (`/api/public/resource/samples`) — Example completed deliverables per offering type. Shows agents exactly what they'll receive, reducing purchase uncertainty.

**Rationale:** Maps to a three-step decision funnel: When (availability) → Which (catalog) → What (samples). Each resource adds semantic surface for Butler discovery. The offering catalog includes machine-readable deliverable field schemas (key, type, options) so agents can programmatically validate responses.

### 2026-02-26: Ecosystem-informed keyword expansion (60 → 82 keywords)

**Context:** Live API analysis of 34 ACP agents revealed specific language patterns: agents search for "token audit", "video review", "second opinion", "sanity check", etc. These terms weren't in our `OFFERING_NAME_MAP`.

**Decision:** Added 22 new keywords to `OFFERING_NAME_MAP` based on actual ecosystem language. Examples: "token audit" → trust_evaluation, "video review" → content_quality_gate, "second opinion" → output_quality_gate, "verify research" → fact_check_verification.

**Trade-off:** More keywords = more routing surface but higher collision risk. Mitigated by using specific multi-word phrases rather than single generic words. Substring matching order matters — new keywords are appended after existing ones per offering section.

### 2026-02-26: Conversation framed as optional, not default

**Context:** Taste's memo bridge enables real-time back-and-forth between expert and buying agent during job execution. However, live API analysis of 34 ACP agents revealed that zero agents implement a "check memos and respond" loop. Every agent uses a one-shot submit→deliver model. This means Taste's conversational capability, while technically working, produces unanswered messages in practice — the expert asks a clarifying question and gets silence.

**Decision:** Reframed all offering descriptions from "through a live conversation" to a one-shot model with optional conversation:
- Default flow: agent sends request → expert reviews → expert delivers structured assessment
- Optional flow: if the buying agent implements memo handling, the expert can ask clarifying questions and receive answers, producing a richer assessment with a chat transcript
- Deliverable descriptions changed from "Includes chat transcript when expert discussed X with the requesting agent" to "Includes chat transcript if back-and-forth conversation occurred"
- trust_evaluation and option_ranking descriptions now include "Supports optional back-and-forth conversation via ACP memos"

**Rationale:** Describing a feature that no buying agent can currently use as the primary interaction model is misleading and sets wrong expectations. The one-shot review is what actually happens today. Keeping the functionality intact means Taste is ready when agents evolve to support conversational patterns — we just don't promise it as the default experience. The memo bridge remains valuable for: (1) dashboard sessions with human buyers, (2) testing via agent simulator, (3) future agents that implement memo handling.

**What we kept:** All memo bridge code, push notifications for incoming memos, transcript inclusion when conversation did occur. No code was removed — only descriptions were updated.

### 2026-02-26: Pre-release security hardening

**Context:** Comprehensive security audit before production release with real funds. Two-pass audit covering all HTTP routes, WebSocket events, file uploads, ACP data flow, auth, CORS, CSP, and production hardening.

**Fixes applied:**

1. **`incrementCompletedJobs()` race condition** — Changed from read-modify-write (`getExpertById` → calculate → `UPDATE`) to atomic SQL arithmetic (`earnings_usdc = earnings_usdc + ?`). Prevents double-credit if concurrent payout confirmations arrive.

2. **Global Express error handler** — Added `(err, req, res, next)` middleware to prevent stack traces and internal error messages from leaking to clients. Previously relied on Express default handler which varies by `NODE_ENV`.

3. **CSP `connectSrc` restriction** — Changed from `ws:` / `wss:` (allowing WebSocket to any host) to only `wss://humantaste.app` in production. Prevents XSS payloads from exfiltrating data via attacker-controlled WebSocket servers.

4. **Deactivation check in `verifyToken`** — Auth middleware now loads the expert from DB and checks `deactivatedAt` on every authenticated request. Previously, deactivated users could continue using their JWT for up to 2 hours.

5. **Explicit JWT algorithm** — Set `{ algorithms: ['HS256'] }` on `jwt.verify()` and `{ algorithm: 'HS256' }` on `jwt.sign()`. Prevents algorithm confusion attacks.

6. **Input validation tightening** — `txHash` now requires `0x` + 64 hex chars. `createSession` tags capped at 10 items / 50 chars. `buyerAgent`/`buyerAgentDisplay` max 200 chars. `completeSession` structured data values max 10K chars. Decline route now has Zod validation with reason max 1000 chars. Login password max 128 chars.

**Accepted risks (documented):** Stateless JWT means no token invalidation on logout (2h window). CORS allows no-origin for ACP server-to-server callbacks. `unsafe-inline` styles required by React. No MFA for single-admin MVP.

---

## Dashboard UX

### 2026-02-26: Form-first session layout (chat-first → form-first)

**Context:** The original session view was chat-first: expert sees messages, types responses, then clicks "End Session" to open a modal completion form. But no ACP agents respond to messages — they use a one-shot submit→deliver model. The chat area was dead space for every real session.

**Decision:** Invert the layout. Top to bottom: header → request card → inline assessment form → collapsible chat section (collapsed by default). The CompletionForm now supports `inline` mode (no modal overlay), and the chat section shows a badge with message count.

**Rationale:** The UI should reflect the actual workflow: read the request, fill in the structured form, submit. Chat is preserved for when agents eventually support memos, but it's not the primary interface. This eliminated the empty "waiting for messages" experience that confused experts.

### 2026-02-26: Allow session completion from `accepted` status

**Context:** The form-first layout lets experts submit the assessment without ever sending a message. Previously, the first expert message triggered the `accepted` → `active` transition, and `completeSession()` only accepted `active` or `wrapping_up` status. Experts clicking "Submit Assessment" on a fresh session got "Cannot complete this session".

**Decision:** Added `accepted` to the allowed completion statuses in both the route guard (`routes/sessions.ts`) and the atomic SQL WHERE clause (`sessions.ts`). The status flow now allows: `accepted` → `completed` (form-first, no chat) alongside the existing `active` → `completed` (chat-then-form).

**Rationale:** The status machine should reflect valid workflows, not force experts through an artificial "send a message first" step. Tests added for both the happy path (`accepted` → `completed`) and the guard (pending sessions still can't complete).

### 2026-02-26: Domain model update — `narrative` → `culture`, add `business`

**Context:** Preparing for 3-expert launch roster. The `narrative` domain ("Storytelling & Narrative") was too niche. The team's actual expertise maps better to "culture" (broader). Additionally, business/economics expertise was missing from the domain model entirely.

**Decision:** Renamed `narrative` to `culture` ("Writing & Culture") and added `business` ("Business & Economics"). Updated all references: types, validation schemas, domain configs, offering relevantDomains, seed data, tests. Added `business` to offerings where relevant (trust_evaluation, option_ranking, fact_check_verification, dispute_arbitration).

**Rationale:** Domains should match the actual expertise available at launch. "Culture" better describes the breadth of the expert's capabilities than "narrative". The `business` domain opens up financial analysis, market evaluation, and business strategy requests.

### 2026-02-26: Description length increase (500 → 2000 chars)

**Context:** ACP agents send structured JSON as session descriptions. These often contain full deliverables, contract terms, and context that exceed 500 characters. Dispute arbitration descriptions were being truncated, losing critical context for the expert.

**Decision:** Increased `MAX_DESCRIPTION_LENGTH` from 500 to 2000 characters. Matches the existing `MAX_MEMO_LENGTH` of 2000.

**Rationale:** Truncating the request that the expert needs to evaluate defeats the purpose. 2000 chars accommodates the longest observed agent submissions while still providing a reasonable cap.

### 2026-02-26: CompletionForm schemas synced with server

**Context:** The dashboard's CompletionForm had its own hardcoded field definitions for each offering type. When `fact_check_verification` and `dispute_arbitration` were added to the server's `deliverable-schemas.ts`, the dashboard wasn't updated. It fell back to generic fields (summary, verdict, keyFindings) that didn't match the server's Zod validation, causing "Invalid structured data" errors.

**Decision:** Added explicit field definitions for `fact_check_verification` and `dispute_arbitration` to the CompletionForm's `DELIVERABLE_SCHEMAS` map, matching the server's expected fields exactly.

**Trade-off:** Field definitions are duplicated between server (`deliverable-schemas.ts`) and dashboard (`CompletionForm.tsx`). A shared schema package would eliminate drift, but is over-engineering for the current offering count. The test suite catches mismatches.
