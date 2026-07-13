# 부작용(Side Effect) Review

## 발견사항

- **[CRITICAL]** 컨테이너 타입 노드(Loop/ForEach/Map)를 엣지 위에 드롭하면 대상(target) 노드가 의도치 않게 새 컨테이너의 "body child" 로 재편입되거나, 분할이 중간에 실패해 그래프가 깨진 상태로 남는다
  - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts` `firstOutputHandleId`/`buildEdgeSplitPlan`, `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` `onDrop`(L707-741), 참고 `codebase/backend/src/nodes/logic/{loop,foreach,map}.schema.ts`
  - 상세:
    - `Loop`/`ForEach`/`Map` 노드 정의의 `outputs` 는 `[{id:'body'}, {id:'done'}]` 순서다(backend schema 확인). `firstOutputHandleId(definition)` 은 `outputs?.[0]?.id` 를 그대로 반환하므로, 이 세 컨테이너 타입 노드를 새로 삽입하면 `firstOutputHandleId` 가 항상 `"body"` 를 돌려준다.
    - `buildEdgeSplitPlan` 은 원본 엣지(`isContainerBoundaryEdge`)만 컨테이너 경계 여부로 검사하고, **새로 삽입되는 노드 자신이 컨테이너 타입인지·그 결과 새로 만들어질 `newToTarget` 커넥션의 `sourceHandle` 이 `body`/`done` 이 되는지는 전혀 검사하지 않는다.** 그 결과 `newToTarget = { source: newId, sourceHandle: "body", target: edge.target, ... }` 형태의 연결이 그대로 `onConnect` 로 전달된다.
    - `editor-store.ts` `onConnect` → `evaluateConnection` → `detectContainerConflict` 는 `isContainerNode(sourceNode) && connection.sourceHandle === "body"` 조건을 컨테이너 진입(body) 연결로 판정한다. 즉 이 새 `newToTarget` 연결은 "일반 데이터 엣지" 가 아니라 **"새 컨테이너의 body 출력 → target"** 로 해석된다.
      - target 노드가 기존에 다른 컨테이너에 속해 있었다면 `detectContainerConflict` 가 이 연결을 **거부**(toast 만 띄우고 edge 미생성)한다. 그런데 `removeEdge(targetEdge.id, {skipUndo:true})` 는 이미 **무조건** 먼저 실행되어 원본 엣지를 지운 뒤이므로, 이 시점에는 "새 노드는 추가됨 + 원본 엣지는 삭제됨 + `sourceToNew` 는 연결됨 + `newToTarget` 은 연결 실패" 라는 **깨진 중간 상태**가 캔버스에 그대로 남는다(Ctrl+Z 로만 복구 가능, 사용자는 왜 그래프가 끊어졌는지 알기 어려움).
      - target 노드가 아직 어느 컨테이너에도 속하지 않았다면 `detectContainerConflict` 는 통과하고, 이어지는 `propagateContainerOnConnect` 규칙 1("컨테이너의 body 출력 → target 은 강제로 그 컨테이너 소속")이 적용되어 **target 노드의 `containerId` 가 새로 삽입한 Loop/ForEach/Map 의 자식으로 조용히 재할당**된다. 사용자는 "기존 체인 중간에 Loop 노드 하나를 끼워 넣는다" 는 의도였을 텐데, 실제로는 하위 노드가 그 Loop 의 반복 본문(body) 안으로 편입되어 실행 의미가 완전히 달라진다(예: 원래 루프 뒤에 1회 실행되던 노드가 루프마다 반복 실행되는 노드로 바뀜).
    - 이는 spec 서술·CHANGELOG·plan 이 명시한 R-3 스코프("입출력 포트를 모두 가진 노드 + plain 엣지만 분할, 컨테이너 경계 엣지는 제외")와 정확히 어긋난다 — R-3 는 "원본 엣지가 컨테이너 경계인가" 만 걸렀지 "삽입되는 새 노드 자신이 컨테이너인가" 는 걸러지지 않았다. `edge-utils.test.ts` 의 `buildEdgeSplitPlan` 테스트도 `def = { inputs:[{id:'in'}], outputs:[{id:'out'}] }` 처럼 평범한 데이터 포트만 사용해 이 경로(컨테이너 노드가 새로 삽입되는 케이스)를 커버하지 않는다.
    - 팔레트(`node-palette.tsx`)는 Loop/ForEach/Map 을 다른 노드와 동일하게 드래그 가능하도록 노출하므로, 이 결함은 흔한 사용자 조작(컨테이너 노드를 기존 엣지 위에 드롭)만으로 바로 재현된다.
  - 제안: `buildEdgeSplitPlan` 진입 시 `definition?.isContainer`(또는 결과로 만들어질 `newToTarget.sourceHandle`/`sourceToNew.targetHandle` 이 `CONTAINER_SOURCE_HANDLES`/`RESERVED_INPUT_HANDLE_IDS` 에 속하는지)를 함께 검사해 컨테이너 타입 노드는 분할 대상에서 제외(null 반환, 노드만 추가)하도록 R-3 스코프를 확장. 아울러 `onDrop` 의 3단계(`removeEdge`→`onConnect`→`onConnect`)가 원자적이지 않은 구조 자체도 아래 WARNING 참고.

- **[WARNING]** `onDrop` 의 엣지 분할 3단계가 트랜잭션이 아니어서, 중간에 `onConnect` 검증 실패 시 원본 엣지가 이미 삭제된 채로 복구 불가능한(Undo 로만 되돌릴 수 있는) 불완전 상태가 남는다
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` L733-737
  - 상세: `removeEdge(targetEdge.id, { skipUndo: true })` 는 무조건 실행되는 파괴적 연산인 반면, 뒤이은 두 번의 `onConnect(plan.*, { skipUndo: true })` 는 `evaluateConnection` 이 실패하면(자기연결/중복/컨테이너 충돌) **조용히 toast 만 띄우고 아무 것도 하지 않는** best-effort 연산이다. `buildEdgeSplitPlan` 이 null 이 아니라고 해서 그 결과 커넥션이 항상 `onConnect` 검증을 통과한다는 보장은 없다(위 CRITICAL 항목이 그 구체적 사례). 두 `onConnect` 중 하나만 실패해도 "원본 엣지 삭제 + 노드 추가 + 편측 연결만 성공" 이라는 어중간한 상태가 만들어진다.
  - 제안: `onConnect` 호출 전에 `evaluateConnection` 결과를 미리 dry-run 검사하거나, `buildEdgeSplitPlan` 결과가 실제로 유효한 연결인지(컨테이너 충돌 포함) 사전에 판정해 하나라도 실패하면 `removeEdge` 자체를 건너뛰고 "분할 없이 노드만 추가" 로 폴백하는 편이 안전하다.

