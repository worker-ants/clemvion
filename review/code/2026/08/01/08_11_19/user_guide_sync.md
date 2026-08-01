# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 적재 확인

- `.claude/config/doc-sync-matrix.json` Read 완료 (rows[] 20개 change_type, glob/semantic 혼합).
- `PROJECT.md` §변경 유형 → 갱신 위치 매핑 (L116–L199) 보조 Read 완료.
- 매트릭스의 모든 trigger(glob 20종 + semantic 다수)는 예외 없이 `codebase/backend/**` ·
  `codebase/frontend/**` · `codebase/channel-web-chat/**` · `codebase/packages/expression-engine/**` ·
  `spec/**` 경로에만 anchor 돼 있다. `.claude/**` 또는 `plan/**` 를 trigger 로 삼는 행은 JSON/표
  어디에도 없다.

## 변경 파일 식별 (실제 changeset)

`git diff --name-only origin/main...HEAD` 로 이 브랜치의 전체 changeset 을 직접 재확인:

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
review/code/**/*  (과거 리뷰 세션 산출물 — 리포트/메타, 소스 아님)
```

리뷰 payload(`_prompts/user_guide_sync.md`) 에 실린 17개 파일(review/code/** 산출물 제외)과
정확히 일치한다 — router 가 빠뜨린 codebase/spec 파일은 없다.

## 매칭 시도

매트릭스 20개 행(new-node, node-schema-change, new-ui-string, new-widget-chrome-string,
integration-provider-change, new-userguide-section-dir, backend-api-change, new-bullmq-queue,
new-warning-code, new-error-code, new-cross-cutting-enum, new-backend-ui-zod-value,
new-handler-output-field, auth-session-flow-change, auth-config-type-enum-change,
expression-language-change, run-debug-flow-change, env-runtime-change, spec-major-change,
userguide-gui-flow-section, spec-defect-found) 을 위 changeset 각 파일에 대조:

- 17개 변경 파일 전부 `.claude/` 또는 `plan/in-progress/` 하위 — 매트릭스의 glob 행 어느 것도
  `.claude/**`/`plan/**` 를 커버하지 않으므로 glob 매칭 0건.
  - `.claude/hooks/**`, `.claude/skills/**/scripts/*.py`, `.claude/_shared/**` 는 하네스 자체
    자동화(리뷰/consistency-check 오케스트레이션, fail-open 카운터, verdict 파서) 코드로,
    `codebase/backend/src/nodes/**` 도 `codebase/backend/src/modules/auth/**` 도 아니다.
  - `.claude/agents/consistency-summary.md`, `.claude/skills/consistency-checker/SKILL.md` 는
    sub-agent/skill 정의 문서이지 `codebase/frontend/src/content/docs/**` 유저 가이드 MDX 가 아니다.
  - `.claude/tests/**` 는 하네스 자체 unittest(`python3 -m unittest discover -s .claude/tests`)이며
    `codebase/frontend`/`codebase/backend` 의 어떤 spec/test 러너에도 속하지 않는다.
  - `plan/in-progress/harness-review-gate-ci-backstop.md` 는 작업 추적 plan 문서 — 매트릭스가
    다루는 "코드 변경 → 사용자 가시 문서" 축 밖이다 (spec 변경도, docs MDX 도 아님).
- semantic 매칭 대상(auth-session-flow-change · expression-language-change ·
  run-debug-flow-change · integration-provider-change · new-warning-code · new-error-code 등)도
  의미상 전혀 해당 없음 — 이 changeset 은 노드/스키마/i18n 문자열/provider/인증 플로우/표현식
  엔진/실행 엔진 어느 것도 건드리지 않는다. 다루는 도메인은 "consistency SUMMARY 의 BLOCK 판정
  검증 backstop + retry-state 공유화 + push/stop 훅 fail-open 리포팅" 으로, 개발자/리뷰어를 위한
  **내부 harness 워크플로**이지 최종 사용자가 보는 제품 표면이 아니다.

## 8R 컨텍스트 노트에 대한 확인

라운드 8 지침이 언급한 두 결함(①`_BLOCK_AT_LINE_START`/`_BLOCK_AT_LINE_END` 정규식의 catastrophic
backtracking 가능성, ②`guard_review_before_stop.py`/`failopen_state.report` 의 조기 return 이
advisory 를 놓치는지)은 실제로 `.claude/_shared/block_integrity.py` 주석(L58–L78)과
`.claude/hooks/_lib/failopen_state.py`/`guard_review_before_stop.py` 안에서 다뤄지고 있음을
확인했다 — 다만 두 결함 모두 **harness 자체의 동작·성능 결함**이며, 유저 가이드 동반 갱신
매트릭스가 다루는 "노드/스키마/i18n/provider/auth/표현식/실행 흐름 문서 갱신" 축과는 무관하다.
이 관점(User Guide Sync)에서는 두 항목 모두 매트릭스 trigger 밖이므로 판단 대상이 아니며, 다른
리뷰어(performance/side_effect/maintainability 계열)의 소관으로 남긴다.

## 결론 — 영역 무관

이 브랜치의 전체 changeset 은 `.claude/**`(하네스 자동화 스크립트·훅·테스트) 와
`plan/in-progress/**`(작업 plan) 로만 구성되며, `codebase/backend/**` · `codebase/frontend/**` ·
`codebase/channel-web-chat/**` · `codebase/packages/**` · `spec/**` 어디에도 변경이 없다.
매트릭스의 20개 행 중 어느 trigger(glob·semantic 불문) 에도 매칭되지 않으므로 "해당 없음" 으로
판정한다. router 가 본 reviewer 를 활성화했더라도 이 판정은 유효하다(prompt 자체가 무관 판정을
허용).

## 요약

매트릭스 20개 trigger(glob 6종 + semantic 14종) 전건을 changeset 17개 파일에 대조한 결과 매칭 0건
— 전체 변경이 `.claude/` 하네스 자동화(리뷰 게이트·consistency-check 오케스트레이션·retry-state
공유·fail-open 리포팅)와 `plan/in-progress/` 추적 문서에 한정되어 있고, 노드/스키마/i18n
문자열/provider/신규 섹션/인증 흐름/표현식 언어/실행-디버깅 흐름/warning·error 코드 등 유저 가이드
동반 갱신이 걸리는 어떤 제품 표면도 건드리지 않는다. 동반 갱신 누락 발견사항 없음.

## 위험도

NONE
