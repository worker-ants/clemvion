### 발견사항

- **[WARNING]** §1.2 auto-connect 배선(`onConnectEnd`/`handleAddNodeFromSearch`)이 어떤 테스트로도 검증되지 않음
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx:326-346`(`onConnectEnd`), `:597-611`(`handleAddNodeFromSearch`)
  - 상세: 이번 PR 이 실제로 구현하는 사용자 시나리오("출력 포트 드래그 → 빈 영역 드롭 → 팝업에서 노드 선택 → source 의 첫 입력 포트로 자동 연결")는 `edge-utils.ts` 에 추출된 두 순수 판정 함수(`isConnectionDroppedOnPane`, `firstInputHandleId`)만 unit 테스트로 커버되고, 이를 조합해 실제로 `onConnect(...)` 를 호출하는 `handleAddNodeFromSearch` 의 분기(`if (newId && source) { ... if (targetHandle) { onConnect(...) } }`)와 `onConnectEnd` 내부 분기(`fromHandle?.type !== "source"` 필터, `"changedTouches" in event ? ... : event` 터치/마우스 이벤트 판별, `point` 부재 시 조기 return)는 어떤 테스트에도 exercise 되지 않는다. `find`/`grep` 결과 `workflow-canvas.tsx` 자체에는 애초에 테스트 파일이 없고(`__tests__/` 하위에 다른 canvas 서브컴포넌트 11개 테스트는 있으나 `workflow-canvas.test.tsx` 부재), e2e(`codebase/frontend/e2e`)에도 `onConnectEnd`/드래그-드롭 관련 스펙이 없다. 즉 `onConnect` 가 잘못된 인자(예: `sourceHandle`↔`targetHandle` 뒤바뀜, `source.nodeId` 대신 `newId` 오기재 등)로 호출되도록 회귀가 나도 CI 로 잡히지 않는다.
  - 제안: 최소한 `onConnectEnd`/`handleAddNodeFromSearch` 의 분기 조건(source-handle 타입 필터, touch/mouse 좌표 추출, targetHandle 부재 시 연결 생략)을 `edge-utils.ts` 류 순수 함수로 추가 추출해 단위 테스트 가능하게 하거나, React Testing Library + `@xyflow/react` mock 으로 `WorkflowCanvas` 자체에 대해 "드래그 종료 이벤트 시뮬레이션 → 팝업 오픈 → 노드 선택 → onConnect 호출 인자" 를 검증하는 최소 통합 테스트를 추가할 것을 권장.

- **[INFO]** `edge-utils.ts` 신규 순수 함수 테스트는 null/undefined 엣지 케이스까지 포함해 충실함
  - 위치: `codebase/frontend/src/lib/utils/__tests__/edge-utils.test.ts:1481-1523`
  - 상세: `isConnectionDroppedOnPane` 은 `isValid` 의 `true`/`false`/`null`/`undefined`/`connectionState` 자체가 `null`/`undefined` 인 5가지 조합 모두, `firstInputHandleId` 는 `inputs` 존재/빈배열/필드부재/`definition` 자체 `null`/`undefined` 4가지 조합 모두를 커버한다. `resolveZoomShortcut` 과 동일하게 "분기 로직을 순수 함수로 추출해 단위 테스트" 하는 기존 코드베이스 컨벤션을 잘 따랐다. 회귀 위험 없음.

- **[INFO]** `buildAndAddNode` 반환값 변경(`void` → `string | undefined`)이 직접 단언되지 않음
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx:588-621`
  - 상세: `definition` 없음, `manual_trigger` 중복 시 `undefined` 를 반환하는 분기가 이번에 명시적 반환으로 바뀌었으나(기존엔 암묵적 `undefined`), 이를 검증하는 테스트가 없다. 컴포넌트 자체가 테스트되지 않는 기존 패턴 때문에 새로 도입된 갭은 아니지만, `handleAddNodeFromSearch`가 이 반환값의 truthy/falsy 로 자동연결 여부를 분기하므로(`if (newId && source)`) 논리적으로 결합도가 높아졌다. 회귀 시 자동연결이 조용히 스킵될 수 있다.
  - 제안: 상기 WARNING 과 함께 해소되면 자연히 커버됨(별도 조치 불필요, 우선순위 낮음).

- **[INFO]** `plan/in-progress/spec-sync-edge-gaps.md` 항목 완료 서술에 "vitest 9케이스" 명시 — 실제 개수 일치 확인
  - 위치: `plan/in-progress/spec-sync-edge-gaps.md:2033/2064`
  - 상세: `isConnectionDroppedOnPane` 5건 + `firstInputHandleId` 4건 = 9건으로 plan 서술과 실제 테스트 개수가 일치한다(카운트 검증 완료, 문제 없음). 다만 plan 서술은 "vitest 9케이스" 만 언급하고 컴포넌트 레벨 테스트 부재는 명시하지 않아, 위 WARNING 의 갭이 plan 상으로도 드러나지 않는다.

### 요약
새로 추가된 순수 헬퍼 `isConnectionDroppedOnPane`/`firstInputHandleId`(edge-utils.ts)는 null/undefined 를 포함한 경계값까지 촘촘하게 단위 테스트되어 있고 기존 `resolveZoomShortcut` 류의 "분기를 순수 함수로 추출해 테스트" 컨벤션을 잘 따른다. 그러나 이번 PR 의 실질적 기능(§1.2 출력 포트 드래그→빈 영역 드롭→팝업→자동 엣지 연결)을 실제로 배선하는 `workflow-canvas.tsx` 의 `onConnectEnd`/`handleAddNodeFromSearch` 로직은 컴포넌트 테스트 파일 자체가 없어 전혀 커버되지 않으며, e2e 에도 관련 스펙이 없다. 순수 판정 함수가 옳게 동작함을 확인해도 그것이 올바른 인자로 `onConnect` 를 호출하는 조합(연결원→신규노드 자동연결)까지 보증하지는 않으므로, 이 배선 로직의 회귀는 현재 테스트 스위트로 감지되지 않는다.

### 위험도
MEDIUM
