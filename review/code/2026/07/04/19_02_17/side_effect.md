# 부작용(Side Effect) Review — priority 3-tier (`ExecuteOptions.triggerType` threading)

## 점검 범위

- `ExecuteOptions` discriminated union에 `triggerType` 필드 추가(3개 union arm 전부)
- `execute()` 내부 `triggerType` 계산 로직 변경 (`options?.executedBy ? 'manual' : (options?.triggerType ?? 'webhook')`)
- `ExecutionRunJob` payload(`{ executionId, input? }`) — `triggerType` 미포함 경계
- 호출부 변경: `hooks.service.ts`(webhook L195, chat-channel L615), `schedule-runner.service.ts`(L163)
- 호출부 무변경(검증): `workflows.controller.ts`(수동 실행 L326, 단일노드 L417), `schedules.service.ts`(runNow L263), `executions.service.ts`(re-run L418)

## 발견사항

- **[INFO]** discriminated union 확장에서 세 번째(bare) variant 도 `triggerType?: never` 로 갱신되어 exhaustiveness 는 안전 — 회귀 없음
  - 위치: `execution-engine.service.ts` `export type ExecuteOptions` 세 번째 arm (`| { executedBy?: never; triggerId?: never; triggerType?: never }`)
  - 상세: 신규 필드가 3개 union arm 모두에 일관되게 반영되어(`never`/`optional` 조합) 기존 호출부가 `triggerType` 을 생략해도 타입 에러가 나지 않는다. `executedBy`-variant 호출부(workflows.controller L326/417, schedules.service L263, executions.service L418) 는 실제로 `triggerType` 을 전달하지 않으며, 이는 `triggerType?: never`(옵셔널 부재 허용) 이므로 컴파일·런타임 모두 문제 없음을 확인. 호출자 영향 없음 — 참고용 긍정 확인.

- **[INFO]** `execute()` 내부 fallback('webhook')과 `resolveExecutionRunPriority()` 내부 fallback('schedule')이 서로 다른 값으로 이중 정의되어 있으나, 현재 호출 경로에서는 후자가 도달 불가능(dead branch)
  - 위치: `execution-engine.service.ts:3243-3247` (`const triggerType: ExecutionRunTriggerType = options?.executedBy ? 'manual' : (options?.triggerType ?? 'webhook')`) vs `queues/execution-run.queue.ts` `resolveExecutionRunPriority()` (`if (triggerType && triggerType in EXECUTION_RUN_PRIORITY) {...} return EXECUTION_RUN_PRIORITY.schedule;`)
  - 상세: `execute()` 는 이제 항상 concrete `'manual'|'webhook'|'schedule'` 값을 계산해 `resolveExecutionRunPriority(triggerType)` 에 넘기므로, 그 함수 내부의 "미상/undefined → schedule" fallback 분기는 이 호출 경로에서는 절대 타지 않는다(다른 호출자가 생기면 별개). 두 fallback 값이 다르다는 사실(webhook vs schedule) 자체가 부작용을 일으키지는 않지만, 향후 다른 호출자가 `resolveExecutionRunPriority(undefined)` 를 직접 부르면 "미지정 시 schedule(최저)"이 되어 `execute()` 경로의 "미지정 시 webhook(중간)" 관례와 다른 결과가 나올 수 있어 혼동 여지가 있다.
  - 제안: 조치 불요(현재 단일 호출 경로에 한해 안전). 다만 두 fallback 정책이 다르다는 점을 `resolveExecutionRunPriority` JSDoc에 "호출자가 항상 resolved value 를 넘기는 것을 전제로 하며, 이 함수 자체의 undefined-fallback 은 별도 방어선"이라고 명시하면 향후 재사용 시 혼동을 줄일 수 있음.