- **[INFO]** `onDrop` `useCallback` 의존성 배열이 `[buildAndAddNode]` → `[buildAndAddNode, edges, removeEdge, onConnect]` 로 확장되어, `edges` 배열이 바뀔 때마다(즉 거의 모든 캔버스 편집 시) `onDrop` 참조가 새로 생성된다
  - 위치: `workflow-canvas.tsx` L740
  - 상세: hit-test 에 현재 `edges` 스냅샷이 필요하므로 불가피한 의존성 추가이지만, `onDrop` 이 React Flow 의 `onDrop` prop 으로 전달되는 콜백이라 참조가 자주 바뀌면 그 prop 을 받는 하위 트리의 memo 이점이 줄어들 수 있다. 기능상 문제는 없고 심각도는 낮음.
  - 제안: 필요 시 `useEditorStore.getState().edges` 로 직접 조회해 의존성을 줄이는 것도 고려 가능(현재 방식도 허용 가능한 절충).

- **[INFO]** `findEdgeIdAtPoint` 는 호출 시점의 전역 `document.elementFromPoint` 결과에 의존하므로, 드롭 좌표 위에 다른 오버레이(툴팁·컨텍스트 메뉴·모달 등, z-index 상 위)가 떠 있으면 실제로는 엣지 위에 드롭했더라도 엣지가 아닌 다른 엘리먼트가 히트되어 조용히 `null` 을 반환할 수 있다
  - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts` L455-465
  - 상세: 설계상 의도된 "canvas seam"(주입 가능한 `doc` 파라미터로 단위 테스트 가능)이라 결함은 아니나, 실제 브라우저 DOM 전역 상태(전역 부작용 관점의 "예상치 못한 값 읽기")에 결과가 좌우된다는 점은 문서화해 둘 가치가 있다. 심각도는 낮음 — hover 툴팁(§4/§5 기능)이 열려 있는 상태에서 드롭하는 흔치 않은 경우에만 해당.
  - 제안: 필요 시 회귀 발생 시점에만 대응(현재는 문서화만으로 충분).

- **[INFO]** `removeEdge` 시그니처 변경(`(edgeId: string)` → `(edgeId: string, opts?: { skipUndo?: boolean })`)은 하위 호환
  - 위치: `codebase/frontend/src/lib/stores/editor-store.ts` L91-155(interface), L810-822(impl)
  - 상세: 옵션이 선택적(`opts?`)이고 `!opts?.skipUndo` 가 기존 호출부(옵션 미전달)에 대해 기존과 동일하게 `pushUndo()` 를 실행하므로 기존 호출자(§1.3 재연결 detach 등)에 동작 변화가 없다. `onConnect` 의 `skipUndo` 관례와 대칭이라 일관적. 문제 없음, 참고용으로만 기재.

- **[INFO]** `review/consistency/2026/07/13/18_06_53/*` 신규 파일 및 `plan/complete/spec-sync-edge-gaps.md` 이동은 프로젝트 컨벤션(`.claude/docs/plan-lifecycle.md`, 리뷰 산출물 저장 위치)에 따른 정상적 프로세스 산출물이며 코드의 부작용이 아니다.

## 요약
핵심 신규 로직(`buildEdgeSplitPlan`/`findEdgeIdAtPoint`/`removeEdge` `skipUndo`) 은 순수 함수·하위호환 시그니처로 잘 격리되어 있으나, 실제 그래프에 적용하는 `onDrop` 오케스트레이션에서 "삽입되는 새 노드가 컨테이너 타입(Loop/ForEach/Map)인 경우" 를 스코프(R-3)에서 놓쳐 컨테이너 진입(`body`) 포트가 새 엣지의 source 핸들로 잘못 선택되는 CRITICAL 결함이 있다. 이 경로는 기존 `onConnect`/`detectContainerConflict` 로직과 충돌해, 대상 노드가 조용히 새 컨테이너의 body child 로 재편입되거나(가장 흔한 경우) 원본 엣지가 이미 삭제된 채 연결이 거부되어 그래프가 반쪽만 이어진 상태로 남는다(Undo 로만 복구). 팔레트가 컨테이너 노드를 다른 노드와 동일하게 드래그 가능하게 노출하므로 재현이 쉽다. 그 외 시그니처 변경(`removeEdge` opts 추가)은 하위 호환이고, 신규 순수 헬퍼들은 전역/파일시스템/네트워크 부작용이 없다.

## 위험도
CRITICAL
