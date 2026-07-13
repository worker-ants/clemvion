# 부작용(Side Effect) Review — edge §4.1 엣지 분할(mid-insert)

대상: `workflow-canvas.tsx`(`onDrop`), `edge-utils.ts`(`buildEdgeSplitPlan`/`findEdgeIdAtPoint`/`isContainerBoundaryEdge`/`firstOutputHandleId`), `editor-store.ts`(`removeEdge` `{skipUndo}`), 테스트, CHANGELOG/spec/plan/유저가이드, 그리고 직전 ai-review 라운드(18_32_28) 산출물(RESOLUTION/architecture/documentation/maintainability/meta/SUMMARY) 커밋.

## 발견사항

- **[WARNING]** `onDrop` 이 "엣지 제거 + 신규 엣지 2개 연결"을 store 의 독립된 public 액션 3회 호출(순차, 비원자적)로 오케스트레이션하며, 그중 `onConnect` 는 실패 시 `toast.error()` 콜백을 발화하는 경로를 공유한다
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx:736-740` (`removeEdge(targetEdge.id, {skipUndo:true})` → `onConnect(plan.sourceToNew, {skipUndo:true})` → `onConnect(plan.newToTarget, {skipUndo:true})`), `codebase/frontend/src/lib/stores/editor-store.ts:748-756`(`onConnect` 내부 `evaluateConnection` 실패 시 `toast.error(result.message)` 후 `return`, mutation 미적용)
  - 상세: 현재는 `buildEdgeSplitPlan` 이 컨테이너 경계 엣지·컨테이너 신규 노드를 사전에 배제해 두 `onConnect` 호출이 `detectContainerConflict` 거부 분기에 걸릴 수 없고, 새 노드라 자기연결·중복도 불가능해 "항상 성공"이 by-construction 으로 성립한다(JSDoc·주석·RESOLUTION.md Warning#2 에 이미 명시·수용됨). 다만 이 안전성은 store 트랜잭션이 아니라 **호출부 3단계가 우연히 항상 성공하는 순서**에 의존하는 암묵적 계약이다. 향후 `evaluateConnection`(예: fan-in 상한, 새 컨테이너 정책)이 확장되어 이 계약이 깨지면, ① 원본 엣지는 이미 제거된 상태에서 두 번째 `onConnect` 가 조용히 mutation 을 건너뛰고, ② 그 대신 "이미 연결됨"/"컨테이너 충돌" 류의 `toast.error` 가 사용자에게 표시된다 — 이 토스트 메시지는 원래 "수동 드래그 연결 실패"를 설명하도록 작성된 문구라, "팔레트에서 노드를 엣지 위에 드롭"이라는 이번 상호작용 맥락에서 뜨면 사용자에게 원인이 불분명한 콜백으로 체감될 수 있다. 이 시점에 스토어는 원본 엣지 제거 + 신규 엣지 0~1개만 반영된 부분 그래프 상태로 남고, `pushUndo` 는 `buildAndAddNode` 시점에 1회만 찍혀 있어(§1.2 관행) `Ctrl+Z` 로 전체를 되돌리는 것 자체는 가능하지만, 사용자가 즉시 undo 하지 않으면 이 부분 그래프가 그대로 저장·지속될 수 있다. 실패를 감지·기록(예: `console.error`/텔레메트리)하는 방어 코드가 없어, 계약이 깨져도 조용한 그래프 파손 + 맥락에 맞지 않는 toast 콜백만 남고 근본 원인 추적이 어렵다.
  - 제안: 이미 architecture.md(같은 세션)에서 구조적 대안(단일 `splitEdge` store 액션)이 WARNING 으로 제시되고 현재 스코프에서는 "구성적 해소"로 수용된 사안과 동일 지점이다. 즉시 조치가 필요한 것은 아니나, side-effect 방어 차원에서 최소한 두 번째 `onConnect` 가 실패(`evaluateConnection.ok === false`)할 경우를 감지해 개발 모드 assertion(`console.error`)이라도 남기는 가드를 고려할 것 — "항상 성공" 불변식이 실제로 깨지는 순간을 조용히 넘기지 않도록.

- **[INFO]** `removeEdge` 시그니처 변경은 하위 호환(선택적 파라미터 추가) — 기존 호출자 영향 없음 확인
  - 위치: `codebase/frontend/src/lib/stores/editor-store.ts:99-101, 322-324` (`removeEdge: (edgeId: string) => void` → `removeEdge: (edgeId: string, opts?: { skipUndo?: boolean }) => void`)
  - 상세: 코드베이스 내 `removeEdge` 호출부는 이번 diff 의 `workflow-canvas.tsx:737`(신규, `{skipUndo:true}` 전달)과 기존 `use-edge-reconnect.ts:51`(`removeEdge(edge.id)`, 인자 미전달) 둘뿐임을 확인했다. 후자는 `opts` 가 `undefined` 로 들어와 기존 동작(매번 `pushUndo`)을 그대로 유지하므로 회귀 없음. `onConnect` 의 기존 `{skipUndo}` 패턴과 대칭이라 API 확장 스타일도 일관적이다.
  - 제안: 조치 불요(확인 목적 기재).

- **[INFO]** `findEdgeIdAtPoint` 가 전역 `document.elementFromPoint` 를 기본 인자로 읽음(전역 브라우저 상태 read, write 없음) — 타이밍·격리 모두 적절
  - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts` `findEdgeIdAtPoint`(신규), 호출부 `workflow-canvas.tsx:719`
  - 상세: `onDrop` 은 `findEdgeIdAtPoint`(DOM hit-test, 드롭 이전 시점의 실제 DOM 트리 기준)를 **먼저** 호출한 뒤 `buildAndAddNode`(신규 노드 추가 → 리렌더 유발)를 호출하므로, 방금 추가된 새 노드 자신의 DOM 이 hit-test 결과에 섞여 들어올 시점 문제는 없다. `doc` 매개변수 주입 가능 설계(기본값 `typeof document !== "undefined" ? document : undefined`)로 SSR 환경에서도 안전하며 단위 테스트로 격리돼 있다. React Flow 내부 DOM 클래스명(`.react-flow__edge`)에 대한 결합은 이미 별도 리뷰(architecture.md/maintainability.md, INFO)에서 다뤄졌으므로 여기서는 중복 지적하지 않는다.
  - 제안: 조치 불요.

