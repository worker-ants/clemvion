# 아키텍처(Architecture) Review — execution §1.3 single-node execution

**리뷰 일시**: 2026-06-15  
**대상 범위**: V098 마이그레이션, ExecutionEngineService 단일 노드 분기 + 두 헬퍼 메서드, WorkflowsController.executeNode, ExecuteNodeDto, Execution 엔티티, 프론트엔드 canvas/settings-panel/api 변경

---

## 발견사항

### [WARNING] ExecutionEngineService SRP 누적 위반 — 단일 노드 분기 로직이 이미 거대한 서비스에 추가됨

- **위치**: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `runExecution()` 내 단일 노드 분기(+`seedSingleNodePredecessorOutputs`, `getLatestPredecessorOutputs`)
- **상세**: `ExecutionEngineService`는 이미 7,700+ 라인을 넘는 god-class이다. 이번 변경은 `runExecution()` 루프에 두 개의 분기(`if (singleNodeId)` ×2 — seed 구간과 break 구간)와 private 헬퍼 두 개를 추가한다. 두 헬퍼(`seedSingleNodePredecessorOutputs`, `getLatestPredecessorOutputs`)는 "predecessor 출력 조회·캐시 주입"이라는 단일 책임을 가지며 분리 가능한 단위이다. 현재 구조는 SOLID의 단일책임원칙(SRP) 및 개방-폐쇄원칙(OCP) 양쪽 측면에서 이미 포화 상태인 서비스를 더 팽창시킨다. 기능 자체는 올바르지만 운반 컨테이너가 잘못됐다.
- **제안**: 즉각 리팩터는 v1 범위 밖이라면 TODO 주석 또는 별도 plan 항목으로 기록하라. 중기적으로는 단일 노드 실행 맥락 seed 로직을 `SingleNodeSeedService` 또는 `ExecutionContextSeedService` 분리 클래스로 추출해 `ExecutionEngineService`가 이를 주입받는 구조를 권장한다.

---

### [WARNING] WorkflowsController가 executionRepository를 직접 주입받음 — 레이어 책임 위반

- **위치**: `codebase/backend/src/modules/workflows/workflows.controller.ts` — `@InjectRepository(Execution)` 추가, `workflows.module.ts` — `TypeOrmModule.forFeature([..., Execution])` 추가
- **상세**: NestJS MVC 아키텍처에서 Controller는 HTTP 요청/응답 변환과 서비스 위임만 담당해야 한다(프레젠테이션 레이어). Repository는 데이터 레이어이다. 현재 `executeNode()` 메서드는 `previousExecutionId` 소속 검증을 Controller 안에서 직접 Repository 쿼리로 수행한다. 이는 비즈니스 유효성 검사 로직이 프레젠테이션 레이어에 위치하는 레이어 책임 위반이다. 동일한 검증이 다른 진입점(예: WebSocket, 배치 트리거)에서 재사용될 때 중복이 강제된다. 기존 코드의 `execute()` 엔드포인트는 이 검증을 Controller에 두지 않는 패턴을 따랐다.
- **제안**: `previousExecutionId` 소속 검증을 `ExecutionEngineService.execute()` 내부 또는 별도 `ExecutionsService.assertBelongsToWorkflow()` 메서드로 이동시키고, Controller는 검증된 DTO를 서비스에 전달하는 역할만 남긴다. `WorkflowsModule`의 `TypeOrmModule.forFeature([Execution])` 등록도 제거될 수 있다.

---

### [WARNING] WorkflowsModule → Execution 엔티티 직접 등록 — 모듈 경계 약화

- **위치**: `codebase/backend/src/modules/workflows/workflows.module.ts`
- **상세**: `Execution` 엔티티와 그 Repository는 `ExecutionEngineModule` (또는 `ExecutionsModule`)의 소유 영역이다. `WorkflowsModule`이 자체 `TypeOrmModule.forFeature`에 `Execution`을 등록함으로써 두 모듈이 같은 ORM 엔티티에 동시 등록되는 구조가 됐다. TypeORM forFeature 중복 등록은 기술적으로 동작하나 모듈 경계가 불명확해진다. 이미 `WorkflowsModule → ExecutionEngineModule` 순환이 `forwardRef`로 존재하는 상황에서 이 직접 등록은 결합도를 더 높인다.
- **제안**: `ExecutionEngineModule`(또는 별도 `ExecutionsModule`)에서 `ExecutionRepository`를 export하거나, 검증 메서드를 해당 모듈의 서비스로 구현해 `WorkflowsModule`이 그 서비스를 주입받는 방식으로 모듈 경계를 복원한다.

---

### [WARNING] workflow-canvas.tsx에서 useExecutionStore.getState() 직접 호출 — React 데이터 흐름 패턴 위반

