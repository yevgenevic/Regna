# ──────────────────────────────────────────────────────────────
# RAGNA Backend — Multi-stage Docker Build
# ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /app

# ── Install dependencies ────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json* ./
COPY prisma ./prisma/
RUN npm ci --ignore-scripts && npx prisma generate

# ── Build TypeScript ────────────────────────────────────────
FROM deps AS build
COPY tsconfig.json ./
COPY src ./src/
RUN npx tsc

# ── Production image ────────────────────────────────────────
FROM base AS runner

# Copy node_modules with Prisma client
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./
COPY --from=deps /app/prisma ./prisma

# Copy compiled JS
COPY --from=build /app/dist ./dist

# Create uploads directory
RUN mkdir -p /app/uploads/panels

EXPOSE 4000

# Run migrations then start server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
