# ──────────────────────────────────────────────────────────────
# RAGNA Frontend — Multi-stage Docker Build
# Uses Vite build + lightweight serve for production
# ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /app

# ── Install dependencies ────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

# ── Build Vite app ──────────────────────────────────────────
FROM deps AS build
COPY . .
# Bake the API URL into the build
ARG VITE_API_URL=http://localhost:4000/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ── Production image with serve ─────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
RUN npm install -g serve
COPY --from=build /app/dist ./dist

EXPOSE 3000

CMD ["serve", "-s", "dist", "-l", "3000"]
