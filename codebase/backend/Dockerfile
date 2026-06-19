# Build context must be the repo root so the pnpm workspace (root manifest +
# pnpm-lock.yaml + codebase/*) is reachable.
#   docker build -f codebase/backend/Dockerfile -t clemvion/backend .

# ---------- deps: install backend's workspace subtree (incl. native bcrypt/isolated-vm) ----------
# pnpm 버전은 root package.json 의 `packageManager` 필드를 corepack 이 따른다
# (이전의 "node:24 = npm 11 lockfile 정합" 근거는 pnpm 전환으로 불필요).
FROM node:24-alpine AS deps
RUN apk add --no-cache python3 make g++
RUN corepack enable
WORKDIR /app

# Workspace anchor + 단일 lockfile. --frozen-lockfile 검증을 위해 모든 workspace
# manifest 가 존재해야 하므로 package.json(작음)을 먼저 전부 복사한다.
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

# 내부 패키지 소스 — 각 패키지의 `prepare`(tsc)가 install 중 dist 를 빌드하는 데
# 필요하다 (이전의 패키지별 `npm ci && npm run build` 단계를 대체).
COPY codebase/packages ./codebase/packages

# backend + 그 workspace 의존(`...`)만 설치. native(bcrypt/isolated-vm)는
# onlyBuiltDependencies 허용 목록에 따라 컴파일된다.
RUN pnpm install --frozen-lockfile --filter "backend..."

# ---------- builder: compile backend TypeScript ----------
FROM deps AS builder
WORKDIR /app
COPY codebase/backend ./codebase/backend
RUN pnpm --filter backend build

# ---------- runner: runtime ----------
# 빌드된 workspace 전체를 그대로 옮긴다. node-linker=hoisted 라 node_modules 는
# flat(심링크 dangling 없음)이고, 내부 @workflow/* 는 codebase/packages/* 의 built
# dist 로 해소된다. (devDeps 까지 포함 — 이미지 크기 최적화는 후속 과제.)
FROM node:24-alpine AS runner
ENV NODE_ENV=production
RUN corepack enable
WORKDIR /app
COPY --from=builder --chown=node:node /app ./

USER node
WORKDIR /app/codebase/backend
EXPOSE 3011
CMD ["node", "dist/main"]
