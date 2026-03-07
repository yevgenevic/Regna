// ──────────────────────────────────────────────────────────────
// Project Routes — CRUD for manga projects (Archives page)
// ──────────────────────────────────────────────────────────────
import { Router } from 'express';
import { prisma } from '../prisma.js';

export const projectRoutes = Router();

// ── GET /api/projects — List all projects (with filters) ────
projectRoutes.get('/', async (req, res) => {
  try {
    const { userId, genre, sort = 'desc' } = req.query;

    const where: Record<string, unknown> = {};
    if (userId && typeof userId === 'string') where.userId = userId;
    if (genre && typeof genre === 'string') where.genre = genre;

    const projects = await prisma.mangaProject.findMany({
      where,
      orderBy: { createdAt: sort === 'asc' ? 'asc' : 'desc' },
      include: {
        _count: { select: { pages: true } },
      },
    });

    // Add panel count per project
    const enriched = await Promise.all(
      projects.map(async (project: { id: string; [key: string]: unknown }) => {
        const panelCount = await prisma.panel.count({
          where: { page: { projectId: project.id } },
        });
        return { ...project, panelCount };
      }),
    );

    res.json(enriched);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: 'FETCH_FAULT', message });
  }
});

// ── GET /api/projects/:id — Get a single project (full read mode)
projectRoutes.get('/:id', async (req, res) => {
  try {
    const project = await prisma.mangaProject.findUnique({
      where: { id: req.params.id },
      include: {
        pages: {
          orderBy: { pageNumber: 'asc' },
          include: {
            panels: { orderBy: { orderIndex: 'asc' } },
          },
        },
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Project does not exist' });
    }

    res.json(project);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: 'FETCH_FAULT', message });
  }
});

// ── DELETE /api/projects/:id — Delete a project ─────────────
projectRoutes.delete('/:id', async (req, res) => {
  try {
    await prisma.mangaProject.delete({ where: { id: req.params.id } });
    res.json({ status: 'PURGED', id: req.params.id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: 'DELETE_FAULT', message });
  }
});
