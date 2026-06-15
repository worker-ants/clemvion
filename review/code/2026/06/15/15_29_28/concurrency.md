# 동시성(Concurrency) 리뷰 결과

> 대상: execution §1.3 single-node execution (FRESH post-resolution review)
> 세션: review/code/2026/06/15/15_29_28

---

## 발견사항

### [INFO] `handleRunThisNode` — TOCTOU 재확인 주석 존재 (W-14 조치 완료)
- 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx`, `handleRunThisNode` 내부
- 상세: `saveWorkflow()` await 이전에 `useExecutionStore.getState().status === "running"` 을 확인하고, await 완료 후 `useExecutionStore.getState().status === "running"` 을 재확인하는 2-phase 가드가 적용되어 있다. 이전 리뷰에서 지적된 TOCTOU(W-14)는 `saveWorkflow` await 후 두 번째 getState() 호출로 해소됐다. 단일 스레드 이벤트 루프 환경(브라우저 React)이므로 await 재개 후 재확인 패턴이 충분하다.
- 제안: 조치 완료, 추가 조치 불필요.

### [INFO] `useExecutionStore.getState()` 직접 호출 — live 스냅샷 의도 주석 명시 (W-4 조치 완료)
- 위치: `workflow-canvas.tsx`, `handleRunThisNode`
- 상세: `const execState = useExecutionStore.getState()` 와 `useExecutionStore.getState().status === "running"` 두 호출 모두 클릭 핸들러 실행 시점의 live store 스냅샷을 읽는다. 주석에 "stale closure 아님 — 항상 live 스냅샷" 의도가 명시됐다. Zustand의 `getState()` 는 동기 스냅샷이므로 이벤트 루프상 콜백 진입 즉시의 상태를 정확히 읽는다. `execState.executionId` 는 클릭 시점 값이므로 await 이후에도 변경 가능하나, `executionId` 는 seed 참조(previousExecutionId) 용도이므로 변경돼도 잘못된 실행이 트리거되지 않는다(이미 실행 완료된 execId를 seed로 전달하는 것은 의미상 올바름).
- 제안: 이상 없음.

### [INFO] `seedSingleNodePredecessorOutputs` — 공유 캐시 접근 직렬성
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`, `seedSingleNodePredecessorOutputs`
- 상세: `contextService.setStructuredOutput` / `setNodeOutput` / `executedNodes.add` 호출이 `for...of` 루프 내에서 순차 동기 실행된다. Node.js 단일 스레드 이벤트 루프 위에서 동기 코드 내 경쟁 조건이 없다. `getLatestPredecessorOutputs` 의 DB I/O(await)는 루프 전에 완료되며, 이후의 캐시 쓰기는 모두 동기다. `runExecution` 자체가 단일 실행 인스턴스이므로 같은 context에 대한 병렬 접근도 발생하지 않는다.
- 제안: 이상 없음.

### [INFO] `getLatestPredecessorOutputs` — tie-break id DESC 추가 (I-31 조치 완료)
- 위치: `execution-engine.service.ts`, `getLatestPredecessorOutputs`
- 상세: `order: { finishedAt: 'DESC', id: 'DESC' }` 로 동점 시 id(lexicographic UUID = 생성 순) tie-break 가 추가됐다. 컨테이너 반복으로 동일 노드가 여러 NodeExecution 을 생성하는 경우에도 결정적으로 최신 행을 선택한다. 이전 리뷰 I-31 조치 완료.
- 제안: 이상 없음.

### [INFO] `runExecution` 메인 루프 — `singleNodeId` break 후 outputData 마감
- 위치: `execution-engine.service.ts`, `runExecution` 메인 while 루프 및 완료 분기
- 상세: `singleNodeId` break 후 `resultNodeId = singleNodeId ?? sortedNodeIds[sortedNodeIds.length - 1]` 로 출력 노드를 결정한다. while 루프를 `break` 로 탈출하면 이후 `updateExecutionStatus(COMPLETED)` 경로로 직행하므로, downstream 전파·parallel branch 합류 대기 없이 완료된다. async/await 체인 상 완료 분기는 항상 단일 경로로 진입하며 deadlock 우려가 없다.
- 제안: 이상 없음.

### [INFO] 프론트엔드 `void handleRunThisNode(nodeId)` — floating promise
- 위치: `workflow-canvas.tsx`, `handleNodeMenuAction` switch case "run"
- 상세: `void handleRunThisNode(nodeId)` 로 호출해 Promise를 명시적으로 무시한다. 단일 노드 실행 시작은 fire-and-forget 패턴이며, 실패 시 catch 블록에서 `console.error` 처리한다. 이벤트 핸들러에서 async를 void 로 처리하는 것은 React 이벤트 핸들러 관례상 정상 패턴이다(unhandled rejection 방지 포함). 에러 UX 개선은 v1 범위 외 후속 과제로 명시됐다.
- 제안: 이상 없음.

---

## 요약

이번 변경의 동시성 관련 코드는 다음 두 영역으로 요약된다. (1) 프론트엔드 `handleRunThisNode` — 단일 스레드 이벤트 루프 환경에서 `saveWorkflow` await 전후 store 상태 재확인으로 TOCTOU 를 방어하며, 이전 리뷰(W-14) 조치가 명확히 반영됐다. (2) 백엔드 `seedSingleNodePredecessorOutputs` + `getLatestPredecessorOutputs` — Node.js 단일 스레드 특성상 동기 캐시 쓰기 구간에 경쟁 조건이 없으며, DB 조회 결과의 결정적 정렬(finishedAt DESC, id DESC)도 I-31 조치로 보완됐다. 전체적으로 동시성 위험 신규 항목이 없고 이전 지적 사항이 모두 적절히 해소된 상태다.

---

## 위험도

NONE
