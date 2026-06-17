# 아키텍처(Architecture) 리뷰 결과

## 발견사항

### [WARNING] EngineDriver 인터페이스가 두 가지 이질적인 관심사를 혼합
- **위치**: `/codebase/backend/src/modules/execution-engine/engine-driver.interface.ts` 전체
- **상세**: `EngineDriver`는 원래 orchestrator 용 최소 seam (상태 전이, 체크포인트, 컨텍스트 키 등 고수준 라이프사이클)으로 설계됐으나(주석 "C-1 step2"), 이번 step4에서 그래프 실행 엔진의 저수준 구현 세부사항(`rehydrateContext`, `loadAndBuildGraph`, `runNodeDispatchLoop`, `findActivatedBackEdge`, `clearLlmDefaultConfigCache`)이 5개나 추가됐다. 이 두 군은 추상화 수준이 다르다. 고수준(상태 전이·검사·체크포인트)과 저수준(그래프 루프 구동·컨텍스트 재구성·캐시 정리)이 단일 인터페이스에 혼재하면, ISP(인터페이스 분리 원칙) 위반이 되고 인터페이스가 커질수록 소비자가 불필요한 멤버에 의존하는 구조가 고착된다.
- **제안**: 장기적으로 `EngineDriver`를 두 개의 토큰으로 분리하는 것을 검토한다. (a) 상태·체크포인트·orchestration seam (`updateExecutionStatus`, `stageDurableResumeSnapshot`, `buildRetryReentryState`, `buildResumeCheckpoint`, `isCheckpointEligibleNodeType`, `contextKeyOf`, `applyPortSelection`) — 기존 `ENGINE_DRIVER`, (b) 그래프 실행 capability seam (`rehydrateContext`, `loadAndBuildGraph`, `runNodeDispatchLoop`, `findActivatedBackEdge`, `clearLlmDefaultConfigCache`) — 새 토큰 `ENGINE_GRAPH_DRIVER` 또는 별도 `GraphCapabilityDriver`. 이렇게 하면 `RetryTurnService`는 그래프 경로 인터페이스만, `AiTurnOrchestrator`는 라이프사이클 인터페이스만 주입받아 의존 범위를 최소화할 수 있다. 현재 단계에서는 즉시 분리 대신 서비스 집중도가 높아지는 시점에 대비해 인터페이스 내 명확한 섹션 경계(주석 그룹)를 유지하는 것으로 수용 가능하다.

---

### [WARNING] `private` → `public` 접근성 승격에 따른 캡슐화 약화
- **위치**: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `rehydrateContext`, `loadAndBuildGraph`, `runNodeDispatchLoop`, `clearLlmDefaultConfigCache`, `findActivatedBackEdge`
- **상세**: 이 5개 메서드는 원래 엔진 내부 private 구현체였다. `EngineDriver` 인터페이스 계약을 이행하기 위해 `public`으로 승격됐으나, NestJS DI를 통한 `EngineDriver` 토큰이 아닌 `ExecutionEngineService` 직접 참조로도 접근 가능해진다. 즉 모듈 경계를 우회해 `ExecutionEngineService`를 직접 주입받는 소비자가 이 메서드들을 호출할 수 있는 경로가 열린다. `ExecutionEngineModule.exports`에 `RetryTurnService`가 포함되지 않아 외부 모듈 노출은 차단되지만, 모듈 내부에서는 결합도 리스크가 남는다.
- **제안**: TypeScript의 `protected` 또는 `/** @internal */` JSDoc 어노테이션을 추가해 의도적 제한임을 명시한다. 또는 이 메서드들을 별도 `EngineGraphExecutor` 클래스로 추출해 `ExecutionEngineService`가 delegation으로 사용하면, 실제 구현체를 `public`으로 유지하면서도 `ExecutionEngineService`의 공개 인터페이스를 오염시키지 않는다.

---

### [WARNING] `RetryTurnService`와 엔진 간 양방향(순환) DI가 3단계 forwardRef 체인을 형성
- **위치**: `execution-engine.module.ts` 주석, `retry-turn.service.ts` 생성자, `execution-engine.service.ts` 생성자
- **상세**: `ExecutionEngineService` → (forwardRef) → `RetryTurnService` → `ENGINE_DRIVER`(=`ExecutionEngineService`). 추가로 `RetryTurnService` → (forwardRef) → `AiTurnOrchestrator` → `ENGINE_DRIVER`(=`ExecutionEngineService`). 이로 인해 `AiTurnOrchestrator` 생성자에도 이미 순환 참조가 있으므로 실질적으로 세 서비스가 동일 순환 클러스터에 묶인다. 현재는 NestJS의 `forwardRef`가 이를 해소하지만, 순환 DI가 쌓이면 초기화 순서 버그·테스트 격리 비용이 증가한다.
- **제안**: `retryLastTurn` / `applyRetryLastTurn`의 엔진 thin delegator를 별도 진입점 파사드(예: `RetryEntrypoint` 토큰 또는 단순 facade 클래스)로 추출해, 엔진이 `RetryTurnService`를 직접 주입받는 대신 해당 파사드만 알도록 한다. 단, 현재 strangler-fig 완료 직후 단계에서는 외부 표면 보존(WS gateway, continuation processor의 `engine.retryLastTurn` 호출 경로)이 더 중요하므로 즉시 리팩토링 필요성은 낮다. 다음 God-class 분해 사이클에서 함께 검토하도록 plan에 기록하는 것을 권장한다.

