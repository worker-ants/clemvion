# 유지보수성(Maintainability) 리뷰

대상: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx`, `codebase/frontend/src/lib/stores/editor-store.ts`(+test), `codebase/frontend/src/lib/utils/edge-utils.ts`(+test), `CHANGELOG.md`, `plan/in-progress/spec-sync-edge-gaps.md`, `spec/3-workflow-editor/2-edge.md`, 4개 유저 가이드 mdx, `review/code/2026/07/13/{11_04_21,11_28_30}/*`(직전 2회 ai-review 산출물 커밋)

본 diff는 §1.2("출력 포트 드래그 → 빈 영역 드롭 시 노드 추가 팝업 + 자동 엣지 연결") 최초 구현과, 그에 대한 직전 2회 ai-review(11_04_21 HIGH → 11_28_30 MEDIUM)가 지적한 사항의 반영 커밋을 모두 포함한 누적 diff다. 코드 자체(`workflow-canvas.tsx`/`editor-store.ts`/`edge-utils.ts`)를 현재 상태 기준으로 직접 열람해 독립적으로 재검증했다.

### 발견사항

- **[INFO]** `screenToFlowPosition(...) ?? { x: 0, y: 0 }` 좌표 변환 폴백이 `onPaneClick`과 `onConnectEnd` 두 곳에 여전히 복제됨
  - 위치: `workflow-canvas.tsx:323`(`onPaneClick`), `:346`(`onConnectEnd`)
  - 상세: 직전 라운드에서 `openNodeSearchPopupAt(clientX, clientY, flowPosition, dragSource?)` 헬퍼로 "팝업 열기" 시퀀스(컨텍스트 메뉴 닫기 → state set)는 3중 중복에서 단일화됐으나, 헬퍼가 이미 계산된 `flowPosition`을 인자로 받는 설계라 `screenToFlowPosition` 호출 자체는 흡수하지 못하고 두 호출부에 그대로 남아 있다. 사소하지만 좌표 변환 로직이 바뀌면(예: 별도 오프셋 보정 추가) 두 곳을 동시에 고쳐야 한다.
  - 제안: `openNodeSearchPopupAt`이 `clientX`/`clientY`만 받아 내부에서 `screenToFlowPosition`을 호출하도록 확장하면 잔여 중복도 제거된다. 이미 §1.3 이월 항목으로 plan에 유사 취지가 기록돼 있어 즉시 조치는 불필요.

- **[INFO]** `edge-utils.ts`에 §1.2 전용 헬퍼 5종이 추가되며 파일 내 섹션 구분 주석 없이 계속 나열
  - 위치: `edge-utils.ts` — `isConnectionDroppedOnPane`/`firstInputHandleId`/`connectionDragSource`/`pointerClientPosition`/`buildAutoConnectConnection`(L116-200), 기존 "포트 색상/타입 판정" → "연결 유효성"(`isSelfConnection`/`isDuplicateConnection`) 그룹 바로 뒤
  - 상세: 각 함수는 이름·JSDoc·가드절 모두 명확하지만, 파일이 "포트 판정 → 연결 유효성 → §1.2 자동연결 → 그래프 유틸" 순으로 그룹이 점점 늘어나는데 이를 구분하는 헤더 주석이 없다. §1.3에서 헬퍼가 더 추가되면 파일 탐색 비용이 누적될 수 있다.
  - 제안: 새 헬퍼를 추가할 때 `// --- §1.2 자동 연결 판정/조립 ---` 류의 섹션 헤더를 도입해 그룹 경계를 명시할 것(plan §1.3 이월 항목에 유사 취지 기록됨, 즉시 조치 불요).

- **[INFO]** `getNodeDefinition(nodeType)` 이중 조회 잔존
  - 위치: `workflow-canvas.tsx` `handleAddNodeFromSearch`가 `buildAndAddNode(nodeType, ...)` 호출 후, 자동 연결 분기에서 동일 `nodeType`에 대해 `getNodeDefinition(nodeType)`을 재호출해 `buildAutoConnectConnection`에 전달
  - 상세: 전역 Map 조회라 실질 성능 영향은 없으나, 두 협력 함수가 "이 nodeType의 definition"이라는 동일 정보를 각자 재조회하는 암묵적 결합이다. 직전 두 라운드 모두 우선순위 낮음으로 이월된 잔존 이슈.
  - 제안: `buildAndAddNode`가 `{ id, definition }`을 반환하거나 상위에서 1회 조회해 전달하도록 정리하면 결합이 사라진다. 이번 스코프에서 필수 아님.

- **[INFO]** `workflow-canvas.tsx`(978줄)의 다관심사 God Component 성향 지속 — 단, 이번 diff는 오히려 순증가를 억제
  - 위치: `workflow-canvas.tsx` 전체(컨텍스트 메뉴 3종·검색 팝업·키보드 단축키·DnD·단일 노드 실행·삭제 확인 다이얼로그·undo 등)
  - 상세: 이번 변경으로 추가된 `onConnectEnd`/`openNodeSearchPopupAt`/`buildAndAddNode` 반환값 확장은 각각 짧고 단일 책임에 가까워 이전보다 오히려 응집도가 개선됐다(팝업 오픈 3중 중복이 공용 헬퍼로 흡수됨). 다만 파일 자체의 근본적 책임 분리(오케스트레이션을 전용 훅으로 추출)는 미수행이며, `plan/in-progress/spec-sync-edge-gaps.md` §1.3 이월 항목 (a)로 명시적으로 추적되고 있다.
  - 제안: 조치 불요(추적됨). §1.3(역방향 드래그) 착수 시 plan에 기록된 대로 오케스트레이션 훅 추출을 재검토할 것.

- **[INFO]** 신규 순수 헬퍼·테스트는 기존 컨벤션과 일관되고 품질 양호
  - 위치: `edge-utils.ts` 5종 헬퍼 + `edge-utils.test.ts`(21케이스), `editor-store.ts` `onConnect(connection, opts?)` + `editor-store.test.ts`(skipUndo 2케이스)
  - 상세: 신규 함수 전부 가드절 기반 얕은 중첩(depth 1~2), 목적이 드러나는 이름(`isConnectionDroppedOnPane`, `firstInputHandleId`, `connectionDragSource`, `pointerClientPosition`, `buildAutoConnectConnection`), 매직 넘버 없이 순수 함수로 분리돼 기존 `isSelfConnection`/`isDuplicateConnection` 스타일(§참조 JSDoc)을 그대로 따른다. `onConnect`의 `opts?: { skipUndo?: boolean }` 확장도 옵션 객체 형태로 하위 호환을 유지하며 의도를 주석으로 명확히 남겼다.
  - 제안: 없음(현행 유지).

- **[INFO]** 문서·plan·review 산출물 변경은 코드와 정확히 대응, 잡음 없음
  - 위치: `CHANGELOG.md`, `spec/3-workflow-editor/2-edge.md` §1.2, 4개 mdx 가이드, `plan/in-progress/spec-sync-edge-gaps.md`, `review/code/2026/07/13/{11_04_21,11_28_30}/*`
  - 상세: spec 각주·CHANGELOG 서술·mdx 4파일(ko/en × 2문서)이 모두 실제 구현(`onConnectEnd`, `dragSource`, `skipUndo`, 5개 순수 헬퍼)과 line-level로 일치하며 서로 다른 파일 간 문구 불일치도 없다. 리뷰 산출물 커밋은 저장소 확립 관례(`review/`는 gitignore 대상 아님)에 부합해 유지보수성 관점의 잡음이 아니다.
  - 제안: 없음.

### 요약
이번 diff는 §1.2 최초 구현과 그에 대한 2회의 ai-review 지적(팝업 오픈 3중 중복, `source` 필드명 혼동, undo 이중 스냅샷, 배선 미검증, spec/CHANGELOG/유저가이드 stale)을 순차적으로 코드·문서로 정확히 반영한 결과물이다. 현재 코드 상태를 직접 열람해 재검증한 결과 신규 헬퍼·콜백은 명확한 네이밍·얕은 중첩·매직 넘버 없는 순수 함수·JSDoc·테스트를 갖춰 기존 `edge-utils.ts`/`editor-store.ts` 컨벤션과 일관되고, 두 차례 지적됐던 실질적 유지보수성 결함(팝업 오픈 중복, undo 중복 push)은 실제로 해소됐다. 잔존 이슈는 `screenToFlowPosition` 폴백의 2곳 복제, 신규 헬퍼 그룹의 섹션 주석 부재, `getNodeDefinition` 이중 조회, `workflow-canvas.tsx`의 다관심사 팽창 4건이며 전부 경미하고 이미 plan §1.3 이월 항목으로 추적돼 있어 이번 스코프를 차단할 사유가 아니다.

### 위험도
LOW
