# 요구사항(Requirement) 리뷰 결과

리뷰 대상 커밋: `7e38716ac3dc9972cf2941a673797b4adbc387d6`
범위: `refactor(execution-engine): NodeBootstrapService + WORKFLOW_EXECUTOR 토큰 추출 (C-1 step1/m-3)`

---

## 발견사항

### [INFO] ExecutionEngineService 가 OnModuleInit 을 구현하지만 실질 body 가 없음 (의도적)
- 위치: `execution-engine.service.ts` L5, L716, L911-L1287
- 상세: `registerHandlers()` 를 제거한 후 `onModuleInit` 에는 `businessMetrics.registerQueueDepthProvider` 등록만 남는다. `OnModuleInit` 인터페이스 구현 유지는 해당 로직 때문에 필요하므로 제거하지 않은 것이 옳다. 빈 lifecycle hook 이 아니라 실질 로직이 남아 있다.
- 제안: 변경 없음. 현 구현이 정확하다.

### [INFO] NodeBootstrapService 가 ExecutionEngineModule 에 배치된 이유 — spec `code:` 글로브 자동 커버
- 위치: `node-bootstrap.service.ts`, `execution-engine.module.ts`
- 상세: `spec/4-nodes/0-overview.md §1.0` 의 `code: codebase/backend/src/nodes/core/**` 글로브는 NodeBootstrapService 를 포함하지 않지만, plan 에서 명시한 대로 `NodeHandlerDependenciesProvider` (엔진 레이어 deps 집약) 때문에 nodes/core 거주 시 순환이 발생하므로 execution-engine 모듈 배치가 필수적이다. spec 의 `code:` 글로브는 레지스트리 파일을 열거하는 "주요 파일 발췌"(line 35·48)이며 신규 파일 추가를 요구하지 않는다. 기능 이행 경로 (NodeComponentRegistry 가 여전히 ALL_NODE_COMPONENTS 를 순회하여 NodeHandlerRegistry 에 등록) 은 spec 계약을 그대로 만족한다.
- 제안: 변경 없음. spec fidelity 유지 확인됨.

### [INFO] 이중 bootstrap 방어 — NodeComponentRegistry 내 중복 등록 throw 가드 존재
- 위치: `node-component.registry.ts` L48-49
- 상세: 만약 NodeBootstrapService.onModuleInit 이 두 번 호출될 경우 (이론적으로 불가하지만) `throw new Error('Duplicate node component registration: ...')` 로 즉시 감지된다. Nest 는 단일 인스턴스 모듈 내 `onModuleInit` 을 1회만 호출하므로 실질 위험 없음.
- 제안: 변경 없음.

### [INFO] spec `4-nodes/0-overview.md §1.0` 의 `WORKFLOW_EXECUTOR` DI 토큰 미언급
- 위치: `/Volumes/project/private/clemvion/spec/4-nodes/0-overview.md` L32
- 상세: spec 은 `workflow-executor.interface.ts` 를 "sub-workflow 실행을 위한 engine <-> 노드 계약"으로 명시하며 `WorkflowExecutor` 인터페이스 자체를 정의하는 파일로 나열한다. 새로 추가된 `WORKFLOW_EXECUTOR` DI 토큰 상수는 같은 파일에 co-locate 됐지만 spec 본문에는 언급이 없다. 이는 spec 이 인터페이스 계약을 기술하고 DI 바인딩 세부사항은 구현 재량으로 남겨둔 정상 패턴 — spec 침묵 영역(INFO)에 해당한다. spec 갱신이 필요한 API 계약 변경이 아니다.
- 제안: 변경 없음 (spec 이 DI 바인딩 세부사항에 침묵함은 의도적).

### [INFO] `nodes.module.ts` — forwardRef 제거 안전성 확인
- 위치: `nodes.module.ts` L1-L66
- 상세: `ExecutionEngineModule` 은 `NodesModule` 을 import 하지 않으며 (`grep NodesModule execution-engine.module.ts` → 출력 없음), `NodesModule` → `ExecutionEngineModule` 방향만 존재한다. AppModule 이 양쪽을 직접 import 하므로 import 순서 결정은 NestJS 에 위임된다. 실제 순환이 없으므로 `forwardRef` 제거는 정확하다. 빌드 및 e2e 통과로 검증됨.
- 제안: 변경 없음.

---

## 기능 완전성 평가

