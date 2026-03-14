# RAGNA

RAGNA is an agentic manga generator built for the Gemini API Developer Competition, Creative Storyteller track. The app does not wait for a full story and then render images afterward. Gemini 1.5 Pro acts as a director, streams an interleaved mixed-media sequence, and the UI fills in text immediately while panel images render in the background slot by slot.

## Why This Build Matters

- Gemini 1.5 Pro streams a JSON array of interleaved objects in reading order.
- Each object is one of `narration`, `dialogue`, `sfx`, or `panel_prompt`.
- As soon as a `panel_prompt` arrives, the frontend creates a loading skeleton for that exact panel.
- The backend kicks off image generation asynchronously, uploads the finished image to Google Cloud Storage, then streams the resolved public URL back into the same slot.
- The React frontend and Express API now ship in a single container so the app can run on one Cloud Run service and scale to zero.

That turns RAGNA from a wrapper around sequential model calls into a small orchestration agent with native interleaving.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, Vite |
| Backend | Express, TypeScript, Prisma |
| Database | PostgreSQL |
| Text generation | Gemini 1.5 Pro, OpenRouter fallback, Comet text fallback |
| Image generation | Comet, Vertex AI Imagen fallback |
| Persistent media | Google Cloud Storage |
| Deployment target | Cloud Run |
| Local orchestration | Docker Compose |

## Interleaved Flow

1. The client posts a generation request to `/api/generate`.
2. The backend calls Gemini 1.5 Pro with `generateContentStream()` and a strict JSON-only system instruction.
3. The stream is parsed incrementally as a JSON array of objects.
4. Text beats are persisted and streamed to the UI immediately.
5. When a `panel_prompt` arrives, the backend emits a placeholder event and starts image rendering in the background.
6. The rendered image is uploaded directly to GCS with `bucket.file(name).createWriteStream()`.
7. The backend emits the final image URL for the same `orderIndex`, replacing the skeleton in place.
8. After all pending image jobs finish, the project is finalized and stored in PostgreSQL.

## Repository Layout

```text
.
├── src/                     React app
│   ├── components/         Prompt and background UI
│   ├── pages/              Landing, generator, archives, manifesto
│   └── services/           Frontend API client
├── server/
│   ├── prisma/             Prisma schema and migrations
│   ├── src/
│   │   ├── routes/         API routes and SSE endpoint
│   │   └── services/       AI router, providers, GCS storage, story parser
│   └── .env.example        Server and Cloud Run env template
├── Dockerfile              Single full-stack Cloud Run image
├── docker-compose.yml      Local full-stack + Postgres + Adminer
└── README.md
```

## Local Development

### Prerequisites

- Node.js 20+
- Docker Desktop
- One or more model API keys

### 1. Configure env vars

```bash
cp server/.env.example server/.env
```

Minimum local env values:

```env
GEMINI_API_KEY=your-google-ai-studio-key
COMET_API_KEY=your-comet-key
DATABASE_URL=postgresql://ragna_admin:ragna_secret_2026@db:5432/ragna_core
```

If you want Cloud Storage locally as well, set:

```env
GCS_BUCKET_NAME=your-bucket
GCS_PROJECT_ID=your-gcp-project-id
```

If `GCS_BUCKET_NAME` is not set, RAGNA falls back to local ephemeral `/uploads` storage.

### 2. Start the full app locally

```bash
docker compose up --build
```

Services:

| Service | URL |
|---------|-----|
| App | http://localhost:3000 |
| Adminer | http://localhost:8080 |
| PostgreSQL | localhost:5432 |

The compose setup now mirrors production more closely: one app container serves both the React frontend and the Express API.

### 3. Optional non-container workflow

Frontend:

```bash
npm install
npm run dev
```

Backend:

```bash
cd server
npm install
npm run dev
```

In development, the frontend defaults to `http://localhost:4000/api` unless `VITE_API_URL` is set.

## Environment Variables

Primary runtime variables live in [server/.env.example](server/.env.example).

Important ones:

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `GEMINI_API_KEY` | yes for primary path | Gemini 1.5 Pro director stream |
| `COMET_API_KEY` | yes for primary image path | Image generation |
| `OPENROUTER_API_KEY` | optional | Text fallback |
| `TEXT_AI_PROVIDER` | optional | Provider order, default `gemini,openrouter` |
| `IMAGE_AI_PROVIDER` | optional | Provider order, default `comet,vertex` |
| `GCS_BUCKET_NAME` | recommended for production | Persistent panel storage |
| `GCS_PROJECT_ID` | recommended for production | GCP project for GCS and Vertex |
| `GCS_PUBLIC_BASE_URL` | optional | Custom public asset base URL |
| `CORS_ORIGIN` | optional | Allowed origin(s), comma-separated |

## Cloud Run Deployment

### What the production container does

- Builds the React app with Vite.
- Copies the frontend `dist` output into the Express `public` directory inside the image.
- Starts the Express server.
- Serves the SPA and `/api/*` from one Cloud Run service.

### Production assumptions

- PostgreSQL runs outside the container. Cloud SQL is the natural fit.
- Panel images are stored in GCS, not in the container filesystem.
- Cloud Run injects `PORT=8080` automatically.
- Vertex fallback uses Application Default Credentials, so the Cloud Run service account must be allowed to call Vertex AI.

### Recommended GCP resources

1. Cloud Run service for the app.
2. Cloud SQL for PostgreSQL.
3. GCS bucket for panel images.
4. Secret Manager or Cloud Run env vars for API keys.

### GCS setup notes

RAGNA calls `file.makePublic()` unless you provide `GCS_PUBLIC_BASE_URL`, so the simplest hackathon setup is:

1. Create a bucket for panel assets.
2. Use fine-grained object access or otherwise allow public object URLs for uploaded files.
3. Grant the Cloud Run service account permission to write objects.

Typical roles:

- `Storage Object Creator` on the bucket for the Cloud Run service account.
- `Vertex AI User` if you want Vertex image fallback.

### Example deployment flow

Build locally:

```bash
docker build -t ragna .
```

Deploy with Cloud Run:

```bash
gcloud run deploy ragna \
	--source . \
	--region us-central1 \
	--allow-unauthenticated \
	--set-env-vars TEXT_AI_PROVIDER=gemini,openrouter,IMAGE_AI_PROVIDER=comet,vertex,GCS_BUCKET_NAME=your-bucket,GCS_PROJECT_ID=your-project \
	--set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest,COMET_API_KEY=COMET_API_KEY:latest
```

You still need to provide a valid `DATABASE_URL`, either through `--set-env-vars`, `--set-secrets`, or your service configuration.

## API Surface

| Endpoint | Purpose |
|----------|---------|
| `POST /api/generate` | SSE generation stream |
| `POST /api/generate/preview` | Text-only storyboard preview |
| `GET /api/projects` | Archives list |
| `GET /api/projects/:id` | Full project read mode |
| `DELETE /api/projects/:id` | Delete a project |
| `GET /api/panels/:projectId/export` | Export raw panel JSON |
| `GET /api/health` | Health probe |

## Validation

Current implementation was validated with:

```bash
cd server && npm run build
npm run build
```

## License

MIT
