// ──────────────────────────────────────────────────────────────
// RAGNA Server — Entry Point
// SRS §1.1: ragna_core container — Express + Prisma + AI Router
// ──────────────────────────────────────────────────────────────
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { projectRoutes } from './routes/projects.js';
import { generateRoutes } from './routes/generate.js';
import { panelRoutes } from './routes/panels.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = parseInt(process.env.PORT || '4000', 10);

// ── Middleware ────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000' }));
app.use(express.json({ limit: '10mb' }));

// ── SRS §1.2: Serve /uploads directory statically ────────────
// Maps the local volume (./uploads → /app/uploads in Docker)
const uploadsDir = join(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsDir, {
  maxAge: '7d',
  immutable: true,
}));

// ── Health Check ─────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'SYSTEM_ONLINE',
    version: '3.0.0',
    timestamp: new Date().toISOString(),
    infrastructure: 'docker',
  });
});

// ── Routes ───────────────────────────────────────────────────
app.use('/api/projects', projectRoutes);
app.use('/api/generate', generateRoutes);
app.use('/api/panels', panelRoutes);

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
  console.log(`   Uploads served  : ${uploadsDir}\n`);
});

export default app;
