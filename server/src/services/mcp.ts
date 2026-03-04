/**
 * MCP Server with x402 Payment Gates
 *
 * Exposes Taste evaluation offerings as MCP tools that any MCP-compatible
 * client (Claude Desktop, Cursor, etc.) can discover and pay for via x402.
 *
 * Tools:
 *   - list_offerings (free)  — Discovery: available offerings, pricing, experts
 *   - request_evaluation (paid) — Create evaluation session, returns sessionId
 *   - get_result (free) — Poll session status, returns deliverable when complete
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { z } from 'zod';
import { useFacilitator } from 'x402/verify';
import { getEnv } from '../config/env.js';
import { getEnabledSessionOfferings, getSessionOffering } from '../config/domains.js';
import { getResourceAvailability, getOperatingHours } from './resource.js';
import {
  createSession, matchSession, notifyEligibleExperts,
  getSessionById, formatSessionDeliverable,
} from './sessions.js';

// USDC on Base (6 decimals)
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const USDC_BASE_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
const USDC_DECIMALS = 6;

// ── Helpers ──

/** Send a JSON response on raw HTTP ServerResponse */
function sendJson(res: ServerResponse, status: number, body: object): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

type X402Network = 'base' | 'base-sepolia';

interface PaymentRequirements {
  scheme: 'exact';
  network: X402Network;
  maxAmountRequired: string;
  resource: string;
  description: string;
  mimeType: string;
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;
}

function buildPaymentRequirements(
  walletAddress: string,
  network: X402Network,
  priceUsdc: number,
  resource: string,
  description: string,
): PaymentRequirements {
  const asset = network === 'base-sepolia' ? USDC_BASE_SEPOLIA : USDC_BASE;
  const amountBaseUnits = Math.round(priceUsdc * 10 ** USDC_DECIMALS).toString();

  return {
    scheme: 'exact',
    network,
    maxAmountRequired: amountBaseUnits,
    resource,
    description,
    mimeType: 'application/json',
    payTo: walletAddress,
    maxTimeoutSeconds: 300,
    asset,
  };
}

/** Check if a JSON-RPC body is a tools/call for a specific tool */
function isToolCall(body: unknown, toolName: string): boolean {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  if (b.method !== 'tools/call') return false;
  const params = b.params as Record<string, unknown> | undefined;
  return params?.name === toolName;
}

/** Extract offering info from a tools/call body */
function extractOfferingFromToolCall(body: unknown) {
  try {
    const b = body as Record<string, unknown>;
    const params = b.params as Record<string, unknown>;
    const args = params.arguments as Record<string, unknown>;
    const offeringType = args.offeringType as string;
    return getSessionOffering(offeringType);
  } catch {
    return null;
  }
}

// ── MCP Server Factory ──
// Creates a fresh McpServer per request to avoid "Already connected" errors
// when concurrent requests arrive (McpServer only supports one transport at a time).

let httpServer: ReturnType<typeof createServer> | null = null;
// Cached facilitator instance (stateless — safe to reuse across requests)
let cachedFacilitator: ReturnType<typeof useFacilitator> | null = null;

