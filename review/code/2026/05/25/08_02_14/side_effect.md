# 부작용(Side Effect) 리뷰 결과

리뷰 대상: Phase 2 Durable Continuation BullMQ 기반 재설계 (17개 파일)
리뷰 일시: 2026-05-25

---

## 발견사항

### [CRITICAL] `continuation-execution.processor.ts` — `applyCancellation` 의 `await` 제거로 인한 fire-and-forget 전환

- 위치: `continuation-execution.processor.ts` diff, `-        await this.engine.applyCancellation(executionId);` → `+        this.engine.applyCancellation(executionId);`
- 상세: 주석에 "applyCancellation 은 sync (rejectPending 만 호출) — await 불필요" 라고 작성되어 있으나, `applyCancellation` 이 진짜 sync 인지는 diff 만으로는 검증 불가능하다. 만약 `applyCancellation` 이 내부적으로 `rejectPending` 외에 DB 접근(NodeExecution 상태 업데이트, `markNodeExecutionFailed` 등)을 수행하거나 미래에 async 로직이 추가될 경우, 호출자가 `await` 없이 떠나버리므로:
  1. BullMQ Worker 의 `process()` 가 즉시 resolve 하여 Job 이 COMPLETED 로 마킹되지만, 실제 cancellation 후처리가 완료되지 않을 수 있다.
  2. 처리 중 예외가 발생해도 호출자가 catch 할 수 없으므로 unhandled rejection 으로 소실된다.
  3. `applyCancellation` 이 `executionRepository.save` 또는 `markExecutionCancelled` 를 내부적으로 수행한다면, 서비스 shutdown 타이밍에 DB 쓰기가 중단될 수 있다.
- 제안: `applyCancellation` 이 sync 임을 타입 시스템 수준에서 보장하거나 (`Promise` 미반환 확인), 아니면 안전을 위해 `await` 를 복원한다. 최소한 `void this.engine.applyCancellation(executionId)` 로 명시적 fire-and-forget 의도를 표현하고, 미래 async 전환 시 await 추가 필요함을 TODO 로 남긴다.

---

### [WARNING] `execution-engine.service.ts` — `resumeFromCheckpoint` 내 `setImmediate` 폴링 클로저가 `this.pendingContinuations` 공유 상태를 비동기 시점에 읽음

- 위치: `execution-engine.service.ts` diff — `rehydrateAndResume` → `resumeFromCheckpoint` → `firePayload(attemptsLeft)` 클로저 (diff 는 truncate 로 `const firePayload = (attemptsLeft: number): void => { if (this.pen` 에서 잘림)
- 상세: `setImmediate` 콜백으로 등록된 `firePayload` 클로저는 `this.pendingContinuations` Map 을 비동기 시점에 읽는다. `waitForX` 가 Map 에 키를 등록하는 microtask 이후 `setImmediate` 가 실행되는 설계이므로 일반적으로는 정상이나, 다음 경우 공유 상태가 의도치 않게 변경될 수 있다:
  1. 동일 `executionId` 에 대해 두 번의 BullMQ delivery (at-least-once semantics) 가 동시에 `resumeFromCheckpoint` 에 진입하면, 두 `firePayload` 클로저가 같은 Map 키를 두 번 resolve 하려 시도한다. 두 번째 resolve 는 `Map.has()` 확인 없이 호출될 수 있다.
  2. `pendingContinuations.delete(executionId)` 가 첫 번째 클로저에서 실행된 후 두 번째 클로저의 폴링이 Map miss 를 해석하는 로직에 따라 잘못된 재시도로 이어질 수 있다.
- 제안: `resumeFromCheckpoint` 진입 시점에 분산 Lock (기존 `acquireLock`) 또는 로컬 in-memory Set 으로 `executionId` 처리 중 플래그를 세워 중복 진입을 방지한다.

---

### [WARNING] `execution-engine.service.ts` — `rehydrateContext` 에서 `context._executedNodes` 직접 할당으로 공유 상태 변형

- 위치: `execution-engine.service.ts` diff — `context._executedNodes = executedNodes;` (두 군데: `rehydrateContext` 내부 및 `resumeFromCheckpoint` 내부)
- 상세: `ExecutionContext` 의 `_executedNodes` 필드를 외부에서 직접 교체한다. `contextService.createContext` 가 내부에서 `_executedNodes` 를 초기화한 경우, 그 초기 참조가 버려지고 새 Set 으로 교체된다. 만약 `contextService` 가 내부적으로 해당 Set 참조를 캐시하거나 다른 곳에서 참조하고 있다면 두 Set 이 분리되어 상태 불일치가 발생한다. 또한 `resumeFromCheckpoint` 에서 `const executedNodes = context._executedNodes ?? new Set<string>()` 후 다시 `context._executedNodes = executedNodes` 를 쓰는 패턴은 이중 할당이므로 의도가 불명확하다.
- 제안: `contextService` 에 `setExecutedNodes(executionId, set)` 과 같은 공식 setter 를 두거나, `createContext` 반환 시점에 `_executedNodes` 가 이미 비어있는 올바른 Set 으로 초기화되어 있음을 보장한다.

