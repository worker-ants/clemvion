# 아키텍처(Architecture) 리뷰 결과

## 발견사항

### [INFO] NodeBootstrapService 단일 책임 원칙 적용 — 양호
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/codebase/backend/src/modules/execution-engine/node-bootstrap.service.ts`
- 상세: `ExecutionEngineService`(9,670줄 god-class)에서 노드 핸들러 bootstrap 책임을 45줄의 전용 서비스로 분리했다. `onModuleInit` 하나만 구현하며, 역할이 명확히 한 가지(`ALL_NODE_COMPONENTS` 순회 등록 트리거)로 수렴한다. SRP 준수.
- 제안: 현재 구조 유지.

### [INFO] WORKFLOW_EXECUTOR DI 토큰 — 의존성 역전 원칙 실현
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/codebase/backend/src/nodes/core/workflow-executor.interface.ts` (라인 2548)
- 상세: 옛 `handlerDeps.build(this)` 자기참조(NodeBootstrapService 가 엔진 클래스를 직접 알아야 하는 강결합)를 `WORKFLOW_EXECUTOR` 토큰 + `useExisting: ExecutionEngineService` 바인딩으로 DI 경계로 대체했다. `NodeBootstrapService`는 `WorkflowExecutor` 인터페이스만 알고 구체 클래스를 모른다. DIP 정석 적용.
- 제안: 현재 구조 유지.

### [INFO] forwardRef 제거 — 허위 순환 의존성 소거
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/codebase/backend/src/modules/nodes/nodes.module.ts`
- 상세: `NodesModule`의 `forwardRef(() => ExecutionEngineModule)` 제거. 실제 순환은 존재하지 않았다(ExecutionEngineModule은 NodesModule을 import하지 않음). 불필요한 `forwardRef`는 Nest의 초기화 순서를 모호하게 만들고, 미래 순환 위험을 가리는 아티팩트다. 제거 후 그래프가 명확해졌다.
- 제안: 현재 구조 유지.

### [WARNING] NodeBootstrapService의 레이어 배치 — 차선책이나 합리적
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/codebase/backend/src/modules/execution-engine/node-bootstrap.service.ts`
- 상세: `NodeBootstrapService`가 `execution-engine` 모듈에 배치됐으나 `ALL_NODE_COMPONENTS`(`nodes/` 레이어)를 직접 import한다. 이는 execution-engine 레이어가 nodes 레이어 전체 카탈로그를 알게 되는 구조다. 이상적으로는 nodes 레이어가 execution-engine 레이어를 몰라야 하지만, plan 문서(c1-engine-split.md)에서 분석한 대로 `nodes/core`에 두면 `nodes → engine` 순환이 발생하므로 이 배치가 현재 아키텍처에서 유일한 무순환 경로다. 근본 해소는 PR2 이후 `EngineDriver` 도입 시점으로 설계가 이미 수립되어 있다.
- 제안: 현재 단계에서는 허용. PR2 이후 `EngineDriver` 도입 후 `NodeBootstrapService`의 ALL_NODE_COMPONENTS 의존을 플러그인 등록 패턴(각 노드 모듈이 자기를 등록)으로 역전시키는 것을 장기 목표로 유지할 것.

### [WARNING] ExecutionEngineService가 여전히 god-class — 이 PR의 한계임을 명시
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- 상세: constructor 의존성이 26 → 24로 줄었지만 서비스 본체는 여전히 9,670줄이다. `OnModuleInit + OnApplicationBootstrap + WorkflowExecutor` 세 인터페이스를 동시에 구현하며 그래프 순회, 노드 dispatch, 상태 머신, 이벤트 발행, 분산 실행, 재수화(rehydration) 등 복수의 도메인 책임을 보유한다. 이는 이 PR 하나로 해소 불가능한 구조적 부채이며, stacked PR 계획(PR2 AiTurnOrchestrator → PR3 Form/Button → PR4 Retry)에 따라 점진 해소될 예정이다. 현 PR은 strangler-fig 방식의 첫 단계임이 plan에 명확히 기술되어 있다.
- 제안: PR2~4 계획 진행. 각 단계에서 `EngineDriver` 인터페이스를 통해 내부 콜백 표면을 최소화하고 추출 서비스가 엔진 내부 상태에 직접 접근하지 않도록 설계할 것.

