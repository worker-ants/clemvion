STATUS=success ISSUES=0

===REPORT_MARKDOWN_BELOW===

# User Guide Sync Review

## 매트릭스 적재

- SSOT: `.claude/config/doc-sync-matrix.json` — `rows[]` 21건 전건 Read.
- 보조: `PROJECT.md` §변경 유형 → 갱신 위치 매핑 (L116–L199) — prose 표 + "자주 누락되는 항목" 목록 함께 Read.

## 변경 파일 식별

`git diff --name-only origin/main...HEAD` 로 이 브랜치(`harness-bundle-correctness-0a4694`)의 전체 changeset 을 확인 (orchestrator 가 prompt 에 포함한 6개 파일과 정확히 일치):

1. `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py`
2. `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py`
3. `.claude/tests/test_consistency_bundle_priority.py`
4. `.claude/tests/test_consistency_context_budget.py`
5. `.claude/tests/test_prompt_omission_notice.py`
6. `plan/in-progress/harness-consistency-summary-downgrade-rule.md`

## 매칭 분석

매트릭스 21개 행(`new-node` / `node-schema-change` / `new-ui-string` / `new-widget-chrome-string` / `integration-provider-change` / `new-userguide-section-dir` / `backend-api-change` / `new-bullmq-queue` / `new-warning-code` / `new-error-code` / `new-cross-cutting-enum` / `new-backend-ui-zod-value` / `new-handler-output-field` / `auth-session-flow-change` / `auth-config-type-enum-change` / `expression-language-change` / `run-debug-flow-change` / `env-runtime-change` / `spec-major-change` / `userguide-gui-flow-section` / `spec-defect-found`) 전체를 이 6개 파일에 대해 검토했다.

- **glob 매칭 행** (`codebase/backend/src/nodes/**`, `codebase/frontend/src/**/*.tsx`, `codebase/channel-web-chat/src/**/*.tsx`, `codebase/frontend/src/content/docs/*/`, `codebase/backend/src/**/*.controller.ts`+dto, `system-status.constants.ts`, `error-codes.ts`, `spec/{2,3,4,5}-*/**`, `spec/conventions/**`) — 이 changeset 의 6개 파일은 모두 `.claude/` 또는 `plan/in-progress/` 하위이며 위 어떤 glob 도 매치하지 않는다.
- **semantic 매칭 행** (`integration-provider-change`, `new-warning-code`, `new-cross-cutting-enum`, `new-backend-ui-zod-value`, `new-handler-output-field`, `auth-session-flow-change`, `auth-config-type-enum-change`, `expression-language-change`, `run-debug-flow-change`, `env-runtime-change`, `spec-defect-found`) — 의미 판단으로도 매칭되지 않는다. 변경 내용은 다음과 같다:
  - `code_review_orchestrator.py` / `consistency_orchestrator.py`: `/ai-review`·`/consistency-check` sub-agent 세션 준비 스크립트(prompt 조립·번들 우선순위·budget 분배·retry state 관리). **제품의 실행/디버깅 엔진이 아니라 review harness 자체의 내부 로직**이므로 `run-debug-flow-change`(제품 `05-run-and-debug/` 대상)에 해당하지 않는다.
  - 3개 테스트 파일: 위 두 스크립트의 신규 동작(자연 정렬 tie-break, 파일 경계 sentinel, per-checker budget 분리, 생략 파일 고지)을 pin 하는 단위 테스트.
  - `plan/in-progress/harness-consistency-summary-downgrade-rule.md`: 위 하네스 결함들의 이력·근본원인·해결 상태를 추적하는 진행 중 plan 문서. `spec/**` 변경이 아니고 spec 결함 제안도 아니므로 `spec-defect-found`/`spec-major-change` 와 무관.
  - 신규 provider·backend warning/error code·cross-cutting enum·zod ui.label·handler output field·auth 흐름·AuthConfig enum·expression-engine·환경변수/런타임 변경 — 모두 **product 코드(`codebase/backend`, `codebase/frontend`, `codebase/packages/expression-engine`)에 대한 변경이 changeset 에 전혀 없어** 매칭 대상 자체가 없다.

## 결론

이 changeset 은 `/ai-review`·`/consistency-check` 하네스의 **번들 정확성 결함 수정**(natural-sort 재정렬, 파일 경계 sentinel, per-checker budget 분리, 생략 파일 고지)이며 `.claude/skills/**scripts`, `.claude/tests/**`, `plan/in-progress/**` 로만 구성된다. `codebase/backend`, `codebase/frontend`, `codebase/packages/expression-engine`, `codebase/channel-web-chat`, `spec/**` 어디에도 변경이 없어 doc-sync-matrix 의 21개 trigger(글로브 9건 + semantic 11건 + 1건) 중 어느 것도 매칭되지 않는다. User Guide Sync 관점에서는 **해당 없음**.

## 요약

매트릭스 trigger 총 21건을 changeset 6개 파일(전부 `.claude/` 하네스 스크립트/테스트 + `plan/in-progress/` 추적 문서) 각각에 대해 검토했으며 매칭 0건, 동반 갱신 누락 0건. 제품 코드(`codebase/**` 노드·i18n dict·백엔드 API·인증·표현식 엔진 등)·spec 어디에도 변경이 없어 유저 가이드/i18n/backend-labels 동반 갱신이 애초에 요구되지 않는 changeset이다.

## 위험도

NONE
