# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 CRITICAL/WARNING 0건. 발견된 항목은 전부 INFO(참고/이월) 등급.

## 전체 위험도
**LOW** — 신규 CRITICAL/WARNING 없음. 이월된 INFO 2건(1건은 이미 트래커 등재, 1건은 이번 라운드 신규 발견의 사소한 수치 부정확)만 존재.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

(없음)

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | convention_compliance | `3-error-handling.md` 예시의 `requestId`(`req_abc123`)가 `2-api-convention.md §5.3`이 규정하는 UUID 형식과 표기 불일치 (이월, 오늘 3번째 재확인) | `spec/5-system/3-error-handling.md` L265, L284, L475 | 이번 배치 범위 밖(developer 가 쓴 문장이 아니라 자기-반증형 소정정 대상 아님). 다음 planner 턴에서 `req_abc123` → UUID 형태 placeholder로 정정 |
| 2 | cross_spec | `spec/1-data-model.md ## Rationale` 표가 "쿼리 범위 select 투영" 패턴(4번째 사례, `listMembers`)을 아직 별도 행으로 등재 안 함 | `spec/1-data-model.md ## Rationale`(§2.1.1 인접) | 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`에 planner 항목으로 등재됨 — 별도 조치 불요, 다음 planner 턴에서 처리 |
| 3 | plan_coherence | `spec-followups-batch-b.md` L149 체크리스트가 상위 트래커 신규 planner 항목 수를 "2건/24 open"으로 적었으나 실제는 "3건/25 open" | `plan/in-progress/spec-followups-batch-b.md` L149 | 문구를 "3건 신규 등재 (30 → 25 open)"로 정정. 항목 내용 자체는 트래커에 이미 정확히 등재돼 있어 누락은 아님 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 3개 fix 커밋(가드 통합·JSDoc 정정·fixture 보강) 전부 신규 API/엔티티/RBAC/상태전이 미도입. 트리거 §1.10, User 민감컬럼 §2.1.1 앵커 재대조 정합 |
| rationale_continuity | NONE | `spec/5-system/` 델타 0. 코드 diff 전부 관련 spec Rationale(§2.1.1 User 민감컬럼, 2-trigger-list.md R-1~R-16)과 정합, 기각된 대안 재도입 없음 |
| convention_compliance | LOW | error-codes.md·audit-actions.md·swagger.md 인용 전수 재대조 정합. requestId 포맷 불일치 INFO만 이월 |
| plan_coherence | NONE | 직전 두 라운드 WARNING 2건이 실제 커밋(`05b899d1f`,`d80583700`)으로 해소됨을 원문 대조로 확인. 체크리스트 수치 소폭 부정확만 INFO |
| naming_collision | NONE | 신규 식별자 전수(`enclosingScopeName`, `TRIGGER_REPOSITORY`, `WorkflowVersionDetailProjection` 등) 워킹트리 대조, 충돌 없음. 오히려 기존 backend/frontend 동명 타입 충돌 1건 해소 |

## 권장 조치사항
1. (BLOCK 아님, 선택) `plan/in-progress/spec-followups-batch-b.md` L149의 "2건/24 open" 표기를 "3건/25 open"으로 정정 — 실질 누락은 아니므로 우선순위 낮음.
2. 다음 `project-planner` 턴에서 `spec/5-system/3-error-handling.md`의 `requestId` 예시(`req_abc123`)를 UUID 형태로 교체하고, `spec/1-data-model.md ## Rationale` 표에 "쿼리 범위 select 투영" 4번째 패턴 행을 추가 — 두 항목 모두 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`에 등재돼 있어 신규 작업 아님, 처리만 남음.
