# 유지보수성(Maintainability) 리뷰

대상: `CHANGELOG.md`, `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx`, `codebase/frontend/src/lib/stores/editor-store.ts`(+test), `codebase/frontend/src/lib/utils/edge-utils.ts`(+test), 4개 유저 가이드 mdx, `plan/in-progress/spec-sync-edge-gaps.md`, `spec/3-workflow-editor/2-edge.md`, `review/code/2026/07/13/{11_04_21,11_28_30,11_46_01}/*`(직전 3회 ai-review 산출물 커밋)

본 diff는 §1.2("출력 포트 드래그 → 빈 영역 드롭 시 노드 추가 팝업 + 자동 엣지 연결") 구현과, 그에 대한 직전 3회 ai-review(11_04_21 HIGH → 11_28_30 MEDIUM → 11_46_01 LOW)가 순차적으로 지적한 사항의 반영 커밋을 모두 포함한 누적 diff다. 코드(`workflow-canvas.tsx`/`editor-store.ts`/`edge-utils.ts`)를 현재 저장소 상태 기준으로 직접 열람해 독립적으로 재검증했다.

### 발견사항

- **[INFO]** `screenToFlowPosition(...) ?? { x: 0, y: 0 }` 좌표 변환 폴백이 `onPaneClick`(L323)과 `onConnectEnd`(L346) 두 곳에 여전히 복제됨
  - 위치: `workflow-canvas.tsx:323`, `:346`
  - 상세: `openNodeSearchPopupAt(clientX, clientY, flowPosition, dragSource?)` 로 "팝업 열기" 시퀀스(컨텍스트 메뉴 닫기 → state set)는 단일화됐으나, 헬퍼가 이미 계산된 `flowPosition`을 인자로 받는 설계라 `screenToFlowPosition` 호출 자체는 흡수하지 못하고 두 호출부에 그대로 남아 있다. 좌표 변환 로직이 바뀌면 두 곳을 동시에 고쳐야 한다. 직전 2회 리뷰(11_28_30/11_46_01)에서 이미 동일하게 지적되고 "즉시 조치 불요, §1.3 이월"로 이월된 사안으로, 이번 diff에서도 미반영 상태가 유지된다(retrogression 아님, 의도적 defer).
  - 제안: `openNodeSearchPopupAt`이 `clientX`/`clientY`만 받아 내부에서 `screenToFlowPosition`을 호출하도록 확장하면 잔여 중복이 제거된다. §1.3(역방향 드래그) 착수 시 함께 정리 권장.

- **[INFO]** `edge-utils.ts`의 §1.2 전용 헬퍼 5종(`isConnectionDroppedOnPane`/`firstInputHandleId`/`connectionDragSource`/`pointerClientPosition`/`buildAutoConnectConnection`)이 섹션 구분 주석 없이 기존 "연결 유효성" 그룹 뒤에 나열됨
  - 위치: `edge-utils.ts` L116-200 부근
  - 상세: 각 함수는 이름·JSDoc·가드절 모두 명확하지만, 파일이 "포트 판정 → 연결 유효성 → §1.2 자동연결 → 그래프 유틸" 순으로 그룹이 점점 늘어나는데 이를 구분하는 헤더 주석이 없다. §1.3에서 헬퍼가 더 추가되면 파일 탐색 비용이 누적될 수 있다. 직전 2회 리뷰에서 동일 지적, 동일하게 이월 확정.
  - 제안: 새 헬퍼 추가 시 `// --- §1.2 자동 연결 판정/조립 ---` 류의 섹션 헤더 도입 권장. 즉시 조치 불요.

- **[INFO]** `getNodeDefinition(nodeType)` 이중 조회 잔존
  - 위치: `workflow-canvas.tsx` `handleAddNodeFromSearch`(L614)가 `buildAndAddNode`(내부 L569에서 1회 조회) 호출 후 동일 `nodeType`에 대해 `getNodeDefinition`을 재호출해 `buildAutoConnectConnection`에 전달
  - 상세: 전역 Map 조회라 성능 영향은 없으나, 두 협력 함수가 "이 nodeType의 definition"이라는 동일 정보를 각자 재조회하는 암묵적 결합이다. 3회 연속 우선순위 낮음으로 이월된 잔존 이슈.
  - 제안: `buildAndAddNode`가 `{ id, definition }`을 반환하거나 상위에서 1회 조회해 전달하면 결합이 사라진다. 이번 스코프에서 필수 아님.

