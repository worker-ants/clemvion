# 유지보수성(Maintainability) 리뷰

대상: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx`, `codebase/frontend/src/lib/stores/editor-store.ts`, `codebase/frontend/src/lib/utils/edge-utils.ts`, `codebase/frontend/src/lib/utils/__tests__/edge-utils.test.ts`, `CHANGELOG.md`, `plan/in-progress/spec-sync-edge-gaps.md`, `spec/3-workflow-editor/2-edge.md` (§1.2 자동 엣지 연결 — 직전 ai-review(`review/code/2026/07/13/11_04_21`, HIGH) 반영 커밋)

본 diff 는 직전 리뷰 세션(11_04_21, 전체 위험도 HIGH)의 RESOLUTION 커밋이다. 당시 maintainability 서브에이전트가 낸 WARNING 1건·INFO 3건이 이번 diff 에서 실제로 어떻게 반영됐는지 우선 대조하고, 잔존·신규 이슈를 점검했다.

### 발견사항

- **[INFO]** (해소 확인) "노드 검색 팝업 열기" 3중 중복 — `openNodeSearchPopupAt` 공용 헬퍼로 정리됨
  - 위치: `workflow-canvas.tsx` `openNodeSearchPopupAt`(신규), `onPaneClick`/`handleCanvasMenuAction`/`onConnectEnd` 세 호출부
  - 상세: 직전 리뷰 WARNING 이 정확히 반영됐다. `setNodeContextMenu(null)`→`setCanvasContextMenu(null)`→`setNodeSearchPopup(...)`→`setSearchQuery("")` 시퀀스가 한 곳에만 존재하고 세 호출부가 공유한다. 다만 `screenToFlowPosition(...) ?? { x: 0, y: 0 }` 좌표 변환 자체는 `onPaneClick`과 `onConnectEnd` 두 곳에 여전히 그대로 복제돼 있다(각 3줄). `openNodeSearchPopupAt` 이 이미 계산된 `flowPosition`을 인자로 받는 설계라 변환 로직까지 흡수하지 못했다.
  - 제안: 사소한 잔여 중복이며 차단 사유는 아니다. §1.3(역방향 드래그) 착수 시 `openNodeSearchPopupAt` 확장 논의와 함께 `screenToFlowPosition` 폴백까지 흡수하는 것을 고려(예: 헬퍼가 `clientX/clientY`만 받고 내부에서 변환).

- **[INFO]** (해소 확인) `source` 필드명 혼동 — `dragSource` 로 개명 + 명명 근거 인라인 주석
  - 위치: `workflow-canvas.tsx` `NodeSearchPopupState.dragSource`
  - 상세: "(Connection.source 문자열과 구분하려고 dragSource 로 명명.)" 주석까지 남겨 후속 리더가 왜 `source` 대신 `dragSource`를 썼는지 바로 이해할 수 있다. 직전 리뷰 INFO 를 정확히 반영.

- **[INFO]** (해소 확인) 터치/마우스 이벤트 분기 설명 부족 — `pointerClientPosition` 순수 함수 추출 + JSDoc
  - 위치: `edge-utils.ts` `pointerClientPosition`
  - 상세: `"changedTouches" in event` 분기가 이제 전용 함수로 분리되고 JSDoc("React Flow 의 onConnectEnd 는 네이티브 MouseEvent | TouchEvent 를 넘기므로…")이 의도를 설명한다. 부가로 단위 테스트 3케이스(마우스/터치/빈 changedTouches)까지 추가돼 직전 리뷰가 지적한 "이해 비용"과 "미검증" 두 우려를 함께 해소했다.

- **[INFO]** (잔존, 경미) `edge-utils.ts` 내 신규 헬퍼 배치가 기능 그룹과 약간 어긋남
  - 위치: `edge-utils.ts` — `isConnectionDroppedOnPane`/`firstInputHandleId`/`connectionDragSource`/`pointerClientPosition`/`buildAutoConnectConnection`
  - 상세: 직전 리뷰에서 이미 INFO 로 지적됐고 이번에도 미반영이다("성능/우선순위상 이번 스코프 아님"으로 판단 가능). 파일은 "포트 색상/타입 판정 → 연결 유효성 → §1.2 자동연결 헬퍼 → 그래프 유틸" 순으로 그룹 크기가 커지고 있어, §1.3 헬퍼가 추가되면 섹션 주석 구분 없이 더 늘어날 가능성이 있다.
  - 제안: 지금 당장 조치는 불필요. §1.3 착수 시 섹션 헤더 주석(`// --- §1.2 자동 연결 ---` 류)을 추가해 파일 내비게이션 비용을 줄이는 것을 권장(plan 에 이미 §1.3 이월 항목으로 유사 취지 기록됨).

