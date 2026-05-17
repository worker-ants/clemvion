# Build context must be the repo root so that ../packages/* are reachable.
#   docker build -f codebase/frontend/Dockerfile \
#     --build-arg NEXT_PUBLIC_API_URL=https://api.example.com/api \
#     --build-arg NEXT_PUBLIC_WS_URL=https://api.example.com \
#     -t clemvion/frontend .

# ---------- deps ----------
# node:24-alpine ships with npm 11.x, which matches the npm version used to
# author package-lock.json. Older majors (22/23) ship npm 10.x and cause
# `npm ci` lockfile-shape mismatches.
FROM node:24-alpine AS deps
WORKDIR /app

COPY packages/expression-engine/package.json packages/expression-engine/package-lock.json packages/expression-engine/tsconfig.json ./packages/expression-engine/
COPY packages/expression-engine/src ./packages/expression-engine/src
RUN cd packages/expression-engine && npm ci && npm run build

COPY packages/node-summary/package.json packages/node-summary/package-lock.json packages/node-summary/tsconfig.json ./packages/node-summary/
COPY packages/node-summary/src ./packages/node-summary/src
RUN cd packages/node-summary && npm ci && npm run build

COPY codebase/frontend/package.json codebase/frontend/package-lock.json ./frontend/
RUN cd frontend && npm ci

# ---------- builder: next build with output: 'standalone' ----------
FROM deps AS builder
WORKDIR /app

# NEXT_PUBLIC_* are baked into the client bundle at build time.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_TELEMETRY_DISABLED=1

COPY codebase/frontend ./frontend
RUN cd frontend && npm run build

# ---------- runner: minimal standalone server ----------
FROM node:24-alpine AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3012
ENV HOSTNAME=0.0.0.0
WORKDIR /app

# standalone output is rooted at outputFileTracingRoot (= repo root).
# It already contains pruned node_modules and packages/*.
COPY --from=builder --chown=node:node /app/frontend/.next/standalone ./
COPY --from=builder --chown=node:node /app/frontend/.next/static ./frontend/.next/static
COPY --from=builder --chown=node:node /app/frontend/public ./frontend/public

USER node
EXPOSE 3012
CMD ["node", "frontend/server.js"]
