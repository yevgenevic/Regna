import { z } from 'zod';
import type { StoryBeat } from './types.js';

const storyBeatSchema = z.object({
  type: z.enum(['narration', 'dialogue', 'sfx', 'panel_prompt']),
  content: z.string().trim().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const STORY_DIRECTOR_SYSTEM_INSTRUCTION = [
  "Generate a JSON array of objects. Each object must have a type ('narration', 'dialogue', 'sfx', or 'panel_prompt') and content. If type is 'panel_prompt', generate a detailed B&W manga description.",
  'You are RAGNA, acting as the manga director rather than a plain storyteller.',
  'Return the sequence in reading order and interleave text beats with panel_prompt beats intentionally.',
  'Keep dialogue sharp, narration economical, and sound effects punchy.',
  'For every panel_prompt, describe black-and-white manga composition, framing, lighting, contrast, screentone, motion, and subject placement.',
  'Return valid JSON only. No markdown, no commentary, no prose outside the array.',
].join(' ');

export const STORY_DIRECTOR_RESPONSE_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    additionalProperties: false,
    properties: {
      type: {
        type: 'string',
        enum: ['narration', 'dialogue', 'sfx', 'panel_prompt'],
      },
      content: {
        type: 'string',
      },
    },
    required: ['type', 'content'],
  },
} as const;

export function buildStoryDirectorPrompt(prompt: string, genre: string, panelCount = 12): string {
  return [
    `Genre: ${genre}`,
    `Target beat count: ${panelCount}`,
    `User brief: "${prompt}"`,
    'Output a single JSON array.',
    'Interleave narration, dialogue, sfx, and panel_prompt objects to create a cinematic vertical-scroll manga.',
    'Use panel_prompt only where a visual panel should be rendered.',
  ].join('\n');
}

function normalizeLegacyBeat(raw: Record<string, unknown>): StoryBeat | null {
  const rawType = typeof raw.type === 'string' ? raw.type.trim() : '';
  const normalizedType = rawType === 'image_prompt' ? 'panel_prompt' : rawType;
  const content = typeof raw.content === 'string'
    ? raw.content
    : typeof raw.text === 'string'
      ? raw.text
      : typeof raw.description === 'string'
        ? raw.description
        : '';

  const parsed = storyBeatSchema.safeParse({
    type: normalizedType,
    content,
    metadata: raw.metadata,
  });

  return parsed.success ? parsed.data : null;
}

export function normalizeStoryBeats(raw: unknown): StoryBeat[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      return normalizeLegacyBeat(item as Record<string, unknown>);
    })
    .filter((item): item is StoryBeat => item !== null);
}

export class StreamingStoryBeatParser {
  private buffer = '';
  private cursor = 0;
  private seenArrayStart = false;
  private objectDepth = 0;
  private objectStart = -1;
  private inString = false;
  private escaping = false;

  append(chunk: string): StoryBeat[] {
    if (!chunk) {
      return [];
    }

    this.buffer += chunk;
    const beats: StoryBeat[] = [];
    let trimIndex = 0;

    for (; this.cursor < this.buffer.length; this.cursor += 1) {
      const char = this.buffer[this.cursor];

      if (!this.seenArrayStart) {
        if (char === '[') {
          this.seenArrayStart = true;
        }
        continue;
      }

      if (this.escaping) {
        this.escaping = false;
        continue;
      }

      if (char === '\\' && this.inString) {
        this.escaping = true;
        continue;
      }

      if (char === '"') {
        this.inString = !this.inString;
        continue;
      }

      if (this.inString) {
        continue;
      }

      if (char === '{') {
        if (this.objectDepth === 0) {
          this.objectStart = this.cursor;
        }
        this.objectDepth += 1;
        continue;
      }

      if (char === '}') {
        this.objectDepth -= 1;

        if (this.objectDepth === 0 && this.objectStart >= 0) {
          const rawObject = this.buffer.slice(this.objectStart, this.cursor + 1);

          try {
            const parsed = JSON.parse(rawObject) as Record<string, unknown>;
            const normalized = normalizeLegacyBeat(parsed);
            if (normalized) {
              beats.push(normalized);
            }
          } catch {
            // Ignore malformed partial objects and keep scanning.
          }

          trimIndex = this.cursor + 1;
          this.objectStart = -1;
        }
      }
    }

    if (trimIndex > 0) {
      this.buffer = this.buffer.slice(trimIndex);
      this.cursor -= trimIndex;
      if (this.cursor < 0) {
        this.cursor = 0;
      }
      if (this.objectStart >= 0) {
        this.objectStart -= trimIndex;
      }
    }

    return beats;
  }
}