# Build context must be the repo root so the pnpm workspace (root manifest +
# pnpm-lock.yaml + codebase/*) is reachable.
#   docker build -f codebase/frontend/Dockerfile \
#     --build-arg NEXT_PUBLIC_API_URL=https://api.example.com/api \
#     --build-arg NEXT_PUBLIC_WS_URL=https://api.example.com \
#     -t clemvion/frontend .
#
# 동봉 위젯(웹채팅) — **이미지 내부에서 자급 빌드**한다. builder 가 `channel-web-chat`(위젯 SPA) +
# `@workflow/web-chat`(loader SDK) 의 소스·deps 를 갖추고 `pnpm --filter frontend build:widget`(copy-widget.mjs)
# 을 `next build` 직전에 실행해 `codebase/frontend/public/_widget/web-chat/v1/{app,loader.js}` 를 생성한다.
# 그 산출물이 standalone runner 의 `COPY .../public` 으로 이미지에 동봉된다. 외부 CI(Jenkins 등)는
# `docker build` 만 하면 되고 호스트에서 별도 `build:widget` 을 선행할 필요가 없다(외부 의존 0).
# SoT: spec/7-channel-web-chat/0-architecture.md §4.1.

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

# frontend + 동봉 위젯(channel-web-chat·@workflow/web-chat) 의 workspace 의존까지 설치 —
# build:widget 이 두 패키지를 빌드하므로 그 deps(next·tsc·esbuild 등)가 필요하다.
RUN pnpm install --frozen-lockfile \
    --filter "frontend..." \
    --filter "channel-web-chat..." \
    --filter "@workflow/web-chat..."

# ---------- builder: next build with output: 'standalone' ----------
FROM deps AS builder
WORKDIR /app

# NEXT_PUBLIC_* are baked into the client bundle at build time.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_TELEMETRY_DISABLED=1

# 위젯 SPA 소스(web-chat-sdk 소스는 deps 의 `COPY codebase/packages` 로 이미 존재).
COPY codebase/channel-web-chat ./codebase/channel-web-chat
COPY codebase/frontend ./codebase/frontend
# 동봉 위젯 산출(public/_widget) → 이어지는 next build 가 public 을 standalone 에 포함.
RUN pnpm --filter frontend build:widget
RUN pnpm --filter frontend build

# ---------- runner: minimal standalone server ----------
FROM node:24-alpine AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3012
ENV HOSTNAME=0.0.0.0
WORKDIR /app

# standalone output 의 트레이싱 루트는 pnpm workspace 루트(= 컨테이너의 /app).
# node-linker=isolated 라 트레이서(@vercel/nft)가 .pnpm 가상 스토어의 실제 파일과
# codebase/packages/* symlink 를 따라가 필요한 node_modules 파일 + codebase/frontend/server.js
# + codebase/packages/* 를 standalone 에 포함한다(격리 트리에서 standalone 런너 부팅 검증 완료).
COPY --from=builder --chown=node:node /app/codebase/frontend/.next/standalone ./
COPY --from=builder --chown=node:node /app/codebase/frontend/.next/static ./codebase/frontend/.next/static
COPY --from=builder --chown=node:node /app/codebase/frontend/public ./codebase/frontend/public

USER node
EXPOSE 3012
CMD ["node", "codebase/frontend/server.js"]
