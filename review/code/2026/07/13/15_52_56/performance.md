# 성능(Performance) 리뷰 — 엣지 데이터 미리보기 툴팁 + 전체 데이터 모달

대상: `codebase/frontend/src/components/editor/canvas/edge-data-preview.tsx`,
`use-edge-hover-preview.ts`, `workflow-canvas.tsx`(diff 부분),
`codebase/frontend/src/lib/utils/edge-data-preview.ts` 신규 코드.

### 발견사항

- **[WARNING]** 최근 결과 조회가 스토어에 이미 있는 O(1) 인덱스를 쓰지 않고 O(n) 역방향 스캔을 재도입
  - 위치: `codebase/frontend/src/components/editor/canvas/edge-data-preview.tsx` `useEdgeFlowData` (for 루프, `nodeResults.length - 1` 부터 역순 탐색)
  - 상세: `execution-store.ts` 는 정확히 이 용도("nodeId → 가장 최근 추가된 row 의 index")로 `lastIndexByNodeId: Map<string, number>` 를 이미 유지하고 있고, 그 도입 커밋 코멘트 자체가 "addNodeResult 의 reverse '가장 최근 row' 스캔을 대체"한다고 명시한다(execution-store.ts:233-235, 289 부근 `findNodeResult` 설명 참고). 그런데 신규 `useEdgeFlowData` 는 이 인덱스를 참조하지 않고 동일한 반패턴(전체 `nodeResults` 역방향 선형 탐색)을 다시 구현했다. 이 `useMemo` 는 `[edges, edgeId, nodeResults]` 에 의존하므로, 툴팁/모달이 열려 있는 동안 **이 엣지와 무관한 다른 노드의 결과가 도착할 때마다**(`nodeResults` 배열 참조 갱신 시마다) 전체 스캔이 재실행된다. Loop/ForEach 로 수천 회 반복되는 워크플로에서는 `nodeResults` 가 크게 자라므로(주석에도 이 케이스를 인지하고 있음), 실행 중 hover 상태에서 매 WS 이벤트마다 불필요한 O(n) 재스캔이 발생한다.
  - 제안: `lastIndexByNodeId`(또는 이를 감싼 신규 액션, 예: `findLatestResultForNode(nodeId)`)를 재사용해 O(1) 조회로 대체한다. 기존 `findNodeResult` 는 `nodeExecutionId` 우선 매칭 시맨틱이라 "최신 iteration" 요구사항과는 다르므로, 별도의 얇은 O(1) 헬퍼를 스토어에 추가하는 편이 적절하다.

- **[WARNING]** 크기 제한 없는 전체 `JSON.stringify` + 바이트 인코딩이 hover/모달 렌더 경로에서 무가드로 실행됨
  - 위치: `codebase/frontend/src/lib/utils/edge-data-preview.ts` `summarizeDataForPreview`(`JSON.stringify(value)` 전체 + `new TextEncoder().encode(full)`), 그리고 `edge-data-preview.tsx` `EdgeDataModal` 의 `JSON.stringify(data, null, 2)`(useMemo 미적용, 렌더 본문에 인라인)
  - 상세: `abbreviate()` 는 미리보기 문자열 자체는 depth/개수로 잘 제한하지만, 바이트 크기 계산용 `JSON.stringify(value)` 는 **원본 전체**를 대상으로 하고 상한이 없다. 이 리포에서 render_table 계열에 1MB cap 이 언급될 정도로 노드 출력이 커질 수 있는데, hover 이벤트(디바운스 없음 — `show()` 는 `scheduleHide()` 와 달리 즉시 실행)마다 메인 스레드에서 동기적으로 전체 직렬화 + `TextEncoder` 를 통한 바이트 배열 materialize(단순히 `.length` 를 얻기 위함)가 일어나 캔버스에서 마우스를 여러 엣지 위로 빠르게 지나갈 때 프레임 드랍/버벅임을 유발할 수 있다. `EdgeDataModal` 쪽은 한 술 더 떠 `JSON.stringify(data, null, 2)` 를 `useMemo` 로 감싸지 않고 JSX 에 인라인해서, 모달이 열려 있는 동안 `WorkflowCanvas` 가 (실행 중 WS 이벤트 등으로) 무관한 이유로 리렌더될 때마다 동일한 대용량 데이터를 매번 재직렬화한다.
  - 제안: (1) 바이트 크기는 `new Blob([full]).size` 등으로 전체 배열 materialize 없이 구하거나, 상한을 넘는 경우 정확한 바이트 수 대신 근사치로 대체. (2) `show()` 에도 `scheduleHide()` 처럼 짧은 디바운스를 둬 스쳐 지나가는 hover 에서 계산이 매번 트리거되지 않게 한다. (3) `EdgeDataModal` 의 `JSON.stringify` 호출을 `data` 키의 `useMemo` 로 감싼다.

