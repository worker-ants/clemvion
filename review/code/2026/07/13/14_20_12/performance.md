# 성능(Performance) Review

## 발견사항

- **[WARNING]** 실행 중 노드 상태 tick 마다 캔버스 전체 엣지가 새 객체로 재생성돼 memo 이점이 무효화된다
  - 위치: `codebase/frontend/src/components/editor/canvas/use-edge-execution-state.ts:41-69` (특히 51-68 의 `edges.map`), 원인이 되는 상위 상태 갱신은 `codebase/frontend/src/lib/stores/execution-store.ts:554-559` (`updateNodeStatus` — 노드 상태 변경 1건마다 `new Map(state.nodeStatuses)` 로 새 참조 생성)
  - 상세: `useEdgeExecutionState` 는 "실행 컨텍스트가 전혀 없을 때"만 원본 `edges` 참조를 그대로 반환하고(주석에도 명시), 실행이 시작된 **이후**(즉 이 기능이 실제로 동작해야 하는 바로 그 구간)에는 `nodeStatusById.size > 0` 이 되는 순간부터 매 tick마다 `edges.map()` 으로 **캔버스의 모든 엣지**에 대해 새 객체(`{...edge, className, data: {...edge.data, edgeInactive}}`)를 생성한다. 이는 상태가 실제로 바뀐 엣지뿐 아니라 이번 tick과 무관한 엣지까지 포함한다. `nodeStatuses` 는 노드 상태가 바뀔 때마다(`updateNodeStatus`) 새 `Map` 으로 교체되므로, `nodeStatusById` useMemo(37-39행)와 최종 useMemo(41-69행)가 매번 재실행되고, 결과적으로 **노드 1개의 상태 전이 1건마다 전체 엣지 배열이 통째로 재구성**된다.
    같은 파일의 자매 훅인 `use-edge-highlighting.ts` 는 정확히 이 문제를 피하려고 "이미 같은 상태면 원본 엣지 참조를 그대로 반환"하는 per-edge bail-out 을 명시적으로 구현해 두었다(주석: "Performance: only highlighted edges get new objects"). `useEdgeExecutionState` 는 이 확립된 패턴을 따르지 않고 전체 배열을 무조건 재생성한다.
    파급 효과: (1) `custom-edge.tsx` 의 `CustomEdge` 는 `memo()` 로 감싸여 있지만 매 tick마다 `data`/`className` prop 이 새 객체·값으로 내려오므로(실제로 안 바뀐 엣지도 `data` 객체 참조 자체는 새로 생성됨) memo 의 얕은 비교가 실패해 **모든 엣지 컴포넌트가 리렌더**된다. (2) `workflow-canvas.tsx:831-833` 에서 `useEdgeHighlighting(executionEdges)` 로 이어지는데, `useEdgeHighlighting` 내부의 `edgeIndex` useMemo 는 `[edges]` 에만 의존해 `isFocusActive` 여부와 무관하게 매 tick마다 O(E) 로 재구성된다(하이라이팅이 전혀 활성화되지 않은 상태에서도).
    Loop/ForEach/Map 컨테이너처럼 본문이 다회 반복 실행되는 워크플로우에서는 동일한 소수의 바디 노드에 대해 `running`→`completed` 전이가 반복 발생하므로(예: 1,000회 반복 × 바디 노드당 2전이 = 최대 수천 tick), 매 tick마다 캔버스 전체 엣지(수십~수백 개)에 대해 O(E) 객체 재생성 + 전체 리렌더가 누적되어 실행 중 UI 가 버벅이거나(jank) 프레임 드롭이 발생할 수 있다. 데이터 손상·크래시는 아니지만 실사용 중 체감 성능 저하 가능성이 있다.
  - 제안: `useEdgeHighlighting` 과 동일한 per-edge bail-out 패턴 적용 — 각 엣지에 대해 `resolveEdgeExecutionState` 결과가 이전과 동일하면(className 이 이미 같고 `data.edgeInactive` 도 동일하면) 새 객체를 만들지 않고 기존 `edge` 참조를 그대로 반환. 이렇게 하면 실제로 상태가 바뀐 엣지만 새 객체가 생성되어 `memo(CustomEdge)` 가 의도대로 작동하고, 무관한 엣지의 리렌더·SVG 재계산을 피할 수 있다. 필요하면 이전 결과를 캐시하는 `WeakMap<Edge, EdgeExecutionState>` 또는 이전 `executionEdges` 배열을 클로저에 유지해 비교하는 방식도 고려할 수 있다.

