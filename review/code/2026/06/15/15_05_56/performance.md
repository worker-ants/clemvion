# 성능(Performance) 리뷰 — execution §1.3 single-node execution

## 발견사항

### **[WARNING]** `getLatestPredecessorOutputs`: 전체 predecessor 행을 메모리에 적재 후 중복 제거
- 위치: `execution-engine.service.ts` — `getLatestPredecessorOutputs` (라인 7786~7844 블록, `find` 호출)
- 상세: `nodeExecutionRepository.find` 는 `executionId` + `nodeId IN (predecessorIds)` + `status=COMPLETED` 조건으로 결과를 가져오되 `ORDER BY finishedAt DESC` 만 지정하고 LIMIT 을 걸지 않는다. 한 노드가 루프·컨테이너 반복으로 수백~수천 회 완료 NodeExecution 행을 가질 경우 전체를 메모리로 올린 뒤 노드별 첫 행만 취하는 중복 제거 루프가 동작한다. predecessorIds 가 N개라면 최악 O(M) 행(M = 대상 predecessor들의 총 완료 NodeExecution 수)을 적재한다. 단일 노드 실행이 디버그 도구 특성상 대화형으로 자주 호출될 수 있으므로 적재량이 예상 외로 커질 수 있다.
- 제안: TypeORM 에서 서브쿼리 또는 `DISTINCT ON (node_id)` (PostgreSQL) 로 노드별 최신 1행만 DB에서 가져오도록 변경하거나, predecessorIds 배열 순으로 `findOne` 를 N 번 호출하는 대신 원시 쿼리(`DISTINCT ON node_id ORDER BY node_id, finished_at DESC`)를 사용한다. 현재 디버그 전용 도구로 predecessor 수가 일반적으로 소수(1~3)이므로 즉각적인 위험은 낮지만, 루프 노드의 반복 횟수가 크면 단일 호출에서도 영향이 나타날 수 있다.

---

### **[WARNING]** Controller에서 두 번의 직렬 DB 검증 쿼리 (sequential I/O)
- 위치: `workflows.controller.ts` — `executeNode` 메서드 (라인 956~981)
- 상세: `executeNode` 핸들러는 다음 순서로 DB를 직렬 호출한다. (1) `workflowsService.findById` — Workflow 소속 검증, (2) `nodeRepository.findOneBy({ id: nodeId, workflowId: id })` — Node 소속 검증, (3) `executionRepository.findOneBy({ id: previousExecutionId, workflowId: id })` — 선택적 Execution 검증. (1)과 (2)는 논리적으로 순서 의존성이 없으며 병렬 실행이 가능하다. 대부분의 요청에서 쿼리 1+2가 직렬로 수행되어 두 개의 round-trip 지연이 누적된다. (3)은 `previousExecutionId`가 있는 경우에만 실행되므로 조건부 병렬화 대상이다.
- 제안: `findById`와 `nodeRepository.findOneBy`를 `Promise.all`로 병렬 실행한다. 단 `findById`가 404를 던지면 이후 처리가 불필요하므로 오류 처리 순서를 주의해야 한다. 이 최적화는 DB 연결이 충분할 때 전체 응답 시간을 단일 round-trip 만큼 줄인다.

---

### **[INFO]** `handleRunThisNode`: `useExecutionStore.getState()` 를 `useCallback` 클로저 외부에서 직접 호출
- 위치: `workflow-canvas.tsx` — `handleRunThisNode` 콜백 (라인 1199)
- 상세: 콜백 내에서 `useExecutionStore.getState()`를 호출하는 방식은 렌더링 시점 스냅샷이 아닌 최신 store 상태를 읽으므로 의도 자체는 올바르다. 다만 `isDirty`와 `saveWorkflow`는 `useEditorStore`에서 구독 방식으로 주입(`useEditorStore(s => s.isDirty)`)되어 렌더링을 유발하는 반면, execution 상태만 `getState()`로 읽는 비일관적인 패턴이다. 이 자체가 즉각적인 성능 문제는 아니나, 향후 `execState.executionId`를 구독 방식으로 교체 시 불필요한 리렌더가 추가될 수 있다.
- 제안: 현재 패턴은 성능 관점에서 문제없다. 다만 `execState.executionId`를 `useExecutionStore` 구독으로 바꿀 경우 `handleRunThisNode`의 deps가 늘어나 콜백 재생성 빈도가 증가하므로 `getState()` 방식을 유지하는 것이 더 낫다. 주석 또는 lint 규칙으로 의도를 문서화할 것을 권고한다.

