import { resetEnv, loadEnv } from '../config/env.js';
import { initDb, closeDb } from '../db/database.js';

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
