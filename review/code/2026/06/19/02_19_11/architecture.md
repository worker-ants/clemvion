# 아키텍처(Architecture) Review

## 발견사항

### [INFO] 타입 레벨 순환 해소 — leaf 타입 모듈 분리 패턴은 적절
- 위치: `engine-driver.interface.ts` L10-13, `execution-engine.service.ts` L414-418, `types/graph-dispatch.types.ts` 전체
- 상세: `ExecutionGraphState` / `NodeDispatchLoopParams` 를 `execution-engine.service.ts` 에서 `types/graph-dispatch.types.ts` leaf 모듈로 분리함으로써 `engine-driver.interface.ts` ↔ `execution-engine.service.ts` 타입 레벨 순환을 끊었다. 이는 인터페이스 분리(ISP) 원칙에 부합하며, 중립 leaf 타입 모듈이 두 소비자 어느 쪽도 소유하지 않는 명확한 의존성 역전(DIP) 구조다.
- 제안: 현재 변경은 올바른 방향이다. 추가 조언 없음.

### [INFO] `EngineDriver` 인터페이스의 `@internal` 비대칭 문서화 — 충분히 설명됨
- 위치: `engine-driver.interface.ts` L26-30 (신규 JSDoc 단락)
- 상세: C-1 step4 이전의 7개 멤버는 `@internal` 미표기, step4에서 추가된 5개 멤버만 `@internal` 표기됨. 이번 변경에서 JSDoc 단락으로 "모든 멤버는 ENGINE_DRIVER 전용, step4 5멤버만 impl 대칭 @internal 명시" 라는 설명을 추가해 비대칭을 문서로 해소했다. 런타임/컴파일 산출물에 영향은 없다.
- 제안: 향후 PR-H/I 등 리팩터링 시 기존 7개 멤버에도 `@internal` 을 균등 추가하면 계약 표면 일관성이 높아진다(현재는 INFO 수준).

### [WARNING] god-class `ExecutionEngineService` (6,973줄) — 단일 책임 원칙 지속 위반
- 위치: `execution-engine.service.ts` (파일 전체, 6,973줄)
- 상세: C-1 step2~4 를 통해 `AiTurnOrchestrator`, `FormInteractionService`, `ButtonInteractionService`, `RetryTurnService` 로 4개 책임이 분해됐음에도 본 서비스는 여전히 6,973줄이다. `WorkflowExecutor` + `EngineDriver` 두 인터페이스를 동시에 구현(implements)하며, 그래프 순회·상태 전이·이벤트 발행·분산 실행·모든 공개 API·컨테이너 dispatch 등 복수의 primary responsibility 를 보유한다. JSDoc 도 "~4200줄로 크기가 크므로 PR-H/I 에서 점진적으로 책임 분해 예정"이라 직접 인정하고 있다. 이는 SRP 지속 위반 상태다.
- 제안: PR-H/I 를 통해 컨테이너 dispatch(`executeContainerBody`, `runParallel` 등) 또는 상태 머신(`updateExecutionStatus`, `markExecution*`) 클러스터를 별도 서비스로 추출하는 로드맵을 구체화하고 plan 에 명시된 일정을 유지할 것. 현재 변경 자체는 이 문제를 악화시키지 않는다.

### [WARNING] `forwardRef` 순환 DI 4개 — 구조적 순환 의존성 잔존
- 위치: `execution-engine.service.ts` L602, L606, L608, L612
- 상세: `AiTurnOrchestrator`, `FormInteractionService`, `ButtonInteractionService`, `RetryTurnService` 4개 서비스가 모두 `ENGINE_DRIVER`(= `ExecutionEngineService`) 를 역방향 주입받아 `forwardRef` 로 순환을 임시 해소하고 있다. DI 순환은 NestJS `forwardRef` 로 런타임에 해결되지만, 이는 모듈 경계의 구조적 문제를 숨기는 패치이며 초기화 순서 의존성·테스트 셋업 복잡도·디버깅 난이도를 높인다. 이번 변경이 신규 도입한 것은 아니나(pre-existing W1·W2), 리뷰 대상 코드에서 4개 지점이 명시적으로 노출된다.
- 제안: `EngineDriver` 를 통해 호출되는 엔진 잔류 메서드들이 실제로 엔진에 남아야 하는지 재검토 필요. 순환의 근본 원인은 추출된 서비스들이 도메인 로직을 완전히 이전받지 못하고 엔진의 graph/context 헬퍼를 여전히 필요로 하는 데 있다. `loadAndBuildGraph`, `runNodeDispatchLoop`, `rehydrateContext` 등을 별도 stateless `GraphExecutionHelper` 서비스로 분리하면 순환을 구조적으로 제거할 수 있다. PR-H/I 로드맵에 포함 권장.