- **[INFO]** `firstInputHandleId`/`buildAutoConnectConnection` 의 "컨테이너 충돌 미발생" 가정이 주석으로만 방어됨
  - 위치: `edge-utils.ts` `buildAutoConnectConnection` JSDoc
  - 상세: 직전 리뷰 WARNING(#7, "첫 입력 포트=안전 target" 암묵 가정)에 대해 코드 변경 대신 JSDoc 명시로 "부분 반영"했다는 점이 `RESOLUTION.md`에 정직하게 기록돼 있다. 실행 가능한 가드(예: 예약 포트 id 명시적 제외)는 여전히 없어 신규 컨테이너 노드 정의가 추가되면 조용한 회귀 가능성이 남는다. 다만 현재 노드 정의 데이터로는 발생하지 않으며, 향후 그런 노드가 추가될 때 대응하기로 명시적으로 이월된 결정이라 지금 시점엔 정당한 트레이드오프다.
  - 제안: 조치 불요(추적됨). 새 컨테이너형 노드 정의를 추가하는 PR에서 첫 입력 포트가 예약 포트(`emit` 등)가 아닌지 체크리스트 항목으로 남기는 정도면 충분.

- **[INFO]** `workflow-canvas.tsx` God Component 성향은 이번 diff 로 오히려 완화됐으나 근본 해소는 §1.3 로 이월
  - 위치: `workflow-canvas.tsx` 전체
  - 상세: 직전 리뷰가 WARNING 으로 지적한 "책임 팽창"은, 이번 diff 가 중복 팝업-오픈 로직을 헬퍼로 뽑아낸 덕에 순증가 폭이 줄었다(신규 `onConnectEnd`/`openNodeSearchPopupAt`/`buildAndAddNode` 반환값 변경 모두 짧고 단일 책임에 가깝다). 다만 파일 자체는 여전히 다수 관심사(컨텍스트 메뉴 3종·검색 팝업·단축키·DnD·undo)를 한 컴포넌트에 담고 있고, 전용 훅으로의 추출은 plan(`spec-sync-edge-gaps.md`) §1.3 이월 항목 (a)로 명시적으로 defer 됐다.
  - 제안: 조치 불요. §1.3 착수 시 반드시 재검토하도록 plan 에 이미 기록돼 있어 누락 위험은 낮다.

### 요약
이번 diff 는 직전 ai-review(HIGH)가 낸 maintainability WARNING 1건과 INFO 3건 중 3건을 코드로 완전히 반영하고 나머지(헬퍼 배치 순서)는 의도적으로 이월하며 그 사실을 `RESOLUTION.md`/plan 에 정직하게 기록했다. `openNodeSearchPopupAt`/`connectionDragSource`/`pointerClientPosition`/`buildAutoConnectConnection` 모두 가드절 기반의 얕은 중첩, 명확한 이름, JSDoc, 매직 넘버 없는 순수 함수로 기존 `edge-utils.ts` 컨벤션(§참조 주석, `isSelfConnection`/`isDuplicateConnection` 스타일)과 일관되며 신규 vitest 21케이스로 뒷받침된다. 잔존 이슈는 `screenToFlowPosition` 폴백의 2곳 복제, 헬퍼 파일 내 배치 순서, 컨테이너 포트 순서 암묵 가정 등 전부 경미하고 이미 추적(§1.3 이월)돼 있어 차단 사유가 되지 않는다.

### 위험도
LOW
