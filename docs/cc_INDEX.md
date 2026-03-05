# Taste Documentation Index

Quick reference for all project documents, scripts, and config files.

---

## Core Documentation (`docs/`)

| Document | Summary |
|----------|---------|
| [cc_acp-ecosystem-analysis.md](cc_acp-ecosystem-analysis.md) | Comprehensive ACP marketplace analysis: agent profiles, pricing, live API data, cross-reference matrix mapping ecosystem outputs to Taste offerings, resource strategy, and keyword optimization. The primary strategy document. |
| [cc_acp-session-lifecycle.md](cc_acp-session-lifecycle.md) | Technical flow of ACP sessions from job creation through memo bridging, expert chat, delivery, and evaluation. Reference for understanding the request-response pipeline. |
| [cc_agent-targeting.md](cc_agent-targeting.md) | Scoring rubric for evaluating which ACP agents are the best integration targets. Rates agents by judgment need, decision frequency, budget fit, and content risk. |
| [cc_design-decisions.md](cc_design-decisions.md) | Log of non-obvious technical decisions with context and rationale. Covers deliverable format, offering schemas, file attachments, ACP integration, operating hours, resource expansion, and keyword routing. **Check before changing core behavior.** |
| [cc_offerings.md](cc_offerings.md) | Session tier definitions (test/quick/full/deep) with pricing and duration. Lists all 8 enabled and 4 disabled offerings. Expert payout structure. |
| [cc_use-cases.md](cc_use-cases.md) | Platform use cases with feature availability matrix (API vs Dashboard vs not implemented). Covers ACP transaction flow, session lifecycle, expert lifecycle, withdrawals, reputation, and admin capabilities. |
| [cc_graduation-readiness.md](cc_graduation-readiness.md) | Comprehensive graduation readiness analysis: code vs whitepaper mismatches, code vs docs mismatches, Virtuals submission requirements checklist, action items, and feature completeness matrix. |
| [cc_vps-setup.md](cc_vps-setup.md) | Production VPS reference: server specs (107.173.236.164), ports, paths, deployment deps (Node 20, nginx, PM2), co-located Aethir Checker Node. |
| [x-research/](x-research/) | Ecosystem research: Virtuals agent builders, influencers, and a prioritized outreach list of 6 KOLs. |

## Config Files (project root)

| File | Summary |
|------|---------|
| `agent-description.md` | Business description for the Virtuals GAME console agent profile. Copy-paste into the agent bio field. |
| `agent-offerings.json` | Complete JSON for uploading to Virtuals GAME console. All 8 offerings with descriptions, example inputs/outputs, requirement schemas, and deliverable schemas. **Upload this to register offerings.** |
| `agent-resources.json` | Resource definitions for Virtuals GAME console. 3 resources: expert_availability, offering_catalog, sample_deliverables. **Upload this to register resources.** |

## Scripts (`scripts/`)

| Script | Summary |
|--------|---------|
| `acp-research.ts` | ACP marketplace analysis: searches 21 keywords, deduplicates agents, reports top agents, common offerings, pricing, demand keywords. Run: `npx tsx scripts/acp-research.ts` |
| `fetch-agent.js` | Fetch full agent details from ACP API. Run: `node scripts/fetch-agent.js "search query" [topK]` |
| `agent-sim.sh` | Interactive CLI tool for testing sessions end-to-end. Simulates a buying agent. |
| `graduation-check.ts` | Automated graduation health check: exercises all 8 offerings end-to-end against production or local. Run before submission and daily during review. `ADMIN_PASSWORD=xxx npx tsx scripts/graduation-check.ts` |
| `deploy.sh` | Production deploy: git pull, build, pm2 restart. Run on VPS. |
| `vps-setup.sh` | Full one-command VPS setup: nvm, Cloudflare certs, nginx, PM2, backups. |
| `generate-secrets.sh` | Generate JWT secret, encryption key, and VAPID keys for `.env`. |
| `backup.sh` | SQLite backup with 14-day retention. |
| `nginx-taste.conf` | Nginx config template with `/mcp/` proxy block for MCP server on port 3002. |
| `POST_DEPLOY_CHECKLIST.md` | Post-deploy verification: dashboard access, admin password, SSL, firewall, co-located services. |

## Server Services (`server/src/services/`)

| File | Summary |
|------|---------|
| `mcp.ts` | MCP server with x402 payment gates. Exposes 3 tools: `list_offerings` (free), `request_evaluation` (paid, $0.01 USDC), `get_result` (free). Runs on port 3002 via StreamableHTTP transport. Payment verified via xpay facilitator. |

## Dashboard Pages (`dashboard/src/pages/`)

| File | Summary |
|------|---------|
| `McpTestClient.tsx` | Admin-only MCP test client page. Two-panel layout: expert ChatView on left, MCP JSON-RPC controls on right (discover tools, list offerings, request evaluation, poll results). Includes request log and 402 payment challenge display. |

## Dashboard API (`dashboard/src/api/`)

| File | Summary |
|------|---------|
| `mcp.ts` | JSON-RPC client for the MCP server. Wraps `tools/list`, `list_offerings`, `request_evaluation`, `get_result` calls via `/mcp` proxy. Handles 402 payment responses and SSE streaming. |

## External Research (`feedback/`)

| File | Summary |
|------|---------|
| `compass_artifact_wf-*.md` | Strategic analysis of Taste's market position: target agents (Luna, aixbt, Ethy AI), demand gap quantification, Butler discovery mechanics, regulatory tailwinds, key contacts. |
| `framework_launch_comparison.md` | Cost-benefit analysis recommending tokenless multi-platform launch via MCP discovery over token creation. |
