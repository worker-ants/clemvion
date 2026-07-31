# User Guide Sync Review — 2026/07/31 13:35:34

## 매트릭스 적재

- SSOT: `.claude/config/doc-sync-matrix.json` (rows[] 21건) Read 완료.
- 보조: `PROJECT.md` §변경 유형 → 갱신 위치 매핑 (표 122~144행) Read 완료.
- 두 문서의 모든 trigger 는 예외 없이 `codebase/**` (frontend/backend/channel-web-chat) 또는 `spec/**` 경로에 걸려 있다. `.claude/**` (harness/hook/skill/test) 또는 `plan/**` 를 trigger 로 삼는 행은 하나도 없다 (유일하게 `plan/`을 언급하는 행은 "spec 자체에 누락·오류가 있다고 판단됨" 행의 **target** 쪽 — `plan/in-progress/spec-update-<name>.md` 신설 — 이지 trigger 가 아니다).

## 변경 파일 식별

`git diff --name-only origin/main...HEAD` 로 확인한 본 브랜치의 전체 변경 파일 17건:

```
.claude/agents/consistency-summary.md
.claude/hooks/_lib/review_guard.py
.claude/hooks/guard_review_before_stop.py
.claude/skills/code-review-agents/SKILL.md
.claude/skills/code-review-agents/scripts/_probe_main.py
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

(리뷰 프롬프트에 첨부된 17개 파일과 정확히 일치 — 별도 staged/untracked diff 없음, `git status --short` 상 `review/code/**` 산출물 디렉토리만 존재하며 이는 리뷰 도구 자체의 출력물이라 매트릭스 대상이 아니다.)

## trigger 매칭

각 파일을 `doc-sync-matrix.json` 의 `trigger.globs` (glob 행) 및 `change_type`/`targets` 의미 (semantic 행) 에 대조:

- `codebase/backend/src/nodes/**` (new-node, node-schema-change) — 매칭 없음. 변경분은 전부 `.claude/` 이고 노드 디렉토리 자체가 대상이 아니다.
- `codebase/frontend/src/**/*.tsx` (new-ui-string) — 매칭 없음. frontend TSX 변경 없음.
- `codebase/channel-web-chat/src/**/*.tsx` (new-widget-chrome-string) — 매칭 없음.
- `codebase/frontend/src/content/docs/*/` (new-userguide-section-dir) — 매칭 없음. 신규 docs 섹션 디렉토리 없음.
- `codebase/backend/src/modules/auth/**` (auth-session-flow-change) — 매칭 없음. `.claude/hooks/guard_review_before_stop.py` 는 harness 의 Stop-hook(세션 종료 게이트)이지 제품의 인증/세션 미들웨어가 아니다 — 이름의 "gate/guard" 유사성에 현혹되지 않도록 확인함.
- `codebase/packages/expression-engine/**` (expression-language-change) — 매칭 없음.
- `codebase/backend/src/nodes/core/error-codes.ts` (new-error-code) — 매칭 없음.
- "실행·디버깅 흐름 변경" (run-debug-flow-change, semantic) — 매칭 없음. 이 행이 가리키는 건 제품의 워크플로 실행 엔진·디버그 로깅(`codebase/backend` 의 실행기)이지, AI 리뷰/consistency-check 하네스의 재시도·상태기계가 아니다. 코드 리뷰 게이트의 "재진입성"·"재시도" 로직 변경은 **제품 실행·디버깅 흐름**과 무관한 별개 영역이다.
- "신규 warningCode/errorCode 발행" (new-warning-code) — 매칭 없음. backend `warningRules`/`ErrorCode` enum 변경이 아니라 harness 자체의 fail-open 카운터/사유 문자열이다.
- 나머지 모든 행(integration-provider-change, backend-api-change, new-bullmq-queue, new-cross-cutting-enum, new-backend-ui-zod-value, new-handler-output-field, auth-config-type-enum-change, env-runtime-change, spec-major-change, userguide-gui-flow-section, spec-defect-found) — 전부 매칭 없음. `spec/**` 변경도 0건.

## 결론

본 변경 set 은 제품 코드(`codebase/**`)나 spec(`spec/**`)을 전혀 건드리지 않는다. 대상은 (1) AI 코드 리뷰·consistency-check 자동화 하네스 자체 — sub-agent 정의, push/stop 훅, orchestrator 스크립트, 그 유닛테스트 — 와 (2) 그 작업을 추적하는 `plan/in-progress/harness-*.md` 뿐이다. 이들은 개발자/리뷰어를 위한 내부 도구이며 최종 사용자에게 노출되는 노드 카드·UI 문자열·docs MDX·에러 메시지와는 완전히 분리된 layer 다. 매트릭스의 어떤 trigger (glob 또는 semantic) 도 이 파일들에 매칭되지 않으므로 동반 갱신 누락을 판단할 대상 자체가 없다.

## 발견사항

없음 — 해당 없음 (매트릭스 무관 변경).

## 요약

`doc-sync-matrix.json` rows[] 21건 (glob 13건 + semantic 8건) 을 전수 대조한 결과, 이번 변경 17개 파일(`.claude/agents,hooks,skills,tests` 하네스 코드 + `plan/in-progress` 추적 문서)은 매칭되는 trigger 가 0건이다 — 전부 `.claude/**`/`plan/**` 이고 매트릭스 trigger 는 예외 없이 `codebase/**`/`spec/**` 스코프이기 때문. 유저 가이드(docs MDX)·i18n dict·backend-labels 동반 갱신 누락 여부를 논할 대상이 아니다.

## 위험도

NONE
