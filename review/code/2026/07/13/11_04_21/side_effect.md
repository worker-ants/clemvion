### 발견사항

- **[WARNING] 자동 연결 플로우가 단일 사용자 제스처에 대해 undo 스냅샷을 중복/분할 push**
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` `handleAddNodeFromSearch`(L771-793)가 호출하는 `buildAndAddNode`(L735-768) → `addNode`, 그리고 새로 추가된 `onConnect(...)` 호출. store 쪽은 `codebase/frontend/src/lib/stores/editor-store.ts` `addNode`(L745-756, 내부에서 `get().pushUndo()`)와 `onConnect`(L700-737, L721 `get().pushUndo()`).
  - 상세: `buildAndAddNode` 는 자체적으로 `pushUndo()` 를 호출한 뒤 store 의 `addNode` 액션을 호출하는데, `addNode` 자체도 내부에서 다시 `get().pushUndo()` 를 실행한다(이 이중 push 는 diff 이전부터 존재하는 코드로 이번 변경이 만든 것은 아님). 이번 diff 로 새로 추가된 `handleAddNodeFromSearch` 의 `onConnect({...})` 호출도 내부에서 한 번 더 `get().pushUndo()` 를 실행한다(editor-store.ts L721). 그 결과 "출력 포트에서 드래그 → 빈 영역 드롭 → 팝업에서 노드 선택"이라는, 사용자 입장에서는 하나의 제스처가 undoStack 에 최소 2회(기존 이중 push 까지 합치면 최대 3회)의 스냅샷을 남긴다. 코드베이스 자체 관례(editor-store.ts L1031-1034 주석 — "Push undo once for the whole patch so Ctrl+Z reverts every field at the same time (matches manual UI edits...)")와 어긋나며, Ctrl+Z 1회를 누르면 방금 만든 자동 연결 엣지만 사라지고 고아 노드가 캔버스에 남는 상태가 된다. 동일 스냅샷이 중복 push 되는 기존 결함과 겹치면 연속 undo/redo 시 중간 상태를 건너뛰는(redoStack 왜곡) 사용자 혼란으로 이어질 수 있다.
  - 제안: 자동 연결까지 포함한 "노드 생성+연결"을 하나의 pushUndo 체크포인트로 묶는 전용 store 액션(예: `addNodeWithConnection`)을 추가하거나, `onConnect` 를 pushUndo 없이 엣지만 삽입하는 내부 헬퍼로 재사용하도록 리팩터할 것. 최소한 "드래그-드롭 자동연결 후 Ctrl+Z 1회" 시나리오를 QA 체크리스트에 추가해 실제 영향(고아 노드 잔존 여부)을 확인 권장.

- **[INFO] `onConnectEnd` 분기와 향후 §1.3(입력 포트 역방향 연결/기존 엣지 재연결) 구현 시 상호작용 우려**
  - 위치: `workflow-canvas.tsx` L503-523 `onConnectEnd`
  - 상세: 현재는 `onReconnect`/`reconnectable` 이 전혀 배선되어 있지 않아(grep 결과 없음) 기존 엣지의 끝점을 잡아 재연결하는 상호작용 자체가 발생하지 않는다. 다만 React Flow v12 는 엣지 재연결도 동일한 connect 파이프라인(`connectionState.fromNode/fromHandle`)을 통해 진행되므로, plan(`plan/in-progress/spec-sync-edge-gaps.md`)의 §1.3 항목 구현 시 `onReconnect`/`reconnectable` 을 켜면 "기존 엣지의 source 쪽을 잡아 빈 영역에 드롭"하는 제스처가 이번에 추가된 `fromHandle.type === 'source'` 분기를 그대로 타면서, 사용자가 단순히 "연결 해제"를 의도했음에도 신규 노드 생성+자동연결 팝업이 열릴 위험이 있다. 지금 시점에서는 재현 불가능(기능 미배선)하므로 정보성으로만 기록.
  - 제안: §1.3 구현 착수 시 `connectionState` 가 "기존 엣지 detach" 와 "신규 드래그"를 구분할 수 있는지 확인하고 필요하면 `onConnectEnd` 에 재연결 제외 가드를 추가.

- **[INFO] `buildAndAddNode` 반환 타입 변경(`void` → `string | undefined`)은 외부 영향 없음**
  - 위치: `workflow-canvas.tsx` L100-134
  - 상세: 컴포넌트 내부 `useCallback` 으로 모듈 밖에 export 되지 않는다. 반환값을 쓰지 않는 기존 호출자(`handleAddNodeAtCenter` L797-815, `onDrop` L834-847)는 값을 무시할 뿐 타입 오류나 런타임 동작 변화가 없다. 공개 API·모듈 export·다른 컴포넌트에 대한 시그니처 영향 없음(리뷰 관점 4/5 해당 없음).

- **[INFO] 신규 순수 함수 `isConnectionDroppedOnPane`/`firstInputHandleId` 는 부작용 없음**
  - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts` L113-137 부근 신설 export
  - 상세: 둘 다 인자만으로 값을 계산하는 순수 함수이며 전역 상태·DOM·네트워크·파일시스템·환경변수에 접근하지 않는다. `edge-utils.test.ts` 신규 테스트도 순수 입출력만 검증(고정 리터럴 인자, 공유 스토어 미사용)하므로 테스트 간 상태 오염 위험도 없다.

