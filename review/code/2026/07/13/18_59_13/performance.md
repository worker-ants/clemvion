# 성능(Performance) Review

대상: 엣지 분할(mid-insert, §4.1) — `workflow-canvas.tsx`(`onDrop`), `edge-utils.ts`(`firstOutputHandleId`/`isContainerBoundaryEdge`/`buildEdgeSplitPlan`/`findEdgeIdAtPoint`), `editor-store.ts`(`removeEdge` `{skipUndo}`). 나머지 파일(CHANGELOG·mdx 문서·plan·spec·기존 리뷰 산출물)은 코드 실행 경로가 없어 성능 관점 대상에서 제외.

## 발견사항

- **[INFO]** `onDrop` 내 `edges.find((e) => e.id === droppedEdgeId)` 는 O(n) 선형 탐색
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` `onDrop` (신규 라인, `edges.find(...)`)
  - 상세: 드롭 지점의 엣지 객체를 배열 선형 탐색으로 찾는다. 다만 이 탐색은 **드래그&드롭이라는 단발성 사용자 조작 1회**에만 실행되며(루프·폴링 아님), `edges` 는 이미 이 컴포넌트가 렌더링을 위해 구독 중인 상태라 신규 구독 비용도 없다. store 전반에 `edgesById` 류 id-인덱스가 없어(다른 엣지 조회 헬퍼들도 동일하게 배열 스캔) 기존 코드 스타일과 일관적이다. 워크플로 엣지 수가 수천 단위로 커지지 않는 한 실질적 병목이 아니다.
  - 제안: 현재 규모에서는 조치 불요. 향후 대규모 그래프(수천 엣지) 지원 시 `edgesById` Map 인덱스 도입을 고려.

- **[INFO]** `onDrop` `useCallback` 의존성 배열에 `edges` 추가로 엣지 변경마다 핸들러 재생성
  - 위치: `workflow-canvas.tsx` `onDrop` deps `[buildAndAddNode, edges, removeEdge, onConnect]` (기존 `[buildAndAddNode]`에서 확장)
  - 상세: `edges` 는 이미 `useEditorStore((s) => s.edges)` 로 구독되어 엣지가 바뀔 때마다 컴포넌트가 재렌더링되므로, `onDrop` 함수 재생성 자체가 추가 렌더 비용을 유발하지 않는다. React Flow 의 `onDrop` 은 DOM 이벤트 핸들러로 재부착 비용도 무시할 수준.
  - 제안: 조치 불요. (참고: 엣지 수가 극단적으로 큰 경우 `get().edges` 로 최신값을 읽어 deps 에서 `edges` 를 빼는 최적화가 가능하나 현재 이득 대비 가독성 저하만 큼.)

- **[INFO]** `findEdgeIdAtPoint` 의 DOM hit-test 비용
  - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts` `findEdgeIdAtPoint`
  - 상세: `document.elementFromPoint` + `Element.closest(".react-flow__edge")` 조합은 브라우저 네이티브 히트테스트/DOM 트리 상승 탐색으로 캔버스 엣지 개수와 무관하게 사실상 상수 시간이며, 드롭 이벤트당 1회만 호출된다. 별도 캐싱·쓰로틀링 불요.
  - 제안: 없음.

- **[INFO]** `buildEdgeSplitPlan`/`isContainerBoundaryEdge`/`firstOutputHandleId` 는 순수 함수·O(1)~O(포트 수)
  - 위치: `edge-utils.ts`
  - 상세: 배열 인덱싱·`Set.has`·소수 필드 조회만 수행하며 상태 변경·I/O·루프가 없다. 알고리즘 복잡도·메모리 할당·블로킹 I/O 관점에서 문제 없음.
  - 제안: 없음.

- **[INFO]** `removeEdge` `{skipUndo}` 옵션은 조건문 하나만 추가 — Big-O 변화 없음
  - 위치: `codebase/frontend/src/lib/stores/editor-store.ts` `removeEdge`
  - 상세: `if (!opts?.skipUndo) get().pushUndo()` 분기만 추가되어 기존 필터링(`state.edges.filter(...)`) 로직과 복잡도는 동일. `pushUndo` 호출 생략은 오히려 undo 스택 성장(메모리)을 줄이는 방향(엣지 수술 2단계가 체크포인트 1개로 합쳐짐).
  - 제안: 없음.

## 요약

이번 변경은 팔레트→엣지 드롭 시 엣지를 분할해 노드를 중간 삽입하는 기능으로, 모든 신규 로직이 (1) 사용자의 단발성 드롭 이벤트 핸들러 내부에서만 실행되고 (2) 추가된 헬퍼(`buildEdgeSplitPlan`, `isContainerBoundaryEdge`, `firstOutputHandleId`, `findEdgeIdAtPoint`)는 전부 순수 함수로 O(1)~O(포트 수)의 경미한 연산만 수행한다. 반복문 내 DB/API 호출, 블로킹 I/O, 불필요한 대규모 메모리 할당, 캐싱 누락, 부적절한 자료구조 사용 등 CRITICAL/WARNING 급 성능 이슈는 발견되지 않았다. `edges.find` 선형 탐색과 `onDrop` 콜백 재생성은 이론적으로 언급할 수 있는 지점이나 실질 영향은 무시할 수준이라 INFO 로만 기록한다.

## 위험도
NONE
