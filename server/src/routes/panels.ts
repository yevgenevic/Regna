// ──────────────────────────────────────────────────────────────
// Panel Routes — Direct panel access & export
// ──────────────────────────────────────────────────────────────
import { Router } from 'express';
import { prisma } from '../prisma.js';

export const panelRoutes = Router();

// ── GET /api/panels/:projectId — All panels for a project ───
panelRoutes.get('/:projectId', async (req, res) => {
  try {
    const panels = await prisma.panel.findMany({
      where: { page: { projectId: req.params.projectId } },
      orderBy: [
        { page: { pageNumber: 'asc' } },
        { orderIndex: 'asc' },
      ],
    });
    res.json(panels);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: 'PANEL_FETCH_FAULT', message });
  }
});

// ── GET /api/panels/:projectId/export — Export raw data ─────
panelRoutes.get('/:projectId/export', async (req, res) => {
  try {
    const project = await prisma.mangaProject.findUnique({
      where: { id: req.params.projectId },
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
      return res.status(404).json({ error: 'NOT_FOUND' });
    }

    // Build export payload
    const exportData = {
      title: project.title,
      genre: project.genre,
      originalPrompt: project.originalPrompt,
      aiModel: project.aiModelUsed,
      createdAt: project.createdAt,
      pages: project.pages.map((page: { pageNumber: number; panels: Array<{ orderIndex: number; type: string; content: string; metadata: unknown }> }) => ({
        pageNumber: page.pageNumber,
        panels: page.panels.map((panel: { orderIndex: number; type: string; content: string; metadata: unknown }) => ({
          order: panel.orderIndex,
          type: panel.type,
          content: panel.content,
          metadata: panel.metadata,
        })),
      })),
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="ragna_${project.title.replace(/\s+/g, '_')}.json"`);
    res.json(exportData);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: 'EXPORT_FAULT', message });
  }
});