1. **기능 완전성**: 완전 구현됨. `registerHandlers()` 의 전체 본체 (`componentRegistry.bootstrap(ALL_NODE_COMPONENTS, handlerDeps.build(this))`) 가 `NodeBootstrapService.onModuleInit` 으로 이전됐다. `handlerDeps.build(this)` 의 `this` 자기참조는 `handlerDeps.build(this.workflowExecutor)` 로 대체되며, `WORKFLOW_EXECUTOR` 토큰은 `useExisting: ExecutionEngineService` 로 바인딩되므로 동일 인스턴스를 참조한다.

2. **엣지 케이스**: `ALL_NODE_COMPONENTS` 가 빈 배열인 경우 `NodeComponentRegistry.bootstrap` 은 루프를 0회 실행하고 `Registered 0 node components` 를 로그한다 — 예외 발생 없음. 이후 `assertConsistency()` 가 handler 미등록을 감지해 throw 한다. 올바른 처리 순서다.

3. **TODO/FIXME**: 대상 파일 전체에서 미완성 표식 없음.

4. **의도와 구현 간 괴리**: 없음. 코드 주석 ("god-class 에서 분리", "DI 경계로 대체", "gratuitous forwardRef 제거")과 실제 구현 내용이 일치한다.

5. **에러 시나리오**: bootstrap 실패 시 (`createHandler` 에서 예외 발생) `NodeComponentRegistry.bootstrap` 이 throw 하고, Nest 모듈 초기화가 중단된다. 이는 부팅 실패로 이어져 의도된 빠른 실패(fail-fast) 동작이다.

6. **데이터 유효성**: `NodeBootstrapService` 자체는 `ALL_NODE_COMPONENTS` 를 정적 import 로 받으므로 유효성 검증 불필요. `workflowExecutor` 는 DI 컨테이너가 `ExecutionEngineService` 인스턴스를 바인딩하므로 null 진입 불가.

7. **비즈니스 로직**: spec `4-nodes/0-overview.md §1.0` 의 계약 — "NodeComponentRegistry 는 서버 부팅 시 ALL_NODE_COMPONENTS 배열을 순회하며 각 컴포넌트의 `createHandler(deps)` 를 호출하여 NodeHandlerRegistry 에 등록한다" — 이 그대로 유지된다. 트리거 진입점이 `ExecutionEngineService.onModuleInit` → `NodeBootstrapService.onModuleInit` 으로 이동했을 뿐이고 `NodeComponentRegistry.bootstrap` 이 여전히 순회·등록을 수행한다.

8. **반환값**: `NodeBootstrapService.onModuleInit(): void` — void 선언에 맞게 명시적 반환 없음. 내부 `componentRegistry.bootstrap` 도 void 이므로 모든 경로 정합.

9. **Spec fidelity**: 검토된 관련 spec 문서는 `spec/4-nodes/0-overview.md` 와 `spec/5-system/4-execution-engine.md` (bootstrap 미언급, assertConsistency 언급). 두 spec 모두 "누가 bootstrap 을 트리거하는가" 에 대해 침묵하거나(노드 overview) 또는 부팅 검증 시점만 기술(엔진 spec §574 `assertConsistency` onApplicationBootstrap)한다. 코드의 Nest lifecycle 보장 — `onModuleInit` (bootstrap) → `onApplicationBootstrap` (assertConsistency) — 은 spec §574 와 정확히 일치한다. 위반 사항 없음.

---

## 요약

이 변경은 `ExecutionEngineService`(god-class)에서 노드 핸들러 bootstrap 책임을 `NodeBootstrapService` 로 분리하는 순수 리팩토링이다. spec `4-nodes/0-overview.md §1.0` 의 핵심 계약("NodeComponentRegistry 가 서버 부팅 시 ALL_NODE_COMPONENTS 를 순회하여 NodeHandlerRegistry 에 등록")은 불변이며, 트리거 lifecycle 진입점만 이동했다. `WORKFLOW_EXECUTOR` DI 토큰은 `WorkflowExecutor` 인터페이스(spec 명시 경로)를 DI 경계로 정확히 투영한 것으로 spec 의도와 일치한다. `forwardRef` 제거는 순환이 실재하지 않음을 확인 후 단행됐고 빌드·e2e 통과로 검증됐다. 기능 완전성, 에러 처리, spec fidelity 전 항목에서 요구사항 충족이 확인되며 critical/warning 발견사항 없음.

---

## 위험도

NONE
