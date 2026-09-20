# 신규 식별자 충돌 검토 — `spec/2-navigation/` (impl-prep, plan: sched-recalc-unit)

## 검토 대상 재확인

이번 `--impl-prep` 호출의 실제 작업 대상은 `plan/in-progress/sched-recalc-unit.md` 다. 이 plan 은:

- `spec_impact: none` 으로 명시.
- "무엇이 비었나" / "할 것" 섹션이 전부 `codebase/backend/src/modules/schedules/schedules.service.spec.ts` 에 **단위 테스트 2건 추가**만을 다룬다 (`SchedulesService.update()` 의 cron/timezone 재계산 happy-path).
- "비대상" 섹션에서 "서비스 로직 변경 — 없다. 테스트만 는다" 를 명시적으로 못박는다.

즉 이 작업은 새 요구사항 ID, 엔티티/DTO/인터페이스, API endpoint, 이벤트명, 환경변수/설정키, spec 파일 경로 중 **어느 것도 신규로 도입하지 않는다**. 프롬프트에 번들된 `spec/2-navigation/*.md` (workflow-list, trigger-list, schedule 등)는 이 plan 이 새로 쓰는 문서가 아니라, `--impl-prep` 관례상 영향 영역을 통째로 컨텍스트로 실은 **기존 spec**이다 — 신규 식별자 충돌 검토의 대상인 "target 이 새로 도입하는 식별자" 자체가 존재하지 않는다.

## 관점별 확인

1. **요구사항 ID** — 신규 ID 없음. plan 은 기존 `SchedulesService.update()` 재계산 경로에 대한 테스트만 추가.
2. **엔티티/타입명** — 신규 타입 없음. `computeNextRuns` spy 대상도 기존 함수.
3. **API endpoint** — 신규/변경 없음. `PATCH /api/schedules/:id` 는 `spec/2-navigation/3-schedule.md §4` 에 이미 정의된 기존 endpoint 이고 그대로 유지.
4. **이벤트/메시지명** — 해당 없음.
5. **환경변수·설정키** — 해당 없음.
6. **파일 경로** — 신규 spec 파일 없음. 건드리는 테스트 파일(`schedules.service.spec.ts`)도 이미 존재하는 파일.

번들에 포함된 기존 `spec/2-navigation/*.md` 상호 간(예: `1-workflow-list.md` 의 `id: workflow-list`, `2-trigger-list.md` 의 `id: trigger-list`, `3-schedule.md` 의 `id: schedule` 등) 식별자 배치도 훑었으나, 이는 이번 작업이 "새로 도입"하는 것이 아니라 기존에 이미 정착된 spec 상태이므로 이번 검토의 스코프(신규 도입 식별자) 밖이다.

## 요약

이번 `--impl-prep` 대상 plan(`sched-recalc-unit.md`)은 `spec_impact: none` 이며 순수 단위 테스트 추가로 국한되어, 신규 식별자(요구사항 ID·엔티티/타입·API endpoint·이벤트명·ENV/설정키·spec 파일 경로) 자체가 발생하지 않는다. 번들된 `spec/2-navigation/` 전체는 이번 작업이 새로 쓰는 문서가 아니라 기존 spec 컨텍스트이므로 충돌 후보가 없다.

## 위험도

NONE
