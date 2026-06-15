# 부작용(Side Effect) Review — execution §1.3 single-node execution

검토일: 2026-06-15
대상 파일: 21개 (backend 9, frontend 5, plan/review 7)

---

## 발견사항

### [WARNING] `seedSingleNodePredecessorOutputs` 가 공유 `ExecutionContext` 를 직접 변경
- 위치: `execution-engine.service.ts` — `seedSingleNodePredecessorOutputs` 내 `contextService.setStructuredOutput` / `contextService.setNodeOutput` / `executedNodes.add`
- 상세: 이 private 헬퍼는 `context.nodeOutputCache`, `context.structuredOutputCache` 를 pre-seed 하고 `executedNodes` Set 을 변경한다. `context` 와 `executedNodes` 는 `runExecution` 의 로컬 변수이지만, 동일 실행 컨텍스트 키(`ctxKey`)를 공유한다. 단일 노드 분기(`singleNodeId != null`)에서만 호출되므로 일반 실행 경로에는 영향이 없다. 그러나 `seedSingleNodePredecessorOutputs` 가 실패(DB 오류 또는 빈 결과) 하면 컨텍스트가 부분적으로 채워진 채로 main loop 에 진입할 수 있어, 그 상태에서 `gatherNodeInput` 이 일부 predecessor 출력을 cache-hit 하고 일부는 수동 입력으로 fallback 하는 혼합 상태가 발생할 수 있다. 이는 설계상 허용된 동작(partial seed → manual input fallback)이나, 예외를 catch 하지 않으므로 DB 오류 시 `runExecution` 전체가 propagate 실패한다.
- 제안: `seedSingleNodePredecessorOutputs` 내 `getLatestPredecessorOutputs` 호출을 try/catch 로 감싸거나, 호출부에서 오류를 잡아 "seed 실패 → 수동 입력으로 graceful fallback" 경로를 명시할 것을 권장한다. 현재는 DB 오류가 실행 전체를 실패로 마킹한다.

---

### [WARNING] `handleRunThisNode` 에서 `useExecutionStore.getState()` 직접 접근
- 위치: `workflow-canvas.tsx` — `handleRunThisNode` callback, line `const execState = useExecutionStore.getState();`
- 상세: `useCallback` 내부에서 `useExecutionStore.getState()` 를 직접 호출하는 것은 React 렌더링 사이클 밖의 상태 스냅샷이다. `execState.status` / `execState.executionId` 는 호출 시점(클릭 이벤트)의 값을 읽는 것이므로 로직상 의도한 동작이다. 그러나 `startExecution` 은 의존성 배열에 포함되어 있지만 `getState()` 로 읽는 `execState.executionId` 와 `execState.status` 는 의존성 배열에 없다. 이는 stale closure 를 만들지 않는다(매 클릭마다 `getState()` 로 현재값 취득) — 그러나 패턴 불일치로 유지보수자가 `useExecutionStore(s => s.status)` 를 dependency로 추가하고 싶어질 수 있다. 실질적 부작용은 없으나 코드 일관성 위험이 존재한다.
- 제안: 패턴을 `useExecutionStore(s => ({ status: s.status, executionId: s.executionId }))` 셀렉터로 통일하거나, 현재 `getState()` 패턴에 주석을 달아 "이벤트 핸들러이므로 getState() 가 의도된 패턴임"을 명시한다.

---

### [WARNING] `WorkflowsController` 가 `ExecutionRepository` 를 직접 주입 — 도메인 레이어 bypass
- 위치: `workflows.controller.ts` — `@InjectRepository(Execution)` + `workflows.module.ts` — `TypeOrmModule.forFeature([..., Execution])`
- 상세: Controller 가 `ExecutionsService` 없이 `Repository<Execution>` 을 직접 주입받아 `findOneBy` 를 호출한다. 이는 기존 패턴(`Node` 리포지토리 직접 주입 — 이미 이전 commit 에서 동일)과 일치하지만, `Execution` 은 별도 모듈(`ExecutionsModule`)에 이미 서비스가 존재할 가능성이 있으며, 직접 리포지토리 접근이 허용되면 향후 `Execution` 도메인 로직(예: 소프트 삭제, 상태 검증) 이 중복 구현될 위험이 있다. 부작용 관점에서는 `WorkflowsModule` 이 `Execution` 테이블에 대한 직접 읽기 권한을 가지게 되어 `ExecutionEngineModule` 과의 DI 경계가 느슨해진다.
- 제안: 검증 전용 메서드(`validatePreviousExecution(id, workflowId): Promise<boolean>`)를 `ExecutionEngineService` 나 별도 `ExecutionsService` 에 노출시키는 것이 도메인 경계 보존에 유리하다. 현재 구현은 작동하지만 Warning 수준의 아키텍처 부작용이다.

---

