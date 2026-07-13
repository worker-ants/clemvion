# 아키텍처(Architecture) Review

대상: 엣지 분할(mid-insert) §4.1 구현 — `workflow-canvas.tsx`(`onDrop`), `edge-utils.ts`(`buildEdgeSplitPlan`/`findEdgeIdAtPoint`/`isContainerBoundaryEdge`/`firstOutputHandleId`), `editor-store.ts`(`removeEdge {skipUndo}`), `spec/3-workflow-editor/2-edge.md` §4.1/R-3.

사전 확인: 이번 diff 는 이전 리뷰 라운드(`review/code/2026/07/13/18_32_28`)에서 side_effect·testing 리뷰어가 지적한 CRITICAL(컨테이너 새 노드 삽입 시 `firstOutputHandleId`가 `body`를 선택해 target 이 새 컨테이너 본문 자식으로 재편입되는 결함)이 이미 `buildEdgeSplitPlan`에 `if (definition?.isContainer) return null` 가드로 반영된 이후 상태다(직접 `edge-utils.ts` 재확인 완료). 본 리뷰는 그 수정 이후 상태를 대상으로 독립적으로 재평가한다.

## 발견사항

- **[WARNING]** "컨테이너 경계" 개념이 노드 타입 검사 없이 핸들명만으로 세 번째로 재구현되어, 코드베이스 다른 곳의 정밀한 구현과 정합성이 암묵적 관례에 의존한다
  - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts:235-247`(`CONTAINER_SOURCE_HANDLES`/`CONTAINER_TARGET_HANDLES`/`isContainerBoundaryEdge`)
  - 상세: 직접 대조한 결과, 같은 파일의 `resolvePortType`(`edge-utils.ts:48`, `def?.isContainer && sourceHandle === "done"`)과 `editor-store.ts`의 `detectContainerConflict`/`propagateContainerOnConnect`(`editor-store.ts:259,273,324,332,464,468`, 모두 `isContainerNode(node) && handle === 'body'/'emit'`)는 "노드가 실제 컨테이너인가 + 핸들명"을 함께 검사하는데, `isContainerBoundaryEdge`만 핸들명(`body`/`emit`)만으로 판정한다. `codebase/backend/src/nodes/logic/{loop,foreach,map}.schema.ts` 확인 결과 현재는 이 두 핸들 id 가 컨테이너 노드 전용이라 실질적 오탐은 없지만, 이는 스키마 레지스트리가 우연히 지키는 **네이밍 컨벤션**이지 타입 시스템이나 공유 함수가 강제하는 구조적 보장이 아니다. 정확히 같은 패턴(핸들명 기반 근사)이 직전 라운드에서 Parallel Branch 의 `done` 을 컨테이너 경계로 오판하는 실제 회귀를 만들었고(이번엔 `done` 제거로 해소), 향후 새 노드 타입이 `body`/`emit` 을 일반 데이터 포트 이름으로 재사용하면 같은 클래스의 결함이 재발할 수 있는 구조다. 세 곳에 흩어진 서로 다른 정밀도의 "컨테이너 경계 판정" 구현이 SSOT 없이 독립적으로 진화 중이다.
  - 제안: `isContainerBoundaryEdge`/`buildEdgeSplitPlan` 에 source/target 노드(또는 그 `isContainer` 여부)를 전달해 `editor-store.ts` 의 `isContainerNode(node) && handle===...` 패턴과 동일한 정밀도로 맞추거나, 최소한 "body/emit 은 컨테이너 노드만 등록한다"는 불변식을 깨뜨리는 노드 스키마가 추가되면 실패하는 회귀 테스트(레지스트리 전수 검사)를 두어 근사 로직이 의존하는 전제를 명시적으로 가드할 것.

- **[WARNING]** "엣지 분할 + 노드 삽입"이라는 하나의 도메인 트랜잭션이 store 의 단일 원자 액션이 아니라 프레젠테이션 레이어가 순서대로 호출하는 3단계 독립 mutation(`removeEdge`→`onConnect`×2)으로 구현됨
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` `onDrop` (`removeEdge(targetEdge.id, {skipUndo:true})` → `onConnect(plan.sourceToNew, {skipUndo:true})` → `onConnect(plan.newToTarget, {skipUndo:true})`)
  - 상세: 컨테이너 새 노드 가드 추가로 현재 스코프에서는 두 `onConnect` 가 `detectContainerConflict` 의 거부 분기에 걸릴 경로가 없음을 코드 추적으로 확인했다(`buildEdgeSplitPlan` JSDoc 의 "by construction" 주장은 현재는 유효). 다만 이 안전성은 **store 가 구조적으로 보장하는 것이 아니라, `edge-utils.ts` 의 배제 규칙과 `editor-store.ts` 의 거부 규칙이 서로 어긋나지 않게 계속 동기화되어야 유지되는 암묵적 불변식**이다. `evaluateConnection`에 새 규칙(예: fan-in 상한)이 추가되면 두 번째 `onConnect` 가 조용히 실패할 수 있고, 그 시점엔 이미 원본 엣지가 삭제된 뒤라 그래프가 반쪽만 갱신된 채 남으며 undo 스택은 `buildAndAddNode` 의 단일 `pushUndo` 만 가져 이 파손 경로를 계획하지 않는다. 레이어 책임 관점에서, "분할은 원자적이어야 한다"는 도메인 규칙이 프레젠테이션 레이어의 호출 순서에 인코딩되어 있고 store 는 이를 강제하는 단일 API 를 노출하지 않는다.
  - 제안: `editor-store.ts` 에 `splitEdge(edgeId, newNodeId, plan)` 류 단일 액션을 추가해, 내부에서 두 Connection 을 먼저 `evaluateConnection` 으로 사전 검증한 뒤 **모두 유효할 때만** 원본 제거+신규 2개 추가+containerId 재도출을 하나의 `set()` 트랜잭션으로 커밋하도록 캡슐화. 최소한 컴포넌트 레벨에서 `removeEdge` 호출 전에 두 Connection 의 유효성을 pre-check 하는 가드라도 추가.

