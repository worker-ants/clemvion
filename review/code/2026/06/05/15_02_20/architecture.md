# 아키텍처(Architecture) 리뷰 결과

**리뷰 대상**: exec-park-durable-resume PR-B1 (form/button park-release + slow-path 일원화)
**리뷰 일시**: 2026-06-05

---

## 발견사항

### **[WARNING]** ExecutionEngineService 단일 클래스 — God Object 경향 심화
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (8843 라인)
- 상세: PR-B1 에서 `cancelParkedExecution` private 메서드(약 40 라인), `PARK_RELEASED` Symbol + `ParkSignal`/`ParkMode` 타입 + `parkMode` 파라미터 변경이 모두 동일 서비스 클래스 내부에 누적됐다. 이 클래스는 이미 그래프 순회, 상태 전이, 노드 디스패치, 체크포인트 rehydration, cancellation, WebSocket 이벤트 emit 등 다수 책임을 보유한다. SRP(단일 책임) 관점에서 "park/cancel 의 durable 마감 로직"이 독립 서비스로 추출되지 않고 계속 해당 클래스에 쌓이는 구조는 장기적 유지보수 부채다.
- 제안: `cancelParkedExecution` 로직을 별도 `ExecutionCancellationService` 또는 `DurableExecutionFinalizer` 로 추출 — PR-B2 의 `pendingContinuations`/barrier 정리 시점과 맞추어 리팩토링 범위로 포함. PR-B1 자체에서 즉시 분리할 필요는 없으나 B3 정리 phase 에 반드시 포함할 것.

---

### **[WARNING]** `PARK_RELEASED` Symbol 과 `ParkMode` 분기가 `waitForFormSubmission`/`waitForButtonInteraction` 시그니처를 이원화
- 위치: `execution-engine.service.ts` (변경: `waitForFormSubmission` L3581, `waitForButtonInteraction` L6173)
- 상세: 두 `waitForX` 메서드의 반환 타입이 `Promise<void | ParkSignal>` 로 변경되었다. caller 는 반환값을 `=== PARK_RELEASED` 로 조건 분기한다. 이 패턴은 반환 타입의 의미가 모드에 따라 달라지는 가변 시그니처로, OCP(개방-폐쇄)를 약화시킨다 — 향후 세 번째 park 모드가 추가되면 반환 타입과 모든 caller 분기가 함께 변경되어야 한다. 또한 `parkMode` 파라미터가 기본값 `'await'` 로 선택적이므로 기존 호출 지점은 묵시적으로 `'await'` 모드가 된다. 메서드가 두 가지 직교적 행동(durable park-and-release vs. await-in-place)을 하나의 구현 안에 혼재시키는 것은 Interface Segregation 원칙을 위반한다.
- 제안: `ParkMode` 가 2개 값에 국한된다는 제약을 타입 레벨로 강화하고 JSDoc 에 "이 메서드를 직접 호출할 때는 항상 parkMode 를 명시할 것" 주석을 추가. PR-B2 이후에 `runAiConversationLoop` 의 turn-park 도 동일 패턴으로 확장해야 하므로, 그 시점에 `waitForX` 를 Strategy 패턴(ParkStrategy 인터페이스)으로 추출하는 것을 검토할 것.

---

### **[INFO]** `forwardRef` 순환 의존 잔존 — `ContinuationExecutionProcessor` ↔ `ExecutionEngineService`
- 위치: `continuation/continuation-execution.processor.ts` L147-150
- 상세: `@Inject(forwardRef(() => ExecutionEngineService))` 가 PR-B1 이후에도 유지된다. PR-B1 에서 `applyCancellation` 이 async 로 전환됐으나 순환 참조 구조 자체는 해소되지 않았다. 순환 의존은 모듈 경계 침식 신호다 — processor 가 engine 을 직접 참조하는 대신 명확히 방향이 정해진 인터페이스를 통해 참조해야 한다.
- 제안: `ExecutionEngineService` 의 processor-facing 메서드(`applyContinuation`, `applyCancellation`, `applyRetryLastTurn`, `isNodeExecutionWaiting`)를 `IExecutionEngineProcessorFacade` 인터페이스로 추출하고, processor 는 구체 클래스가 아닌 인터페이스에 의존하도록 DIP 를 적용. 이를 통해 `forwardRef` 를 제거할 수 있다. PR-B2 의 구조 정리 시 병행 처리 권장.

---

### **[INFO]** `cancelParkedExecution` 의 에러 처리 레이어 혼재 — emit 실패를 내부 catch 로 흡수
- 위치: `execution-engine.service.ts` (신규 `cancelParkedExecution` 메서드)
- 상세: DB update 성공 후 `eventEmitter.emitExecution()` 실패를 별도 try/catch 로 흡수하고 `warn` 로그만 남긴다. 이는 "cancel 은 DB 에 반영됐으나 클라이언트 알림이 누락"된 상태를 무음 처리하는 것이다. 이벤트 emit 실패 시 클라이언트가 오래된 `waiting_for_input` 상태를 보게 되는 UX 문제가 생길 수 있다. 레이어 책임 관점에서 "DB 완결성"과 "이벤트 알림"을 단일 메서드 안에서 트랜잭션적으로 묶지 않는 구조는 일관성 보장에 약점을 둔다.
- 제안: emit 실패를 재시도 큐(BullMQ dead-letter 패턴)에 기록하거나, 적어도 `error` 레벨 로그로 올려서 운영 모니터링이 수신하도록 severity 를 높일 것. 현행 `warn` 은 사일런트 실패로 분류될 수 있다.

