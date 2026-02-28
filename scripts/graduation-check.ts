/**
 * Graduation Health Check — Exercises all 8 offerings end-to-end.
 *
 * Run before ACP graduation submission and daily during the review period.
 * If ANY single offering fails, the entire submission is rejected.
 *
 * Usage:
 *   ADMIN_PASSWORD=xxx npx tsx scripts/graduation-check.ts
 *   BASE_URL=http://localhost:3001 ADMIN_PASSWORD=xxx npx tsx scripts/graduation-check.ts
 */

const BASE_URL = process.env.BASE_URL || 'https://humantaste.app';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@taste.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const POLL_INTERVAL = 3000;   // 3s between polls
const POLL_TIMEOUT = 120_000; // 2min max wait per step

if (!ADMIN_PASSWORD) {
  console.error('ADMIN_PASSWORD is required. Usage:');
  console.error('  ADMIN_PASSWORD=xxx npx tsx scripts/graduation-check.ts');
  process.exit(1);
}

// ── Sample structured data per offering (matches deliverable-schemas.ts) ──

const SAMPLE_DELIVERABLES: Record<string, Record<string, unknown>> = {
  trust_evaluation: {
    verdict: 'legitimate',
    confidenceScore: 8,
    summary: 'Graduation health check — automated test assessment.',
    keyFindings: 'Automated test finding.',
    redFlags: '',
    positiveSignals: 'Automated test signal.',
  },
  output_quality_gate: {
    qualityVerdict: 'approved',
    qualityScore: 8,
    summary: 'Graduation health check — automated quality gate.',
    issuesFound: '',
    suggestedImprovements: '',
  },
  option_ranking: {
    topPick: 'Option A',
    summary: 'Graduation health check — automated ranking.',
    rankings: '1. Option A — Best overall.\n2. Option B — Runner up.',
    tradeoffs: 'Minimal tradeoffs for test data.',
  },
  content_quality_gate: {
    verdict: 'safe',
    culturalSensitivityScore: 8,
    brandSafetyScore: 8,
    summary: 'Graduation health check — automated content gate.',
    flaggedIssues: '',
  },
  audience_reaction_poll: {
    overallRating: 8,
    summary: 'Graduation health check — automated audience poll.',
    criteriaScores: 'Appeal: 8/10. Clarity: 8/10.',
    comparisonNotes: '',
  },
  creative_direction_check: {
    verdict: 'proceed',
    viabilityScore: 8,
    summary: 'Graduation health check — automated creative check.',
    culturalFlags: '',
    tonalAlignment: 'Tone matches target audience.',
  },
  fact_check_verification: {
    overallAccuracy: 'high',
    claimsChecked: 1,
    summary: 'Graduation health check — automated fact check.',
    flaggedClaims: '',
    corrections: '',
  },
  dispute_arbitration: {
    verdict: 'approve',
    reasoning: 'Graduation health check — automated arbitration. Deliverable meets requirements.',
    deliverableQuality: 'adequate',
    contractAlignment: 'fully_met',
    summary: 'Approved for graduation test purposes.',
  },
};

// ── HTTP helpers ──

let _cookie = '';

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

async function api<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
): Promise<ApiResponse<T>> {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (_cookie) headers['Cookie'] = _cookie;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });

  // Capture set-cookie header
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    const tokenMatch = setCookie.match(/token=([^;]+)/);
    if (tokenMatch) _cookie = `token=${tokenMatch[1]}`;
  }

  const json = await res.json() as ApiResponse<T>;
  if (!json.success) {
    throw new Error(json.error || `API error: ${res.status}`);
  }
  return json;
}

// ── Polling helper ──

