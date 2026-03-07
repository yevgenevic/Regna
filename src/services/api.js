// ──────────────────────────────────────────────────────────────
// Frontend API Service — Talks to RAGNA backend
// ──────────────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

// ── Projects (Archives) ─────────────────────────────────────
export async function fetchProjects({ genre, sort } = {}) {
  const params = new URLSearchParams();
  if (genre) params.set('genre', genre);
  if (sort) params.set('sort', sort);

  const res = await fetch(`${API_BASE}/projects?${params}`);
  if (!res.ok) throw new Error('Failed to fetch projects');
  return res.json();
}

export async function fetchProject(id) {
  const res = await fetch(`${API_BASE}/projects/${id}`);
  if (!res.ok) throw new Error('Project not found');
  return res.json();
}

export async function deleteProject(id) {
  const res = await fetch(`${API_BASE}/projects/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete project');
  return res.json();
}

// ── Generation (SSE Streaming) ──────────────────────────────
export function startGeneration({ prompt, genre, panelCount }, onPanel) {
  return new Promise((resolve, reject) => {
    fetch(`${API_BASE}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, genre, panelCount }),
    })
      .then(async (response) => {
        if (!response.ok) {
          const err = await response.json();
          reject(new Error(err.message || 'Generation failed'));
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event = JSON.parse(line.slice(6));
                if (event.type === 'complete') {
                  resolve(event.projectId);
                } else {
                  onPanel(event);
                }
              } catch { /* skip malformed events */ }
            }
          }
        }
      })
      .catch(reject);
  });
}

// ── Quick Preview (no images) ───────────────────────────────
export async function previewGeneration({ prompt, genre, panelCount }) {
  const res = await fetch(`${API_BASE}/generate/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, genre, panelCount }),
  });
  if (!res.ok) throw new Error('Preview failed');
  return res.json();
}

// ── Export ───────────────────────────────────────────────────
export async function exportProject(projectId) {
  const res = await fetch(`${API_BASE}/panels/${projectId}/export`);
  if (!res.ok) throw new Error('Export failed');

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ragna_export_${projectId}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Health Check ────────────────────────────────────────────
export async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}