---

### [INFO] `ExecutionGraphState` / `NodeDispatchLoopParams`의 export 승격이 모듈 경계 외부 노출 가능성을 열음
- **위치**: `execution-engine.service.ts` — `export interface ExecutionGraphState`, `export interface NodeDispatchLoopParams`
- **상세**: 두 인터페이스는 `EngineDriver` 시그니처에서 참조하기 위해 `export`가 됐다. 이들은 엔진 내부 graph execution 상태 구조체로, 현재는 `engine-driver.interface.ts`가 `import type { ... } from './execution-engine.service'`로 불러오므로 순환은 없다. 그러나 이 타입들이 서비스 파일에서 직접 export되므로 향후 다른 모듈이 `import { ExecutionGraphState } from './execution-engine.service'`로 직접 참조하는 코드를 작성할 경우 서비스 클래스 의존이 암묵적으로 발생할 수 있다.
- **제안**: `ExecutionGraphState`와 `NodeDispatchLoopParams`를 `engine-driver.interface.ts`나 별도 `execution-graph-types.ts` leaf 파일로 이동시켜, 서비스 구현체가 아닌 타입 파일에서 export하도록 한다. 이렇게 하면 `execution-engine.service.ts`에서 타입을 직접 import해야 하는 의존을 제거할 수 있고, 현재 `engine-driver.interface.ts → execution-engine.service.ts` 방향의 import를 역전시킬 수 있다.

---

### [INFO] `completeRetryExecution`이 `RetryTurnService`에서 `@internal` 의미 로직을 직접 수행 (레이어 책임)
- **위치**: `retry-turn.service.ts` lines 432–446 (`completeRetryExecution`)
- **상세**: `completeRetryExecution`은 `Execution` 엔티티를 직접 변경(`execution.status`, `execution.finishedAt`, `execution.durationMs`)하고 리포지터리를 통해 저장한 뒤 WebSocket 이벤트를 emit한다. 이 동작은 엔진의 `updateExecutionStatus`(guarded 전이 + segmentStartMs 추적)가 제공하는 공통 경로를 우회한다. defensive fallback 경로로만 사용되지만, `updateExecutionStatus`가 제공하는 M-3 guard(affected=0 동시성 처리)가 없어 동시 cancel/park와 경쟁 조건이 발생할 수 있다.
- **제안**: `completeRetryExecution`을 `this.driver.updateExecutionStatus(execution, ExecutionStatus.COMPLETED)` 경유로 교체한다. 이는 `resumeGraphAfterRetry` 정상 종결 경로(step 6)와 일관된 패턴이며 guarded 전이를 보장한다.

---

### [INFO] `RetryTurnService`의 `dataSource` 직접 접근 — 비즈니스 레이어와 인프라 레이어 혼재
- **위치**: `retry-turn.service.ts` — `@InjectDataSource() private readonly dataSource: DataSource`
- **상세**: `dataSource.transaction(...)` 내부에서 `manager.createQueryBuilder().update(NodeExecution).set(...)` 로 raw JSONB 연산을 수행한다. 이는 비즈니스 서비스에서 TypeORM raw 쿼리를 직접 실행하는 패턴으로, atomic consume + spawn의 특성상 불가피하나 레이어 경계를 모호하게 만든다. 기존 엔진 코드에서도 동일한 패턴이 있었으므로 이번 추출로 악화된 것은 아니지만, 레이어 책임 관점에서 향후 Repository 레이어에 `atomicConsumeRetryState` 같은 메서드로 캡슐화하는 것이 권장된다.
- **제안**: 즉시 수정 필요는 없으나, `NodeExecutionRepository`에 `atomicConsumeRetryState(nodeExecutionId: string): Promise<boolean>` 커스텀 메서드를 추출해 비즈니스 서비스가 인프라 쿼리 세부사항을 몰라도 되도록 계획하는 것을 권장한다.

---

## 요약

이번 C-1 step4 리팩토링은 strangler-fig 패턴을 일관되게 적용해 retry lifecycle을 god-class에서 `RetryTurnService`로 분리하는 방향은 명확히 옳다. `EngineDriver` 인터페이스를 DI seam으로 재사용해 순환 참조를 제어하는 접근 방식도 PR2·PR3의 선례와 일관성이 있다. 다만 step4에서 EngineDriver에 추가된 5개 저수준 그래프 실행 멤버(`rehydrateContext`, `loadAndBuildGraph`, `runNodeDispatchLoop`, `findActivatedBackEdge`, `clearLlmDefaultConfigCache`)는 고수준 라이프사이클 계약과 추상화 수준이 달라 인터페이스 응집도를 낮추고 있으며, 이에 따라 `private` 메서드 5개가 `public`으로 승격돼 엔진 캡슐화도 부분 약화됐다. `ExecuionGraphState`/`NodeDispatchLoopParams`의 서비스 파일 직접 export, `completeRetryExecution`의 guarded 전이 우회, `dataSource` 직접 접근도 개선 여지가 있다. 전체적으로 god-class 분해 목표 달성은 긍정적이나, EngineDriver 인터페이스 분리와 `completeRetryExecution`의 guarded 전이 교체는 후속 plan 항목으로 남겨두는 것이 권장된다.

## 위험도

MEDIUM
