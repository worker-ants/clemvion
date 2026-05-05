# 실행 트리거 메타데이터 보존 수정

## 배경

대시보드 "최근 실행" 테이블의 트리거 컬럼이 **스케줄러로 자동 실행된 워크플로우**에 대해 `?` 아이콘 + `—` (unknown) 으로 표시되고 있었다. 수동 실행은 "수동 실행 + 사용자명"으로 정상 표시.

원인은 백엔드 `ExecutionEngineService.execute()` 시그니처가 `(workflowId, input?, executedBy?)` 로 한정되어 **`triggerId` 를 받을 수 없다는 점**. 결과적으로 `ScheduleRunnerService.process()` (cron 자동 실행) 와 `HooksService.handleWebhook()` (웹훅) 이 호출할 때 `Execution.triggerId === NULL` 로 저장되고, `deriveExecutionTrigger()` 가 `unknown` 을 반환했다.

스펙 정합:
- `spec/2-navigation/6-execution-history.md §2.4` 의 분류 규칙 (subworkflow > manual > schedule > webhook > unknown) 은 이미 `deriveExecutionTrigger()` 에 구현돼 있음.
- 응답 DTO `ExecutionDto` 도 이미 `triggerSource`/`triggerLabel` 을 노출.
- 누락된 것은 **저장 시 trigger_id 채우기** 한 가지.

사용자 결정: **스케줄 + Webhook 둘 다 수정**, **신규 실행만 정상화 (백필 없음)**.

## 작업 항목

- [x] `ExecutionEngineService.execute()` 시그니처를 옵션 객체로 변경 (`{ executedBy?, triggerId? }` 판별 유니온)
- [x] `Execution` row 생성 시 `triggerId` 도 함께 저장
- [x] 호출자 4곳 마이그레이션
  - [x] `workflows.controller.ts` — 수동 실행 (`{ executedBy: user.sub }`)
  - [x] `schedules.service.ts` `runNow` — "지금 실행" (`{ executedBy: userId }`, manual 라벨 유지)
  - [x] `schedule-runner.service.ts` `process` — cron 자동 (`{ triggerId: schedule.triggerId }`)
  - [x] `hooks.service.ts` `handleWebhook` — 웹훅 (`{ triggerId: trigger.id }`)
- [x] 테스트 작성·갱신
  - [x] `execution-engine.service.spec.ts` — 새 옵션 객체 시그니처 검증, triggerId 저장 검증
  - [x] `schedule-runner.service.spec.ts` — `process()` 가 `{ triggerId: schedule.triggerId }` 로 호출하는지 + lastRunAt/nextRunAt 갱신 + error re-throw + skip 경로 no-save
  - [x] `hooks.service.spec.ts` — webhook 핸들러가 `{ triggerId: trigger.id }` 로 호출하는지
  - [x] `workflows.controller.spec.ts`, `schedules.service.spec.ts` — 시그니처 변경에 맞춰 mock 인자 갱신
- [x] 스펙 문서 갱신
  - [x] `spec/5-system/4-execution-engine.md §6.1.1` — `execute()` 시그니처 옵션 객체화 반영
  - [x] `spec/5-system/5-webhook.md §7` — webhook 처리 흐름에 `{ triggerId: trigger.id }` 명시
  - [x] `spec/2-navigation/3-schedule.md` — §5 "실행 출처 기록 규약" 추가
- [x] TEST WORKFLOW (lint → unit → build). e2e 는 본 작업 무관 환경 문제(uuid ESM)로 사전 실패 — 별도 작업 필요
- [x] REVIEW WORKFLOW
  - [x] `ai-review` 실행 (`review/2026-05-05_22-52-18/`)
  - [x] Warning 11건 조치 + Info 4건 처리 (`RESOLUTION.md`)
  - [x] hooks.service Bearer/HMAC 보안 강화 (`constantTimeEquals` 헬퍼)
  - [x] `ExecuteOptions` named 판별 유니온 export
  - [x] TEST WORKFLOW 재통과 (167 suites / 2715 tests / build OK)

## 변경하지 않은 것

- DB 스키마 — `Execution.triggerId` 는 이미 nullable 컬럼으로 존재
- 프론트엔드 — `TriggerCell` 과 `ExecutionData` 타입은 이미 schedule/webhook 처리
- 응답 DTO `ExecutionDto` — 이미 모든 필드 노출 중
- 과거 unknown 실행 레코드 — 백필 없음 (사용자 결정)
- `Execution.trigger_id` 단독 인덱스 — 현 쿼리 패턴(`workflow_id` 1차 필터)에서 즉시 필요하지 않아 별도 작업으로 분리 (RESOLUTION W11 참조)
- e2e 테스트 ts-jest uuid ESM 변환 설정 — 본 작업 이전부터의 환경 문제, 별도 작업으로 분리

## 핵심 파일

- `backend/src/modules/execution-engine/execution-engine.service.ts` (시그니처 + 저장 + `ExecuteOptions` export)
- `backend/src/modules/schedules/schedule-runner.service.ts:163-167` (cron 경로)
- `backend/src/modules/hooks/hooks.service.ts:96-100` (웹훅 경로 + 보안 강화)
- `backend/src/modules/workflows/workflows.controller.ts:250-254` (수동 경로)
- `backend/src/modules/schedules/schedules.service.ts:206-210` (runNow)

## 결과

- 커밋 `dd4d9e93` (docs) → `7c185959` (fix) → `27821e30` (style) → REVIEW 단일 커밋
- 전체 테스트: 167 suites / 2715 tests passed
- 트리거 출처 분류가 신규 실행에 대해 정상 동작 (manual / schedule / webhook 모두)
