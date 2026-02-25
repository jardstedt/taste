import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load env file from project root (parent of server/)
// In production, prefer .env.production; fall back to .env
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '../..');
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env';
dotenv.config({ path: resolve(projectRoot, envFile) });

import express from 'express';
import { createServer } from 'http';
import cookieParser from 'cookie-parser';
import { existsSync, mkdirSync } from 'fs';
import { loadEnv, getEnv } from './config/env.js';
import { initDb, closeDb } from './db/database.js';
import { seedAdminExpert } from './services/experts.js';
import { initAcp, stopAcp } from './services/acp.js';
import { initSocketServer } from './services/socket.js';
import { createHelmet, createCors } from './middleware/security.js';
import { globalLimiter } from './middleware/rateLimit.js';
import { createRequestLogger } from './middleware/logger.js';
import authRoutes from './routes/auth.js';
import apiRoutes from './routes/api.js';
import { initPush } from './services/push.js';
import { getExpertPublic, getAllExpertsPublic, getAllExperts } from './services/experts.js';
import { getAllSessions } from './services/sessions.js';
import { getResourceAvailability } from './services/resource.js';
import { getAttachmentById, readFile, verifySignedUrl, sanitizeFilename } from './services/storage.js';

async function main() {
  // Load and validate environment
  const env = loadEnv();
  const port = parseInt(env.PORT, 10);

  // Initialize database
  initDb();
  console.log('[DB] Initialized');

  // Ensure upload directory exists
  const uploadDir = resolve((env as Record<string, string>).UPLOAD_DIR || './data/uploads');
  if (!existsSync(uploadDir)) {
    mkdirSync(uploadDir, { recursive: true });
    console.log('[Storage] Created upload directory:', uploadDir);
  }

  // Initialize push notifications
  initPush();

  // Seed admin expert
  await seedAdminExpert(env.ADMIN_EMAIL, env.ADMIN_PASSWORD);
  console.log('[DB] Admin expert seeded');

  // Create Express app
  const app = express();

  // Trust proxy chain (Cloudflare → Nginx) so Express sees real client IPs for rate limiting
  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 2);
  }

  // Request logging (before other middleware)
  app.use(createRequestLogger());

  // Security middleware
  app.use(createHelmet());
  app.use(createCors());
  app.use(globalLimiter);

  // Body parsing
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'taste', timestamp: new Date().toISOString() });
  });

  // Public API — no auth required

  // Public stats (cached 60s to avoid repeated heavy queries)
  let statsCache: { data: unknown; expiresAt: number } | null = null;
  app.get('/api/public/stats', (_req, res) => {
    const now = Date.now();
    if (statsCache && now < statsCache.expiresAt) {
      res.json({ success: true, data: statsCache.data });
      return;
    }

    const experts = getAllExperts();
    const activeExperts = experts.filter(e => e.consentToPublicProfile && e.agreementAcceptedAt);
    const sessions = getAllSessions(10000);
    const completedSessions = sessions.filter(s => s.status === 'completed');
    const domains = [...new Set(activeExperts.flatMap(e => e.domains))];

    const data = {
      totalExperts: activeExperts.length,
      totalSessions: completedSessions.length,
      domains,
      avgResponseMins: activeExperts.length > 0
        ? Math.round(activeExperts.reduce((sum, e) => sum + e.avgResponseTimeMins, 0) / activeExperts.length)
        : 0,
    };

    statsCache = { data, expiresAt: now + 60_000 };
    res.json({ success: true, data });
  });

  // ACP Resource endpoint — exposes expert availability for agent discovery
  app.get('/api/public/resource/availability', (_req, res) => {
    res.json(getResourceAvailability());
  });

  // Public signed URL file access (no auth — HMAC-signed)
  app.get('/api/public/files/:attachmentId', (req, res) => {
    const attachmentId = Array.isArray(req.params.attachmentId) ? req.params.attachmentId[0] : req.params.attachmentId ?? '';
    const expires = parseInt(req.query.expires as string, 10);
    const sig = req.query.sig as string;

    if (!attachmentId || !expires || !sig) {
      res.status(400).json({ success: false, error: 'Missing required parameters' });
      return;
    }

    if (!verifySignedUrl(attachmentId, expires, sig)) {
      res.status(403).json({ success: false, error: 'Invalid or expired signature' });
      return;
    }

    const attachment = getAttachmentById(attachmentId);
    if (!attachment) {
      res.status(404).json({ success: false, error: 'Attachment not found' });
      return;
    }

    const buffer = readFile(attachment.sessionId, attachment.storedFilename);
    if (!buffer) {
      res.status(404).json({ success: false, error: 'File not found' });
      return;
    }

    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(sanitizeFilename(attachment.originalFilename))}`);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(buffer);
  });

  // Public expert directory
  app.get('/api/public/experts', (_req, res) => {
    const experts = getAllExpertsPublic().filter(e => e.consentToPublicProfile);
    res.json({ success: true, data: experts });
  });

  // Public expert profile
  app.get('/api/public/experts/:id', (req, res) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id ?? '';
    const expert = getExpertPublic(id);
    if (!expert || !expert.consentToPublicProfile) {
      res.status(404).json({ success: false, error: 'Profile not found' });
      return;
    }
    res.json({ success: true, data: expert });
  });

  // Auth routes
  app.use('/api/auth', authRoutes);

  // Protected API routes
  app.use('/api', apiRoutes);

  // Serve dashboard static files in production
  const dashboardDist = resolve(__dirname, '../../dashboard/dist');
  if (existsSync(dashboardDist)) {
    app.use(express.static(dashboardDist));
    // SPA fallback — serve index.html for all non-API routes
    app.get('*', (_req, res) => {
      res.sendFile(resolve(dashboardDist, 'index.html'));
    });
    console.log('[Server] Serving dashboard from', dashboardDist);
  }

  // Create HTTP server and attach Socket.io
  const httpServer = createServer(app);
  initSocketServer(httpServer);

  // Start server
  httpServer.listen(port, () => {
    console.log(`[Server] Taste running on http://localhost:${port}`);
  });

  // Initialize ACP (non-blocking)
  try {
    await initAcp();
  } catch (err) {
    console.error('[ACP] Failed to initialize:', err);
    console.log('[ACP] Continuing in local-only mode');
  }

  // Graceful shutdown
  const shutdown = () => {
    console.log('\n[Server] Shutting down...');
    stopAcp();
    closeDb();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
