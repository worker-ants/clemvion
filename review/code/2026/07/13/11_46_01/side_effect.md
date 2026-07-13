### 발견사항

- **[INFO]** `onConnectEnd` 신규 배선으로 "드래그 없는 단순 클릭"도 노드 추가 팝업을 열 수 있음
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` `onConnectEnd`(§1.2), `codebase/frontend/src/lib/utils/edge-utils.ts` `isConnectionDroppedOnPane`/`connectionDragSource`
  - 상세: React Flow v12 는 출력 포트에서 mousedown 후 이동 없이 바로 mouseup(사실상 클릭)해도 connection 제스처가 시작·종료된 것으로 간주해 `onConnectEnd` 를 호출하고, 이때 `connectionState.isValid` 는 유효 target 이 없으므로 `true` 가 아니다. `isConnectionDroppedOnPane`/`connectionDragSource` 는 "빈 영역 드롭"과 "포트 위에서의 무의미한 클릭"을 구분하지 않으므로, 사용자가 출력 포트를 드래그할 의도 없이 실수로 클릭만 해도 그 포트 좌표에 노드 검색 팝업이 열린다. 이전 리뷰 라운드(2026-07-13 11:04/11:28)는 이 헬퍼를 "React Flow 공식 예제와 동일한 패턴"이라는 이유로 안전하다고 판단했으나, 그 판단은 "무효 target 드롭"과 "동일 클릭" 케이스를 구분하지 않았다 — 이번 diff 가 `onConnectEnd` 를 실제로 `<ReactFlow>` 에 배선하기 전까지는 클릭 한 번으로 팝업이 뜨는 부작용 자체가 존재하지 않았으므로, 이는 이 PR 이 새로 도입한 이벤트/콜백 부작용이다.
  - 제안: 실제 사용성에 큰 문제가 아닐 수 있으나(팝업은 Escape 로 쉽게 닫힘, 데이터 손상 없음), 의도치 않은 팝업 소음이 QA 에서 보고되면 `connectionState` 의 드래그 거리/이동량을 함께 검사하거나 React Flow 의 `onConnectStart` 시각과 비교하는 최소 임계값 가드를 고려할 것.

- **[INFO]** undo 스택 이중 push 는 여전히 잔존 — CHANGELOG/spec 의 "단일 pushUndo" 서술은 근사치
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` `buildAndAddNode`(자체 `pushUndo()` 호출) → `codebase/frontend/src/lib/stores/editor-store.ts` `addNode`(내부에서 `get().pushUndo()` 재호출, L747)
  - 상세: `buildAndAddNode` 는 노드 생성 직전 `pushUndo()` 를 명시적으로 호출하는데, 바로 이어서 부르는 store `addNode` 액션 자체도 내부에서 다시 `get().pushUndo()` 를 실행한다(이 이중 push 는 본 diff 이전부터 존재하는 pre-existing 패턴이며 §1.2 가 만든 것은 아니다). §1.2 자동 연결 경로에서 `onConnect(connection, { skipUndo: true })` 로 세 번째 push 만 정확히 막았을 뿐, 두 번째 push(둘 다 노드 생성 전 동일 스냅샷이라 값은 같음)는 여전히 undoStack 에 중복 항목으로 남는다. 실제 사용자 체감(Ctrl+Z 1회 = 노드+엣지 함께 취소)은 두 스냅샷이 동일 상태라 정상 동작하지만, undoStack 슬롯 하나가 낭비되어 그 다음 Ctrl+Z 가 눈에 보이는 변화 없는 no-op 이 된다. CHANGELOG("`buildAndAddNode` 의 단일 pushUndo 만 체크포인트가 되게 했다")와 spec §1.2 각주의 "단일 pushUndo" 서술은 이 잔존 이중 push 를 반영하지 못해 근사치에 가깝다.
  - 제안: 이번 PR 스코프 밖(이미 두 차례 ai-review 라운드에서 pre-existing 으로 분류·이월됨)이므로 신규 조치 요구는 아니나, CHANGELOG/spec 서술을 "buildAndAddNode 경로의 pushUndo(들)만 체크포인트가 되게 했다" 정도로 표현을 낮추거나, `buildAndAddNode`/`addNode` 의 이중 push 자체를 별도 hygiene 백로그로 명시해 두는 편이 정확하다.

