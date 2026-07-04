# 동시성(Concurrency) Review — priority 3-tier (triggerType threading)

## 리뷰 범위

- `ExecuteOptions` 에 `triggerType?: ExecutionRunTriggerType` 필드 추가 (`execution-engine.service.ts`).
- `execute()` 내부 `triggerType` 판정 로직을 `executedBy ? 'manual' : (options?.triggerType ?? 'webhook')` 로 갱신.
- `resolveExecutionRunPriority(triggerType)` 호출로 BullMQ `queue.add()` 의 `priority` 옵션(정수) 산출 — 이 값 자체는 이번 diff 의 대상이 아니고 기존 구현(`execution-run.queue.ts`)을 그대로 재사용.
- 호출부 3곳(`hooks.service.ts` webhook/chat-channel, `schedule-runner.service.ts`)이 `triggerType: 'webhook'`/`'schedule'` 리터럴을 추가 전달.
- 나머지 변경 파일(스펙 문서, plan, consistency-check 산출물)은 순수 문서/메타데이터로 동시성과 무관.

## 발견사항

- **[INFO]** `priority` 계산은 순수 함수 — 공유 상태 없음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3250-3258`
  - 상세: `triggerType` 판정은 매 `execute()` 호출마다 지역 변수로 계산되고 `resolveExecutionRunPriority`(순수 함수, `execution-run.queue.ts:39-46`)에 값으로 전달된다. 인스턴스 필드나 모듈 스코프 mutable 상태를 읽거나 쓰지 않으므로 동시 `execute()` 호출 간 경쟁 조건 가능성이 없다.
  - 제안: 없음(현행 유지).

- **[INFO]** BullMQ `priority` 는 스케줄링 힌트일 뿐 원자성·순서를 보장하지 않음(기존 동작, 이번 diff 로 변경 없음)
  - 위치: `execution-run.queue.ts:22-46`, `execution-engine.service.ts:3258` (`this.executionRunQueue.add(..., { priority: resolveExecutionRunPriority(triggerType), ... })`)
  - 상세: BullMQ priority queue 는 "낮은 숫자가 먼저" 정렬을 제공하지만, 여러 worker 인스턴스가 work-stealing 으로 동시에 job 을 가져가는 구조(§4 work-stealing)에서는 엄격한 FIFO/우선순위 순서 보장이 아니라 근사적 순서 보장이다. 3-tier 세분화(`manual`>`webhook`>`schedule`)가 추가돼도 이 특성 자체는 바뀌지 않으며, `jobId = executionId` dedup 규약(PR1)도 그대로 유지되어 동일 Execution 이중 enqueue 위험은 없다. 새 필드가 이 기존 불변식을 깨지 않는다.
  - 제안: 없음(관찰 사항, 기존 설계 그대로).

- **[INFO]** `resolveExecutionRunPriority` 의 fallback 분기(`schedule`)는 이번 호출 경로에서 도달 불가능(dead branch) — 방어적 설계이나 사소한 비대칭
  - 위치: `execution-run.queue.ts:39-46` vs `execution-engine.service.ts:3250-3252`
  - 상세: `resolveExecutionRunPriority` 는 `triggerType` 이 `undefined`/미인식이면 최저 우선순위(`schedule`)로 방어한다는 주석(L36-37)을 갖고 있다. 그러나 `execute()` 는 항상 `triggerType` 을 `'manual'` 아니면 `options?.triggerType ?? 'webhook'` 로 **미리 확정**해서 넘기므로, 이 호출 경로에서는 `resolveExecutionRunPriority` 의 `undefined`/미인식 분기가 실질적으로 도달하지 않는다(`ExecutionRunTriggerType` 타입 자체가 3개 리터럴만 허용해 컴파일 타임에도 그 외 값이 들어올 수 없음). 동시성 결함은 아니며 단지 두 함수의 fallback 정책이 다르다는(하나는 `webhook`, 하나는 `schedule`) 사소한 설계 비대칭 — race/atomicity 와 무관.
  - 제안: 코드 변경 불요. 필요 시 주석으로 "이 호출부에서는 항상 확정된 값만 전달되어 이 fallback 은 미도달" 을 명시할 수 있으나 INFO 수준.

- **[INFO]** 테스트(`execution-engine.service.spec.ts`)의 3-tier 검증은 동시 실행이 아닌 순차 `await` 호출 — async/await 사용 적절
  - 위치: `execution-engine.service.spec.ts:43-66` (`triggerType threading` 테스트)
  - 상세: 세 번의 `await service.execute(...)` 호출이 순차적으로 실행되고 각각의 `mockExecutionRunQueue.add.mock.calls[i][2]` 를 인덱스로 검증한다. `await` 누락이나 fire-and-forget 패턴 없음 — mock 호출 순서가 결정적으로 보장된다.
  - 제안: 없음.

이번 diff 자체는 "어떤 정수 priority 값을 BullMQ `add()` 에 넘길지" 판정 로직만 다루며, 공유 mutable 상태·락·await 누락·경쟁 조건을 유발하는 요소가 없다. `jobId = executionId` 기반 dedup, work-stealing 분산, `waiting_for_input` durable park 등 기존 동시성 불변식에는 아무 영향이 없다 (§4.2 active-running 직렬화 불변식도 이번 변경으로 재검증 대상 아님 — priority 는 스케줄링 순서에만 관여하고 실행 상태 전이 로직을 건드리지 않음).

## 요약

변경은 BullMQ job `priority` 옵션을 계산하는 순수 값 매핑(`triggerType → 정수`)의 세분화(2-tier→3-tier)이며, 공유 자원 접근·락·비동기 제어 흐름·원자적 상태 전이를 전혀 건드리지 않는다. 호출부 추가 인자 전달도 리터럴 값 threading 에 그쳐 경쟁 조건이나 데드락을 유발할 여지가 없고, 기존 `jobId=executionId` dedup 및 work-stealing 동시성 모델은 그대로 보존된다. 발견된 사항은 모두 INFO 수준의 관찰(순수 함수 확인, fallback 정책 비대칭 등)이며 실제 결함은 없다.

## 위험도
NONE

STATUS: SUCCESS
