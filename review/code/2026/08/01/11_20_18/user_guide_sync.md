# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 절차

1. `.claude/config/doc-sync-matrix.json` (rows 22개) 을 Read — `new-node` / `node-schema-change` /
   `new-ui-string` / `new-widget-chrome-string` / `integration-provider-change` /
   `new-userguide-section-dir` / `backend-api-change` / `new-bullmq-queue` / `new-warning-code` /
   `new-error-code` / `new-cross-cutting-enum` / `new-backend-ui-zod-value` /
   `new-handler-output-field` / `auth-session-flow-change` / `auth-config-type-enum-change` /
   `expression-language-change` / `run-debug-flow-change` / `env-runtime-change` /
   `spec-major-change` / `userguide-gui-flow-section` / `spec-defect-found`.
2. `PROJECT.md` §변경 유형 → 갱신 위치 매핑 (L116~) 을 보조로 확인 — 매트릭스 trigger 표면은
   전부 `codebase/backend`, `codebase/frontend`, `codebase/channel-web-chat`, `spec/`,
   `README.md` 로 한정된다.
3. 변경 파일 목록을 `git status --short` + `git diff --name-only HEAD` 로 재확인:
   - `.claude/tests/README.md`
   - `.claude/tests/test_review_gate_ci.py`
   - `.github/workflows/harness-checks.yml`
   - `.github/workflows/review-gate.yml`
   - `plan/in-progress/harness-review-gate-ci-backstop.md`
   - `scripts/check-review-gate.py`

## 매칭 결과

6개 파일 전부 `.claude/`, `.github/workflows/`, `scripts/`, `plan/in-progress/` 아래이며 `codebase/**`,
`spec/**`, `README.md` 어디에도 속하지 않는다. 매트릭스의 22개 trigger 는 전부 위 다섯 루트
(`codebase/backend`, `codebase/frontend`, `codebase/channel-web-chat`, `spec/`, `README.md`) 를
glob 또는 semantic 대상으로 삼으므로, 이번 변경 set 은 그중 어느 trigger 에도 매칭되지 않는다.

이번 변경의 본질은 로컬 push 훅이 쓰는 `git push` 탐지 정규식과 독립적으로, GitHub PR 이벤트를
트리거로 삼아 **같은** `review_guard.evaluate_review()` 를 호출하는 CI 백스톱(`review-gate.yml` +
`scripts/check-review-gate.py`)을 관측 모드로 신설하는 것이다. 노드 정의·프론트엔드 UI 문자열·
i18n dict·`backend-labels.ts`·docs MDX·표현식 언어·인증 흐름·spec 본문 어느 것도 건드리지 않는다.
`.claude/tests/README.md` 의 카탈로그 갱신도 harness 자체 테스트 문서(`test_review_gate_ci.py` 추가
행)이며 유저 가이드 문서 체계와 무관하다.

## 발견사항

없음. 매칭되는 trigger 가 없어 동반 갱신 누락을 검출할 대상 자체가 없다.

## 요약

매트릭스 trigger 22개 중 매칭 0건 — 변경 6개 파일이 전부 `.claude/`·`.github/workflows/`·
`scripts/`·`plan/in-progress/` 범위이며 매트릭스가 감시하는 `codebase/**`·`spec/**`·`README.md`
어디에도 속하지 않는다. 유저 가이드 동반 갱신 관점에서 검토할 변경이 없으므로 "해당 없음".

## 위험도

NONE
