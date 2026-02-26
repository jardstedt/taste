import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDb, createOnlineExpert, testSession, createActiveSession } from './helpers.js';
import { getDb } from '../db/database.js';
import {
  completeSession,
  addMessage,
  saveDeliverable,
  getDeliverable,
  formatSessionDeliverable,
} from '../services/sessions.js';
import { buildZodSchema, getDeliverableFields } from '../config/deliverable-schemas.js';
import { saveFile, saveAttachmentRecord } from '../services/storage.js';

describe('deliverables', () => {
  beforeEach(() => {
    setupTestDb();
  });

  describe('saveDeliverable / getDeliverable', () => {
    it('saves and retrieves a structured deliverable', async () => {
      const session = testSession();
      const data = { verdict: 'legitimate', confidenceScore: 8, summary: 'Looks good' };

      const saved = saveDeliverable(session.id, 'trust_evaluation', data, 'Expert summary');

      expect(saved.sessionId).toBe(session.id);
      expect(saved.structuredData).toEqual(data);
      expect(saved.summary).toBe('Expert summary');

      const fetched = getDeliverable(session.id);
      expect(fetched).not.toBeNull();
      expect(fetched!.structuredData.verdict).toBe('legitimate');
    });

    it('upserts on duplicate session_id', async () => {
      const session = testSession();

      saveDeliverable(session.id, 'trust_evaluation', { verdict: 'suspicious' });
      saveDeliverable(session.id, 'trust_evaluation', { verdict: 'legitimate' }, 'Updated');

      const fetched = getDeliverable(session.id);
      expect(fetched!.structuredData.verdict).toBe('legitimate');
      expect(fetched!.summary).toBe('Updated');
    });
  });

  describe('formatSessionDeliverable', () => {
    it('includes structured assessment when present', async () => {
      const session = await createActiveSession();
      addMessage(session.id, 'expert', session.expertId, 'This project looks legitimate.');

      saveDeliverable(session.id, 'trust_evaluation', {
        verdict: 'legitimate',
        confidenceScore: 9,
        summary: 'Strong fundamentals',
      }, 'Detailed analysis complete');

      const deliverable = formatSessionDeliverable(session.id);

      expect(deliverable.structuredAssessment).not.toBeNull();
      expect((deliverable.structuredAssessment as Record<string, unknown>).verdict).toBe('legitimate');
      expect(deliverable.summary).toBe('Detailed analysis complete');
      expect((deliverable.evaluationCriteria as string)).toContain('structured assessment');
    });

    it('falls back to transcript-based summary without structured data', async () => {
      const session = await createActiveSession();
      addMessage(session.id, 'expert', session.expertId, 'My final assessment is that this is fine.');

      const deliverable = formatSessionDeliverable(session.id);

      expect(deliverable.structuredAssessment).toBeNull();
      expect(deliverable.summary).toContain('My final assessment');
      expect((deliverable.evaluationCriteria as string)).toContain('Verify the expert addressed');
    });

    it('includes signed attachment URLs when files are uploaded', async () => {
      const session = await createActiveSession();
      addMessage(session.id, 'expert', session.expertId, 'See attached evidence.');

      // Upload a file and create attachment record
      const VALID_PNG = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
        0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
        0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
        0x00, 0x00, 0x02, 0x00, 0x01, 0xE2, 0x21, 0xBC,
        0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,
        0x44, 0xAE, 0x42, 0x60, 0x82,
      ]);

      const fileResult = saveFile(session.id, VALID_PNG, 'evidence.png', 'image/png');
      saveAttachmentRecord(
        fileResult.id, session.id, 'evidence.png', fileResult.storedFilename,
        'image/png', fileResult.fileSizeBytes, 'chat', session.expertId!,
      );

      const deliverable = formatSessionDeliverable(session.id);

      expect(deliverable.attachments).not.toBeNull();
      const attachments = deliverable.attachments as Array<{ filename: string; mimeType: string; url: string; context: string }>;
      expect(attachments).toHaveLength(1);
      expect(attachments[0].filename).toBe('evidence.png');
      expect(attachments[0].mimeType).toBe('image/png');
      expect(attachments[0].url).toContain('/api/public/files/');
      expect(attachments[0].url).toContain('sig=');
      expect(attachments[0].context).toBe('chat');
    });

    it('returns null attachments when no files uploaded', async () => {
      const session = await createActiveSession();
      addMessage(session.id, 'expert', session.expertId, 'No files here.');

      const deliverable = formatSessionDeliverable(session.id);
      expect(deliverable.attachments).toBeNull();
    });

    it('parses JSON description into structured object', async () => {
      const session = await createActiveSession();
      // Simulate ACP-style JSON description
      getDb().prepare('UPDATE sessions SET description = ? WHERE id = ?').run(
        JSON.stringify({ aiOutput: 'Some text', outputType: 'analysis' }),
        session.id,
      );
      addMessage(session.id, 'expert', session.expertId, 'Reviewed.');

      const deliverable = formatSessionDeliverable(session.id);
      const request = deliverable.request as { description: unknown };
      expect(typeof request.description).toBe('object');
      expect((request.description as Record<string, unknown>).aiOutput).toBe('Some text');
      expect((request.description as Record<string, unknown>).outputType).toBe('analysis');
    });

    it('keeps plain string description as-is', async () => {
      const session = await createActiveSession();
      getDb().prepare('UPDATE sessions SET description = ? WHERE id = ?').run(
        'Just a plain text request',
        session.id,
      );
      addMessage(session.id, 'expert', session.expertId, 'Done.');

      const deliverable = formatSessionDeliverable(session.id);
      const request = deliverable.request as { description: unknown };
      expect(request.description).toBe('Just a plain text request');
    });

    it('falls back to structuredData.summary when no form summary and no expert messages', async () => {
      const session = await createActiveSession();
      // Save deliverable with no separate summary (only structuredData has one)
      saveDeliverable(session.id, 'output_quality_gate', {
        qualityVerdict: 'needs_revision',
        qualityScore: 3,
        summary: 'It is a bad analysis',
      });

      const deliverable = formatSessionDeliverable(session.id);
      expect(deliverable.summary).toBe('It is a bad analysis');
    });

    it('omits transcript when no expert messages', async () => {
      const session = await createActiveSession();
      // Only agent message, no expert messages
      addMessage(session.id, 'agent', null, 'Hello expert');

      const deliverable = formatSessionDeliverable(session.id);
      expect(deliverable.transcript).toBeUndefined();
    });

    it('includes transcript when expert messages exist', async () => {
      const session = await createActiveSession();
      addMessage(session.id, 'agent', null, 'Hello expert');
      addMessage(session.id, 'expert', session.expertId, 'Here is my analysis.');

      const deliverable = formatSessionDeliverable(session.id);
      expect(deliverable.transcript).toBeDefined();
      const transcript = deliverable.transcript as Array<{ role: string; content: string }>;
      expect(transcript.length).toBeGreaterThan(0);
    });

    it('does not include removed noise fields', async () => {
      const session = await createActiveSession();
      addMessage(session.id, 'expert', session.expertId, 'Done.');

      const deliverable = formatSessionDeliverable(session.id);

      // These fields were removed in the slim deliverable (see docs/design-decisions.md)
      expect(deliverable.sessionId).toBeUndefined();
      expect(deliverable.tier).toBeUndefined();
      expect(deliverable.status).toBeUndefined();
      expect(deliverable.turnCount).toBeUndefined();
      expect(deliverable.maxTurns).toBeUndefined();
      expect(deliverable.addons).toBeUndefined();
      expect(deliverable.expert).toBeUndefined();
      expect(deliverable.totalPrice).toBeUndefined();
      expect(deliverable.duration).toBeUndefined();
      expect(deliverable.result).toBeUndefined();

      // These fields should still be present
      expect(deliverable.offeringType).toBeDefined();
      expect(deliverable.offeringName).toBeDefined();
      expect(deliverable.request).toBeDefined();
      expect(deliverable.summary).toBeDefined();
      expect(deliverable.disclaimer).toBeDefined();
      expect(deliverable.evaluationCriteria).toBeDefined();
    });
  });

  describe('deliverable on completed sessions', () => {
    it('saveDeliverable upserts even on completed session (service layer)', async () => {
      // Note: the route handler guards against this, but the service layer allows upsert
      // This test documents that the route-level check is essential
      const session = await createActiveSession();
      saveDeliverable(session.id, 'trust_evaluation', { verdict: 'legitimate' }, 'First');
      completeSession(session.id);

      // Service layer still allows the upsert
      const updated = saveDeliverable(session.id, 'trust_evaluation', { verdict: 'suspicious' }, 'After completion');
      expect(updated.structuredData.verdict).toBe('suspicious');
    });
  });

  describe('Zod validation (buildZodSchema)', () => {
    it('validates trust_evaluation schema', async () => {
      const schema = buildZodSchema('trust_evaluation');
      const result = schema.safeParse({
        verdict: 'legitimate',
        confidenceScore: 8,
        summary: 'Looks good',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid verdict for trust_evaluation', async () => {
      const schema = buildZodSchema('trust_evaluation');
      const result = schema.safeParse({
        verdict: 'definitely_a_scam', // not in options
        confidenceScore: 8,
        summary: 'Looks bad',
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing required field', async () => {
      const schema = buildZodSchema('trust_evaluation');
      const result = schema.safeParse({
        verdict: 'legitimate',
        // missing confidenceScore and summary
      });
      expect(result.success).toBe(false);
    });

    it('validates output_quality_gate schema', async () => {
      const schema = buildZodSchema('output_quality_gate');
      const result = schema.safeParse({
        qualityVerdict: 'approved',
        qualityScore: 9,
        summary: 'Great output',
      });
      expect(result.success).toBe(true);
    });

    it('validates option_ranking schema', async () => {
      const schema = buildZodSchema('option_ranking');
      const result = schema.safeParse({
        topPick: 'Option A',
        summary: 'Best choice',
        rankings: '1. Option A\n2. Option B',
      });
      expect(result.success).toBe(true);
    });

    it('validates fallback schema for unknown offering', async () => {
      const schema = buildZodSchema('some_unknown_offering');
      const result = schema.safeParse({
        summary: 'This is my assessment',
      });
      expect(result.success).toBe(true);
    });

    it('strips unknown extra keys silently', async () => {
      const schema = buildZodSchema('trust_evaluation');
      const result = schema.safeParse({
        verdict: 'legitimate',
        confidenceScore: 8,
        summary: 'Good',
        extraField: 'hello',
      });
      expect(result.success).toBe(true);
      expect((result as { data: Record<string, unknown> }).data).not.toHaveProperty('extraField');
    });

    it('enforces rating range', async () => {
      const schema = buildZodSchema('trust_evaluation');
      const result = schema.safeParse({
        verdict: 'legitimate',
        confidenceScore: 15, // max is 10
        summary: 'Good',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('getDeliverableFields', () => {
    it('returns trust_evaluation fields', async () => {
      const fields = getDeliverableFields('trust_evaluation');
      expect(fields.length).toBeGreaterThan(0);
      expect(fields.find(f => f.key === 'verdict')).toBeTruthy();
    });

    it('returns fallback fields for unknown offering', async () => {
      const fields = getDeliverableFields('unknown_offering');
      expect(fields.find(f => f.key === 'summary')).toBeTruthy();
    });
  });
});
