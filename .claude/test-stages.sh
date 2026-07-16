# .claude/test-stages.sh — 프로젝트별 테스트 단계 정의.
#
# 본 파일을 `cp .claude/test-stages.sh.example .claude/test-stages.sh` 로 복사한 뒤
# 프로젝트에 맞게 채우세요. `.claude/tools/run-test.sh` 가 source 합니다.
#
# 각 함수는 직접 명령을 실행하고 exit code 를 반환합니다. stdout/stderr 는 wrapper 가
# 잡아서 디스크에 저장하므로 자유롭게 작성하면 됩니다.

# lint/unit/build 는 backend + frontend + web-chat + 내부 공유 packages(INTERNAL_PACKAGES) 전부 실행한다.
# 한쪽만 돌리면 cross-stack 회귀가 누락된다 (예: PR-E3 의 i18n drawer
# t.x.y → t("x.y") 타입 오류가 backend-only 검증으로 빠져나가 0f05d3e5
# 핫픽스가 필요했다). 단일 wrapper 호출이 전부를 커버하도록 묶어 둔다.
#
# pnpm workspace 전환으로, 이전의 패키지별 `npm ci`/per-package install·web-chat
# 특수처리(_ensure_web_chat_deps)는 단일 `pnpm install` 로 수렴한다. 내부 패키지
# dist 는 각 패키지 `prepare`(tsc)가 install 중 자동 빌드하므로 별도 빌드 단계 불필요
# (새 worktree 의 수동 node_modules/dist 준비 레시피도 폐기됨).
_ensure_deps() {
  # workspace 루트 기준으로 확인 (CWD 가 어디든 stale 설치 건너뛰지 않도록).
  [ -d "$(git rev-parse --show-toplevel)/node_modules" ] || pnpm install --frozen-lockfile
}

# lint/unit/build 를 균일하게 도는 내부 공유 패키지 (backend·frontend·web-chat·channel-web-chat 처럼
# 특수 스텝이 없는 것). 단일 목록으로 cmd_lint/cmd_unit/cmd_build 3곳의 drift 를 방지한다.
INTERNAL_PACKAGES=(
  "@workflow/sdk"
  "@workflow/expression-engine"
  "@workflow/graph-warning-rules"
  "@workflow/node-summary"
  "@workflow/chat-channel-validation"
)

# 내부 공유 패키지 전체에 한 스테이지(lint/test/build)를 순차 실행 — 하나라도 실패 시 즉시 비제로.
_run_internal() {
  local stage="$1" pkg
  for pkg in "${INTERNAL_PACKAGES[@]}"; do
    pnpm --filter "$pkg" "$stage" || return 1
  done
}

cmd_lint() {
  _ensure_deps && \
  pnpm --filter backend lint && \
  pnpm --filter frontend lint && \
  pnpm --filter @workflow/web-chat lint && \
  _run_internal lint && \
  pnpm --filter channel-web-chat lint
}

cmd_unit() {
  _ensure_deps && \
  pnpm --filter backend test && \
  pnpm --filter frontend test && \
  pnpm --filter @workflow/web-chat test && \
  pnpm --filter channel-web-chat test && \
  _run_internal test
}

cmd_build() {
  _ensure_deps && \
  pnpm --filter backend build && \
  pnpm --filter frontend build && \
  pnpm --filter @workflow/web-chat build && \
  pnpm --filter channel-web-chat build && \
  pnpm --filter channel-web-chat typecheck && \
  _run_internal build && \
  _cmd_build_docker_images
}

# Dockerfile 자체의 monorepo packages COPY 누락 회귀 차단 — PR #311 hotfix 의 재발 방지.
# In-process `pnpm --filter <app> build` 는 workspace 가 이미 link 돼 있어 통과하지만,
# docker context 안의 `pnpm install --frozen-lockfile` 은 workspace manifest/packages 가
# COPY 안 됐을 때 resolve 실패 → deploy 시점에 회귀. 본 단계가 사전 차단.
#
# NEXT_PUBLIC_* 는 dummy build-arg (build-time baking 만 검증, deploy 는 실 값 주입).
# tag 는 throwaway (`clemvion-build-check/*:latest`) — 외부 registry push 없음.
_cmd_build_docker_images() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "[build:docker] docker CLI 미설치 — Dockerfile build 검증 skip (INFRA_NOT_AVAILABLE)"
    return 0
  fi
  if ! docker info >/dev/null 2>&1; then
    echo "[build:docker] docker daemon 미가용 — Dockerfile build 검증 skip (INFRA_NOT_AVAILABLE)"
    return 0
  fi
  echo "[build:docker] backend Dockerfile build 검증"
  docker build -q -f codebase/backend/Dockerfile -t clemvion-build-check/backend:latest . && \
  _cmd_backend_image_hygiene_smoke && \
  echo "[build:docker] frontend Dockerfile build 검증" && \
  docker build -q \
    -f codebase/frontend/Dockerfile \
    --build-arg NEXT_PUBLIC_API_URL=http://localhost:3011/api \
    --build-arg NEXT_PUBLIC_WS_URL=http://localhost:3011 \
    -t clemvion-build-check/frontend:latest .
}

