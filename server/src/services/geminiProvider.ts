// ──────────────────────────────────────────────────────────────
// Gemini Text AI Provider (Google AI Studio)
// ──────────────────────────────────────────────────────────────
import { GoogleGenerativeAI } from '@google/generative-ai';
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
- Black and white manga aesthetic
- Screentone/halftone shading references
- Dynamic composition and camera angles
- High contrast visual language

Interleave text and image beats naturally to create a cinematic reading flow.
Generate between 8-16 beats per request depending on prompt complexity.`;

export class GeminiProvider implements TextAIProvider {
  readonly name = 'gemini';
  private client: GoogleGenerativeAI | null = null;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
    if (apiKey) {
      this.client = new GoogleGenerativeAI(apiKey);
    }
  }

  async generateStoryBeats(prompt: string, genre: string, panelCount = 12): Promise<StoryBeat[]> {
    if (!this.client) throw new Error('Gemini API key not configured');

    const model = this.client.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const userPrompt = `Genre: ${genre}
Panel count target: ${panelCount}
User prompt: "${prompt}"

Generate a manga storyboard as a JSON array of story beats. Return ONLY the JSON array, no markdown fences.`;

    const result = await model.generateContent({
      contents: [
        { role: 'user', parts: [{ text: MANGA_SYSTEM_PROMPT }] },
        { role: 'model', parts: [{ text: 'Understood. I will generate strict JSON arrays of manga story beats.' }] },
        { role: 'user', parts: [{ text: userPrompt }] },
      ],
      generationConfig: {
        temperature: 0.9,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      },
    });

    const text = result.response.text();
    const parsed = robustJsonParse<StoryBeat[]>(text);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('Parsed result is not a valid beats array');
    }
    return parsed.filter(beat =>
      beat && typeof beat === 'object' &&
      ['narration', 'dialogue', 'image_prompt', 'sfx'].includes(beat.type)
    );
  }

  async isAvailable(): Promise<boolean> {
    return !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY);
  }
}
