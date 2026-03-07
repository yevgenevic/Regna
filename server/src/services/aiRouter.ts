// ──────────────────────────────────────────────────────────────
// AI ROUTER — The Factory Pattern
// Routes generation requests to the active text/image providers
// with automatic fallback on failure or rate-limiting.
// ──────────────────────────────────────────────────────────────
import type { TextAIProvider, ImageAIProvider, StoryBeat, PanelEvent } from './types.js';
import { GeminiProvider } from './geminiProvider.js';
import { OpenRouterProvider } from './openRouterProvider.js';
import { CometTextProvider } from './cometTextProvider.js';
import { CometImageProvider } from './cometProvider.js';
import { VertexImageProvider } from './vertexProvider.js';
import { StorageService } from './storage.js';
import { prisma } from '../prisma.js';

// ── Provider Registry ────────────────────────────────────────
const TEXT_PROVIDERS: Record<string, () => TextAIProvider> = {
  'gemini':      () => new GeminiProvider(),
  'comet-text':  () => new CometTextProvider(),
  'openrouter':  () => new OpenRouterProvider(),
};

const IMAGE_PROVIDERS: Record<string, () => ImageAIProvider> = {
  comet: () => new CometImageProvider(),
  vertex: () => new VertexImageProvider(),
};

// ── AI Router Class ──────────────────────────────────────────
export class AIRouter {
  private textProviders: TextAIProvider[];
  private imageProviders: ImageAIProvider[];
  private storage: StorageService;

  constructor() {
    // Read priority from .env (e.g., "gemini,comet-text,openrouter")
    const textOrder = (process.env.TEXT_AI_PROVIDER || 'gemini,comet-text,openrouter').split(',').map(s => s.trim());
    const imageOrder = (process.env.IMAGE_AI_PROVIDER || 'comet').split(',').map(s => s.trim());

    this.textProviders = textOrder
      .filter(name => TEXT_PROVIDERS[name])
      .map(name => TEXT_PROVIDERS[name]());

    this.imageProviders = imageOrder
      .filter(name => IMAGE_PROVIDERS[name])
      .map(name => IMAGE_PROVIDERS[name]());

    this.storage = new StorageService();

    console.log(`[AI_ROUTER] Text pipeline: ${this.textProviders.map(p => p.name).join(' → ')}`);
    console.log(`[AI_ROUTER] Image pipeline: ${this.imageProviders.map(p => p.name).join(' → ')}`);
  }

  // ── Text Generation with Fallback ─────────────────────────
  async generateStoryBeats(prompt: string, genre: string, panelCount?: number): Promise<{ beats: StoryBeat[]; providerUsed: string }> {
    const errors: string[] = [];

    for (const provider of this.textProviders) {
      try {
        const available = await provider.isAvailable();
        if (!available) {
          console.warn(`[AI_ROUTER] ${provider.name} unavailable (no API key), skipping`);
          errors.push(`${provider.name}: unavailable`);
          continue;
        }
        console.log(`[AI_ROUTER] ⚡ Attempting text gen with: ${provider.name}`);
        const beats = await provider.generateStoryBeats(prompt, genre, panelCount);

        // VALIDATE: Provider must return at least 1 usable beat
        if (!beats || beats.length === 0) {
          console.warn(`[AI_ROUTER] ${provider.name} returned 0 beats, trying next...`);
          errors.push(`${provider.name}: returned 0 beats`);
          continue;
        }

        console.log(`[AI_ROUTER] ✓ ${provider.name} produced ${beats.length} beats`);
        return { beats, providerUsed: provider.name };
      } catch (err: any) {
        const msg = err?.message || String(err);
        console.error(`[AI_ROUTER] ✗ ${provider.name} failed: ${msg}`);
        errors.push(`${provider.name}: ${msg.substring(0, 120)}`);
        continue;
      }
    }

    throw new Error(`All text AI providers failed.\n${errors.join('\n')}`);
  }

  // ── Image Generation with Fallback ────────────────────────
  async generateImage(prompt: string, style?: string): Promise<{ imageUrl: string; providerUsed: string }> {
    for (const provider of this.imageProviders) {
      try {
        const available = await provider.isAvailable();
        if (!available) continue;
        console.log(`[AI_ROUTER] Generating image with: ${provider.name}`);
        const imageBuffer = await provider.generateImage(prompt, style);
        const imageUrl = await this.storage.uploadImage(imageBuffer);
        return { imageUrl, providerUsed: provider.name };
      } catch (err) {
        console.error(`[AI_ROUTER] ${provider.name} image failed:`, err);
        continue;
      }
    }
    throw new Error('All image AI providers failed.');
  }