- **[INFO]** `nodeStatusById` Map 재구성이 매 tick마다 O(V) — 규모상 문제는 아니나 위 WARNING 과 함께 누적됨
  - 위치: `use-edge-execution-state.ts:35-39`
  - 상세: `nodeStatuses`(zustand Map) 참조가 바뀔 때마다 `Map<string,string>` 을 처음부터 다시 순회 생성한다. 노드 수(V)는 워크플로 그래프 크기로 제한돼 있어 그 자체로는 위험하지 않지만, 위 WARNING 의 "매 tick 전체 재계산" 사슬의 일부이며 함께 개선하면 좋다(예: `updateNodeStatus` 가 변경된 nodeId 만 알려주면 `nodeStatusById` 도 diff 갱신 가능 — 다만 이는 store API 변경이 필요해 스코프가 크다).

- **[INFO]** `.wc-edge-flowing` / `.wc-edge-complete-flash` CSS 애니메이션 자체는 적절 — 순수 CSS(stroke-dasharray/stroke) 기반이라 JS 틱당 리렌더와는 별개로 GPU 친화적이다. 다만 위 WARNING 으로 인해 동일 className 문자열이 매 tick 새 엣지 객체로 재부여되는 경우, React Flow 가 해당 SVG 노드를 재마운트하면 `wc-edge-complete-flash` 1회성 keyframe 이 의도치 않게 재시작될 가능성이 있다(현재 진단 범위에선 React 재조정이 key 기반으로 동일 DOM 노드를 유지할 가능성이 높아 실제 재시작 여부는 브라우저 동작에 달려 있음 — 수동/e2e 확인 권장).

- **[INFO]** 알고리즘 복잡도 자체는 선형(O(V+E) per tick) — N+1 쿼리·블로킹 I/O·서버 캐싱 이슈 없음
  - 상세: 이번 변경은 순수 프런트엔드 편집기 상태 파생 로직으로, DB·API 호출이 개입하지 않는다(N+1/블로킹 I/O 관점 해당 없음). `resolveEdgeExecutionState` 자체는 O(1) 순수 함수이고 `disabledNodeIds`/`nodeStatusById` 도 각각 O(N)/O(V) 로 알고리즘적으로는 문제가 없다. 위 WARNING 은 "얼마나 자주, 얼마나 넓게 재계산되는가"의 리렌더 빈도 문제이지 빅오 자체의 문제는 아니다.

## 요약

이번 변경은 순수 프런트엔드 파생 상태 로직으로 DB/API 호출이 없어 N+1·블로킹 I/O 관점의 위험은 없다. 다만 실행 상태 스타일을 계산하는 `useEdgeExecutionState` 훅이, 정작 기능이 활성화되는 실행 중 구간에서는 자매 훅 `useEdgeHighlighting` 이 채택한 per-edge 참조 재사용(bail-out) 패턴을 따르지 않고 노드 상태가 1건 바뀔 때마다(zustand `nodeStatuses` 가 매번 새 `Map` 으로 교체됨) 캔버스의 **모든** 엣지 객체를 새로 생성한다. 이 때문에 `memo(CustomEdge)` 가 사실상 무력화돼 무관한 엣지까지 매 tick 리렌더되며, Loop/ForEach/Map 처럼 반복이 많은 워크플로 실행 시 tick 수 × 엣지 수만큼 누적돼 대형 캔버스에서 체감 가능한 UI 지연을 유발할 수 있다. 데이터 손상이나 기능 오류는 아니지만, 같은 파일에 이미 존재하는 최적화 패턴을 재사용하면 쉽게 고칠 수 있는 문제이므로 반영을 권장한다.

## 위험도
MEDIUM
