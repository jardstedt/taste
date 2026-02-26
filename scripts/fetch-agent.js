// Fetch full agent details from ACP API
// Usage: node scripts/fetch-agent.js "search query"

const query = process.argv[2] || 'ArAIstotle';
const topK = process.argv[3] || '3';

async function main() {
  const url = `https://acpx.virtuals.io/api/agents/v4/search?search=${encodeURIComponent(query)}&top_k=${topK}&showHiddenOfferings=true`;
  const res = await fetch(url);
  const json = await res.json();
  const data = json.data || [];

  for (const a of data) {
    console.log('========================================');
    console.log('AGENT: ' + a.name + ' (' + a.walletAddress + ')');
    console.log('Twitter: @' + (a.twitterHandle || 'N/A'));
    console.log('Online: ' + (a.metrics?.isOnline || false));
    console.log('Metrics: ' + JSON.stringify(a.metrics || {}, null, 2));
    console.log('Description:\n  ' + (a.description || '').replace(/\n/g, '\n  '));
    console.log('\nResources (' + ((a.resources || []).length) + '):');
    for (const r of (a.resources || [])) {
      console.log('  - ' + r.name + ': ' + (r.description || '').slice(0, 120));
      console.log('    URL: ' + r.url);
    }
    console.log('\nOfferings (' + ((a.jobs || []).length) + '):');
    for (const j of (a.jobs || [])) {
      console.log('\n  --- ' + j.name + ' ---');
      console.log('  Price: $' + j.price + ' | PriceV2: ' + JSON.stringify(j.priceV2 || null) + ' | SLA: ' + j.slaMinutes + 'min');
      console.log('  Desc: ' + (j.description || '').slice(0, 400));
      console.log('  Requirement: ' + JSON.stringify(j.requirement || null, null, 4)?.slice(0, 400));
      console.log('  Deliverable: ' + JSON.stringify(j.deliverable || null, null, 4)?.slice(0, 400));
    }
    console.log('\n');
  }
}

main().catch(console.error);
