import type { ApiResponse } from '../types/index.js';

const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const data = await res.json() as ApiResponse<T>;

  if (!res.ok && !data.error) {
    data.error = `Request failed with status ${res.status}`;
  }

  return data;
}

// ── Auth ──

export function login(email: string, password: string) {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function logout() {
  return request('/auth/logout', { method: 'POST' });
}

export function getMe() {
  return request('/auth/me');
}

// ── Experts ──

export function getExperts() {
  return request('/experts');
}

export function createExpert(data: { name: string; email: string; domains: string[]; password: string; credentials?: Record<string, unknown> }) {
  return request('/experts', { method: 'POST', body: JSON.stringify(data) });
}

export function updateExpert(id: string, data: Record<string, unknown>) {
  return request(`/experts/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export function deleteExpert(id: string) {
  return request(`/experts/${id}`, { method: 'DELETE' });
}

export function setPassword(id: string, password: string) {
  return request(`/experts/${id}/password`, { method: 'POST', body: JSON.stringify({ password }) });
}

export function acceptAgreement(id: string) {
  return request(`/experts/${id}/accept-agreement`, { method: 'POST', body: JSON.stringify({ accepted: true }) });
}

// ── Wallets & Withdrawals ──

export function setWallet(expertId: string, walletAddress: string, walletChain: string = 'base') {
  return request(`/experts/${expertId}/wallet`, {
    method: 'POST',
    body: JSON.stringify({ walletAddress, walletChain }),
  });
}

export function requestWithdrawal(amountUsdc: number) {
  return request('/withdrawals/request', {
    method: 'POST',
    body: JSON.stringify({ amountUsdc }),
  });
}

export function getWithdrawals() {
  return request('/withdrawals');
}

export function getPendingWithdrawals() {
  return request('/withdrawals/pending');
}

export function approveWithdrawal(id: string) {
  return request(`/withdrawals/${id}/approve`, { method: 'POST' });
}

export function rejectWithdrawal(id: string, reason: string) {
  return request(`/withdrawals/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export function completeWithdrawal(id: string, txHash: string) {
  return request(`/withdrawals/${id}/complete`, {
    method: 'POST',
    body: JSON.stringify({ txHash }),
  });
}

// ── Jobs ──

export function getJobs() {
  return request('/jobs');
}

export function getPendingJobs() {
  return request('/jobs/pending');
}

export function getJob(id: string) {
  return request(`/jobs/${id}`);
}

export function createTestJob(offeringType: string, requirements: Record<string, unknown>) {
  return request('/jobs', { method: 'POST', body: JSON.stringify({ offeringType, requirements }) });
}

// ── Judgments ──

export function submitJudgment(jobId: string, content: Record<string, unknown>) {
  return request('/judgments', { method: 'POST', body: JSON.stringify({ jobId, content }) });
}

// ── Reputation ──

export function getMyReputation() {
  return request('/reputation');
}

export function getExpertReputation(expertId: string) {
  return request(`/reputation/${expertId}`);
}

// ── Sessions (v1.1) ──

export function getSessions() {
  return request('/sessions');
}

export function getSession(id: string) {
  return request(`/sessions/${id}`);
}

export function getPendingSessions() {
  return request('/sessions/pending');
}

export function getActiveSessions() {
  return request('/sessions/active');
}

export function acceptSessionRequest(id: string) {
  return request(`/sessions/${id}/accept`, { method: 'POST' });
}

export function getSessionMessages(id: string) {
  return request(`/sessions/${id}/messages`);
}

export function sendSessionMessage(id: string, content: string, senderType?: string) {
  return request(`/sessions/${id}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content, senderType }),
  });
}

export function completeSession(id: string, deliverable?: { structuredData?: Record<string, unknown>; summary?: string }) {
  return request(`/sessions/${id}/complete`, {
    method: 'POST',
    body: JSON.stringify(deliverable ?? {}),
  });
}

export async function uploadAttachment(
  sessionId: string,
  file: File,
  context: 'chat' | 'completion' = 'chat',
): Promise<ApiResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('context', context);

  const res = await fetch(`${BASE}/sessions/${sessionId}/attachments`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
    // Note: no Content-Type header — browser sets it with boundary for FormData
  });

  return res.json() as Promise<ApiResponse>;
}

export function getSessionAttachments(sessionId: string) {
  return request(`/sessions/${sessionId}/attachments`);
}

export function declineSession(id: string, reason?: string) {
  return request(`/sessions/${id}/decline`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export function createSessionAdmin(data: Record<string, unknown>) {
  return request('/sessions', { method: 'POST', body: JSON.stringify(data) });
}

export function createAddonRequest(sessionId: string, addonType: string, priceUsdc: number, description?: string) {
  return request(`/sessions/${sessionId}/addons`, {
    method: 'POST',
    body: JSON.stringify({ addonType, priceUsdc, description }),
  });
}

export function respondToAddonRequest(sessionId: string, addonId: string, accepted: boolean) {
  return request(`/sessions/${sessionId}/addons/${addonId}/respond`, {
    method: 'POST',
    body: JSON.stringify({ accepted }),
  });
}

// ── Push Notifications ──

export function getVapidPublicKey() {
  return request<string>('/notifications/vapid-public-key');
}

export function subscribePush(subscription: PushSubscriptionJSON) {
  return request('/notifications/subscribe', {
    method: 'POST',
    body: JSON.stringify({ subscription }),
  });
}

export function unsubscribePush(endpoint: string) {
  return request('/notifications/unsubscribe', {
    method: 'POST',
    body: JSON.stringify({ endpoint }),
  });
}

// ── Agent Simulator (admin demo) ──

export const agentSim = {
  init: () => request('/agent-sim/init', { method: 'POST' }),
  status: () => request('/agent-sim/status'),
  offerings: () => request('/agent-sim/offerings'),
  samples: () => request('/agent-sim/samples'),
  createJob: (offeringIndex: number, requirement: Record<string, unknown>) =>
    request('/agent-sim/jobs', { method: 'POST', body: JSON.stringify({ offeringIndex, requirement }) }),
  getJobs: () => request('/agent-sim/jobs'),
  getJob: (jobId: number) => request(`/agent-sim/jobs/${jobId}`),
  payJob: (jobId: number) => request(`/agent-sim/jobs/${jobId}/pay`, { method: 'POST' }),
  acceptJob: (jobId: number, memo?: string) =>
    request(`/agent-sim/jobs/${jobId}/accept`, { method: 'POST', body: JSON.stringify({ memo }) }),
  rejectJob: (jobId: number, memo?: string) =>
    request(`/agent-sim/jobs/${jobId}/reject`, { method: 'POST', body: JSON.stringify({ memo }) }),
};

// ── ACP Inspector (admin) ──

export function getAcpJobs() {
  return request('/acp/jobs');
}

export function getAcpJob(jobId: number) {
  return request(`/acp/jobs/${jobId}`);
}

export function getAcpSessionInspection(sessionId: string) {
  return request(`/acp/sessions/${sessionId}`);
}

// ── Public (no auth) ──

export function getPublicStats() {
  return request('/public/stats');
}

export function getPublicExperts() {
  return request('/public/experts');
}

export function getPublicExpert(id: string) {
  return request(`/public/experts/${id}`);
}
