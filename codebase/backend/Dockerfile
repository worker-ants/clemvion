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
COPY codebase/packages/ai-end-reason/package.json ./codebase/packages/ai-end-reason/
COPY codebase/packages/expression-engine/package.json ./codebase/packages/expression-engine/
COPY codebase/packages/node-summary/package.json ./codebase/packages/node-summary/
COPY codebase/packages/chat-channel-validation/package.json ./codebase/packages/chat-channel-validation/
COPY codebase/packages/graph-warning-rules/package.json ./codebase/packages/graph-warning-rules/
COPY codebase/packages/sdk/package.json ./codebase/packages/sdk/
COPY codebase/packages/web-chat-sdk/package.json ./codebase/packages/web-chat-sdk/

# 내부 패키지 소스 — 각 패키지의 `prepare`(tsc)가 install 중 dist 를 빌드하는 데
# 필요하다 (이전의 패키지별 `npm ci && npm run build` 단계를 대체). **backend closure
# (= @workflow 4개)만** COPY 한다 — sdk·web-chat-sdk(프런트 전용, backend 미의존)를 제외해
# 그 패키지 소스 변경이 backend 이미지 빌드 캐시를 무효화하지 않게 한다. manifest 는 위에서
# 전부 COPY 했으므로 `--frozen-lockfile` 검증에는 영향 없다. (신규 backend 의존 내부 패키지
# 추가 시 여기에 COPY 를 보충 — 누락 시 build 스테이지 docker 검증이 포착.)
COPY codebase/packages/ai-end-reason ./codebase/packages/ai-end-reason
COPY codebase/packages/expression-engine ./codebase/packages/expression-engine
COPY codebase/packages/node-summary ./codebase/packages/node-summary
COPY codebase/packages/chat-channel-validation ./codebase/packages/chat-channel-validation
COPY codebase/packages/graph-warning-rules ./codebase/packages/graph-warning-rules

# backend + 그 workspace 의존(`...`)만 설치. native(bcrypt/isolated-vm)는
# onlyBuiltDependencies 허용 목록에 따라 컴파일된다.
RUN pnpm install --frozen-lockfile --filter "backend..."

# ---------- builder: compile backend TypeScript ----------
FROM deps AS builder
WORKDIR /app
COPY codebase/backend ./codebase/backend
RUN pnpm --filter backend build

# ---------- deploy: self-contained production bundle (backend prod deps only) ----------
# `.npmrc` node-linker=isolated 라 deps/builder 스테이지의 `--filter "backend..."` 설치는
# 이미 backend closure 만 격리한다(hoisted 시절 프런트 스택이 flat 트리로 잔존하던 문제는
# 링커 차원에서 해소). deploy 는 그 위에서 (1) devDeps 를 prune 하고 (2) 내부 @workflow/*
# 를 주입한 self-contained 디렉터리를 만들어 runner 가 워크스페이스 밖 산출물만 COPY 하게 한다.
#   - `--prod`  : devDeps(jest/eslint/ts 등) 제외.
#   - injected deploy(비-legacy): pnpm-workspace.yaml 의 `injectWorkspacePackages: true`
#                 로 활성. 내부 @workflow/* 를 injected copy 로 주입하고, 격리(isolated)
#                 node_modules 로 **패키지별 버전을 올바로 해소**한다. legacy(flat) deploy
#                 는 backend 직접 의존 cron-parser@^5.5.0 을 bullmq 전이 4.9.0 으로 잘못
#                 collapse 해 schedule 이 깨졌다(유효 cron 도 400) — 그래서 injected 사용.
#   - target(/prod/backend) 은 워크스페이스(/app) 밖이어야 한다.
# native(bcrypt/isolated-vm)는 install 시 재컴파일된다(빌드툴은 deps 스테이지). CI=true.
FROM builder AS deploy
WORKDIR /app
RUN CI=true pnpm --filter=backend deploy --prod /prod/backend

# ---------- runner: runtime ----------
# 프로덕션에 필요한 것만 선별 COPY — deploy 산출 node_modules(prune·@workflow 주입,
# 프런트 스택 없음) + builder 산출 dist(컴파일 결과) + package.json. deploy 디렉터리에
# 남는 원본 src/test 잡동사니는 이 stage 로 넘어오지 않는다. WORKDIR·경로 계약
# (/app/codebase/backend)은 compose·운영 참조 호환을 위해 그대로 둔다.
FROM node:24-alpine AS runner
ENV NODE_ENV=production
RUN corepack enable
WORKDIR /app/codebase/backend
COPY --from=deploy --chown=node:node /prod/backend/node_modules ./node_modules
COPY --from=deploy --chown=node:node /prod/backend/package.json ./package.json
COPY --from=builder --chown=node:node /app/codebase/backend/dist ./dist

USER node
EXPOSE 3011
CMD ["node", "dist/main"]