- **[INFO] `onConnectEnd` 를 `<ReactFlow>` 에 신규 배선 — 기존 핸들러와 충돌 없음**
  - 위치: `workflow-canvas.tsx` L169 `onConnectEnd={onConnectEnd}` 추가, `nodeContextMenu`/`canvasContextMenu` 를 `null` 로 리셋하는 패턴은 `onPaneClick`/`onPaneContextMenu` 와 동일한 기존 관례를 따른다. 유효 연결(`isValid===true`)은 `isConnectionDroppedOnPane` 이 false 를 반환해 조기 return 하므로 React Flow 의 기존 `onConnect` 처리 경로와 이중 실행되지 않는다. `useCallback` 의존성 배열이 `[]` 인 것도 참조되는 값이 ref(`reactFlowInstance`)와 stable state setter 뿐이라 stale-closure 문제 없음(기존 `onPaneClick` 등과 동일 패턴).

### 요약
이번 변경은 React Flow `onConnectEnd` 배선과 `buildAndAddNode`/`handleAddNodeFromSearch` 확장으로 "출력 포트 드래그 → 빈 영역 드롭 → 팝업에서 노드 선택 → 자동 연결" 플로우(§1.2)를 추가한다. 새 로직은 컴포넌트 로컬 state(팝업/컨텍스트메뉴)와 editor-store 의 기존 `addNode`/`onConnect` 액션만 사용하며, 전역 변수·환경변수·네트워크·파일시스템 부작용은 없고 시그니처·공개 API 변경도 외부에 영향이 없어 그 자체로는 안전하다. 다만 새로 추가된 `onConnect(...)` 호출이 (기존에도 이중 push 되던) undo 스택에 pushUndo 를 한 번 더 얹어, 사용자가 하나의 제스처로 인지하는 "노드 생성+자동연결"이 Ctrl+Z 여러 번을 요구하고 고아 노드를 남기는 상태 불일치를 만든다 — 데이터 유실은 아니지만 이 PR 이 구현하는 기능 자체의 undo/redo 예측 가능성을 해치는 부작용이라 WARNING 으로 표기했다. 그 외에는 향후 §1.3(재연결) 구현 시 동일 `onConnectEnd` 분기가 재사용되며 생길 수 있는 상호작용을 미리 점검해두면 좋겠다는 참고 사항 정도다.

### 위험도
MEDIUM
