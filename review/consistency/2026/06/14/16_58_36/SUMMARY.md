# Consistency Check 통합 보고서 (--impl-done) — **checker 변이 오탐 (false BLOCK)**

**BLOCK: YES (오탐)** → main Claude 검증 결과 **실질 BLOCK 아님**. 동일 content 에 대해 직전 `--impl-done`(16_43_08, EIA scope) 가 **BLOCK: NO** 였고, ai-review(16_58_36)도 **Critical 0·Warning 0**. 본 run 의 Critical 4건은 **변경 방향을 거꾸로 읽은 hallucination**.

## 오탐 확정 근거
본 run 의 cross_spec/plan_coherence 가 "draft 가 EIA-RL-06·R14·R15 를 **삭제**하고 `VALIDATION_FAILED`·`403 SCOPE_MISMATCH` 를 **복원**했다(역방향)" 고 주장. 그러나 checker 가 분석한 draft 본문(temp scope copy) grep 실측:

| 항목 | draft(temp) | worktree |
|---|---|---|
| `EIA-RL-06` | **7** | 7 |
| `### R15. Terminal token revoke` | **1** | — |
| `VALIDATION_ERROR` | **6** | 6 |
| `VALIDATION_FAILED`(구) | **0** | 0 |
| `TOKEN_SCOPE_MISMATCH` | **5** | — |

→ draft 는 EIA-RL-06/R15/VALIDATION_ERROR/401 TOKEN_SCOPE_MISMATCH 를 **보유**하고 구 값(VALIDATION_FAILED/403)은 **없다**. checker 주장과 정반대. C-1/C-2/C-3/C-4 전부 변경 방향 오독.

## 교차 검증 (모두 clean)
- `--spec` 15_59_07: **BLOCK: NO** (동일 spec 본문 전수).
- `--impl-done` 16_43_08 (EIA scope, spec 본문 적재): **BLOCK: NO**.
- ai-review 16_58_36: **Critical 0 · Warning 0**.
- plan `spec-fix-eia-token-error-codes.md` = complete·[x] (D1/D2/D3 사용자 승인). plan_coherence 가 in-progress 만 읽어 완료 plan 미인지 → "합의 없음" 오탐.

## 실 발견(비차단, 후속) — INFO
- 16-system-status-api.md §1 / 3-error-handling EIA 코드 카탈로그 / 1-data-model execution_token 엔티티 등재 = 후속 doc-sync (비차단).

## 처리
checker 변이 오탐이므로 **동일 EIA scope 로 재실행**(16_43_08 와 동형, BLOCK: NO 기대)해 정합 보고를 갱신한다. 재실행 BLOCK: NO 가 본 run 을 supersede.