function createMcpServer(): McpServer {
  // Derive offering enum from live config instead of hardcoding
  const enabledTypes = getEnabledSessionOfferings().map(o => o.type) as [string, ...string[]];

  const server = new McpServer({
    name: 'taste-human-judgment',
    version: '1.0.0',
  });

  // ── FREE: list_offerings ──
  server.tool(
    'list_offerings',
    'List all available human expert evaluation offerings with pricing, domains, and current expert availability.',
    {},
    async () => {
      const availability = getResourceAvailability();
      const hours = getOperatingHours();
      const offerings = getEnabledSessionOfferings().map(o => ({
        type: o.type,
        name: o.name,
        description: o.description,
        priceUsdc: o.basePrice ?? 0.01,
        domains: o.relevantDomains,
        defaultTier: o.defaultTier,
      }));

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            service: 'Taste: Human Expert Judgment Oracle',
            status: hours.currentlyOpen ? 'open' : 'closed',
            operatingHours: hours.schedule,
            nextOpenAt: hours.nextOpenAt,
            onlineExperts: availability.capacity.onlineExperts,
            offerings,
            usage: 'Call request_evaluation with an offeringType and description. Then poll get_result with the returned sessionId.',
          }, null, 2),
        }],
      };
    },
  );

  // ── PAID: request_evaluation ──
  // Payment is handled at the HTTP transport layer via x402.
  // By the time this handler runs, payment has already been verified.
  server.tool(
    'request_evaluation',
    'Request a human expert evaluation. Requires x402 payment. Returns a session ID for polling results via get_result. Expert reviews typically complete within 5-30 minutes.',
    {
      offeringType: z.enum(enabledTypes)
        .describe('Type of evaluation to request. Call list_offerings to see available types.'),
      description: z.string().min(10).max(5000)
        .describe('Detailed description of what you need evaluated. Be specific about context, criteria, and what outcome you expect.'),
      tier: z.enum(['test', 'quick', 'full', 'deep']).optional()
        .describe('Session tier affecting depth and duration. Defaults to the offering default.'),
    },
    async ({ offeringType, description, tier }) => {
      // Check operating hours
      const hours = getOperatingHours();
      if (!hours.currentlyOpen) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              error: 'outside_operating_hours',
              message: `Experts are currently offline. ${hours.note}`,
              nextOpenAt: hours.nextOpenAt,
              tip: 'Resubmit your request when experts are online.',
            }),
          }],
          isError: true,
        };
      }

      // Validate offering
      const offering = getSessionOffering(offeringType);
      if (!offering || !offering.enabled) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              error: 'offering_unavailable',
              message: `Offering "${offeringType}" is not currently available.`,
            }),
          }],
          isError: true,
        };
      }

      // Create session via existing logic
      const session = createSession({
        offeringType,
        tierId: tier,
        description,
        tags: ['mcp'],
        buyerAgent: 'mcp-client',
        buyerAgentDisplay: 'MCP Client',
        priceUsdc: offering.basePrice ?? 0.01,
      });

      // Match to experts and notify
      const { eligibleExpertIds } = matchSession(session.id);
      notifyEligibleExperts(session, eligibleExpertIds);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            sessionId: session.id,
            status: 'matching',
            offeringType,
            priceUsdc: offering.basePrice ?? 0.01,
            message: 'Your request has been submitted. Experts have been notified.',
            tip: 'Poll get_result with this sessionId to check for completion. Typical wait: 5-30 minutes.',
          }, null, 2),
        }],
      };
    },
  );

  // ── FREE: get_result ──
  server.tool(
    'get_result',
    'Check the status of a previously submitted evaluation request. Returns the full deliverable when the expert has completed their review.',
    {
      sessionId: z.string().describe('The session ID returned by request_evaluation.'),
    },
    async ({ sessionId }) => {
      const session = getSessionById(sessionId);
      if (!session) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ error: 'not_found', message: 'Session not found. Check the sessionId.' }),
          }],
          isError: true,
        };
      }

      // Only allow MCP clients to check MCP-created sessions
      if (!session.tags.includes('mcp')) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ error: 'not_found', message: 'Session not found. Check the sessionId.' }),
          }],
          isError: true,
        };
      }

      if (session.status === 'completed') {
        const deliverable = formatSessionDeliverable(sessionId);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ status: 'completed', deliverable }, null, 2),
          }],
        };
      }

      if (session.status === 'cancelled' || session.status === 'timeout') {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              status: session.status,
              reason: session.cancelReason ?? 'Session ended without completion.',
              message: 'This evaluation did not complete. You may submit a new request.',
            }),
          }],
        };
      }

      // Still in progress
      const estimatedWaitMins = session.status === 'active' ? 5 : 10;
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            status: session.status,
            message: session.status === 'active'
              ? 'An expert is actively reviewing your request.'
              : 'Waiting for an expert to accept your request.',
            estimatedWaitMins,
            tip: 'Poll again in 30-60 seconds.',
          }, null, 2),
        }],
      };
    },
  );

  return server;
}

// ── HTTP Server with x402 Middleware ──

