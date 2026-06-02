# .claude/test-stages.sh — 프로젝트별 테스트 단계 정의.
#
# 본 파일을 `cp .claude/test-stages.sh.example .claude/test-stages.sh` 로 복사한 뒤
# 프로젝트에 맞게 채우세요. `.claude/tools/run-test.sh` 가 source 합니다.
#
# 각 함수는 직접 명령을 실행하고 exit code 를 반환합니다. stdout/stderr 는 wrapper 가
# 잡아서 디스크에 저장하므로 자유롭게 작성하면 됩니다.

# lint/unit/build 는 backend + frontend 양쪽을 모두 실행한다.
# 한쪽만 돌리면 cross-stack 회귀가 누락된다 (예: PR-E3 의 i18n drawer
# t.x.y → t("x.y") 타입 오류가 backend-only 검증으로 빠져나가 0f05d3e5
# 핫픽스가 필요했다). 단일 wrapper 호출이 양쪽을 모두 커버하도록 묶어 둔다.
# web-chat 위젯 SPA(channel-web-chat) + SDK(packages/web-chat-sdk) 는 backend/frontend 의 file:dep 에
# 묶이지 않은 **독립 패키지**라 별도 install 이 필요하다. harness 가 매번 install 하지 않으므로 stage
# 진입 시 node_modules 부재면 npm ci 로 보충(install 순서를 backend/frontend 와 분리 — followup #7).
_ensure_web_chat_deps() {
  ( cd codebase/packages/web-chat-sdk && { [ -d node_modules ] || npm ci; } ) && \
  ( cd codebase/channel-web-chat && { [ -d node_modules ] || npm ci; } )
}

cmd_lint() {
  (cd codebase/backend && npx eslint "{src,apps,libs,test}/**/*.ts" --fix) && \
  (cd codebase/frontend && npm run lint) && \
  _ensure_web_chat_deps && \
  (cd codebase/packages/web-chat-sdk && npm run lint) && \
  (cd codebase/channel-web-chat && npm run lint)
}

cmd_unit() {
  (cd codebase/backend && npm test) && \
  (cd codebase/frontend && npm test) && \
  _ensure_web_chat_deps && \
  (cd codebase/packages/web-chat-sdk && npm test) && \
  (cd codebase/channel-web-chat && npm test)
}

cmd_build() {
  (cd codebase/backend && npm run build) && \
  (cd codebase/frontend && npm run build) && \
  _ensure_web_chat_deps && \
  (cd codebase/packages/web-chat-sdk && npm run build) && \
  (cd codebase/channel-web-chat && npm run build) && \
  _cmd_build_docker_images
}

# Dockerfile 자체의 monorepo packages COPY 누락 회귀 차단 — PR #311 hotfix 의 재발 방지.
# In-process `npm run build` 는 local node_modules 에 file:dep 가 link 돼 있어 통과하지만,
# docker context 안의 `npm ci` 는 packages/* 가 COPY 안 됐을 때 file:dep resolve 실패 → deploy
# 시점에 회귀. 본 단계가 사전 차단.
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
