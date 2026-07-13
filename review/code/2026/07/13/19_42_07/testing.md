### 발견사항

- **[INFO]** 이번 라운드 diff 는 코드/테스트 변경을 포함하지 않음 — §4.1 실제 구현·테스트는 이전 라운드에서 이미 검증 완료
  - 위치: 본 세션 `prompt_file` 대상 10개 파일 전부 — `review/code/2026/07/13/19_18_01/user_guide_sync.md`, `review/consistency/2026/07/13/18_06_53/*`(SUMMARY·_retry_state.json·convention_compliance·cross_spec·meta.json·naming_collision·plan_coherence·rationale_continuity), `spec/3-workflow-editor/2-edge.md`
  - 상세: 이번 changeset 의 실제 소스(`codebase/frontend/src/lib/utils/edge-utils.ts`, `.../stores/editor-store.ts`, `.../canvas/workflow-canvas.tsx`)와 그 테스트(`edge-utils.test.ts`, `editor-store.test.ts`)는 3회에 걸친 이전 ai-review 라운드(`18_32_28`→CRITICAL 수정, `19_18_01`→undo phantom 발견, 그 수정이 `ad5fa3388`)에서 이미 리뷰·수정·재검증됐고, 이번 라운드(`19_42_07`)의 diff 는 그 결과물(리뷰 산출물 md/json)과 spec 문서 텍스트(§4.1 신설·R-3 Rationale)만 담고 있다. 테스트 존재 여부·커버리지 판단을 이 diff 만으로는 할 수 없어, 직접 파일시스템으로 실제 소스·테스트를 재확인했다(아래 항목들).
  - 제안: 조치 불요 — 아래는 그 직접 확인 결과.

- **[INFO/양호]** spec §4.1·R-3 Rationale 이 언급하는 테스트 주장을 소스 대조로 검증 — 정확함
  - 위치: `spec/3-workflow-editor/2-edge.md` R-3 마지막 문단("store 시퀀스... 통합 테스트로 lock") ↔ `codebase/frontend/src/lib/stores/__tests__/editor-store.test.ts:392-417`
  - 상세: 해당 테스트는 `addNode(N)` → `removeEdge("A-B",{skipUndo:true})` → `onConnect(A→N,{skipUndo:true})` → `onConnect(N→B,{skipUndo:true})` 시퀀스 후 `undoStack` 이 정확히 길이 1(phantom 없음)임을 단언하고, 이어서 `undo()` 호출 후 `undoStack` 길이 0 + `nodes=[A,B]`(새 노드 제거) + `edges=[A-B]`(원본 엣지 복원)까지 왕복 검증한다 — spec 문구와 실제 assertion 이 정확히 일치하는 non-vacuous 회귀 테스트다. `buildEdgeSplitPlan`/`firstOutputHandleId`/`isContainerBoundaryEdge`/`findEdgeIdAtPoint` 각각의 pure-function 단위 테스트(`edge-utils.test.ts:421-586`)도 예약 `emit` 포트 제외, 컨테이너 경계(`body`/`emit`) 제외 vs `done` 예외, 컨테이너 신규 노드 제외(CRITICAL 회귀 가드), 다중 출력 노드의 첫 포트만 연결 등 §4.1 본문이 서술하는 모든 분기를 빠짐없이 커버한다. 커밋 메시지가 주장하는 "157 tests"(edge-utils 91 + editor-store 66)도 `grep -c "it("` 로 직접 재확인해 일치.