- **[INFO]** `onConnect` 시그니처 확장(`opts?: { skipUndo?: boolean }`)은 기존 호출자에 영향 없음 — 검증 완료
  - 위치: `codebase/frontend/src/lib/stores/editor-store.ts` `EditorState.onConnect`, 소비처 `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx:759`(`onConnect={onConnect}`, ReactFlow 에 단항으로 전달), `codebase/frontend/src/lib/stores/editor-store.ts:1084`(`assistant add_edge` 툴 액션, `s.onConnect({...})` 단항 호출)
  - 상세: 신규 파라미터가 선택적(optional)이라 위 두 기존 호출부 모두 `opts` 를 넘기지 않고, `!opts?.skipUndo` 가 `undefined` 에 대해 `true` 로 평가되어 기존과 동일하게 매 호출마다 `pushUndo()` 가 실행된다 — 행동 변화 없음. `<ReactFlow onConnect={onConnect}>` 처럼 함수를 그대로 넘기는 지점도 TS 구조적 타이핑상 문제없다(narrower 인자 개수의 콜백에 더 넓은(선택적 파라미터 추가) 함수를 대입 가능). `grep` 결과 이 스토어 액션의 다른 소비처는 없음(공개 API export 아님, 컴포넌트 내부 훅 소비로 한정).
  - 제안: 없음(회귀 없음 확인).

- **[INFO]** 신규 순수 헬퍼(`connectionDragSource`/`pointerClientPosition`/`buildAutoConnectConnection`/`firstInputHandleId`/`isConnectionDroppedOnPane`)는 전역 상태·DOM·네트워크·파일시스템·환경변수에 접근하지 않는 순수 함수
  - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts` (신규 export)
  - 상세: 모두 인자로 받은 값만으로 결과를 계산하며 module-level mutable 상태를 두지 않는다. `buildAndAddNode` 반환 타입 변경(`void`→`string|undefined`)도 컴포넌트 내부 `useCallback` 으로만 소비되어 모듈 경계 밖 영향이 없다(기존 두 호출자는 반환값을 무시할 뿐 타입/런타임 오류 없음).
  - 제안: 없음.

- **[INFO]** `review/code/2026/07/13/{11_04_21,11_28_30}/*` 리포트·`RESOLUTION.md`·`meta.json` 신규 커밋은 파일시스템 부작용이 아니라 저장소 관례상 정상 아티팩트
  - 위치: `review/code/2026/07/13/11_04_21/*`, `review/code/2026/07/13/11_28_30/*` (전부 new file)
  - 상세: 이 저장소는 `review/` 디렉터리를 gitignore 하지 않고 SUMMARY/RESOLUTION 을 감사 추적용으로 커밋하는 확립된 관례가 있다(코드 변경이 아닌 문서 아티팩트). 예기치 못한 파일 생성이 아니라 의도된 프로세스 산출물이다.
  - 제안: 없음.

- **[INFO]** CHANGELOG/spec(`2-edge.md`)/mdx 4개 문서 변경은 순수 텍스트 편집 — 실행 부작용 없음
  - 위치: `CHANGELOG.md`, `spec/3-workflow-editor/2-edge.md`, `codebase/frontend/src/content/docs/03-workflow-editor/{canvas-basics,connecting-nodes}.{mdx,en.mdx}`
  - 상세: 전부 문서 텍스트만 바뀌었고 코드 실행 경로·빌드 산출물에 영향을 주는 변경(예: mdx 상단 frontmatter 의 `code:` 배열 변경 등)은 없다.
  - 제안: 없음.

### 요약
이번 diff(§1.2 출력 포트 드래그 → 빈 영역 드롭 자동 노드 추가+연결)의 실질 부작용 표면은 이미 두 차례의 ai-review 라운드(11_04_21 CRITICAL/WARNING, 11_28_30 WARNING)를 거치며 대부분 해소되었다 — undo 스냅샷 3중 push 문제는 `onConnect` 의 `skipUndo` 옵션으로 실질적으로 정리되었고, 신규 순수 헬퍼는 전역/파일시스템/네트워크/환경변수에 무관하며, `onConnect` 시그니처 확장은 선택적 파라미터라 기존 두 호출부(ReactFlow 배선, assistant `add_edge` 툴) 모두 회귀 없이 동작함을 직접 확인했다. 독자적으로 발견한 잔여 사항은 두 가지 INFO 수준 관찰이다: (1) `onConnectEnd` 를 실제로 배선하면서 "드래그 없는 단순 클릭"도 무효 연결로 처리돼 팝업을 열 수 있는 새 이벤트/콜백 부작용이 생겼고, (2) `buildAndAddNode`(자체 pushUndo) → store `addNode`(내부 pushUndo) 의 pre-existing 이중 push 가 여전히 남아 있어 CHANGELOG/spec 의 "단일 pushUndo" 서술이 근사치에 그친다(사용자 체감상 Ctrl+Z 1회 취소는 정상 동작하나 스택 슬롯 하나가 낭비됨). 둘 다 데이터 유실이나 상태 오손으로 이어지지 않는 경미한 사항이라 차단 사유는 아니다.

### 위험도
LOW