### [INFO] `NodeDispatchLoopParams.executionId` JSDoc 추가 — 적절한 문서 보완
- 위치: `types/graph-dispatch.types.ts` L1744
- 상세: `executionId: string` 필드에 "현재 처리 중인 Execution UUID" 주석을 추가. `savedExecution.id` 와 중복될 수 있는 필드이나 dispatch loop 내부에서 flat 접근을 위한 denormalization 임을 명확히 한다. 런타임 영향 없음.
- 제안: 향후 `savedExecution.id === executionId` 불변식을 JSDoc 또는 런타임 assert 로 명시하면 호출자 오사용을 예방할 수 있다.

### [INFO] `EngineDriver` 인터페이스가 `engine-driver.interface.ts` 에 단독 존재 — 응집도 관점 적절
- 위치: `engine-driver.interface.ts` 전체
- 상세: 인터페이스 + DI 토큰(`ENGINE_DRIVER` 상수)을 동일 파일에 배치한 것은 DI 계약의 단일 진실 원칙에 부합한다. 소비자(`RetryTurnService`, `AiTurnOrchestrator` 등)가 토큰과 타입을 단일 import 경로로 가져올 수 있어 결합도가 낮다.
- 제안: 추가 조언 없음.

### [INFO] `types/graph-dispatch.types.ts` 의 `ExecutionGraphState` / `NodeDispatchLoopParams` — 책임 범위 명확
- 위치: `types/graph-dispatch.types.ts` JSDoc (L1688-1693)
- 상세: 파일 상단 JSDoc 이 분리 이유(타입 레벨 순환 해소)와 `GraphTraversalSummary` 와의 의미 분리를 명확히 설명하고 있다. `types/` 하위 leaf 모듈 패턴은 execution-engine 모듈 내 여러 서비스가 공유하는 순수 타입 계약을 격리하는 데 효과적이다.
- 제안: 추가 조언 없음.

## 요약

본 변경은 주석(JSDoc/인라인 코멘트) 전용으로 런타임·컴파일 산출물에 영향이 없다. 아키텍처 관점에서 세 가지 개선을 수행했다. (1) `types/graph-dispatch.types.ts` leaf 모듈 도입으로 `engine-driver.interface.ts` ↔ `execution-engine.service.ts` 타입 레벨 순환이 구조적으로 해소됐고, 이는 DIP·ISP 에 부합하는 올바른 방향이다. (2) `EngineDriver` JSDoc 에 `@internal` 비대칭 이유를 명시해 계약 문서의 자기완결성이 높아졌다. (3) `NodeDispatchLoopParams.executionId` 필드 설명 보완으로 데이터 구조 의도가 명확해졌다. 그러나 6,973줄 god-class `ExecutionEngineService` 가 `WorkflowExecutor` + `EngineDriver` 두 인터페이스를 동시 구현하며 복수의 primary responsibility 를 보유하는 SRP 위반, 그리고 추출된 4개 서비스와의 `forwardRef` 양방향 DI 순환이라는 두 구조적 문제는 이번 변경의 범위 밖에서 pre-existing 상태로 잔존한다. 이는 본 PR 의 결함이 아니라 PR-H/I 에서 처리할 로드맵 항목으로, 현재 변경이 이 문제를 악화시키지는 않는다.

## 위험도

LOW
