### 발견사항

- **[WARNING]** `editor-store.ts` `onConnect` 의 신규 `opts?.skipUndo` 옵션이 어떤 테스트로도 검증되지 않음
  - 위치: `codebase/frontend/src/lib/stores/editor-store.ts:91`(시그니처), `:723`(`if (!opts?.skipUndo) get().pushUndo();`), 소비처 `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx:616`(`onConnect(connection, { skipUndo: true })`)
  - 상세: 이 옵션은 직전 리뷰(`review/code/2026/07/13/11_04_21`)가 지적한 WARNING #2("undo 스냅샷 중복 push → Ctrl+Z 시 고아 노드")를 해소하기 위해 이번 resolution 커밋에서 새로 추가된 것으로, 정확히 "Ctrl+Z 1회로 노드+엣지가 함께 취소된다"는 버그 수정 그 자체를 담보하는 코드다. 그런데 `codebase/frontend/src/lib/stores/__tests__/editor-store.test.ts` 를 전수 확인한 결과 `onConnect(...)` 호출은 3곳(§2.2 자기연결/중복/정상 연결 describe 블록)뿐이며 전부 두 번째 인자(`opts`) 없이 호출되고, `undoStack` 길이 단언도 이 describe 블록엔 전혀 없다(`grep -n "skipUndo" src/` 결과 프로덕션 코드 2곳 외 테스트 파일에는 0건). 즉 (a) 기본 호출(`opts` 미지정)이 여전히 `pushUndo()` 를 실행해 일반 드래그 연결의 undo 가능성을 보존하는지, (b) `{skipUndo: true}` 호출 시 실제로 `pushUndo()` 가 스킵되는지, 어느 쪽도 회귀 가드가 없다. 이 조건문 하나가 깨지면(예: `!` 누락, `opts?.skipUndo` 오타) 정확히 원래 버그(고아 노드 잔존 또는 일반 연결이 undo 불가)가 소리 없이 재발한다.
  - 제안: `describe("onConnect — skipUndo (§1.2)")` 블록을 추가해 (1) opts 없이 호출 시 `undoStack` 이 1 증가, (2) `{skipUndo: true}` 호출 시 `undoStack` 이 불변임을 단언하는 최소 2개 테스트를 `editor-store.test.ts` 에 추가할 것.

- **[WARNING]** `workflow-canvas.tsx` 의 실제 배선(`onConnectEnd`→`connectionDragSource`/`pointerClientPosition` 호출, `handleAddNodeFromSearch`→`buildAutoConnectConnection`→`onConnect` 호출)은 여전히 어떤 테스트로도 exercise 되지 않음 — 전회 리뷰 WARNING #3 대비 부분 개선에 그침
  - 위치: `workflow-canvas.tsx` `onConnectEnd`(L140-154), `handleAddNodeFromSearch`(L597-621); 컴포넌트 테스트 파일(`workflow-canvas.test.tsx`) 부재 확인(`find codebase/frontend/src -iname "*workflow-canvas*"` → `.tsx` 원본 1건만), e2e(`codebase/frontend/e2e`)에도 관련 스펙 없음
  - 상세: resolution 은 판정/조립 로직을 `connectionDragSource`/`pointerClientPosition`/`buildAutoConnectConnection` 순수 함수로 추가 추출하고 vitest 12케이스(실측 `pnpm vitest run edge-utils.test.ts` → **57 passed**, resolution 기재치와 일치, 과장 없음)를 더해 WARNING #3 을 "반영"으로 표시했다. 이는 실질적 개선이지만, 이 순수 함수들을 **올바른 인자로 호출하고 그 결과를 `onConnect`/`openNodeSearchPopupAt` 에 올바르게 전달하는 배선 자체**는 여전히 미검증이다. 예컨대 `onConnect(connection, { skipUndo: true })` 호출에서 `connection` 인자가 실수로 누락되거나, `newId`/`dragSource` 순서가 뒤바뀌거나, `reactFlowInstance.current?.screenToFlowPosition` 좌표 변환이 깨져도 CI 는 감지하지 못한다. 순수 로직이 옳다는 것이 조합(컴포넌트 레벨 호출 체인)이 옳다는 것을 보증하지 않는다.
  - 제안: 우선순위는 낮춰도 되나(핵심 판정 로직은 이미 잘 커버됨), React Testing Library + `@xyflow/react` mock 으로 "드래그 종료 이벤트 시뮬레이션 → 팝업 오픈 → 노드 선택 → `onConnect` 호출 인자" 를 검증하는 최소 통합 테스트 1개를 §1.3 착수 전에 추가할 것을 권장. 최소한 plan/`RESOLUTION.md` 문구에서 "컴포넌트 배선은 여전히 미검증"임을 명시해 두면 향후 재지적을 줄일 수 있다.

