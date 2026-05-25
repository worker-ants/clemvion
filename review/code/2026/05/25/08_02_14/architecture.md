# 아키텍처(Architecture) 코드 리뷰

리뷰 대상: workflow-resumable-execution Phase 2 (BullMQ 전환 + Rehydration)
리뷰 일시: 2026-05-25

---

## 발견사항

### [WARNING] `resumeFromCheckpoint` 가 `ExecutionEngineService` 내부에서 그래프 빌드 코드를 중복 구현
- 위치: `execution-engine.service.ts` — `resumeFromCheckpoint()` 메서드 (diff +1640 ~ +1700 부근)
- 상세: `runExecution` 의 그래프 빌드 구간 (`buildGraph` → `identifyBackEdges` → `topologicalSort` → `buildEdgeIndexes`) 이 `resumeFromCheckpoint` 안에서 다시 그대로 복사됐다. 두 코드 경로가 diverge 하면 그래프 해석이 달라져 재개 후 토폴로지 오류가 발생할 수 있다. 단일 책임 원칙(SRP) 관점에서 그래프 빌드는 독립 private 메서드 또는 별도 `GraphBuildService`로 추출되어야 한다.
- 제안: `buildExecutionGraph(workflowId)` 형태의 private 헬퍼를 추출하고 `runExecution` 과 `resumeFromCheckpoint` 양쪽에서 공유 호출. 이미 `this.graphTraversal` 주입 서비스가 있으므로 그곳에 위임하는 것이 응집도를 높이는 방향.

---

### [WARNING] `rehydrateContext` 에서 N+1 쿼리 패턴 — 레이어 책임 경계 위반 수준
- 위치: `execution-engine.service.ts` — `rehydrateContext()` 내 `for (const log of logs)` 루프 (diff +1562 ~ +1583)
- 상세: `execution_node_log` 레코드를 전체 조회한 뒤 각 nodeId 마다 `nodeExecutionRepository.findOne(...)` 을 개별 호출한다. 완료 노드가 k개이면 1 + k 개의 DB 왕복이 발생한다. 데이터 레이어에서 단일 JOIN 쿼리로 처리할 수 있는 작업을 비즈니스 레이어 루프에서 처리하고 있어, 데이터 접근 전략이 비즈니스 서비스 코드에 노출된다.
- 제안: `nodeExecutionRepository` 에 `findLatestCompletedByExecutionAndNodeIds(executionId, nodeIds)` 쿼리 메서드를 추가하고, 한 번에 IN 조건으로 조회 후 Map 으로 변환. rehydration 의 hot path 는 재시작 직후이므로 성능 영향은 제한적이지만, 아키텍처 일관성과 레이어 책임 분리를 위해 개선이 필요하다.

---

### [WARNING] `ContinuationExecutionProcessor` 와 `ExecutionEngineService` 간 순환 의존성 위험
- 위치: `continuation-execution.processor.ts` line 44 — `@Inject(forwardRef(() => ExecutionEngineService))`
- 상세: Processor 가 `ExecutionEngineService` 를, `ExecutionEngineService` 가 `ContinuationBusService` 를, `ContinuationBusService` 가 BullMQ Queue 를 주입받는 구조에서 `forwardRef` 를 사용하고 있다. `forwardRef` 는 NestJS 에서 순환 의존성의 임시 해결책으로, 이 패턴이 정착되면 초기화 순서 race 와 undefined 참조 버그의 온상이 된다. 이미 `getLockClient()` 의 lazy init 이 "모듈 초기화 순서 race 회피"를 이유로 설계됐다는 점이 구조적 긴장을 보여준다.
- 제안: Processor 가 Engine 전체를 직접 의존하는 대신, Processor 가 실제로 호출하는 메서드(`applyContinuation`, `applyCancellation`, `isNodeExecutionWaiting`)만 선언한 인터페이스(`IContinuationDispatcher`)를 추출하고 Engine 이 해당 인터페이스를 구현. Processor 는 인터페이스에만 의존하면 순환 참조 없이 의존성 역전 원칙(DIP)을 충족.

---

### [WARNING] `on()` 메서드의 no-op stub — 개방-폐쇄 원칙(OCP) 위반 가능성 및 dead API surface 존재
- 위치: `continuation-bus.service.ts` line 540-548 (diff 파일 2)
- 상세: Phase 2 이후 `on()` 은 no-op이며 `@deprecated` 표시가 됐다. 그러나 서비스 인터페이스에 여전히 공개 메서드로 남아 있고, 테스트에서도 "Phase 2 부터 no-op" 을 명시적으로 검증한다. 이는 API surface 가 실제 동작하지 않는 진입점을 노출한다는 의미로, 소비자가 `on()`을 호출해도 정상 동작한다고 오해할 수 있다. NestJS DI 관점에서는 인터페이스 분리 원칙(ISP) 위반이기도 하다.
- 제안: 단기적으로는 현행 유지가 불가피하지만 (caller 제거 예정이라는 주석 확인됨), 다음 단계에서 `registerContinuationHandlers()`와 함께 완전 제거 및 호출 코드 삭제. 제거 시점까지는 `@deprecated` 린트 규칙을 CI에 추가해 신규 호출을 차단할 것.

---

