# 테스트(Testing) Review — §1.3 역방향 연결 확인 + 기존 엣지 재연결/분리 (4회차)

## 컨텍스트

이 diff 는 3차례에 걸친 직전 ai-review(`12_40_48` CRITICAL 1건, `13_06_50` WARNING 5건, `13_27_36` WARNING 2건)가 지적한 사항이 모두 반영된 이후 상태다. 코드를 직접 읽고 테스트를 실행해 독립 검증했다.

- `use-edge-reconnect.ts`: detach 판정이 success 플래그가 아니라 `onReconnectEnd` 의 `connectionState.toNode` 기반으로 되어 있음을 확인(CRITICAL 해소 유지).
- `editor-store.ts`: `evaluateConnection` 이 `{ ok: true } | { ok: false; message? }` 판별 유니온으로 되어 있고(`13_06_50` WARNING #4 해소), `onConnect`/`onReconnect` 양쪽이 공용 호출.
- `editor-store.test.ts`: `onReconnect (§1.3)` describe 6케이스, `removeEdge (§1.3 detach)` describe 2케이스 — 중복·컨테이너 충돌 거부 케이스 모두 `toast.error` 계약(`toHaveBeenCalledWith`/`not.toHaveBeenCalled`)까지 단언함을 확인(`13_27_36` WARNING #2 해소).
- `import type { Node, Edge, Connection } from "@xyflow/react";` — `Connection` import 존재, `tsc`/vitest 어느 쪽에서도 미참조 오류 없음(`12_40_48` WARNING #3 해소 유지).
- `plan/in-progress/spec-sync-edge-gaps.md` §1.3 — "store onReconnect 6/removeEdge 2" 로 실제 테스트 개수와 일치(`13_27_36` WARNING #1 해소).
- 실행 확인: `vitest run` 대상 3파일 **125 passed**(reconnect 훅 4 + store 62 + edge-utils 59), `eslint` 대상 6파일 0 errors/warnings.

즉 이전 3라운드가 지적한 테스트 갭·문서-테스트 불일치는 모두 코드 레벨에서 실제로 메워졌음을 재확인했다. 아래는 그 위에서 새로 살펴본 잔여 사항이며, 전부 이미 낮은 우선순위로 트리아지됐거나 신규로 발견한 INFO 수준이다.

## 발견사항

- **[INFO]** `onReconnect` 성공 경로(컨테이너 충돌로 거부되지 않는 재연결)가 `containerId` 를 실제로 갱신하는지 검증하는 양성(positive) 테스트가 없음
  - 위치: `codebase/frontend/src/lib/stores/editor-store.ts` `onReconnect` 의 `deriveContainerAssignments(state.nodes, nextEdges)` 호출부, `codebase/frontend/src/lib/stores/__tests__/editor-store.test.ts` `describe("onReconnect (§1.3)")`
  - 상세: `removeEdge` 쪽은 "컨테이너 진입(body) 엣지 제거 시 자식의 containerId 를 재도출한다" 테스트로 음성(제거 시 `null` 로 풀림) 케이스를 커버하지만, `onReconnect` 쪽에는 컨테이너 충돌로 **거부되는** 케이스(엣지 미변경)만 있고, 재연결이 **성공**해 끝점이 바뀌면서 `containerId` 가 실제로 새로 부여/변경되는 시나리오(예: `body` 엣지를 컨테이너 밖 노드 → 컨테이너 안으로 재연결)는 없다. `deriveContainerAssignments`/`propagateContainerOnConnect` 자체는 다른 스위트(예: `setWorkflow`, `removeNode`)에서 이미 검증된 공용 순수 함수라 완전히 새로운 알고리즘 위험은 아니지만, `onReconnect` 라는 새 호출 지점에서 이 함수가 실제로 배선되어 있는지(호출 자체가 빠지는 회귀)는 이 스위트만으로는 못 잡는다.
  - 제안: (선택, 낮은 우선순위) "body 엣지를 재연결하면 새 타깃 노드가 컨테이너 자식이 된다" 류의 케이스 1건 추가.

- **[INFO]** `onConnect` 자체 스위트에는 여전히 컨테이너 충돌 거부(container-conflict reject) 테스트가 없음 — 대칭성 관점의 기존 지적 재확인
  - 위치: `editor-store.test.ts` `describe("onConnect — 금지 연결 하드 차단 (§2.2)")`(자기연결/중복/정상 3케이스)
  - 상세: 컨테이너 충돌 거부는 이번 사이클에서 `onReconnect` 쪽에만 추가됐다(공용 `evaluateConnection` 경로 실증 목적). 두 액션이 동일 헬퍼를 호출하므로 실질 회귀 위험은 낮으나, 향후 `onConnect` 만 독자적으로 리팩터되는 시나리오에서는 이 스위트가 컨테이너 충돌 회귀를 못 잡는다. 이미 `13_27_36` 라운드가 동일하게 INFO 로 지적·수용한 항목으로 신규 결함은 아니다.
  - 제안: 조치 불요(이미 트리아지됨). 재발 방지 목적이면 대칭 케이스 1건 추가 고려.

- **[INFO]** React Flow 실배선(`workflow-canvas.tsx` → `onReconnect`/`onReconnectEnd` prop 연결) 자체를 검증하는 RTL/e2e 테스트 없음
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx`, `codebase/frontend/e2e/`(관련 spec 0건)
  - 상세: 판정 로직(`useEdgeReconnect` 훅)과 상태 변경(`editor-store.ts`)은 각각 순수 단위 테스트로 촘촘히 커버되지만, "훅이 실제로 `<ReactFlow>` 에 올바른 prop 이름·인자로 배선됐는가" 라는 얇은 glue 는 어떤 테스트로도 검증되지 않는다(타입 체커가 prop 시그니처 불일치는 잡아주므로 위험은 제한적). `plan/in-progress/spec-sync-edge-gaps.md` §1.2 이월 항목 (d) 가 이 종류의 glue 검증을 "캔버스 RTL 하네스 부재 + §4 오케스트레이션 정리 시점"으로 명시적으로 이월했음을 확인했다 — 신규 지적이 아니라 기존에 근거와 함께 트리아지된 항목.
  - 제안: 조치 불요(이미 plan 에 근거 기록). 향후 canvas 컴포넌트 테스트 하네스 도입 시 함께 편입 권장.

## 확인한 항목(문제 없음)

- **테스트 격리**: `beforeEach` 가 `useEditorStore.setState(initialState)` + `toastErrorMock.mockClear()` 로 매 테스트 전 store·mock 을 리셋한다. `use-edge-reconnect.test.ts` 는 각 `it` 내부에서 `vi.fn()` 을 로컬 생성해 `renderHook` 에 주입하므로 테스트 간 공유 상태가 없다. 실행 순서에 의존하는 테스트 없음.
- **Mock 적절성**: `sonner`/`workflowsApi.saveCanvas` 만 mock 하고 `@workflow/graph-warning-rules` 는 `importActual` 로 실제 구현을 그대로 쓰며 spy 만 씌운다 — 과도한 mock 없이 실제 판정 로직(`isSelfConnection`/`isDuplicateConnection`/`detectContainerConflict`/`evaluateConnection`)을 그대로 태운다. `use-edge-reconnect.test.ts` 는 DI 로 주입된 콜백만 mock 해 훅 자체의 로직은 실제로 실행된다.
- **엣지 케이스**: `firstInputHandleId` 는 `null`/`undefined`/`inputs` 없음/빈 배열/예약 포트만 있음/예약+일반 혼재 6가지 입력 형태를 모두 커버. `isConnectionDroppedOnPane` 도 `isValid` true/false/null/undefined/connectionState 자체 부재까지 커버.
- **회귀 테스트**: 기존 `onConnect — skipUndo`, `onConnect — 금지 연결 하드 차단`, `isValidConnection` 스위트는 `evaluateConnection` 공용 헬퍼 추출 이후에도 수정 없이 그대로 통과(behavior-preserving 리팩터 확인, vitest 실행으로 재검증).
- **테스트 용이성**: `useEdgeReconnect(reconnect, removeEdge)` 가 store 구현을 직접 import 하지 않고 콜백을 매개변수로 주입받는 구조라 `renderHook` 단위 테스트가 store 전체를 mount 하지 않고도 성립한다. `evaluateConnection`/`buildEdgeDataForConnection` 도 순수 함수로 분리돼 있어 store 액션에서 분리 검증 가능.
- **타입 안전성 가드 실효성**: `editor-store.test.ts` 의 `Connection` import 를 실제로 grep·`tsc` 로 재확인 — 미참조 오류 없음. 다만 `tsconfig.json` 의 `exclude`(`src/**/*.test.ts` 등)로 `__tests__` 는 여전히 프로젝트 전체 `tsc --noEmit` 대상에서 빠지는 기존 구조적 갭이 있다(프로젝트 메모에 이미 기록된 별도 트랙 — 이번 diff 가 새로 만든 문제 아님).

## 요약

3차례의 직전 ai-review(CRITICAL 1건, WARNING 7건)가 지적한 테스트 관련 사항 — detach 오판정 회귀 가드, `sourceHandle` 재계산 검증, 컨테이너 충돌 거부 경로 검증, `toast.error` 계약 단언, `Connection` 타입 import, plan 테스트 개수 정합 — 은 모두 코드·테스트를 직접 읽고 vitest/eslint 를 실행해 실제로 반영됐음을 재확인했다(125 tests passed, 0 lint errors). 이번 라운드에서 새로 발견한 사항은 전부 INFO 수준이다: (1) `onReconnect` 성공 경로의 `containerId` 재도출에 대한 양성 테스트 부재, (2) `onConnect` 자체 스위트의 컨테이너 충돌 케이스 부재(대칭성, 기존 지적 재확인), (3) canvas 실배선 glue 의 RTL/e2e 부재(이미 plan 에 근거 기록된 의도적 이월). 순수 판정 로직(훅·헬퍼)은 DI 기반으로 테스트 용이하게 설계돼 있고, mock 은 실제 로직을 과도하게 대체하지 않으며, 테스트 간 격리도 양호하다. 기능적 결함이나 새로운 커버리지 위험은 발견되지 않았다.

## 위험도
LOW
