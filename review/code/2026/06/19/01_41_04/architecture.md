# Architecture Review

## 발견사항

### [INFO] 타입 레벨 순환 의존성 해소 — leaf 타입 모듈 추출
- 위치: `types/graph-dispatch.types.ts` (신규), `engine-driver.interface.ts` L36, `execution-engine.service.ts` L392-345
- 상세: `execution-engine.service.ts` 에 인라인 정의됐던 `ExecutionGraphState` / `NodeDispatchLoopParams` 를 `types/graph-dispatch.types.ts` 로 이동해, `engine-driver.interface.ts` 가 god-class 서비스를 `import type` 하던 타입 레벨 역방향 순환을 제거했다. 중립 leaf 모듈 패턴은 올바른 접근이다.
- 제안: 현재 구조 유지. `types/` 디렉터리가 엔진 내 타입 집합 역할로 확장될 경우, 파일별 단일 관심사(그래프 vs 실행 메타 vs 상태 등)를 유지해 폴더 응집도를 보존할 것.

### [INFO] @internal JSDoc 주석 — 공개 인터페이스 내 내부 전용 메서드 표식
- 위치: `engine-driver.interface.ts` L45, L54, L63, L72, L81 (`rehydrateContext`, `loadAndBuildGraph`, `runNodeDispatchLoop`, `findActivatedBackEdge`, `clearLlmDefaultConfigCache`)
- 상세: 5개 `@internal` 메서드가 **공개 TypeScript 인터페이스** `EngineDriver` 에 포함돼 있다. `@internal` JSDoc 주석은 관례적 계약이나 컴파일 타임 강제가 없고, 인터페이스 소비자(테스트 코드 포함)가 DI 토큰 없이 구현체를 직접 주입받으면 우회 가능하다. 현재는 "EngineDriver 계약을 통해서만 호출" 주석이 있으나, 실제로 `execution-engine.service.ts` 자체가 `this.rehydrateContext(...)`, `this.loadAndBuildGraph(...)` 등을 직접 호출하므로 `@internal` 의미가 "외부 모듈 금지"가 아닌 "RetryTurnService 외부 금지"에 가깝다.
- 제안: 내부 전용 표면과 외부 노출 표면을 별도 인터페이스로 분리하거나(`EngineDriverPublic` / `EngineDriverInternal`), 현재 단일 인터페이스 구조를 유지할 경우 주석의 "금지 대상"을 더 명확히 기술할 것("RetryTurnService 이외 외부 모듈" → "execution-engine 모듈 바깥"). 방향은 ISP(인터페이스 분리 원칙) 관점에서 분리가 더 엄격하지만, god-class 분해가 진행 중인 현 시점에서 단일 인터페이스가 실용적으로 수용 가능하다.

### [WARNING] god-class ExecutionEngineService 미완 분해 — 6972줄 단일 클래스
- 위치: `execution-engine.service.ts` 전체 (6972줄, public 메서드 30+ 개)
- 상세: C-1 step1~4 를 통해 `AiTurnOrchestrator`, `FormInteractionService`, `ButtonInteractionService`, `RetryTurnService` 가 추출됐으나 서비스 자체는 여전히 6972줄이다. `runNodeDispatchLoop` (약 400줄), `rehydrateContext` (약 170줄), `loadAndBuildGraph`, `runContainer`, `runParallel`, `executeBackgroundSubgraph` 등 다수의 대형 메서드가 단일 클래스에 잔류한다. 단일 책임 원칙(SRP) 관점에서 graph 순회/빌드, 컨테이너 실행, 노드 dispatch, 상태 머신, 이벤트 발행이 혼재한다.
- 제안: 주석이 언급하는 PR-H/I 의 점진적 분해 계획을 구체화할 것. 우선순위 대상: `loadAndBuildGraph` + `GraphTraversalService` 연계 → `GraphBuildService` 독립, `runContainer`/`runParallel` → 이미 추출된 `ForEachExecutor`/`ParallelExecutor` 과의 책임 경계 재검토.

### [WARNING] forwardRef 4개 순환 DI — 아키텍처 결합 신호
- 위치: `execution-engine.service.ts` L601, L605, L607, L611 (`AiTurnOrchestrator`, `FormInteractionService`, `ButtonInteractionService`, `RetryTurnService`)
- 상세: 추출된 서비스 4개가 모두 `ENGINE_DRIVER`(=`ExecutionEngineService`)를 역으로 주입받아 NestJS `forwardRef` 4개가 발생했다. 이는 DIP(의존성 역전 원칙) 관점에서 의도된 추상화 레이어가 존재하나, 추출된 서비스들이 엔진 내부 capability(`rehydrateContext`, `loadAndBuildGraph` 등)에 의존하는 구조적 결합이 해소되지 않았음을 보여준다. `forwardRef` 자체는 NestJS 패턴으로 허용 가능하나, 이 숫자가 증가하면 초기화 순서 버그와 테스트 격리 비용이 높아진다.
- 제안: `EngineDriver` 인터페이스가 이미 추상화 경계를 제공하므로 현재 구조는 수용 가능하다. 단, 신규 서비스 추출 시 `forwardRef` 추가를 기준선으로 삼지 말고, 엔진 잔류 capability를 더 작은 단위의 독립 서비스로 분리해 단방향 의존이 가능한지 먼저 검토할 것.