  // ── Full Pipeline: Generate Story → Images → Save to DB ───
  async executeFullPipeline(
    prompt: string,
    genre: string,
    userId: string,
    onPanel?: (event: PanelEvent) => void,
  ): Promise<string> {
    // ── STEP 1: Generate story beats FIRST (no DB writes yet) ──
    // If this throws, NO empty project is created.
    const { beats, providerUsed: textProvider } = await this.generateStoryBeats(prompt, genre);

    // Extra guard: if beats is somehow empty after provider "succeeded"
    if (!beats || beats.length === 0) {
      throw new Error('Text pipeline returned empty beats — aborting project creation');
    }

    console.log(`[PIPELINE] ${beats.length} beats from ${textProvider} — creating project`);

    // ── STEP 2: Create project + page in DB only AFTER beats exist ──
    const project = await prisma.mangaProject.create({
      data: {
        userId,
        title: prompt.substring(0, 100),
        genre: genre as 'SHONEN' | 'SEINEN' | 'MECHA' | 'SHOJO',
        originalPrompt: prompt,
        aiModelUsed: this.mapProviderToModel(textProvider),
      },
    });

    const page = await prisma.mangaPage.create({
      data: {
        projectId: project.id,
        pageNumber: 1,
      },
    });

    // ── STEP 3: Process each beat → panels ──
    let orderIndex = 1;
    let coverImageSet = false;

    for (const beat of beats) {
      if (beat.type === 'image_prompt' && beat.description) {
        try {
          const { imageUrl } = await this.generateImage(beat.description, genre.toLowerCase());

          await prisma.panel.create({
            data: {
              pageId: page.id,
              orderIndex,
              type: 'IMAGE_PANEL',
              content: imageUrl,
              metadata: JSON.parse(JSON.stringify(beat.metadata || {})),
            },
          });

          if (!coverImageSet) {
            await prisma.mangaProject.update({
              where: { id: project.id },
              data: { coverImageUrl: imageUrl },
            });
            coverImageSet = true;
          }

          onPanel?.({ type: 'image', orderIndex, content: imageUrl, metadata: beat.metadata as Record<string, unknown> });
        } catch (err) {
          console.error(`[PIPELINE] Image generation failed beat #${orderIndex}:`, err);
          // Save a placeholder so the panel slot isn't lost
          await prisma.panel.create({
            data: {
              pageId: page.id,
              orderIndex,
              type: 'IMAGE_PANEL',
              content: '[IMAGE_GENERATION_FAILED]',
              metadata: { originalPrompt: beat.description },
            },
          });
          onPanel?.({ type: 'error', orderIndex, content: 'Image generation failed' });
        }
      } else {
        const panelType = beat.type === 'dialogue' ? 'DIALOGUE' : beat.type === 'sfx' ? 'SFX' : 'NARRATION';
        const content = beat.text || '';

        await prisma.panel.create({
          data: {
            pageId: page.id,
            orderIndex,
            type: panelType,
            content,
            metadata: JSON.parse(JSON.stringify(beat.metadata || {})),
          },
        });

        onPanel?.({
          type: beat.type as PanelEvent['type'],
          orderIndex,
          content,
          metadata: beat.metadata as Record<string, unknown>,
        });
      }
      orderIndex++;
    }

    // ── STEP 4: Done ──
    onPanel?.({ type: 'done', orderIndex: -1, content: project.id });
    return project.id;
  }

  private mapProviderToModel(provider: string): 'GEMINI_2_FLASH' | 'GEMINI_1_5_PRO' | 'CLAUDE_3_5_SONNET' | 'CLAUDE_3_OPUS' | 'LLAMA_3' | 'MIDJOURNEY' | 'IMAGEN_3' | 'COMET' {
    const map: Record<string, 'GEMINI_2_FLASH' | 'CLAUDE_3_5_SONNET' | 'LLAMA_3' | 'COMET'> = {
      'gemini':      'GEMINI_2_FLASH',
      'comet-text':  'COMET',
      'openrouter':  'LLAMA_3',
    };
    return map[provider] || 'GEMINI_2_FLASH';
  }
}

// Singleton export
export const aiRouter = new AIRouter();
