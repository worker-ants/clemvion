# 부작용(Side Effect) 리뷰 결과

> 대상: execution §1.3 single-node execution (FRESH review — post-resolution)
> 리뷰 세션: 2026-06-15 15:29:28

---

## 발견사항

### [INFO] 정상 실행 경로 무변경 확인 (핵심 검증 항목)

- 위치: `execution-engine.service.ts` L3758–3760 (`if (singleNodeId) { break; }`)
- 상세: `singleNodeId === null` 인 일반/부분 실행은 단일 노드 분기(`break`)에 진입하지 않는다. `singleNodeId` 는 `savedExecution.singleNodeId ?? null` 로 읽히고, 기존 실행 행은 V098 마이그레이션에 의해 `NULL` 유지된다. `seedSingleNodePredecessorOutputs` 호출도 `if (singleNodeId)` 로 guard 되어 일반 실행 시 `executedNodes` / `nodeOutputCache` / `structuredOutputCache` 에 대한 어떤 외부 상태 변경도 일어나지 않는다. `resultNodeId` 계산도 `singleNodeId ?? sortedNodeIds[sortedNodeIds.length - 1]` 로 기존 topological-last 로직을 그대로 보존한다. 정상 실행 경로는 구조적으로 변경이 없다.
- 제안: 이상 없음.

### [INFO] `isCanonicalHandlerOutput` 리팩토링 — 동작 동치성 확인

- 위치: `handler-output.adapter.ts` L201–205
- 상세: `isCanonicalHandlerOutput` 은 `isNewShape(raw)` 를 래핑하는 thin delegate 이다. `isNewShape` 는 기존에 동일 파일에 존재하던 private 함수이며 (`typeof raw === 'object' && raw !== null && !Array.isArray(raw) && 'config' in raw && 'output' in raw`) 로직이 변경되지 않았다. `seedSingleNodePredecessorOutputs` 가 이를 사용하는 유일한 신규 호출 지점이며, 이전에는 동일 조건이 호출처에 인라인으로 중복 작성됐다. 내부 판별 로직의 동치성이 유지되므로 기존 `adaptHandlerReturn` 경로에 영향 없음.
- 제안: 이상 없음.

### [INFO] DB 스키마 부작용 — nullable 컬럼 추가, 기존 행 영향 없음

- 위치: `V098__execution_single_node.sql`
- 상세: `ALTER TABLE execution ADD COLUMN single_node_id UUID NULL`, `ADD COLUMN previous_execution_id UUID NULL` 는 기본값 NULL 로 추가된다. 기존 행은 자동으로 NULL 이 채워지며 NOT NULL 제약·FK 제약 없음. 인덱스 미추가. DOWN 스크립트가 주석으로 제공된다. 데이터 손실·기존 쿼리 회귀 없음.
- 제안: 이상 없음.

### [INFO] `ExecuteOptions` 타입 확장 — 기존 호출자 영향 없음

- 위치: `execution-engine.service.ts` L558–585 (`ExecuteOptions` 타입 정의)
- 상세: `singleNodeId?` / `previousExecutionId?` 가 `executedBy` variant 에만 추가된다 (optional 필드). 기존 `triggerId` variant 및 `{}` variant 는 unchanged. TypeScript discriminated union 이라 기존 호출자(`triggerId`·schedule 경로)는 컴파일 에러 없이 그대로 동작한다. 새 필드가 없는 기존 `executedBy` 호출(일반 수동 실행, re-run)에서는 `singleNodeId = null`, `previousExecutionId = null` 이 영속되어 NULL 기본값을 유지한다.
- 제안: 이상 없음.

### [INFO] `WorkflowsModule` — `Execution` 엔티티 등록 부작용

- 위치: `workflows.module.ts` L13 (`TypeOrmModule.forFeature([Workflow, Node, Edge, Execution])`)
- 상세: `Execution` 엔티티를 `WorkflowsModule` 의 `forFeature` 에 추가하는 것은 해당 모듈 스코프에서 `ExecutionRepository` DI 토큰을 노출한다. TypeORM 의 `forFeature` 는 같은 엔티티를 여러 모듈에 중복 등록해도 공유 DataSource 에서 동일 Repository 인스턴스를 반환하므로 별도 커넥션이나 트랜잭션 격리 변경이 발생하지 않는다. 의도치 않은 부작용(추가 DB 커넥션·상태 공유 오염)은 없다.
- 제안: 이상 없음 (아키텍처 레이어 우려는 이전 리뷰 W-1/W-2에서 DEFER 처리됨).

### [INFO] `WorkflowsController.executeNode` — `executionRepository.findOneBy` 직접 호출

- 위치: `workflows.controller.ts` L489–501 (`previousExecutionId` 검증 블록)
- 상세: DB 읽기 전용(`findOneBy`) 호출이므로 상태 변경 없음. `previousExecutionId` 검증 실패 시 예외만 throw 하고 어떤 상태도 기록하지 않는다. `workflowId` 스코핑으로 타 워크플로우 실행의 row 가 검증을 통과하는 경우가 없다. 파일시스템·전역 변수 변경 없음.
- 제안: 이상 없음.

### [INFO] `seedSingleNodePredecessorOutputs` — 공유 컨텍스트 상태 변경 범위

