// ──────────────────────────────────────────────────────────────
// RAGNA Server — Entry Point
// SRS §1.1: ragna_core container — Express + Prisma + AI Router
// ──────────────────────────────────────────────────────────────
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { projectRoutes } from './routes/projects.js';
import { generateRoutes } from './routes/generate.js';
import { panelRoutes } from './routes/panels.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = parseInt(process.env.PORT || '4000', 10);
const configuredOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)
  : true;
const uploadsDir = join(__dirname, '../uploads');
const publicDir = join(__dirname, '../public');

// ── Middleware ────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: configuredOrigins }));
app.use(express.json({ limit: '10mb' }));

app.use('/uploads', express.static(uploadsDir, {
  maxAge: '7d',
  immutable: true,
}));

if (existsSync(publicDir)) {
  app.use(express.static(publicDir, {
    index: false,
    maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
  }));
}

// ── Health Check ─────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'SYSTEM_ONLINE',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    infrastructure: process.env.K_SERVICE ? 'cloud-run' : 'docker',
  });
});

// ── Routes ───────────────────────────────────────────────────
app.use('/api/projects', projectRoutes);
app.use('/api/generate', generateRoutes);
app.use('/api/panels', panelRoutes);

if (existsSync(publicDir)) {
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      next();
      return;
    }

    res.sendFile(join(publicDir, 'index.html'));
  });
}

// ── Global Error Handler ─────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[RAGNA_ERROR]', err.message);
  res.status(500).json({ error: 'SYSTEM_FAULT', message: err.message });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n⛩  RAGNA SERVER ONLINE — port ${PORT}`);
  console.log(`   Mode            : ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Text AI Pipeline : ${process.env.TEXT_AI_PROVIDER || 'gemini'}`);
  console.log(`   Image AI Pipeline: ${process.env.IMAGE_AI_PROVIDER || 'comet'}`);
  console.log(`   Uploads served  : ${uploadsDir}`);
  if (existsSync(publicDir)) {
    console.log(`   Static app      : ${publicDir}\n`);
  } else {
    console.log('   Static app      : not bundled\n');
  }
});

export default app;
