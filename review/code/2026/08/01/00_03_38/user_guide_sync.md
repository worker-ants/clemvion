# User Guide Sync Review — harness-block-backstop-b56163

## 검토 절차 요약

1. `.claude/config/doc-sync-matrix.json` Read — `rows[]` 21건 확인 (new-node, node-schema-change, new-ui-string, new-widget-chrome-string, integration-provider-change, new-userguide-section-dir, backend-api-change, new-bullmq-queue, new-warning-code, new-error-code, new-cross-cutting-enum, new-backend-ui-zod-value, new-handler-output-field, auth-session-flow-change, auth-config-type-enum-change, expression-language-change, run-debug-flow-change, env-runtime-change, spec-major-change, userguide-gui-flow-section, spec-defect-found).
2. 변경 파일 목록 확보 — prompt 에 첨부된 6개 파일(`.claude/_shared/block_integrity.py`, `.claude/_shared/retry_state.py`, `.claude/agents/consistency-summary.md`, `.claude/hooks/_lib/review_guard.py`, `.claude/hooks/guard_review_before_push.py`, `.claude/hooks/guard_review_before_stop.py`) + `git diff --name-only origin/main...HEAD` 로 전체 change set 보강.
3. `git diff --name-only origin/main...HEAD` 전체 결과:

```
.claude/_shared/block_integrity.py
.claude/_shared/retry_state.py
.claude/agents/consistency-summary.md
.claude/hooks/_lib/review_guard.py
.claude/hooks/guard_review_before_push.py
.claude/hooks/guard_review_before_stop.py
.claude/skills/code-review-agents/scripts/code_review_orchestrator.py
.claude/skills/consistency-checker/SKILL.md
.claude/skills/consistency-checker/scripts/consistency_orchestrator.py
.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py
.claude/tests/README.md
.claude/tests/test_block_integrity.py
.claude/tests/test_retry_state_shared.py
plan/in-progress/harness-review-gate-ci-backstop.md
```

`git status --short` (untracked) 은 `review/code/2026/07/31/**`, `review/code/2026/08/**` 산출물 디렉토리만 — 리뷰 세션 아티팩트이며 `codebase/`·`spec/` 와 무관.

## 매칭 판정

매트릭스 21행의 trigger 는 전부 다음 중 하나에 anchor 되어 있다:
- glob: `codebase/backend/src/nodes/**`, `codebase/frontend/src/**/*.tsx`, `codebase/channel-web-chat/src/**/*.tsx`, `codebase/frontend/src/content/docs/*/`, `codebase/backend/src/**/*.controller.ts`, `codebase/backend/src/**/dto/**`, `codebase/backend/src/modules/system-status/system-status.constants.ts`, `codebase/backend/src/nodes/core/error-codes.ts`, `codebase/frontend/src/content/docs/02-nodes/**.mdx`, `codebase/frontend/src/content/docs/06-integrations-and-config/**.mdx`, `spec/2-*/**`~`spec/5-*/**`, `spec/conventions/**`
- semantic: `codebase/backend/src/modules/auth/**`, `codebase/packages/expression-engine/**`, backend warningRules/AuthConfig/handler output field/cross-cutting enum (모두 `codebase/backend` 또는 `spec/` 내부 의미 판단)

이번 변경 set 은 **전부 `.claude/**` (harness 도구·hook·sub-agent 정의·테스트) 와 `plan/in-progress/**` (작업 추적 문서) 뿐**이며, `git diff --name-only origin/main...HEAD | grep -E '^codebase/|^spec/'` 결과가 공집합임을 확인했다. 즉 매트릭스 21행 중 어느 trigger 도 이번 change set 의 파일과 glob/semantic 매칭이 성립하지 않는다:

- 노드 추가/스키마 변경 — `codebase/backend/src/nodes/**` 변경 없음
- UI 문자열/i18n parity — `codebase/frontend/src/**/*.tsx` 변경 없음
- 통합/제공자 변경 — `codebase/*/integrations` 관련 코드 변경 없음
- 신규 유저가이드 섹션 디렉토리 — `codebase/frontend/src/content/docs/*/` 변경 없음
- 인증·권한·세션 흐름 — `codebase/backend/src/modules/auth/**` 변경 없음 (수정된 `.claude/hooks/guard_review_before_push.py` 등은 **개발 워크플로 하네스의 push 가드**이지 제품 인증·세션 로직이 아님 — 오탐 방지)
- 표현식 언어 — `codebase/packages/expression-engine/**` 변경 없음
- 실행·디버깅 흐름 — `codebase/backend` 실행 엔진/디버그 로깅 변경 없음 (harness 의 `review/consistency` 세션 재시도·게이트 로직은 제품의 실행·디버깅 기능이 아님)
- 신규 warning/error code — `codebase/backend` warningRules·`error-codes.ts` 변경 없음
- spec 대규모 변경 — `spec/**` 변경 없음

## 회색지대 검토 (오탐 방지 확인)

다음은 표면적으로 "실행/재시도/게이트"라는 단어 때문에 §8(실행·디버깅 흐름 변경) 또는 §6(인증·권한·세션 흐름 변경) trigger 로 오인될 수 있어 개별 확인했다:

- `retry_state.py` 의 "retry" — 이는 **AI 리뷰 sub-agent 재시도 상태 관리**(`_retry_state.json`: pending/success/fatal 버킷)이며, 제품의 워크플로우 실행 엔진(백엔드 노드 실행·재시도)과 무관. `codebase/backend` 실행 엔진 코드가 아니라 `.claude/` 개발 하네스 코드.
- `guard_review_before_push.py` / `guard_review_before_stop.py` 의 "gate/block" — git push 전·turn 종료 전 **리뷰 완료 여부**를 확인하는 하네스 훅이며, 제품의 인증·권한·세션 미들웨어가 아님.
- `consistency-summary.md` 의 "BLOCK: YES/NO" — 일관성 검토 에이전트의 판정 포맷이며 제품 코드/문서와 무관.

이상 모두 매트릭스 trigger 의 "인증·권한·세션" 또는 "실행·디버깅" 이 가리키는 대상(제품 백엔드 코드)이 아니라 **개발 워크플로 자동화(harness) 자체**이므로 매칭되지 않는다고 판단.

## 발견사항

없음 — 매트릭스 21행 중 매칭된 trigger 0건.

## 요약

이번 변경 set(`.claude/_shared/*.py`, `.claude/hooks/*.py`, `.claude/agents/consistency-summary.md`, `.claude/skills/**/scripts/*.py`, `.claude/tests/*.py`, `plan/in-progress/harness-review-gate-ci-backstop.md`)은 AI 코드 리뷰/일관성 검토 orchestrator 의 재시도 상태 공유화(`_shared/retry_state.py` 추출) 및 리뷰 하향 감지 backstop(`block_integrity.py`) 등 **개발 워크플로 하네스 내부 개선**으로, `codebase/`(backend nodes·frontend docs·i18n dict·auth·expression-engine) 및 `spec/` 어디에도 파일 변경이 없다. `doc-sync-matrix.json` 의 21개 trigger 행은 모두 제품 코드(`codebase/**`) 또는 spec 경로에 anchor 되어 있어 하나도 매칭되지 않았으며, 따라서 유저 가이드(docs MDX)·i18n dict·backend-labels.ts 동반 갱신 대상이 존재하지 않는다. 본 리뷰어 영역과 완전히 무관한 변경으로 판단.

## 위험도

NONE