### [INFO] NodeHandlerDependenciesProvider의 Optional 주입 패턴 — 적절한 유연성
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/codebase/backend/src/modules/execution-engine/handlers/node-handler-dependencies.provider.ts`
- 상세: `@Optional()` 데코레이터로 카페24/메이크샵 클라이언트, 에이전트 메모리, 캐시 버스를 선택적으로 주입한다. `HandlerDependencies` 인터페이스의 해당 필드도 optional로 선언되어 있어 타입 레벨에서도 일관성이 유지된다. 테스트에서 최소 픽스처로 사용 가능하고, 레거시 환경과 호환된다.
- 제안: 현재 구조 유지.

### [INFO] 모듈 경계 — NodeComponentRegistry는 nodes/core에 적절히 위치
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/codebase/backend/src/nodes/core/node-component.registry.ts`
- 상세: `NodeComponentRegistry`가 `NodeHandlerRegistry`에만 의존하고, 엔진 서비스를 직접 참조하지 않는다. bootstrap 입력으로 `HandlerDependencies`를 받는 팩토리 패턴을 사용해 엔진 결합을 피한다. 레이어 책임 분리가 명확하다.
- 제안: 현재 구조 유지.

### [INFO] 테스트 전략 — 참조 동일성 단언으로 하드코딩 회피
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/codebase/backend/src/modules/execution-engine/node-bootstrap.service.spec.ts`
- 상세: `ALL_NODE_COMPONENTS` 배열을 하드코딩 숫자 대신 참조 동일성(`toBe(ALL_NODE_COMPONENTS)`)으로 단언해 신규 노드 추가 시 테스트 갱신이 불필요하다. 테스트 설계가 안정적이다.
- 제안: 현재 구조 유지.

### [INFO] Lifecycle 순서 보장 — onModuleInit → onApplicationBootstrap 체인
- 위치: `execution-engine.service.ts` `onApplicationBootstrap` (라인 1295), `node-bootstrap.service.ts` `onModuleInit`
- 상세: `NodeBootstrapService.onModuleInit`이 핸들러를 등록하고, `ExecutionEngineService.onApplicationBootstrap`이 `handlerRegistry.assertConsistency()`를 호출한다. NestJS의 lifecycle 계약상 모든 모듈의 `onModuleInit` 완료 후 `onApplicationBootstrap`이 실행되므로, 등록 → 검증 순서가 보장된다. race 조건 없음.
- 제안: 현재 구조 유지.

---

## 요약

이 변경은 9,670줄 god-class `ExecutionEngineService`에서 노드 핸들러 bootstrap 책임을 분리하는 strangler-fig 리팩토링의 첫 단계로, 아키텍처 관점에서 올바른 방향으로 진행되고 있다. `WORKFLOW_EXECUTOR` DI 토큰 도입으로 엔진-노드 레이어 경계가 인터페이스로 한정되고, `forwardRef` 제거로 허위 순환이 소거되었으며, `NodeBootstrapService`의 단일 책임 적용으로 god-class의 초기화 부채가 일부 해소됐다. `NodeBootstrapService`가 `ALL_NODE_COMPONENTS`를 직접 import하는 구조는 현재 아키텍처에서 순환을 피하기 위한 차선책이지만, plan 문서에 명시된 PR2~4(EngineDriver 도입 및 책임 추가 분리)가 진행되면 점진적으로 개선될 구조다. god-class 자체는 이 PR 한 단계로 해소되지 않으나 이는 설계 범위 내의 의도된 점진 전략이다.

## 위험도

LOW