---

### **[INFO]** `runNodeDispatchLoop` 반환 타입 변경 — 호출자 6개소의 파편화된 `dispatchResult.parked` 분기
- 위치: `execution-engine.service.ts` (변경: `runNodeDispatchLoop` L1500, `driveResumeDetached`, `resumeGraphAfterRetry`)
- 상세: `Promise<void>` → `Promise<{ parked: boolean }>` 로 반환 타입 변경 후, 각 caller 에서 `if (dispatchResult.parked) return;` 패턴이 반복된다. 현재는 2개 호출 지점이지만 PR-B2 에서 AI 루프도 같은 패턴을 따르면 분기 지점이 늘어난다. 반환 타입 자체는 적절한 추상화이나, "caller 가 parked 여부에 따라 completion 을 skip"하는 로직이 메서드 외부로 반복 노출된다.
- 제안: `runNodeDispatchLoop` 내부에서 completion callback 을 받거나, `DispatchLoopResult` 타입을 명명된 enum/discriminated union 으로 정의하여 미래 확장(`{ kind: 'completed' | 'parked' | 'error' }`)에 대비할 것.

---

### **[INFO]** e2e 테스트의 `setTimeout(resolve, ms)` 폴링 헬퍼 — 비결정적 타이밍 의존
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` (신규 `flushResumeDrive`)
- 상세: `flushResumeDrive(ms = 40)` 는 detached drive 완료를 실제 타이머 경과로 기다린다. slow CI 환경에서 40ms 가 부족할 수 있고, 테스트가 느린 환경에서는 `for (let i = 0; i < 50; i++) { await flushResumeDrive(20); }` 루프(최대 1000ms)로 보완하고 있으나 근본적으로 타이밍 의존 구조다. 아키텍처 관점에서 이는 "detached 코루틴"이 테스트 가능성(testability)을 저하시키는 설계임을 의미한다 — detached 비동기 작업의 완료를 외부에서 관찰할 수단이 없으므로 폴링에 의존한다.
- 제안: `driveResumeDetached` 에 completion 알림 Hook(예: 테스트 전용 onDriveComplete callback 또는 `EventEmitter` 신호)을 추가하거나, detach 대신 `Promise` 를 반환하는 형태로 내부 아키텍처를 변경해 테스트 결정성을 높일 것. PR-B2 에서 장수 AI 루프를 turn-park 로 전환할 때 동일 문제를 해소할 기회가 있다.

---

### **[INFO]** `armSlowPathResume` 헬퍼의 복잡한 mock 체인 — 테스트 레이어의 비즈니스 로직 누설
- 위치: `execution-engine.service.spec.ts` (신규 `armSlowPathResume`)
- 상세: `armSlowPathResume` 은 `mockNodeExecutionRepo.save.mock.calls` 를 직접 탐색해 `outputData` 를 재구성하고 여러 repository mock 을 순차 장착한다. 이는 테스트가 서비스 내부의 영속 방식(envelope shape, outputData 구조)을 깊이 알아야 함을 뜻한다. rehydration 의 내부 구현이 바뀌면 이 헬퍼도 함께 수정되어야 한다 — 응집도 낮은 테스트 구조다.
- 제안: `armSlowPathResume` 이 탐색하는 `persistedOutput` 재구성 로직을 service 의 `buildResumeCheckpoint` / `toEngineFlatShape` 공개 메서드를 통해 구성하거나, rehydration 경로를 별도 `RehydrationService` 로 분리해 테스트 대상을 좁힐 것.

---

## 요약

PR-B1 의 핵심 아키텍처 의사결정(park = 세그먼트 종료, PARK_RELEASED sentinel 반환, slow-path 일원화)은 스펙(§4.x, §7.5)에 충실하며 bounded memory 보장과 durable 재개의 단일화라는 목표를 달성한다. 변경의 방향성과 범위(form/button 한정, AI 루프 미변경)는 점진적 안전 롤아웃 전략으로 타당하다. 다만 8800 라인 규모의 `ExecutionEngineService` 는 SRP 위반 상태가 심화되고 있으며, `waitForX` 의 `ParkMode` 이원 시그니처, `forwardRef` 순환 의존, detached 코루틴으로 인한 타이밍 의존 테스트는 PR-B2/B3 정리 phase 에서 반드시 해소해야 할 구조 부채다. `cancelParkedExecution` 의 emit 실패 흡수는 운영 가시성 관점에서 즉시 severity 상향이 권장된다.

---

## 위험도

MEDIUM