- **[INFO]** `edge-utils.test.ts` 신규 5종 헬퍼 테스트는 null/undefined 조합을 포함해 충실하며, resolution 의 "57 passed" 주장은 실측 검증 결과 정확함
  - 위치: `codebase/frontend/src/lib/utils/__tests__/edge-utils.test.ts` (`isConnectionDroppedOnPane` 5케이스, `firstInputHandleId` 4케이스, `connectionDragSource` 6케이스, `pointerClientPosition` 3케이스, `buildAutoConnectConnection` 3케이스)
  - 상세: `pnpm vitest run src/lib/utils/__tests__/edge-utils.test.ts` 실행 결과 `57 passed (57)` 로 RESOLUTION.md 기재치와 일치함을 직접 확인했다. 각 헬퍼가 `isValid` true/false/null/undefined, `connectionState` 자체의 null/undefined, `fromHandle.type` source/target, touch/mouse 이벤트 등 경계값을 촘촘히 커버해 기존 `resolveZoomShortcut` 류 "분기를 순수 함수로 추출해 테스트" 컨벤션을 잘 따른다. 테스트 간 공유 mutable 상태 없이 각 describe 블록이 로컬 상수만 사용해 격리도 양호하다.

- **[INFO]** `connectionDragSource` 의 `fromHandle` 이 **정의되지 않은(undefined) 경우** 자체는 직접 테스트되지 않음 — 경미한 잔여 갭
  - 위치: `edge-utils.ts` `connectionDragSource`(`fromHandle?.type !== "source"` 분기), `edge-utils.test.ts` connectionDragSource describe 블록
  - 상세: 기존 6케이스는 `fromHandle` 이 `{id, type:'source'}`/`{id:null, type:'source'}`/`{id:'in', type:'target'}` 형태로만 주어지고, `fromHandle` 자체가 `undefined`(React Flow 가 핸들 없는 노드에서 드래그를 시작하는 극단 케이스)인 조합은 테스트되지 않는다. 코드상 옵셔널 체이닝으로 안전하게 처리되어 실사용 리스크는 낮다.
  - 제안: 우선순위 낮음. 향후 헬퍼 수정 시 함께 추가 고려.

- **[INFO]** `buildAndAddNode` 반환값(`void`→`string | undefined`) 변경에 의존하는 `handleAddNodeFromSearch` 의 truthy/falsy 분기(`if (newId && dragSource)`)는 컴포넌트 테스트 부재로 여전히 미검증 — 상단 WARNING(컴포넌트 배선)과 동일 원인이라 중복 조치 불요
  - 위치: `workflow-canvas.tsx` L559-596(`buildAndAddNode`), L597-621(`handleAddNodeFromSearch`)
  - 제안: 상단 WARNING 해소 시 자연히 커버됨.

### 요약
전회 리뷰(11:04)가 지적한 "§1.2 배선 미검증" WARNING 은 순수 헬퍼를 추가 추출(`connectionDragSource`/`pointerClientPosition`/`buildAutoConnectConnection`)하고 vitest 12케이스를 더해(실측 57 passed, 과장 없음 확인) 판정/조립 로직 자체의 커버리지는 실질적으로 개선됐다. 그러나 두 가지 잔여 갭이 남는다: (1) 이번 resolution 이 undo 버그 수정을 위해 신설한 `editor-store.ts` `onConnect` 의 `skipUndo` 옵션이 store 테스트에서 전혀 검증되지 않아, 정확히 원래 버그(고아 노드/undo 불가)가 재발해도 잡히지 않는 회귀 사각지대다. (2) `workflow-canvas.tsx` 의 실제 콜백 배선(`onConnectEnd`/`handleAddNodeFromSearch` 가 순수 함수들을 올바른 순서·인자로 호출하고 `onConnect` 로 이어지는 조합)은 컴포넌트/e2e 테스트가 여전히 전무해 "판정 로직이 옳다"가 "전체 흐름이 옳다"를 보증하지 않는다. 기존 회귀 테스트(§2.2 자기연결/중복, enrichEdgesWithPortData 등)는 변경 후에도 그대로 유효하며 전량 통과한다.

### 위험도
MEDIUM
