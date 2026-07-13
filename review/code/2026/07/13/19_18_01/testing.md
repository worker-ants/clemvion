# 테스트(Testing) Review — edge-mid-insert (§4.1 엣지 분할, 3회차)

이 changeset 은 1회차(`18_32_28`, CRITICAL 1건: 컨테이너 새 노드 body 재편입)·2회차(`18_59_13`, WARNING: onDrop 통합 배선 미검증 + 컨테이너 body 내부 체인 분할 containerId 전파 미검증) 리뷰와 그 RESOLUTION 반영분을 포함한다. 이번 라운드에서 실제로 추가된 테스트(`editor-store.test.ts` "엣지 분할 store 시퀀스 (§4.1)" describe 2건)를 코드 추적 + 로컬 실행(`npx vitest run edge-utils.test.ts editor-store.test.ts` → **156 passed**)으로 재검증하고, 남은 갭을 자체 구성한 검증 테스트로 실측했다.

## 발견사항

- **[WARNING]** "Ctrl+Z 1회에 삽입 전체가 취소된다" 는 이번 PR 의 핵심 UX 계약이 `undo()` 를 실제로 호출하는 테스트로 한 번도 검증되지 않았고, 검증해보니 `buildAndAddNode` 가 이중으로 `pushUndo()` 를 호출해 undoStack 에 중복 스냅샷이 남는다
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx:620`(`pushUndo()` 명시 호출) → 같은 함수 내 `:627` `addNode({...})` 호출 → `codebase/frontend/src/lib/stores/editor-store.ts:830-831`(`addNode: (node) => { get().pushUndo(); ... }`, `addNode` 자체가 이미 내부에서 `pushUndo()` 를 실행). `onDrop` 의 새 인라인 주석(`workflow-canvas.tsx:724`, "buildAndAddNode 가 pushUndo 로 **단일** 체크포인트를 남기므로 이후 엣지 수술은 skipUndo 로 접는다")이 바로 이 가정에 의존한다.
  - 상세: `editor-store.test.ts` 의 신규 "엣지 분할 store 시퀀스 (§4.1)" 두 테스트는 `removeEdge(skipUndo)`→`onConnect(skipUndo)`×2 이후의 **최종 nodes/edges 상태**만 검증하고, `pushUndo()`/`undo()` 는 전혀 호출하지 않는다. 실제 `onDrop` 흐름(= `buildAndAddNode` 호출 → 명시적 `pushUndo()` 1회 + `addNode` 내부 `pushUndo()` 1회 → 이어서 skipUndo 엣지 수술 3회)을 store API 만으로 재현해(DOM/컴포넌트 불필요, canvas RTL 하네스 무관) 직접 실행한 결과, `undoStack` 에 **동일한 스냅샷이 2개** 쌓인다(둘 다 "노드 추가 전" 상태를 가리킴 — 그 사이에 `set()` 을 호출하는 코드가 없어 내용이 완전히 동일). 첫 Ctrl+Z(`undo()` 1회)는 육안상 정확히 "삽입 전 그래프"(원본 엣지 A→B, N 없음)로 되돌아가 PR 이 광고하는 1차 동작 자체는 맞았다 — 하지만 `undoStack` 에 identical 스냅샷 1개가 그대로 남아, 그 뒤에 이어질 수 있는 **다른 실제 편집**의 undo 체크포인트를 가리는 "유령(phantom)" slot 으로 남는다. 즉 이 삽입 동작 하나가 undo 스택을 2칸 소비하며(`MAX_UNDO=50` cap 도 절반 속도로 회전), 삽입 직후 사용자가 Ctrl+Z 를 두 번 누르면 두 번째는 (겉보기엔 아무 변화 없는) no-op 이 되고, 세 번째 눌러야 비로소 그 이전 편집이 취소된다 — "1회로 전체 취소" 광고와 어긋나는 잠재적 혼란이다. 같은 패턴(명시적 `pushUndo()` + 내부에서도 `pushUndo()` 를 호출하는 `addNode()` 병용)이 `workflow-canvas.tsx:451`("노드 복제") 에도 있어 이 PR 이 만든 결함이 아니라 `buildAndAddNode`/`addNode` 조합의 선재(pre-existing) 특성이지만, 이번 PR 이 그 특성을 새 경로(엣지 드롭 분할)로 확장하면서 "단일 체크포인트"를 코드 주석으로 명문화하고 관련 통합 테스트까지 새로 추가한 시점에도 여전히 `undo()` 를 호출하는 회귀 테스트가 없어 이 불일치가 조용히 남았다. (검증 방법: 이 changeset 의 실제 `editor-store.ts`/`workflow-canvas.tsx` 소스에 대해 store API 만으로 `pushUndo()`→`addNode()`→`removeEdge(skipUndo)`→`onConnect(skipUndo)`×2→`undo()` 시퀀스를 재현하는 임시 테스트를 스크래치 파일로 작성·실행해 확인했으며, 리뷰 종료 후 그 스크래치 파일은 삭제해 저장소에 남기지 않았다.)
  - 제안: (1) `editor-store.test.ts` 의 "엣지 분할 store 시퀀스" describe 에 `pushUndo()` → `addNode(N)` → `removeEdge(skipUndo)` → `onConnect(skipUndo)`×2 → `undo()` 전체 왕복을 재현해 "undo 이후 nodes=[A,B], edges=[A→B], **undoStack 은 정확히 0**" 을 고정하는 통합 테스트 1건을 추가할 것 — canvas 하네스 없이 store 만으로 가능하며, 이 assertion 이 있었다면 이번 발견은 red 로 드러났을 것이다. (2) 근본 원인(`buildAndAddNode`/"노드 복제" 의 중복 `pushUndo()`)은 이 diff 범위 밖이지만, `addNode` 가 이미 내부에서 `pushUndo()` 를 호출하므로 호출부의 명시적 `pushUndo()` 를 제거하는 편이 더 정확하다 — 별도 이슈로 후속 조치 고려.

- **[INFO]** `onDrop` 의 DOM/배선 통합 자체(hit-test 결과 → `edges.find` → `buildEdgeSplitPlan` 호출 → `removeEdge`/`onConnect` 시퀀스)는 여전히 어떤 자동 테스트로도 실행되지 않는다 — 1·2회차에서 이미 지적·이월된 항목으로 이번 라운드도 확대되지 않았다
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx:715-738`
  - 상세: `RESOLUTION.md`(18_59_13, #2) 가 "canvas RTL 하네스 부재로 이월(비차단)"이라 명시적으로 합의한 기존 부채다. 이번 diff 에 canvas 컴포넌트 테스트가 새로 추가되지 않았으나 그 결정 자체가 바뀐 것은 아니므로 새 결함으로 보지 않는다. 위 WARNING 항목(undo 왕복)과 달리 이건 실제로 DOM/컴포넌트 환경이 필요해 store 레벨로 대체 검증하기 어렵다.
  - 제안: 조치 불요(기존 합의 유지). 향후 canvas RTL 하네스가 마련되면 이 경로도 함께 커버할 것.

- **[INFO/양호]** 신규 store 통합 테스트 2건은 실제 store 구현(`propagateContainerOnConnect` Rule 3 chain propagation, `deriveContainerAssignments` 전역 재도출)을 정확히 따라가는 vacuous 하지 않은 테스트다
  - 위치: `codebase/frontend/src/lib/stores/__tests__/editor-store.test.ts` "엣지 분할 store 시퀀스 (§4.1)"
  - 상세: 소스 추적 결과 "Loop body 내부 체인" 테스트는 `removeEdge("A-B")` 가 `deriveContainerAssignments` 로 A/B 의 `containerId` 를 body/emit 앵커 엣지로부터 재도출(둘 다 `L` 유지)한 뒤, 첫 `onConnect(A→N)` 이 `propagateContainerOnConnect` Rule 3("한쪽만 컨테이너 소속이면 그 id 를 전파")을 태워 **N 이 이 시점에 이미 `containerId=L` 을 상속**하고, 두 번째 `onConnect(N→B)` 는 변화 없음을 확인했다(직접 로컬 재실행으로 156 passed 확인). 2회차 WARNING(#3)이 지적한 실질 리스크를 정확히 잠그는 유효한 회귀 테스트다.

- **[INFO]** 2회차 INFO("`buildEdgeSplitPlan(edge, id, null/undefined)` 최상위 방어 분기 직접 테스트 부재")는 이번 라운드에도 미반영 — 우선순위 낮음, 실사용 경로에서 도달 불가라는 기존 판단 유효
  - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts` `buildEdgeSplitPlan`
  - 상세: 조치하지 않아도 차단 사유 아님(기존 라운드 판단과 동일). 참고용 재확인.

## 회귀 확인 (참고)
`npx vitest run src/lib/utils/__tests__/edge-utils.test.ts src/lib/stores/__tests__/editor-store.test.ts` 로컬 재실행 결과 2 test files / **156 passed**, RESOLUTION.md 서술과 일치. 기존 `removeEdge` 기본 동작(옵션 미지정 시 `pushUndo`)·`onConnect` 관련 회귀 테스트도 그대로 유지되어 시그니처 확장이 하위 호환을 깨지 않았음을 재확인했다.

## 요약

1·2회차에서 발견된 CRITICAL(컨테이너 새 노드 body 재편입)과 WARNING(store 분할 시퀀스·containerId 전파 미검증)은 이번 라운드의 신규 통합 테스트 2건으로 실질적으로 잘 해소되어 있고, 코드 추적과 로컬 재실행(156 passed)으로 vacuous 하지 않음을 확인했다. 다만 이번 PR 이 광고·주석("단일 체크포인트")·부분적으로 테스트하는 "Ctrl+Z 1회 전체 취소" 계약을 실제로 `undo()` 까지 호출해 왕복 검증하는 테스트가 없다는 점을 파고들어 직접 재현한 결과, `buildAndAddNode` 의 명시적 `pushUndo()` 와 `addNode` 내부의 `pushUndo()` 가 중복 호출되어 삽입 1회가 undoStack 을 2칸 소비하는 것을 확인했다 — 1차 Ctrl+Z 의 가시적 결과는 광고대로 정확하지만, 유령 스냅샷이 남아 후속 Ctrl+Z 가 예기치 않게 no-op 될 수 있는 잠재 UX 결함이며 canvas 하네스 없이도(store API 만으로) 테스트 가능했던 지점이라 놓친 것이 아쉽다. onDrop 자체의 DOM 배선 미검증은 기존에 이미 합의·이월된 사항이라 이번 라운드 신규 이슈로 보지 않는다.

## 위험도
MEDIUM
