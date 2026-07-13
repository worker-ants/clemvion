# 유지보수성(Maintainability) 리뷰 — edge §4.1 엣지 분할(중간 노드 삽입)

## 발견사항

- **[INFO]** `findEdgeIdAtPoint` 기본 파라미터의 SSR 가드 표현식이 읽기 불편
  - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts` `findEdgeIdAtPoint` 시그니처
    ```ts
    doc: Pick<Document, "elementFromPoint"> | undefined = typeof document !==
    "undefined"
      ? document
      : undefined,
    ```
  - 상세: 줄바꿈된 3항 연산자가 파라미터 기본값 자리에 인라인돼 있어 한눈에 의도(“SSR 환경이면 undefined”)가 들어오지 않는다. 로직 자체는 정확하고 `doc` 주입 덕에 테스트는 이미 충분히 커버됨.
  - 제안: `const defaultDoc = typeof document !== "undefined" ? document : undefined;` 를 모듈 상단에 상수로 빼고 기본값 자리에서는 `doc = defaultDoc` 로 참조하면 시그니처가 한 줄로 정리된다. 우선순위는 낮음(스타일 nit).

- **[INFO]** `onDrop` 인라인 오케스트레이션이 점점 두꺼워짐 (이미 RESOLUTION #9 로 추적됨)
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` `onDrop` (§4.1 블록)
  - 상세: `onDrop` 한 콜백 안에서 (1) hit-test, (2) `buildAndAddNode`, (3) `buildEdgeSplitPlan`, (4) `removeEdge`+`onConnect`×2 를 원자성·undo 근거를 설명하는 밀도 높은 주석과 함께 수행한다. 함수 자체는 ~30줄로 아직 과도하지 않고 중첩도 2단(`if (newId && targetEdge)` → `if (plan)`)으로 낮지만, `handleAddNodeFromSearch`(§1.2)도 유사한 "buildAndAddNode → 조건부 connect(skipUndo)" 골격을 반복하고 있어 다음 엣지 기능이 추가되면 `useEdgeReconnect`/`useEdgeHoverPreview` 처럼 전용 훅으로 뽑아낼 시점이 임박했다. RESOLUTION.md(`review/code/2026/07/13/18_32_28/RESOLUTION.md` #9)에 동일 항목이 이미 이월로 기록돼 있음 — 신규 이슈라기보다 확인 차원.
  - 제안: 지금 당장 리팩터링을 요구하지 않음. 다음 캔버스 드롭/연결 기능 착수 시 `useNodeDropOnEdge` 류 훅으로 추출 권장.

- **[INFO]** `SplitConnection` 인터페이스가 파일 내 기존 인라인 Connection-shape 패턴을 한 번 더 반복
  - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts:250` (`interface SplitConnection`), cf. `buildAutoConnectConnection` 반환 타입(동일 4필드 인라인 타입)
  - 상세: 이 파일은 `@xyflow/react` 의 `Connection` 타입을 import 하는 대신 `{source, sourceHandle, target, targetHandle}` 형태를 함수마다 재선언해왔다(`buildAutoConnectConnection` 반환 타입 → 인라인, 이번 `SplitConnection` → named interface). 새 코드가 파일의 기존 스타일과 일관되므로 이번 diff 자체의 결함은 아니지만, 동일 shape 재선언이 누적되고 있어 공용 타입 alias 도입 여지가 커짐. RESOLUTION.md #11 에 이미 후속 정리로 이월 기록됨.
  - 제안: 후속 정리 시 `type EdgeEndpoints = {source; sourceHandle; target; targetHandle}` 공용 alias 도입 검토.

- **[INFO]** `CONTAINER_SOURCE_HANDLES`/`CONTAINER_TARGET_HANDLES` 가 각각 원소 1개짜리 `Set`
  - 위치: `edge-utils.ts:531-532`
  - 상세: `new Set(["body"])`, `new Set(["emit"])` 처럼 단일 값 집합을 쓰는 것이 과설계로 보일 수 있으나, 같은 파일의 기존 `RESERVED_INPUT_HANDLE_IDS`(예약 입력 포트 제외) 패턴과 스타일이 일치하고 향후 컨테이너 전용 핸들이 늘어날 때 확장 지점이 된다. 문제 아님 — 참고로만 기록.

## 요약

이번 diff(엣지 분할·중간 노드 삽입)는 유지보수성 관점에서 전반적으로 우수하다. 신규 순수 헬퍼(`firstOutputHandleId`, `isContainerBoundaryEdge`, `buildEdgeSplitPlan`, `findEdgeIdAtPoint`)는 기존 파일의 네이밍 컨벤션(`build*`/`is*`/`first*HandleId`)과 `skipUndo` 옵션 패턴(`onConnect`↔`removeEdge` 대칭)을 그대로 따르고, 각 함수는 단일 책임·짧은 길이·얕은 중첩(조기 반환 위주)을 유지한다. 매직 스트링(`body`/`emit`/`.react-flow__edge`/`data-id`)은 모두 JSDoc·인라인 주석으로 근거가 명시돼 있어 실질적으로 의미 불명 매직 넘버 문제는 없다. 1회차 ai-review CRITICAL(컨테이너 새 노드 body 재편입)은 `buildEdgeSplitPlan` 에 `definition?.isContainer` 가드로 정확히 반영됐고 회귀 테스트도 추가돼 코드로 직접 확인됨. 남은 항목은 모두 INFO 수준(기본 파라미터 표현식 가독성, onDrop 오케스트레이션 누적, 타입 중복)이며 그중 2건은 이미 팀이 RESOLUTION.md 에서 후속 이월로 추적하고 있어 신규 차단 사유가 아니다. 문서(spec §4.1/R-3, CHANGELOG, 유저가이드 ko/en)도 코드 변경과 정합되게 갱신되어 있다.

## 위험도

LOW
