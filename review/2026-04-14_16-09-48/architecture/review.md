### 발견사항

---

**[WARNING]** `ExecutionContext` 가변 공유 상태를 통한 부모 ID 전파

- **위치**: `node-handler.interface.ts`, `execution-engine.service.ts:363-370`, `execution-engine.service.ts:579`
- **상세**: `parentNodeExecutionId`를 `ExecutionContext`에 직접 쓰고 `finally` 블록에서 복원하는 save/restore 패턴은 이미 `recursionDepth`에서 사용 중인 방식과 동일합니다. 그러나 이 접근은 호출 스택 전반에 걸쳐 공유 참조를 통해 암묵적으로 상태를 전달하므로, `parentNodeExecutionId`를 설정하는 코드와 그것을 소비하는 코드 사이의 결합도가 높아집니다. 현재는 인라인 실행이 단일 비동기 체인으로 순차 실행되므로 안전하지만, 향후 병렬 브랜치 실행(예: Parallel 노드 내 Sub-Workflow)이 추가될 경우 동일한 context 객체를 공유하는 병렬 경로 간 상태 오염이 발생할 수 있습니다.
- **제안**: `parentNodeExecutionId`를 context 변이가 아닌 `InlineExecutionOptions`를 통해서만 전달하는 현재 방식(`executeInline` 호출부에서 이미 옵션으로 전달됨)을 일관되게 유지하고, `context.parentNodeExecutionId`를 읽는 대신 `options`에서 직접 읽도록 엔진 내부를 리팩터링하는 것이 더 명확한 의존성 방향을 만듭니다. 또는 context 변이 자체를 제거하고 `createNodeExecution` 호출 시 `parentNodeExecutionId`를 명시적 매개변수로 전달하는 것을 고려하세요.

---

**[WARNING]** 반복 인덱스 카운팅이 트리 범위를 무시함

- **위치**: `timeline-tree.ts:buildTimelineTree`
- **상세**: `iterTotal` 및 `iterSeen`은 전체 `results` 배열(트리 전체)을 기준으로 계산됩니다. 같은 `nodeId`를 가진 노드가 메인 워크플로우와 Sub-Workflow 내부에 동시에 존재하는 경우(예: 두 워크플로우가 모두 `http_request` 노드를 포함), 서로 다른 계층 레벨의 노드들이 동일한 `iterTotal`을 공유하여 "iter 1/4" 같은 잘못된 반복 표시가 렌더링됩니다. 반복 카운팅은 같은 부모 컨텍스트 내의 형제 노드들 사이에서만 유효합니다.
- **제안**: `buildTimelineTree` 내에서 반복 카운팅을 트리 레벨별로 범위 지정하여 각 부모 노드의 자식들에 대해 독립적으로 `iterSeen`/`iterTotal`을 계산하세요.

---

**[INFO]** `ExecutionContext`의 God Object 경향

- **위치**: `node-handler.interface.ts:ExecutionContext`
- **상세**: `ExecutionContext`는 `nodeExecutionId`, `parentNodeExecutionId`, `_executedNodes`, `recursionDepth`, `loopContext`, `itemContext`, `expressionContext`, `structuredOutputCache`, `nodeOutputCache` 등 9개 이상의 이질적 필드를 담고 있습니다. 이번 변경으로 `parentNodeExecutionId`가 추가되면서 인터페이스의 응집도가 더 낮아졌습니다. 일부 필드는 순수한 실행 데이터(variables, nodeOutputCache)이고, 일부는 실행 엔진의 런타임 상태(_executedNodes, recursionDepth)이며, 일부는 현재 노드의 메타데이터(nodeExecutionId, parentNodeExecutionId)입니다.
- **제안**: 즉각적 리팩터링보다는 필드를 논리 그룹으로 주석 분류하거나, 장기적으로 `ExecutionRuntimeState`(엔진 제어 필드)와 `ExecutionDataContext`(노드가 참조하는 데이터 필드)로 분리하는 방향을 고려하세요.

---

**[INFO]** 프론트엔드 `RowCtx` 수동 prop drilling vs React Context