- **[INFO]** `ExecutionRunJob` payload 경계 — `triggerType` 이 큐 payload 에 실리지 않음(의도된 설계, 코드로 확인됨)
  - 위치: `queues/execution-run.queue.ts:131-133` (`export interface ExecutionRunJob { executionId: string; input?: unknown; }`), `execution-engine.service.ts:3251-3259` (`this.executionRunQueue.add('execution-run', { executionId, input }, { jobId, priority: resolveExecutionRunPriority(triggerType), ...EXECUTION_RUN_QUEUE_DEFAULT_OPTS })`)
  - 상세: `triggerType` 은 `add()` 의 BullMQ job-options(`priority`) 계산에만 소비되고 job data(`ExecutionRunJob`)에는 저장되지 않는다. 이는 diff 주석·consistency-check SUMMARY(§9.3 경계)에 명시된 의도와 정확히 일치하며, `runExecutionFromQueue`/재개 경로(stalled 재배달·PR3 rehydration 등)가 `triggerType` 값을 참조하지 않는다는 뜻이다 — 재배달·재개 시 우선순위 재계산이 필요없는 설계와 일관. 부작용 없음 — 경계 준수 확인.

- **[INFO]** 신규 optional 필드이므로 기존 프로덕션 호출자(4곳, `executedBy` variant)에 대한 시그니처 파괴적 변경 없음
  - 위치: `workflows.controller.ts:326,417`, `schedules.service.ts:263`, `executions.service.ts:418`
  - 상세: 이 4개 호출부는 `triggerType` 을 생략한 채 유지되며 `executedBy` 우선 판정(`options?.executedBy ? 'manual' : ...`)에 의해 항상 `'manual'` 로 귀결 — 동작 변경 없음. `triggerId` variant 호출부 3곳(webhook, chat-channel, schedule-runner)은 diff에서 명시적으로 `triggerType` 값을 추가했고, 이는 payload 에 실리지 않는(위 항목) job priority 계산 입력일 뿐이므로 실행 이력(`Execution.triggerSource` 등 DB 컬럼)에 영향 없음.

- **[INFO]** 전역 상태·파일시스템·환경변수·네트워크 호출·이벤트/콜백 변경 없음
  - 상세: 이번 변경은 순수하게 인메모리 지역 변수(`triggerType`) 계산과 BullMQ `add()` 호출의 `priority` 옵션 값에만 영향을 준다. `EXECUTION_RUN_PRIORITY`/`resolveExecutionRunPriority`/`ExecutionRunTriggerType` 은 모두 기존 PR1 에서 이미 도입된 것을 재사용(신규 전역 아님). 새 전역 변수·파일 I/O·env read/write·외부 서비스 호출·이벤트 emit 변경 없음.

## 요약

`ExecuteOptions.triggerType` 필드 추가는 discriminated union 세 arm 모두에 일관되게(`optional`/`never`) 반영되어 기존 4개 프로덕션 호출자(모두 `executedBy` variant, `triggerType` 미전달)에 타입/런타임 영향이 없고, `triggerId` variant 를 쓰는 3개 호출자(webhook·chat-channel·schedule)는 diff에서 명시적으로 값을 추가해 의도대로 우선순위만 변경한다. `ExecutionRunJob` BullMQ payload(`{ executionId, input? }`)에는 `triggerType` 이 실리지 않아 재개/재배달 경로(PR3/PR4 rehydration, stalled 재처리)가 이 필드를 참조하지 않는다는 설계 경계가 코드로도 확인되며, 이는 diff 주석 및 impl-prep consistency-check 결과와 정합한다. `execute()` 내부 fallback('webhook')과 `resolveExecutionRunPriority` 내부 fallback('schedule')이 서로 다르다는 점은 현재 유일 호출 경로에서는 dead branch 라 실질 위험이 없는 사소한 관찰(INFO)이다. 전역 상태·파일시스템·환경변수·네트워크·이벤트 측면의 의도치 않은 부작용은 발견되지 않았다.

## 위험도
NONE

STATUS: SUCCESS
