# Taste — Graduation Readiness Analysis

**Generated: 2026-03-02**
Cross-references: whitepaper v3.0, `docs/cc_use-cases.md`, `docs/cc_offerings.md`, `docs/cc_design-decisions.md`, `docs/cc_acp-session-lifecycle.md`, `feedback/Pre-graduation analysis.md`, `feedback/Agent Graduation Submission Guide.pdf`, `feedback/ACP Graduation Request.pdf`, and full codebase audit.

---

## PART 1: CODE vs WHITEPAPER MISMATCHES

### CRITICAL — Fix Before Submission

| # | Whitepaper Claim | Code Reality | Risk |
|---|-----------------|--------------|------|
| 1 | **Expert Matching Algorithm**: "Weighted scoring — domain relevance (40%), availability (30%), reputation (20%), workload (10%)" | **Broadcast model** — ALL eligible experts notified, first-accept wins. Weighted scoring was removed (documented in design-decisions.md). | **HIGH** — Reviewer reading whitepaper then inspecting code sees a fundamental mismatch. |
| 2 | **In-Session Add-Ons**: "Six types: screenshot, extended time, written report, second opinion, image upload, follow-up" listed as live feature | **DISABLED** — Routes return 403, WebSocket handler disabled, no UI. Schema preserved. | **HIGH** — Whitepaper claims a feature that doesn't work. |
| 3 | **Payout split math**: "10% protocol fee, 90% Taste net → 10% platform, 90% to expert" = 81% to expert, but then says "60% to expert" | Code: `price × 0.80 × 0.75 = 60%`. The 60% final number is correct, but the intermediate breakdown (10% + 10%) contradicts it. | **MEDIUM** — Confusing to anyone who does the math. |
| 4 | **Positive feedback (+5 reputation)**: Listed as a reputation event | **Dead code** — Type and schema exist but nothing in the application ever triggers `positive_feedback`. The only events that fire are `job_completed`, `timeout`, `rejected`. | **MEDIUM** — Claims a feature with no trigger mechanism. |
| 5 | ~~File attachments~~ | **ACTIVE** — Upload, list, and download routes all work. Magic byte validation, signed URLs, 5MB/file. | **N/A** — No mismatch, feature is live. |

### ACCEPTABLE — Acknowledged Differences

| # | Whitepaper Claim | Code Reality | Status |
|---|-----------------|--------------|--------|
| 6 | Pricing: Quick $1, Full $3, Deep $10 | All tiers $0.01 (test pricing) | **OK** — Expected pre-graduation. Switching post-graduation. |
| 7 | "Bidirectional communication — real-time back-and-forth via memos" | Memo bridge works, but no ACP agents currently respond. Messaging UI disabled in Butler. | **OK** — Feature works technically; ecosystem adoption pending. |
| 8 | EU AI Act compliance mention | No compliance tracking code exists | **OK** — Forward-looking claim, not a current feature. |
| 9 | Phase 2–4 roadmap items | Not implemented (multi-expert sessions, x402/ERC-8004 support) | **OK** — Clearly labeled as roadmap. |

---

## PART 2: CODE vs USE-CASES DOC MISMATCHES

| # | Doc Claim | Code Reality | Fix |
|---|-----------|-------------|-----|
| 1 | Feature table shows "File attachments: **Disabled**" | Correct — code returns 403 | Accurate |
| 2 | Feature table shows "Add-ons: **Disabled**" | Correct — code returns 403 | Accurate |
| 3 | Feature table shows "Admin send-as-agent: **Disabled**" | Correct — code commented out | Accurate |
| 4 | "Idle timeout: Schema only — no timer logic implemented" | Correct — `idle_warned_at` column exists, no logic | Accurate |
| 5 | "`wrapping_up` status: Defined in types but never transitioned to" | Correct — status exists but no code path leads to it | Accurate |
| 6 | Reputation: `positive_feedback → +5` | Type/schema/score-map exist but **never triggered** | Should note "(not currently triggered)" |
| 7 | Section 9 (Session Decline): Updated with deliver-decline | Correct — post-payment uses `job.deliver()`, pre-payment uses `job.reject()` | Accurate |
| 8 | Matching: "Broadcast to all eligible experts" | Correct | Accurate |
| 9 | Push notification triggers: 5 listed | Only 3 actually fire (new session, memo, dispute). Add-on and admin-message triggers are disabled. | Should clarify |

**Overall:** Use-cases doc is well-maintained and mostly accurate. Minor cleanup on positive_feedback and push trigger count.

---

## PART 3: CODE vs OFFERINGS DOC MISMATCHES