- **[INFO]** `useEdgeHoverPreview()` 가 매 호출마다 새 객체 리터럴을 반환해 하위 `useCallback` 메모이제이션을 무력화
  - 위치: `use-edge-hover-preview.ts` 반환문 `return { preview, show, scheduleHide, keepAlive, dismiss };` / 소비처 `workflow-canvas.tsx` `onEdgeMouseEnter`/`onEdgeMouseLeave` (`useCallback` deps 에 `edgeHoverPreview` 객체 전체 포함)
  - 상세: `show`/`scheduleHide`/`keepAlive`/`dismiss` 각각은 `useCallback` 으로 안정적이지만, 이를 감싸는 반환 객체 자체는 `useMemo` 없이 매 렌더 새로 생성된다. 그 결과 `WorkflowCanvas` 가 (hover 와 무관한 이유로) 리렌더될 때마다 `edgeHoverPreview` 참조가 바뀌고, 이를 deps 로 잡은 `onEdgeMouseEnter`/`onEdgeMouseLeave` 도 매번 새 함수 참조를 갖게 되어 `useCallback` 이 사실상 무의미해진다. `WorkflowCanvas` 는 노드/엣지가 많은 캔버스에서 실행 tick 마다 리렌더되는 핫 컴포넌트라 이런 참조 불안정성이 하위 ReactFlow prop 비교/리렌더 비용에 누적될 수 있다.
  - 제안: 훅 내부에서 반환 객체를 `useMemo(() => ({ preview, show, scheduleHide, keepAlive, dismiss }), [preview, show, scheduleHide, keepAlive, dismiss])` 로 감싸거나, 소비처에서 객체 전체가 아니라 필요한 개별 함수만 구조분해해 deps 에 넣는다.

- **[INFO]** `EdgeDataModal` 이 닫혀 있어도 매 렌더마다 `useEdgeFlowData(edgeId ?? "", edges)` 를 실행해 불필요한 `edges.find` 스캔 수행
  - 위치: `edge-data-preview.tsx` `EdgeDataModal` 본문
  - 상세: `dataModalEdgeId === null` 인 평상시에도 훅이 매번 호출되어 빈 문자열로 `edges.find` 를 수행한다(결과는 항상 undefined 로 버려짐). 엣지 개수가 매우 많은 워크플로에서는 무의미한 O(E) 스캔이 반복된다.
  - 제안: 큰 영향은 아니나, 훅 내부에서 `edgeId` 가 빈 문자열/미존재일 때 `edges.find` 자체를 건너뛰는 얕은 가드를 추가하면 사소한 낭비를 없앨 수 있다.

### 요약

이번 변경은 순수 프런트엔드 hover 미리보기 기능으로 백엔드·wire 영향은 없고, `abbreviate()` 의 깊이/개수 제한 설계 자체는 견고하다. 다만 (1) 스토어가 이미 제공하는 O(1) "노드별 최신 결과" 인덱스(`lastIndexByNodeId`)를 재사용하지 않고 `useEdgeFlowData` 가 동일 반패턴(O(n) 역방향 스캔)을 재도입했고, 이는 실행 중 무관한 노드 결과 도착마다 재계산되는 점이 아쉬우며, (2) 바이트 크기 계산·모달의 전체 `JSON.stringify` 가 크기 상한/메모이제이션 없이 hover·리렌더 경로에서 동기 실행돼 대용량 노드 출력에서 체감 버벅임을 유발할 수 있다. 두 사안 모두 즉각적인 장애는 아니지만("워크플로 실행 중 hover" + "대용량 출력"이 겹치는 시나리오에서만 드러남), 코드가 이미 정립된 O(1) 패턴을 우회한 형태라 반드시 재작업 없이 넘기면 향후 유사 코드가 같은 실수를 반복할 위험이 있다. 나머지 메모이제이션 관련 항목은 경미한 개선 여지다.

### 위험도

MEDIUM