async function poll<T>(
  fn: () => Promise<T>,
  check: (result: T) => boolean,
  label: string,
): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < POLL_TIMEOUT) {
    const result = await fn();
    if (check(result)) return result;
    await sleep(POLL_INTERVAL);
  }
  throw new Error(`Timeout waiting for: ${label}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Formatting ──

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60_000);
  const secs = Math.round((ms % 60_000) / 1000);
  return `${mins}m ${secs}s`;
}

function pass(label: string, ms: number, extra = ''): void {
  const padding = 30 - label.length;
  const padStr = ' '.repeat(Math.max(1, padding));
  const extraStr = extra ? `  ${extra}` : '';
  console.log(`[+] ${label}${padStr}(${formatMs(ms)})${extraStr}`);
}

function fail(label: string, error: string): void {
  const padding = 30 - label.length;
  const padStr = ' '.repeat(Math.max(1, padding));
  console.log(`[X] ${label}${padStr}FAILED: ${error}`);
}

// ── Main ──

interface OfferingInfo {
  index: number;
  name: string;
  price: number;
  exampleInput: string;
}

interface JobStatus {
  id: number;
  phase: string;
  phaseNum: number;
  price: number;
  memos: Array<{ content: string }>;
}

interface SessionInfo {
  id: string;
  status: string;
  offeringType: string;
  acpJobId: string | null;
  expertId: string | null;
}

async function main(): Promise<void> {
  console.log('=== Taste Graduation Health Check ===');
  console.log(`Target: ${BASE_URL}`);
  console.log('');

  let totalPassed = 0;
  let totalFailed = 0;
  const overallStart = Date.now();

  // ── Pre-flight checks ──

  // Health endpoint
  try {
    const start = Date.now();
    await api('GET', '/api/health');
    pass('Health endpoint', Date.now() - start);
  } catch (err) {
    fail('Health endpoint', (err as Error).message);
    totalFailed++;
  }

  // Resource: availability
  try {
    const start = Date.now();
    const res = await api<{ offerings: unknown[] }>('GET', '/api/public/resource/availability');
    pass('Resource: availability', Date.now() - start);
    if (!res.data) throw new Error('No data returned');
  } catch (err) {
    fail('Resource: availability', (err as Error).message);
    totalFailed++;
  }

  // Resource: offerings
  try {
    const start = Date.now();
    const res = await api<unknown[]>('GET', '/api/public/resource/offerings');
    const count = Array.isArray(res.data) ? res.data.length : '?';
    pass('Resource: offerings', Date.now() - start, `${count} offerings`);
  } catch (err) {
    fail('Resource: offerings', (err as Error).message);
    totalFailed++;
  }

  // Resource: samples
  try {
    const start = Date.now();
    const res = await api<unknown[]>('GET', '/api/public/resource/samples');
    const count = Array.isArray(res.data) ? res.data.length : '?';
    pass('Resource: samples', Date.now() - start, `${count} samples`);
  } catch (err) {
    fail('Resource: samples', (err as Error).message);
    totalFailed++;
  }

  // ── Login ──

  try {
    const start = Date.now();
    await api('POST', '/api/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    pass('Admin login', Date.now() - start);
  } catch (err) {
    fail('Admin login', (err as Error).message);
    console.error('\nCannot continue without admin login. Exiting.');
    process.exit(1);
  }

  // ── Initialize buyer client ──

  try {
    const start = Date.now();
    await api('POST', '/api/agent-sim/init');
    pass('Buyer client initialized', Date.now() - start);
  } catch (err) {
    fail('Buyer client initialized', (err as Error).message);
    console.error('\nCannot continue without buyer client. Exiting.');
    process.exit(1);
  }

  // ── Discover offerings ──

  let offerings: OfferingInfo[] = [];
  try {
    const res = await api<OfferingInfo[]>('GET', '/api/agent-sim/offerings');
    offerings = res.data ?? [];
    console.log(`\nDiscovered ${offerings.length} offerings. Testing each...\n`);
  } catch (err) {
    fail('Discover offerings', (err as Error).message);
    console.error('\nCannot continue without offerings. Exiting.');
    process.exit(1);
  }

  // ── Test each offering ──

  console.log('Offering Tests:');

  for (const offering of offerings) {
    const offeringStart = Date.now();
    const name = offering.name;

    try {
      // Parse example input for the requirement
      let requirement: Record<string, unknown>;
      try {
        requirement = JSON.parse(offering.exampleInput);
      } catch {
        requirement = { test: 'graduation-check' };
      }

      // Step 1: Create buyer job
      const createRes = await api<{ jobId: number }>('POST', '/api/agent-sim/jobs', {
        offeringIndex: offering.index,
        requirement,
      });
      const jobId = createRes.data!.jobId;

      // Step 2: Poll until NEGOTIATION
      await poll(
        () => api<JobStatus>('GET', `/api/agent-sim/jobs/${jobId}`).then(r => r.data!),
        (job) => job.phase === 'NEGOTIATION',
        `${name}: NEGOTIATION`,
      );

      // Step 3: Pay for job
      await api('POST', `/api/agent-sim/jobs/${jobId}/pay`);

      // Step 4: Poll until session appears
      const session = await poll(
        async () => {
          const res = await api<SessionInfo[]>('GET', '/api/sessions');
          const sessions = res.data ?? [];
          return sessions.find(s => s.acpJobId === String(jobId)) ?? null;
        },
        (s) => s !== null && ['accepted', 'active', 'matching', 'pending'].includes(s.status),
        `${name}: session created`,
      );

      if (!session) throw new Error('Session not found after payment');

      // Step 5: Accept session (if still in accepted/pending state)
      if (session.status === 'accepted' || session.status === 'pending' || session.status === 'matching') {
        await api('POST', `/api/sessions/${session.id}/accept`);
      }

      // Step 6: Complete session with structured data
      const deliverable = SAMPLE_DELIVERABLES[name];
      if (!deliverable) throw new Error(`No sample deliverable for offering: ${name}`);

      await api('POST', `/api/sessions/${session.id}/complete`, {
        structuredData: deliverable,
        summary: deliverable.summary,
      });

      // Step 7: Poll until EVALUATION
      await poll(
        () => api<JobStatus>('GET', `/api/agent-sim/jobs/${jobId}`).then(r => r.data!),
        (job) => job.phase === 'EVALUATION' || job.phase === 'COMPLETED',
        `${name}: EVALUATION`,
      );

      // Step 8: Accept deliverable (buyer side)
      const jobBeforeAccept = await api<JobStatus>('GET', `/api/agent-sim/jobs/${jobId}`).then(r => r.data!);
      if (jobBeforeAccept.phase === 'EVALUATION') {
        await api('POST', `/api/agent-sim/jobs/${jobId}/accept`);
      }

      // Step 9: Verify COMPLETED
      const finalJob = await poll(
        () => api<JobStatus>('GET', `/api/agent-sim/jobs/${jobId}`).then(r => r.data!),
        (job) => job.phase === 'COMPLETED',
        `${name}: COMPLETED`,
      );

      if (finalJob.phase !== 'COMPLETED') {
        throw new Error(`Expected COMPLETED, got ${finalJob.phase}`);
      }

      pass(name, Date.now() - offeringStart, 'COMPLETED');
      totalPassed++;
    } catch (err) {
      fail(name, (err as Error).message);
      totalFailed++;
    }
  }

  // ── Summary ──

  console.log('');
  const total = totalPassed + totalFailed;
  const resultStr = totalFailed === 0 ? `${totalPassed}/${total} offerings passed` : `${totalFailed}/${total} offerings FAILED`;
  console.log(`Result: ${resultStr}`);
  console.log(`Total time: ${formatMs(Date.now() - overallStart)}`);

  if (totalFailed > 0) {
    console.log('\nWARNING: Failures detected. Do NOT submit for graduation until all pass.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
