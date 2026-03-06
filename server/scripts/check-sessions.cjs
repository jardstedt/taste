const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'taste.db');
const db = new Database(dbPath);

const since = process.argv[2] || '2026-03-06';
const statusFilter = process.argv[3]; // optional: 'completed', 'cancelled', 'matching'

let query = 'SELECT acp_job_id, offering_type, status, buyer_agent, created_at, cancel_reason FROM sessions WHERE created_at >= ?';
const params = [since];

if (statusFilter) {
  query += ' AND status = ?';
  params.push(statusFilter);
}
query += ' ORDER BY created_at';

const rows = db.prepare(query).all(...params);

// Summary by agent
const byAgent = {};
rows.forEach(s => {
  const agent = s.buyer_agent || 'unknown';
  if (!byAgent[agent]) byAgent[agent] = { total: 0, completed: 0, cancelled: 0, matching: 0, other: 0, offerings: {} };
  byAgent[agent].total++;
  if (s.status === 'completed') byAgent[agent].completed++;
  else if (s.status === 'cancelled') byAgent[agent].cancelled++;
  else if (s.status === 'matching') byAgent[agent].matching++;
  else byAgent[agent].other++;
  const off = s.offering_type || '?';
  byAgent[agent].offerings[off] = (byAgent[agent].offerings[off] || 0) + 1;
});

console.log(`\n=== Sessions since ${since} ${statusFilter ? '(status: ' + statusFilter + ')' : '(all statuses)'} ===\n`);
console.log(`Total: ${rows.length}\n`);

for (const [agent, data] of Object.entries(byAgent)) {
  console.log(`Agent: ${agent}`);
  console.log(`  Total: ${data.total} | Completed: ${data.completed} | Cancelled: ${data.cancelled} | Matching: ${data.matching} | Other: ${data.other}`);
  console.log(`  Offerings: ${JSON.stringify(data.offerings)}`);
  console.log('');
}

console.log('--- All sessions ---\n');
rows.forEach(s => {
  const status = (s.status || '?').padEnd(12);
  const offering = (s.offering_type || '?').padEnd(28);
  const job = String(s.acp_job_id || '-').padEnd(12);
  const agent = (s.buyer_agent || '?').slice(0, 10);
  const reason = s.cancel_reason ? '  reason: ' + s.cancel_reason.slice(0, 60) : '';
  console.log(`[${status}] ${offering} job:${job} agent:${agent}  ${s.created_at}${reason}`);
});

db.close();
