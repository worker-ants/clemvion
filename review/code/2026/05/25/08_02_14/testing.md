# Testing Review — Phase 2 Durable Continuation Bus

검토 대상: Phase 2 BullMQ 기반 continuation 전환 (파일 1~7)

---

## 발견사항

### [CRITICAL] `ContinuationExecutionProcessor` 에 전용 단위 테스트가 없다
- 위치: `codebase/backend/src/modules/execution-engine/continuation/continuation-execution.processor.ts`
- 상세: `continuation-bus.service.spec.ts` 는 `ContinuationExecutionProcessor` 를 전혀 import 하거나 테스트하지 않는다. processor 의 `process()` 메서드는 5가지 타입 분기(`continue`, `cancel`, `button_click`, `ai_message`, `ai_end_conversation`)와 `ack-and-discard` 멱등성 분기를 포함하는 핵심 로직이다. 특히 다음 경로는 어느 spec 파일에서도 직접 검증되지 않는다.
  - `cancel` 타입: `isNodeExecutionWaiting` 호출을 건너뛰고 `applyCancellation` 을 직접 호출하는 경로
  - `ai_message` 타입: `payload?.message` 추출 후 `applyContinuation` 에 전달하는 경로
  - `ai_end_conversation` 타입 분기
  - `ack-and-discard` 분기: `isNodeExecutionWaiting` 이 false 를 반환했을 때 조기 return
  - `default` exhaustiveness guard 분기
  - `process()` 가 throw 할 때 BullMQ 가 retry 하는지 여부 (processor 자체가 예외를 삼키지 않아야 함)
- 제안: `continuation-execution.processor.spec.ts` 를 신규 작성. `ExecutionEngineService` 를 mock 하여 위 5개 타입 분기 + ack-and-discard + unknown type 경로를 각각 단위 테스트로 커버. `cancel` 타입에서 `isNodeExecutionWaiting` 이 호출되지 않는지도 명시적으로 검증.

---

### [WARNING] `applyCancellation` 에 `await` 제거가 테스트에서 검증되지 않는다
- 위치: `continuation-execution.processor.ts` line 82 (diff context)
- 상세: `cancel` 케이스에서 `await this.engine.applyCancellation(executionId)` 가 `this.engine.applyCancellation(executionId)` (await 없음) 로 변경됐다. 주석은 "sync (rejectPending 만 호출) — await 불필요" 라고 설명하지만, `applyCancellation` 이 실제로 void/sync 임을 보장하는 테스트가 없다. `applyCancellation` 이 미래에 비동기로 변경될 경우 silent fire-and-forget 이 된다.
- 제안: processor spec 에서 `cancel` 타입 테스트 시 `applyCancellation` 의 반환값이 awaited 되지 않음을 검증(예: mock 이 resolved promise 를 반환해도 process() 가 그것을 기다리지 않는다는 타이밍 검증). 또는 최소한 `execution-engine.service.spec.ts` 에서 `applyCancellation` 이 동기 호출로 완결됨을 명시적으로 표현.

---

### [WARNING] `resolveWaitingNodeExecutionId` 의 주요 분기가 단위 테스트로 커버되지 않는다
- 위치: `execution-engine.service.ts` — `resolveWaitingNodeExecutionId` (line 2863~2890)
- 상세: 이 private 메서드는 `continueExecution`, `continueButtonClick`, `continueAiConversation`, `endAiConversation` 네 곳에서 호출된다. 현재 spec 에서는 `mockNodeExecutionRepo` 가 WAITING_FOR_INPUT 을 반환하지 않도록 세팅돼 fallback sentinel `__no_node_exec__` 경로만 커버된다. 다음 분기는 테스트되지 않는다:
  - WAITING_FOR_INPUT NodeExecution 이 정확히 1건 존재할 때 실제 id 반환
  - WAITING_FOR_INPUT NodeExecution 이 2건 이상 존재할 때 `rows[0].id` 사용 + logger.warn
  - DB 조회 자체가 throw 했을 때 sentinel fallback
- 제안: `execution-engine.service.spec.ts` 에 `resolveWaitingNodeExecutionId` 전용 describe 블록 추가. `mockNodeExecutionRepo.find` 를 조작해 1건/2건+/throw 세 시나리오를 커버.

---

