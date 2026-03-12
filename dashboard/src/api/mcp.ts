/**
 * MCP JSON-RPC client for the dashboard test page.
 * Talks to the MCP server via /mcp proxy (Vite dev) or nginx (prod).
 */

import { createPaymentHeader } from 'x402/client';
import type { EvmSigner } from './wallet.js';

let rpcId = 0;

export interface RpcResult<T = unknown> {
  data: T | null;
  httpStatus: number;
  paymentRequirements?: PaymentRequirements;
  raw: { request: unknown; response: unknown };
  error?: string;
}

export interface PaymentRequirements {
  x402Version: number;
  accepts: Array<{
    scheme: string;
    network: string;
    maxAmountRequired: string;
    resource: string;
    description: string;
    mimeType: string;
    payTo: string;
    maxTimeoutSeconds: number;
    asset: string;
  }>;
}

export interface McpOffering {
  type: string;
  name: string;
  priceUsdc: number;
  domains: string[];
  expertAvailability: string;
  tier: string;
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

async function mcpRpc<T = unknown>(method: string, params: unknown = {}): Promise<RpcResult<T>> {
  const id = ++rpcId;
  const body = { jsonrpc: '2.0', id, method, params };

  let res: Response;
  try {
    res = await fetch('/mcp/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify(body),
    });
  } catch {
    return { data: null, httpStatus: 0, error: 'Network error', raw: { request: body, response: null } };
  }

  // Handle 402 payment required
  if (res.status === 402) {
    let paymentRequirements: PaymentRequirements | undefined;
    const header = res.headers.get('X-Payment-Requirements');
    if (header) {
      try {
        paymentRequirements = JSON.parse(atob(header)) as PaymentRequirements;
      } catch { /* ignore parse errors */ }
    }
    let responseBody: unknown = null;
    try { responseBody = await res.json(); } catch { /* ignore */ }
    return {
      data: null,
      httpStatus: 402,
      paymentRequirements,
      error: 'Payment required',
      raw: { request: body, response: responseBody },
    };
  }

  // Parse response — could be JSON-RPC or SSE
  let responseBody: unknown;
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('text/event-stream')) {
    // SSE: collect data lines for last "message" event
    const text = await res.text();
    const lines = text.split('\n');
    let lastData = '';
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        lastData = line.slice(6);
      }
    }
    try { responseBody = JSON.parse(lastData); } catch { responseBody = text; }
  } else {
    try { responseBody = await res.json(); } catch { responseBody = null; }
  }

  const rpcResponse = responseBody as { result?: { content?: Array<{ text?: string }> }; error?: { message?: string } } | null;

  if (rpcResponse?.error) {
    return {
      data: null,
      httpStatus: res.status,
      error: rpcResponse.error.message ?? 'RPC error',
      raw: { request: body, response: responseBody },
    };
  }

  // Extract tool result text content
  const content = rpcResponse?.result?.content;
  let data: T | null = null;
  if (Array.isArray(content) && content.length > 0 && content[0].text) {
    try { data = JSON.parse(content[0].text) as T; } catch { data = content[0].text as T; }
  }

  return { data, httpStatus: res.status, raw: { request: body, response: responseBody } };
}

// ── Public API ──

export async function listTools(): Promise<RpcResult<{ tools: McpTool[] }>> {
  return mcpRpc('tools/list');
}

export async function listOfferings(): Promise<RpcResult<{ offerings: McpOffering[] }>> {
  return mcpRpc('tools/call', { name: 'list_offerings', arguments: {} });
}

export async function requestEvaluation(
  offeringType: string,
  description: string,
  tier?: string,
): Promise<RpcResult<{ sessionId: string; status: string; message: string }>> {
  const args: Record<string, string> = { offeringType, description };
  if (tier) args.tier = tier;
  return mcpRpc('tools/call', { name: 'request_evaluation', arguments: args });
}

export async function getResult(sessionId: string): Promise<RpcResult<{
  status: string;
  sessionId: string;
  deliverable?: unknown;
  message?: string;
}>> {
  return mcpRpc('tools/call', { name: 'get_result', arguments: { sessionId } });
}

export type PaymentStatus = 'idle' | 'signing' | 'submitting' | 'done' | 'error';

export interface PaymentRpcResult<T = unknown> extends RpcResult<T> {
  paymentStatus: PaymentStatus;
}

export async function requestEvaluationWithPayment(
  offeringType: string,
  description: string,
  tier: string | undefined,
  signer: EvmSigner,
  onStatus?: (status: PaymentStatus) => void,
): Promise<PaymentRpcResult<{ sessionId: string; status: string; message: string }>> {
  const notify = onStatus ?? (() => {});

  // Step 1: Make initial request (will return 402)
  notify('submitting');
  const initial = await requestEvaluation(offeringType, description, tier);

  if (initial.httpStatus !== 402 || !initial.paymentRequirements) {
    // Free mode or unexpected response — return as-is
    return { ...initial, paymentStatus: initial.data ? 'done' : 'error' };
  }

  // Step 2: Sign payment
  notify('signing');
  const accept = initial.paymentRequirements.accepts[0];
  if (!accept) {
    return { ...initial, paymentStatus: 'error', error: 'No payment options in 402 response' };
  }

  let paymentHeader: string;
  try {
    // Cast accept to x402's PaymentRequirements type (our interface uses string for scheme/network)
    paymentHeader = await createPaymentHeader(
      signer,
      initial.paymentRequirements.x402Version,
      accept as Parameters<typeof createPaymentHeader>[2],
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Signing failed';
    return { ...initial, paymentStatus: 'error', error: msg };
  }

  // Step 3: Retry with payment header
  notify('submitting');
  const id = ++rpcId;
  const body = {
    jsonrpc: '2.0',
    id,
    method: 'tools/call',
    params: {
      name: 'request_evaluation',
      arguments: { offeringType, description, ...(tier ? { tier } : {}) },
    },
  };

  let res: Response;
  try {
    res = await fetch('/mcp/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'X-Payment': paymentHeader,
      },
      body: JSON.stringify(body),
    });
  } catch {
    return {
      data: null, httpStatus: 0, error: 'Network error on paid request',
      paymentStatus: 'error', raw: { request: body, response: null },
    };
  }

  // Parse response (reuse same logic as mcpRpc)
  let responseBody: unknown;
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('text/event-stream')) {
    const text = await res.text();
    const lines = text.split('\n');
    let lastData = '';
    for (const line of lines) {
      if (line.startsWith('data: ')) lastData = line.slice(6);
    }
    try { responseBody = JSON.parse(lastData); } catch { responseBody = text; }
  } else {
    try { responseBody = await res.json(); } catch { responseBody = null; }
  }

  const rpcResponse = responseBody as {
    result?: { content?: Array<{ text?: string }> };
    error?: { message?: string };
  } | null;

  if (rpcResponse?.error) {
    return {
      data: null, httpStatus: res.status, error: rpcResponse.error.message ?? 'RPC error',
      paymentStatus: 'error', raw: { request: body, response: responseBody },
    };
  }

  const content = rpcResponse?.result?.content;
  let data: { sessionId: string; status: string; message: string } | null = null;
  if (Array.isArray(content) && content.length > 0 && content[0].text) {
    try { data = JSON.parse(content[0].text); } catch { data = content[0].text as never; }
  }

  notify('done');
  return { data, httpStatus: res.status, paymentStatus: data ? 'done' : 'error', raw: { request: body, response: responseBody } };
}
