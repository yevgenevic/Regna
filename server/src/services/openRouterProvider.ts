// ──────────────────────────────────────────────────────────────
// OpenRouter Text AI Provider — Resilient Model Rotation
// Tries multiple models per request. If one returns broken JSON,
// rotates to the next. Only gives up after exhausting the tier.
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

// ── Tiered Model Pool ────────────────────────────────────────
// Tier 1: Large capable models (best JSON compliance)
// Tier 2: Medium models (decent JSON)
// Tier 3: Small models (fallback, may need repair)
const MODEL_TIERS: string[][] = [
  // Tier 1 — Most reliable for structured JSON
  [
    'meta-llama/llama-3.3-70b-instruct:free',
    'openai/gpt-oss-120b:free',
    'google/gemma-3-27b-it:free',
    'qwen/qwen3-coder:free',
    'mistralai/mistral-small-3.1-24b-instruct:free',
  ],
  // Tier 2 — Medium capability
  [
    'openai/gpt-oss-20b:free',
    'nvidia/nemotron-nano-9b-v2:free',
    'nvidia/nemotron-3-nano-30b-a3b:free',
    'arcee-ai/trinity-large-preview:free',
    'stepfun/step-3.5-flash:free',
    'z-ai/glm-4.5-air:free',
  ],
  // Tier 3 — Small models, last resort
  [
    'arcee-ai/trinity-mini:free',
    'openrouter/free',
  ],
];

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Build an ordered attempt list: shuffle within each tier, but keep tier order */
function buildAttemptQueue(maxAttempts: number): string[] {
  const queue: string[] = [];
  for (const tier of MODEL_TIERS) {
    queue.push(...shuffleArray(tier));
  }
  return queue.slice(0, maxAttempts);
}

export class OpenRouterProvider implements TextAIProvider {
  readonly name = 'openrouter';
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || '';
    this.baseUrl = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
    if (!this.apiKey) console.warn('[OPENROUTER] No API key configured — provider disabled');
  }

  async generateStoryBeats(prompt: string, genre: string, panelCount = 12): Promise<StoryBeat[]> {
    const attemptQueue = buildAttemptQueue(5); // Try up to 5 models
    const errors: string[] = [];

    for (const model of attemptQueue) {
      console.log(`[OPENROUTER] Trying model: ${model}`);

      try {
        const beats = await this._callModel(model, prompt, genre, panelCount);
        if (beats.length > 0) {
          console.log(`[OPENROUTER] Success with ${model} — ${beats.length} beats`);
          return beats;
        }
        errors.push(`${model}: empty result`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${model}: ${msg}`);
        console.warn(`[OPENROUTER] ${model} failed: ${msg}`);
      }
    }

    throw new Error(`OpenRouter failed after ${attemptQueue.length} model attempts: ${errors.join(' | ')}`);
  }

  private async _callModel(model: string, prompt: string, genre: string, panelCount: number): Promise<StoryBeat[]> {
    const userPrompt = `Genre: ${genre}\nPanel count target: ${panelCount}\nUser prompt: "${prompt}"\n\nGenerate a manga storyboard as a JSON array of story beats. Return ONLY the JSON array, no markdown fences, no explanation.`;

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://ragna.dev',
        'X-Title': 'RAGNA Manga Forge',
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
      throw new Error(`API ${response.status}: ${err.substring(0, 200)}`);
    }

    const data = await response.json() as { choices: Array<{ message: { content: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty response');

    // Use robust JSON parser with repair
    const parsed = robustJsonParse<StoryBeat[]>(content);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('Parsed result is not a valid beats array');
    }

    // Validate beat structure — filter out malformed entries
    return parsed.filter(beat =>
      beat && typeof beat === 'object' &&
      ['narration', 'dialogue', 'image_prompt', 'sfx'].includes(beat.type)
    );
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }
}