### [WARNING] WebSocket Gateway 의 `handleClickButton`, `handleSubmitMessage`, `handleEndConversation` 에서 `jobId=null` (Redis 장애) 분기가 테스트되지 않는다
- 위치: `websocket.gateway.spec.ts` — `handleSubmitForm` describe 블록만 2개 신규 테스트 추가됨
- 상세: Phase 2.5 에서 4개 handler 모두 `result.jobId === null` 시 `success: false` 를 반환하도록 변경됐다. 그러나 spec 에서는 `handleSubmitForm` 에 대해서만 Redis 장애 시나리오를 추가하고 나머지 3개 handler (`handleClickButton`, `handleSubmitMessage`, `handleEndConversation`) 에 대한 대응 테스트가 없다.
- 제안: `handleClickButton`, `handleSubmitMessage`, `handleEndConversation` 각각에 대해 "jobId=null 시 success=false + enqueue failed 메시지" 테스트를 추가. Phase 2.5 에서 handler 4개를 대칭적으로 변경했으므로 테스트도 대칭이어야 함.

---

### [WARNING] `rehydrateContext` 에서 Workflow 부재 경로가 단위 테스트로 커버되지 않는다
- 위치: `execution-engine.service.ts` — `rehydrateContext` 내부 `if (!workflow) throw new RehydrationError(...)`
- 상세: `Rehydration — §7.5 Resume after Restart` describe 블록(5개 테스트)에서 `RESUME_CHECKPOINT_MISSING` 을 발생시키는 케이스들을 잘 커버하고 있지만, `rehydrateContext` 의 workflow 미존재 분기는 별도 케이스로 테스트되지 않는다. `rehydrateContext` 는 `rehydrateAndResume` 내부에서 호출되므로 외부에서 이 분기에 도달하려면 mockWorkflowRepo.findOne 을 null 로 override 해야 한다.
- 제안: `Rehydration` describe 블록에 "Workflow 부재 → RESUME_CHECKPOINT_MISSING + execution 마킹" 케이스 추가. `mockWorkflowRepo.findOne.mockResolvedValueOnce(null)` 로 세팅 후 `markExecutionCancelled` 가 호출됐는지 검증.

---

### [WARNING] `resumeFromCheckpoint` 의 `waitingPointer === undefined` 분기가 테스트되지 않는다
- 위치: `execution-engine.service.ts` — `resumeFromCheckpoint` 내부 `if (waitingPointer === undefined) throw new RehydrationError(...)`
- 상세: waiting node 가 graph 의 topological sort 결과에 없는 케이스 (`waitingPointer === undefined`) 는 `RehydrationError('RESUME_CHECKPOINT_MISSING', ...)` 를 throw 하지만 이 경로를 직접 트리거하는 테스트가 없다. graph 손상 또는 workflow 정의와 NodeExecution 간 nodeId 불일치 상황에서 발생 가능하다.
- 제안: `Rehydration` describe 블록에 "waiting node 가 workflow graph 에 존재하지 않을 때 RESUME_CHECKPOINT_MISSING" 케이스 추가.

---

### [WARNING] `RESUME_FAILED` (unexpected runtime error) 경로가 테스트되지 않는다
- 위치: `execution-engine.service.ts` — `rehydrateAndResume` catch 블록 (line 786~793)
- 상세: `RehydrationError` 도 `ExecutionCancelledError` 도 아닌 일반 runtime 에러가 발생했을 때 `RESUME_FAILED` 로 마킹하는 분기가 있다. 현재 spec 에는 이 경로를 커버하는 테스트가 없다.
- 제안: `Rehydration` describe 블록에 "resumeFromCheckpoint 내부에서 예상치 못한 에러 → RESUME_FAILED + execution + nodeExecution 마킹" 케이스 추가. `mockWorkflowRepo.findOne` 또는 `mockNodeRepo.findBy` 가 unexpected Error 를 throw 하도록 세팅.

---

### [WARNING] Phase 2.7 통합 테스트의 `flushPromises` 삼중 호출이 timing 불안정을 숨길 수 있다
- 위치: `execution-engine.service.spec.ts` line 1076~1078 (diff context)
- 상세: rehydration 통합 시나리오 테스트에서 `await flushPromises()` 를 3회 연속 호출한다. 이는 `setImmediate` + 후속 promise chain 을 처리하기 위한 의도이나, 실제 `resumeFromCheckpoint` 의 `setImmediate` resolver 발화 타이밍에 따라 1회 또는 4회가 필요할 수도 있다. 테스트가 특정 flushPromises 횟수에 암묵적으로 의존하면 내부 구현 변경 시 silent failure(테스트 pass 이지만 검증이 실제로 수행 안 됨) 또는 spurious failure 가 발생한다.
- 제안: `setImmediate` 의존 로직을 감싸는 util 헬퍼를 사용하거나, `jest.runAllImmediates()` + `flushPromises()` 조합으로 의도를 명확히 표현. 또는 `setImmediate` 를 mock 해 결정적으로 제어.

