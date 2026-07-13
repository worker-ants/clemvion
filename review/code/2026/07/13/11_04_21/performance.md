# 성능(Performance) Review

## 발견사항

- **[INFO]** `getNodeDefinition(nodeType)` 중복 조회
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` `handleAddNodeFromSearch` (L775-788)
  - 상세: `buildAndAddNode(nodeType, ...)` 내부에서 이미 `getNodeDefinition(nodeType)` 을 호출해 `definition` 을 얻는데, 바로 다음 줄에서 `firstInputHandleId(getNodeDefinition(nodeType))` 로 동일 조회를 한 번 더 수행한다. `getNodeDefinition` 은 Zustand store 의 Map 조회(O(1))라 실질 비용은 무시할 수준이지만, `buildAndAddNode` 가 definition(또는 targetHandle)을 반환하도록 시그니처를 확장하면 중복 조회 자체를 제거할 수 있다.
  - 제안: 필요 시에만 — 현재 비용이 미미해 필수 조치는 아님. 리팩터 기회로만 기록.

- **[INFO]** `onConnectEnd`/`onConnect` 자동 연결 경로의 알고리즘 복잡도는 모두 O(1)~O(n) 수준으로 적절
  - 위치: `edge-utils.ts` `isConnectionDroppedOnPane`/`firstInputHandleId`, `workflow-canvas.tsx` `onConnectEnd`
  - 상세: 신규 순수 함수 2개는 단순 필드 접근/배열 첫 요소 조회로 O(1)이며 반복문·재귀 없음. `onConnectEnd` 는 사용자의 드래그 종료라는 저빈도 이벤트에서만 실행되고 내부에서 `screenToFlowPosition` 좌표 변환 1회, state setter 호출 몇 개뿐이라 렌더링 비용에 영향 없음. `useCallback(..., [])` 로 의존성을 고정해 ReactFlow 에 매 렌더마다 새 함수 참조를 넘기지 않는 점도 적절하다(ref·setState 함수는 안정 참조이므로 빈 배열이 정확함).
  - 제안: 없음(현행 유지).

- **[INFO]** `buildAndAddNode`/`handleAddNodeFromSearch` 의 O(n) 스캔(`nodes.some`, `nodes.map`)은 본 diff 이전부터 존재하던 패턴이며 이번 변경으로 신규 도입되거나 빈도가 늘지 않음
  - 위치: `workflow-canvas.tsx` `buildAndAddNode` (L742-750)
  - 상세: 노드 추가 1회당 트리거 중복 검사(`nodes.some`)와 라벨 유일성 검사(`nodes.map`)가 각각 워크플로우 전체 노드 수만큼 순회한다. 일반적인 워크플로우 규모(수십~수백 노드)에서는 문제되지 않으며, 본 PR 은 이 경로에 반환값(`newId`)만 추가했을 뿐 순회 로직 자체는 손대지 않았다.
  - 제안: 조치 불필요. 향후 노드 수가 수천 단위로 커질 가능성이 있다면 별도 최적화 과제로 분리.

## 요약

이번 변경은 워크플로우 캔버스 편집기에서 "출력 포트를 빈 영역에 드롭 → 노드 추가 팝업 → 자동 엣지 연결"을 지원하는 UI 이벤트 핸들러 추가이며, 신규 로직은 전부 O(1) 순수 함수(`isConnectionDroppedOnPane`, `firstInputHandleId`)와 저빈도 사용자 이벤트(`onConnectEnd`, 드래그 종료 1회)에 국한된다. 반복문 내 DB/API 호출, N+1, 블로킹 I/O, 대규모 메모리 할당, 캐시 무효화 이슈는 발견되지 않았다. `useCallback` 의존성 배열도 안정 참조(ref, zustand setter)만 사용해 불필요한 재생성이나 재렌더를 유발하지 않는다. 유일하게 언급할 만한 점은 `getNodeDefinition` 을 같은 흐름에서 두 번 조회하는 미세한 중복이나, Map 조회 수준이라 실질적 성능 영향은 없다.

## 위험도
NONE
