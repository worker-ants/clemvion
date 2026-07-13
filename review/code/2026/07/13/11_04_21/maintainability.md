# 유지보수성(Maintainability) 리뷰

대상: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx`, `codebase/frontend/src/lib/utils/edge-utils.ts`, `codebase/frontend/src/lib/utils/__tests__/edge-utils.test.ts`, `plan/in-progress/spec-sync-edge-gaps.md` (§1.2 출력 포트 드래그→빈 영역 드롭 시 노드 추가 팝업 + 자동 엣지 연결)

### 발견사항

- **[WARNING]** "노드 검색 팝업 열기" 로직이 3곳에 유사 형태로 중복
  - 위치: `workflow-canvas.tsx` `onPaneClick`(기존, 더블클릭), `handleCanvasMenuAction` 의 `"add-node"` 케이스(기존, 우클릭 메뉴), 신규 `onConnectEnd`(§1.2)
  - 상세: 이번 diff 로 `onConnectEnd` 가 세 번째 발생지가 됐다. 특히 `onPaneClick`(414~496행 부근)과 `onConnectEnd`(신규)는 `screenToFlowPosition(...) ?? { x: 0, y: 0 }` 폴백 계산 → `setNodeContextMenu(null)` → `setCanvasContextMenu(null)` → `setNodeSearchPopup({ x, y, flowPosition, ... })` → `setSearchQuery("")` 순서를 거의 그대로 반복한다. 기능 자체를 확장하면서(§1.2) 기존 중복을 인식하고 공용 헬퍼로 묶을 기회였으나 반복을 한 번 더 늘렸다.
  - 제안: `openNodeSearchPopupAt(clientX, clientY, source?: NodeSearchPopupState["source"])` 같은 헬퍼로 묶어 `onPaneClick`/`onConnectEnd`(및 필요하면 `handleCanvasMenuAction`)가 공유하게 하면 향후 팝업 오픈 시퀀스가 바뀔 때(예: `highlightedIndex` 리셋 로직 추가) 한 곳만 수정하면 된다. 이번 PR 스코프에서 필수는 아니지만 다음 §1.3(역방향 드래그) 작업이 유사 패턴을 또 추가할 가능성이 높아 지금 정리하는 편이 저렴하다.

- **[INFO]** `onConnectEnd` 의 이벤트 타입 분기에 짧은 설명 주석이 없음
  - 위치: `workflow-canvas.tsx` `onConnectEnd` 내부, `const point = "changedTouches" in event ? event.changedTouches[0] : event;`
  - 상세: React Flow `OnConnectEnd` 의 `event` 파라미터가 `MouseEvent | TouchEvent` 유니온이라는 사실을 알아야 이 한 줄의 의도가 이해된다. 함수 상단 블록 주석은 §1.2 비즈니스 로직만 설명하고 이 타입 분기 자체는 설명하지 않는다.
  - 제안: `// MouseEvent | TouchEvent 유니온 — 터치 드롭은 changedTouches[0] 에서 좌표를 읽는다` 정도의 짧은 인라인 주석을 추가하면 React Flow API 를 모르는 리뷰어의 이해 비용이 줄어든다.

- **[INFO]** `NodeSearchPopupState.source` 필드명이 문자열 `source`(노드 ID) 와 겹쳐 미세한 혼동 여지
  - 위치: `workflow-canvas.tsx` `NodeSearchPopupState.source: { nodeId: string; handleId: string | null }`, `handleAddNodeFromSearch` 의 `const source = nodeSearchPopup.source;` → `onConnect({ source: source.nodeId, ... })`
  - 상세: 코드베이스 전반(`edge-utils.ts` `isSelfConnection`/`isDuplicateConnection`, React Flow `Connection` 타입)에서 `source`/`target` 은 노드 ID 문자열을 가리키는 컨벤션이다. 이번 diff 는 같은 이름 `source` 를 객체(`{nodeId, handleId}`)로 재사용해 `source.nodeId` 처럼 한 단계 더 접근해야 한다. 타입이 명확해 실질적 버그 위험은 낮지만, 이름만 보면 문자열 ID 로 오인하기 쉽다.
  - 제안: `source` → `connectionOrigin` 또는 `dragSource` 등으로 개명하면 "노드 ID 문자열" 관례와 명확히 구분된다. 강제 사항은 아님.

- **[INFO]** `firstInputHandleId`/`isConnectionDroppedOnPane` 배치 위치가 기능 그룹과 약간 어긋남
  - 위치: `edge-utils.ts`, `isDuplicateConnection` 바로 다음, `getConnectedEdgeIds` 이전
  - 상세: 이 파일은 대략 "포트 색상/타입 판정"(`resolvePortType`, `getEdgeColor`, `buildEdgeData`) → "연결 유효성"(`isSelfConnection`, `isDuplicateConnection`) → "그래프 유틸"(`getConnectedEdgeIds`, `dropStaleEdges`, `enrichEdgesWithPortData`) 순으로 느슨하게 그룹핑돼 있다. 신규 두 함수는 §1.2 전용(팝업 오픈 판정 + 자동연결 대상 포트 조회)이라 "연결 유효성" 그룹과는 성격이 다르다. 다만 §1.2 로 함께 묶여 있다는 점에서 정당화는 가능하다.
  - 제안: 강한 리팩터링 요구는 아님. 다음에 §1.3(역방향 드래그) 헬퍼가 추가되면 이 파일의 섹션 구분(주석 헤더)을 한 번 정리할 것을 권장.

### 요약
이번 변경은 기존 `edge-utils.ts` 의 순수 헬퍼-함수 패턴(`isSelfConnection`/`isDuplicateConnection` 과 동일한 JSDoc + §참조 스타일)과 `useCallback` 기반 이벤트 핸들러 컨벤션을 그대로 따르고 있어 전반적으로 가독성·네이밍·일관성이 양호하다. 신규 함수(`isConnectionDroppedOnPane`, `firstInputHandleId`)는 이름이 목적을 명확히 드러내고, 가드절 기반의 얕은 중첩(depth 1~2)을 유지하며, 매직 넘버 없이 순수 함수로 분리돼 테스트(9케이스)도 충실하다. 다만 "노드 검색 팝업 오픈" 시퀀스(좌표 변환 → 메뉴 닫기 → 상태 세팅)가 이번 변경으로 세 번째 유사 사례가 되어 DRY 관점의 리팩터링 여지가 쌓이고 있으며, `source` 필드명 재사용과 이벤트 타입 분기부 설명 부족은 사소하지만 다음 작업자의 이해 비용을 소폭 늘린다. 전체적으로 차단할 결함은 없다.

### 위험도
LOW
