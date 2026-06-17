# Testing Review — NodeBootstrapService + WORKFLOW_EXECUTOR 토큰 추출 (C-1 step1/m-3)

## 발견사항

### [INFO] NodeBootstrapService 테스트: 존재하며 목적에 부합
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/codebase/backend/src/modules/execution-engine/node-bootstrap.service.spec.ts`
- 상세: 2개의 unit test 가 신설 서비스의 핵심 계약(WORKFLOW_EXECUTOR 주입 경로·ALL_NODE_COMPONENTS 참조 동일성)을 커버한다. mock-heavy 구조지만 서비스 자체가 1개의 public 메서드(onModuleInit)만 가지므로 mock 수준은 적절하다. ALL_NODE_COMPONENTS 를 하드코딩된 개수 대신 참조 동일성(`toBe(ALL_NODE_COMPONENTS)`)으로 단언하는 설계 선택은 신규 노드 추가 시 테스트 수정 불필요 점에서 합리적이다.
- 제안: 현 상태 유지.

### [WARNING] `execution-engine.service.spec.ts`에 잔류하는 `NodeHandlerDependenciesProvider` 등록이 불필요할 수 있음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — 라인 294, 15326, 15739, 16145
- 상세: `ExecutionEngineService`의 생성자에서 `NodeHandlerDependenciesProvider` 주입이 제거됐다(diff 확인). 그럼에도 service.spec.ts 의 여러 `Test.createTestingModule` 블록이 `NodeHandlerDependenciesProvider`를 providers 배열에 그대로 등록한다. NestJS `Test.createTestingModule`은 미사용 provider를 자동으로 무시하므로 테스트가 통과하지만, 이 코드는 오해를 유발한다: 리더는 "엔진 서비스가 여전히 이 의존성을 필요로 한다"고 착각할 수 있다. 또한 라인 15102의 `{ provide: NodeHandlerDependenciesProvider, useValue: { build: jest.fn().mockReturnValue({}) } }` 패턴은 더 명확히 무용해졌다.
- 제안: 각 `TestingModule` 블록에서 `NodeHandlerDependenciesProvider` 등록을 제거해 service 스펙이 실제 서비스 의존성을 정확히 반영하도록 한다. 단, 이는 경미한 정리 사항이며 현 PR 범위에 포함시킬 필요는 없다.

### [INFO] `NodeComponentRegistry` 등록이 service.spec.ts에 유지됨 (정상)
- 위치: 라인 296, 15328 등
- 상세: `ExecutionEngineService` 생성자에서 `NodeComponentRegistry`도 제거됐지만, service.spec.ts의 일부 describe 블록(예: `Container runtime`, 라인 7766)은 `handlerRegistry.register(...)` 를 직접 호출해 NodeComponentRegistry 부팅을 우회한다고 명시적으로 주석 처리되어 있다. NestJS DI가 무시하므로 즉각적 문제는 없으나, 앞선 WARNING과 동일한 이유로 죽은 등록이다.
- 제안: `NodeHandlerDependenciesProvider` 정리 시 함께 제거.

### [INFO] `onModuleInit` 회귀 테스트: 기존 테스트가 새 동작에 맞게 유효하게 유지됨
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — 라인 984–989
- 상세: `"onModuleInit 은 recovery 를 트리거하지 않는다"` 테스트가 여전히 유효하다. 변경 후 `ExecutionEngineService.onModuleInit`은 `registerHandlers()` 호출이 없고 queue-depth 등록만 수행하므로, 이 테스트의 "acquireLock 미호출" 단언은 계속 올바르다. 회귀 없음.

### [INFO] `NodeHandlerRegistry.assertConsistency`에 대한 `onApplicationBootstrap` 테스트: 잔류 유효
- 위치: 라인 992–999 (`onApplicationBootstrap 이 recovery 를 트리거하고 lock 을 해제한다`)
- 상세: `onApplicationBootstrap`에서 `handlerRegistry.assertConsistency()`를 호출하는 로직이 유지되며, 이 단계는 모든 `onModuleInit`(NodeBootstrapService 포함)이 완료된 후에 실행된다는 Nest lifecycle 보장을 테스트가 암묵적으로 커버한다. 단, `assertConsistency`가 올바르게 동작하는지를 service.spec.ts에서 직접 단언하는 테스트는 없다.
- 제안: 선택적 추가 — `NodeBootstrapService.onModuleInit` 이후 `handlerRegistry.assertConsistency()`가 예외를 던지지 않는지를 확인하는 통합 테스트 1건. 그러나 e2e(`execution-park-resume.e2e-spec.ts`) 스모크가 실부팅을 커버하고 있으므로 필수는 아니다.

### [INFO] Mock 적절성: NodeBootstrapService 스펙의 mock 경계 명확
- 위치: `node-bootstrap.service.spec.ts` 전체
- 상세: `componentRegistry.bootstrap`, `handlerDeps.build`를 `jest.fn()`으로 모킹하고 `workflowExecutor`를 빈 객체 stub으로 처리한 구조는 단위 테스트 경계로 정확하다. 실제 registry 동작(`node-component.registry.spec.ts`)과 실부팅 전수 등록(e2e)이 별도 레이어에서 커버된다는 점을 주석에 명시하고 있어 mock 의도가 명확하다.

### [INFO] `onModuleInit` 중복 호출 케이스 미테스트
- 위치: `node-bootstrap.service.spec.ts`
- 상세: Nest는 정상 운영 시 `onModuleInit`을 1회만 호출하지만, 테스트 픽스처에서 직접 `new NodeBootstrapService(...)` 후 `onModuleInit()`을 반복 호출하는 시나리오가 테스트되지 않는다. 현재 구현은 멱등성 보호 없이 `componentRegistry.bootstrap`을 직접 호출하므로, 중복 호출 시 `bootstrap`이 2회 실행된다. 실제 NestJS 환경에서는 발생하지 않는 시나리오이고 `bootstrap`이 덮어쓰기 가능한지 여부는 `NodeComponentRegistry` 구현에 달린 문제이므로 실용 위험은 낮다.
- 제안: LOW 우선순위 — 필요 시 `componentRegistry.bootstrap`이 멱등한지 registry 스펙에서 별도 단언.

### [INFO] `forwardRef` 제거에 대한 테스트 부재 (구조적으로 e2e에 위임)
- 위치: `nodes.module.ts` — `forwardRef(() => ExecutionEngineModule)` 제거
- 상세: 순환 의존 제거는 단위 테스트로 검증하기 어렵다. 실제 NestJS 컨테이너가 순환 없이 모듈을 resolve하는지는 e2e 부팅 스모크에서만 확인 가능하다. 커밋 메시지에 `e2e(202) 통과`가 명시되어 있어 이미 커버된 상태다.

## 요약

테스트 관점에서 이번 변경은 양호하다. 신설 `NodeBootstrapService`에 대한 단위 테스트(`node-bootstrap.service.spec.ts`)가 핵심 계약(WORKFLOW_EXECUTOR 경로·ALL_NODE_COMPONENTS 전수 전달)을 명확하게 검증하고, mock 경계와 커버리지 위임(registry spec / e2e)이 주석으로 잘 문서화되어 있다. 기존 회귀 테스트는 변경 후에도 유효하게 유지된다. 주요 경고는 `execution-engine.service.spec.ts`의 여러 `TestingModule` 블록에 `NodeHandlerDependenciesProvider`가 불필요하게 잔류한다는 점인데, 이는 기능적 오류가 아닌 테스트 가독성 문제다. 이 정리 항목은 현 PR에서 즉시 처리하거나 후속 PR에 이월해도 무방하다.

## 위험도

LOW
