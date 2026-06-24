# RESOLUTION — system-prompt Self-review skip drift fix (review/code/2026/06/24/14_13_03)

대상 커밋: `86cd2a97` (fix: system-prompt Self-review skip 안내 코드 정합)
위험도: **LOW** · Critical 0 · Warning 1 · INFO 6 · 수렴(코드 무변경)

## Critical
해당 없음.

## WARNING

### W#1 — spec §10 line 958 finishBlockCount stale → **sibling PR #685 처리 (PR-C 무관)**

- 본 PR(developer, codebase)은 `system-prompt.ts` 프롬프트 문자열을 코드(`shouldSkipReview`)에 정합화한다. spec §10 line 958 의 stale `finishBlockCount` 불릿은 **spec 영역(planner)** 이며 **이미 sibling PR #685(`docs(spec)`, branch `claude/spec-sync-m3-m1-ai-assistant`)가 삭제**한다.
- 유지보수 불변식(§992/§1349 "review skip 조건 변경 시 system-prompt.ts 동기화")의 **두 절반**: #685 = spec §10, 본 PR = system-prompt.ts. **동행 머지 권장**.
- developer 는 spec semantic 미수정이므로 본 PR 에서 spec 을 건드리지 않는다. 코드·프롬프트·§5 Rationale 3자는 이미 정합.
- **조치**: 코드 무변경. impl-prep(`14_03_16`)도 동일 사유로 BLOCK:NO 조정됨.

## INFO 처분

| # | 항목 | 판정 |
|---|------|------|
| 1 | finish-guard code-level 단언(`finishBlockCount:1`→shouldSkipReview false) | **defer** — `assistant-finish-guard.service.spec.ts`(M-3 2단계 파일, 범위 밖). 코드가 finishBlockCount 미참조라 묵시 보장 + 본 PR 의 prompt-level 회귀 단언 2건(`does NOT skip review` 포함 + 옛 clause 부재)으로 drift 재발 가드. 추가 시 4번째 파일 touch + 재리뷰 사이클 — INFO 가치가 비용 미달(loop avoidance). |
| 2 | `reviewRoundCount:1` 경계 케이스 | **defer** — pre-existing 커버리지 갭, 본 PR 무관. |
| 3 | system-prompt Note inline 포맷 | **defer (cosmetic)** — Note 가 직전 "skip 조건" 문장의 예외("plan 가드 이후에도 review 발동")로 논리 연결되어 inline 이 자연스러움. |
| 4,5,6 | _retry_state 경로·shouldSkipReview 주석·toWorkflowView 마스킹 테스트 | **무관/범위 밖** — pre-existing, 본 PR 변경과 무관. #5 는 #685 머지 시 확인. |

## 검증
- lint·build·unit(system-prompt.spec **46 PASS**, 회귀 단언 2건 포함)·**e2e 214 PASS**
- 코드 무변경 수렴 — review/** 전용 커밋으로 종결(review_guard 재무장 회피)