async function handleMcpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  env: ReturnType<typeof getEnv>,
): Promise<void> {
  // Parse JSON body for POST requests (1MB limit to prevent memory exhaustion)
  const MAX_BODY_SIZE = 1_048_576;
  let body: unknown = undefined;
  if (req.method === 'POST') {
    const chunks: Buffer[] = [];
    let totalSize = 0;
    for await (const chunk of req) {
      totalSize += (chunk as Buffer).length;
      if (totalSize > MAX_BODY_SIZE) {
        sendJson(res, 413, { error: 'Request body too large' });
        return;
      }
      chunks.push(chunk as Buffer);
    }
    try {
      body = JSON.parse(Buffer.concat(chunks).toString());
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON' });
      return;
    }
  }

  // x402 payment gate for request_evaluation tool
  if (req.method === 'POST' && env.MCP_WALLET_ADDRESS && body && isToolCall(body, 'request_evaluation')) {
    // Extract offering once for both challenge and verification paths
    const offering = extractOfferingFromToolCall(body);
    if (!offering) {
      sendJson(res, 400, { error: 'invalid_request', message: 'Could not determine offering type from request.' });
      return;
    }
    const price = offering.basePrice ?? 0.01;
    const resourceUrl = `https://${env.NODE_ENV === 'production' ? 'humantaste.app' : 'localhost:' + env.MCP_PORT}/mcp/request_evaluation`;
    const requirements = buildPaymentRequirements(
      env.MCP_WALLET_ADDRESS,
      env.MCP_NETWORK as X402Network,
      price,
      resourceUrl,
      `Human expert evaluation (${offering.name})`,
    );

    const paymentHeader = req.headers['x-payment'] as string | undefined;

    if (!paymentHeader) {
      // Return 402 with payment requirements
      res.writeHead(402, {
        'Content-Type': 'application/json',
        'X-Payment-Requirements': Buffer.from(JSON.stringify({
          x402Version: 1,
          accepts: [requirements],
        })).toString('base64'),
      });
      res.end(JSON.stringify({
        error: 'payment_required',
        message: 'This tool requires x402 payment. Include an X-Payment header with a valid payment.',
        priceUsdc: price,
      }));
      return;
    }

    // Verify payment via facilitator
    try {
      const payment = JSON.parse(Buffer.from(paymentHeader, 'base64').toString());

      if (!cachedFacilitator) {
        cachedFacilitator = useFacilitator({
          url: env.MCP_FACILITATOR_URL as `${string}://${string}`,
        });
      }
      const verification = await cachedFacilitator.verify(payment, requirements);

      if (!verification.isValid) {
        sendJson(res, 402, { error: 'invalid_payment', message: 'Payment verification failed.', details: verification.invalidReason });
        return;
      }

      // Settle payment
      const settlement = await cachedFacilitator.settle(payment, requirements);
      if (!settlement.success) {
        sendJson(res, 402, { error: 'settlement_failed', message: 'Payment settlement failed.' });
        return;
      }

      console.log(`[MCP] x402 payment settled: ${price} USDC from ${payment.payload?.authorization?.from ?? 'unknown'}`);
    } catch (err) {
      console.error('[MCP] x402 payment error:', err);
      sendJson(res, 402, { error: 'payment_error', message: 'Failed to process payment.' });
      return;
    }
  }

  // Create a fresh McpServer + transport per request to support concurrency.
  // McpServer only supports one active transport at a time, so sharing a singleton
  // would crash with "Already connected" on concurrent requests.
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  try {
    await transport.handleRequest(req, res, body);
  } finally {
    await transport.close();
  }
}

// ── Public API ──

export async function initMcp(): Promise<void> {
  const env = getEnv();

  if (!env.MCP_WALLET_ADDRESS && env.NODE_ENV === 'production') {
    console.log('[MCP] No MCP_WALLET_ADDRESS configured, skipping MCP server');
    return;
  }

  // Pre-cache facilitator instance
  if (env.MCP_WALLET_ADDRESS) {
    cachedFacilitator = useFacilitator({
      url: env.MCP_FACILITATOR_URL as `${string}://${string}`,
    });
  }

  httpServer = createServer((req, res) => {
    // CORS for MCP clients
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Payment, X-Payment-Requirements, mcp-session-id');
    res.setHeader('Access-Control-Expose-Headers', 'X-Payment-Requirements, mcp-session-id');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    handleMcpRequest(req, res, env).catch(err => {
      console.error('[MCP] Request error:', err);
      if (!res.headersSent) {
        sendJson(res, 500, { error: 'Internal server error' });
      }
    });
  });

  httpServer.listen(env.MCP_PORT, () => {
    console.log(`[MCP] Server running on http://localhost:${env.MCP_PORT}`);
    if (env.MCP_WALLET_ADDRESS) {
      console.log(`[MCP] x402 payments enabled → ${env.MCP_WALLET_ADDRESS} (${env.MCP_NETWORK})`);
    } else {
      console.log('[MCP] x402 payments disabled (dev mode — all tools free)');
    }
  });
}

export function stopMcp(): void {
  if (httpServer) {
    httpServer.close();
    httpServer = null;
  }
  cachedFacilitator = null;
}
