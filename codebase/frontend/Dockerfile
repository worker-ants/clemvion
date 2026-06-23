# Build context must be the repo root so the pnpm workspace (root manifest +
# pnpm-lock.yaml + codebase/*) is reachable.
#   pnpm --filter frontend build:widget   # 1) 동봉 위젯 산출(아래 참고) — 이미지 빌드 전 필수
#   docker build -f codebase/frontend/Dockerfile \
#     --build-arg NEXT_PUBLIC_API_URL=https://api.example.com/api \
#     --build-arg NEXT_PUBLIC_WS_URL=https://api.example.com \
#     -t clemvion/frontend .                # 2) 위 산출물(public/_widget)을 그대로 이미지에 동봉
#
# 동봉 위젯(웹채팅) 전제: 본 빌더 스테이지는 `codebase/channel-web-chat` 소스를 COPY 하지 않고
# `--filter "frontend..."` 로만 설치하므로 이미지 내부에서 위젯을 빌드할 수 없다(의도된 설계).
# 따라서 `pnpm --filter frontend build:widget` 를 **호스트 작업 트리에서 docker build 직전에** 실행해
# `codebase/frontend/public/_widget/web-chat/v1/` 를 생성해야 한다. `.dockerignore` 는 node_modules·.next
# 만 제외하므로, 사전 생성된 public/_widget 은 아래 `COPY codebase/frontend`(builder)→`COPY .../public`
# (runner) 경로로 이미지에 그대로 포함된다(SoT: spec/7-channel-web-chat/0-architecture.md §4.1, k8s/README.md §6).

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
