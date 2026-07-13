### 발견사항

- **[INFO]** `evaluateConnection`/`detectContainerConflict`/`buildEdgeDataForConnection` 가 각각 독립적으로 `nodes.find()`(O(N)) 를 수행
  - 위치: `codebase/frontend/src/lib/stores/editor-store.ts` `onConnect`/`onReconnect` (신규 `evaluateConnection`, `buildEdgeDataForConnection`, 기존 `detectContainerConflict`)
  - 상세: 재연결(`onReconnect`) 1회 호출마다 `evaluateConnection`(내부 `detectContainerConflict` 가 `nodes.find` ×2, 충돌 시 `labelOf` 가 추가로 ×2) → `buildEdgeDataForConnection`(`nodes.find` ×1) 순으로 노드 배열을 여러 번 선형 탐색한다. 단일 사용자 드래그 제스처당 1회 호출이라 현재 워크플로 규모에서는 체감 지연이 없고, 동일 파일의 `deriveContainerAssignments` 는 이미 W-23 회귀(500×500 에서 4M 비교) 를 겪은 뒤 `Map` 기반으로 최적화되어 있어 이번 변경이 재사용하는 그 함수 자체는 문제없다.
  - 제안: 현재는 조치 불요. 다만 노드 수가 매우 커지는 시나리오(수천 개)에서 `onConnect`/`onReconnect` 호출 빈도가 늘어나면(예: 프로그래매틱 대량 연결) `nodeMap = new Map(nodes.map(n => [n.id, n]))` 를 store 레벨에서 한 번 구성해 여러 헬퍼가 공유하도록 리팩터링을 고려할 수 있다.

- **[INFO]** `onReconnect` 가 `get().edges.filter(...)` 로 매 호출마다 새 배열을 할당
  - 위치: `codebase/frontend/src/lib/stores/editor-store.ts` `onReconnect`
  - 상세: 재연결 중인 엣지 자신을 중복 검사에서 제외하기 위해 `get().edges.filter((e) => e.id !== oldEdge.id)` 로 매번 O(E) 배열을 새로 만든다. 단일 사용자 제스처당 1회이므로 실질적 영향은 없다.
  - 제안: 조치 불요(과최적화 리스크가 더 큼).

- **[INFO]** N+1 쿼리/블로킹 I/O 없음
  - 위치: `use-edge-reconnect.ts`, `editor-store.ts` `onReconnect`/`removeEdge`
  - 상세: 재연결·detach 모두 순수 클라이언트 상태(zustand) 갱신이며 즉시 서버 호출(REST) 을 하지 않는다(저장 시점에만 반영). 반복문 내 API/DB 호출 패턴 없음.

### 요약
이번 diff(§1.3 엣지 재연결/detach)는 순수 프런트엔드 클라이언트 상태 갱신이며, 사용자 제스처 1회당 O(N+E) 수준의 선형 스캔만 발생해 반복문 기반 N+1 이나 블로킹 I/O, 불필요한 O(n²) 누적 같은 패턴이 없다. 컨테이너 소속 재도출은 과거 W-23 회귀로 이미 `Map` 기반으로 최적화된 `deriveContainerAssignments` 를 그대로 재사용하고, 예약 입력 포트 판정도 `Set` 을 사용해 적절한 자료구조를 선택했다. 발견된 사항은 모두 대규모 그래프에서의 잠재적 최적화 여지 수준의 INFO 이며, 현재 규모에서 실질적 성능 리스크는 없다.

### 위험도
NONE
