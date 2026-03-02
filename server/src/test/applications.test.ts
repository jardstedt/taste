import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDb } from './helpers.js';
import { getDb, generateId } from '../db/database.js';

describe('expert applications', () => {
  beforeEach(() => {
    setupTestDb();
  });

  it('creates an application', () => {
    const db = getDb();
    const id = generateId();
    db.prepare(`
      INSERT INTO expert_applications (id, name, email, domains, portfolio_url, bio, motivation)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, 'Jane Doe', 'jane@test.com', '["crypto","art"]', 'https://jane.dev', 'Expert in crypto art', 'I love judging things');

    const row = db.prepare('SELECT * FROM expert_applications WHERE id = ?').get(id) as Record<string, unknown>;
    expect(row).toBeTruthy();
    expect(row.name).toBe('Jane Doe');
    expect(row.email).toBe('jane@test.com');
    expect(JSON.parse(row.domains as string)).toEqual(['crypto', 'art']);
    expect(row.status).toBe('pending');
    expect(row.portfolio_url).toBe('https://jane.dev');
  });

  it('defaults to pending status', () => {
    const db = getDb();
    const id = generateId();
    db.prepare(`
      INSERT INTO expert_applications (id, name, email, domains, bio, motivation)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, 'Bob', 'bob@test.com', '["music"]', 'Music producer', 'Interested');

    const row = db.prepare('SELECT status FROM expert_applications WHERE id = ?').get(id) as { status: string };
    expect(row.status).toBe('pending');
  });

  it('allows status update to approved', () => {
    const db = getDb();
    const id = generateId();
    db.prepare(`
      INSERT INTO expert_applications (id, name, email, domains, bio, motivation)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, 'Alice', 'alice@test.com', '["design"]', 'Designer', 'Creative eye');

    db.prepare('UPDATE expert_applications SET status = ? WHERE id = ?').run('approved', id);
    const row = db.prepare('SELECT status FROM expert_applications WHERE id = ?').get(id) as { status: string };
    expect(row.status).toBe('approved');
  });

  it('allows status update to rejected', () => {
    const db = getDb();
    const id = generateId();
    db.prepare(`
      INSERT INTO expert_applications (id, name, email, domains, bio, motivation)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, 'Charlie', 'charlie@test.com', '["general"]', 'Generalist', 'Why not');

    db.prepare('UPDATE expert_applications SET status = ? WHERE id = ?').run('rejected', id);
    const row = db.prepare('SELECT status FROM expert_applications WHERE id = ?').get(id) as { status: string };
    expect(row.status).toBe('rejected');
  });

  it('rejects invalid status values', () => {
    const db = getDb();
    const id = generateId();
    db.prepare(`
      INSERT INTO expert_applications (id, name, email, domains, bio, motivation)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, 'Eve', 'eve@test.com', '["crypto"]', 'Crypto native', 'Moon');

    expect(() => {
      db.prepare('UPDATE expert_applications SET status = ? WHERE id = ?').run('invalid', id);
    }).toThrow();
  });

  it('stores portfolio_url as null when not provided', () => {
    const db = getDb();
    const id = generateId();
    db.prepare(`
      INSERT INTO expert_applications (id, name, email, domains, portfolio_url, bio, motivation)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, 'Frank', 'frank@test.com', '["business"]', null, 'Business analyst', 'Market insight');

    const row = db.prepare('SELECT portfolio_url FROM expert_applications WHERE id = ?').get(id) as { portfolio_url: string | null };
    expect(row.portfolio_url).toBeNull();
  });

  it('lists applications ordered by created_at DESC', () => {
    const db = getDb();
    const id1 = generateId();
    const id2 = generateId();
    db.prepare(`
      INSERT INTO expert_applications (id, name, email, domains, bio, motivation, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-1 hour'))
    `).run(id1, 'First', 'first@test.com', '["crypto"]', 'First', 'First');
    db.prepare(`
      INSERT INTO expert_applications (id, name, email, domains, bio, motivation)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id2, 'Second', 'second@test.com', '["art"]', 'Second', 'Second');

    const rows = db.prepare('SELECT * FROM expert_applications ORDER BY created_at DESC').all() as Array<{ name: string }>;
    expect(rows.length).toBe(2);
    expect(rows[0].name).toBe('Second');
    expect(rows[1].name).toBe('First');
  });
});