- 위치: `execution-engine.service.ts` L7802–7843
- 상세: `contextService.setStructuredOutput` + `contextService.setNodeOutput` + `executedNodes.add` 를 실행해 `structuredOutputCache`, `nodeOutputCache`, `executedNodes` 세 가지 실행 컨텍스트 내부 상태를 변경한다. 이들은 모두 해당 `executionId` 에 종속된 스코프 객체이므로 다른 실행과 공유되지 않는다(`contextService.createContext` 가 새 Map 항목으로 격리). `previousExecutionId` 가 null 이거나 predecessor 가 없으면 early return 으로 어떤 상태도 수정하지 않는다. 기존 실행 흐름과의 간섭 없음.
- 제안: 이상 없음.

### [INFO] 프론트엔드 — `handleRunThisNode` 의 `useExecutionStore.getState()` 직접 호출

- 위치: `workflow-canvas.tsx` `handleRunThisNode` 콜백
- 상세: 이전 리뷰 W-4 에서 지적됐으며 RESOLUTION 에서 주석 명시로 조치됐다. `useExecutionStore.getState()` 는 Zustand store 의 live 스냅샷을 반환하는 탈출구 패턴이며, closure 에 캡처된 stale 값을 읽는 것이 아니다. `isDirty`·`saveWorkflow`·`startExecution` 은 의존 배열(`deps`)에 올바르게 등록됐다. `workflowsApi.executeNode` 네트워크 호출 전 `isDirty` 저장 대기 및 TOCTOU 재확인(W-14 조치)이 추가됐다. 의도치 않은 전역 상태 변경 없음.
- 제안: 이상 없음.

### [INFO] `startExecution` 호출 — execution-store 상태 변경

- 위치: `workflow-canvas.tsx` L705 (`startExecution(executionId)`)
- 상세: `startExecution` 은 `execution-store` 의 `status`, `executionId` 를 업데이트하는 정상적인 상태 전이이다. 이 함수는 기존 toolbar `handleRun` 경로에서도 동일하게 호출되므로 신규 부작용이 없다.
- 제안: 이상 없음.

### [INFO] `InfoTab` — `nodeResults` 구독 추가

- 위치: `node-settings-panel.tsx` `InfoTab` 컴포넌트
- 상세: `useExecutionStore((s) => s.nodeResults)` 구독이 추가됐다. `nodeResults` 는 실행 중 WS 이벤트로 갱신되는 배열이며, 이를 구독하면 `nodeResults` 가 변경될 때마다 `InfoTab` 이 re-render 된다. 전역 상태 자체의 변경은 없으며 read-only 구독이다. 새 prop `nodeId` 는 `NodeSettingsPanel` 이 `selectedNodeId` 를 전달하고, `selectedNodeId` 가 이미 `useEditorStore` 에서 관리되므로 추가 전역 상태 도입 없음.
- 제안: 이상 없음.

### [INFO] 환경 변수·파일시스템·외부 서비스 호출 무변경

- 상세: 변경된 파일 중 환경 변수를 읽거나 쓰는 신규 코드 없음. 마이그레이션 SQL 이 DB DDL 을 수행하는 것 외에 파일시스템 쓰기 없음. `workflowsApi.executeNode` 는 동일 백엔드(`/api` 경로)를 호출하는 내부 HTTP 요청이며, 이것은 의도된 신규 API 호출이다. 제3자 외부 서비스 호출 없음.
- 제안: 이상 없음.

### [INFO] 이벤트/콜백 — EXECUTION_STARTED / EXECUTION_COMPLETED emit 경로 무변경

- 위치: `execution-engine.service.ts` `runExecution` L3595, L3936
- 상세: 단일 노드 실행도 일반 실행과 동일한 `EXECUTION_STARTED` / `EXECUTION_COMPLETED` (또는 `EXECUTION_FAILED`) 이벤트를 emit 한다. 이벤트 페이로드 형식 변경 없음. 단일 노드 실행 완료 시 WS 이벤트가 기존 Run Results 드로어 타임라인에 그대로 표시되는 것은 의도된 동작이다.
- 제안: 이상 없음.

---

## 요약

이번 변경은 단일 노드 실행(§1.3) 기능을 기존 실행 엔진 위에 **가산적(additive)** 으로 추가한다. 정상 실행 경로에 대한 부작용은 구조적으로 차단되어 있다. `singleNodeId = null` 인 기존 실행은 신규 조건 분기(`if (singleNodeId)`)에 진입하지 않으며, V098 마이그레이션의 nullable 컬럼 추가는 기존 행과 쿼리에 영향이 없다. `isCanonicalHandlerOutput` 리팩토링은 `isNewShape` 의 thin delegate 로 동작 동치성이 확인된다. `seedSingleNodePredecessorOutputs` 가 변경하는 세 가지 캐시 상태(`structuredOutputCache`, `nodeOutputCache`, `executedNodes`)는 모두 실행 ID 스코프 내 격리 객체이며 다른 실행과 공유되지 않는다. 프론트엔드의 `handleRunThisNode` 는 기존 `handleRun` 패턴을 따르며 전역 상태를 예상치 못하게 오염시키지 않는다. 의도하지 않은 부작용은 발견되지 않았다.

---

## 위험도

NONE
