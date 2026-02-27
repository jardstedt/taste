# ACP Session Lifecycle

How jobs flow from a buying agent through Taste to an expert and back.

## Overview

```
Buying Agent (ACP)          Taste Server              Expert Dashboard
─────────────────          ────────────              ────────────────
initiateJob(req)  ──────►  handleNewTask()
                           - extract requirements
                           - accept job
                           - create session
                           - seed first chat message
                           - match expert
                                                     Expert sees session
                                                     with requirement data
                                                     as first message

payAndAccept()    ──────►  handleNewTask(TRANSACTION)
                           - startSession()
                           - start memo bridge        Session goes active

createNotification() ───►  bridgeInboundMemos()
  (buyer memo)             - inject as agent message  Expert sees message
                                                      Expert replies
                           relayExpertMessageToAcp()  ◄─── message:send
                           - createNotification()  ──►  Buyer sees memo

                           (repeat for N turns)

                           completeSession()          ◄─── Expert completes
                           - format deliverable

job.deliver()     ◄──────  pollJobs() / reconcile

evaluate(true)    ──────►  handleEvaluate(COMPLETED)
                           - confirmSessionPayout()    Expert gets paid
```

## ACP Phases

| Phase | # | What happens |
|-------|---|-------------|
| REQUEST | 0 | Buyer sends `initiateJob(requirementData)`. Taste auto-accepts. |
| NEGOTIATION | 1 | Taste creates a payment requirement. Buyer pays. |
| TRANSACTION | 2 | Session is active. Expert and agent converse. Memo bridge runs. |
| EVALUATION | 3 | Expert completed session. Taste delivers result. Buyer reviews. |
| COMPLETED | 4 | Buyer accepted the deliverable. Expert payout confirmed. |
| REJECTED | 5 | Buyer rejected the deliverable. Expert payout revoked, reputation hit. |

## Messages

### Onchain (ACP memos)

