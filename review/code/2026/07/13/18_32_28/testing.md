# 테스트(Testing) 리뷰 — 엣지 중간 노드 삽입 (§4.1 edge split)

## 발견사항

- **[CRITICAL]** `firstOutputHandleId` 가 컨테이너 예약 출력 포트(`body`)를 제외하지 않아 Loop/ForEach/Map 을 mid-insert 하면 하위 노드가 조용히 컨테이너 자식으로 편입된다 — 이 시나리오는 어떤 테스트에도 없다
  - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts:155-158` (`firstOutputHandleId`), `edge-utils.ts:263-292` (`buildEdgeSplitPlan`) / 테스트 `codebase/frontend/src/lib/utils/__tests__/edge-utils.test.ts:234-306`
  - 상세: `firstOutputHandleId` 의 주석은 "입력의 `emit` 같은 예약 출력 포트는 없어 별도 제외 셋을 두지 않는다" 라고 단정하지만, 이는 사실이 아니다. `codebase/backend/src/nodes/logic/loop/loop.schema.ts` · `foreach.schema.ts` · `map.schema.ts` 3개 컨테이너 노드 정의가 모두 `outputs: [{id:'body'}, {id:'done'}]` 순서다. 팔레트에서 Loop/ForEach/Map 을 일반 plain 엣지(A→B) 위에 드롭하면(원본 엣지는 `isContainerBoundaryEdge` 로 배제되지 않는 일반 엣지이므로 `buildEdgeSplitPlan` 이 null 을 반환하지 않는다) `outHandle = firstOutputHandleId(def) === "body"` 가 선택되고, `newToTarget = { source: 새Loop, sourceHandle: "body", target: B, ... }` 가 `onConnect(plan.newToTarget, {skipUndo:true})` 로 실제 연결된다. `editor-store.ts` `propagateContainerOnConnect` Rule 1(`sourceHandle==='body'` ⇒ target 을 강제로 그 컨테이너 소속으로 편입, `editor-store.ts:323-328`)이 그대로 발동해 **B 가 새로 삽입된 Loop 의 body 첫 자식으로 편입**된다. `detectContainerConflict`(`editor-store.ts:247-285`)도 B 가 기존에 다른 컨테이너 소속이 아닌 한 이를 막지 않아 조용히 성공한다. 이는 "엣지 중간에 노드를 끼워 넣는" 사용자의 기대(A→Loop→B 가 순차 연결)와 달리 B 가 루프 내부로 흡수되는 전혀 다른 위상 변화이며, spec §4.1/R-3 어디에도 이 특수 케이스가 언급되지 않는다. `buildEdgeSplitPlan` 테스트(`edge-utils.test.ts:234-306`)는 전부 `def = { inputs:[{id:"in"}], outputs:[{id:"out"}] }` 같은 단일 입출력 정의만 사용해 이 시나리오를 전혀 커버하지 않는다. 실제로 `npx vitest run edge-utils.test.ts editor-store.test.ts` 를 로컬에서 실행해 150개 테스트가 모두 green 임을 확인했다 — 이 결함은 현재 테스트 스위트로는 절대 잡히지 않는다.
  - 제안: (1) 최소한 `it("새 노드가 컨테이너(outputs=[body,done])면 firstOutputHandleId 는 done 을 선택하거나, buildEdgeSplitPlan 이 null 을 반환한다")` 류의 테스트를 추가해 의도된 동작을 명시적으로 고정. (2) 구현은 `RESERVED_OUTPUT_HANDLE_IDS = new Set(["body"])` 를 두고 `firstOutputHandleId` 가 이를 건너뛰거나(예: `done` 을 선택), 혹은 R-3 패턴처럼 "새 노드가 컨테이너 타입이면 분할 대상에서 제외하고 일반 노드 추가로 폴백" 을 명시적으로 선택해 `buildEdgeSplitPlan`/spec §4.1 양쪽에 반영. 이는 consistency-check(`review/consistency/2026/07/13/18_06_53/cross_spec.md` WARNING #1, "다중/제로 포트 노드 연결 대상 미정의")가 이미 경고했던 항목이 새 노드의 출력 포트 선택 관점에서는 실제로 미해결로 남아있음을 뜻한다.

- **[WARNING]** `onDrop` 의 실제 통합 배선(hit-test → buildAndAddNode → buildEdgeSplitPlan → removeEdge/onConnect 연쇄)은 어떤 테스트로도 실행되지 않는다
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx:707-741`
  - 상세: 이번 PR 이 추가한 테스트는 순수 헬퍼(`firstOutputHandleId`/`isContainerBoundaryEdge`/`buildEdgeSplitPlan`/`findEdgeIdAtPoint`)와 `editor-store.removeEdge` skipUndo 뿐이다. 그러나 사용자가 실제로 체감하는 기능은 `onDrop` 콜백이 이 헬퍼들을 올바른 순서·인자로 엮어 호출하는지에 달려 있다 — 예: `newId && targetEdge` 가드, `getNodeDefinition(nodeType)` 전달, `removeEdge`→`onConnect`×2 순서, `edges` 클로저 최신성. `codebase/frontend/src/components/editor/canvas/__tests__/` 에는 `workflow-canvas.tsx` 자체를 렌더링하는 테스트가 없다(canvas RTL 하네스 부재는 §1.2/§1.3 때부터 알려진 갭). 위 CRITICAL 항목이 정확히 이 통합 지점에서 발생하듯, glue 코드의 결함은 순수 함수 단위 테스트만으로는 발견되지 않는다.
  - 제안: canvas RTL 하네스가 없는 기존 제약은 인지하되(§1.2 선례와 동일 결정이라면 새 결함 아님), 최소한 `onDrop` 을 좀 더 얇게 만들어 "hit-test 결과 + buildAndAddNode 결과 + edges" 를 받아 실행할 사이드이펙트 목록(`[{type:'removeEdge',...}, {type:'onConnect',...}]`)을 반환하는 순수 오케스트레이션 함수로 추출하면(예: `planEdgeSplitOnDrop(...)`), 그 함수는 vitest 로 전수 테스트 가능해지고 `onDrop` 은 그 결과를 그대로 실행만 하는 얇은 wrapper 가 된다. 최소한 이번 CRITICAL 시나리오(컨테이너 노드 드롭)만이라도 그 형태로 재현 가능한 단위 테스트를 만들 것을 권장.