- **[INFO]** `onDrop`(workflow-canvas.tsx) 자체의 DOM 배선 통합 테스트 부재 — 기존에 이미 합의·이월된 사항, 재확인만
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx:709-746` (`onDrop` 콜백 — `findEdgeIdAtPoint` hit-test → `buildAndAddNode` → `buildEdgeSplitPlan` → `removeEdge`/`onConnect`×2 오케스트레이션)
  - 상세: `editor-store.test.ts` 의 "엣지 분할 store 시퀀스" 테스트는 이 시퀀스를 store API 호출로 **수동 재현**할 뿐, 실제 `onDrop` 콜백을 한 번도 호출하지 않는다. `workflow-canvas.tsx` 에는 대응하는 컴포넌트 테스트 파일이 없다(`__tests__/` 하위에 `use-edge-reconnect.test.ts`·`use-edge-hover-preview.test.ts` 등 훅 단위 테스트는 있으나 `onDrop` 로직은 훅으로 분리되지 않고 컴포넌트 본문에 남아 있다). 따라서 실제 드래그앤드롭 이벤트가 올바른 인자로 헬퍼들을 호출하는지는 unit/integration 어느 층에서도 검증되지 않고, e2e 스펙도 없음을 확인했다(`elementFromPoint` DOM hit-test 는 헤드리스 e2e 에서도 재현이 까다로움). 다만 이는 `RESOLUTION.md`(18_59_13 #2, "canvas RTL 하네스 부재로 이월(비차단)")와 직전 라운드(`19_18_01/testing.md`)가 이미 명시적으로 합의·이월한 기존 부채이며 이번 diff 로 새로 생긴 갭이 아니다.
  - 제안: 조치 불요(기존 합의 유지). canvas RTL 하네스가 마련되면 `onDrop` 의 hit-test→split-plan→store-mutation 오케스트레이션도 함께 커버할 것.

- **[INFO]** 동일 phantom-undo 결함 클래스가 "노드 복제"(우클릭 컨텍스트 메뉴) 경로에도 잔존 — 2회 연속(19_18_01, 이번 라운드) 재확인, 여전히 미추적
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` `handleNodeMenuAction` `case "duplicate"`(대략 449-473행) — `pushUndo()` 명시 호출 직후 `addNode(newNode)` 호출(단, `addNode` 내부(`editor-store.ts:836`)가 `get().pushUndo()` 를 무조건 재호출해 동일 패턴의 이중 `pushUndo` → phantom undo 스냅샷 1개 추가 발생)
  - 상세: 이번 PR 이 §4.1(`buildAndAddNode`)에서 고친 것과 **완전히 동일한 근본 원인**(호출부 명시적 `pushUndo()` + `addNode` 내부 `pushUndo()` 중복)이 이 별도 호출부에는 그대로 남아 있다. `duplicateSelection`(Ctrl+D, store action, `editor-store.ts:924`)은 `addNode` 를 우회해 자체 `pushUndo()` 하나만 쓰므로 이 결함이 없고, 그에 맞는 테스트(`editor-store.test.ts:1041` 등)도 존재한다 — 반면 컨텍스트 메뉴 "복제"는 `addNode` 를 경유하면서도 별도 `pushUndo()` 를 추가로 호출해 여전히 이중 스냅샷을 남긴다. 이 사실은 `19_18_01/testing.md` 에서 이미 한 차례 발견·기록됐고("workflow-canvas.tsx:451 에도 있어 이 PR 이 만든 결함이 아니라 선재 특성... 별도 이슈로 후속 조치 고려") 이번 PR(`ad5fa3388`)의 실제 수정 범위는 `buildAndAddNode` 하나로 한정돼 이 경로는 여전히 미수정·무테스트 상태다. `git log -L` 로 추적한 결과 이 코드 자체는 이번 edge-mid-insert 작업 이전부터 존재하던 선재 결함이라, 이번 diff 의 새 결함은 아니다.
  - 제안: 이 changeset 범위 밖이지만, 동일 근본원인이 이미 2회 연속 리뷰에서 재확인됐음에도 별도 backlog 항목으로 전환되지 않고 있다. developer 가 별도 plan/이슈로 등록해 (1) `handleNodeMenuAction` "duplicate" 의 중복 `pushUndo()` 제거 (2) "우클릭 복제 → undo 1회 → 완전 복원" 회귀 테스트 추가를 함께 처리할 것을 권고. `addNode` 를 호출하면서 그 앞에서 별도 `pushUndo()` 를 부르는 다른 호출부가 더 있는지(`grep -n "pushUndo()" workflow-canvas.tsx` 전수) 감사해 이 anti-pattern 클래스 전체를 한 번에 정리하는 편이 재발을 막는다.

