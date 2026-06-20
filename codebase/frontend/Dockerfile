# Build context must be the repo root so the pnpm workspace (root manifest +
# pnpm-lock.yaml + codebase/*) is reachable.
#   docker build -f codebase/frontend/Dockerfile \
#     --build-arg NEXT_PUBLIC_API_URL=https://api.example.com/api \
#     --build-arg NEXT_PUBLIC_WS_URL=https://api.example.com \
#     -t clemvion/frontend .

# ---------- deps: install frontend's workspace subtree ----------
FROM node:24-alpine AS deps
RUN corepack enable
WORKDIR /app

# Workspace anchor + 단일 lockfile. --frozen-lockfile 검증을 위해 모든 manifest 필요.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY codebase/backend/package.json ./codebase/backend/
COPY codebase/frontend/package.json ./codebase/frontend/
COPY codebase/channel-web-chat/package.json ./codebase/channel-web-chat/
COPY codebase/packages/expression-engine/package.json ./codebase/packages/expression-engine/
COPY codebase/packages/node-summary/package.json ./codebase/packages/node-summary/
COPY codebase/packages/chat-channel-validation/package.json ./codebase/packages/chat-channel-validation/
COPY codebase/packages/graph-warning-rules/package.json ./codebase/packages/graph-warning-rules/
COPY codebase/packages/sdk/package.json ./codebase/packages/sdk/
COPY codebase/packages/web-chat-sdk/package.json ./codebase/packages/web-chat-sdk/

# 내부 패키지 소스 — prepare(tsc)가 install 중 dist 빌드.
COPY codebase/packages ./codebase/packages

RUN pnpm install --frozen-lockfile --filter "frontend..."

# ---------- builder: next build with output: 'standalone' ----------
FROM deps AS builder
WORKDIR /app

# NEXT_PUBLIC_* are baked into the client bundle at build time.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_TELEMETRY_DISABLED=1

COPY codebase/frontend ./codebase/frontend
RUN pnpm --filter frontend build

# ---------- runner: minimal standalone server ----------
FROM node:24-alpine AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3012
ENV HOSTNAME=0.0.0.0
WORKDIR /app

# standalone output 의 트레이싱 루트는 pnpm workspace 루트(= 컨테이너의 /app).
# hoist 된 node_modules + codebase/frontend/server.js + codebase/packages/* 를 포함한다.
COPY --from=builder --chown=node:node /app/codebase/frontend/.next/standalone ./
COPY --from=builder --chown=node:node /app/codebase/frontend/.next/static ./codebase/frontend/.next/static
COPY --from=builder --chown=node:node /app/codebase/frontend/public ./codebase/frontend/public

USER node
EXPOSE 3012
CMD ["node", "codebase/frontend/server.js"]
