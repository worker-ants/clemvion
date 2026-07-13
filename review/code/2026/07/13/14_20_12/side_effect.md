# 부작용(Side Effect) Review

## 발견사항

- **[WARNING]** `useEdgeExecutionState` 가 노드 드래그마다 엣지 배열 전체를 재생성 — "zero React Flow diff" 불변식이 실행 이력 발생 후(또는 비활성 노드 존재 시) 영구히 깨짐
  - 위치: `codebase/frontend/src/components/editor/canvas/use-edge-execution-state.ts` L21-25 (`disabledNodeIds` useMemo), L36-45 (최종 useMemo 의존성 배열)
  - 상세: `disabledNodeIds` 는 `useMemo(() => {...}, [nodes])` 로 **`nodes` 배열 참조 전체**에 의존한다. React Flow 는 노드 드래그 중 `onNodesChange` 를 프레임마다 호출해 `nodes` 배열을 매번 새 참조로 교체하므로(위치만 바뀌고 `isDisabled` 값은 그대로여도), `disabledNodeIds` 는 값이 동일해도 매 프레임 새 `Set` 객체로 재생성된다. 이 새 참조가 최종 `useMemo([edges, disabledNodeIds, nodeStatusById, executing])` 의 의존성 배열에 들어 있어 `Object.is` 비교로 "변경"으로 판정되고, 결과적으로 `edges.map(...)` 이 매번 실행돼 **모든 엣지 객체(`data` 포함)가 새 참조로 재생성**된다.
    이 훅 자신의 주석("실행 컨텍스트가 전혀 없으면… 원본 edges 참조를 그대로 반환해 React Flow diff 를 0 으로 유지한다")이 보장하는 조기 반환 경로는 `disabledNodeIds.size===0 && !executing && nodeStatusById.size===0` 일 때만 작동하는데:
    - `nodeStatuses`(`execution-store.ts`)는 `completeExecution`/`failExecution` 에서 클리어되지 않는다(`CLEAR_INPUT_AFFORDANCE` 만 적용, `startExecution`/`startHistoryView`/`reset` 만 초기화) — 즉 **세션 중 워크플로우를 한 번이라도 실행하면 그 이후 캔버스에 머무는 내내 `nodeStatusById.size > 0`** 이 유지되어 조기 반환이 영구히 우회된다.
    - 노드를 하나라도 "비활성화"(disable) 한 워크플로우는 실행 여부와 무관하게 `disabledNodeIds.size > 0` 이라 처음부터 조기 반환을 타지 않는다.
    이 PR 이전에는 `edges`(store) 참조가 노드 위치 변경과 무관해 `useEdgeHighlighting` 파이프라인이 노드 드래그 중 전혀 재계산되지 않았다(하이라이팅 훅 내부 `edgeIndex`/`highlightedEdgeIds` memo 는 `edges`/hover/selection 에만 의존). 이번 변경으로 "실행 이력 있음" 또는 "비활성 노드 존재" 상태에서는 **노드를 끌 때마다 무관한 엣지 배열 전체가 재생성**되어 `CustomEdge = memo(...)` 의 얕은 비교가 매번 실패하고 모든 엣지 컴포넌트가 리렌더된다 — 노드 드래그와 엣지 실행상태/비활성상태는 논리적으로 무관한데도 결합돼버린 의도치 않은 재계산 캐스케이드.
  - 제안: `disabledNodeIds` 의존성을 `nodes` 배열 참조가 아니라 `isDisabled` 값 자체가 바뀔 때만 재계산되도록 분리한다(예: 정렬된 disabled-id 목록을 문자열로 join 해 안정적인 1차 값으로 만들고 그 문자열을 memo 키로 쓰거나, editor-store 에 `isDisabled` 값들만 shallow 비교하는 파생 selector 를 두는 방식). 최소한 PR 설명/CHANGELOG 의 "React Flow diff 0 유지" 주장이 실행 후 세션이나 비활성 노드 존재 워크플로우에는 적용되지 않는다는 점을 인지할 필요가 있다.