- **[INFO]** `buildEdgeSplitPlan(edge, newNodeId, null|undefined)` 최상위 방어 분기 직접 단위 테스트 부재 — 기존 낮은 우선순위 판단 유지
  - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts` `buildEdgeSplitPlan` — `definition` 이 `null`/`undefined` 로 호출되는 경우(`firstInputHandleId`/`firstOutputHandleId` 양쪽 다 이미 null-safe 하므로 결과적으로 null 반환은 되나, 그 조합을 직접 단언하는 테스트는 없음)
  - 상세: 실사용 경로(`onDrop` → `getNodeDefinition(nodeType)` → `buildAndAddNode` 가 이미 `!definition` 이면 조기 반환)에서는 `buildEdgeSplitPlan` 에 `definition` 이 null 로 도달할 일이 없어 실질 리스크는 낮다. 2회차 리뷰(INFO)에서도 동일 판단으로 비차단 처리됐고 이번 라운드에도 미반영이나, 그 판단 자체는 여전히 유효.
  - 제안: 조치 불요(비차단). 여유 있을 때 방어적 회귀 가드로 1건 추가 권장.

- **[INFO/양호]** Mock 적절성·테스트 격리
  - 위치: `edge-utils.test.ts` `findEdgeIdAtPoint` 테스트의 `fakeDoc` 스텁, `editor-store.test.ts` 전역 `beforeEach`
  - 상세: `fakeDoc` 은 실제 사용되는 `Document` API surface(`elementFromPoint`→`closest`→`getAttribute`)만 정확히 흉내 내는 최소 스텁으로 과도한 mock 이 아니다. `editor-store.test.ts` 는 실제 Zustand store(`useEditorStore.setState`/`getState()`)를 그대로 구동해(스토어 자체를 mock 하지 않음) 실동작에 가까운 통합 테스트이며, `beforeEach` 로 매 테스트 전 상태를 리셋해 테스트 간 순서 의존성이 없다.

### 요약

이번 라운드(`19_42_07`)의 diff 자체는 리뷰 산출물(md/json)과 spec 문서 텍스트만 포함해 신규 코드·테스트 변경이 없다. 다만 이 diff 가 서술·전제하는 §4.1 엣지 분할 구현과 그 테스트를 직접 파일시스템으로 재확인한 결과, `buildEdgeSplitPlan`/`firstOutputHandleId`/`isContainerBoundaryEdge`/`findEdgeIdAtPoint` 순수 헬퍼는 §4.1 이 서술하는 모든 분기(예약 포트 제외, 컨테이너 경계 제외 vs `done` 예외, 컨테이너 신규 노드 제외, 다중 출력 첫 포트 연결)를 빠짐없이 단위 테스트하고, R-3 Rationale 이 주장하는 "undo 1회 → undoStack 0 + 완전 복원" 통합 테스트도 정확히 소스와 일치해 vacuous 하지 않다. 유일하게 남은 갭인 `onDrop` 콜백 자체의 DOM 배선 미검증은 canvas RTL 하네스 부재로 이미 명시 합의·이월된 기존 부채라 이번 변경으로 새로 생긴 결함이 아니다. 다만 §4.1 이 고친 것과 동일한 근본원인(호출부 `pushUndo()` + `addNode` 내부 `pushUndo()` 중복)의 sibling 결함이 "노드 복제"(우클릭 컨텍스트 메뉴) 경로에 여전히 남아 있고, 이는 2회 연속 리뷰에서 재확인됐음에도 아직 별도 backlog 로 전환되지 않아 재차 상기해 둔다. 신규 CRITICAL/WARNING 은 없다.

### 위험도

NONE
