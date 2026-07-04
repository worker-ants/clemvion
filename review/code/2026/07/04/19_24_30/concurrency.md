# 동시성(Concurrency) Review

## 대상 변경 요약

`ExecuteOptions.triggerType`(`'manual' | 'webhook' | 'schedule'`) 필드를 신설해 `execute()` 가 BullMQ `execution-run` 큐 job 의 `priority` 값을 결정할 때 3-tier(`manual` > `webhook` > `schedule`)를 계산하도록 하는 변경. 핵심 로직:

```ts
const triggerType: ExecutionRunTriggerType = options?.executedBy
  ? 'manual'
  : (options?.triggerType ?? 'webhook');
...
priority: resolveExecutionRunPriority(triggerType),
```

`resolveExecutionRunPriority` 와 `EXECUTION_RUN_PRIORITY` 상수는 이번 diff 이전에 이미 존재하던 순수 함수/상수(`queues/execution-run.queue.ts`, 무변경 확인)이며, 이번 변경은 그 함수의 **입력값을 더 정확히 채우는** 호출부 threading(hooks.service, schedule-runner.service, execution-engine.service)과 타입 확장이 전부다. `queue.add()` 자체나 worker(consumer) 처리 로직, 락, 재시도, 동시성 cap(admission gate) 코드는 이번 diff 범위에 포함되지 않는다.

## 점검 관점별 분석

1. **경쟁 조건** — 관련 없음. `triggerType` 계산은 각 `execute()` 호출의 로컬 변수(함수 스택)이며 공유 자원을 읽거나 쓰지 않는다. 여러 요청이 동시에 `execute()` 를 호출해도 각자 독립된 클로저 내에서 삼항 연산만 수행하므로 경쟁 조건 여지가 없다.
2. **데드락** — 락을 신설·사용하지 않는다. 해당 없음.
3. **동기화** — 공유 가변 상태가 없으므로 mutex/semaphore 필요 없음. `EXECUTION_RUN_PRIORITY` 는 `as const` 리터럴 상수로 읽기 전용이며 이번 diff 로 변경되지 않았다.
4. **스레드 안전성** — Node.js 단일 이벤트 루프 모델에서 순수 값 매핑(동기 삼항 연산 + 객체 lookup)은 본질적으로 스레드 세이프. 신규 컬렉션·전역 변수 없음.
5. **async/await** — `execute()` 내 `await this.executionRunQueue.add(...)` 는 diff 이전부터 존재하던 await 지점이며 그대로 유지된다. 새로 추가된 `triggerType` 계산 라인 자체는 동기 코드라 await 대상이 아니다. 누락된 await 없음.
6. **원자성** — job 생성 시 `priority` 는 `add()` 호출 한 번에 다른 옵션(`jobId`, `EXECUTION_RUN_QUEUE_DEFAULT_OPTS`)과 함께 원자적으로 전달된다. `jobId = executionId` 기반 BullMQ dedup 은 diff 이전부터의 기존 계약이고 이번 변경으로 영향받지 않는다. priority 계산 자체는 복합 연산이 아니라 단일 삼항식이라 원자성 이슈가 발생할 여지가 없다.
7. **이벤트 루프** — 추가된 코드는 O(1) 객체 lookup(`resolveExecutionRunPriority`)이라 블로킹 없음. 콜백 체인·Promise 체인 구조도 변경 없음.
8. **리소스 풀링** — 큐/워커 concurrency 설정(예: `resolveExecutionRunWorkerConcurrency`), DB 커넥션 풀 등은 이번 diff 에서 전혀 손대지 않는다. BullMQ priority 값 변경은 워커가 job 을 꺼내는 **순서**에만 영향을 주며, 워커 풀 크기·동시 처리 한도(admission cap, PR2b 의 별도 관심사)는 그대로다.

## 부가 확인 (경계 밖이지만 동시성 인접)

- `triggerType` 은 `ExecutionRunJob` payload(BullMQ job data)에는 싣지 않고 오직 `add()` 의 `priority` 계산 입력으로만 소비된다(코드 주석 §9.3 명시) — worker 측 역직렬화·재생 로직과 무관해 큐 소비자 동시성 계약에 영향 없음.
- fallback 비대칭(`execute()` 의 `?? 'webhook'` vs `resolveExecutionRunPriority` 내부 `undefined → schedule`)은 이미 이전 ai-review 세션(`review/code/2026/07/04/19_02_17/SUMMARY.md`)에서 side_effect/testing 관점으로 지적·기록된 dead-path 항목이며, `execute()` 가 유일 호출자로 항상 resolved 리터럴을 넘기므로 동시성 관점에서도 실질 영향 없음(재확인, 신규 이슈 아님).
- priority 값 변경은 BullMQ 큐 내 대기 job 간 **처리 순서**만 바꾸며, 이는 사양(§4.3)이 의도한 정상 동작이다. 낮은 우선순위(schedule) job 이 높은 우선순위(manual/webhook) job 이 몰릴 때 기아(starvation)될 이론적 가능성은 BullMQ priority 큐의 일반적 특성이나, 이는 이번 diff 가 새로 도입한 문제가 아니라 기존 2-tier 체계에서도 동일하게 존재했던 설계 특성이다(신규 회귀 아님).

## 발견사항

없음.

## 요약

이번 변경은 BullMQ job `priority` 값을 계산하는 데 쓰이는 입력(`triggerType`)을 정교화하는 순수 값 매핑/타입 확장이며, 공유 가변 상태·락·async 흐름·워커 풀 구성에 대한 변경이 전혀 없다. 경쟁 조건, 데드락, 동기화 누락, 원자성 붕괴, 이벤트 루프 블로킹 등 동시성 문제가 발생할 코드 경로가 존재하지 않는다.

## 위험도

NONE

STATUS=success ISSUES=0
