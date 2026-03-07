// ──────────────────────────────────────────────────────────────
// Generation Routes — SSE streaming for real-time panel delivery
// POST /api/generate — Starts the full AI pipeline with SSE
// ──────────────────────────────────────────────────────────────
import { Router } from 'express';
import { z } from 'zod';
import { aiRouter } from '../services/aiRouter.js';

export const generateRoutes = Router();

const GenerateSchema = z.object({
  prompt: z.string().min(3).max(2000),
  genre: z.enum(['SHONEN', 'SEINEN', 'MECHA', 'SHOJO']),
  userId: z.string().uuid().optional(),
  panelCount: z.number().int().min(4).max(24).optional(),
});

// ── POST /api/generate — SSE stream of panels ───────────────
generateRoutes.post('/', async (req, res) => {
  try {
    const body = GenerateSchema.parse(req.body);

    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // Temporary user ID if not authenticated
    const userId = body.userId || '00000000-0000-0000-0000-000000000000';

    // Ensure temp user exists (create if not)
    const { prisma } = await import('../prisma.js');
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        username: 'anonymous',
        email: 'anon@ragna.dev',
      },
    });

    // Execute the full pipeline with SSE callback
    const projectId = await aiRouter.executeFullPipeline(
      body.prompt,
      body.genre,
      userId,
      (panelEvent) => {
        res.write(`data: ${JSON.stringify(panelEvent)}\n\n`);
      },
    );

    // Final event
    res.write(`data: ${JSON.stringify({ type: 'complete', projectId })}\n\n`);
    res.end();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[GENERATE]', message);

    // If headers not sent yet, send error response
    if (!res.headersSent) {
      res.status(400).json({ error: 'GENERATION_FAULT', message });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', content: message })}\n\n`);
      res.end();
    }
  }
});

// ── POST /api/generate/preview — Quick text-only preview ────
generateRoutes.post('/preview', async (req, res) => {
  try {
    const body = GenerateSchema.parse(req.body);
    const { beats, providerUsed } = await aiRouter.generateStoryBeats(
      body.prompt,
      body.genre,
      body.panelCount,
    );
    res.json({ beats, providerUsed });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: 'PREVIEW_FAULT', message });
  }
});
