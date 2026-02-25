#!/usr/bin/env node
/**
 * Taste Interactive REPL — play as both Agent and Expert
 *
 * Commands:
 *   new [offering] [tier]   Create a new session (default: content_quality_gate quick)
 *   accept                  Accept the current session as expert
 *   a <message>             Send message as Agent
 *   e <message>             Send message as Expert
 *   addon <type> <price>    Request an addon (as agent)
 *   addon-accept            Accept pending addon (as expert)
 *   addon-reject            Reject pending addon (as expert)
 *   complete                Complete the current session
 *   decline [reason]        Decline/cancel the current session
 *   status                  Show current session status
 *   messages                Show all messages
 *   addons                  Show all addons
 *   sessions                List all sessions
 *   use <id>                Switch to a different session
 *   help                    Show this help
 *   quit                    Exit
 *
 * Usage: node test-repl.mjs
 * Requires the server to be running on localhost:3001.
 */

import * as readline from 'readline';

const BASE = process.env.TASTE_URL || 'http://localhost:3001/api';
const EMAIL = process.env.TASTE_EMAIL || 'admin@taste.local';
const PASSWORD = process.env.TASTE_PASSWORD || 'devpassword123';

let cookie = '';
let currentSessionId = null;

// ── Auth ──

async function login() {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const data = await res.json();
  if (!data.success) throw new Error('Login failed: ' + data.error);
  return data;
}

async function api(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    ...opts,
  });
  return res.json();
}

// ── Formatting ──

