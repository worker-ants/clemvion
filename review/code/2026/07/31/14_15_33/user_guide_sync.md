# User Guide Sync Review — 해당 없음

## 사전 점검

1. SSOT `.claude/config/doc-sync-matrix.json` (`rows[]`, 21개 trigger 행) Read 완료.
2. 보조 `PROJECT.md` §변경 유형 → 갱신 위치 매핑 (L116–L200) Read 완료 — JSON 과 1:1 대응 확인.
3. 변경 파일 목록은 `git diff --name-only origin/main...HEAD` 로 재확인 (prompt 의 16개 파일과 완전히 일치):

```
.claude/agents/consistency-summary.md
.claude/hooks/_lib/review_guard.py
.claude/hooks/guard_review_before_stop.py
.claude/skills/code-review-agents/SKILL.md
.claude/skills/code-review-agents/scripts/code_review_orchestrator.py
.claude/skills/consistency-checker/SKILL.md
.claude/skills/consistency-checker/scripts/consistency_orchestrator.py
.claude/tests/README.md
.claude/tests/test_consistency_bundle_priority.py
.claude/tests/test_guard_review_before_push_main.py
.claude/tests/test_prompt_omission_notice.py
.claude/tests/test_review_changeset_warning.py
.claude/tests/test_review_guard_hardening.py
.claude/tests/test_stop_guard_failopen.py
plan/in-progress/harness-consistency-summary-downgrade-rule.md
plan/in-progress/harness-review-gate-ci-backstop.md
```
(+ `review/code/2026/07/31/11_07_48/**` — 과거 리뷰 세션 산출물, harness 산출물이라 매트릭스 판단 대상 아님)

## 매칭 분석

매트릭스 21개 행의 trigger 는 전부 `codebase/**` (nodes, frontend TSX/docs/i18n-dict/backend-labels, channel-web-chat, backend controller/DTO/system-status/error-codes/auth 모듈, packages/expression-engine) 또는 `spec/**` 를 대상으로 한다. 본 변경 set 은 다음 세 그룹으로만 구성된다:

- `.claude/agents/**`, `.claude/hooks/**`, `.claude/skills/**/SKILL.md`, `.claude/skills/**/scripts/*.py` — AI 코드 리뷰·일관성 체크 harness 자체(review-guard, stop-hook, orchestrator 스크립트, sub-agent 정의)
- `.claude/tests/*.py`, `.claude/tests/README.md` — 위 harness 에 대한 단위 테스트
- `plan/in-progress/*.md` — 그 harness 작업을 추적하는 plan 문서

이 중 어느 것도 `codebase/backend/src/nodes/**`, `codebase/frontend/src/**/*.tsx`, `codebase/frontend/src/content/docs/**`, `codebase/frontend/src/lib/i18n/**`, `codebase/backend/src/modules/auth/**`, `codebase/packages/expression-engine/**`, `codebase/backend/src/nodes/core/error-codes.ts`, `codebase/backend/src/modules/system-status/**`, `spec/**` 어디에도 해당하지 않는다. 즉 21개 trigger 행 전부에 대해 매칭 파일이 0건이다.

이 PR 은 제품 코드(노드·프론트엔드·백엔드 API·인증·표현식 엔진·실행 엔진)를 전혀 건드리지 않고, 오직 이 저장소 자체의 **AI 리뷰/일관성 체크 워크플로 도구**(리뷰 게이트 훅의 fail-open 보고, Stop 훅 nudge, consistency-summary 하향 금지 규약, orchestrator 의 changeset/번들 우선순위 로직, 관련 테스트)를 다룬다. 사용자에게 노출되는 UI 문자열·노드 스키마·문서·에러 코드 매핑 중 어느 것도 변경되지 않았으므로 유저 가이드 동반 갱신 대상이 근본적으로 없다.

## 발견사항

(없음 — 매칭된 trigger 0건)

## 요약

매트릭스 trigger 21개 중 매칭 0건, 동반 갱신 누락 0건. 변경 set(16개 파일)이 전부 `.claude/**` (리뷰/일관성 체크 harness 코드·테스트) 와 `plan/in-progress/**` (그 작업 추적 문서)로 구성돼 있어 doc-sync-matrix 가 감시하는 `codebase/**`·`spec/**` 표면과 완전히 무관하다. User Guide Sync 리뷰 관점에서는 "해당 없음".

## 위험도

NONE