- **[INFO]** `workflow-canvas.tsx`(978줄)의 다관심사 God Component 성향 지속 — §1.3 착수 시 재검토 예정으로 plan에 명시적 이월
  - 위치: `workflow-canvas.tsx` 전체(컨텍스트 메뉴 3종·검색 팝업·키보드 단축키·DnD·단일 노드 실행·삭제 확인 다이얼로그·undo 등)
  - 상세: 이번 §1.2 구현으로 추가된 `onConnectEnd`/`openNodeSearchPopupAt`/`buildAndAddNode` 반환값 확장은 각각 짧고 단일 책임에 가까워 팝업-오픈 3중 중복을 공용 헬퍼로 흡수한 만큼 순증가는 억제됐다. 근본적 책임 분리(오케스트레이션의 전용 훅 추출)는 `plan/in-progress/spec-sync-edge-gaps.md` §1.3 이월 항목 (a)로 명시적으로 defer 되어 있고, 3회 연속 ai-review에서 동일하게 확인된 사안이다.
  - 제안: 조치 불요(추적됨). §1.3 착수 시 plan에 기록된 대로 재검토.

- **[INFO]** 신규 순수 헬퍼·테스트·`onConnect` 확장은 기존 컨벤션과 일관되고 품질 양호(재확인)
  - 위치: `edge-utils.ts` 5종 헬퍼 + `edge-utils.test.ts`(21케이스), `editor-store.ts` `onConnect(connection, opts?: { skipUndo?: boolean })` + `editor-store.test.ts`(skipUndo 2케이스)
  - 상세: 전부 가드절 기반 얕은 중첩(depth 1~2), 목적이 드러나는 이름, 매직 넘버 없이 순수 함수로 분리돼 기존 `isSelfConnection`/`isDuplicateConnection` 스타일(§참조 JSDoc)을 그대로 따른다. `NodeSearchPopupState.dragSource`는 `Connection.source` 문자열 관례와의 혼동을 피하려 명명 근거 주석까지 남겼다(직전 리뷰 INFO 반영 확인). `onConnect`의 옵션 객체 확장(`opts?`)도 하위 호환을 유지하며 의도가 인라인 주석으로 명확하다.
  - 제안: 없음(현행 유지).

- **[INFO]** spec/plan/CHANGELOG 동기화 상태가 코드와 일치(documentation 관점 참고, 유지보수성 관점에서도 긍정적)
  - 위치: `spec/3-workflow-editor/2-edge.md §1.2`(더 이상 "미구현 · Planned" 아님, "현재 구현" 문단이 실제 구현과 line-level 일치), `CHANGELOG.md`, `plan/in-progress/spec-sync-edge-gaps.md`
  - 상세: 직전 라운드(11_04_21)의 documentation CRITICAL(스펙 stale)·WARNING(CHANGELOG 누락)이 이번 diff에서 모두 반영돼 SoT 문서와 코드가 어긋나지 않는다. 향후 유지보수자가 spec만 보고 오판할 위험이 해소됐다.
  - 제안: 없음.

### 요약
이번 diff는 §1.2 구현과 그에 대한 3회의 ai-review 지적(팝업 오픈 3중 중복, `source` 필드명 혼동, undo 이중 스냅샷, spec/CHANGELOG stale)을 모두 코드·문서로 정확히 반영한 결과물이다. 현재 코드를 직접 열람해 재검증한 결과 실질적 유지보수성 결함은 이미 해소됐고, 신규 헬퍼·콜백은 명확한 네이밍·얕은 중첩·매직 넘버 없는 순수 함수·JSDoc·테스트를 갖춰 기존 `edge-utils.ts`/`editor-store.ts` 컨벤션과 일관된다. 잔존 이슈는 `screenToFlowPosition` 폴백의 2곳 복제, 신규 헬퍼 그룹의 섹션 주석 부재, `getNodeDefinition` 이중 조회, `workflow-canvas.tsx`의 다관심사 팽창 4건이며 전부 3회 연속 동일하게 확인된 경미한 사안으로 plan §1.3 이월 항목으로 이미 추적돼 있어 이번 스코프를 차단할 사유가 아니다.

### 위험도
LOW
