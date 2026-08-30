# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — `updateExecutionStatus` else 분기를 트랜잭션으로 감싼 원자성 확장은 spec·code·plan 전반과 정합하나, Rationale 기록 위치와 plan 후속 항목 체크박스 정정 2건이 남아 있다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity | else 분기 guarded UPDATE 를 트랜잭션으로 감싸는 원자성 확장 결정에 `## Rationale` 전용 항목이 없다 — schema 표 각주로만 존재 | `spec/data-flow/3-execution.md` §2.1 (2026-08-30 각주) | `spec/5-system/4-execution-engine.md` `## Rationale` "dead-letter 마감의 원자성 (2026-08-15 원자화)" 항 — 동형 결정이 그때는 전용 Rationale 불릿을 받음 | `4-execution-engine.md` `## Rationale` 에 "`updateExecutionStatus` else 분기 원자화 (2026-08-30)" 항목을 형제로 추가: (i) 이전 상태가 "트랜잭션 밖" 한계였다는 사실, (ii) 그 한계가 낳는 실제 결함(가드 발동 시 무기한 대기), (iii) 트랜잭션 원자화로 해소했다는 결론. `3-execution.md` 각주는 그 항목을 가리키도록 링크 조정 |
| 2 | plan_coherence | `updateExecutionStatus` 두 분기 마무리 블록 중복 — 이번 diff 로 이미 해소됐는데 다른 in-progress plan 의 열린 후속 항목이 그 사실을 반영 못 함 | `codebase/backend/.../execution-engine.service.ts` 신설 `finishStatusTransition` 헬퍼 | `plan/in-progress/ie-resume-turn-boundary-cancel.md` 307~310행 "`updateExecutionStatus` 두 분기의 4줄 마무리 블록 중복 (ai-review WARNING #6)" (2026-07-26 등재, "코드 변경 없음"으로 방치) | 해당 항목을 `[x]` 로 닫고 "완료 (2026-08-30) — `finishStatusTransition` 헬퍼로 해소, 이번 diff (`execution-engine.service.ts`)" 각주 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | convention_compliance | Schema 매핑 표 헤더가 `0-overview.md` §3.3 템플릿 문구와 다름 (`Sink (table)/흐름/read·write 컬럼` vs `Sink/Table·Key/갱신 컬럼·Pattern`) — 이번 PR 도입 아닌 기존 drift | `spec/data-flow/3-execution.md` §2.1 표 헤더 | 이번 PR 범위 조치 불요. 후속으로 §3.3 템플릿 문구를 실제 관행에 맞추거나 전 영역 표 헤더를 통일하는 별도 정리 plan 고려 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | target 변경이 동시 갱신된 `5-system/4-execution-engine.md` §1.1 각주·코드 diff와 완전 정합. 상태머신·엔티티·API·RBAC 무변경 |
| rationale_continuity | LOW | 원자성 확장 결정 자체는 기존 원칙(원자성 보장)을 더 철저히 이행하는 방향. 다만 전용 `## Rationale` 항목 부재 (WARNING 1건) |
| convention_compliance | LOW | raw-query-results·error-codes·문서 3섹션 구조·명명 규약 모두 준수. 표 헤더 drift는 기존 것 (INFO 1건) |
| plan_coherence | LOW | 이번 diff 는 `backend-lint-gate-broken-on-main.md`·`update-returning-tuple-shape.md` 후속 항목을 정확히 이행. 다만 `ie-resume-turn-boundary-cancel.md` 의 별개 후속 항목이 부수적으로 해소됐는데 미반영 (WARNING 1건) |
| naming_collision | NONE | 신규 식별자는 private 헬퍼 `finishStatusTransition` 뿐이며 저장소 전체에서 유일 정의·사용, spec 미노출. 요구사항 ID·엔티티·API·이벤트·ENV·경로 신규 도입 없음 |

## 권장 조치사항
1. `plan/in-progress/ie-resume-turn-boundary-cancel.md` 307~310행 WARNING #6 항목을 `[x]` 로 닫고 완료 각주 추가 (실제 코드 변경이 이미 이 PR 에 존재하므로 문서만 정정하면 됨).
2. `spec/5-system/4-execution-engine.md` `## Rationale` 에 이번 트랜잭션 원자화 결정의 배경(이전 한계 → 실제 결함 → 해소)을 요약한 전용 항목을 추가하고, `spec/data-flow/3-execution.md` 각주가 그 항목을 링크하도록 조정.
3. (선택, 비긴급) `spec/data-flow/0-overview.md` §3.3 Schema 매핑 표 템플릿 문구와 실제 표 헤더 관행 간 drift 를 정리하는 후속 plan 항목 등록 고려.