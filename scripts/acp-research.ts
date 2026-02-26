/**
 * ACP Ecosystem Research Script
 *
 * Searches the Virtuals ACP marketplace to find target agents,
 * analyze common request patterns, and identify demand signals
 * for optimizing Taste's offerings.
 *
 * Usage: npx tsx scripts/acp-research.ts
 *
 * No auth required — uses the public search API.
 */

const ACP_API = 'https://acpx.virtuals.io/api';
const TOP_K = 25; // Max results per query

// ── Search queries targeting our ideal buyers ──

const SEARCH_QUERIES = [
  // Direct demand for our services
  'human review',
  'human evaluation',
  'fact check',
  'trust evaluation',
  'quality check',
  'content review',
  'dispute arbitration',

  // Agent types that need human judgment
  'research agent',
  'content generation',
  'trading agent',
  'DeFi analysis',
  'social media agent',
  'marketing agent',
  'creative agent',

  // Butler and orchestrators
  'Butler',
  'orchestrator',

  // High-volume categories
  'meme generation',
  'image generation',
  'token analysis',
  'portfolio management',
  'prediction market',
];

interface AgentOffering {
  id: number;
  name: string;
  type: string;
  description: string;
  price: number;
  priceV2?: { type: string; value: number };
  slaMinutes: number;
  requirement?: unknown;
  deliverable?: unknown;
}

interface AgentResult {
  id: number;
  name: string;
  description: string;
  walletAddress: string;
  twitterHandle?: string;
  profilePic?: string;
  tokenAddress?: string;
  jobs: AgentOffering[];
  resources?: Array<{ name: string; description: string; url: string }>;
  metrics?: {
    totalJobs?: number;
    successRate?: number;
    totalRevenue?: number;
    uniqueBuyers?: number;
    minsFromLastOnline?: number;
    graduationStatus?: string;
  };
}

