### 발견사항

- **[WARNING]** `workflow-canvas.tsx` 의 실제 배선(`onConnectEnd` → `handleAddNodeFromSearch` → `onConnect`)이 여전히 컴포넌트/e2e 테스트로 exercise 되지 않음 — 3회 연속(11_04_21 / 11_28_30 / 본 라운드) 동일 지적
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` `onConnectEnd`(§1.2 판정→`openNodeSearchPopupAt`), `handleAddNodeFromSearch`(`buildAndAddNode`→`buildAutoConnectConnection`→`onConnect(connection, {skipUndo:true})`)
  - 상세: 판정/조립 순수 함수(`connectionDragSource`/`pointerClientPosition`/`buildAutoConnectConnection`/`firstInputHandleId`/`isConnectionDroppedOnPane`)는 `edge-utils.test.ts` 로 촘촘히 커버되지만(실측 vitest 실행 결과 `edge-utils.test.ts` 57 passed, `editor-store.test.ts` 54 passed, 합계 **111 passed** — RESOLUTION.md 기재치와 정확히 일치), 이 함수들을 올바른 순서·인자로 호출하고 결과를 `onConnect`/`openNodeSearchPopupAt` 에 정확히 전달하는 **조합**은 어떤 테스트로도 검증되지 않는다. `find codebase/frontend/src -iname "*workflow-canvas*"` 결과 원본 `.tsx` 1건뿐이고 `codebase/frontend/e2e` 에도 드래그-드롭/`onConnectEnd` 관련 스펙이 없다. `newId`/`dragSource` 인자 순서가 뒤바뀌거나 `screenToFlowPosition` 변환이 깨져도 CI 로 잡히지 않는다. 다만 이 갭은 `plan/in-progress/spec-sync-edge-gaps.md` 의 "§1.2 ai-review 이월 (d)" 항목으로 명시적으로 추적·이월되어 있고(사유: "저장소에 canvas 컴포넌트 테스트 패턴이 없어 §1.3 오케스트레이션 훅 추출과 함께 도입하는 편이 자연스러움"), 신규 회귀는 아니며 §1.2 스코프 내 실질 위험(버그)으로 이어지지는 않았다.
  - 제안: 동일 갭이 3회째 반복 지적되고 있으므로, 다음 둘 중 하나로 수렴할 것을 권고한다 — (1) §1.3 착수 전 최소 1개의 RTL + `@xyflow/react` mock 통합 테스트를("드래그 종료 이벤트 시뮬레이션 → 팝업 오픈 → 노드 선택 → `onConnect` 호출 인자") 지금 추가하거나, (2) 이월 결정을 최종 확정으로 명시(예: plan 에 "이 갭은 §1.3 훅 추출 시점까지 의도적으로 미해결" 문구를 못박아 재지적 방지). 현재처럼 매 라운드 WARNING 으로 재부상만 하면 리뷰 사이클이 수렴하지 않는다.

- **[INFO]** `onConnect` 의 신규 `skipUndo` 옵션 회귀 테스트가 새로 추가되어 직전 라운드(11_28_30) WARNING #1 을 정확히 해소함
  - 위치: `codebase/frontend/src/lib/stores/__tests__/editor-store.test.ts` `describe("onConnect — skipUndo (§1.2)")` (opts 미지정 → `undoStack` +1, `{skipUndo:true}` → `undoStack` 불변 2케이스)
  - 상세: `beforeEach` 가 매 테스트 전 `useEditorStore.setState(initialState)` 로 전체 스토어를 리셋하고, 로컬 `connectable()` 헬퍼가 self/duplicate/container-conflict 를 우회하는 두 개의 독립 action 노드만 세팅해 다른 테스트와 격리된다. 어서션도 실제 Zustand 스토어 상태(`state.edges`/`state.undoStack`)를 직접 읽어 mock 을 통하지 않고 실동작을 검증한다. 실측 실행 결과 통과 확인.
  - 제안: 없음(양호).

- **[INFO]** 기존 §2.2(자기연결/중복/정상 연결) 회귀 테스트가 `onConnect` 시그니처 확장(`(connection) => void` → `(connection, opts?) => void`) 후에도 그대로 유효
  - 위치: `editor-store.test.ts` `describe("onConnect — 금지 연결 하드 차단 (§2.2)")` (L644-694, opts 인자 없이 호출)
  - 상세: `opts` 가 optional 파라미터이고 내부에서 `if (!opts?.skipUndo) get().pushUndo()` 로 안전하게 처리되어, 기존 호출부(옵션 미지정)는 이전과 동일하게 `pushUndo()` 가 실행된다. 하위 호환 시그니처 변경이라 기존 테스트가 깨지지 않았고 실측으로도 확인했다.
  - 제안: 없음.

- **[INFO]** `connectionDragSource` 순수 함수의 null/undefined 조합 커버리지는 우수하나, `fromHandle` 자체가 `undefined`(fromNode 는 있고 핸들 정보가 없는 극단 케이스)인 조합은 여전히 미테스트 — 11_28_30 라운드에서도 동일하게 INFO 로 지적된 잔여 갭
  - 위치: `codebase/frontend/src/lib/utils/__tests__/edge-utils.test.ts` `describe("connectionDragSource (§1.2)")` — 현재 6케이스는 `fromHandle` 이 `{id,type:'source'}`/`{id:null,type:'source'}`/`{id:'in',type:'target'}` 형태로만 주어짐
  - 상세: 코드는 `fromHandle?.type !== "source"` 옵셔널 체이닝으로 안전하게 처리되어(undefined 시 `undefined !== "source"` → true → null 반환) 실사용 리스크는 낮다. 우선순위 낮은 잔여 갭.
  - 제안: 향후 §1.3 헬퍼 추가 작업 시 함께 케이스 추가 고려.

- **[INFO]** Mock 사용 적절성 양호 — 과도한 mock 없이 실제 스토어 동작에 근접
  - 위치: `editor-store.test.ts` 상단(`workflowsApi.saveCanvas`, `sonner.toast`, `@workflow/graph-warning-rules` 만 mock)
  - 상세: 이번 변경(§1.2 skipUndo)이 건드리는 `onConnect`/`pushUndo`/`edges`/`undoStack` 로직 자체는 mock 되지 않고 실제 Zustand store 구현이 그대로 실행된다. mock 대상은 네트워크(API)·토스트·그래프 경고 평가처럼 §1.2 스코프 밖의 부수효과뿐이라 실동작과의 괴리가 없다.
  - 제안: 없음.

### 요약
이번 diff 는 직전 라운드(11_28_30 testing.md)가 지적한 두 WARNING 중 하나(`onConnect` `skipUndo` 옵션 미검증)를 `editor-store.test.ts` 에 격리되고 가독성 좋은 2케이스로 정확히 해소했으며(실측 vitest 111 passed = edge-utils 57 + editor-store 54, resolution 기재치와 일치), 기존 §2.2 회귀 테스트도 시그니처 확장 후 그대로 유효하다. 다만 다른 하나(`workflow-canvas.tsx` 의 `onConnectEnd`→`handleAddNodeFromSearch`→`onConnect` 실배선 자체가 컴포넌트/e2e 테스트로 검증되지 않는 갭)는 3회 연속 동일하게 지적되는 채로 남아 있다 — 순수 판정/조립 로직은 이미 vitest 로 전수 커버되어 실질 버그 위험은 낮지만, "조합이 옳다" 는 보증이 없는 상태가 plan 상 §1.3 이월로만 계속 미뤄지고 있어, 이번 라운드에서 이 갭에 대한 최종 결정(지금 최소 통합 테스트 추가 vs 이월을 확정 문서화)을 권고한다.

### 위험도
MEDIUM
