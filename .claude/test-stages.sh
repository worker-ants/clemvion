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
cmd_lint() {
  (cd codebase/backend && npx eslint "{src,apps,libs,test}/**/*.ts" --fix) && \
  (cd codebase/frontend && npm run lint)
}

cmd_unit() {
  (cd codebase/backend && npm test) && \
  (cd codebase/frontend && npm test)
}

cmd_build() {
  (cd codebase/backend && npm run build) && \
  (cd codebase/frontend && npm run build)
}

cmd_e2e() {
  make e2e-test
}