### [INFO] `@internal` 표식과 `public` 접근 제어자의 의미론적 충돌
- 위치: `execution-engine.service.ts` L1045(`public async rehydrateContext`), L1181(`public async loadAndBuildGraph`), L1259(`public async runNodeDispatchLoop`), L5001(`public clearLlmDefaultConfigCache`), L5324(`public findActivatedBackEdge`)
- 상세: `@internal` 메서드들이 `public` 으로 선언돼 있다. TypeScript 에서 `public` 은 어떤 호출자도 컴파일 타임 오류 없이 호출 가능하므로, `@internal` 주석의 의도와 언어 레벨 접근 제어가 불일치한다. `RetryTurnService` 가 `driver` 인터페이스로 간접 호출하더라도 구현체에서는 `public` 이므로 미래 호출자가 `this.engineService.rehydrateContext(...)` 로 직접 참조해도 TypeScript 는 경고하지 않는다.
- 제안: `@internal` 의도를 강제하려면 TypeScript `private`/`protected` 를 사용해야 하나, 인터페이스 구현 메서드는 `public` 이어야 한다는 제약이 있다. 실용적 대안: 구현 클래스 `ExecutionEngineService` 에 `ENGINE_DRIVER` 인터페이스만 노출하는 facade 레이어를 두거나, 해당 메서드를 별도 class 로 분리해 `ExecutionEngineService` 가 합성하는 방식. 현재 단계에서는 문서화 정책으로 수용 가능하나, 팀 내 인식이 필요하다.

### [INFO] `ExecutionCancelledError` @internal 표식 — workflow-errors.ts 외부 노출 불가 확인 불충분
- 위치: `workflow-errors.ts` L2197 (`ExecutionCancelledError`)
- 상세: `@internal` JSDoc 이 추가됐으나 `workflow-errors.ts` 는 `export class ExecutionCancelledError` 로 선언돼 있고, 같은 파일에 외부 노출 대상(`WorkflowNotFoundError`, `InvalidExecutionStateError`, `RetryLastTurnError` 등)과 혼재한다. 소비자가 실수로 직접 `import { ExecutionCancelledError }` 해도 컴파일 오류가 없다.
- 제안: 현재 레이어(leaf 에러 모듈 단일화로 `instanceof` 일관성 유지)는 올바른 설계다. `@internal` 표식 추가로 의도가 명확해진 점도 긍정적이다. 장기적으로 `workflow-errors.ts` 를 `public-errors.ts` / `internal-errors.ts` 로 분리하면 경계가 더 명확해진다.

### [INFO] `dispatchMeta: { startedAt?: string; mode: 'manual' }` 인라인 타입 — 확장성 제한
- 위치: `types/graph-dispatch.types.ts` L89 (`NodeDispatchLoopParams.dispatchMeta`)
- 상세: `dispatchMeta` 의 `mode` 가 `'manual'` 리터럴로 고정돼 있다. 향후 `schedule`, `webhook`, `inline` 등 다른 실행 모드가 dispatch loop 를 거칠 경우 타입을 변경해야 하며, 모든 호출자가 영향받는다.
- 제안: `mode: 'manual'` 을 `ExecutionMode` 타입 또는 `'manual' | 'schedule' | 'webhook' | 'inline'` 유니온으로 확장하거나, 현재 scope 에서 `manual` 이 유일한 진입이라면 주석으로 이유를 명시할 것.

## 요약

이번 변경은 `execution-engine.service.ts` ↔ `engine-driver.interface.ts` 간 타입 레벨 순환 의존을 `types/graph-dispatch.types.ts` leaf 모듈로 해소한 핵심 리팩터링이다. 의존성 방향이 명확해졌고, `@internal` JSDoc 으로 계약 경계도 문서화됐다. 아키텍처 방향은 올바르다. 주요 미완 과제는 6972줄 god-class `ExecutionEngineService` 의 점진적 분해(PR-H/I 예정)와, 추출된 서비스들이 엔진 잔류 capability에 역방향 의존하는 `forwardRef` 4개 구조다. `@internal` 메서드가 `public` 접근 제어자를 가질 수밖에 없는 TypeScript 한계로 인해 주석 수준의 경계 강제가 언어 레벨에서 보장되지 않는 점은 팀 내 명확한 규약이 필요하다. 전반적으로 현 단계 분해 범위(C-1 step4) 내에서는 합리적인 점진적 개선이며, 신규 Critical/Blocking 수준의 구조적 문제는 없다.

## 위험도

LOW
