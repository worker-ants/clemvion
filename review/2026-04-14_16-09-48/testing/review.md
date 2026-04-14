### 발견사항

- **[WARNING]** `execution-engine.service.ts` context 상태 저장/복원 로직 미테스트
  - 위치: `executeInline()` 내 `prevParentNodeExecutionId` 저장 및 `finally` 블록의 복원 코드
  - 상세: 인라인 Sub-Workflow 실행 후 `context.parentNodeExecutionId`가 이전 값으로 복원되지 않으면 형제 노드들이 잘못된 parentId를 상속받는 치명적인 버그가 발생할 수 있다. 이 save/restore 로직을 직접 검증하는 테스트가 없다.
  - 제안: `ExecutionEngineService`의 `executeInline` 유닛 테스트에서 인라인 실행 완료 후 `context.parentNodeExecutionId`가 원래 값(혹은 `undefined`)으로 복원되는지 검증하는 케이스 추가

- **[WARNING]** `use-execution-events.ts`의 `parentNodeExecutionId` 보존 로직 미테스트
  - 위치: `NODE_COMPLETED`, `NODE_FAILED` 핸들러의 `payload.parentNodeExecutionId ?? existing?.parentNodeExecutionId`
  - 상세: 중간 상태 이벤트(`waiting_for_input` 등)에서 `parentNodeExecutionId`가 누락될 때 기존 값을 유지하는 로직은 Sub-Workflow 카드가 실행 중 평탄화되는 것을 막는 핵심 로직이다. 이 fallback 병합 로직에 대한 테스트가 전혀 없다.
  - 제안: `parentNodeExecutionId`가 없는 `NODE_COMPLETED` 이벤트가 도착했을 때 기존 `parentNodeExecutionId`가 보존되는지 검증하는 훅 테스트 추가

- **[WARNING]** `execution-store.ts` 병합 로직 미테스트
  - 위치: `result.parentNodeExecutionId ?? r.parentNodeExecutionId`
  - 상세: `addNodeResult`에서 기존 노드 결과와 병합 시 `parentNodeExecutionId` 보존 로직이 있으나, 이를 검증하는 스토어 테스트가 없다.
  - 제안: 동일 노드에 대한 두 번째 `addNodeResult` 호출 시 `parentNodeExecutionId`가 유지되는 시나리오 테스트 추가

- **[INFO]** `workflow.handler.spec.ts` — `context.nodeExecutionId`가 `undefined`인 경우 미테스트
  - 위치: `workflow.handler.spec.ts`, `execute - sync mode` describe 블록
  - 상세: `context.nodeExecutionId`가 설정된 경우의 테스트는 추가되었으나, `nodeExecutionId`가 `undefined`일 때(워크플로우 노드가 아직 DB에 저장되지 않은 상태) `parentNodeExecutionId: undefined`가 올바르게 전달되는지 검증하는 케이스가 없다.
  - 제안: `context.nodeExecutionId = undefined` 상태에서 `executeInline` 호출 시 `parentNodeExecutionId`가 `undefined`로 전달됨을 검증하는 테스트 추가

- **[INFO]** `timeline-tree.test.ts` — `keyOf` 함수 직접 테스트 누락
  - 위치: `timeline-tree.test.ts`
  - 상세: `keyOf`는 `nodeExecutionId ?? nodeId` 폴백 로직을 갖고 있으나 직접 테스트되지 않는다. `nodeExecutionId`가 없는 노드에서 `nodeId`로 fallback되는 동작이 tree lookup에서 올바르게 동작하는지(부모-자식 연결) 암묵적으로만 검증된다.
  - 제안: `keyOf(result)` 직접 테스트 또는 `nodeExecutionId` 없는 노드가 부모 참조를 통해 올바르게 중첩되는 케이스 추가

- **[INFO]** `timeline-tree.test.ts` — 반복 카운터가 부모 스코프를 구분하지 않는 동작 미검증
  - 위치: `buildTimelineTree` 내 `iterSeen` Map
  - 상세: 반복 인덱스 카운터는 전체 results 배열 기준 전역으로 집계된다. 동일한 `nodeId`를 가진 노드가 서로 다른 Sub-Workflow 카드 하위에 분산될 경우 반복 인덱스가 예상과 다를 수 있다. 현재 테스트에서는 이 시나리오가 다뤄지지 않는다.
  - 제안: 서로 다른 Sub-Workflow 카드 각각에 동일 `nodeId`를 가진 자식이 있을 때 `iterIndex`와 `totalIterations`가 의도한 값인지 검증하는 케이스 추가

- **[INFO]** `result-timeline.tsx` 신규 컴포넌트 테스트 부재
  - 위치: `SubWorkflowCard`, `TimelineRow`, `toggleCardExpand`
  - 상세: Sub-Workflow 카드는 기본 확장 상태(`true`)이고, `toggleCardExpand`는 `!(prev[id] ?? true)` 로직을 사용한다. 이 동작(첫 클릭 시 collapsed, 재클릭 시 expanded)을 검증하는 컴포넌트 테스트가 없다. `statusAccentClass`, `isSubWorkflowNode` 유틸 함수도 미테스트.
  - 제안: 렌더 테스트에서 Sub-Workflow 카드 기본 확장 상태와 토글 동작 검증. 최소한 `statusAccentClass` 순수함수 유닛 테스트 추가

- **[INFO]** `run-results-drawer.tsx` 너비 리사이즈 로직 미테스트
  - 위치: `handleWidthMouseDown`, `getStoredTimelineWidth`
  - 상세: 너비 드래그 리사이즈 로직과 `localStorage` 저장/복원 로직에 대한 테스트가 없다. 높이 리사이즈 기존 로직과 동일한 패턴이지만 두 드래그 상태(`isDragging`, `isDraggingWidth`)가 동시에 실행되면 안 되는 동작이 검증되지 않는다.

---

### 요약

`timeline-tree.ts`에 대한 테스트(`timeline-tree.test.ts`)는 핵심 시나리오(중첩, 고아 노드, 반복 인덱스, 다중 호출)를 잘 커버하고 있으며, `workflow.handler.spec.ts`도 `parentNodeExecutionId` 전달 동작을 적절히 검증한다. 그러나 변경의 정합성을 보장하는 세 가지 핵심 경로 — `executeInline`의 context 상태 복원, WS 이벤트 수신 시 `parentNodeExecutionId` 보존, 스토어 병합 로직 — 에 대한 테스트가 누락되어 있다. 이 세 경로 중 하나라도 회귀가 발생하면 Sub-Workflow 타임라인 계층 구조가 실행 중 또는 폴링 시점에 조용히 무너질 수 있다.

### 위험도

**MEDIUM**