### [INFO] `ExecuteOptions` 유니온 타입 확장 — non-`executedBy` variant 에 필드 불전달 보장
- 위치: `execution-engine.service.ts` — `ExecuteOptions` 타입 정의, `execute()` 메서드
- 상세: `singleNodeId` / `previousExecutionId` 는 `executedBy` variant(수동 실행 경로)에만 추가됐다. `'singleNodeId' in options` narrow 가드로 non-executedBy 경로에서는 `null` 영속이 보장된다. 기존 trigger 실행(`triggerId` variant), webhook 실행 등 일반 실행 경로는 이 필드가 `null` 로 영속되어 DB 에 공백 row 로 저장된다. 이는 의도된 동작이며 회귀 없음. 신규 컬럼이 nullable/default null 이므로 기존 row 에도 영향 없다.
- 제안: 없음. 구현 정상.

---

### [INFO] `sortedNodeIds[sortedNodeIds.length - 1]` → `singleNodeId ?? ...` outputData 변경
- 위치: `execution-engine.service.ts` — `runExecution` 완료 outputData 결정 블록
- 상세: 단일 노드 실행 시 `resultNodeId = singleNodeId` 로 대체되어 execution 의 `outputData` 가 마지막 topological 노드가 아닌 대상 노드의 캐시에서 취해진다. `singleNodeId` 가 null 인 일반 실행 경로에서는 `resultNodeId = sortedNodeIds[sortedNodeIds.length - 1]` 로 기존 동작과 동일하다 — 회귀 없음.
- 제안: 없음. 조건 분기가 명확하고 일반 경로가 보존된다.

---

### [INFO] `InfoTab` 함수 시그니처 변경 — `nodeId` 파라미터 추가
- 위치: `node-settings-panel.tsx` — `InfoTab({ nodeType, nodeId })` (기존: `InfoTab({ nodeType })`)
- 상세: `InfoTab` 은 내부 private 컴포넌트(파일 밖으로 export 되지 않음)이므로 외부 API 변경이 아니다. 유일한 호출부인 `NodeSettingsPanel` 이 같은 파일에 있으며 이미 `nodeId={selectedNodeId}` 를 전달하도록 수정됐다. 다른 호출부 없음 — 외부 부작용 없음.
- 제안: 없음.

---

### [INFO] `workflowsApi.executeNode` 는 `previousExecutionId` 와 `input` 을 항상 body 에 포함
- 위치: `workflows.ts` — `executeNode` API client
- 상세: `options?.previousExecutionId` 가 `undefined` 이어도 `{ previousExecutionId: undefined, input: undefined }` 형태로 body 를 직렬화해 전송한다. Axios 기본 직렬화에서 `undefined` 값 키는 JSON stringify 시 제거되므로 실제 네트워크 요청에는 포함되지 않는다 — 의도치 않은 필드 전송 없음.
- 제안: 없음. 동작 정상.

---

### [INFO] `saveWorkflow()` 의 부작용 — 단일 노드 실행 전 자동 저장
- 위치: `workflow-canvas.tsx` — `handleRunThisNode`, `if (isDirty) { const saved = await saveWorkflow(); ... }`
- 상세: dirty 상태의 캔버스는 단일 노드 실행 전 자동 저장된다. 이는 의도된 동작(최신 설정 실행)이지만, `saveWorkflow()` 실패 시 `saved = false` 로 실행이 조용히 중단된다(`return` 처리). 사용자에게 저장 실패 피드백이 없다면 "실행 버튼을 눌렀는데 아무것도 안 된다" 는 UX 부작용이 생긴다.
- 제안: `saveWorkflow()` 가 false 반환 시 토스트/오류 메시지를 표시하도록 호출부에서 처리하거나, 기존 `saveWorkflow` 구현에 이미 오류 UI 가 있는지 확인한다.

---

## 요약

단일 노드 실행(§1.3) 구현에서 의도치 않은 전역 상태 변경이나 기존 일반 실행 경로의 회귀를 일으키는 부작용은 발견되지 않았다. `ExecuteOptions` 유니온 타입 확장은 `'singleNodeId' in options` narrow 가드로 일반 경로와 격리되고, migration V098 양 컬럼이 nullable/default null 이므로 기존 row 영향이 없다. 주목할 점은 두 가지다. 첫째, `seedSingleNodePredecessorOutputs` 가 공유 `ExecutionContext` 를 변경하는 과정에서 DB 오류 시 부분 seed 후 예외가 propagate 되어 실행 전체가 실패하는 경로가 있으므로, 오류 catch 및 graceful fallback 추가를 권장한다. 둘째, `WorkflowsController` 가 `Execution` 리포지토리를 직접 주입받는 것은 도메인 경계 관점의 아키텍처 경고다. 프론트엔드에서는 `handleRunThisNode` 의 자동 저장 실패 시 사용자 피드백 누락이 UX 부작용으로 존재한다. 이 세 항목은 모두 Warning/Info 수준이며 blocking 사안은 없다.

---

## 위험도

LOW