async function searchAgents(query: string): Promise<AgentResult[]> {
  const url = `${ACP_API}/agents/v4/search?search=${encodeURIComponent(query)}&top_k=${TOP_K}&showHiddenOfferings=true`;
  try {
    const res = await fetch(url);
    const json = await res.json() as { data: AgentResult[] };
    return json.data ?? [];
  } catch (err) {
    console.error(`  Failed to search "${query}":`, err);
    return [];
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Main ──

async function main() {
  console.log('=== ACP Ecosystem Research ===\n');
  console.log(`Running ${SEARCH_QUERIES.length} searches against ${ACP_API}\n`);

  const allAgents = new Map<string, AgentResult>(); // wallet → agent (dedup)
  const queryHits = new Map<string, string[]>(); // query → wallet addresses

  for (const query of SEARCH_QUERIES) {
    process.stdout.write(`Searching "${query}"...`);
    const agents = await searchAgents(query);
    console.log(` ${agents.length} results`);

    queryHits.set(query, agents.map(a => a.walletAddress));
    for (const agent of agents) {
      if (!allAgents.has(agent.walletAddress)) {
        allAgents.set(agent.walletAddress, agent);
      }
    }

    await sleep(300); // Rate limit courtesy
  }

  console.log(`\nTotal unique agents found: ${allAgents.size}\n`);

  // ── Analyze offerings across all agents ──

  const offeringNames = new Map<string, number>(); // offering name → count
  const offeringDescriptions: Array<{ agent: string; offering: string; description: string }> = [];
  const agentsByJobCount = [...allAgents.values()]
    .map(a => ({ name: a.name, wallet: a.walletAddress, jobs: a.jobs?.length ?? 0, description: a.description?.slice(0, 120) ?? '', metrics: a.metrics }))
    .sort((a, b) => b.jobs - a.jobs);

  for (const agent of allAgents.values()) {
    for (const job of agent.jobs ?? []) {
      const name = job.name?.toLowerCase() ?? 'unnamed';
      offeringNames.set(name, (offeringNames.get(name) ?? 0) + 1);
      if (job.description) {
        offeringDescriptions.push({
          agent: agent.name,
          offering: job.name,
          description: job.description.slice(0, 200),
        });
      }
    }
  }

  // ── Report: Top agents by offering count ──

  console.log('=== TOP AGENTS BY OFFERING COUNT ===\n');
  for (const agent of agentsByJobCount.slice(0, 30)) {
    const metrics = agent.metrics;
    const metricStr = metrics
      ? ` | jobs: ${metrics.totalJobs ?? '?'}, success: ${metrics.successRate ?? '?'}%, revenue: $${metrics.totalRevenue ?? '?'}, buyers: ${metrics.uniqueBuyers ?? '?'}, lastOnline: ${metrics.minsFromLastOnline ?? '?'}min`
      : '';
    console.log(`  ${agent.name} (${agent.jobs} offerings)${metricStr}`);
    console.log(`    ${agent.description}`);
  }

  // ── Report: Most common offering names ──

  console.log('\n=== MOST COMMON OFFERING NAMES ===\n');
  const sortedOfferings = [...offeringNames.entries()].sort((a, b) => b[1] - a[1]);
  for (const [name, count] of sortedOfferings.slice(0, 50)) {
    console.log(`  ${count}x  ${name}`);
  }

  // ── Report: Agents that appear in multiple searches (high relevance) ──

  console.log('\n=== AGENTS APPEARING IN MULTIPLE SEARCHES ===\n');
  const walletQueryCount = new Map<string, number>();
  for (const wallets of queryHits.values()) {
    for (const w of wallets) {
      walletQueryCount.set(w, (walletQueryCount.get(w) ?? 0) + 1);
    }
  }
  const multiHit = [...walletQueryCount.entries()]
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1]);

  for (const [wallet, count] of multiHit.slice(0, 20)) {
    const agent = allAgents.get(wallet)!;
    const offeringList = (agent.jobs ?? []).map(j => j.name).join(', ');
    console.log(`  ${count} queries: ${agent.name}`);
    console.log(`    Offerings: ${offeringList.slice(0, 200)}`);
    console.log(`    ${agent.description?.slice(0, 150)}`);
    console.log();
  }

  // ── Report: Offerings that mention human/review/evaluation ──

  console.log('=== OFFERINGS MENTIONING HUMAN/REVIEW/EVALUATION ===\n');
  for (const desc of offeringDescriptions) {
    const text = `${desc.offering} ${desc.description}`.toLowerCase();
    if (text.includes('human') || text.includes('review') || text.includes('evaluat') || text.includes('quality') || text.includes('fact') || text.includes('trust')) {
      console.log(`  [${desc.agent}] ${desc.offering}`);
      console.log(`    ${desc.description}`);
      console.log();
    }
  }

  // ── Report: Agents with resources ──

  console.log('=== AGENTS WITH RESOURCES ===\n');
  for (const agent of allAgents.values()) {
    if (agent.resources && Array.isArray(agent.resources) && agent.resources.length > 0) {
      console.log(`  ${agent.name}:`);
      for (const r of agent.resources) {
        console.log(`    - ${r.name}: ${r.description?.slice(0, 100)}`);
        console.log(`      URL: ${r.url}`);
      }
      console.log();
    }
  }

  // ── Report: Pricing analysis ──

  console.log('=== PRICING ANALYSIS ===\n');
  const prices: number[] = [];
  for (const agent of allAgents.values()) {
    for (const job of agent.jobs ?? []) {
      if (job.priceV2?.value) {
        // percentage-based — skip for now
      } else if (job.price > 0) {
        prices.push(job.price);
      }
    }
  }
  prices.sort((a, b) => a - b);
  if (prices.length > 0) {
    console.log(`  Fixed-price offerings: ${prices.length}`);
    console.log(`  Min: $${prices[0]}`);
    console.log(`  Max: $${prices[prices.length - 1]}`);
    console.log(`  Median: $${prices[Math.floor(prices.length / 2)]}`);
    console.log(`  Mean: $${(prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(4)}`);
  }

  // ── Report: Butler analysis ──

  console.log('\n=== BUTLER AGENT ANALYSIS ===\n');
  for (const agent of allAgents.values()) {
    if (agent.name.toLowerCase().includes('butler')) {
      console.log(`  ${agent.name} (${agent.walletAddress})`);
      console.log(`  Twitter: @${agent.twitterHandle ?? 'N/A'}`);
      console.log(`  Description: ${agent.description?.slice(0, 300)}`);
      console.log(`  Offerings: ${(agent.jobs ?? []).length}`);
      for (const job of (agent.jobs ?? []).slice(0, 10)) {
        console.log(`    - ${job.name}: ${job.description?.slice(0, 100)}`);
      }
      console.log(`  Resources: ${(agent.resources as unknown[])?.length ?? 0}`);
      console.log(`  Metrics: ${JSON.stringify(agent.metrics ?? {})}`);
      console.log();
    }
  }

  // ── Report: Demand signals (what buyers are likely looking for) ──

  console.log('=== DEMAND KEYWORDS (from offering descriptions) ===\n');
  const keywords = new Map<string, number>();
  const demandTerms = ['verify', 'check', 'review', 'evaluate', 'validate', 'audit', 'assess', 'quality', 'trust', 'legitimacy', 'scam', 'fact', 'human', 'expert', 'judge', 'opinion', 'feedback', 'rate', 'rank', 'compare', 'dispute', 'arbitrat'];

  for (const desc of offeringDescriptions) {
    const text = `${desc.description}`.toLowerCase();
    for (const term of demandTerms) {
      if (text.includes(term)) {
        keywords.set(term, (keywords.get(term) ?? 0) + 1);
      }
    }
  }
  const sortedKeywords = [...keywords.entries()].sort((a, b) => b[1] - a[1]);
  for (const [term, count] of sortedKeywords) {
    console.log(`  ${count}x  "${term}"`);
  }

  console.log('\n=== RESEARCH COMPLETE ===');
}

main().catch(console.error);
