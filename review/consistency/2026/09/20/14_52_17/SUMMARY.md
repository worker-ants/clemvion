# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 5개 checker 전원 정상 결과 확보(전문 인라인 확인, 재시도 필요 항목 없음).

## 전체 위험도
**LOW** — spec 델타 0, diff 는 `schedules.service.spec.ts` 단위 테스트 추가뿐. 유일한 관찰 사항은 다른 스펙 파일과의 동명 로컬 헬퍼 이름 충돌(WARNING, 스코프 격리로 실질 충돌 없음).

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | naming_collision | 로컬 테스트 헬퍼 `scheduleRow` 가 다른 스펙 파일의 동명 헬퍼와 이름은 같고 시그니처·반환 shape 는 다름 | `codebase/backend/src/modules/schedules/schedules.service.spec.ts:373` (`function scheduleRow(overrides: Partial<Schedule> = {}): Schedule`, id `sch-1`, `nextRunAt` 포함) | `codebase/backend/src/modules/triggers/triggers.service.spec.ts:2293` (`const scheduleRow = () => ({...}) as unknown as Schedule`, 무인자, id `sched-1`, `nextRunAt` 없음) | 필수 조치 아님(파일-지역 스코프라 컴파일/런타임 충돌 없음). 후속 정리 시 `buildScheduleRow(overrides)` 또는 `triggerScheduleRow` 등으로 개명해 "무엇의 schedule 행인지" 이름에서 구분 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | plan_coherence | 트래커(`spec-draft-nullable-notation-followups.md` 4933행)와 `sched-recalc-unit.md` 자체 체크리스트(`/ai-review` 수렴·`--impl-done`·트래커 해소·`plan/complete/` 이동)가 아직 미체크 — 이번 impl-done 검토가 그 선행 단계이므로 순서상 정상 | `plan/in-progress/spec-draft-nullable-notation-followups.md:4933`, `plan/in-progress/sched-recalc-unit.md` | 이번 라운드 `/ai-review` 수렴 확인 후, 두 문서 모두 해소 처리하고 `sched-recalc-unit.md` 를 `plan/complete/` 로 이동하는 마무리 커밋 진행 |
| 2 | naming_collision | 검토 scope(`spec/2-navigation/`)와 실제 diff(schedules 서비스 유닛 테스트)가 물리적으로 분리 — 코드 전용 PR 의 정상 형태 | (spec 델타 0) | 조치 불필요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | spec 델타 0, diff 는 기존 재계산 게이트(`schedules.service.ts:266-267`)를 관측하는 테스트뿐. 새 식별자·계약·상태전이 없음 |
| rationale_continuity | NONE | `2-trigger-list.md` §2.3.1 이 이미 명문화한 "수정 시 `nextRunAt` 재계산"을 결정적으로 고정할 뿐. 기각 대안 재도입·원칙 위반·무근거 번복·암묵 가정 충돌 없음 |
| convention_compliance | NONE | 신규 API/DTO/이벤트/에러코드/식별자 없음. `spec-impl-evidence.md` 의 `code:` 등재 의무는 spec 본문에 이 테스트를 지목하는 註가 없어 미적용 |
| plan_coherence | NONE | `spec_impact: none` 과 실제 diff 일치. 미해결 결정·선행 plan·후속 항목 충돌 없음. 트래커·plan 체크리스트 마무리는 후속 커밋 예정(INFO) |
| naming_collision | LOW | `scheduleRow` 동명 헬퍼가 `triggers.service.spec.ts` 에도 존재(시그니처·shape 상이) — 스코프 격리로 CRITICAL 아님(WARNING) |

## 권장 조치사항
1. (BLOCK 없음 — 필수 조치 없음) 선택: `scheduleRow` 헬퍼명을 `buildScheduleRow`/`triggerScheduleRow` 등으로 구분해 두 스펙 파일 간 오인 여지 제거.
2. `/ai-review` 수렴 확인 후 `sched-recalc-unit.md` 체크리스트 완료 + `spec-draft-nullable-notation-followups.md` 4933행 해소 + `plan/complete/` 이동을 포함한 마무리 커밋 진행.