---

### **[INFO]** `InfoTab.latestResult`: 선형 역방향 스캔 — nodeResults 배열이 클 경우 렌더링 비용
- 위치: `node-settings-panel.tsx` — `InfoTab` 내 `useMemo` (라인 1306~1311)
- 상세: `nodeResults` 배열 전체를 역방향으로 선형 탐색(`O(n)`)하여 `nodeId` 일치 항목을 찾는다. `nodeResults`는 실행 이벤트 도착 순서 배열이므로, 복잡한 워크플로우의 긴 실행에서는 수백 개 항목이 쌓일 수 있다. `useMemo`의 deps에 `[nodeResults, nodeId]`가 있어 `nodeResults`가 참조 변경될 때마다 전체 배열을 재스캔한다.
- 제안: 현재 실용적 규모(일반 워크플로우 실행)에서는 영향이 미미하다. 만약 `nodeResults`가 대형 실행에서 수백 개 이상으로 커질 가능성이 있다면, execution store 레벨에서 `Map<nodeId, latestResult>` 형태의 인덱스를 유지하는 것이 근본적인 해결책이다.

---

### **[INFO]** `seedSingleNodePredecessorOutputs`: `adaptHandlerReturn` 및 `toEngineFlatShape` 호출 — 객체 복제 비용
- 위치: `execution-engine.service.ts` — `seedSingleNodePredecessorOutputs` (라인 7786 블록)
- 상세: 각 predecessor 출력에 대해 `adaptHandlerReturn → setStructuredOutput → toEngineFlatShape → applyPortSelection → setNodeOutput` 파이프라인이 실행된다. 이는 정상 실행 경로와 동일한 변환이나, 객체 복제·직렬화 비용이 predecessor 수 × 객체 크기에 비례한다. 단일 노드 실행의 디버그 특성상 predecessor가 보통 1~3개이므로 실제 영향은 미미하다.
- 제안: 현재 규모에서 최적화 필요 없음. 추후 bulk seed 시나리오(다수 predecessor)가 생기면 재검토한다.

---

### **[INFO]** `executeNode` API 클라이언트: 옵션 미지정 시에도 `previousExecutionId: undefined`, `input: undefined`를 body에 포함
- 위치: `workflows.ts` — `executeNode` (라인 1404~1407)
- 상세: `apiClient.post`에 `{ previousExecutionId: undefined, input: undefined }`를 전달한다. JSON 직렬화 시 `undefined` 값은 제거되므로 실제 전송 payload에는 포함되지 않아 기능 오류는 없다. 다만 의도 전달이 불명확하다.
- 제안: 기능 이슈 없음. 스타일상 `Object.fromEntries(Object.entries(...).filter(([,v]) => v !== undefined))`로 정리하거나 현행 유지 둘 다 무방하다.

---

## 요약

이번 변경은 단일 노드 실행이라는 디버그 도구 특성에 맞게 대체로 경량하게 설계되어 있으며 주요 성능 위험은 없다. 주목할 부분은 `getLatestPredecessorOutputs`에서 LIMIT 없이 전체 NodeExecution 행을 적재한 뒤 애플리케이션 레벨에서 노드별 최신 1행을 선택하는 방식으로, 루프·반복 실행 이력이 많은 predecessor에서 불필요한 메모리 적재가 발생할 수 있다. Controller의 직렬 검증 쿼리도 `Promise.all`로 개선 여지가 있다. 나머지 발견사항은 현재 규모에서 실질적 영향이 없는 INFO 수준이다.

## 위험도

LOW
