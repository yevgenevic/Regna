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
  async generateStoryBeats(
    prompt: string,
    genre: string,
    panelCount = 12,
    onBeat?: (beat: StoryBeat) => Promise<void> | void,
  ): Promise<{ beats: StoryBeat[]; providerUsed: string }> {
    const errors: string[] = [];

    for (const provider of this.textProviders) {
      let emittedCount = 0;
      const usedStreaming = Boolean(provider.streamStoryBeats && onBeat);

      try {
        const available = await provider.isAvailable();
        if (!available) {
          console.warn(`[AI_ROUTER] ${provider.name} unavailable (no API key), skipping`);
          errors.push(`${provider.name}: unavailable`);
          continue;
        }
        console.log(`[AI_ROUTER] ⚡ Attempting text gen with: ${provider.name}`);

        const emitBeat = async (beat: StoryBeat) => {
          emittedCount += 1;
          if (onBeat) {
            await onBeat(beat);
          }
        };

        const beats = provider.streamStoryBeats && onBeat
          ? await provider.streamStoryBeats(prompt, genre, panelCount, emitBeat)
          : await provider.generateStoryBeats(prompt, genre, panelCount);

        if (!provider.streamStoryBeats && onBeat) {
          for (const beat of beats) {
            await emitBeat(beat);
          }
        }

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
        if (usedStreaming && emittedCount > 0) {
          console.error(`[AI_ROUTER] Streamed provider ${provider.name} failed after partial output; aborting fallback`);
          throw err;
        }
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
    panelCount = 12,
    onPanel?: (event: PanelEvent) => void,
  ): Promise<string> {
    const project = await prisma.mangaProject.create({
      data: {
        userId,
        title: prompt.substring(0, 100),
        genre: genre as 'SHONEN' | 'SEINEN' | 'MECHA' | 'SHOJO',
        originalPrompt: prompt,
        aiModelUsed: 'GEMINI_1_5_PRO',
      },
    });

    const page = await prisma.mangaPage.create({
      data: {
        projectId: project.id,
        pageNumber: 1,
      },
    });

    let orderIndex = 1;
    let coverImageSet = false;
    let emittedBeatCount = 0;
    const imageTasks: Promise<void>[] = [];

    const processBeat = async (beat: StoryBeat) => {
      const currentOrder = orderIndex;
      orderIndex += 1;
      emittedBeatCount += 1;

      if (beat.type === 'panel_prompt') {
        const beatMetadata = JSON.parse(JSON.stringify(beat.metadata || {})) as Record<string, unknown>;
        onPanel?.({
          type: 'panel_prompt',
          orderIndex: currentOrder,
          content: beat.content,
          metadata: beatMetadata,
        });

        imageTasks.push((async () => {
          try {
            const { imageUrl, providerUsed } = await this.generateImage(beat.content, genre.toLowerCase());
            const imageMetadata = {
              ...beatMetadata,
              imagePrompt: beat.content,
              imageProvider: providerUsed,
            };

            await prisma.panel.create({
              data: {
                pageId: page.id,
                orderIndex: currentOrder,
                type: 'IMAGE_PANEL',
                content: imageUrl,
                metadata: imageMetadata,
              },
            });

            if (!coverImageSet) {
              coverImageSet = true;
              await prisma.mangaProject.update({
                where: { id: project.id },
                data: { coverImageUrl: imageUrl },
              });
            }

            onPanel?.({
              type: 'image',
              orderIndex: currentOrder,
              content: imageUrl,
              metadata: imageMetadata,
            });
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Image generation failed';
            console.error(`[PIPELINE] Image generation failed beat #${currentOrder}:`, err);

            await prisma.panel.create({
              data: {
                pageId: page.id,
                orderIndex: currentOrder,
                type: 'IMAGE_PANEL',
                content: '[IMAGE_GENERATION_FAILED]',
                metadata: {
                  ...beatMetadata,
                  imagePrompt: beat.content,
                  error: message,
                },
              },
            });

            onPanel?.({
              type: 'error',
              orderIndex: currentOrder,
              content: 'Image generation failed',
              metadata: {
                imagePrompt: beat.content,
                targetType: 'panel_prompt',
                error: message,
              },
            });
          }
        })());

        return;
      }

      const panelType = beat.type === 'dialogue' ? 'DIALOGUE' : beat.type === 'sfx' ? 'SFX' : 'NARRATION';
      const beatMetadata = JSON.parse(JSON.stringify(beat.metadata || {})) as Record<string, unknown>;

      await prisma.panel.create({
        data: {
          pageId: page.id,
          orderIndex: currentOrder,
          type: panelType,
          content: beat.content,
          metadata: beatMetadata,
        },
      });

      onPanel?.({
        type: beat.type,
        orderIndex: currentOrder,
        content: beat.content,
        metadata: beatMetadata,
      });
    };

    try {
      const { beats, providerUsed: textProvider } = await this.generateStoryBeats(prompt, genre, panelCount, processBeat);

      if (!beats || beats.length === 0) {
        throw new Error('Text pipeline returned empty beats — aborting project creation');
      }

      await prisma.mangaProject.update({
        where: { id: project.id },
        data: {
          aiModelUsed: this.mapProviderToModel(textProvider),
        },
      });
    } catch (error) {
      if (emittedBeatCount === 0) {
        await prisma.mangaProject.delete({ where: { id: project.id } });
      }

      throw error;
    }

    await Promise.all(imageTasks);

    onPanel?.({ type: 'done', orderIndex: -1, content: project.id });
    return project.id;
  }

  private mapProviderToModel(provider: string): 'GEMINI_2_FLASH' | 'GEMINI_1_5_PRO' | 'CLAUDE_3_5_SONNET' | 'CLAUDE_3_OPUS' | 'LLAMA_3' | 'MIDJOURNEY' | 'IMAGEN_3' | 'COMET' {
    const map: Record<string, 'GEMINI_1_5_PRO' | 'CLAUDE_3_5_SONNET' | 'LLAMA_3' | 'COMET'> = {
      'gemini':      'GEMINI_1_5_PRO',
      'comet-text':  'COMET',
      'openrouter':  'LLAMA_3',
    };
    return map[provider] || 'GEMINI_1_5_PRO';
  }
}

// Singleton export
export const aiRouter = new AIRouter();
