# RAGNA /// MULTIMODAL MANGA AGENT

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2CA5E0?style=for-the-badge&logo=docker&logoColor=white)
![Google Cloud](https://img.shields.io/badge/Google_Cloud-4285F4?style=for-the-badge&logo=google-cloud&logoColor=white)

> **Blank pages are obsolete. We do not fear the void; we compute it.**

Ragna is a next-generation AI agent built for the **Gemini Live Agent Challenge** (Category: *Creative Storyteller*). It acts as a digital mangaka, transforming user prompts into full, interactive webtoons by seamlessly interleaving generated text narration, strictly monochromatic manga panels, and contextual audio into a single, cohesive vertical-scroll output.

---

## ⚙️ System Architecture

RAGNA is built on a containerized microservices architecture designed for multimodal streaming and dynamic provider fallback.

| Layer | Technology | Function |
| :--- | :--- | :--- |
| **Frontend** | Next.js 14, React, Tailwind | Renders the brutalist "Mainframe" drafting UI and handles the infinite scroll canvas. |
| **Backend** | Node.js, Express, TypeScript | The orchestration layer. Parses user intent, handles the AI routing logic, and manages asset ingestion. |
| **Database** | PostgreSQL, Prisma ORM | Strictly relational storage for Users, Projects, Pages, and individual interleaved Panels. |
| **Storage** | Local Volume / GCP Storage | Handles the persistent storage of generated `.png` assets decoupled from temporary API URLs. |

---

## 🧠 Dynamic AI Routing Engine

To ensure fault tolerance and load distribution, RAGNA implements a dynamic routing engine for its LLM and Image Generation calls. The active pipelines are determined at runtime via `.env` configuration.

### Text Generation (Storyboarding & Logic)
* **Primary:** `Gemini 1.5 Pro` (via Google GenAI SDK).
* **Fallback:** OpenRouter API (Dynamically load-balances across a pool of 15+ open-source models, including `llama-3.3-70b-instruct` and `gemma-3-27b-it`, upon encountering a `429` or `500` error).

### Image Generation (Panel Art)
* **Primary:** Comet API (Routing to specialized models like `gemini-3.1-flash-image-preview` and `doubao-seedream`).
* **Fallback:** Google Vertex AI.
* *Constraint Protocol:* All image prompts are programmatically intercepted by the backend to inject strict visual constraints: `"...strictly black and white manga style, high contrast ink, screentone shading, no colors."`

---

## 🏆 Hackathon Criteria Verification

This project fulfills the requirements of the **Creative Storyteller** track:
- [x] **Gemini Integration:** Utilizes Gemini as the primary reasoning and storyboarding engine.
- [x] **Interleaved Output:** The frontend dynamically renders a mixed-media stream (Text + Image + Audio) in a single flow, mimicking the cognitive process of a creative director.
- [x] **Google Cloud Deployment:** Backend and Database hosted on GCP (See `Proof of Deployment` video).
- [x] **Reproducible Environment:** Fully containerized via Docker for local judge testing.

---

## 🚀 Execution Protocol (Local Spin-Up)

RAGNA is fully containerized. To deploy the environment locally, ensure Docker Desktop is running and execute the following commands.

### 1. Clone & Configure
```bash
git clone https://github.com/yevgenevic/Regna.git
cd Regna
cp .env.example .env
```

*Note: Populate the `.env` file with your Gemini, OpenRouter, and Comet API keys.*

### 2. Initialize Containers

```bash
docker-compose up -d --build
```

This command initializes four services:

1. `ragna_db` (PostgreSQL) - Port `5432`
2. `ragna_adminer` (DB UI) - Port `8080`
3. `ragna_backend` (Node API) - Port `4000`
4. `ragna_frontend` (Next.js UI) - Port `3000`

### 3. Database Migration

Once the containers are healthy, push the Prisma schema to the database:

```bash
docker exec -it ragna_backend npx prisma db push
```

### 4. Access the System

* **Client Interface:** `http://localhost:3000`
* **Database Management:** `http://localhost:8080`

---

## 📂 Repository Structure

```text
├── frontend/             # Next.js UI, brutalist CSS modules, state management
├── backend/              # Node.js Express server, AI Router, Asset ingestion
│   ├── prisma/           # PostgreSQL schema
│   ├── src/services/     # AI routing fallback logic
│   └── uploads/          # Local volume mapping for generated assets
├── docker-compose.yml    # Infrastructure orchestration
└── README.md
```
