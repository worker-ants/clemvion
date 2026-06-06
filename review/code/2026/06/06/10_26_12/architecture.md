# Architecture Review

리뷰 대상: `execution-engine.service.ts` (9,098줄) 및 관련 파일

---

## 발견사항

### **[CRITICAL]** God Service — 단일 책임 원칙(SRP) 대규모 위반
- **위치**: `/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (전체, 9,098줄)
- **상세**: `ExecutionEngineService` 는 단일 클래스 안에 다음 책임을 모두 수행한다: (1) 그래프 순회/dispatch loop, (2) 상태 머신 전이(`updateExecutionStatus`, `assertTransition`), (3) 워커 슬롯 배리어 관리(`firstSegmentBarriers`, `pendingContinuations`), (4) durable snapshot 영속(`stageDurableResumeSnapshot`, `rehydrateUserVariables`), (5) rehydration/resume 드라이브(`resumeFromCheckpoint`, `driveResumeDetached`, `rehydrateAndResume`), (6) container 실행(`runContainer`, `runParallel`, `scheduleBackgroundBody`), (7) stuck-execution 복구(`recoverStuckExecutions`), (8) active-running 타임아웃 추적(`segmentStartMs`, `assertActiveTimeWithinLimit`), (9) 취소/에러 마감 처리. 131개의 private 멤버. 이 규모의 단일 클래스는 변경 영향 분리가 불가하고, 부분 테스트 격리도 어려워 회귀 위험이 매우 높다. 서비스 자신도 주석(L583)에서 "PR-H/I에서 점진적으로 책임 분해 예정"이라고 인정한다.
- **제안**: 최소한 3개의 독립 서비스로 추출: `ExecutionGraphService`(그래프 순회/dispatch loop), `ExecutionParkService`(park/unpark/rehydration/durable snapshot), `ExecutionLifecycleService`(상태 전이/완료/취소). `GraphTraversalService`가 이미 순수 graph reachability를 분리한 패턴을 확장한다.

---

### **[WARNING]** 이중 동작 `waitForX` 메서드 — 개방-폐쇄 원칙(OCP) 약화
- **위치**: `waitForFormSubmission` (L3652), `waitForButtonInteraction`, `waitForAiConversation` 내의 `parkMode: ParkMode` 분기
- **상세**: 각 `waitForX` 메서드가 `parkMode = 'release' | 'await'` 파라미터로 두 가지 직교 동작을 하나의 함수에 혼재한다: `'release'` = 코루틴 즉시 해제(sentinel 반환), `'await'` = Promise로 블로킹. 이 두 동작은 전혀 다른 실행 경로를 가지고 있어 if-분기가 깊어진다. 서비스 자신도 `@todo PR-B2/B3: Strategy 패턴 또는 함수 분리 예정`이라고 인정(L3648–3650). 새 interaction type 추가 시 각 `waitForX`의 `'release'`/`'await'` 분기 모두를 수정해야 하는 수정 산포(shotgun surgery)가 발생한다.
- **제안**: `ParkStrategy` 인터페이스(또는 단순히 `parkFresh(...)` / `parkResume(...)` 두 함수 분리)로 추출. 단기적으로 `parkMode` 파라미터를 허용하더라도 분기를 메서드 최상단 early-return으로 명시화해 복잡도를 최소화한다.

---

### **[WARNING]** `PARK_RELEASED` Symbol 기반 sentinel 반환 — 타입 추상화 부족
- **위치**: `const PARK_RELEASED = Symbol('park_released')` (L270), 반환 타입 `Promise<void | ParkSignal>` 패턴 전반
- **상세**: `waitForX` 메서드들이 `void | ParkSignal` 유니온 타입을 반환하고, 호출자들이 `=== PARK_RELEASED` 가드를 반복(L1682, L1692, L1704, L2040, L3451, L3461, L3473, L5028, L5348, L5360, L5372 등)한다. 이는 null-object 패턴 또는 결과 union(`ParkResult = { kind: 'parked' } | { kind: 'resumed', data: unknown }`)으로 대체할 수 있으며, Symbol을 사용한 sentinel return은 모듈 경계를 넘으면 타입 안전성이 깨진다(현재는 module-scope이어서 안전하지만 리팩토링 시 취약). 콜사이트마다 동일 패턴의 가드를 반복해 호출자가 추상화 내부 세부사항에 의존한다.
- **제안**: `type ParkResult = { released: true } | { released: false; data: unknown }` 형태의 discriminated union 또는 별도 sealed class로 표현. sentinel 비교를 `waitForX` 계층 내부로 캡슐화한다.

---

### **[WARNING]** 레이어 책임 혼재 — 비즈니스 레이어가 WebSocket emit을 직접 수행
- **위치**: `this.eventEmitter.emitExecution(...)` 호출 (서비스 전반 다수 지점)
- **상세**: `ExecutionEngineService`(비즈니스 레이어)가 WebSocket 이벤트 발행(`ExecutionEventEmitter`)을 직접 호출해 이벤트 프레임 구조(interactionType 필드, conversationThread cloneThread 등)를 조립한다. 비즈니스 로직과 프레젠테이션 레이어의 이벤트 포맷 책임이 동일 메서드 안에 섞여 있다. WS emit 구조 변경 시 비즈니스 코드가 함께 수정되어야 한다.
- **제안**: 도메인 이벤트(`ExecutionParkedEvent`, `ExecutionResumedEvent`)를 정의해 비즈니스 레이어가 발행하고, `ExecutionEventEmitter`가 이를 WS 포맷으로 변환하는 어댑터 역할을 맡도록 책임 이동. 현재 `ExecutionEventEmitter`가 이미 존재하므로 해당 서비스의 인터페이스를 도메인 이벤트 중심으로 재정의한다.

---

### **[WARNING]** `buildConversationMetaFromResumeState`, `buildAiMessageDebugFromResumeState`, `buildConversationConfigFromOutput` 의 모듈 위치
- **위치**: `execution-engine.service.ts` L366, L428, L490 (module-level `export function`)
- **상세**: 이 세 함수는 `@internal — 테스트 보조용으로 공개`라는 주석이 있으나, 실제로 서비스 파일에 `export`로 선언되어 있다. 테스트가 프로덕션 코드 내부 구현에 의존(화이트박스 결합)하게 되며, 이는 인터페이스 분리 원칙(ISP) 위반 — 소비자가 필요하지 않은 내부 구현을 함께 노출받는다. 서비스 파일이 비즈니스 로직과 테스트 헬퍼를 동시에 제공해 모듈 경계가 흐려진다.
- **제안**: 이 함수들을 `conversation-meta.helpers.ts` 등 별도 파일로 추출. 테스트는 해당 파일을 직접 import. `ExecutionEngineService` 의 public API에서는 제거한다.

---

### **[WARNING]** `firstSegmentBarriers` 상태 — 분산 상태 관리 책임 혼재
- **위치**: `private readonly firstSegmentBarriers = new Map<...>` (L764), `armFirstSegmentBarrier` (L776), `settleFirstSegment` (L794)
- **상세**: in-memory `Map`으로 관리되는 worker slot barrier가 동일 서비스에 위치해 있으며, 이와 관련된 상태(`pendingContinuations`, `segmentStartMs`, `firstSegmentBarriers`)가 각각 독립적인 생명주기를 가짐에도 하나의 클래스 필드로 산재한다. 이 세 Map이 사실상 "park session state"를 구성하므로 별도 Park Session Store 추상화로 묶을 수 있다. 분산(Redis) 상태와 in-memory 상태의 경계가 서비스 수준에서 명시적으로 드러나지 않는다.
- **제안**: `ParkSessionStore` 인터페이스로 `pendingContinuations`, `firstSegmentBarriers` 의 등록/해소 책임을 추출. in-memory 구현과 미래의 distributed 구현을 교체 가능하게 만든다(DIP 원칙 적용).

---

### **[WARNING]** `resumeFromCheckpoint` / `resumeGraphAfterRetry` 코드 중복
- **위치**: `resumeFromCheckpoint` (L1748), `resumeGraphAfterRetry` (L4614), `runNodeDispatchLoop` 참조
- **상세**: 서비스 자신이 L4646–4648에서 "본 메서드의 traversal loop + completion 코드는 `resumeFromCheckpoint` traversal loop + COMPLETED finalize block 과 거의 동일하다. 공통 helper 추출 리팩토링은 PR2 scope creep 회피를 위해 후속 plan으로 분리한다"라고 인정한다. `runNodeDispatchLoop`가 추출되어 일부 중복이 해소됐으나, graph rebuild + reachability seed + completion finalize 단계는 여전히 반복된다. 이 중복은 버그 수정 시 여러 위치를 동시 수정해야 하는 수정 산포를 야기한다.
- **제안**: graph rebuild + reachability seed + `runNodeDispatchLoop` + completion finalize 를 하나의 `GraphExecutionSession` 혹은 `ExecutionRunner.run(seed, opts)` 형태의 공통 메서드로 합산. `resumeFromCheckpoint`와 `resumeGraphAfterRetry`는 seed를 준비하는 방식만 다르고 나머지는 동일하다.

---

### **[INFO]** `CHECKPOINT_SCHEMA_VERSION` 과 `CALL_STACK_SCHEMA_VERSION` 분산 위치
- **위치**: `execution-engine.service.ts` L284 vs `shared/execution-resume/resume-call-stack.types.ts` L48
- **상세**: 두 상수는 의도적으로 독립 선언되어 있고 명시적 주석도 달려 있다. 그러나 `CHECKPOINT_SCHEMA_VERSION`이 서비스 클래스 내부(파일 최상단)에 있는 반면 `CALL_STACK_SCHEMA_VERSION`은 shared 레이어에 있어 위치 대칭이 맞지 않는다. `CHECKPOINT_SCHEMA_VERSION`을 `shared/execution-resume/` 하위로 이동하면 두 버전 상수가 같은 레이어에서 관리된다.
- **제안**: `shared/execution-resume/resume-checkpoint.types.ts` 파일을 신설해 `CHECKPOINT_SCHEMA_VERSION`과 관련 타입을 이동. `execution-engine.service.ts`는 import해 사용.

---

### **[INFO]** `cancelParkedExecution` 의 repository 직접 접근
- **위치**: `cancelParkedExecution` (L1072)
- **상세**: `ExecutionEngineService`가 직접 `executionRepository.createQueryBuilder().update()` / `nodeExecutionRepository` 를 사용해 DB 업데이트를 수행한다. 이미 Repository 패턴이 사용 중이나 서비스가 QueryBuilder 레벨까지 내려가 query building 책임을 직접 수행해 레이어 경계가 모호해진다.
- **제안**: QueryBuilder를 사용하는 복잡한 쿼리는 `ExecutionRepository`(TypeORM Repository 확장) 또는 전용 `ExecutionDataAccess` 서비스로 분리. 서비스는 도메인 메서드만 호출한다.

---

## 요약

`ExecutionEngineService`는 9,098줄 단일 클래스에 그래프 순회, 상태 머신, park/unpark 배리어, durable snapshot, rehydration, container 실행, stuck 복구, 타임아웃 추적 등 최소 8개의 독립적 책임을 동시에 수행하는 전형적 God Service 패턴으로, SOLID 원칙 중 SRP·OCP·ISP가 구조적으로 위반된다. `GraphTraversalService`, `ExecutionEventEmitter`, `ContinuationBusService` 등 일부 책임 분리는 이미 수행됐고 서비스 자체도 "PR-H/I에서 분해 예정"임을 명시하고 있으나, 현 상태에서는 변경 범위 예측이 어렵고 회귀 위험이 높다. `waitForX` 메서드의 이중 동작(`parkMode` 분기), sentinel Symbol 반복 비교, WebSocket emit 포맷 조립의 비즈니스 레이어 노출, `resumeFromCheckpoint`/`resumeGraphAfterRetry` 중복은 단기적으로 별도 이슈 없이 해결 가능하며 우선 대응을 권장한다. 신규 PR-B1에서 추가된 코드(`stageDurableResumeSnapshot`, `rehydrateUserVariables`, `cancelParkedExecution`, `PARK_RELEASED` sentinel 처리)는 기존 패턴을 일관되게 따르고 있어 독립적 추가로서는 정합하다.

## 위험도

HIGH

STATUS: OK