- **위치**: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` — `handleRunThisNode` 내 `useExecutionStore.getState()` 호출
- **상세**: `handleRunThisNode`는 `useCallback`으로 선언되어 `[workflowId, isDirty, saveWorkflow, startExecution]`을 deps로 갖는다. 그러나 내부에서 `useExecutionStore.getState()`를 직접 호출해 `status`와 `executionId`를 snapshot으로 읽는다. 이 값들이 deps 배열에 없으므로 callback이 stale closure를 가질 수 있다. 또한 getState()는 Zustand 스토어의 구독을 우회하는 imperative 접근으로, React의 단방향 데이터 흐름 패턴과 충돌한다. `status === "running"` 가드가 stale 값을 기반으로 판단될 경우 중복 실행이 허용되거나 유효한 실행이 차단될 수 있다.
- **제안**: `const execStatus = useExecutionStore((s) => s.status)` 와 `const execExecutionId = useExecutionStore((s) => s.executionId)` 를 컴포넌트 레벨 훅으로 선언하고 deps에 포함시킨다. 또는 Zustand 스토어에 `isRunning` selector를 추가해 컴포넌트가 구독 기반으로 읽도록 한다.

---

### [INFO] ExecuteOptions 유니온 타입 확장 방식 — 조건부 분기 중첩 증가

- **위치**: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `ExecuteOptions` 타입 + `execute()` 내 `'singleNodeId' in options` 가드
- **상세**: `ExecuteOptions`는 판별 유니온(discriminated union) 구조를 취하지만 `singleNodeId`/`previousExecutionId` 추가가 `executedBy` variant에만 국한되어 있다. `execute()` 메서드는 이미 `'responseCode' in options`, `'dryRun' in options`, `'singleNodeId' in options` 등 `in` 연산자 가드를 연속으로 사용한다. 이 패턴이 계속 누적되면 유니온 분기가 복잡해지고 타입 안전성 유지가 어려워진다. 현재는 동작하지만 구조적 취약점이다.
- **제안**: `executedBy` variant의 옵션 필드들을 별도 `ManualExecutionOptions` 인터페이스로 분리해 가독성과 확장성을 높이는 리팩터를 향후 계획에 포함한다. 현재 구현은 기존 패턴의 연장이라 즉각 차단 사안은 아니다.

---

### [INFO] `seedSingleNodePredecessorOutputs`에서 canonical 형태 판별 인라인 구현 — 추상화 레벨 불일치

- **위치**: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `seedSingleNodePredecessorOutputs()` 내 `isCanonical` 판별 블록
- **상세**: `isCanonical` 체크(`'config' in storedOutput && 'output' in storedOutput`)는 NodeHandlerOutput의 canonical shape 판별 로직을 서비스 메서드 안에 인라인으로 구현한다. 이 판별은 `handler-output.adapter` 모듈이 이미 처리해야 하는 도메인 지식이다. 동일 판별이 다른 경로에서 중복 구현되면 adapter가 canonical 구조를 변경할 때 서비스 코드가 동기화되지 않는 위험이 있다.
- **제안**: `handler-output.adapter`에 `isCanonicalHandlerOutput(value: unknown): boolean` 타입 가드를 export하고 `seedSingleNodePredecessorOutputs`에서 이를 사용한다. 추상화 경계가 복원되고 변경 지점이 단일화된다.

---

### [INFO] node-settings-panel InfoTab 결과 표시 — 선형 탐색 성능 패턴

- **위치**: `codebase/frontend/src/components/editor/settings-panel/node-settings-panel.tsx` — `InfoTab`의 `latestResult` useMemo
- **상세**: `nodeResults` 배열을 역방향 선형 탐색(`for i = length-1 → 0`)으로 최신 결과를 찾는다. 노드 실행 횟수가 증가하면(루프 반복 또는 장시간 실행) 이 탐색 비용이 선형적으로 증가한다. 현재 v1 범위에서는 수용 가능하나 성능 잠재 위험이다.
- **제안**: `executionStore`에 `nodeId → latestResult` Map 인덱스를 별도 유지하거나, selector를 `nodeId` 파라미터를 받는 팩토리 패턴으로 제공한다. v1에서는 현행 유지 가능하나 결과 누적량이 많아지는 시나리오에 대비한 TODO를 남긴다.

---

## 요약

이번 변경(§1.3 단일 노드 실행)은 기능 흐름 자체의 설계(엔드포인트 → 검증 → 영속 → 큐 → runExecution 분기 → predecessor seed → break → 출력)는 기존 dry_run/re_run_of 선례 패턴을 일관되게 따르고 있어 기능적 정합성은 확보되어 있다. 그러나 아키텍처 측면에서 두 가지 Warning이 두드러진다. 첫째, Controller 레이어가 Repository를 직접 주입받아 비즈니스 유효성 검사를 수행하는 것은 프레젠테이션/비즈니스 레이어 책임 분리 원칙에 어긋나며, `WorkflowsModule`에 `Execution` 엔티티를 직접 등록함으로써 모듈 경계가 약화된다. 둘째, 이미 포화 상태인 `ExecutionEngineService`에 단일 노드 전용 분기와 헬퍼를 추가하는 것은 SRP/OCP 누적 위반이다. 프론트엔드에서 `getState()` 직접 호출로 인한 stale closure 위험도 실제 버그 경로가 될 수 있어 수정이 권장된다. 나머지 INFO 항목들은 v1 범위에서 수용 가능한 기술 부채이다.

---

## 위험도

MEDIUM
