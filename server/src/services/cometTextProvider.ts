// ──────────────────────────────────────────────────────────────
// Comet Text AI Provider — Uses Comet's /chat/completions endpoint
// Comet proxies multiple strong models (GPT-4o, Gemini, etc.)
// This gives us a third text pipeline that's separate from
// OpenRouter and Google AI Studio.
// ──────────────────────────────────────────────────────────────
import type { TextAIProvider, StoryBeat } from './types.js';
import { robustJsonParse } from './jsonRepair.js';
import {
  buildStoryDirectorPrompt,
  normalizeStoryBeats,
  STORY_DIRECTOR_SYSTEM_INSTRUCTION,
} from './storyDirector.js';

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
    const userPrompt = buildStoryDirectorPrompt(prompt, genre, panelCount);

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: STORY_DIRECTOR_SYSTEM_INSTRUCTION },
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
    const beats = normalizeStoryBeats(parsed);
    if (beats.length === 0) {
      throw new Error('Parsed result is not a valid beats array');
    }

    return beats;
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }
}
