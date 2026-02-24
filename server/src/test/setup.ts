import { beforeEach, afterEach } from 'vitest';
import { closeDb } from '../db/database.js';
import { randomBytes } from 'crypto';
import { mkdirSync, rmSync } from 'fs';
import { resolve } from 'path';

// Set required env vars before anything else imports them
const testDbDir = resolve(import.meta.dirname ?? '.', '../../.test-data');

beforeEach(() => {
  // Fresh DB for each test
  const dbFile = `test-${randomBytes(4).toString('hex')}.db`;
  process.env.DB_PATH = resolve(testDbDir, dbFile);
  process.env.JWT_SECRET = 'test-secret-at-least-16-chars!!';
  process.env.ADMIN_EMAIL = 'admin@test.local';
  process.env.ADMIN_PASSWORD = 'testpassword123';
  process.env.NODE_ENV = 'test';
  process.env.CORS_ORIGIN = 'http://localhost:5173';

  mkdirSync(testDbDir, { recursive: true });
});

afterEach(() => {
  closeDb();

  // Reset env module cache so next test gets fresh loadEnv
  // We do this by clearing the cached env singleton
  try {
    // Remove test DB files
    rmSync(testDbDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
});