### [WARNING] `WebsocketGateway` 에서 enqueue 실패 판별을 `result.jobId === null` 로 함 — 추상화 누수
- 위치: `websocket.gateway.ts` line 821, 859, 904, 948 (diff 파일 7)
- 상세: 프레젠테이션 레이어인 WebSocket gateway 가 `jobId === null` 이라는 BullMQ 계층의 세부 구현 사실을 인지하고 분기한다. `ContinuationPublishResult.queued: boolean` 이라는 명시적 필드가 이미 존재하는데 `queued` 가 아닌 `jobId === null` 로 판단한다. 이는 인터페이스가 명시하는 의미론과 실제 분기 조건이 불일치하는 추상화 누수.
- 제안: gateway 에서 `if (!result.queued)` 로 통일 (이미 `queued: boolean` 이 공식 의미론 필드). `jobId` 는 디버깅 목적 필드임을 명확히 하고, 실패 판별 로직을 비즈니스 레이어가 `queued` 값으로 캡슐화해 gateway 는 그것만 읽도록.

---

### [INFO] `__no_node_exec__` sentinel 문자열이 여러 레이어에 하드코딩
- 위치: `continuation-bus.service.ts`, `execution-engine.service.ts` (`rehydrateAndResume`), 테스트 파일 다수
- 상세: `'__no_node_exec__'` 문자열이 상수로 export 되지 않고 여러 파일에서 직접 리터럴로 사용된다. 문자열 변경 시 ripple effect 가 크고, 테스트에서도 리터럴로 assert 해 sentinel 의미론이 문서화되지 않는다.
- 제안: `continuation-bus.service.ts` 또는 `continuation-execution.queue.ts` 에 `export const NO_NODE_EXEC_SENTINEL = '__no_node_exec__'` 를 선언하고 모든 참조를 상수로 대체. `RECOVERY_LOCK_KEY` 가 이미 export 상수로 잘 처리된 것과 동일한 패턴 적용.

---

### [INFO] `resumeFromCheckpoint` 내 `setImmediate` polling 기반 resolver fire — 타이밍 의존적 설계
- 위치: `execution-engine.service.ts` — `resumeFromCheckpoint()` 내 `firePayload()` 함수 (diff 일부 truncate 됨)
- 상세: rehydration 완료 후 pendingContinuations 에 등록된 resolver 를 `setImmediate` polling 으로 fire 하는 구조는 테스트에서 `flushPromises()` 를 3회 반복 호출해야 하는 이유와 같다. 이는 비동기 타이밍에 의존적이며, 이벤트 루프 포화 상황에서 지연이 길어질 수 있다. polling attempt 상한 (`attemptsLeft`) 소진 시의 처리도 명확하지 않다.
- 제안: polling 대신 `waitForFormSubmission` 등 waitForX 메서드가 resolver 등록 후 즉시 신호할 수 있는 `EventEmitter` 기반 handshake 또는 resolver 등록 콜백을 도입. 현행 설계는 동작하지만 테스트 fragility 와 프로덕션 타이밍 의존을 줄이는 방향이 권고됨.

---

### [INFO] `rehydrateContext` 가 `ExecutionEngineService` 내부에 존재 — 서비스 크기 증가
- 위치: `execution-engine.service.ts` — 새로 추가된 `rehydrateContext()`, `resumeFromCheckpoint()`, `RehydrationError` class
- 상세: 이미 대형 서비스인 `ExecutionEngineService` 에 rehydration 관련 private 메서드와 전용 오류 클래스가 추가됐다. 기능 자체는 execution engine 의 책임 범위이지만, rehydration 로직의 복잡도 증가에 따라 SRP 경계가 흐려지고 있다. 현재 PR 범위 내에서는 허용 가능하나, 향후 rehydration 이 더 복잡해지면 별도 서비스로 분리를 고려해야 한다.
- 제안: 중기적으로 `ExecutionRehydrationService` 를 분리하고 `RehydrationError` 를 그곳에 이동. `ExecutionEngineService` 는 `applyContinuation` 의 fast/slow path 라우팅만 담당.

---

## 요약

이번 변경은 Redis pub/sub 기반의 at-most-once 전달을 BullMQ 영속 큐 기반의 at-least-once로 교체하고, 인스턴스 재시작 후 워크플로 재개를 위한 rehydration 경로를 구현한 Phase 2 아키텍처 전환이다. 핵심 설계 방향(단일 enqueue 경로, Fast/Slow path 이분, RehydrationError 분류)은 분산 시스템 신뢰성 관점에서 올바르고, `ContinuationBusService` 가 BullMQ 세부사항을 캡슐화해 caller 가 인프라 변경을 모르도록 하는 추상화 방향도 적절하다. 다만 `resumeFromCheckpoint` 내 그래프 빌드 코드 중복, `rehydrateContext` 의 N+1 쿼리 패턴, `ContinuationExecutionProcessor`-`ExecutionEngineService` 간 `forwardRef` 순환 의존성, WS gateway 에서 `jobId === null` 추상화 누수 네 가지가 중기적으로 해소되어야 할 아키텍처 부채다. `on()` no-op stub 과 `__no_node_exec__` 리터럴 산포는 소규모 정리로 해결 가능하다.

---

## 위험도

MEDIUM
