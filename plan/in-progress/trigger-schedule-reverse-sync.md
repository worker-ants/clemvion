---
worktree: trigger-schedule-sync-f88604
started: 2026-06-10
owner: developer
---

# Trigger→Schedule 역방향 동기화 (is_active + 삭제 removeJob)

2026-06-10 spec 전수 감사 보고 ([SUMMARY](../../review/spec-coverage/2026/06/10/12_32_46/SUMMARY.md) 후속 / [plan](./spec-code-cross-audit-2026-06-10.md) 항목 3) — `spec/data-flow/10-triggers.md §1.4` 구현 갭 2건 해소.

## 계약 (SoT: spec/1-data-model.md §2.9.1, data-flow/10-triggers.md §1.4)

1. **is_active**: `PATCH /api/triggers/:id { isActive }` (schedule 타입) → schedule.is_active 동기 + active 면 `registerJob`, inactive 면 `removeJob`. (process() 는 schedule.is_active 만 보므로 동기 없이는 발사가 멈추지 않음)
2. **삭제**: `DELETE /api/triggers/:id` (schedule 타입) → `removeJob(schedule.id)` 후 trigger 삭제 (schedule row 는 FK CASCADE). 미호출 시 BullMQ scheduler 엔트리 Redis 잔존.

## 설계

- `SchedulesModule` 이 `ScheduleRunnerService` export (cycle 없음 — ExecutionEngineModule 은 TriggersModule 미참조 확인).
- `TriggersModule` 이 `SchedulesModule` import, `TriggersService` 에 `ScheduleRunnerService` + `Schedule` repository 주입 (entity 는 이미 forFeature 등재).
- `update()`: type==='schedule' && dto.isActive!==undefined → schedule 조회(by triggerId) → is_active 저장 → register/removeJob. 고아(schedule 부재) 시 graceful skip + warn 로그.
- `remove()`: type==='schedule' → schedule 조회 → 존재 시 removeJob 후 기존 삭제 로직.

## 체크리스트

- [x] /consistency-check --impl-prep (spec/2-navigation/) — BLOCK YES(3-schedule §3.1 모순) 해소 커밋 8beb1742 후 진행
- [x] 단위 테스트 선작성 (triggers.service.spec.ts — 신규 describe 7케이스)
- [x] 구현 (triggers.service/module, schedules.module export) — 커밋 59231fd7
- [x] e2e (schedule-trigger.e2e-spec.ts G/H/I 추가)
- [x] TEST WORKFLOW (lint→unit→build→e2e 전부 PASS — e2e 29 suites/179 tests, 2026-06-10 17:08)
- [ ] /ai-review + resolution
- [ ] spec 갭 표기 해소 (project-planner 역할: 1-data-model §2.9.1, data-flow/10-triggers.md §1.4) + /consistency-check --impl-done
