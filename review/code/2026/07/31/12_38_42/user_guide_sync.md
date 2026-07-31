# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (`rows[]`, 21건) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 (line 116~)을 SoT 로 적재했다.

## 변경 파일 식별

이번 리뷰 대상 15개 파일 (prompt 목록과 `git diff --name-only origin/main...HEAD` 실측 일치):

- `.claude/agents/consistency-summary.md`
- `.claude/hooks/_lib/review_guard.py`
- `.claude/hooks/guard_review_before_stop.py`
- `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py`
- `.claude/skills/consistency-checker/SKILL.md`
- `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py`
- `.claude/tests/README.md`
- `.claude/tests/test_consistency_bundle_priority.py`
- `.claude/tests/test_guard_review_before_push_main.py`
- `.claude/tests/test_prompt_omission_notice.py`
- `.claude/tests/test_review_changeset_warning.py`
- `.claude/tests/test_review_guard_hardening.py`
- `.claude/tests/test_stop_guard_failopen.py`
- `plan/in-progress/harness-consistency-summary-downgrade-rule.md`
- `plan/in-progress/harness-review-gate-ci-backstop.md`

## 매칭 결과

전량 `.claude/**` (하네스·리뷰 게이트·consistency-checker 도구 자체) 또는 `plan/in-progress/**` (작업 추적 문서)이며, `codebase/**` 또는 `spec/**` 경로 변경이 **0건**이다.

매트릭스 21개 행을 전수 대조:

| trigger 유형 | 대표 glob/semantic 대상 | 매칭 여부 |
|---|---|---|
| new-node / node-schema-change | `codebase/backend/src/nodes/**` | 없음 |
| new-ui-string | `codebase/frontend/src/**/*.tsx` | 없음 |
| new-widget-chrome-string | `codebase/channel-web-chat/src/**/*.tsx` | 없음 |
| new-userguide-section-dir | `codebase/frontend/src/content/docs/*/` | 없음 |
| backend-api-change | `codebase/backend/src/**/*.controller.ts`, `dto/**` | 없음 |
| new-bullmq-queue | `system-status.constants.ts` | 없음 |
| new-error-code | `codebase/backend/src/nodes/core/error-codes.ts` | 없음 |
| auth-session-flow-change | `codebase/backend/src/modules/auth/**` | 없음 (본 변경의 "session_id"는 Claude Code harness 이벤트 payload 필드로, 제품의 인증·세션과 무관) |
| expression-language-change | `codebase/packages/expression-engine/**` | 없음 |
| spec-major-change | `spec/2-*/**` 등 | 없음 (`spec/` 변경 0건) |
| integration-provider-change / new-warning-code / new-cross-cutting-enum / new-backend-ui-zod-value / new-handler-output-field / auth-config-type-enum-change / run-debug-flow-change / env-runtime-change / userguide-gui-flow-section / spec-defect-found (semantic 행) | (glob 없음, 의미 판단) | 없음 — 변경 내용이 리뷰 게이트/consistency 오케스트레이션 내부 로직(예산 우선순위, in-flight TTL, fail-open 리포팅)이라 제품 기능·API·표현식·경고코드·UI 라벨과 무관 |

`plan/in-progress/harness-consistency-summary-downgrade-rule.md` 와 `plan/in-progress/harness-review-gate-ci-backstop.md` 는 이번 harness 개선의 작업 추적 문서이고, 그 안에 `codebase/backend/src/modules/execution-engine/` 언급이 있으나 이는 **과거 라운드**의 관측 서술(그 코드가 review 를 누락하고 지나갔다는 회고)이며 이번 diff 에 포함된 변경이 아니다 (`git diff --name-only origin/main...HEAD` 로 확인 — execution-engine 하위 파일은 changeset 에 없음).

## 발견사항

없음 — 해당 없음.

## 요약

이번 changeset 은 code-review/consistency-checker 하네스 자체(리뷰 게이트 정규식·in-flight TTL scope 축소·번들 우선순위·fail-open 리포팅·프롬프트 생략 안내)와 그 작업 추적 plan 문서만 건드리며, `codebase/**`·`spec/**` 변경이 0건이다. User Guide Sync 매트릭스의 21개 trigger 행(신규 노드/스키마, TSX 신규 문자열, 위젯 chrome, 신규 섹션 디렉토리, 통합/제공자, 인증·세션, 표현식 언어, 실행·디버깅, warning/error code 등)을 전수 대조했으나 매칭 0건 — 유저 가이드(docs MDX)·i18n dict·backend-labels 동반 갱신 의무가 발생하지 않는다. router 가 이 리뷰어를 활성화했더라도 본 변경은 영역 무관으로 판정한다.

## 위험도

NONE
