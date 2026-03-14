// ──────────────────────────────────────────────────────────────
// Gemini Text AI Provider (Google GenAI SDK)
// ──────────────────────────────────────────────────────────────
import { GoogleGenAI } from '@google/genai';
import type { TextAIProvider, StoryBeat } from './types.js';
import { robustJsonParse } from './jsonRepair.js';
import {
  buildStoryDirectorPrompt,
  normalizeStoryBeats,
  STORY_DIRECTOR_RESPONSE_SCHEMA,
  STORY_DIRECTOR_SYSTEM_INSTRUCTION,
  StreamingStoryBeatParser,
} from './storyDirector.js';

export class GeminiProvider implements TextAIProvider {
  readonly name = 'gemini';
  private ai: GoogleGenAI | null = null;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
    if (apiKey) {
      this.ai = new GoogleGenAI({ apiKey });
    }
  }

  private async callGeminiText(prompt: string): Promise<string> {
    if (!this.ai) throw new Error('Gemini API key not configured');
    const response = await this.ai.models.generateContent({
      model: 'gemini-1.5-pro',
      contents: prompt,
      config: {
        systemInstruction: STORY_DIRECTOR_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseJsonSchema: STORY_DIRECTOR_RESPONSE_SCHEMA,
        temperature: 0.9,
      },
    });
    return response.text ?? '';
  }

  async generateStoryBeats(prompt: string, genre: string, panelCount = 12): Promise<StoryBeat[]> {
    const userPrompt = buildStoryDirectorPrompt(prompt, genre, panelCount);
    const text = await this.callGeminiText(userPrompt);
    const parsed = robustJsonParse<StoryBeat[]>(text);
    const beats = normalizeStoryBeats(parsed);
    if (beats.length === 0) {
      throw new Error('Parsed result is not a valid beats array');
    }
    return beats;
  }

  async streamStoryBeats(
    prompt: string,
    genre: string,
    panelCount: number,
    onBeat: (beat: StoryBeat) => Promise<void> | void,
  ): Promise<StoryBeat[]> {
    if (!this.ai) {
      throw new Error('Gemini API key not configured');
    }

    const parser = new StreamingStoryBeatParser();
    const streamedBeats: StoryBeat[] = [];
    const response = await this.ai.models.generateContentStream({
      model: 'gemini-1.5-pro',
      contents: buildStoryDirectorPrompt(prompt, genre, panelCount),
      config: {
        systemInstruction: STORY_DIRECTOR_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseJsonSchema: STORY_DIRECTOR_RESPONSE_SCHEMA,
        temperature: 0.9,
      },
    });

    for await (const chunk of response) {
      const partialText = typeof chunk.text === 'string' ? chunk.text : '';
      const nextBeats = parser.append(partialText);

      for (const beat of nextBeats) {
        streamedBeats.push(beat);
        await onBeat(beat);
      }
    }

    if (streamedBeats.length === 0) {
      throw new Error('Gemini stream completed without yielding beats');
    }

    return streamedBeats;
  }

  async isAvailable(): Promise<boolean> {
    return !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY);
  }
}