# backend 프로덕션 이미지 위생 스모크 — 이 이미지가 "조용히 나빠지는" 회귀를 CI 가드로 고정한다.
# 이 클래스 회귀(구 runner 가 hoisted flat tree 통째 COPY → 프런트/테스트 스택 600MB+·backend
# 원본 src 잔존; legacy deploy 가 직접 의존 버전을 전이 버전으로 collapse)는 지금껏 ai-review 로만
# 잡혔지 CI 로 걸린 적이 없다. runner WORKDIR=/app/codebase/backend. typescript/ts-node 는 prod
# closure 에 정상 포함되므로 assert 대상이 아니다 — 순수 프런트/테스트 스택만 부재 검증한다.
_cmd_backend_image_hygiene_smoke() {
  local img=clemvion-build-check/backend:latest
  echo "[build:docker] backend 프로덕션 이미지 위생 스모크"
  docker run --rm --entrypoint sh "$img" -c '
    cd /app/codebase/backend || exit 1
    for d in jest next @next three playwright-core; do
      [ -d "node_modules/$d" ] && { echo "  누출: node_modules/$d (프런트/테스트 스택이 프로덕션 이미지에 잔존)"; exit 1; }
    done
    [ -f dist/main.js ] || { echo "  부재: dist/main.js (부팅 엔트리 누락)"; exit 1; }
  ' || return 1
  # 직접 의존 cron-parser 가 v5(backend ^5.5.0)로 올바로 해소됐는지 — bullmq 전이 4.9.0 으로의
  # collapse(legacy deploy 회귀) 를 가드한다. CronExpressionParser 는 v5 전용 export.
  docker run --rm --entrypoint node "$img" \
    -e 'process.exit(require("cron-parser").CronExpressionParser?0:1)' \
    || { echo "  cron-parser v5 API 부재 — backend 직접 의존이 전이 버전으로 오해소(legacy deploy 회귀)"; return 1; }
  echo "  ok: 프런트/테스트 스택 부재 · dist/main.js 존재 · cron-parser v5 해소"
}

# `e2e-test`(backend only) 가 아니라 `e2e-test-full`(backend + playwright) 을 부른다.
#
# 근거: CI 는 `e2e-backend` 잡이 `make e2e-test`, `e2e-frontend` 잡이 `make e2e-test-full` 로
# **playwright 를 반드시 돌린다**(.github/workflows/e2e.yml). 여기서 `e2e-test` 만 부르면
# TEST WORKFLOW 의 e2e 단계가 `status=PASS` 여도 **로컬에선 브라우저 테스트가 한 번도
# 실행되지 않아** CI 에서야 프론트 회귀가 드러난다 — 로컬/CI 커버리지 불일치.
# 실제로 사이드바 `/docs` slug 무한 중첩 회귀(2026-07-17)가 이 갭에서 나왔다: frontend
# 라우팅은 unit 이 `useParams` 를 mock 하므로 "실제 Next 라우트 매칭"·"클라이언트
# `notFound()` 실동작" 을 원리적으로 검증할 수 없어 playwright 가 유일한 검증 계층이다.
#
# 비용은 playwright 컨테이너 +~50s. `e2e-test-full` 은 backend runner 실패 시 playwright 를
# short-circuit skip 하므로(Makefile §e2e-test-full) "백엔드 깨진 상태의 노이즈 실패" 는 없다.
cmd_e2e() {
  make e2e-test-full
}

# run-test.sh 워치독이 e2e 스테이지를 timeout 으로 강제 종료할 때 호출된다.
# `make e2e-test-full` 은 마지막에 `make e2e-down` 으로 컨테이너·볼륨을 내리는데,
# runner 가 hang 한 채 KILL 되면 그 후행 down 이 실행되지 못해 dockerd 에 orphan
# 컨테이너·볼륨이 남는다. 본 훅이 현재 worktree 의 compose project 를 정리한다.
on_timeout_e2e() {
  make e2e-down
}