- **[INFO]** `onDrop` 이 서브피처별 인라인 분기를 계속 누적하는 추세
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` `onDrop`
  - 상세: 같은 파일의 §1.3(재연결)·§3.2(실행상태)·§4/§5(hover 미리보기)는 각각 전용 훅으로 오케스트레이션을 추출했지만, §4.1(엣지 분할)의 오케스트레이션은 `onDrop` 콜백 안에 인라인으로 남았다(순수 로직만 `edge-utils.ts`로 분리). 현재 규모는 문제 아니나, 이 함수가 "일반 추가 / 자동 연결 / 엣지 분할" 세 갈래를 계속 쌓아가는 패턴이라 다음 확장 시 SRP 임계점을 넘길 수 있다.
  - 제안: 다음 엣지 조작 기능 추가 시 `use-edge-drop-insert.ts` 류 훅으로 추출해 형제 기능들과 레이어링 일관성을 맞출 것.

- **[INFO]** `findEdgeIdAtPoint` 가 React Flow 내부 DOM 클래스명(`.react-flow__edge`)에 문자열로 결합
  - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts` `findEdgeIdAtPoint`
  - 상세: 서드파티 렌더러의 비공개 DOM 구조에 의존한다. "canvas seam"으로 격리되고 `doc` 주입으로 단위 테스트되어 있어 즉각적 위험은 낮지만, React Flow 메이저 업그레이드 시 클래스명이 바뀌면 타입체크·테스트 모두 통과한 채 런타임에서만 조용히 no-op(분할 기능 무효화)될 수 있다.
  - 제안: 조치 시급하지 않음. 회귀 시 원인 파악을 앞당길 e2e 스모크 1개(팔레트→엣지 드롭→분할 확인) 고려.

- **[INFO]** `SplitConnection` 인터페이스가 `@xyflow/react` `Connection` 타입과 구조적으로 동일한 필드를 재선언
  - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts` (`SplitConnection`)
  - 상세: 기존 파일 패턴(`buildAutoConnectConnection`의 인라인 반환 타입)을 답습한 것이라 이번 diff 고유 문제는 아니나, 같은 shape 이 여러 곳에 반복돼 `Connection` 타입 변경 시 갱신 누락 위험이 있다.
  - 제안: 후속 정리 시 `import type { Connection } from "@xyflow/react"` 로 통일 고려.

## 확인된 양호 사항 (참고)

- `buildEdgeSplitPlan` 이 신규 Connection 두 개를 순수 함수로 조립만 하고, 유효성 검사는 기존 `onConnect`(`evaluateConnection`) 경로를 재사용하도록 설계된 점은 검증 로직 중복을 피하는 좋은 패턴이다.
- `removeEdge`의 `{skipUndo}` 옵션 확장은 `onConnect`의 기존 패턴과 대칭이며 기존 호출부에 하위 호환(옵션 미지정 시 동일 동작) — OCP 관점에서 적절한 확장.
- 스코프를 R-3 로 명시적으로 좁혀(컨테이너 경계 엣지·컨테이너 신규 노드·무입출력 노드 제외) over-engineering 을 피하고 근거를 spec Rationale 에 기록한 점은 추상화 경계 설정이 합리적임을 보여준다.
- 순환 의존성 없음. 레이어 분리(순수 판정/조립=`edge-utils.ts`, DOM 의존 hit-test=canvas seam, store=상태) 자체는 유지됨.

## 요약

이번 변경은 §4.1 엣지 분할 기능을 기존 편집기 아키텍처 관행(순수 로직 격리, DOM 의존 hit-test 의 seam 분리, store API 대칭 확장, 검증 로직 재사용)에 맞춰 통합했고, 직전 라운드에서 발견된 CRITICAL(컨테이너 새 노드의 body 재편입)은 `isContainer` 가드로 실제 해소되어 있음을 코드 추적으로 확인했다. 다만 두 가지 구조적 관심사가 남는다 — (1) "컨테이너 경계" 판정이 코드베이스에 이미 정밀하게(노드 타입+핸들명) 구현된 개념을 핸들명만으로 세 번째로 재구현하면서 정밀도가 낮은 근사에 의존하고 있어(현재는 안전하지만 향후 유사 회귀 재발 가능), (2) "엣지 분할"이라는 단일 도메인 트랜잭션이 store 의 원자 액션이 아니라 컴포넌트가 순서대로 호출하는 3단계 mutation 으로 구현되어 있어 향후 검증 규칙 확장 시 반쪽 갱신 리스크가 잠재한다는 점이다. 두 사안 모두 현재 스코프에서는 실질적 결함으로 이어지지 않으나, 구조적으로는 개선 여지가 있는 WARNING 수준이다. 순환 의존성이나 명백한 레이어 침범은 발견되지 않았다.

## 위험도

LOW