| # | Doc Claim | Code Reality | Fix |
|---|-----------|-------------|-----|
| 1 | Tier pricing: quick $0.50–$2.00, full $2.00–$5.00, deep $5.00–$15.00 | All at $0.01 (test). Code has `priceRange` but `basePrice` overrides to $0.01 | Doc shows target pricing — acceptable |
| 2 | Max turns: quick 10, full 20, deep 40 | Code: quick 10, full 20, deep 30 (not 40) | **Mismatch** — code says 30 for deep, doc says 40 |
| 3 | "Unknown offerings default to trust_evaluation" | Code rejects unknown offerings — `resolveOfferingType` returns null, job is rejected | **Mismatch** — doc is wrong, code rejects correctly |
| 4 | Deliverable format includes `attachments` array and `transcript` array | Code's `formatSessionDeliverable` includes structured assessment + summary. Attachments only if they exist. Transcript only if expert sent messages. | Mostly accurate |
| 5 | "Prohibited financial language enforcement — planned but advisory only" | No enforcement code exists (no blocklist scanning on deliverables) | Accurate caveat |

---

## PART 4: VIRTUALS GRADUATION REQUIREMENTS CHECKLIST

### A. Non-Negotiable Pre-Submission Requirements

| # | Requirement | Status | Evidence |
|---|------------|--------|----------|
| 1 | Agent registered on ACP website | **DONE** | 8 offerings visible on portal, `offerings.json` exported |
| 2 | Latest ACP SDK version | **VERIFY** | Using `@virtuals-protocol/acp-node` v0.3.0-beta.37. Check npm for newer. |
| 3 | 10+ successful sandbox transactions | **VERIFY** | User has been testing via Butler and agent-sim. Count actual completed sessions. |
| 4 | 3 consecutive successes with own test buyer | **VERIFY** | Agent-sim exists for this purpose. Confirm 3 clean runs. |
| 5 | Thread-safe queue / concurrent handling | **PARTIAL** | Node.js is single-threaded. `_processingJobs` Set prevents double-processing. No explicit queue beyond what the SDK provides. May need to document this better. |
| 6 | Agent hosted and accessible during review | **DONE** | VPS at 107.173.236.164, PM2 managed, domain humantaste.app |
| 7 | Sandbox pricing at $0.01 | **DONE** | All tiers set to $0.01 |
| 8 | Rejection of invalid requests | **DONE** | Validates: disabled offerings, empty/garbled input (<10 chars), token operations, compliance violations |
| 9 | Agent information and metadata complete | **DONE** | Descriptions, requirements, deliverables, sample I/O all defined per offering |
| 10 | Clear seller requirement schema | **DONE** | `OFFERING_REQUIREMENTS` in resource.ts defines fields per offering |

### B. Submission Form Fields

| # | Field | Status | Notes |
|---|-------|--------|-------|
| 1 | Agent Name/Ticker + Token CA | **READY** | "Taste" — confirm if token exists on Virtuals |
| 2 | Agent Wallet Address | **READY** | In .env (ACP_AGENT_WALLET_ADDRESS) |
| 3 | Screenshot of Service Offerings | **NEED** | Take from app.virtuals.io/acp "My Agents" menu |
| 4 | Latest SDK Version Confirmation | **VERIFY** | Check if beta.37 is truly latest |
| 5 | Quality Check Acknowledgment | **READY** | Check box in form |
| 6 | **Positive Test Videos (1 per offering)** | **NEED 8** | Must show: job received → processed → correct deliverable → metadata. One for each: trust_evaluation, output_quality_gate, option_ranking, content_quality_gate, audience_reaction_poll, creative_direction_check, fact_check_verification, dispute_arbitration |
| 7 | **Negative Test Videos (1 per offering)** | **NEED 8** | Must show: invalid request → proper rejection. One per offering. |
| 8 | Telegram Contact | **NEED** | Group invite link or name |

### C. Deliverable Quality (Core Evaluation Criteria)

| Criteria | Status | Notes |
|----------|--------|-------|
| Provides unique value vs generic LLM | **STRONG** | Human expert judgment is inherently unique — not replicable by LLM |
| Demonstrates deeper reasoning | **STRONG** | Structured assessments with per-field analysis (verdict, scores, findings, flags) |
| Correct JSON structure | **DONE** | Zod-validated per-offering schemas |
| Correct deliverables returned | **DONE** | `formatSessionDeliverable()` builds complete JSON |
| Correct status codes | **DONE** | Job phases transition correctly (accept → requirement → deliver) |
| Not easily obtainable from external LLM | **STRONG** | The entire value proposition — human judgment, not AI generation |

### D. Critical Kill Switch Warning

> "If any single service offering fails, the review will stop, the submission will be rejected"

This means ALL 8 offerings must work flawlessly. The reviewer will test each one.

**Risk Areas:**
- `dispute_arbitration` — Requires evaluator context; flow is different from other offerings
- `content_quality_gate` — Has reference code logic that triggers on completion; ensure no side effects
- Any offering where the expert doesn't respond in time → timeout → reviewer sees failure

### E. Not Applicable to Taste

| Requirement | Why N/A |
|------------|---------|
| Token/contract analysis: whitelist sell wall addresses | Taste is not a token scanner |
| Fund-managed: refund responsibility | Taste doesn't manage funds |
| Trading agent: execution accuracy | Taste doesn't execute trades |

