# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 발견사항

(없음) — 해당 없음.

## 매트릭스 대조

`.claude/config/doc-sync-matrix.json` (`rows[]`, 22개 trigger 행) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 적재해 이번 변경 set(`git diff --name-only main...HEAD`, 33개 파일) 전체를 대조했다.

변경 파일 구성:
- `.claude/tests/README.md`, `.claude/tests/test_spec_link_checks_scope.py` — harness 테스트/문서
- `.github/workflows/spec-link-checks.yml` — CI 워크플로 설정 (docs 가드를 트리거하는 pathspec·잡 확장)
- `CHANGELOG.md`, `PROJECT.md` — 저장소 최상위 문서
- `plan/in-progress/docs-guard-trigger.md` — plan 파일
- `review/code/2026/09/24/21_16_58/**`, `review/consistency/2026/09/24/{20_34_01,21_04_26}/**` — 리뷰/consistency-check 산출물

22개 trigger 행의 glob/semantic 조건을 하나씩 확인했다:
- `new-node`/`node-schema-change` — `codebase/backend/src/nodes/**` 매칭 없음
- `new-ui-string` — `codebase/frontend/src/**/*.tsx` 매칭 없음
- `new-widget-chrome-string` — `codebase/channel-web-chat/src/**/*.tsx` 매칭 없음
- `integration-provider-change`/`userguide-gui-flow-section` — `codebase/frontend/src/content/docs/**` 매칭 없음
- `new-userguide-section-dir` — `codebase/frontend/src/content/docs/*/` 신규 디렉토리 없음
- `backend-api-change` — `*.controller.ts`/`dto/**` 매칭 없음
- `new-bullmq-queue` — `system-status.constants.ts` 매칭 없음
- `new-warning-code`/`new-error-code`/`new-backend-ui-zod-value` — backend warningRules·`error-codes.ts`·zod ui 값 변경 없음
- `auth-session-flow-change`/`auth-config-type-enum-change` — `codebase/backend/src/modules/auth/**` 매칭 없음
- `expression-language-change` — `codebase/packages/expression-engine/**` 매칭 없음
- `run-debug-flow-change` — 백엔드 실행 엔진·디버그 로깅 변경 없음
- `env-runtime-change` — 환경 변수·기동 방법 변경 없음 (`README.md` 미변경)
- `spec-major-change` — `spec/2-*~5-*`·`spec/conventions/**` 변경 없음
- `new-cross-cutting-enum`/`new-handler-output-field`/`spec-defect-found` — 해당 코드 변경 없음

이번 PR 은 CI 워크플로(`spec-link-checks.yml`)가 **어떤 소스 변경(plan/spec)에 반응해 docs 가드를 트리거하는가**를 고치는 메타 변경이다. `.github/workflows/**`, `.claude/tests/**`, `CHANGELOG.md`, `PROJECT.md`, `plan/**`, `review/**` 는 매트릭스의 22개 trigger glob/semantic 조건 어디에도 속하지 않는다 — `codebase/` 하위 프로덕션 코드(노드·i18n·auth·expression-engine·docs content 등)를 일절 건드리지 않았다. CLAUDE.md 가 명시한 대로 이번 변경은 harness/CI 전용이며, 검증도 `python3 -m pytest .claude/tests -q` 로 이미 수행됐다(RESOLUTION.md 참조) — 이는 review gate 스코프(`codebase/**`)와도 별개로 본 reviewer 영역과 무관함을 뒷받침한다.

## 요약

매트릭스 trigger 22개 중 매칭 0건, 동반 갱신 누락 0건. 변경 set 은 CI 워크플로(`spec-link-checks.yml`)의 docs-guard 트리거 스코프 확장(plan/** 추가, 파일 열거→디렉터리 실행)과 그에 딸린 harness 테스트·CHANGELOG·PROJECT.md·plan·리뷰 산출물로만 구성되어 있으며, `codebase/backend/src/nodes/**`, `codebase/frontend/src/**/*.tsx`, `content/docs/**`, `lib/i18n/**`, `packages/expression-engine/**`, `modules/auth/**` 등 유저 가이드 동반 갱신 매트릭스가 감시하는 어떤 경로도 건드리지 않는다. 해당 없음.

## 위험도

NONE
