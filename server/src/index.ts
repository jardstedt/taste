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
import { existsSync, mkdirSync, readFileSync } from 'fs';
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
import { getResourceAvailability, getOfferingCatalog, getSampleDeliverables } from './services/resource.js';
import { getAttachmentById, readFile, readAvatar, verifySignedUrl, sanitizeFilename } from './services/storage.js';

async function main() {
  // Load and validate environment
  const env = loadEnv();
  const port = parseInt(env.PORT, 10);

  // Initialize database
  initDb();
  console.log('[DB] Initialized');

  // Ensure upload directory exists
  const uploadDir = resolve(env.UPLOAD_DIR || './data/uploads');
  if (!existsSync(uploadDir)) {
    mkdirSync(uploadDir, { recursive: true });
    console.log('[Storage] Created upload directory:', uploadDir);
  }

  // Initialize push notifications
  initPush();

  // Seed admin expert (only if both email and password are configured)
  if (env.ADMIN_EMAIL && env.ADMIN_PASSWORD) {
    await seedAdminExpert(env.ADMIN_EMAIL, env.ADMIN_PASSWORD);
    console.log('[DB] Admin expert seeded');
  }

  // Create Express app
  const app = express();

  // Trust proxy chain (Cloudflare → Nginx) so Express sees real client IPs for rate limiting
  const trustProxy = env.TRUST_PROXY;
  if (trustProxy > 0) {
    app.set('trust proxy', trustProxy);
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

  // ACP Resource endpoints — exposes data for agent discovery
  app.get('/api/public/resource/availability', (_req, res) => {
    res.json(getResourceAvailability());
  });
  app.get('/api/public/resource/offerings', (_req, res) => {
    res.json(getOfferingCatalog());
  });
  app.get('/api/public/resource/samples', (_req, res) => {
    res.json(getSampleDeliverables());
  });

  // Public avatar serving (no auth — profile pictures are public)
  app.get('/api/public/avatars/:expertId', (req, res) => {
    const expertId = Array.isArray(req.params.expertId) ? req.params.expertId[0] : req.params.expertId ?? '';
    const avatar = readAvatar(expertId);
    if (!avatar) {
      res.status(404).json({ success: false, error: 'Avatar not found' });
      return;
    }

    res.setHeader('Content-Type', avatar.mimeType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Content-Length', avatar.buffer.length);
    res.send(avatar.buffer);
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

  // Global error handler — prevents stack traces and internal details from leaking to clients
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[Server] Unhandled error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  });

  // Serve whitepaper as rendered HTML
  const whitepaperPath = resolve(__dirname, '../../WHITEPAPER_v3_0_VIRTUALS.md');
  app.get('/whitepaper', (_req, res) => {
    if (!existsSync(whitepaperPath)) {
      res.status(404).send('Whitepaper not found');
      return;
    }
    const md = readFileSync(whitepaperPath, 'utf-8');
    const html = renderWhitepaperHtml(md);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  });

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

// ── Whitepaper Renderer ──

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderWhitepaperHtml(md: string): string {
  let html = '';
  const lines = md.split('\n');
  let inCodeBlock = false;
  let inTable = false;
  let tableRows: string[] = [];

  function flushTable() {
    if (!inTable) return;
    inTable = false;
    const rows = tableRows.filter(r => !/^\|[\s-:|]+\|$/.test(r)); // skip separator rows
    if (rows.length === 0) { tableRows = []; return; }
    let t = '<table>';
    rows.forEach((row, i) => {
      const cells = row.split('|').slice(1, -1).map(c => c.trim());
      const tag = i === 0 ? 'th' : 'td';
      t += '<tr>' + cells.map(c => `<${tag}>${inlineMarkdown(c)}</${tag}>`).join('') + '</tr>';
    });
    t += '</table>';
    html += t;
    tableRows = [];
  }

  function inlineMarkdown(text: string): string {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code blocks
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        html += '</code></pre>';
        inCodeBlock = false;
      } else {
        flushTable();
        inCodeBlock = true;
        html += '<pre><code>';
      }
      continue;
    }
    if (inCodeBlock) {
      html += escapeHtml(line) + '\n';
      continue;
    }

    // Table rows
    if (line.startsWith('|')) {
      if (!inTable) inTable = true;
      tableRows.push(line);
      continue;
    } else {
      flushTable();
    }

    // Blank lines
    if (line.trim() === '') continue;

    // Horizontal rules
    if (/^---+$/.test(line.trim())) {
      html += '<hr>';
      continue;
    }

    // Headers
    const hMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (hMatch) {
      const level = hMatch[1].length;
      html += `<h${level}>${inlineMarkdown(hMatch[2])}</h${level}>`;
      continue;
    }

    // List items
    if (/^[-*]\s/.test(line.trim())) {
      html += `<li>${inlineMarkdown(line.trim().slice(2))}</li>`;
      continue;
    }

    // Paragraph
    html += `<p>${inlineMarkdown(line)}</p>`;
  }
  flushTable();

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Taste — Human Judgment for the AI Economy</title>
<meta name="description" content="Whitepaper for Taste, the human judgment oracle for AI agents.">
<style>
  :root { --bg: #0a0a0a; --fg: #e0e0e0; --muted: #888; --accent: #c0a0ff; --border: #2a2a2a; --code-bg: #151515; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: var(--fg); line-height: 1.7; max-width: 720px; margin: 0 auto; padding: 3rem 1.5rem 6rem; }
  h1 { font-size: 2rem; margin: 2rem 0 0.5rem; color: #fff; }
  h2 { font-size: 1.5rem; margin: 2.5rem 0 0.75rem; color: #fff; border-bottom: 1px solid var(--border); padding-bottom: 0.4rem; }
  h3 { font-size: 1.15rem; margin: 1.8rem 0 0.5rem; color: var(--accent); }
  p { margin: 0.75rem 0; }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  strong { color: #fff; }
  hr { border: none; border-top: 1px solid var(--border); margin: 2.5rem 0; }
  li { margin: 0.3rem 0 0.3rem 1.5rem; }
  code { font-family: 'JetBrains Mono', 'Fira Code', monospace; background: var(--code-bg); padding: 0.15em 0.4em; border-radius: 3px; font-size: 0.9em; }
  pre { background: var(--code-bg); border: 1px solid var(--border); border-radius: 6px; padding: 1rem; overflow-x: auto; margin: 1rem 0; }
  pre code { background: none; padding: 0; font-size: 0.85em; }
  table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 0.9rem; }
  th, td { border: 1px solid var(--border); padding: 0.5rem 0.75rem; text-align: left; }
  th { background: var(--code-bg); color: #fff; font-weight: 600; }
  @media (max-width: 600px) { body { padding: 1.5rem 1rem 4rem; } h1 { font-size: 1.5rem; } h2 { font-size: 1.25rem; } }
</style>
</head>
<body>
${html}
</body>
</html>`;
}
