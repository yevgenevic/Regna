# RAGNA

**AI-powered manga generator.** Type a prompt, get a full webtoon — panels, narration, dialogue, and SFX — streamed in real time.

Built for the [Gemini API Developer Competition](https://ai.google.dev/competition) — Creative Storyteller track.

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React + Vite |
| Backend | Express, TypeScript, Prisma |
| Database | PostgreSQL |
| AI (Text) | Gemini 1.5 Pro → OpenRouter (fallback) |
| AI (Image) | Comet → Vertex AI (fallback) |
| Infra | Docker Compose, GCP |

## How It Works

1. You enter a prompt + genre
2. Gemini generates structured story beats (narration, dialogue, image prompts, SFX)
3. Image providers render each panel in black & white manga style
4. Everything streams to a vertical-scroll webtoon canvas

The backend uses a **provider fallback chain** — if Gemini is down or rate-limited, it automatically routes to the next available provider. Same for image generation.

## Quick Start

```bash
git clone https://github.com/yevgenevic/Regna.git
cd Regna
cp .env.example .env   # add your API keys
docker-compose up -d --build
```

Then hit **http://localhost:3000**.

### Services

| Service | Port |
|---------|------|
| Frontend | `3000` |
| Backend API | `4000` |
| PostgreSQL | `5432` |
| Adminer (DB UI) | `8080` |

### DB Migration

```bash
docker exec -it ragna_core npx prisma db push
```

## Environment Variables

```env
GEMINI_API_KEY=           # required — Google AI Studio key
OPENROUTER_API_KEY=       # optional — fallback text gen
COMET_API_KEY=            # image generation
DATABASE_URL=             # auto-set in docker-compose
```

## Project Structure

```
├── src/                  # React frontend
│   ├── components/       # PromptInterface, VideoBackground
│   ├── pages/            # Landing, Generator, Archives, Manifesto
│   └── services/         # API client
├── server/               # Express backend
│   ├── src/services/     # AI router, providers, storage
│   ├── prisma/           # Schema + migrations
│   └── uploads/          # Generated panel images
├── docker-compose.yml
└── README.md
```

## License

MIT
