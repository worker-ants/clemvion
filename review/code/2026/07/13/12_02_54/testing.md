# 테스트(Testing) 리뷰 결과

본 라운드(`12_02_54`)는 `origin/main` 대비 4개 커밋(`19386ef10`→`2b775357b`→`7980c2868`→`1173bc10f`) 누적 diff에 대한 리뷰다. 마지막 커밋(`1173bc10f`)은 직전 fresh 리뷰(`review/code/2026/07/13/11_46_01`, MEDIUM)의 WARNING(테스트 3회 재부상, plan 케이스 수 오기재, stale 주석)에 대한 반영 커밋이며, 프로덕션 로직 변경 없이 주석·plan·spec 텍스트만 수정한다. 아래는 누적 diff 전체를 테스트 관점에서 재검토한 결과다.

## 발견사항

- **[INFO]** 테스트 케이스 수량 claim 실측 검증 완료 — `plan/in-progress/spec-sync-edge-gaps.md`의 "vitest 23케이스(edge-utils 21 + store 2)" 서술이 정확함
  - 위치: `codebase/frontend/src/lib/utils/__tests__/edge-utils.test.ts`(`isConnectionDroppedOnPane` 5 + `firstInputHandleId` 4 + `connectionDragSource` 6 + `pointerClientPosition` 3 + `buildAutoConnectConnection` 3 = 21), `codebase/frontend/src/lib/stores/__tests__/editor-store.test.ts`(`onConnect — skipUndo (§1.2)` 2)
  - 상세: `npx vitest run src/lib/utils/__tests__/edge-utils.test.ts src/lib/stores/__tests__/editor-store.test.ts` 를 직접 실행해 `111 passed (111)` 확인(edge-utils 파일 전체 57 + editor-store 파일 전체 54). §1.2 신규분만 골라 `awk`로 재계산한 결과도 21+2=23으로 plan 서술과 일치한다. 직전 라운드가 지적했던 "vitest 27케이스" 오기재(requirement.md, `11_46_01`)는 이번 커밋에서 23으로 정확히 정정됐고 실측과도 맞다. `tsc --noEmit` 도 에러 0건 — 타입 테스트가 아니라 런타임 vitest이므로 "타입만 통과, 런타임 미검증" 류 위험(과거 반복된 실패 패턴)도 해당 없음.
  - 제안: 없음(확인 완료).

- **[INFO]** `onConnect` `skipUndo` 회귀 테스트 — 격리·가독성·실동작 검증 모두 양호
  - 위치: `codebase/frontend/src/lib/stores/__tests__/editor-store.test.ts` `describe("onConnect — skipUndo (§1.2)")`(`connectable()` 로컬 헬퍼 + 2케이스)
  - 상세: 파일 최상단 `beforeEach(() => useEditorStore.setState(initialState))` 로 매 테스트 전 스토어 전체가 리셋되어 이 describe 블록이 앞뒤 테스트 상태에 의존하지 않는다(테스트 격리 양호). `connectable()`이 self/duplicate/container-conflict를 우회하는 두 개의 독립 action 노드만 세팅해 `onConnect` 자체의 검증 분기(§2.2)가 개입하지 않도록 정확히 스코핑했고, 어서션도 mock을 거치지 않고 실제 Zustand 상태(`state.edges`/`state.undoStack`)를 직접 읽어 실동작과 괴리가 없다. 케이스명("opts 미지정이면 pushUndo 로 undoStack 이 1 늘어난다" / "{skipUndo:true} 면 엣지는 추가하되 undoStack 은 늘리지 않는다")도 의도를 명확히 서술해 가독성이 좋다.
  - 제안: 없음.

