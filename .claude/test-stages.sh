# .claude/test-stages.sh — 프로젝트별 테스트 단계 정의.
#
# 본 파일을 `cp .claude/test-stages.sh.example .claude/test-stages.sh` 로 복사한 뒤
# 프로젝트에 맞게 채우세요. `.claude/tools/run-test.sh` 가 source 합니다.
#
# 각 함수는 직접 명령을 실행하고 exit code 를 반환합니다. stdout/stderr 는 wrapper 가
# 잡아서 디스크에 저장하므로 자유롭게 작성하면 됩니다.

# lint/unit/build 는 backend + frontend + web-chat 전부 실행한다.
# 한쪽만 돌리면 cross-stack 회귀가 누락된다 (예: PR-E3 의 i18n drawer
# t.x.y → t("x.y") 타입 오류가 backend-only 검증으로 빠져나가 0f05d3e5
# 핫픽스가 필요했다). 단일 wrapper 호출이 전부를 커버하도록 묶어 둔다.
#
# pnpm workspace 전환으로, 이전의 패키지별 `npm ci`/per-package install·web-chat
# 특수처리(_ensure_web_chat_deps)는 단일 `pnpm install` 로 수렴한다. 내부 패키지
# dist 는 각 패키지 `prepare`(tsc)가 install 중 자동 빌드하므로 별도 빌드 단계 불필요
# (새 worktree 의 수동 node_modules/dist 준비 레시피도 폐기됨).
_ensure_deps() {
  [ -d node_modules ] || pnpm install --frozen-lockfile
}

cmd_lint() {
  _ensure_deps && \
  pnpm --filter backend lint && \
  pnpm --filter frontend lint && \
  pnpm --filter @workflow/web-chat lint && \
  pnpm --filter channel-web-chat lint
}

cmd_unit() {
  _ensure_deps && \
  pnpm --filter backend test && \
  pnpm --filter frontend test && \
  pnpm --filter @workflow/web-chat test && \
  pnpm --filter channel-web-chat test
}

cmd_build() {
  _ensure_deps && \
  pnpm --filter backend build && \
  pnpm --filter frontend build && \
  pnpm --filter @workflow/web-chat build && \
  pnpm --filter channel-web-chat build && \
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
  echo "[build:docker] frontend Dockerfile build 검증" && \
  docker build -q \
    -f codebase/frontend/Dockerfile \
    --build-arg NEXT_PUBLIC_API_URL=http://localhost:3011/api \
    --build-arg NEXT_PUBLIC_WS_URL=http://localhost:3011 \
    -t clemvion-build-check/frontend:latest .
}

cmd_e2e() {
  make e2e-test
}

# run-test.sh 워치독이 e2e 스테이지를 timeout 으로 강제 종료할 때 호출된다.
# `make e2e-test` 는 마지막에 `make e2e-down` 으로 컨테이너·볼륨을 내리는데,
# runner 가 hang 한 채 KILL 되면 그 후행 down 이 실행되지 못해 dockerd 에 orphan
# 컨테이너·볼륨이 남는다. 본 훅이 현재 worktree 의 compose project 를 정리한다.
on_timeout_e2e() {
  make e2e-down
}
