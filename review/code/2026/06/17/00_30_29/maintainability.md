# 유지보수성(Maintainability) 리뷰

## 발견사항

### [INFO] NodeBootstrapService — 단일 책임 분리, 구조 명확
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/codebase/backend/src/modules/execution-engine/node-bootstrap.service.ts`
- 상세: 45줄의 서비스로 bootstrap 책임만 담당. `onModuleInit` 이 딱 한 가지 일(컴포넌트 등록)만 수행하며 클래스 JSDoc이 설계 의도·배치 이유·시점 안전성까지 문서화. 신설 서비스 중 가장 유지보수성이 높은 파일.
- 제안: 없음.

### [INFO] WORKFLOW_EXECUTOR 토큰 — 상수 string 타입
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/codebase/backend/src/nodes/core/workflow-executor.interface.ts` line 하단
- 상세: `export const WORKFLOW_EXECUTOR = 'WORKFLOW_EXECUTOR'`로 선언. string 리터럴 토큰은 NestJS 관례상 흔하지만, 토큰 충돌 위험을 원천 차단하려면 `Symbol('WORKFLOW_EXECUTOR')` 패턴을 쓰는 코드베이스도 있다. 현재 프로젝트 내 다른 토큰(`CONTINUATION_DLQ_MONITOR_CONFIG`, `'SHUTDOWN_GRACE_MS'` 등)도 모두 string 방식이므로 **기존 컨벤션과 일치**. 불일치 없음.
- 제안: 없음(컨벤션 일관성 유지).

### [INFO] execution-engine.module.ts 인라인 코멘트 밀도
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/codebase/backend/src/modules/execution-engine/execution-engine.module.ts` lines 199-207
- 상세: `NodeBootstrapService` 및 `WORKFLOW_EXECUTOR` 제공자 블록에 한국어 인라인 주석 3줄이 달려있다. 주석이 설계 의도를 정확히 설명하고 있어 가독성에 기여한다. 단, 모듈 내 다른 주석들(예: "Phase 2", "PR1", "Phase 3.1")과 스타일이 혼재(영문 레이블 vs 한국어 본문). 이미 코드베이스 전반에서 혼용되고 있어 이 변경이 새로운 불일치를 도입하지는 않음.
- 제안: 없음(기존 패턴 준수).

### [INFO] nodes.module.ts forwardRef 제거 — 코드 단순화
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/codebase/backend/src/modules/nodes/nodes.module.ts`
- 상세: 실제 순환 없는 `forwardRef` 제거는 불필요한 코드 복잡도를 낮추는 적절한 정리. 제거 후 남긴 주석이 "왜 forwardRef 없이도 되는지" 구조를 설명하고 있어 향후 유지보수 시 오해 방지에 기여.
- 제안: 없음.

### [INFO] node-bootstrap.service.spec.ts — 테스트 케이스 중복 가드
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/codebase/backend/src/modules/execution-engine/node-bootstrap.service.spec.ts`
- 상세: 두 번째 테스트 케이스(`'build 결과 객체를 bootstrap 의 deps 인자로 그대로 전달한다'`)는 첫 번째 케이스와 실질적으로 동일한 단언(`expect(componentsArg).toBe(ALL_NODE_COMPONENTS); expect(depsArg).toBe(built)`)을 수행한다. 첫 번째 케이스에서 `toHaveBeenCalledWith(ALL_NODE_COMPONENTS, built)`로 이미 동일 사실을 검증. 두 번째 케이스는 `.mock.calls[0]` 구조 분해 방식만 다를 뿐 새로운 행동을 검증하지 않아 테스트 의도가 모호하다.
- 제안: 두 번째 케이스를 제거하거나, 실제로 다른 시나리오(예: `build`가 다른 객체를 반환할 때 `bootstrap`에 그대로 전달되는지)를 커버하도록 수정해 중복을 줄일 것. 현재 구현은 회귀 가드로서 기능은 하나 테스트 의도 가독성이 낮다.

### [WARNING] execution-engine.service.ts — `OnModuleInit` 구현 잔류
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` line 1060, line 1255
- 상세: `registerHandlers()` 호출은 제거됐으나 `ExecutionEngineService`가 여전히 `OnModuleInit`을 구현(`implements OnModuleInit, OnApplicationBootstrap, WorkflowExecutor`)하고 `onModuleInit()`을 정의하고 있다. `onModuleInit` 본문에는 큐 깊이 provider 등록 로직만 남아 있어 기능적으로 정확하다. 그러나 처음 파일을 읽는 개발자가 `implements OnModuleInit`을 보면 "이 서비스에 초기화 책임이 있다"고 오해할 여지가 있다. 특히 bootstrap 책임이 `NodeBootstrapService`로 이전된 사실과의 연관성이 클래스 선언부에서 명확하지 않다.
- 제안: `onModuleInit` 상단에 `// NOTE: 노드 핸들러 bootstrap 은 NodeBootstrapService(C-1 step1)로 이전됨. 본 hook 은 큐 깊이 gauge 등록 전용.` 같은 짧은 주석을 추가하면, 큐 관련 로직만 있음이 의도적임을 명확히 할 수 있다.

### [INFO] node-component.interface.ts 주석 갱신 — 정확도 향상
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/codebase/backend/src/nodes/core/node-component.interface.ts` lines 2444-2451
- 상세: `cafe24ApiClient`, `makeshopApiClient` 주석을 `ExecutionEngineService.registerHandlers`에서 `NodeHandlerDependenciesProvider.build via NodeBootstrapService`로 갱신. 구현 경로를 정확하게 반영하는 적절한 변경.
- 제안: 없음.

## 요약

이번 변경은 9,670줄 god-class에서 노드 핸들러 bootstrap 책임을 `NodeBootstrapService`로 분리하는 strangler-fig 1단계로, 유지보수성 관점에서 전반적으로 긍정적이다. 신설 `NodeBootstrapService`는 45줄·단일 책임·명확한 JSDoc을 갖추어 이상적인 형태이고, `WORKFLOW_EXECUTOR` 토큰은 기존 string 토큰 컨벤션과 일관성을 유지한다. `forwardRef` 제거와 stale 주석 갱신도 코드베이스 명확성을 높인다. 경미한 개선점으로는 (1) `ExecutionEngineService.onModuleInit`에 bootstrap 이전을 명시하는 주석 추가, (2) 테스트 케이스 2번의 중복 단언 정리가 있으나, 모두 기능 정확성에 영향을 주지 않는 낮은 우선순위 사항이다.

## 위험도

LOW