ACP memos are onchain transactions on Base mainnet. Used for:
- Job creation (buyer's requirement data as first memo)
- Phase transitions (accept, pay, deliver, evaluate)
- Mid-session messages via `createNotification(content)`

Gas is sponsored by Virtuals via an Alchemy paymaster (policyId hardcoded in SDK). Neither buyer nor Taste pays gas.

### Offchain (Taste REST + WebSocket)

The expert chat is offchain:
- `POST /sessions/:id/messages` (REST)
- `message:send` (WebSocket from expert dashboard)
- Messages stored in local SQLite `messages` table

### Memo Bridge

Connects the two message layers during TRANSACTION phase:

**Inbound (buyer memos -> chat):**
- Polls registered jobs every 10s via `bridgeInboundMemos()`
- Only polls jobs in `_bridgedJobs` map (not all sessions)
- Filters out our own memos via `senderAddress` check
- Tracks seen memo IDs to avoid duplicates
- Injects new buyer memos as `agent` messages + emits WebSocket event

**Outbound (expert messages -> ACP memo):**
- `relayExpertMessageToAcp()` called from both socket handler and REST route
- Fires immediately when expert sends a message on an ACP-linked session
- Uses `job.createNotification(content)` to send onchain
- Non-blocking (fire-and-forget with error logging)

**Lifecycle:**
- Starts when an ACP session enters TRANSACTION phase (payment received)
- Also starts on server restart if active ACP sessions exist
- Auto-stops when no more active ACP sessions remain
- Cleans up seen-memo state for completed/timed-out sessions

**Latency:** ~10s inbound (polling), instant outbound.

## Timeouts

### Hard Deadline (`deadline_at`)

Set at session creation from the offering's SLA (typically 30-60 min). `checkSessionTimeouts()` runs every 30s and kills sessions past their deadline.

At deadline:
- Session status -> `timeout`
- Expert payout -> 0
- ACP job -> `job.reject()` -> full refund to buyer
- Expert reputation penalty **only if expert was idle** (see below)

No grace period at deadline. It's a hard cutoff. Expert should complete before it hits.

### Idle Check

**Removed.** There is no per-turn idle timeout. Some requests require the expert to do extended work (e.g. 30 min of research) before replying. The `deadline_at` hard cutoff is the only time-based safety net. As long as the expert delivers before the deadline, turn gaps don't matter.

### Who Gets Penalized

| Scenario | Expert penalized? | Buyer refunded? |
|----------|-------------------|-----------------|
| Deadline hit (expert was idle) | Yes - reputation hit | Yes |
| Deadline hit (agent was idle) | No | Yes |
| Expert completes before deadline | No | No (deliverable sent) |
| Expert declines | No | Yes |
| Buyer rejects deliverable | Yes - reputation hit | Yes (ACP escrow) |

### Turn-Based Grace Period

Sessions have a `maxTurns` limit (from tier config). After hitting the limit:
- Expert gets 5 more grace turns to wrap up
- After grace turns exhausted, messages are blocked
- Expert must complete, request an extension (addon), or decline

## Session Completion Flow

Only the **expert** or **admin** can complete a session. The buying agent cannot.

1. Expert sees the **CompletionForm** inline in the session view (form-first layout)
2. Expert fills per-offering structured fields (verdict, scores, findings)
3. Expert submits -> `POST /sessions/:id/complete` with `{ structuredData, summary }`
4. Server validates structured data against per-offering Zod schema
5. `saveDeliverable()` stores in `session_deliverables` table
6. `completeSession()` sets `status = 'completed'`, calculates `expert_payout_usdc`
7. For ACP sessions: payout is **not** confirmed yet (held pending buyer evaluation)
8. On next poll, Taste sees completed session -> `formatSessionDeliverable()` -> `job.deliver(deliverable)`
   - Deliverable now includes `structuredAssessment` (form data) + `attachments` (signed file URLs)
9. Buyer evaluates:
   - `evaluate(true)` -> COMPLETED -> `confirmSessionPayout()` -> expert gets paid
   - `evaluate(false)` -> REJECTED -> payout revoked, expert reputation hit

For non-ACP (local) sessions: payout is confirmed immediately on completion.

### Structured Deliverables

Each offering type has a per-offering schema defined in `deliverable-schemas.ts`:
- **trust_evaluation**: verdict, confidenceScore, summary, keyFindings, redFlags, positiveSignals
- **output_quality_gate**: qualityVerdict, qualityScore, summary, issuesFound, suggestedImprovements
- **option_ranking**: topPick, summary, rankings, tradeoffs
- **content_quality_gate**: verdict, culturalSensitivityScore, brandSafetyScore, summary, flaggedIssues
- **audience_reaction_poll**: overallRating, summary, criteriaScores, comparisonNotes
- **creative_direction_check**: verdict, viabilityScore, summary, culturalFlags, tonalAlignment
- **fact_check_verification**: overallAccuracy, claimsChecked, summary, flaggedClaims, corrections
- **dispute_arbitration**: verdict, reasoning, deliverableQuality, contractAlignment, summary
- **Fallback** (unknown types): summary, verdict, keyFindings

Backward compatible: sessions completed without structured data use the old transcript-based summary.

### File Attachments (Disabled)

File upload routes are currently disabled (return 403). Implementation preserved for future use:
- **Chat uploads**: `POST /sessions/:id/attachments` with `context=chat` — creates a `file` message in chat
- **Completion uploads**: Same endpoint with `context=completion` — attached to deliverable only
- **Signed URLs**: External (ACP agent) access via HMAC-signed URLs with 24h expiry
- **Auth access**: Internal download via `GET /sessions/:id/attachments/:id/download` (JWT required)
- **Storage**: Local disk at `{UPLOAD_DIR}/{sessionId}/{uuid}.{ext}`, swap to S3 via `StorageBackend` interface
- **Security**: Magic byte validation, MIME whitelist, 5MB/file, 20MB/session, UUID filenames

## Expert Options During Session

- **Complete**: Submit structured assessment via the CompletionForm (form-first workflow)
- **Decline**: Can't fulfill the request -> expert provides a written reason -> buyer refunded with explanation, no reputation penalty
- **Keep chatting**: Send chat messages within turn/time limits (optional — agents rarely reply in practice)

> **Add-ons are disabled for ACP sessions.** ACP has no standard mid-session upsell mechanism, so agents wouldn't understand addon requests. The addon code is preserved for potential non-ACP use. The ChatView hides the addon UI when `session.acpJobId` is set, and the AcpDemo page shows a disabled notice instead of the addon form.

## Safety Guards

- **Fee limit**: MAX_FEE_USDC = 0.01 per offering
- **Gas price cap**: MAX_GAS_PRICE_GWEI = 0.5 (checked before onchain operations)
- **Memo size**: Content capped at 2000 chars (inbound + outbound)
- **Requirement size**: 10KB max on job creation
- **Memo sanitization**: Accept/reject memos capped at 500 chars
- **Admin-only**: All agent-sim endpoints require admin role

## Agent Simulator (Admin Demo)

The ACP Demo page (`/dashboard/admin/acp-demo`) lets an admin play both sides:
- **Left panel**: Expert chat (ChatView component)
- **Right panel**: Buyer agent controls (init, discover offerings, create job, pay, accept/reject)

Pre-fills requirement JSON from `offerings.json` when an offering is selected.
Offerings include `requirementFields` (field descriptions) and `exampleInput` (sample data).

## Key Files

| File | Role |
|------|------|
| `server/src/services/acp.ts` | Provider-side ACP client, memo bridge, polling |
| `server/src/services/agent-sim.ts` | Buyer-side ACP client for admin demo |
| `server/src/services/sessions.ts` | Session lifecycle, messages, timeouts, payouts, deliverables |
| `server/src/services/storage.ts` | File storage, magic byte validation, signed URLs |
| `server/src/services/socket.ts` | WebSocket handler, expert message relay |
| `server/src/config/deliverable-schemas.ts` | Per-offering field definitions + Zod validation |
| `server/src/routes/agent-sim.ts` | Admin-only buyer API endpoints |
| `server/src/routes/sessions.ts` | Session REST API (messages, complete, decline, attachments) |
| `dashboard/src/components/CompletionForm.tsx` | Structured completion form modal |
| `dashboard/src/pages/AcpDemo.tsx` | Admin demo split-view page |
| `offerings.json` | Virtuals-registered offering specs with example data |
