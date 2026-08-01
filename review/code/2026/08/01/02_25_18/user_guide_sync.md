# User Guide Sync Review

## 절차 기록

1. **매트릭스 적재** — [`.claude/config/doc-sync-matrix.json`](../../../../../.claude/config/doc-sync-matrix.json) 을 Read (`rows[]` 21행: `new-node`, `node-schema-change`, `new-ui-string`, `new-widget-chrome-string`, `integration-provider-change`, `new-userguide-section-dir`, `backend-api-change`, `new-bullmq-queue`, `new-warning-code`, `new-error-code`, `new-cross-cutting-enum`, `new-backend-ui-zod-value`, `new-handler-output-field`, `auth-session-flow-change`, `auth-config-type-enum-change`, `expression-language-change`, `run-debug-flow-change`, `env-runtime-change`, `spec-major-change`, `userguide-gui-flow-section`, `spec-defect-found`). 보조로 `PROJECT.md` §변경 유형 → 갱신 위치 매핑 (116~200행, "자주 누락되는 항목" 포함) 을 Read.
2. **변경 파일 식별** — prompt 가 나열한 17개 리뷰 대상 파일 + `git diff --name-only origin/main...HEAD` 로 교차 확인. 두 목록이 일치함 (prompt 의 17개 소스 파일 + 다수의 `review/code/2026/07/31,08/01/**` 리뷰 산출물 — 이들은 코드가 아니라 과거 리뷰 세션 아티팩트이므로 매트릭스 검토 대상 아님).
3. **trigger 매칭** — 21개 행 전부에 대해 변경 파일 17개를 대조.

## 변경 파일 전수 목록 (17개, 전부 `.claude/` 또는 `plan/in-progress/`)

```
.claude/_shared/block_integrity.py
.claude/_shared/retry_state.py
.claude/agents/consistency-summary.md
.claude/hooks/_lib/failopen_state.py
.claude/hooks/_lib/review_guard.py
.claude/hooks/guard_review_before_push.py
.claude/hooks/guard_review_before_stop.py
.claude/skills/code-review-agents/scripts/code_review_orchestrator.py
.claude/skills/consistency-checker/SKILL.md
.claude/skills/consistency-checker/scripts/consistency_orchestrator.py
.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py
.claude/tests/README.md
.claude/tests/test_block_integrity.py
.claude/tests/test_consistency_orchestrator_state.py
.claude/tests/test_retry_state_shared.py
.claude/tests/test_stop_guard_failopen.py
plan/in-progress/harness-review-gate-ci-backstop.md
```

내용상으로도 이 변경은 AI 코드 리뷰/일관성 검토 하네스 자체의 내부 결함 수정이다 — 구체적으로 (1) consistency SUMMARY 의 `BLOCK:` 판정이 checker 의 `[CRITICAL]` 태그와 모순되는지 검출하는 `block_integrity.py` 백스톱, (2) 3개 orchestrator(`code_review`/`consistency`/`merge_coordinator`)가 각자 들고 있던 retry-state bookkeeping 5종을 `_shared/retry_state.py` 로 추출, (3) push/stop 두 가드 훅이 공유하는 fail-open 리포팅(`failopen_state.py`), (4) 관련 유닛테스트. 산출물 중 `plan/in-progress/harness-review-gate-ci-backstop.md` 도 이 하네스 작업 자체의 진행 기록이지 제품 spec 이 아니다.

## 매트릭스 대조 결과

21개 행의 glob/semantic trigger 를 모두 대조한 결과, 매칭되는 행이 **하나도 없다**:

| 매트릭스 trigger 대상 | 이 변경에 존재? |
|---|---|
| `codebase/backend/src/nodes/**` (신규 노드/schema 변경) | 없음 |
| `codebase/frontend/src/**/*.tsx` (신규 UI 문자열) | 없음 |
| `codebase/channel-web-chat/src/**/*.tsx` (위젯 chrome) | 없음 |
| `codebase/frontend/src/content/docs/*/` (신규 섹션 디렉토리) | 없음 |
| `codebase/backend/src/**/*.controller.ts`, `dto/**` (API 변경) | 없음 |
| `codebase/backend/src/modules/system-status/system-status.constants.ts` (BullMQ 큐) | 없음 |
| `codebase/backend/src/modules/auth/**` (인증·세션 흐름) | 없음 |
| `codebase/packages/expression-engine/**` (표현식 언어) | 없음 |
| `codebase/backend/src/nodes/core/error-codes.ts` (신규 errorCode) | 없음 |
| backend warningRules (신규 warningCode) | 없음 |
| backend zod `ui.label/hint/group/itemLabel` | 없음 |
| cross-cutting enum 값 추가 | 없음 |
| handler output field 신규 키 | 없음 |
| `spec/2-*/**, 3-*/**, 4-*/**, 5-*/**, conventions/**` (spec 대규모 변경) | 없음 (변경분은 `spec/` 가 아니라 `plan/in-progress/`) |
| `02-nodes/**.mdx`, `06-integrations-and-config/**.mdx` (GUI 흐름 절) | 없음 |
| 실행·디버깅 흐름 변경 (05-run-and-debug) | 없음 — 변경 대상은 제품의 실행 엔진이 아니라 **리뷰 하네스의 재시도/게이트 로직**이다. 이름이 유사(`retry_state`, `review_guard`)해 보일 수 있으나 이는 `.claude/` 아래의 개발 도구이지 `spec/5-run-execution` 계열이 정의하는 워크플로우 실행·디버그 기능이 아니다 |
| 환경 변수·런타임 변경 | 없음 |

## 발견사항

없음 — 매칭되는 trigger 가 없어 점검할 누락 대상 자체가 존재하지 않는다.

## 요약

매트릭스는 21개 trigger 행을 갖고 있으며, 이번 changeset(17개 파일, 전부 `.claude/_shared`·`.claude/hooks`·`.claude/skills/*/scripts`·`.claude/tests` 하네스 코드 + `plan/in-progress/` 진행 기록)은 그중 **어떤 행에도 매칭되지 않는다** — 노드 추가/schema 변경, TSX UI 문자열, 통합·제공자, 신규 섹션 디렉토리, 인증·세션 흐름, 표현식 언어, 실행·디버깅 흐름, warning/error 코드 등 매트릭스가 다루는 `codebase/**` · `spec/**` 표면이 이번 diff 에 전혀 없다. 이번 변경은 AI 코드 리뷰/일관성 검토 하네스(`review_guard`, `retry_state` 공유화, `block_integrity` BLOCK-하향 백스톱, stop/push 가드의 fail-open 리포팅 공유)에 대한 내부 결함 수정으로, 사용자 가시 제품 표면(노드 카드·가이드 MDX·i18n dict·backend-labels)을 전혀 건드리지 않는다. `git diff --name-only origin/main...HEAD` 로 재확인한 파일 목록도 prompt 의 17개 파일과 정확히 일치(+ 과거 리뷰 세션의 `review/code/**` 산출물, 코드 아님)했으므로 누락 판정은 없음.

## 위험도

NONE — 해당 없음 (매트릭스 trigger 어디에도 매칭되지 않음).
