# 실행 트리거 메타데이터 보존 수정

## 배경

대시보드 "최근 실행" 테이블의 트리거 컬럼이 **스케줄러로 자동 실행된 워크플로우**에 대해 `?` 아이콘 + `—` (unknown) 으로 표시되고 있다. 수동 실행은 "수동 실행 + 사용자명"으로 정상 표시.

원인은 백엔드 `ExecutionEngineService.execute()` 시그니처가 `(workflowId, input?, executedBy?)` 로 한정되어 **`triggerId` 를 받을 수 없다는 점**. 결과적으로 `ScheduleRunnerService.process()` (cron 자동 실행) 와 `HooksService.handleWebhook()` (웹훅) 이 호출할 때 `Execution.triggerId === NULL` 로 저장되고, `deriveExecutionTrigger()` 가 `unknown` 을 반환한다.

스펙 정합:
- `spec/2-navigation/6-execution-history.md §2.4` 의 분류 규칙 (subworkflow > manual > schedule > webhook > unknown) 은 이미 `deriveExecutionTrigger()` 에 구현돼 있음.
- 응답 DTO `ExecutionDto` 도 이미 `triggerSource`/`triggerLabel` 을 노출.
- 누락된 것은 **저장 시 trigger_id 채우기** 한 가지.

사용자 결정: **스케줄 + Webhook 둘 다 수정**, **신규 실행만 정상화 (백필 없음)**.

## 작업 항목

- [ ] `ExecutionEngineService.execute()` 시그니처를 옵션 객체로 변경 (`{ executedBy?, triggerId? }`)
- [ ] `Execution` row 생성 시 `triggerId` 도 함께 저장
- [ ] 호출자 4곳 마이그레이션
  - [ ] `workflows.controller.ts` — 수동 실행 (`{ executedBy: user.sub }`)
  - [ ] `schedules.service.ts` `runNow` — "지금 실행" (`{ executedBy: userId }`, manual 라벨 유지)
  - [ ] `schedule-runner.service.ts` `process` — cron 자동 (`{ triggerId: schedule.triggerId }`)
  - [ ] `hooks.service.ts` `handleWebhook` — 웹훅 (`{ triggerId: trigger.id }`)
- [ ] 테스트 작성·갱신
  - [ ] `execution-engine.service.spec.ts` — 새 옵션 객체 시그니처 검증, triggerId 저장 검증
  - [ ] `schedule-runner.service.spec.ts` — `process()` 가 `{ triggerId: schedule.triggerId }` 로 호출하는지
  - [ ] `hooks.service.spec.ts` — webhook 핸들러가 `{ triggerId: trigger.id }` 로 호출하는지
  - [ ] `workflows.controller.spec.ts`, `schedules.service.spec.ts` — 시그니처 변경에 맞춰 mock 인자 갱신
- [ ] 스펙 문서 갱신
  - [ ] `spec/5-system/4-execution-engine.md §6.1.1` — `execute()` 시그니처 옵션 객체화 반영
  - [ ] `spec/5-system/5-webhook.md §7` — webhook 처리 흐름에 `{ triggerId: trigger.id }` 명시
  - [ ] `spec/2-navigation/3-schedule.md` (해당 시) — cron 자동 실행 시 `triggerId` 채움 명시
- [ ] TEST WORKFLOW (lint → unit → e2e → build)
- [ ] REVIEW WORKFLOW (`ai-review` → 이슈 조치 → `RESOLUTION.md`)

## 변경하지 않을 것

- DB 스키마 — `Execution.triggerId` 는 이미 nullable 컬럼으로 존재
- 프론트엔드 — `TriggerCell` 과 `ExecutionData` 타입은 이미 schedule/webhook 처리
- 응답 DTO `ExecutionDto` — 이미 모든 필드 노출 중
- 과거 unknown 실행 레코드 — 백필 없음 (사용자 결정)

## 핵심 파일

- `backend/src/modules/execution-engine/execution-engine.service.ts:365-399`
- `backend/src/modules/schedules/schedule-runner.service.ts:163-166`
- `backend/src/modules/hooks/hooks.service.ts:96-99`
- `backend/src/modules/workflows/workflows.controller.ts:250-254`
- `backend/src/modules/schedules/schedules.service.ts:206-210`

## 검증 시나리오

1. 분 단위 cron 스케줄 (`*/1 * * * *`) 등록 → 자동 발화 → 최근 실행에 시계 아이콘 + 트리거명 표시
2. webhook 트리거를 가진 워크플로우에 POST → 최근 실행에 webhook 아이콘 + 트리거명 표시
3. 수동 실행 ▶ → "수동 실행 + 내 이름" 회귀 없음
4. 스케줄 "지금 실행" 버튼 → "수동 실행 + 내 이름" (현 동작 유지)
