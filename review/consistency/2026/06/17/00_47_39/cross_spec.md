## 발견사항

### [INFO] NodeBootstrapService 책임 분리가 spec/4-nodes/0-overview.md §1.0 의 부트스트랩 서술과 surface-level 비일치
- target 위치: `codebase/backend/src/modules/execution-engine/node-bootstrap.service.ts` 전체 + `execution-engine.module.ts` 주석
- 충돌 대상: `/Volumes/project/private/clemvion/spec/4-nodes/0-overview.md` §1.0 (`NodeComponentRegistry` 설명)
- 상세: `spec/4-nodes/0-overview.md §1.0` 은 "`NodeComponentRegistry`는 서버 부팅 시 `ALL_NODE_COMPONENTS` 배열을 순회하며 각 컴포넌트의 `createHandler(deps)`를 호출하여 `NodeHandlerRegistry`에 등록한다"고 기술한다. 이 문장은 `NodeComponentRegistry` 가 능동적으로 부트스트랩을 수행하는 주어처럼 읽히나, 실제로는 `NodeBootstrapService.onModuleInit()` 이 `NodeComponentRegistry.bootstrap()` 을 호출해 트리거하는 구조다. 행위 주체(누가 bootstrap 을 트리거하는가)가 spec 서술에 명시되지 않아 코드와 표현이 다소 어긋난다. 단, spec 이 "어떻게 트리거하는가"를 명시하지 않았을 뿐 계약의 결과(등록이 이루어짐)는 동일하게 유지된다. `NodeBootstrapService` 의 JSDoc(`node-bootstrap.service.ts` L26-30)은 이 계약이 유지됨을 명시적으로 기술하고 있다.
- 제안: `spec/4-nodes/0-overview.md §1.0` 의 해당 문장을 "서버 부팅 시 `NodeBootstrapService.onModuleInit` 이 `ALL_NODE_COMPONENTS` 를 순회하며 `NodeComponentRegistry.bootstrap` 을 호출해 `NodeHandlerRegistry` 에 등록한다"로 갱신해 구현 주체를 명확히 한다(project-planner 위임).

### [INFO] `HandlerDependencies` 주석의 wire-point 서술이 구현체와 다름
- target 위치: `codebase/backend/src/nodes/core/node-component.interface.ts` L325-332 (diff 기준)
- 충돌 대상: (동일 diff 파일 내 자기 수정이므로 외부 spec 충돌이 아닌 내부 정합성 갱신)
- 상세: diff 가 `cafe24ApiClient` / `makeshopApiClient` 의 jsdoc 주석에서 "Wired by `ExecutionEngineService.registerHandlers`" 를 "Wired by `NodeHandlerDependenciesProvider.build` via `NodeBootstrapService`"로 수정한다. 이는 다른 spec 영역과 충돌하지 않고 코드 내 주석의 정합성 갱신이다. `spec/4-nodes/4-integration/4-cafe24.md` · `spec/4-nodes/4-integration/5-makeshop.md` 는 wire-up 경로를 기술하지 않아 충돌 없음.

### [INFO] `NodesModule` 에서 `forwardRef` 제거 — spec 에 순환 의존성 언급 없음, 정합
- target 위치: `codebase/backend/src/modules/nodes/nodes.module.ts` L1,9-13
- 충돌 대상: 없음
- 상세: diff 가 `forwardRef(() => ExecutionEngineModule)` 을 직접 import 로 전환한다. `spec/4-nodes/0-overview.md` 및 `spec/5-system/4-execution-engine.md` 어디에도 NodesModule↔ExecutionEngineModule 순환 의존을 기술하거나 전제하는 내용이 없다. 실제 순환이 없었음을 확인한 정리이므로 spec 과 충돌하지 않는다.

---

## 요약

이번 diff(`engine-split` 브랜치)는 `ExecutionEngineService` 의 노드 핸들러 부트스트랩 책임을 `NodeBootstrapService` 로 분리하고, `WORKFLOW_EXECUTOR` DI 토큰을 도입해 엔진↔노드 레이어의 자기참조(`forwardRef`)를 제거한 순수 내부 리팩터링이다. 데이터 모델 엔티티·API endpoint·요구사항 ID·상태 머신·RBAC 모델에 대한 변경은 없다. 유일한 cross-spec 영향은 `spec/4-nodes/0-overview.md §1.0` 의 부트스트랩 주어("NodeComponentRegistry 가 직접 호출") 서술이 신규 `NodeBootstrapService` 트리거 구조와 표면적으로 어긋나는 것(INFO 수준)이다. 이 외에 CRITICAL·WARNING 등급의 모순은 발견되지 않았다.

---

## 위험도

LOW