- **[WARNING]** 다중 출력 비-컨테이너 노드(If/Else `true`/`false`, Switch `case_0..N`)를 새 노드로 삽입할 때 `outputs[0]` 선택의 타당성이 spec·테스트 어디에도 검증되지 않음
  - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts:155-158`, 테스트 `edge-utils.test.ts:234-243`("source→새노드·새노드→target 두 Connection 을 조립하고 원본 양끝 핸들을 보존한다")
  - 상세: 기존 테스트는 원본 엣지의 `sourceHandle`(예: `"true"`)이 **그대로 보존**되는지만 검증하며, 이는 원본 엣지 쪽 핸들 로직이라 새 노드가 다중 출력 정의(`outputs:[{id:'true'},{id:'false'}]`)일 때 `newToTarget.sourceHandle` 이 항상 `true` 로 고정되는 문제와는 별개다. If/Else 를 mid-insert 하면 `새노드.true → target` 만 연결되고 `false` 분기는 아무 데도 연결되지 않는 상태가 생기는데, 이것이 의도된 fallback(사용자가 나중에 `false` 를 수동 연결)인지 spec §4.1 은 명시하지 않고 테스트도 이 케이스(다중 출력 정의를 가진 새 노드)를 다루지 않는다.
  - 제안: `buildEdgeSplitPlan` 에 `def.outputs.length > 1`(또는 `inputs.length > 1`) 케이스를 최소 1개 테스트로 추가해 "여러 출력 중 어느 것을 선택하는지" 를 문서화하고, spec §4.1 에도 "새 노드가 다중 출력이면 첫 데이터 출력만 연결하고 나머지 분기는 수동 연결 필요" 같은 문장을 명시할지 project-planner 와 협의.

- **[INFO]** `findEdgeIdAtPoint` 의 `doc` 주입 테스트는 설계·가독성이 좋음 — 다만 `data-id` 속성 부재 케이스 미포함
  - 위치: `codebase/frontend/src/lib/utils/__tests__/edge-utils.test.ts:308-336`
  - 상세: `document.elementFromPoint` 를 매개변수로 주입 가능하게 설계(`findEdgeIdAtPoint(x, y, doc?)`)한 것은 DOM 의존 코드를 순수 함수로 격리해 vitest 로 검증 가능하게 만든 좋은 테스트 용이성 사례다. 세 케이스(엣지 발견/엣지 아님/조상 없음)는 분기를 잘 커버한다. 다만 `.closest(".react-flow__edge")` 는 매칭되지만 `getAttribute("data-id")` 가 `null` 을 반환하는 극단 케이스(React Flow 가 언젠가 속성명을 바꾸거나 렌더 타이밍 이슈로 아직 속성이 안 붙은 경우)는 다루지 않는다. `?? null` 로 이미 안전하게 처리되므로 실질 리스크는 낮다.
  - 제안: 선택적으로 `closest` 가 `{ getAttribute: () => null }` 을 반환하는 케이스 1개를 추가하면 coalesce 동작까지 명시적으로 고정할 수 있다 (낮은 우선순위).

- **[INFO]** `buildEdgeSplitPlan` 의 null 반환 조건들이 각각 단독으로만 테스트되고 조합 케이스는 없음
  - 위치: `edge-utils.test.ts:260-305`
  - 상세: "트리거(입력 없음)", "sink(출력 없음)", "컨테이너 경계 엣지" 세 null 조건이 각각 독립 `it` 로 테스트되지만, 코드 상 `isContainerBoundaryEdge(edge)` 체크가 먼저 실행되고 그 다음 `!inHandle || !outHandle` 체크가 실행되는 순서(early-return OR 로직)이므로 조합(예: 컨테이너 경계 엣지 + 트리거 노드 동시)은 논리적으로 첫 조건에서 이미 short-circuit 되어 실질 리스크는 낮다. 다만 이 순서 의존성 자체를 검증하는 테스트는 없다.
  - 제안: 우선순위 낮음. 리팩터링 시 순서가 바뀌어도 회귀를 잡을 수 있게 "컨테이너 경계이면서 동시에 트리거인 노드"에 대해 여전히 null 인지 확인하는 테스트 1개를 추가하면 안전망이 된다.

## 회귀 확인 (참고)
`removeEdge` 의 기존 기본 동작(옵션 미지정 시 `pushUndo` 호출) 테스트(`editor-store.test.ts:296-327`)는 이번 PR 이후에도 그대로 유지되어 있어 `{skipUndo}` 옵션 추가가 기존 호출부(§1.3 detach 등)를 깨지 않았음을 확인했다. `npx vitest run edge-utils.test.ts editor-store.test.ts` 로컬 실행 결과 150개 테스트 전부 통과.

## 요약
순수 헬퍼(`firstOutputHandleId`/`isContainerBoundaryEdge`/`buildEdgeSplitPlan`/`findEdgeIdAtPoint`)와 `removeEdge` skipUndo 에 대한 단위 테스트 자체는 격리도·가독성이 양호하고 기존 회귀도 지키고 있지만, 테스트 케이스가 전부 "단일 입력·단일 출력" 노드 정의만 다뤄 실제 노드 카탈로그에 존재하는 컨테이너(Loop/ForEach/Map, `outputs=[body,done]`)를 새 노드로 mid-insert 하는 경로를 전혀 커버하지 못한다. 코드 추적 결과 이 미검증 경로에서 `firstOutputHandleId` 가 컨테이너 예약 출력 `body` 를 걸러내지 않아 `propagateContainerOnConnect` Rule 1 이 발동, 삽입 대상 하위 노드가 조용히 새 컨테이너의 자식으로 편입되는 실제 동작 결함을 확인했다(로컬에서 관련 스위트 150개 테스트 green 임에도 이 결함은 재현 가능). 또한 `workflow-canvas.tsx` `onDrop` 의 통합 배선 자체가 어떤 테스트로도 실행되지 않아(canvas RTL 하네스 부재라는 기존 제약의 연장), 순수 함수 커버리지만으로는 이런 glue-level 결함을 잡을 수 없는 구조적 한계가 이번에도 재현됐다.

## 위험도
CRITICAL