- **[WARNING]** `workflow-canvas.tsx`의 `onConnectEnd`→`handleAddNodeFromSearch`→`onConnect` 실배선은 여전히 어떤 테스트로도 exercise 되지 않음 — 4회 연속(11_04_21/11_28_30/11_46_01/본 라운드) 동일 갭이나, 이번 라운드에서 "의도적 최종 이월"로 명시 확정됨
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` `onConnectEnd`(`connectionDragSource`/`pointerClientPosition` 호출), `handleAddNodeFromSearch`(`buildAndAddNode`→`buildAutoConnectConnection`→`onConnect(connection, {skipUndo:true})`); `plan/in-progress/spec-sync-edge-gaps.md` §1.3 이월 (d)
  - 상세: 판정/조립 순수 함수 5종(`isConnectionDroppedOnPane`/`firstInputHandleId`/`connectionDragSource`/`pointerClientPosition`/`buildAutoConnectConnection`)은 vitest 21케이스로 null/undefined/유효/무효 조합을 촘촘히 커버하지만, 이 함수들의 반환값을 올바른 순서로 `onConnect`/`openNodeSearchPopupAt`에 전달하는 **조합(glue)** 자체는 미검증이다. `find codebase/frontend/src -iname "*workflow-canvas*"` 결과 여전히 `.tsx` 원본 1건뿐이고(다른 canvas 서브컴포넌트 8개는 `__tests__/`에 테스트가 있으나 오케스트레이션 컴포넌트인 `workflow-canvas.tsx` 자체는 없음), `codebase/frontend/e2e`에도 드래그-드롭/`onConnectEnd` 관련 스펙이 없다. 예컨대 `onConnect` 호출 인자 순서(`newId`/`dragSource.nodeId`)가 뒤바뀌거나 `screenToFlowPosition` 변환이 깨져도 CI로 잡히지 않는다. 이번 라운드(`1173bc10f`)는 이 반복 지적에 대해 plan §1.3 이월 항목 (d)에 "**[의도적 최종 이월 — 결정 확정]**" 라벨을 붙이고 "저장소에 canvas 컴포넌트 테스트 하네스가 전무해 지금 도입하면 flaky 위험이 크고, §1.3 오케스트레이션 훅 추출 시점에 검증 대상이 순수 훅이 된 뒤 함께 작성하는 것이 옳다"는 근거를 명시했다 — grep으로 확인한 결과(`workflow-canvas.test.tsx` 부재, e2e 부재) 이 전제 자체는 사실이며, 임의 묵살이 아니라 반복된 리뷰 피드백을 실제로 반영한 근거 있는 결정이다.
  - 제안: 이 갭 자체는 실재하므로 WARNING으로 유지하되, 3회 연속 동일 지적 이후 명시적 최종 결정(문서화된 이월)이 내려진 상태이므로 §1.3 착수 전까지 이 항목만으로 재차단할 필요는 없다(plan 서술과 동일 판단). §1.3 착수 시 오케스트레이션 훅 추출과 함께 최소 1개의 RTL + `@xyflow/react` mock 통합 테스트("드래그 종료 이벤트 시뮬레이션 → 팝업 오픈 → 노드 선택 → `onConnect` 호출 인자")를 반드시 추가할 것.

- **[INFO]** `connectionDragSource`의 `fromHandle` 자체가 `undefined`인 극단 케이스는 여전히 미테스트 — 3라운드째 동일하게 지적된 경미한 잔여 갭
  - 위치: `codebase/frontend/src/lib/utils/__tests__/edge-utils.test.ts` `describe("connectionDragSource (§1.2)")`(현재 6케이스는 `fromHandle`이 `{id,type:'source'}`/`{id:null,type:'source'}`/`{id:'in',type:'target'}` 형태로만 주어짐, `fromHandle` 자체 부재 조합 없음)
  - 상세: `edge-utils.ts`의 `fromHandle?.type !== "source"` 가드는 옵셔널 체이닝으로 `fromHandle`이 `undefined`여도 안전하게 `null`을 반환하므로 실사용 리스크는 낮다. 코드 로직상 이미 안전해 우선순위는 낮으나, 다른 null/undefined 조합은 전부 테스트하면서 이 조합만 빠진 것은 "전 조합 커버"를 표방하는 이 describe 블록의 완결성 관점에서 사소한 흠이다.
  - 제안: 우선순위 낮음. 향후 §1.3용 헬퍼 추가 작업 시 1케이스만 추가하면 됨(별도 조치 불필요).

- **[INFO]** Mock 사용은 스코프 밖 부수효과(API·토스트·그래프 경고)에만 국한 — 실제 스토어/헬퍼 로직과 괴리 없음
  - 위치: `codebase/frontend/src/lib/stores/__tests__/editor-store.test.ts` 상단 mock 선언(`workflowsApi.saveCanvas`, `sonner.toast`, `@workflow/graph-warning-rules`)
  - 상세: 이번 §1.2 변경이 건드리는 `onConnect`/`pushUndo`/`edges`/`undoStack`은 mock되지 않고 실제 Zustand 구현이 그대로 실행된다. `edge-utils.test.ts`의 신규 5개 헬퍼 테스트도 순수 함수 입출력만 검증하며 전역 상태·mock을 전혀 사용하지 않아 실제 동작과의 괴리가 없다.
  - 제안: 없음.

- **[INFO]** 기존 회귀 테스트(§2.2 자기연결/중복, `enrichEdgesWithPortData` 등)는 시그니처 확장(`onConnect(connection) => onConnect(connection, opts?)`) 후에도 그대로 유효
  - 위치: `codebase/frontend/src/lib/stores/__tests__/editor-store.test.ts` `describe("onConnect — 금지 연결 하드 차단 (§2.2)")`(opts 인자 없이 호출)
  - 상세: `opts`가 optional 파라미터이고 내부에서 `if (!opts?.skipUndo) get().pushUndo()`로 안전하게 처리되어 기존 호출부(옵션 미지정)는 이전과 동일하게 동작한다. `npx vitest run` 실측으로 전량 통과 확인(회귀 없음).
  - 제안: 없음.

## 요약
§1.2 구현의 핵심 판정/조립 로직(`isConnectionDroppedOnPane`/`firstInputHandleId`/`connectionDragSource`/`pointerClientPosition`/`buildAutoConnectConnection`)은 순수 함수로 분리되어 null/undefined 경계값까지 포함한 21케이스로 촘촘히 커버되고, undo 단일화 버그 수정(`skipUndo` 옵션)도 격리되고 실동작을 검증하는 2케이스로 뒷받침된다 — 총 23케이스(실측 vitest 111 passed와 일치, plan 서술의 이전 오기재 "27"도 이번 라운드에서 정정됨). 기존 회귀 테스트는 시그니처 확장 후에도 그대로 유효하고 mock 사용도 스코프 밖 부수효과에 국한돼 실동작과의 괴리가 없다. 유일한 잔존 갭은 `workflow-canvas.tsx`의 `onConnectEnd`→`handleAddNodeFromSearch`→`onConnect` 실배선(조합 자체)이 컴포넌트/e2e 테스트로 전혀 검증되지 않는다는 점인데, 이는 4라운드 연속 동일하게 지적된 사안이자 여전히 실재하는 커버리지 갭이지만, 이번 라운드에서 "저장소에 canvas 컴포넌트 테스트 하네스가 전무하다"는 사실 확인(grep으로 검증됨)에 근거해 §1.3 오케스트레이션 훅 추출 시점까지 명시적으로 이월·확정하는 결정이 plan 문서에 정직하게 기록됐다. 임의 묵살이 아니라 반복 피드백에 대한 근거 있는 최종 판단이므로, 이 항목 하나만으로 본 PR을 차단할 필요는 없다고 판단한다.

## 위험도
LOW
