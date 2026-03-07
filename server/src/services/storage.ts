// ──────────────────────────────────────────────────────────────
// Storage Service — Local Volume + Optional GCS
// SRS §1.2: Images are downloaded, written to mapped /uploads
// volume, and stored as full local URLs in PostgreSQL.
// ──────────────────────────────────────────────────────────────
import { randomUUID } from 'crypto';
import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export class StorageService {
  private bucketName: string;
  private useLocal: boolean;

  constructor() {
    this.bucketName = process.env.GCS_BUCKET_NAME || 'ragna-manga-panels';
    // Fall back to local storage if no GCS credentials
    this.useLocal = !process.env.GCS_PROJECT_ID || process.env.NODE_ENV === 'development';

    if (this.useLocal) {
      console.log('[STORAGE] Using local file storage → /uploads volume');
    }
  }

  async uploadImage(imageBuffer: Buffer, filename?: string): Promise<string> {
    const name = filename || `panels/${randomUUID()}.png`;

    if (this.useLocal) {
      return this.saveLocal(imageBuffer, name);
    }

    return this.uploadToGCS(imageBuffer, name);
  }

  /**
   * SRS §1.2 & §2.3: Write image buffer to the mapped local /uploads volume.
   * Returns the full URL (http://localhost:PORT/uploads/...) so the DB stores
   * a resolvable path that the frontend can render directly.
   */
  private async saveLocal(buffer: Buffer, name: string): Promise<string> {
    const uploadDir = join(__dirname, '../../uploads');
    const filePath = join(uploadDir, name);

    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, buffer);

    // Build full URL using server port so DB stores a resolvable address
    const port = process.env.PORT || '4000';
    const host = process.env.STORAGE_HOST || `http://localhost:${port}`;
    return `${host}/uploads/${name}`;
  }

  private async uploadToGCS(buffer: Buffer, name: string): Promise<string> {
    // Dynamic import to avoid requiring GCS in dev
    const { Storage } = await import('@google-cloud/storage');
    const storage = new Storage({ projectId: process.env.GCS_PROJECT_ID });
    const bucket = storage.bucket(this.bucketName);
    const file = bucket.file(name);

    await file.save(buffer, {
      contentType: 'image/png',
      metadata: {
        cacheControl: 'public, max-age=31536000',
      },
    });

    await file.makePublic();
    return `https://storage.googleapis.com/${this.bucketName}/${name}`;
  }
}