- **[INFO]** `className` 무조건 재할당 — 향후 다른 기능과의 조합 시 잠재적 clobber, 현재는 안전
  - 위치: `use-edge-execution-state.ts` L47-49 (`className: state.flowing ? ... : state.completed ? ... : undefined`); `workflow-canvas.tsx` L829-833 (`useEdgeExecutionState` → `useEdgeHighlighting` 순서 배선)
  - 상세: 컨텍스트가 non-empty 일 때 모든 엣지에 대해 `className` 을 항상 재계산해 **덮어쓴다**(flowing/completed 아니면 `undefined` 로 명시적 초기화). `useEdgeHighlighting` 은 반대로 기존 `className` 을 파싱해 Set 으로 병합/제거하는 대칭적 패턴을 쓰는 것과 대비된다. 현재는 store 의 raw edges 에 이 훅 이전 단계에서 `className` 을 설정하는 다른 경로가 없어 실질 피해는 없고, `workflow-canvas.tsx` 의 주석("§3.2 를 먼저 입힌 뒤 §3.3 를 얹는다")이 순서 의존성을 문서화하고 있다. 다만 이 순서 계약이 타입 시스템이나 런타임 가드로 강제되지 않아, 향후 훅 순서가 뒤바뀌거나 제3의 훅이 같은 패턴(무조건 덮어쓰기)으로 끼어들면 조용히 스타일이 유실될 수 있다.
  - 제안: 현 시점 조치 불요. 새 엣지 스타일링 훅을 추가할 때는 `useEdgeHighlighting` 과 동일한 Set 병합 패턴을 따르도록 컨벤션화하면 안전하다.

- **[INFO]** 인터페이스 변경은 전부 additive — 하위 호환 영향 없음
  - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts` (신규 export `EdgeExecutionState`, `FLOWING_EDGE_CLASS`, `COMPLETED_EDGE_CLASS`, `resolveEdgeExecutionState`), `custom-edge.tsx` (기존 optional `data.edgeInactive` 필드를 읽기만 추가)
  - 상세: 기존 export 시그니처(`resolvePortType`/`buildEdgeData`/`isSelfConnection`/`isDuplicateConnection`/`dropStaleEdges`/`enrichEdgesWithPortData` 등)는 전혀 변경되지 않았고 전부 신규 추가다. `CustomEdgeComponent` 의 `EdgeProps<CustomEdgeType>` 시그니처도 불변 — `data` 는 이미 `Record<string, unknown>` 이라 새 optional 키 소비는 타입/런타임 모두 안전하다. 공개 API 파급 없음.

- **[INFO]** 상태 관리·이벤트·환경변수·네트워크·파일시스템 — 해당 없음
  - `useEdgeExecutionState` 는 `useExecutionStore` 를 **읽기 전용 selector**로만 구독한다(`s.status === "running"`, `s.nodeStatuses`) — 어떤 액션도 dispatch 하지 않고 스토어를 mutate 하지 않는다. 새 전역 변수 도입 없음(export 된 두 상수는 불변 문자열 리터럴). 콜백 시그니처(`onConnect`/`onReconnect`/`onReconnectEnd` 등) 변경 없음, 새 이벤트 emit 없음. globals.css 변경은 순수 CSS(keyframes/className 룰) 추가로 런타임 부작용 없음. CHANGELOG/spec/plan/mdx 문서 변경은 서술만 갱신하며 코드 동작에 영향 없음(문서-코드 정합성은 별도 리뷰 관점 소관).

## 요약
이번 변경은 새 훅(`useEdgeExecutionState`)과 순수 판정 함수(`resolveEdgeExecutionState`)를 추가하고 두 개의 기존 렌더 컴포넌트(`custom-edge.tsx`, `workflow-canvas.tsx`)에 읽기 전용 데이터 소비 지점을 추가하는 구조로, 전역 상태 변이·시그니처 파괴·네트워크/파일시스템/환경변수 부작용은 없다. 다만 `disabledNodeIds` 의 메모이제이션이 `nodes` 배열 참조 전체에 의존해, 실행 이력이 있거나(세션 중 `nodeStatuses` 가 재실행 전까지 비워지지 않음) 비활성 노드가 하나라도 있는 워크플로우에서는 **노드 드래그마다 엣지 배열 전체가 재생성**되어 이 기능 이전에는 없던 리렌더 캐스케이드가 발생한다 — 기능적으로는 정확하지만 이 PR/훅 자신이 명시한 "React Flow diff 0 유지" 성능 불변식을 조용히 무력화하는 의도치 않은 부작용이다.

## 위험도
MEDIUM
