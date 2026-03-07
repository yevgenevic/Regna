// ──────────────────────────────────────────────────────────────
// AI Provider Interfaces — Shared contracts for the AI Router
// ──────────────────────────────────────────────────────────────

/** A single "beat" produced by the LLM for manga generation */
export interface StoryBeat {
  type: 'narration' | 'dialogue' | 'image_prompt' | 'sfx';
  text?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

/** Text AI provider contract */
export interface TextAIProvider {
  readonly name: string;
  generateStoryBeats(prompt: string, genre: string, panelCount?: number): Promise<StoryBeat[]>;
  isAvailable(): Promise<boolean>;
}

/** Image AI provider contract */
export interface ImageAIProvider {
  readonly name: string;
  generateImage(prompt: string, style?: string): Promise<Buffer>;
  isAvailable(): Promise<boolean>;
}

/** The master generation request coming from the frontend */
export interface GenerationRequest {
  prompt: string;
  genre: 'SHONEN' | 'SEINEN' | 'MECHA' | 'SHOJO';
  userId?: string;
  panelCount?: number;
}

/** Streamed panel event sent to the frontend via SSE */
export interface PanelEvent {
  type: 'narration' | 'dialogue' | 'image' | 'sfx' | 'done' | 'error';
  orderIndex: number;
  content: string;
  metadata?: Record<string, unknown>;
}
