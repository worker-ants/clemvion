# 아키텍처(Architecture) Review

대상: 엣지 분할(mid-insert) 구현 — `workflow-canvas.tsx`(`onDrop`), `edge-utils.ts`(`buildEdgeSplitPlan`/`findEdgeIdAtPoint`/`isContainerBoundaryEdge`/`firstOutputHandleId`), `editor-store.ts`(`removeEdge` `{skipUndo}`), spec `3-workflow-editor/2-edge.md` §4.1/R-3, plan 종결.

## 발견사항

- **[WARNING]** 엣지 분할이 store 단일 원자 액션이 아니라 컴포넌트가 오케스트레이션하는 3단계 독립 mutation 시퀀스로 구현됨
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx:726-738` (`onDrop`) — `removeEdge(targetEdge.id, {skipUndo:true})` → `onConnect(plan.sourceToNew, {skipUndo:true})` → `onConnect(plan.newToTarget, {skipUndo:true})`
  - 상세: "엣지 분할 + 노드 삽입"은 개념적으로 하나의 도메인 트랜잭션이지만, 구현은 프레젠테이션 레이어(`workflow-canvas.tsx`)가 store 의 세 public API(`removeEdge`, `onConnect`×2)를 순서대로 호출하는 방식이다. 각 `onConnect` 호출은 내부적으로 `evaluateConnection`(자기연결·중복·`detectContainerConflict`)을 재검증하는데, 이 검증은 원본 엣지가 **이미 제거된 뒤** 실행된다. 현재 스코프(plain 엣지 + 입출력 보유 노드, `firstInputHandleId`/`firstOutputHandleId`로 도출한 유효 핸들)에서는 두 `onConnect` 호출이 실패할 조건이 실질적으로 없어 보이지만, 이는 "우연히 항상 성공하는 순서"에 의존하는 것이지 구조적으로 보장된 원자성이 아니다. 향후 `evaluateConnection`에 새 규칙(예: fan-in 상한, 추가 컨테이너 정책)이 추가되면 두 번째 `onConnect`가 조용히(toast 후 return) 실패할 수 있고, 이 경우 원본 엣지는 이미 사라졌는데 신규 엣지 중 하나만(또는 둘 다) 누락된 채로 그래프가 남는다 — undo 스택은 `buildAndAddNode`의 단일 `pushUndo`만 갖고 있어 Ctrl+Z 로도 이 파손을 감지·복구할 근거가 없다(계획대로라면 전체 롤백되어야 하나, 실패는 계획에 없던 경로).
  - 제안: "원본 엣지 제거 + 신규 엣지 2개 생성"을 store 쪽에 단일 액션(예: `splitEdge(edgeId, newNodeId, plan)`)으로 캡슐화해, 내부에서 두 Connection 을 먼저 검증(`evaluateConnection`)한 뒤 **모두 유효할 때만** 하나의 `set()` 트랜잭션으로 원본 제거+신규 2개 추가+containerId 재도출을 한 번에 커밋하도록 바꾸는 것을 권장한다. 최소한, 컴포넌트 레벨에서라도 두 `onConnect` 호출 전에 `evaluateConnection` 결과를 미리 확인해 실패 시 `removeEdge`를 아예 호출하지 않는 pre-check 가드를 추가할 수 있다.

- **[INFO]** `onDrop` 핸들러에 서브피처별 분기가 계속 누적되는 추세
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx:707-741`
  - 상세: 같은 파일의 §1.3(재연결)·§3.2(실행상태 스타일)·§4/§5(hover 미리보기)는 각각 전용 훅(`use-edge-reconnect.ts`, `use-edge-execution-state.ts`, `use-edge-hover-preview.ts`)으로 오케스트레이션을 추출했지만, 이번 §4.1(엣지 분할)의 오케스트레이션은 `onDrop` 콜백 안에 인라인으로 남았다(순수 로직만 `edge-utils.ts`로 분리). 현재는 §1.2(`handleAddNodeFromSearch`)와 대칭적인 규모라 문제는 아니지만, `onDrop`이 "일반 추가 / 자동 연결 / 엣지 분할" 세 갈래 분기를 한 함수에 계속 쌓아가는 패턴이라 다음 확장(예: 컨테이너 경계 분할 지원 확장, R-3 언급)이 붙으면 SRP 위반 임계점을 넘길 수 있다.
  - 제안: 지금 당장 조치는 불요. 다음 엣지 조작 기능 추가 시 `onDrop` 오케스트레이션을 `use-edge-drop-insert.ts` 류 훅으로 추출해 기존 형제 기능들과 레이어링 컨벤션을 맞추는 것을 고려할 것.

- **[INFO]** `findEdgeIdAtPoint` 가 React Flow 내부 DOM 클래스명(`.react-flow__edge`)에 문자열로 결합
  - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts:455-465` (실제 파일 기준 `isContainerBoundaryEdge` 뒤)
  - 상세: 서드파티 렌더러의 내부 구현 세부사항(공개 API가 아닌 렌더링 산출 DOM 구조)에 의존한다. 함수 자체는 "canvas seam"으로 문서화되어 격리되어 있고 `doc` 주입으로 단위 테스트 가능하지만, React Flow 메이저 버전 업그레이드 시 클래스명이 바뀌면 타입 체크·유닛 테스트 모두 통과한 채로 런타임에만 조용히 깨질 수 있다(hit-test 가 항상 null 반환 → 분할 기능만 no-op).
  - 제안: 현재 위험도는 낮음(단일 함수로 국소화, 이미 테스트 존재). 향후 회귀 시 빠르게 원인 파악할 수 있도록 e2e 스모크 테스트 1개(팔레트→엣지 드롭→분할 확인) 추가를 고려.

## 요약

이번 변경은 §4.1 엣지 분할(mid-insert) 기능을 기존 편집기 아키텍처 관행(순수 판정/조립 로직은 `edge-utils.ts`에 격리, DOM 의존 hit-test 는 주입 가능한 "canvas seam"으로 분리, store API 는 `{skipUndo}` 옵션 패턴으로 대칭적 확장, "plan 객체 생성 → 표준 `onConnect` 재사용"으로 검증 로직 중복 방지)에 맞춰 잘 통합했고, 컨테이너 경계 스코프 제외(R-3)를 Rationale 에 대안 비교와 함께 명시적으로 기록해 추상화 경계도 합리적이다. 순환 의존성이나 레이어 침범은 발견되지 않았다. 다만 "원본 엣지 제거 + 신규 엣지 2개 생성"이라는 하나의 도메인 트랜잭션이 store 내부의 단일 원자 액션이 아니라 프레젠테이션 레이어가 순서대로 호출하는 3단계 독립 mutation 으로 구현되어 있어, 향후 `evaluateConnection` 규칙이 확장될 경우 부분 실패 시 그래프가 파손된 채 남을 수 있는 잠재 리스크가 있다(현재 스코프에서는 실질적으로 트리거되지 않음). 나머지는 향후 확장성을 위한 참고 수준의 개선 여지다.

## 위험도

LOW