---

### [WARNING] `continuation-bus.service.spec.ts` 에서 `fakeRedisInstances` 인덱스 접근이 lazy-init 타이밍에 암묵적으로 의존한다
- 위치: `continuation-bus.service.spec.ts` — "Redis 장애 (INCR 실패)" 테스트 및 "lockClient.quit() 호출" 테스트
- 상세: 두 테스트 모두 `fakeRedisInstances[0]` 에 직접 인덱스로 접근한다. ContinuationBusService 의 `lockClient` 가 lazy-init 되어 최초 publish 또는 acquireLock 호출 시 Redis 인스턴스를 생성한다. 향후 서비스 내부에서 두 개 이상의 Redis 클라이언트를 생성하면 `fakeRedisInstances[0]` 이 lock client 가 아닐 수 있어 테스트가 silent pass 되거나 wrong mock 을 검증하게 된다.
- 제안: 인덱스 `[0]` 대신 `fakeRedisInstances.find()` 또는 named reference 패턴으로 테스트 의도를 명확히 하거나, 최소한 인덱스 가정을 주석으로 명시.

---

### [INFO] `on()` no-op 검증 테스트가 logger.debug 호출 여부를 검증하지 않는다
- 위치: `continuation-bus.service.spec.ts` — `on() — Phase 2 부터 no-op` describe
- 상세: `on()` 이 throw 하지 않음만 검증하고, 실제로 deprecation logger.debug 가 호출됐는지는 검증하지 않는다. 주석 처리나 실수로 log 가 사라져도 테스트가 통과한다.
- 제안: logger.debug spy 를 추가해 `on()` 호출 시 no-op 안내 메시지가 실제로 기록되는지 검증.

---

### [INFO] `execution-engine.service.spec.ts` Phase 2.7 rehydration 통합 테스트에서 실패 케이스 없음
- 위치: `execution-engine.service.spec.ts` line 1940~1093 (diff context)
- 상세: happy-path (workflow 정상 완료) 만 검증한다. rehydration 중 DB 오류가 발생하거나 `applyContinuation` 내부에서 rehydrateAndResume 가 RESUME_CHECKPOINT_MISSING 을 반환하는 케이스는 커버되지 않는다.
- 제안: 통합 시나리오에 실패 경로 1건 이상 추가 (예: context 재구성 중 workflow not found → EXECUTION_CANCELLED 이벤트 방출 여부 검증).

---

### [INFO] `continueAiConversation` 의 10000자 초과 검증 테스트가 `async/await` 패턴으로 올바르게 수정됐으나 `endAiConversation` 유사 경계값 테스트는 없다
- 위치: `execution-engine.service.spec.ts`
- 상세: `continueAiConversation` 에 10_001자 초과 시 reject 검증이 있다. `endAiConversation` 은 메시지 인수를 받지 않으므로 해당 없음. 단, `continueAiConversation` 의 정확히 10_000자 (boundary value) 케이스는 테스트되지 않는다.
- 제안: 경계값 `'x'.repeat(10_000)` 이 throw 없이 publish 되는지 테스트 추가.

---

## 요약

Phase 2 Durable Continuation Bus 전환에서 핵심 소비자인 `ContinuationExecutionProcessor` 에 전용 단위 테스트가 전혀 없는 것이 가장 심각한 갭이다. 5개 타입 분기, `ack-and-discard` 멱등성, `cancel` 의 await-없는 호출 모두 uncovered 상태다. `rehydrateAndResume` 경로는 5건의 fast-fail 케이스 + 1건의 happy-path 통합 테스트로 상당히 커버됐으나, `rehydrateContext` 의 workflow 부재, `resumeFromCheckpoint` 의 `waitingPointer === undefined`, `RESUME_FAILED` (unexpected error) 세 분기는 여전히 테스트되지 않는다. WebSocket Gateway 측에서는 `handleSubmitForm` 에만 Redis 장애 테스트가 추가됐고 나머지 3개 handler 에는 추가되지 않아 대칭이 깨져 있다. `resolveWaitingNodeExecutionId` 의 정상 resolve / 다중 row / throw 경로도 미커버다. 기존 테스트들의 `async/await` 패턴 전환 및 `applyContinuation`/`applyCancellation` 직접 호출 방식 전환은 적절히 수행됐고 회귀 위험도는 낮으나, processor 테스트 부재는 BullMQ 워커 경로 전체의 신뢰성을 단위 테스트 수준에서 보장하지 못한다.

## 위험도

HIGH

STATUS: SUCCESS
