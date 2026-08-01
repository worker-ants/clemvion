# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 발견사항

없음 — 영역 무관 ("해당 없음")

## 요약

**적재**: `.claude/config/doc-sync-matrix.json` 의 `rows[]` 20개 trigger (`new-node` / `node-schema-change` / `new-ui-string` / `new-widget-chrome-string` / `integration-provider-change` / `new-userguide-section-dir` / `backend-api-change` / `new-bullmq-queue` / `new-warning-code` / `new-error-code` / `new-cross-cutting-enum` / `new-backend-ui-zod-value` / `new-handler-output-field` / `auth-session-flow-change` / `auth-config-type-enum-change` / `expression-language-change` / `run-debug-flow-change` / `env-runtime-change` / `spec-major-change` / `userguide-gui-flow-section` / `spec-defect-found`) 를 Read, `PROJECT.md` §변경 유형 → 갱신 위치 매핑(116~272행) 본문을 nuance 보조로 Read.

**변경 파일 식별**: prompt 에 포함된 18개 리뷰 대상 파일 전체(`전체 파일 컨텍스트` 로 실린 것 + `⚠️ 프롬프트 크기 제한` 안내로 잘린 6개 — `review_guard.py` / `guard_review_before_push.py` / `code_review_orchestrator.py` / `consistency_orchestrator.py` / `tests/README.md` / `test_block_integrity.py` — 는 경로만으로도 trigger glob 매칭에 충분해 원본을 직접 Read 하지는 않았음, 근거는 아래)+ `git diff --name-only origin/main...HEAD` 로 독립 검증. 두 목록이 정확히 일치했다(추가로 `review/code/2026/07/31/**` 산출물 다수가 나왔으나 이는 과거 라운드 리뷰 산출물이고 본 라운드 "리뷰 대상 파일" 목록에는 없음 — prompt 의 명시 스코프와 일치):

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
.claude/tests/test_review_changeset_warning.py
.claude/tests/test_stop_guard_failopen.py
plan/in-progress/harness-review-gate-ci-backstop.md
```

**trigger 매칭**: 매트릭스의 glob 기반 trigger는 예외 없이 `codebase/backend/**` · `codebase/frontend/**` · `codebase/packages/expression-engine/**` · `codebase/channel-web-chat/**` · `spec/{2,3,4,5}-*/**` · `spec/conventions/**` 아래만 겨냥한다. semantic trigger(예: `integration-provider-change` · `new-warning-code` · `new-cross-cutting-enum` · `auth-session-flow-change` · `run-debug-flow-change` · `env-runtime-change`)도 전부 **제품**(codebase 의 backend/frontend 애플리케이션)의 노드·API·인증·표현식·실행엔진·환경변수를 대상으로 서술돼 있다. 이번 18개 파일은 전부 `.claude/`(코드 리뷰·consistency-check 하네스의 훅/공유 라이브러리/orchestrator 스크립트/agent·skill 정의/테스트) 아니면 `plan/in-progress/`(작업 추적 문서)이고, `codebase/**` 또는 `spec/**` 를 한 파일도 건드리지 않는다. 표면적 키워드 겹침(`review_guard.py`·`retry_state.py`의 "session" = 리뷰 세션 디렉토리, "auth"/제품 인증과 무관)도 확인했으나 참조 대상이 다르다 — 매트릭스가 말하는 "인증·세션 흐름"은 `codebase/backend/src/modules/auth/**` 의 제품 로그인/권한 로직이고, 여기서 "session" 은 `review/<domain>/<date>/<time>/` 세션 디렉토리를 가리킬 뿐이다. `new-bullmq-queue`(`system-status.constants.ts`) · `new-error-code`(`error-codes.ts`) 처럼 파일명까지 특정하는 행도 대상 파일명이 이번 변경에 전혀 등장하지 않는다.

**결론**: 20개 trigger 중 매칭 0건, 따라서 동반 갱신 누락도 0건. 유저 가이드 MDX·i18n dict·`backend-labels.ts`·`SECTION_LABELS_BY_LOCALE` 어느 것도 이번 변경과 관련이 없다 — "해당 없음".

## 위험도

NONE
