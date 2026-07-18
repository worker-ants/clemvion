# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재
- SSOT: `.claude/config/doc-sync-matrix.json` (`rows[]` 20건) Read 완료.
- 보조: `PROJECT.md` §변경 유형 → 갱신 위치 매핑 (L116–272) Read 완료 — 표 20행과 JSON 20행 1:1 확인.

## 변경 파일 컨텍스트
prompt 에 포함된 7개 파일 + `git diff origin/main...HEAD --name-only` (실제 worktree `harness-guard-followups-f7140c`) 로 보강한 전체 changeset:

- `.claude/hooks/_lib/mermaid_lint_ready.py`
- `.claude/hooks/lint_mermaid_posttooluse.py`
- `.claude/tests/README.md`
- `.claude/tests/test_bootstrap_mermaid_install.py`
- `.claude/tests/test_mermaid_lint_ready.py`
- `.claude/tools/bootstrap-session.sh`
- `.githooks/pre-commit`
- `.github/workflows/harness-checks.yml`
- `.gitignore` (mermaid-lint install lock 디렉토리 ignore 패턴 1줄 추가)
- `plan/in-progress/harness-guard-followups.md`
- `review/code/2026/07/17/20_06_45/**`, `review/code/2026/07/18/00_59_56/**` (선행 리뷰 세션 산출물)

## 매칭 결과
매트릭스 20개 trigger 전체를 순회해 각 변경 파일과 대조했다. 매칭되는 trigger 가 하나도 없다.

- **glob trigger** (`new-node`/`node-schema-change`: `codebase/backend/src/nodes/**`, `new-userguide-section-dir`: `codebase/frontend/src/content/docs/*/`, `new-bullmq-queue`: `system-status.constants.ts`, `new-error-code`: `error-codes.ts`, `spec-major-change`: `spec/{2,3,4,5}-*/**`, `spec/conventions/**`) — 이번 changeset 은 `codebase/`, `spec/` 를 전혀 건드리지 않는다. 전부 `.claude/`, `.githooks/`, `.github/`, `plan/`, `review/`, `.gitignore` 범위.
- **semantic trigger** (`new-ui-string`, `new-widget-chrome-string`, `integration-provider-change`, `auth-session-flow-change`, `auth-config-type-enum-change`, `expression-language-change`, `run-debug-flow-change`, `env-runtime-change`, `new-warning-code`, `new-cross-cutting-enum`, `new-backend-ui-zod-value`, `new-handler-output-field`, `userguide-gui-flow-section`, `backend-api-change`) — 의미 판단으로도 매칭 없음:
  - `auth-session-flow-change` 는 `codebase/backend/src/modules/auth/**`(제품 인증·세션) 대상이다. 이번 변경의 "branch guard"(`.githooks/pre-commit` 1번 가드)는 **git 커밋 정책**(default-branch 차단)이지 제품의 인증·권한·세션 흐름이 아니다 — 동음이의 매칭 함정, 실제로는 무관.
  - `run-debug-flow-change` 는 backend 실행 엔진·디버그 로깅(제품 워크플로 실행/디버그 기능) 대상이다. 이번 변경은 CI/git-hook 인프라(mermaid lint, 세션 bootstrap)로 제품의 run/debug 기능과 무관.
  - `env-runtime-change` (targets: `README.md`) 는 제품의 환경 변수·기동 방법 변경을 대상으로 한다. `.gitignore` 에 `mermaid-lint` 설치 락 디렉토리 무시 패턴 1줄이 추가됐지만, 이는 harness 도구의 임시 락 파일이지 제품 런타임/기동 방법이 아니다 — README.md 갱신 대상 아님.
  - 나머지(new-ui-string 이하) 는 대상 경로(`codebase/frontend/src/**/*.tsx`, `codebase/channel-web-chat/**`, `codebase/packages/expression-engine/**`, provider 코드, warning/error rule, cross-cutting enum, backend zod ui 값, handler output field, controller/dto, docs MDX)에 해당하는 변경이 changeset 에 전혀 없다.

## 발견사항
없음. (해당 없음)

## 요약
매트릭스 20개 trigger 전부를 이번 changeset(`.claude/tools/bootstrap-session.sh`, mermaid-lint PostToolUse 훅 + 공유 readiness 모듈, `.githooks/pre-commit`, `.github/workflows/harness-checks.yml`, harness 단위 테스트 2건, `.gitignore`, plan 문서)과 대조한 결과 **매칭 0건**이다. 이번 변경은 전부 `.claude/` harness 자동화 계층(세션 부트스트랩·git hook·CI·해당 단위 테스트)에 국한되며 `codebase/backend/src/nodes`, `codebase/frontend` UI/문서/i18n, `codebase/packages/expression-engine`, 제품 auth 모듈, `spec/` 등 매트릭스가 감시하는 어떤 경로도 건드리지 않는다. "인증·권한·세션 흐름 변경"·"실행·디버깅 흐름 변경"·"환경 변수·런타임 변경" 3개 semantic trigger 는 표현만 유사할 뿐(git 커밋 정책 가드, CI/lint 인프라, harness 도구 gitignore) 대상이 제품 기능이 아니므로 오탐 없이 제외했다. 유저 가이드 동반 갱신 관점에서 조치 불필요.

## 위험도
NONE
