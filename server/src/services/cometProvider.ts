// ──────────────────────────────────────────────────────────────
// Comet API Image Provider — Dynamic Model Pool
// Randomly selects from image generation models per request.
// Downloads temporary URL results into local buffer for storage.
// ──────────────────────────────────────────────────────────────
import type { ImageAIProvider } from './types.js';

// ── Image Model Pool ─────────────────────────────────────────
const IMAGE_MODEL_POOL: string[] = [
  'gemini-3.1-flash-image-preview',
  'doubao-seedream-5-0-260128',
  'doubao-seedream-4-5-251128',
  'qwen-image',
  'runwayml_text_to_image',
  'kling_image',
  'gemini-2.5-flash-image',
  'gpt-4o-image',
];

function pickRandomModel(): string {
  return IMAGE_MODEL_POOL[Math.floor(Math.random() * IMAGE_MODEL_POOL.length)];
}

export class CometImageProvider implements ImageAIProvider {
  readonly name = 'comet';
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.COMET_API_KEY || '';
    this.baseUrl = process.env.COMET_API_BASE_URL || 'https://api.cometapi.com/v1';
    if (!this.apiKey) console.warn('[COMET] No API key configured — provider disabled');
  }

  async generateImage(prompt: string, style = 'manga'): Promise<Buffer> {
    const selectedModel = pickRandomModel();
    console.log(`[COMET] Selected model: ${selectedModel}`);

    // ── SRS §2.3: Rigid style modifier injection ─────────
    const mangaPrompt = `${prompt}, strictly black and white manga style, high contrast ink, screentone shading, no colors`;

    const response = await fetch(`${this.baseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: selectedModel,
        prompt: mangaPrompt,
        n: 1,
        size: '1024x1024',
        response_format: 'url',
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Comet API error ${response.status}: ${err}`);
    }

    const data = await response.json() as {
      data: Array<{ url?: string; b64_json?: string }>;
    };

    const item = data.data[0];
    if (!item) throw new Error('No image data received from Comet');

    // ── SRS §2.3 Asset Ingestion ─────────────────────────
    // If the API returns a temporary URL, download into buffer
    if (item.url) {
      console.log(`[COMET] Downloading image from temporary URL...`);
      const imgResponse = await fetch(item.url);
      if (!imgResponse.ok) {
        throw new Error(`Failed to download image from Comet URL: ${imgResponse.status}`);
      }
      const arrayBuffer = await imgResponse.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }

    // Fallback: if API returns base64 directly
    if (item.b64_json) {
      return Buffer.from(item.b64_json, 'base64');
    }

    throw new Error('Comet returned neither URL nor base64 image data');
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }
}
