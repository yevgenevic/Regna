// ──────────────────────────────────────────────────────────────
// Vertex AI Image Provider (Google Cloud — Imagen 3)
// ──────────────────────────────────────────────────────────────
import { GoogleAuth } from 'google-auth-library';
import type { ImageAIProvider } from './types.js';

export class VertexImageProvider implements ImageAIProvider {
  readonly name = 'vertex';
  private projectId: string;
  private auth: GoogleAuth;

  constructor() {
    this.projectId = process.env.GCS_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || '';
    this.auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    if (!this.projectId) console.warn('[VERTEX] No project ID configured — provider disabled');
  }

  private async getAccessToken(): Promise<string> {
    const client = await this.auth.getClient();
    const accessToken = await client.getAccessToken();
    const token = typeof accessToken === 'string' ? accessToken : accessToken?.token;

    if (!token) {
      throw new Error('Unable to acquire Google Cloud access token for Vertex AI');
    }

    return token;
  }

  async generateImage(prompt: string, style = 'manga'): Promise<Buffer> {
    const mangaPrompt = `${prompt}, manga style, traditional Japanese ink, black and white, screentone, high contrast, ${style}`;
    const accessToken = await this.getAccessToken();

    // Vertex AI REST endpoint for Imagen
    const endpoint = `https://us-central1-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/us-central1/publishers/google/models/imagen-3.0-generate-001:predict`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
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
    return !!this.projectId;
  }
}
