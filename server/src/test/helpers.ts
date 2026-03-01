import { resetEnv, loadEnv } from '../config/env.js';
import { initDb, closeDb, getDb } from '../db/database.js';
import { createExpert, updateExpert, setExpertPassword, acceptAgreement } from '../services/experts.js';
import { createSession, getSessionById, matchSession, acceptSession } from '../services/sessions.js';
import type { Domain } from '../types/index.js';

/**
 * Initialize a fresh test environment (env + database).
 * Call this at the start of each test that needs the DB.
 */
export function setupTestDb(): ReturnType<typeof initDb> {
  resetEnv();
  closeDb();
  loadEnv();
  return initDb();
}

/** Create an expert with password, agreement accepted, and online availability */
export async function createOnlineExpert(name: string, email: string, domains: string[]) {
  const expert = createExpert(name, email, domains as Domain[]);
  await setExpertPassword(expert.id, 'password123');
  acceptAgreement(expert.id);
  updateExpert(expert.id, { availability: 'online', consentToPublicProfile: true });
  return expert;
}

/** Create a test session with sensible defaults */
export function testSession(offeringType = 'trust_evaluation', priceUsdc = 0.01) {
  return createSession({
    offeringType,
    tierId: 'quick',
    description: 'Test request',
    buyerAgent: 'agent-1',
    buyerAgentDisplay: 'TestAgent',
    priceUsdc,
  });
}

/** Create session, match, accept, then force to active status */
export async function createActiveSession(offeringType = 'trust_evaluation') {
  const expert = await createOnlineExpert('Alice', 'alice@test.com', ['crypto']);
  const session = testSession(offeringType);
  matchSession(session.id);
  acceptSession(session.id, expert.id);
  getDb().prepare("UPDATE sessions SET status = 'active' WHERE id = ?").run(session.id);
  return getSessionById(session.id)!;
}