- **[INFO]** 기존 `onConnect`/`removeEdge` 부작용 경로(`isDirty: true` 설정, `pushUndo`/`skipUndo`, `toast.error`, `deriveContainerAssignments`/`propagateContainerOnConnect`)가 새로운 트리거(팔레트 드롭에 의한 엣지 분할)로 재사용·확장됨 — 신규 부작용 유형 아님
  - 위치: `codebase/frontend/src/lib/stores/editor-store.ts:748-822`
  - 상세: 이 함수들의 부작용(dirty 플래그, undo 스택, containerId 재도출) 자체는 §1.2/§1.3/§2.2 에서 이미 존재하던 것이며, 이번 diff 는 이를 새 호출 경로(§4.1 onDrop)에서 재사용할 뿐 새로운 전역 상태·신규 부작용을 추가하지 않는다. `CONTAINER_SOURCE_HANDLES`/`CONTAINER_TARGET_HANDLES` 는 모듈 스코프 상수 `Set`(불변, 런타임 변경 없음)로 기존 `RESERVED_INPUT_HANDLE_IDS` 패턴과 동일하다.
  - 제안: 조치 불요(확인 목적 기재).

## 확인된 항목 (side-effect 관점 N/A)

- 파일시스템 부작용: 코드 변경분(`workflow-canvas.tsx`/`edge-utils.ts`/`editor-store.ts`)은 런타임 FS 접근 없음. `CHANGELOG.md`/`spec`/`plan/complete`/`review/**` 는 문서·리뷰 산출물의 정적 추가/수정으로, 이번 세션이 이미 생성한 것이거나(18_32_28 라운드 산출물 커밋) 관행에 따른 SoT 갱신이며 예기치 않은 생성·삭제 없음.
- 환경 변수: 읽기/쓰기 없음.
- 네트워크 호출: 신규·의도치 않은 외부 호출 없음(순수 프런트엔드 편집기 로컬 상태 변경, 백엔드/wire 무변경 — CHANGELOG 자체 명시와 일치).
- 공개 API/인터페이스: REST/DTO 등 백엔드 계약 변경 없음. 프런트엔드 내부 store 시그니처(`removeEdge`) 변경은 선택적 파라미터 추가로 하위 호환.
- 이벤트/콜백: `onDrop`/`onConnect` 콜백 발생 자체는 React Flow 표준 이벤트 흐름 그대로이며, 상기 WARNING 외에 새로운 콜백 유형 도입 없음.

## 요약

이번 변경은 순수 프런트엔드 편집기 로컬 상태(노드/엣지 배열) 조작에 한정되며, 전역 변수·환경 변수·파일시스템·네트워크·공개 API 관점에서는 실질적 부작용 위험이 없다. `removeEdge` 시그니처 확장은 선택적 파라미터라 하위 호환이 보장됨을 실제 호출부 전수 확인으로 검증했다. 유일한 잔여 우려는 `onDrop` 이 "엣지 제거 + 신규 엣지 2개 연결"을 store 의 독립 액션 3회 순차 호출로 처리해, 두 `onConnect` 가 "항상 성공"한다는 암묵적 불변식이 깨질 경우 부분 그래프 상태 + 상황에 안 맞는 `toast.error` 콜백이 조용히 남을 수 있다는 점인데, 이는 현재 스코프에서 by-construction 으로 안전함이 확인되고 직전 리뷰 라운드(architecture.md WARNING → RESOLUTION.md Warning#2)에서 이미 식별·검토·수용된 사안이다. 신규로 발견된 차단 사유는 없으며, 향후 `evaluateConnection` 규칙이 확장될 때를 대비한 fail-loud 가드 정도가 개선 여지로 남는다.

## 위험도

LOW
