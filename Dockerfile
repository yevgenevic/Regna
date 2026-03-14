# ──────────────────────────────────────────────────────────────
# RAGNA — Full-stack Cloud Run image
# Builds the React frontend, bundles it into the Express server,
# and starts a single container that serves both UI + API.
# ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS web-deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM web-deps AS web-build
COPY . .
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM node:20-alpine AS server-deps
WORKDIR /app/server
COPY server/package.json server/package-lock.json* ./
COPY server/prisma ./prisma/
RUN npm ci --ignore-scripts && npx prisma generate

FROM server-deps AS server-build
COPY server/tsconfig.json ./tsconfig.json
COPY server/src ./src/
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app/server
ENV NODE_ENV=production
COPY --from=server-deps /app/server/node_modules ./node_modules
COPY --from=server-deps /app/server/package.json ./package.json
COPY --from=server-deps /app/server/prisma ./prisma
COPY --from=server-build /app/server/dist ./dist
COPY --from=web-build /app/dist ./public
RUN mkdir -p /app/server/uploads/panels

EXPOSE 8080

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