---

## PART 5: ACTION ITEMS

### Must Fix Before Submission (Whitepaper)

1. **Remove or mark add-ons as "Planned"** — Currently listed as live feature. Either say "Phase 2" or remove entirely.
2. **Update matching algorithm description** — Replace weighted scoring with broadcast model, or say "weighted scoring for future use, currently broadcast."
3. **Fix payout math** — The 10% + 10% breakdown doesn't yield 60%. Correct to: "20% platform fee → 80% to expert pool → 25% platform share → net 60% to expert."
4. **Clarify positive_feedback** — Either implement a trigger (e.g., buyer agent sends positive evaluation) or remove from reputation table and docs.
5. ~~Remove file attachment mentions~~ — File attachments are actually active (upload, list, download all work). No fix needed.

### Must Do Before Submission (Graduation)

6. **Verify SDK version** — Check `npm info @virtuals-protocol/acp-node version` for latest.
7. **Count completed transactions** — Need 10+ successful. Run: `SELECT COUNT(*) FROM sessions WHERE status = 'completed' AND acp_job_id IS NOT NULL`.
8. **Record 8 positive test videos** — One per offering, showing full flow from Butler request → expert review → deliverable.
9. **Record 8 negative test videos** — One per offering, showing rejection of invalid input.
10. **Take ACP dashboard screenshots** — From app.virtuals.io/acp "My Agents" page.
11. **Set up Telegram group** — Or have invite link ready.
12. **End-to-end test all 8 offerings** — Single failure = total rejection. Test each via Butler before recording.

### Should Fix (Docs Accuracy)

13. **Offerings doc**: deep tier max turns → 30 (not 40) to match code.
14. **Offerings doc**: Remove "unknown offerings default to trust_evaluation" — code rejects them.
15. **Use-cases doc**: Note that `positive_feedback` is not currently triggered.
16. **Use-cases doc**: Clarify only 3 of 5 push notification triggers are active.

---

## PART 6: FEATURE COMPLETENESS MATRIX

Every claimed feature mapped to code implementation:

| Feature | Whitepaper | Use-Cases | Code | Match? |
|---------|-----------|-----------|------|--------|
| 8 offerings (provider) | Yes | Yes | Yes (8 enabled) | MATCH |
| Dispute arbitration (evaluator) | Yes | Yes | Yes | MATCH |
| Structured deliverables | Yes | Yes | Yes (Zod schemas) | MATCH |
| Expert matching | Weighted | Broadcast | Broadcast | WHITEPAPER MISMATCH |
| Reputation system | Yes (+5 feedback) | Yes (+5 feedback) | 3 of 4 events work | PARTIAL |
| Follow-up reference codes | Yes | Yes | Yes | MATCH |
| Memo bridge | Yes | Yes | Yes (10s poll) | MATCH |
| Push notifications | Yes | Yes (5 triggers) | Yes (3 active triggers) | PARTIAL |
| Expert decline with reason | Yes | Yes | Yes (deliver-decline) | MATCH |
| Withdrawal system | Yes | Yes | Yes (atomic) | MATCH |
| Add-ons | Yes (live) | Disabled | Disabled (403) | WHITEPAPER MISMATCH |
| File attachments | Mentioned | Active | Active (upload/list/download) | MATCH |
| Turn limits + grace | Yes | Yes | Yes | MATCH |
| Session deadlines | Yes | Yes | Yes | MATCH |
| Email encryption | Not mentioned | Yes | Yes (AES-256-GCM) | MATCH |
| Rate limiting | Not mentioned | Not detailed | Yes (6 limiters) | MATCH |
| Audit logging | Not mentioned | Not detailed | Yes | MATCH |
| Form-first workflow | Yes | Yes | Yes | MATCH |
| ACP Demo (agent sim) | Not mentioned | Yes | Yes | MATCH |
| ACP Inspector | Not mentioned | Yes | Yes | MATCH |
| Idle timeout | Not mentioned | Schema only | Not implemented | ACCURATE |
| wrapping_up status | Not mentioned | Schema only | Not implemented | ACCURATE |

---

## SUMMARY

**Graduation readiness: HIGH with fixes needed.**

The core product is solid — 8 offerings work, deliverables are structured and validated, ACP integration is mature, security is hardened. The main risks are:

1. **Whitepaper accuracy** — 3-5 claims don't match reality (matching algorithm, add-ons, payout math). Update before submission since reviewers may reference it.
2. **Video recordings** — 16 videos needed (8 positive + 8 negative). This is the biggest time investment.
3. **All 8 offerings must pass** — Single failure = total rejection. End-to-end test each one.
4. **SDK version** — Verify latest before submission.

The codebase is significantly more robust than the docs suggest — security hardening, atomic SQL, signed URLs, rate limiting, etc. are all implemented but not highlighted in the whitepaper. Consider mentioning infrastructure quality in the submission narrative.