const DIM = '\x1b[2m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const MAGENTA = '\x1b[35m';

function log(msg) { console.log(msg); }
function ok(msg) { log(`${GREEN}✓${RESET} ${msg}`); }
function err(msg) { log(`${RED}✗${RESET} ${msg}`); }
function info(msg) { log(`${DIM}${msg}${RESET}`); }

function formatSession(s) {
  const status = {
    pending: `${YELLOW}pending${RESET}`,
    matching: `${YELLOW}matching${RESET}`,
    accepted: `${CYAN}accepted${RESET}`,
    active: `${GREEN}active${RESET}`,
    wrapping_up: `${MAGENTA}wrapping_up${RESET}`,
    completed: `${GREEN}completed${RESET}`,
    cancelled: `${RED}cancelled${RESET}`,
    timeout: `${RED}timeout${RESET}`,
  }[s.status] || s.status;

  return `${BOLD}${s.id.slice(0, 8)}${RESET} ${status} ${DIM}${s.offeringType}${RESET} ${DIM}tier:${s.tierId} $${s.priceUsdc}${RESET} ${DIM}turns:${s.turnCount}/${s.maxTurns}${RESET}`;
}

function formatMessage(m) {
  const sender = m.senderType === 'agent'
    ? `${CYAN}[Agent]${RESET}`
    : m.senderType === 'expert'
    ? `${GREEN}[Expert]${RESET}`
    : `${DIM}[System]${RESET}`;
  return `${sender} ${m.content}`;
}

// ── Commands ──

async function cmdNew(args) {
  const [offering, tier] = args;
  const body = {
    offeringType: offering || 'content_quality_gate',
    tierId: tier || 'quick',
    description: 'Interactive REPL test session',
    buyerAgent: 'repl-agent',
    buyerAgentDisplay: 'REPL Test Agent',
    priceUsdc: 0.01,
  };

  const res = await api('/sessions', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  if (!res.success) {
    err(res.error);
    return;
  }

  currentSessionId = res.data.id;
  ok(`Session created: ${res.data.id.slice(0, 8)}`);
  log(`  Offering: ${body.offeringType}, Tier: ${body.tierId}`);
  log(`  Status: ${res.data.status}, Expert: ${res.data.expertId ? res.data.expertId.slice(0, 8) : 'none'}`);
  log(`  ${DIM}Use 'accept' to accept as expert, then 'a <msg>' / 'e <msg>' to chat${RESET}`);
}

async function cmdAccept() {
  if (!currentSessionId) { err('No active session. Use "new" first.'); return; }

  const res = await api(`/sessions/${currentSessionId}/accept`, { method: 'POST' });
  if (!res.success) { err(res.error); return; }

  ok(`Session accepted (status: ${res.data.status})`);
}

async function cmdSend(senderType, content) {
  if (!currentSessionId) { err('No active session. Use "new" first.'); return; }
  if (!content.trim()) { err('Message cannot be empty.'); return; }

  const res = await api(`/sessions/${currentSessionId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content, senderType }),
  });

  if (!res.success) { err(res.error); return; }
  log(formatMessage(res.data));
}

async function cmdAddon(args) {
  if (!currentSessionId) { err('No active session.'); return; }

  const type = args[0] || 'written_report';
  const price = parseFloat(args[1]) || 5;
  const description = args.slice(2).join(' ') || `Add-on: ${type}`;

  const res = await api(`/sessions/${currentSessionId}/addons`, {
    method: 'POST',
    body: JSON.stringify({ addonType: type, priceUsdc: price, description }),
  });

  if (!res.success) { err(res.error); return; }
  ok(`Add-on requested: ${type} (+$${price} USDC) — id: ${res.data.id.slice(0, 8)}`);
}

async function cmdAddonRespond(accepted) {
  if (!currentSessionId) { err('No active session.'); return; }

  const addonsRes = await api(`/sessions/${currentSessionId}`);
  if (!addonsRes.success) { err(addonsRes.error); return; }

  const pending = (addonsRes.data.addons || []).find(a => a.status === 'pending');
  if (!pending) { err('No pending add-on to respond to.'); return; }

  const res = await api(`/sessions/${currentSessionId}/addons/${pending.id}/respond`, {
    method: 'POST',
    body: JSON.stringify({ accepted }),
  });

  if (!res.success) { err(res.error); return; }
  ok(`Add-on ${accepted ? 'accepted' : 'rejected'}: ${pending.addonType}`);
}

async function cmdComplete() {
  if (!currentSessionId) { err('No active session.'); return; }

  const res = await api(`/sessions/${currentSessionId}/complete`, { method: 'POST' });
  if (!res.success) { err(res.error); return; }
  ok(`Session completed. Payout: $${res.data.expertPayoutUsdc} USDC`);
}

async function cmdDecline(args) {
  if (!currentSessionId) { err('No active session.'); return; }

  const reason = args.join(' ') || undefined;
  const res = await api(`/sessions/${currentSessionId}/decline`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });

  if (!res.success) { err(res.error); return; }
  ok(`Session declined/cancelled.`);
}

async function cmdStatus() {
  if (!currentSessionId) { err('No active session.'); return; }

  const res = await api(`/sessions/${currentSessionId}`);
  if (!res.success) { err(res.error); return; }

  const s = res.data.session;
  log(`\n${BOLD}Session ${s.id.slice(0, 8)}${RESET}`);
  log(`  Status:    ${s.status}`);
  log(`  Offering:  ${s.offeringType}`);
  log(`  Tier:      ${s.tierId}`);
  log(`  Price:     $${s.priceUsdc} USDC`);
  log(`  Turns:     ${s.turnCount} / ${s.maxTurns}`);
  log(`  Expert:    ${s.expertId ? s.expertId.slice(0, 8) : 'none'}`);
  log(`  Agent:     ${s.buyerAgentDisplay || s.buyerAgent || 'none'}`);
  log(`  Messages:  ${res.data.messages.length}`);
  log(`  Add-ons:   ${res.data.addons.length}`);
  if (s.deadlineAt) log(`  Deadline:  ${s.deadlineAt}`);
  log('');
}

async function cmdMessages() {
  if (!currentSessionId) { err('No active session.'); return; }

  const res = await api(`/sessions/${currentSessionId}`);
  if (!res.success) { err(res.error); return; }

  if (res.data.messages.length === 0) {
    info('No messages yet.');
    return;
  }

  log('');
  for (const m of res.data.messages) {
    log(formatMessage(m));
  }
  log('');
}

async function cmdAddons() {
  if (!currentSessionId) { err('No active session.'); return; }

  const res = await api(`/sessions/${currentSessionId}`);
  if (!res.success) { err(res.error); return; }

  if (res.data.addons.length === 0) {
    info('No add-ons.');
    return;
  }

  for (const a of res.data.addons) {
    const status = a.status === 'pending' ? `${YELLOW}pending${RESET}` :
                   a.status === 'accepted' ? `${GREEN}accepted${RESET}` :
                   `${RED}${a.status}${RESET}`;
    log(`  ${a.id.slice(0, 8)} ${status} ${a.addonType} $${a.priceUsdc}`);
  }
}

async function cmdSessions() {
  const res = await api('/sessions');
  if (!res.success) { err(res.error); return; }

  if (res.data.length === 0) {
    info('No sessions.');
    return;
  }

  log('');
  for (const s of res.data.slice(-15)) {
    const marker = s.id === currentSessionId ? ` ${BOLD}← current${RESET}` : '';
    log(`  ${formatSession(s)}${marker}`);
  }
  log('');
}

async function cmdUse(args) {
  const idPrefix = args[0];
  if (!idPrefix) { err('Usage: use <session-id-prefix>'); return; }

  const res = await api('/sessions');
  if (!res.success) { err(res.error); return; }

  const match = res.data.find(s => s.id.startsWith(idPrefix));
  if (!match) { err(`No session found starting with "${idPrefix}"`); return; }

  currentSessionId = match.id;
  ok(`Switched to session ${match.id.slice(0, 8)} (${match.status})`);
}

function showHelp() {
  log(`
${BOLD}Taste Interactive REPL${RESET}
${DIM}Play as both Agent and Expert in a test session.${RESET}

${BOLD}Session:${RESET}
  ${CYAN}new${RESET} [offering] [tier]     Create session (default: content_quality_gate quick)
  ${CYAN}accept${RESET}                    Accept as expert
  ${CYAN}complete${RESET}                  Complete the session
  ${CYAN}decline${RESET} [reason]          Decline/cancel
  ${CYAN}status${RESET}                    Show session details
  ${CYAN}sessions${RESET}                  List all sessions
  ${CYAN}use${RESET} <id-prefix>           Switch to a session

${BOLD}Chat:${RESET}
  ${CYAN}a${RESET} <message>               Send message as ${CYAN}Agent${RESET}
  ${CYAN}e${RESET} <message>               Send message as ${GREEN}Expert${RESET}

${BOLD}Add-ons:${RESET}
  ${CYAN}addon${RESET} <type> <price>      Request add-on (as agent)
  ${CYAN}addon-accept${RESET}              Accept pending add-on (as expert)
  ${CYAN}addon-reject${RESET}              Reject pending add-on (as expert)
  ${CYAN}addons${RESET}                    List add-ons

${BOLD}Offerings:${RESET} trust_evaluation, output_quality_gate, option_ranking,
  content_quality_gate, audience_reaction_poll, creative_direction_check

${BOLD}Tiers:${RESET} test ($0.01, 2 turns), quick ($0.50-2, 10 turns),
  full ($2-5, 20 turns), deep ($5-15, 40 turns)

${BOLD}Add-on types:${RESET} extended_time, written_report, additional_review, priority_routing
`);
}

// ── REPL ──

async function main() {
  log(`\n${BOLD}Taste Interactive REPL${RESET}`);
  info('Logging in...');

  try {
    await login();
    ok('Logged in as admin (controls both Agent and Expert roles)');
  } catch (e) {
    err(`Login failed: ${e.message}`);
    err('Make sure the server is running: cd server && npm run dev');
    process.exit(1);
  }

  log(`${DIM}Type "help" for commands, "new" to create a session.${RESET}\n`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${BOLD}taste>${RESET} `,
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const trimmed = line.trim();
    if (!trimmed) { rl.prompt(); return; }

    const [cmd, ...args] = trimmed.split(/\s+/);

    try {
      switch (cmd.toLowerCase()) {
        case 'new':
          await cmdNew(args);
          break;
        case 'accept':
          await cmdAccept();
          break;
        case 'a':
        case 'agent':
          await cmdSend('agent', args.join(' '));
          break;
        case 'e':
        case 'expert':
          await cmdSend('expert', args.join(' '));
          break;
        case 'addon':
          await cmdAddon(args);
          break;
        case 'addon-accept':
          await cmdAddonRespond(true);
          break;
        case 'addon-reject':
          await cmdAddonRespond(false);
          break;
        case 'complete':
          await cmdComplete();
          break;
        case 'decline':
          await cmdDecline(args);
          break;
        case 'status':
          await cmdStatus();
          break;
        case 'messages':
        case 'msgs':
          await cmdMessages();
          break;
        case 'addons':
          await cmdAddons();
          break;
        case 'sessions':
        case 'ls':
          await cmdSessions();
          break;
        case 'use':
          await cmdUse(args);
          break;
        case 'help':
        case '?':
          showHelp();
          break;
        case 'quit':
        case 'exit':
        case 'q':
          log('Bye!');
          process.exit(0);
          break;
        default:
          err(`Unknown command: ${cmd}. Type "help" for commands.`);
      }
    } catch (e) {
      err(`Error: ${e.message}`);
    }

    rl.prompt();
  });

  rl.on('close', () => process.exit(0));
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
