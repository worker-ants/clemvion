### 발견사항

- **[WARNING]** `buildTimelineTree`의 `iterTotal` 카운팅이 전체 결과를 평탄하게(flat) 집계
  - 위치: `timeline-tree.ts:27-29`
  - 상세: `iterTotal`은 부모-자식 관계를 무시하고 전체 `results` 배열에서 `nodeId` 기준으로 집계합니다. 루트 워크플로우와 서브-워크플로우 양쪽에서 동일한 `nodeId`를 가진 노드가 실행되면(예: 공통 HTTP 노드), 두 인스턴스 모두 `totalIterations = 2`로 표시되어 전혀 다른 컨텍스트인데 "(iter 1)", "(iter 2)" 레이블이 붙는 오인 가능한 표현이 생깁니다. 루프 내 반복과 서브-워크플로우 내 실행이 구분되지 않습니다.
  - 제안: 동일 레벨(같은 부모)에 속한 노드들만 iteration 카운팅 대상으로 제한하거나, 루트 레벨과 각 서브-워크플로우 그룹별로 카운터를 분리해야 합니다.

- **[WARNING]** `executeInline` 내 SKIPPED 노드 이벤트에서 `parentNodeExecutionId` 누락 경로 존재
  - 위치: `execution-engine.service.ts` diff +427, +857, +2468 (세 개의 SKIPPED 처리 블록)
  - 상세: 세 곳의 `createNodeExecution(executionId, nodeId, NodeExecutionStatus.SKIPPED, context.parentNodeExecutionId)` 호출은 DB 엔티티에 올바르게 저장하지만, 해당 노드에 대해 WebSocket `NODE_SKIPPED` 이벤트를 발행하는 코드가 없습니다. 건너뛴 노드는 이벤트 없이 DB에만 기록되므로, 라이브 실행 중 클라이언트의 `addNodeResult`가 호출되지 않아 서브-워크플로우 카드 안에 SKIPPED 노드가 실시간으로 나타나지 않을 수 있습니다.
  - 제안: SKIPPED 노드도 `websocketService.emitNodeEvent`로 `NODE_SKIPPED` 이벤트를 발행해야 일관성이 확보됩니다.

- **[WARNING]** async 모드 서브-워크플로우의 타임라인 계층 표현 불완전
  - 위치: `workflow.handler.ts:99-113` (async 분기)
  - 상세: async 모드는 별도 executionId로 실행되므로 `parentNodeExecutionId`를 전달하지 않습니다. 그런데 `SubWorkflowCard`는 `tnode.children.length > 0`인 경우에만 카드로 렌더링하고, 자식이 없으면 일반 행으로 표시됩니다. async 워크플로우 노드는 항상 자식 없이 렌더링되는데, 이것이 설계 의도임을 UI나 주석에서 명시적으로 알 수 없습니다. 사용자 입장에서 sync와 async 워크플로우 노드가 동일하게 보이는 점에서 혼란이 발생할 수 있습니다.
  - 제안: async 노드의 경우 "(async - 별도 실행)" 같은 배지나 링크를 표시하는 별도 처리를 고려하거나, 적어도 `WorkflowHandler`에 의도를 명시하는 주석이 필요합니다.

- **[INFO]** `context.parentNodeExecutionId` 스탬프 조건이 falsy 체크
  - 위치: `execution-engine.service.ts` diff +370-373
  - 상세: `if (parentNodeExecutionId)` 조건은 빈 문자열(`""`)을 무시합니다. UUID 형태로만 전달되므로 실제 문제는 없지만, 타입이 `string | undefined`인 상황에서 명시적으로 `!= null`로 체크하는 것이 의도를 더 명확히 표현합니다.
  - 제안: `if (parentNodeExecutionId != null)`로 변경하거나 현상 유지

- **[INFO]** `SubWorkflowCard`에서 카드 헤더 클릭 시 `handleNodeClick`도 함께 호출
  - 위치: `result-timeline.tsx` `TimelineRow` 컴포넌트 버튼 `onClick` 핸들러
  - 상세: 카드 헤더를 클릭하면 `toggleExpand`(또는 `toggleCardExpand`)와 `handleNodeClick`이 모두 실행됩니다. 결과적으로 카드를 접고 펼칠 때마다 상세 패널에 해당 서브-워크플로우 노드의 결과가 표시됩니다. 사용자가 단순히 카드를 접으려 했는데 선택 상태가 바뀌는 부수효과가 있습니다.
  - 제안: 카드 헤더는 접기/펼치기만 담당하고 `handleNodeClick`은 별도 클릭(예: 노드 아이콘/레이블)으로 분리하는 UX 개선을 검토하세요.

- **[INFO]** `buildTimelineTree`에서 고아(orphan) 노드를 루트로 처리하는 방식
  - 위치: `timeline-tree.ts:50-56`
  - 상세: 부모 ID는 있지만 해당 부모가 `results`에 없는 경우 루트로 처리합니다. 테스트도 작성되어 있습니다. 그러나 이 경우 해당 노드는 서브-워크플로우 카드 밖에서 독립된 행으로 표시되어 계층 관계가 깨집니다. 이것이 "데이터 손실 없음"을 위한 폴백인지, 아니면 실제로 발생하면 안 되는 상황인지 요구사항이 명확하지 않습니다.
  - 제안: 고아 노드 발생 시 개발 환경에서 `console.warn`으로 경고를 출력하여 버그 추적에 도움을 주는 것이 좋습니다.

- **[INFO]** `NodeResult.nodeCategory` 필드가 `makeResult` 테스트 헬퍼에서 임의로 고정
  - 위치: `timeline-tree.test.ts:13`
  - 상세: `nodeCategory: "logic"`으로 고정되어 있어 `CATEGORY_COLORS` 관련 렌더링 경로가 테스트되지 않습니다. 기능 테스트 범위와는 무관하나, 타입 호환성 측면에서 확인이 필요합니다.

---

### 요약

이번 변경은 Sub-Workflow 인라인 실행의 계층적 타임라인 표현이라는 핵심 요구사항을 전반적으로 충실히 구현하고 있습니다. DB 마이그레이션, 엔티티, 실행 엔진, WebSocket 이벤트, 프론트엔드 스토어, 트리 렌더링까지 레이어 간 연결이 일관되며, 고아 노드 처리·폴링 재조정·`parentNodeExecutionId` 보존 로직 등 엣지 케이스도 상당 부분 다루고 있습니다. 다만 `iterTotal`이 계층을 무시하고 전역 집계하는 구조로 인해 서브-워크플로우와 루트 워크플로우에 동일한 `nodeId`가 존재할 때 iteration 레이블이 오인될 수 있으며, SKIPPED 노드에 대한 WebSocket 이벤트 미발행으로 라이브 실행 중 서브-워크플로우 카드 내 SKIPPED 노드가 실시간 갱신되지 않을 수 있다는 점이 요구사항 관점의 주요 위험입니다.

### 위험도

**LOW**