---

### [WARNING] `continuation-bus.service.ts` (spec 파일) — `on()` no-op 전환이 기존 호출자에게 무음 실패

- 위치: `continuation-bus.service.ts` diff — `on()` 메서드 body 가 `@deprecated` logger.debug 만 남음
- 상세: `on(type, handler)` 는 Phase 2 이전에 실제 핸들러를 등록했으나 이제 no-op 이다. `@deprecated` JSDoc 과 debug 로그가 있으나, 기존에 `bus.on(...)` 을 호출하는 코드가 프로젝트에 남아 있다면 아무 에러 없이 핸들러 등록이 묵살된다. `ExecutionEngineService.registerContinuationHandlers()` 도 no-op stub 이라고 계획서에 언급되어 있어 이를 통한 등록도 silent drop 된다. 런타임에서 핸들러가 호출되지 않아도 어떤 경고도 발생하지 않는다.
- 제안: 기존 `on()` 호출 코드를 codebase 에서 grep 하여 제거 완료 여부를 확인한다. 제거 전까지는 `logger.warn` 레벨로 올려 노이즈를 통해 잔존 호출자를 조기 감지한다.

---

### [WARNING] `websocket.gateway.ts` — 4개 핸들러의 반환 타입 변경 (인터페이스 변경)

- 위치: `websocket.gateway.ts` diff — `handleSubmitForm`, `handleClickButton`, `handleSubmitMessage`, `handleEndConversation` 의 `data` 반환 shape 변경
- 상세: 반환 타입에 `executionId?`, `resumed?`, `queued?` 필드가 추가됐다. WS ack payload 를 구독하는 프론트엔드 클라이언트 코드가 기존에 `{ success: boolean; error?: string }` 만 가정하고 있었다면:
  1. 추가 필드는 하위 호환이므로 기존 클라이언트 파싱에는 영향 없다 (옵셔널 필드).
  2. 그러나 `jobId === null` 분기에서 성공 케이스와 달리 `executionId`, `resumed`, `queued` 를 포함하지 않고 `{ success: false, error: '...' }` 만 반환한다. 실패 ack shape 과 성공 ack shape 이 달라 프론트엔드가 success=false 시 `executionId` 미존재를 처리해야 한다.
  3. `handleClickButton` 의 기존 성공 ack 에는 이미 `executionId`, `buttonId`, `resumed` 가 있었고 신규로 `queued` 만 추가됐다 — 다른 핸들러들과 변경 범위가 다르다.
- 제안: 실패 ack shape 을 통일하거나 (`success: false` 에도 `executionId` 포함), 혹은 프론트엔드 타입 정의를 함께 갱신한다. 프론트엔드 WS 클라이언트 코드를 검토하여 타입 변경이 반영됐는지 확인한다.

---

### [WARNING] `execution-engine.service.ts` — `ContinuationPublishResult` 인터페이스 신규 export 가 기존 호출자 시그니처 변경을 강제

- 위치: `execution-engine.service.ts` diff — `export interface ContinuationPublishResult { queued: boolean; jobId: string | null; }` 추가. 5개 `continueX` 메서드 반환 타입이 `void` → `Promise<ContinuationPublishResult>` 로 변경
- 상세: `continueExecution`, `continueButtonClick`, `continueAiConversation`, `endAiConversation`, `applyCancellation` (취소 시 직접 관여는 없지만 파생 흐름) 의 반환 타입이 변경됐다. WS gateway 이외에 이 메서드들을 호출하는 다른 경로 — REST controller, 내부 테스트 helper, 다른 서비스 — 가 있다면:
  1. 반환값을 무시하고 있던 기존 호출 코드 (`service.continueExecution(...)` void 취급) 는 컴파일 에러 없이 작동하지만, enqueue 실패(`jobId=null`) 시 에러 핸들링이 전혀 없게 된다.
  2. REST API controller 가 이 메서드들을 호출한다면 동일한 `queued: false` 분기 처리가 필요하나 반영되지 않을 수 있다.
- 제안: codebase 전체에서 이 5개 메서드의 호출 지점을 grep 하여 반환값 처리 여부를 확인한다. REST controller 가 있다면 동일한 `jobId === null` 분기 처리를 추가한다.

---

