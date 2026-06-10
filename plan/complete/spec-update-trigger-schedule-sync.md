---
worktree: trigger-schedule-sync-f88604
started: 2026-06-10
owner: resolution-applier
spec_impact:
  - spec/1-data-model.md
  - spec/data-flow/10-triggers.md
  - spec/2-navigation/3-schedule.md
  - spec/2-navigation/2-trigger-list.md
---
# Spec Update Draft — trigger-schedule 역방향 동기화 갭 표기 해소

## 분류
SPEC-DRIFT (코드 개선을 spec 에 반영) — 구현(커밋 59231fd7)이 이미 갭을 해소했으므로 spec 의 "구현 갭" 표기를 현행 구현으로 갱신한다. 코드 revert 절대 금지.

## 원본 발견사항
- SUMMARY Critical #1: `PATCH /api/triggers/:id { isActive }` 가 schedule.is_active 와 BullMQ job 을 갱신하지 않음 — 실제로는 커밋 59231fd7 로 `syncScheduleActivation()` 구현 완료
- SUMMARY Critical #2: `DELETE /api/triggers/:id` 가 `removeJob` 미호출 — 실제로는 커밋 59231fd7 로 `remove()` 내 `removeJob` 호출 구현 완료
- SUMMARY Warning #3: Critical #1 과 동일 (보안 관점 중복)
- INFO #10/#11: 갭 표기가 아직 spec 에 남아 있음을 지적

## 갱신 대상 4곳 (before/after)

### 1. `spec/1-data-model.md §2.9.1` (줄 257 부근)

**Before:**
```
| Schedule is_active 변경 | 연결된 Trigger is_active도 동기화 (역방향 Trigger→Schedule 동기화는 **미구현 — 구현 갭**, [data-flow §1.2](./data-flow/10-triggers.md) 참조) |
```

**After:**
```
| Schedule is_active 변경 | 연결된 Trigger is_active도 동기화. Trigger→Schedule 역방향도 구현됨 — `PATCH /api/triggers/:id { isActive }` 가 schedule.is_active 와 BullMQ job 을 함께 갱신 ([data-flow §1.4](./data-flow/10-triggers.md#14-schedule--trigger-동기화) 참조) |
```

### 2. `spec/data-flow/10-triggers.md §1.4` — 표 및 구현 갭 blockquote

**Before (표 행):**
```
| Schedule is_active 토글 | UPDATE schedule.is_active → UPDATE trigger.is_active. active 면 `registerJob`, inactive 면 `removeJob` 으로 BullMQ job 등록/해제 | **역방향 미구현 (구현 갭, 아래)** |
| Schedule 삭제 | `removeJob` 으로 BullMQ job 해제 + CASCADE delete trigger | Trigger API 직접 삭제는 `removeJob` 누락 (구현 갭, 아래) |
```

**After (표 행):**
```
| Schedule is_active 토글 | UPDATE schedule.is_active → UPDATE trigger.is_active. active 면 `registerJob`, inactive 면 `removeJob` 으로 BullMQ job 등록/해제 | `PATCH /api/triggers/:id { isActive }` 도 schedule.is_active + BullMQ job 갱신 (`syncScheduleActivation`) |
| Schedule 삭제 | `removeJob` 으로 BullMQ job 해제 + CASCADE delete trigger | `DELETE /api/triggers/:id` 도 schedule 조회 후 `removeJob` 호출 — Redis 잔존 없음 |
```

**Before (구현 갭 blockquote, 줄 139~142):**
```
> **구현 갭 — 역방향(Trigger→Schedule) 동기화 부재**: ...
> - **is_active**: 트리거 목록 화면이 schedule 타입 트리거에도 노출하는 `PATCH /api/triggers/:id { isActive }` 는 trigger row 만 갱신한다 — `triggers.service.ts` update() 는 `scheduleRepository` 쓰기·`ScheduleRunnerService.registerJob/removeJob` 호출이 없다 ...
> - **삭제**: `DELETE /api/triggers/:id` ... `removeJob` 을 호출하지 않아 BullMQ job scheduler 엔트리(`schedule:<id>`)가 Redis 에 잔존한다 ...
```

