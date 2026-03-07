// ──────────────────────────────────────────────────────────────
// Vertex AI Image Provider (Google Cloud — Imagen 3)
// ──────────────────────────────────────────────────────────────
import type { ImageAIProvider } from './types.js';

export class VertexImageProvider implements ImageAIProvider {
  readonly name = 'vertex';
  private projectId: string;

  constructor() {
    this.projectId = process.env.GCS_PROJECT_ID || '';
    if (!this.projectId) console.warn('[VERTEX] No project ID configured — provider disabled');
  }

  async generateImage(prompt: string, style = 'manga'): Promise<Buffer> {
    const mangaPrompt = `${prompt}, manga style, traditional Japanese ink, black and white, screentone, high contrast, ${style}`;

    // Vertex AI REST endpoint for Imagen
    const endpoint = `https://us-central1-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/us-central1/publishers/google/models/imagen-3.0-generate-001:predict`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // In production, use Google Cloud ADC or service account token
        'Authorization': `Bearer ${process.env.GOOGLE_ACCESS_TOKEN || ''}`,
      },
      body: JSON.stringify({
        instances: [{ prompt: mangaPrompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: '1:1',
          safetyFilterLevel: 'block_few',
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Vertex AI error ${response.status}: ${err}`);
    }

    const data = await response.json() as { predictions: Array<{ bytesBase64Encoded: string }> };
    const base64 = data.predictions?.[0]?.bytesBase64Encoded;
    if (!base64) throw new Error('No image from Vertex AI');

    return Buffer.from(base64, 'base64');
  }

  async isAvailable(): Promise<boolean> {
    return !!this.projectId && !!process.env.GOOGLE_ACCESS_TOKEN;
  }
}
