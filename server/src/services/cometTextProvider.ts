// ──────────────────────────────────────────────────────────────
// Comet Text AI Provider — Uses Comet's /chat/completions endpoint
// Comet proxies multiple strong models (GPT-4o, Gemini, etc.)
// This gives us a third text pipeline that's separate from
// OpenRouter and Google AI Studio.
// ──────────────────────────────────────────────────────────────
import type { TextAIProvider, StoryBeat } from './types.js';
import { robustJsonParse } from './jsonRepair.js';

const MANGA_SYSTEM_PROMPT = `You are RAGNA, an expert manga storyboard AI.
You generate structured story beats for manga panels in strict JSON format.
Every response MUST be a valid JSON array of beat objects.

Each beat object has:
- "type": one of "narration", "dialogue", "image_prompt", "sfx"
- "text": the text content (for narration, dialogue, sfx)
- "description": detailed visual description (ONLY for image_prompt type)
- "metadata": optional object with keys like "character_focus", "camera_angle", "mood"

For image_prompt descriptions, always include:
- Black and white manga aesthetic, screentone/halftone shading
- Dynamic composition and camera angles
- High contrast visual language

Interleave text and image beats naturally. Return ONLY the JSON array, no markdown.`;

// ── Text Model Pool (Comet-hosted) ───────────────────────────
// These models are accessed via Comet's OpenAI-compatible /chat/completions
const TEXT_MODEL_POOL: string[] = [
  'gpt-4o',
  'gpt-4o-mini',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'claude-sonnet-4-20250514',
  'qwen3-coder',
];

function pickRandomModel(): string {
  return TEXT_MODEL_POOL[Math.floor(Math.random() * TEXT_MODEL_POOL.length)];
}

export class CometTextProvider implements TextAIProvider {
  readonly name = 'comet-text';
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.COMET_API_KEY || '';
    this.baseUrl = process.env.COMET_API_BASE_URL || 'https://api.cometapi.com/v1';
    if (!this.apiKey) console.warn('[COMET_TEXT] No API key configured — provider disabled');
  }

  async generateStoryBeats(prompt: string, genre: string, panelCount = 12): Promise<StoryBeat[]> {
    // Try up to 3 different models
    const errors: string[] = [];

    for (let attempt = 0; attempt < 3; attempt++) {
      const selectedModel = pickRandomModel();
      console.log(`[COMET_TEXT] Attempt ${attempt + 1}/3 — model: ${selectedModel}`);

      try {
        const beats = await this._callModel(selectedModel, prompt, genre, panelCount);
        if (beats.length > 0) return beats;
        errors.push(`${selectedModel}: returned empty array`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${selectedModel}: ${msg}`);
        console.warn(`[COMET_TEXT] ${selectedModel} failed: ${msg}`);
      }
    }

    throw new Error(`Comet text failed after 3 attempts: ${errors.join(' | ')}`);
  }

  private async _callModel(model: string, prompt: string, genre: string, panelCount: number): Promise<StoryBeat[]> {
    const userPrompt = `Genre: ${genre}\nPanel count target: ${panelCount}\nUser prompt: "${prompt}"\n\nGenerate a manga storyboard as a JSON array of story beats. Return ONLY the JSON array, no markdown fences, no explanation.`;

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: MANGA_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.8,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Comet API error ${response.status}: ${err.substring(0, 200)}`);
    }

    const data = await response.json() as { choices: Array<{ message: { content: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty response from Comet');

    const parsed = robustJsonParse<StoryBeat[]>(content);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('Parsed result is not a valid beats array');
    }

    // Validate beat structure
    return parsed.filter(beat =>
      beat && typeof beat === 'object' &&
      ['narration', 'dialogue', 'image_prompt', 'sfx'].includes(beat.type)
    );
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }
}