**After (구현 갭 제거, 대신 구현 현황 기술):**
```
> **구현 현황 — 역방향(Trigger→Schedule) 동기화**: 2026-06-10 커밋(59231fd7)으로 양방향 동기화가 완성되었다.
>
> - **is_active**: `PATCH /api/triggers/:id { isActive }` (schedule 타입) → `triggers.service.ts syncScheduleActivation()` 이 schedule.is_active 저장 + active 면 `registerJob`, inactive 면 `removeJob`. `ScheduleProcessor` 는 `schedule.is_active` 만 보므로 동기가 없으면 발사가 멈추지 않는 문제 해소.
> - **삭제**: `DELETE /api/triggers/:id` (schedule 타입) → `remove()` 가 schedule 조회 후 `removeJob` 호출, 이후 trigger row 삭제 (FK CASCADE 로 schedule row 함께 삭제). Redis 잔존 없음.
```

**Before (§1.3 > 주석 내 갭 언급, 줄 124):**
```
> ... process() 는 `trigger.is_active` 를 직접 보지 않고 `schedule.is_active` 만 확인한다 (동기화는 Schedule→Trigger 정방향만 구현 — §1.4 구현 갭 참조).
```

**After:**
```
> ... process() 는 `trigger.is_active` 를 직접 보지 않고 `schedule.is_active` 만 확인한다 (Trigger→Schedule 역방향 동기화는 §1.4 참조).
```

### 3. `spec/2-navigation/3-schedule.md §3.1` (줄 115, 120 부근)

**Before (줄 115):**
```
| Schedule 활성/비활성 | 연결된 Trigger is_active 동기화 (역방향 Trigger→Schedule 동기화는 **미구현 — 구현 갭**, [data-flow §1.4](../data-flow/10-triggers.md#14-schedule--trigger-동기화) 참조) |
```

**After:**
```
| Schedule 활성/비활성 | 연결된 Trigger is_active 동기화 (역방향 Trigger→Schedule 동기화도 구현됨 — `PATCH /api/triggers/:id { isActive }` 가 schedule.is_active + BullMQ job 갱신. [data-flow §1.4](../data-flow/10-triggers.md#14-schedule--trigger-동기화) 참조) |
```

**Before (줄 120):**
```
- Schedule 화면에서 삭제 시 Trigger도 함께 삭제됨 (역방향: Trigger 삭제 시 Schedule 도 FK CASCADE 로 삭제되나, BullMQ `removeJob` 미호출로 Redis job scheduler 엔트리가 잔존하는 구현 갭 — [data-flow §1.4](../data-flow/10-triggers.md#14-schedule--trigger-동기화))
```

**After:**
```
- Schedule 화면에서 삭제 시 Trigger도 함께 삭제됨 (역방향: Trigger 삭제 시 Schedule 도 FK CASCADE 로 삭제되며, `DELETE /api/triggers/:id` 도 schedule 조회 후 `removeJob` 을 호출해 Redis 잔존 없음 — [data-flow §1.4](../data-flow/10-triggers.md#14-schedule--trigger-동기화))
```

### 4. `spec/data-flow/10-triggers.md §3.1` — `trigger.is_active` 상태 표 (줄 202)

**Before:**
```
Schedule 과의 동기화는 **Schedule→Trigger 정방향만** 구현되어 있다 — Schedule 쪽 변경 시 trigger.is_active 가 함께 갱신되고 §1.4 대로 BullMQ job 도 register/remove 되지만, Trigger API 쪽 `PATCH { isActive }` 는 schedule.is_active 와 BullMQ job 을 갱신하지 않는다 ([Spec 데이터 모델 §2.9.1](../1-data-model.md) 의 양방향 계약 대비 구현 갭 — §1.4 참조).
```

**After:**
```
Schedule 과의 동기화는 양방향 모두 구현되어 있다 — Schedule 쪽 변경 시 trigger.is_active 가 함께 갱신되고, Trigger API 쪽 `PATCH { isActive }` 도 schedule.is_active 와 BullMQ job 을 `syncScheduleActivation()` 으로 갱신한다 ([Spec 데이터 모델 §2.9.1](../1-data-model.md) 의 양방향 계약 이행 — §1.4 참조).
```

## 추가 정보
- 구현 커밋: 59231fd7 (`feat(triggers): Trigger→Schedule 역방향 동기화`)
- 테스트 커밋: 2838fcc0 (`test(triggers): 역방향 동기화 e2e 3건`)
- 관련 plan: `plan/in-progress/trigger-schedule-reverse-sync.md` (마지막 2개 체크박스 해소)
- 연관 spec 파일: `spec/2-navigation/2-trigger-list.md` §4.3 — 검토 완료(2026-06-10 --impl-done 재검): removeJob 동작 반영 완료, 추가 수정 불필요
