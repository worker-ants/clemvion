# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 보고서

## 매트릭스 적재
- SSOT: `.claude/config/doc-sync-matrix.json` — `rows[]` 20건 (glob 매칭 12건 + semantic 8건) Read 완료.
- 보조: `PROJECT.md` §변경 유형 → 갱신 위치 매핑 (L116~L184, prose 표 20행) Read 완료 — JSON 과 1:1 대응 확인(`test_doc_sync_matrix.py` 가 보장하는 바와 일치).

## 변경 파일 식별
prompt 에 포함된 15개 파일 + `git diff --name-only origin/main...HEAD` 로 교차 검증(동일):

1. `.claude/agents/consistency-summary.md`
2. `.claude/hooks/_lib/review_guard.py`
3. `.claude/hooks/guard_review_before_stop.py`
4. `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py`
5. `.claude/skills/consistency-checker/SKILL.md`
6. `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py`
7. `.claude/tests/README.md`
8. `.claude/tests/test_consistency_bundle_priority.py`
9. `.claude/tests/test_guard_review_before_push_main.py`
10. `.claude/tests/test_prompt_omission_notice.py`
11. `.claude/tests/test_review_changeset_warning.py`
12. `.claude/tests/test_review_guard_hardening.py`
13. `.claude/tests/test_stop_guard_failopen.py`
14. `plan/in-progress/harness-consistency-summary-downgrade-rule.md`
15. `plan/in-progress/harness-review-gate-ci-backstop.md`

(작업 디렉토리에 추가로 보이는 `review/code/2026/07/31/11_07_48/**` 는 직전 리뷰 세션의 산출물이며 소스 변경이 아니므로 매칭 대상에서 제외.)

## trigger 매칭 결과

매트릭스 20행 전체를 위 15개 파일에 대조:

| trigger id | glob/semantic 패턴 | 매칭 여부 |
|---|---|---|
| new-node | `codebase/backend/src/nodes/**` | 없음 |
| node-schema-change | 동일 | 없음 |
| new-ui-string | `codebase/frontend/src/**/*.tsx` | 없음 |
| new-widget-chrome-string | `codebase/channel-web-chat/src/**/*.tsx` | 없음 |
| integration-provider-change | semantic (provider 변경) | 없음 |
| new-userguide-section-dir | `codebase/frontend/src/content/docs/*/` | 없음 |
| backend-api-change | `*.controller.ts` / `dto/**` | 없음 |
| new-bullmq-queue | `system-status.constants.ts` | 없음 |
| new-warning-code | semantic (backend warningRules) | 없음 |
| new-error-code | `codebase/backend/src/nodes/core/error-codes.ts` | 없음 |
| new-cross-cutting-enum | semantic | 없음 |
| new-backend-ui-zod-value | semantic | 없음 |
| new-handler-output-field | semantic | 없음 |
| auth-session-flow-change | `codebase/backend/src/modules/auth/**` | 없음 |
| auth-config-type-enum-change | semantic | 없음 |
| expression-language-change | `codebase/packages/expression-engine/**` | 없음 |
| run-debug-flow-change | semantic (실행·디버깅 흐름) | 없음 |
| env-runtime-change | semantic | 없음 |
| spec-major-change | `spec/{2,3,4,5}-*/**`, `spec/conventions/**` | 없음 |
| userguide-gui-flow-section | `02-nodes/**.mdx`, `06-integrations-and-config/**.mdx` | 없음 |
| spec-defect-found | semantic | 없음 |

15개 변경 파일은 전부 `.claude/`(하네스 훅·스킬·에이전트 정의·테스트) 와 `plan/in-progress/`(작업 추적 문서) 아래에 있다. `codebase/**` 경로가 전혀 없고 `spec/**` 경로도 전혀 없다(참고: `plan/` 은 `spec/` 과 별개 최상위 디렉토리 — CLAUDE.md 폴더 구조 표 기준).

본문 중 `codebase/a.ts`, `codebase/backend/a.py` 등 "codebase/" 문자열이 다수 등장하지만(`grep` 43건), 전부 다음 둘 중 하나다:
- `.claude/tests/test_*.py` 안의 **가짜 fixture 경로 문자열**(하네스의 glob 매칭·git porcelain 파싱 로직을 단위 테스트하기 위한 예시 입력, 실제 파일이 아님) — 예: `test_review_guard_hardening.py` 의 `rg._glob_to_regex("codebase/backend/**")`, `test_review_changeset_warning.py` 의 `warn([], ["codebase/a.ts"])`.
- `plan/in-progress/harness-review-gate-ci-backstop.md` 안의 **과거 사례 서술**("`codebase/backend/src/modules/execution-engine/` 아래 5개 파일을 바꿨다" 등, 리뷰 게이트가 놓쳤던 과거 PR 을 설명하는 프로즈) — 이 plan 문서 자체가 지금 바뀐 것이지, 그 문서가 언급하는 execution-engine 코드가 지금 바뀐 게 아니다.

즉 이번 변경 set 은 AI 코드 리뷰·consistency-check 하네스 자체의 내부 동작(fail-open 보고, 재시도 정책, Stop/Push 가드, 번들 우선순위·생략 고지, summary 하향 금지 규약)을 다루는 메타 툴링이며, 제품의 사용자 가시 표면(노드, 스키마, i18n dict, docs MDX, 인증 흐름, 표현식 언어, 실행·디버깅 흐름, provider, warning/error code)은 어느 것도 건드리지 않는다.

## 결론
매트릭스 20개 trigger 중 매칭 0건. 동반 갱신 누락 검출 대상 자체가 없다.

## 발견사항
없음.

## 요약
이번 변경 15개 파일은 전부 `.claude/`(리뷰·consistency-check 하네스: 훅 3, 스킬/에이전트 정의 3, 테스트 7)과 `plan/in-progress/`(작업 추적 문서 2)에 국한되며 `codebase/**`·`spec/**` 를 전혀 포함하지 않는다. `doc-sync-matrix.json` 의 trigger 20건(glob 12 + semantic 8) 전부를 대조했으나 매칭 0건 — 유저 가이드(docs MDX)·i18n dict·backend-labels 동반 갱신이 애초에 요구되지 않는 변경이다. "codebase/" 문자열 43건은 전부 테스트 fixture 예시 문자열 또는 plan 문서의 과거 사례 서술이며 실제 코드 변경이 아니다. 해당 없음.

## 위험도
NONE
