# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

- SSOT: `.claude/config/doc-sync-matrix.json` Read 완료 — `rows[]` 21건 (`new-node`, `node-schema-change`, `new-ui-string`, `new-widget-chrome-string`, `integration-provider-change`, `new-userguide-section-dir`, `backend-api-change`, `new-bullmq-queue`, `new-warning-code`, `new-error-code`, `new-cross-cutting-enum`, `new-backend-ui-zod-value`, `new-handler-output-field`, `auth-session-flow-change`, `auth-config-type-enum-change`, `expression-language-change`, `run-debug-flow-change`, `env-runtime-change`, `spec-major-change`, `userguide-gui-flow-section`, `spec-defect-found`).
- 보조: `PROJECT.md` §변경 유형 → 갱신 위치 매핑 (116~186행) Read 완료 — JSON 과 표가 21행 1:1 대응, nuance("자주 누락되는 항목") 확인.
- 모든 trigger 는 `codebase/backend/**`, `codebase/frontend/**`, `codebase/channel-web-chat/**`, `codebase/packages/expression-engine/**`, 또는 `spec/{2,3,4,5}-*/**`, `spec/conventions/**` 하위로만 스코프됨. `.claude/**` 또는 `plan/**` 경로를 trigger 로 지목하는 행은 0건.

## 변경 파일 컨텍스트 (실측)

prompt 가 지목한 "리뷰 대상 파일" 15건을 `git diff --name-only e7fef2510..179263dd2` 로 교차 확인 — 완전히 일치, 추가/누락 없음:

```
.claude/_shared/block_integrity.py                                          (신규)
.claude/_shared/retry_state.py                                              (신규)
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
.claude/tests/test_block_integrity.py                                       (신규)
.claude/tests/test_retry_state_shared.py                                    (신규)
plan/in-progress/harness-review-gate-ci-backstop.md
```

내용 요지: `/ai-review` · `/consistency-check` 리뷰 게이트 자체의 하네스 내부 로직 — (1) consistency SUMMARY 의 `BLOCK: NO` 판정이 checker 의 `[CRITICAL]` 태그와 모순되면 advisory 를 발화하는 `block_integrity.py` 신설, (2) `code_review_orchestrator.py` / `consistency_orchestrator.py` / `merge_coordinator_orchestrator.py` 세 orchestrator 가 각자 들고 있던 `_retry_state.json` bookkeeping 5종을 `_shared/retry_state.py` 로 통합, (3) 관련 hook(`review_guard.py`, `guard_review_before_push.py`, `guard_review_before_stop.py`)의 advisory 배선. 전부 **개발 하네스(리뷰/일관성 검토 게이트) 의 자체 구현** 이며 제품 코드가 아니다.

## 매칭 판정

15개 변경 파일 전부 `.claude/` 또는 `plan/in-progress/` 하위이고, `codebase/**` 또는 `spec/**` 를 전혀 건드리지 않는다. 매트릭스 21개 trigger 를 전수 대조:

- **glob 매칭 행** (`new-node`, `new-ui-string`, `new-widget-chrome-string`, `new-userguide-section-dir`, `new-bullmq-queue`, `new-error-code`, `spec-major-change`, `userguide-gui-flow-section`) — 전부 `codebase/**.tsx|.ts` 또는 `spec/**` 패턴. 변경 파일 15건 중 어느 것도 이 glob 에 매칭되지 않음 (전부 `.claude/**.py`/`.md` 또는 `plan/**.md`).
- **semantic 매칭 행** (`integration-provider-change`, `backend-api-change`, `new-warning-code`, `new-cross-cutting-enum`, `new-backend-ui-zod-value`, `new-handler-output-field`, `auth-session-flow-change`, `auth-config-type-enum-change`, `expression-language-change`, `run-debug-flow-change`, `env-runtime-change`, `spec-defect-found`) — 의미상으로도 해당 없음: 노드/필드/라벨 추가 아님, TSX UI 문자열 아님, provider/통합 변경 아님, backend controller/DTO 아님, `warningRules`/`ErrorCode` enum 발행 아님, cross-cutting enum 아님, backend zod `ui.*` 값 아님, handler output field 아님, `codebase/backend/src/modules/auth/**` 변경 아님(리뷰 게이트의 worktree/git-hook 인증과 제품의 로그인·세션 인증은 별개), `AuthConfig` type enum 아님, `expression-engine` 아님, 제품의 실행·디버깅 엔진(`05-run-and-debug/`) 아님, 배포된 제품의 env/런타임 변경 아님, spec 결함 지적 아님.

`.claude/**` 하네스 자체 변경을 다루는 trigger 는 매트릭스에 애초에 없다 (매트릭스는 명시적으로 제품 표면 `codebase/`+`spec/` 만 커버). 따라서 router 가 본 reviewer 를 활성화했더라도, 본 변경 set 은 유저 가이드 동반 갱신 매트릭스의 영역 밖이다.

## 발견사항

없음 — 해당 없음 (매칭된 trigger 0건이므로 누락 여부를 논할 대상 자체가 없음).

## 요약

매트릭스 SSOT(`.claude/config/doc-sync-matrix.json`) 21개 trigger 행을 전수 대조한 결과, 이번 변경 15개 파일은 모두 `.claude/`(코드 리뷰·일관성 검토 게이트 하네스 자체 — `[CRITICAL]` 하향 감지 backstop 신설 + 3개 orchestrator 의 retry-state bookkeeping 공유화) 또는 `plan/in-progress/`(진행 추적 문서) 안에 있으며, `codebase/`(제품 프론트엔드·백엔드·패키지)나 `spec/` 를 전혀 건드리지 않는다. 노드·i18n dict·backend-labels·유저 가이드 MDX·auth 흐름·표현식 언어·실행/디버깅 흐름 등 매트릭스가 다루는 어떤 trigger 에도 매칭되지 않으므로 매칭 0건, 누락 0건이며 "해당 없음" 으로 종결한다.

## 위험도

NONE