### [INFO] `continuation-bus.service.spec.ts` — 모듈 수준 `fakeRedisInstances` 배열이 테스트 간 오염 가능성

- 위치: `continuation-bus.service.spec.ts` — `const fakeRedisInstances: FakeRedisCmds[] = [];` (모듈 스코프 선언)
- 상세: `fakeRedisInstances` 는 모듈 최상위에서 `[]` 로 초기화되며, `beforeEach` 에서 `fakeRedisInstances.length = 0` 으로 초기화한다. `jest.mock('ioredis', ...)` 가 모듈 레벨에서 한 번 등록되므로 테스트 간 `createFakeRedis` 가 동일 배열에 push 한다. `beforeEach` 의 `length = 0` 리셋이 올바르게 작동하나, 테스트 병렬 실행 환경 (`--runInBand` 없이) 에서는 다른 describe block 과 배열을 공유하므로 순서 의존 버그가 발생할 수 있다.
- 제안: 현재 Jest 설정이 `--runInBand` 또는 파일 단위 격리라면 문제없다. 그렇지 않다면 배열을 `beforeEach` 에서 재선언하거나 `jest.resetModules()` 로 완전 격리한다.

---

### [INFO] `execution-engine.service.spec.ts` — `mockNodeExecutionRepo.findOne` 원본 참조 (`originalFindOne`) 를 재사용하는 패턴이 mock 상태 오염을 유발

- 위치: `execution-engine.service.spec.ts` diff — Phase 2.7 rehydration 시나리오 내 `const originalFindOne = mockNodeExecutionRepo.findOne;` 후 `mockNodeExecutionRepo.findOne = jest.fn().mockImplementation(...)` 로 교체하며, `originalFindOne(opts)` 를 fallback 으로 호출
- 상세: `originalFindOne` 은 이전 `beforeEach` 에서 설정된 mock 함수다. `mockImplementation` 내에서 `originalFindOne(opts)` 를 호출하면 mock call count 가 누적되어 다른 assertion 이 `toHaveBeenCalledTimes` 로 검증 시 오차가 발생할 수 있다. 또한 `afterEach` 에서 `mockNodeExecutionRepo.findOne` 이 교체된 채 남아있는지, 원복이 되는지 확인이 필요하다.
- 제안: 이 테스트 블록 이후 `afterEach` 또는 테스트 종료 시점에 `mockNodeExecutionRepo.findOne` 을 원본으로 복구하거나, `jest.spyOn` 패턴을 사용해 자동 복원을 보장한다.

---

### [INFO] `execution-engine.service.ts` — `rehydrateContext` 에서 loop 내 N+1 DB 쿼리

- 위치: `execution-engine.service.ts` diff — `rehydrateContext` 내 `for (const log of logs)` 루프에서 매 iteration 마다 `nodeExecutionRepository.findOne(...)` 호출
- 상세: `execution_node_log` 의 각 nodeId 에 대해 `findOne` 을 순차 호출한다. Execution 의 완료 노드 수가 많을수록 N개의 DB 쿼리가 직렬 실행된다. 이는 부작용이라기보다는 성능 이슈이나, 재시작 후 rehydration 의 지연을 유발하여 `setImmediate` polling 의 타임아웃 내 resolver 등록을 실패시킬 수 있다.
- 제안: `nodeExecutionRepository.find({ where: { executionId, nodeId: In([...nodeIds]), status: COMPLETED }, ... })` 로 단일 쿼리로 대체한다.

---

## 요약

부작용 관점에서 가장 심각한 발견은 `continuation-execution.processor.ts` 에서 `applyCancellation` 의 `await` 가 제거된 것이다. 이는 cancellation 후처리가 fire-and-forget 이 되어 DB 쓰기 누락, 예외 소실, Graceful Shutdown 미완 등의 실제 데이터 손상 위험을 내포한다. 그 외에 `resumeFromCheckpoint` 의 `setImmediate` 폴링 클로저가 공유 상태 `pendingContinuations` 를 중복 delivery 시나리오에서 두 번 resolve 하는 race condition, `rehydrateContext` 가 `ExecutionContext._executedNodes` 를 외부에서 직접 교체하는 공유 상태 변형, `on()` no-op 전환의 silent 실패, WS gateway 반환 shape 의 비대칭 (실패 vs 성공 ack), `continueX` 메서드 시그니처 변경에 따른 REST controller 등 다른 호출자의 누락 처리 가능성이 WARNING 수준으로 식별됐다. 테스트 코드에서는 모듈 스코프 공유 배열 및 mock 원본 참조 재사용으로 인한 테스트 간 오염 가능성이 INFO 수준으로 발견됐다.

---

## 위험도

HIGH

STATUS: SUCCESS