- **위치**: `result-timeline.tsx:RowCtx`, `SubWorkflowCard`, `TimelineRow`
- **상세**: `RowCtx` 인터페이스를 통해 7개의 상태/핸들러를 컴포넌트 계층 아래로 수동 전달하고 있습니다. 현재는 2단계 깊이(ResultTimeline → SubWorkflowCard → renderChild → TimelineRow)라 관리 가능하지만, Sub-Workflow의 재귀적 중첩이 깊어지면 `renderChild`를 통해 동일한 `ctx`가 계속 전달됩니다. 또한 `SubWorkflowCard`에서 `ctx={{ ...ctx, toggleExpand: toggleCardExpand }}`로 스프레드하면서 ctx 객체를 매 렌더마다 새로 생성하고 있어 불필요한 리렌더링을 유발할 수 있습니다.
- **제안**: `React.createContext`로 `RowCtx`를 컨텍스트로 제공하면 prop drilling을 제거할 수 있습니다. 혹은 최소한 `SubWorkflowCard` 내에서 ctx 스프레드를 `useMemo`로 감싸세요.

---

**[INFO]** `toggleExpand` / `toggleCardExpand` 이중 토글 함수 설계

- **위치**: `result-timeline.tsx:toggleCardExpand`
- **상세**: Sub-Workflow 카드의 기본 상태가 `expanded(true)`이기 때문에 토글 로직이 `prev[id] ?? true`와 `prev[id] ?? false`로 분기됩니다. 이는 "기본값이 다른 두 종류의 상태"를 단일 `expanded` Record로 관리하기 때문에 발생하는 복잡성입니다.
- **제안**: 상태 저장 시 카드인 경우와 일반 행인 경우를 명시적으로 구분하거나(`expandedCards`, `expandedRows` 별도 관리), 아니면 최초 렌더 시 카드의 expanded 상태를 `true`로 초기화하는 방식으로 통일된 `prev[id] ?? false` 로직을 사용하세요.

---

**[INFO]** `renderTreeNode` 클로저의 미메모이제이션

- **위치**: `result-timeline.tsx:renderTreeNode`
- **상세**: `renderTreeNode`는 컴포넌트 함수 본문 안에서 일반 함수로 선언되어 매 렌더마다 새로 생성됩니다. 이 함수는 `ctx`, `toggleCardExpand` 등 여러 클로저 변수를 캡처하며, `SubWorkflowCard`의 `renderChild` prop으로 전달됩니다. Sub-Workflow가 중첩될 경우 재귀적으로 호출되는 구조상 불필요한 리렌더가 발생할 수 있습니다.
- **제안**: `renderTreeNode`를 `useCallback`으로 메모이제이션하거나, 트리 렌더링을 독립 컴포넌트(예: `TimelineTree`)로 추출하여 React의 일반적인 렌더링 최적화 경로를 활용하세요.

---

### 요약

이번 변경은 Sub-Workflow 실행 계층 구조를 DB → WebSocket → Store → UI까지 일관된 단방향 데이터 흐름으로 전파하는 설계를 구현했으며, `timeline-tree.ts`의 독립 추출과 `SubWorkflowCard` 컴포넌트 분리는 아키텍처적으로 바람직합니다. 핵심 우려사항은 `ExecutionContext`를 통한 가변 공유 상태 전파 패턴으로, 현재는 단일 비동기 체인 내에서만 동작하므로 안전하지만 병렬 실행 시나리오로 확장될 경우 취약점이 됩니다. 또한 반복 인덱스 카운팅이 트리 범위를 무시하는 문제는 중첩된 Sub-Workflow 환경에서 UI 레이블 오류를 일으킬 수 있는 실질적 버그입니다. `ExecutionContext`의 지속적인 필드 확장은 장기 유지보수성 관점에서 관찰이 필요합니다.

### 위험도

**MEDIUM** — 반복 인덱스 카운팅 버그(트리 범위 미적용)와 가변 컨텍스트 상태 확장성 우려가 주요 리스크이며, 나머지는 개선 권고 수준입니다.