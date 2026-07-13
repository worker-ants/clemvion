# 유지보수성(Maintainability) Review — edge §4.1 엣지 분할(중간 노드 삽입), 3회차

대상: `workflow-canvas.tsx`(`onDrop`) · `edge-utils.ts` 신규 헬퍼(`firstOutputHandleId`/`isContainerBoundaryEdge`/`buildEdgeSplitPlan`/`findEdgeIdAtPoint`) · `editor-store.ts`(`removeEdge` `{skipUndo}`) + 테스트(`edge-utils.test.ts`/`editor-store.test.ts`) + CHANGELOG/spec/plan/유저가이드. 이 changeset 은 이미 2회의 ai-review(1회차 `18_32_28`: CRITICAL 1+WARNING 6, 2회차 `18_59_13`: WARNING 4)를 거쳐 RESOLUTION 이 반영된 최종 상태다. 현재 저장소 코드를 직접 대조해 과거 지적이 실제로 해소됐는지 재검증하고, 잔여 사항을 확인했다.

## 발견사항

- **[INFO]** 1회차 CRITICAL(컨테이너 새 노드 body 재편입) 및 관련 WARNING(`isContainerBoundaryEdge`의 `done` 오배제) — 코드 대조로 해소 확인
  - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts:296-297`(`if (isContainerBoundaryEdge(edge)) return null;` / `if (definition?.isContainer) return null;`), `:235`(`CONTAINER_SOURCE_HANDLES = new Set(["body"])`, `done` 미포함)
  - 상세: 실제 파일을 직접 Read 해 두 가드가 정확히 존재함을 확인했다. 컨테이너 새 노드(Loop/ForEach/Map)는 `definition?.isContainer` 가드로 분할이 배제되고, Parallel Branch 의 일반 데이터 출력 `done` 은 `CONTAINER_SOURCE_HANDLES` 에서 제외돼 오탐 없이 분할된다. 회귀 테스트(`edge-utils.test.ts` "새 노드 자체가 컨테이너면 null", "done 은 경계가 아니다")도 대응 케이스를 커버한다. 신규 결함 없음.
  - 제안: 없음(정상).

- **[INFO]** 2회차에서 지적된 INFO 4건 중 3건(가독성/타입 재사용/오케스트레이션 누적)이 여전히 동일 상태로 잔존 — 새 이슈 아님, 낮은 우선순위로 계속 이월 중
  - 위치:
    1. `edge-utils.ts:323-330` `findEdgeIdAtPoint` 기본 파라미터의 줄바꿈된 3항 연산자(`typeof document !== "undefined" ? document : undefined`)가 시그니처 안에 인라인돼 있어 한눈에 들어오지 않음.
    2. `edge-utils.ts:250` `interface SplitConnection` 이 `@xyflow/react`의 `Connection`과 구조적으로 동일한 필드(`source`/`sourceHandle`/`target`/`targetHandle`)를 재선언 — 같은 파일의 `buildAutoConnectConnection` 반환 타입도 동일 패턴을 인라인으로 반복.
    3. `workflow-canvas.tsx` `onDrop`(§4.1 블록, 약 30줄)이 hit-test→plan 조립→`removeEdge`+`onConnect`×2 를 인라인으로 오케스트레이션 — §1.3/§3.2/§4·5 는 각각 전용 훅(`use-edge-reconnect.ts` 등)으로 추출했지만 §4.1 은 아직 인라인.
  - 상세: 세 항목 모두 함수 자체의 정확성·가독성을 해치는 수준은 아니며(길이 ~30줄, 중첩 2단 이내, 주석으로 의도 명확히 설명), 2회차 RESOLUTION(`review/code/2026/07/13/18_59_13/RESOLUTION.md` INFO 이월 목록)에서 이미 후속 정리 대상(`task_78c80fec`)으로 추적 중임을 확인했다. 이번 라운드에서 코드가 그대로임을 재확인했을 뿐 새로운 리스크는 아니다.
  - 제안: 지금 조치 불요. 다음 엣지 조작 기능 추가 시 (a) `findEdgeIdAtPoint` 기본값을 모듈 상단 상수로 추출, (b) `SplitConnection`/`buildAutoConnectConnection` 반환 타입을 `@xyflow/react`의 `Connection` import 또는 공용 로컬 alias 로 통일, (c) `onDrop` 오케스트레이션을 `useNodeDropOnEdge` 류 훅으로 추출하는 3건을 함께 처리 권장(이미 합의된 이월 방침 유지).

- **[INFO]** 2회차 INFO 중 "단일 원소 `Set`(`CONTAINER_SOURCE_HANDLES`/`CONTAINER_TARGET_HANDLES`)이 과설계로 보일 수 있음" 항목은 문제로 보지 않음 — 재확인
  - 위치: `edge-utils.ts:235-236`
  - 상세: 같은 파일의 기존 `RESERVED_INPUT_HANDLE_IDS` 패턴과 스타일이 일치하고, 향후 컨테이너 전용 핸들이 늘어날 확장 지점을 이미 마련해둔 것이라 판단한다. 조치 불요.

이 외 항목(가독성/네이밍/함수 길이/중첩 깊이/매직 넘버/중복 코드/복잡도/일관성)은 문제 없음: `onDrop` 추가분은 단일 책임(hit-test → 분할 계획 조립 → 적용)을 유지하고 중첩 2단 이내이며, 각 단계 의도가 주석(§4.1, undo 단일화 근거)으로 명확하다. `firstOutputHandleId`/`isContainerBoundaryEdge`/`buildEdgeSplitPlan`/`findEdgeIdAtPoint` 는 각각 단일 책임의 짧은 순수 함수로, 기존 `firstInputHandleId`/`buildAutoConnectConnection` 네이밍 컨벤션(`first*HandleId`/`build*`/`is*`)과 정확히 대칭을 이룬다. `removeEdge` 의 `{skipUndo}` 옵션은 `onConnect` 의 기존 패턴을 그대로 재사용해 일관적이다. `body`/`emit`/`.react-flow__edge`/`data-id` 등 문자열 리터럴은 모두 명명된 상수(`CONTAINER_SOURCE_HANDLES` 등) 또는 JSDoc 근거가 있어 실질적으로 의미 불명 매직 스트링 문제는 없다. 테스트(`edge-utils.test.ts` 26케이스, `editor-store.test.ts` 신규 3케이스)는 핸들 보존·emit 제외·트리거/sink·컨테이너 경계·컨테이너 새 노드·다중 출력 등 분기를 고르게 커버하며 기존 `describe`/`it` 스타일과 일치한다. `onDrop` 안에서 `getNodeDefinition(nodeType)` 을 (`buildAndAddNode` 내부와) 두 번 호출하는 것도 §1.2 `handleAddNodeFromSearch`(`buildAndAddNode` → `buildAutoConnectConnection` 재호출)와 동일한 기존 패턴이라 이번 diff 고유의 중복이 아니다.

## 요약

이번 changeset 은 1·2회차 ai-review 에서 지적된 CRITICAL(컨테이너 새 노드 body 재편입)·WARNING(Parallel Branch `done` 오배제 등)이 모두 실제 코드에 반영·해소돼 있음을 파일 직접 대조로 재확인했다. 신규 순수 헬퍼 4개는 기존 파일의 네이밍·구조 컨벤션을 정확히 따르고, 함수 길이·중첩 깊이·매직 넘버·중복 코드 어느 항목에서도 새로운 문제가 없다. 남은 것은 2회차에서 이미 INFO 로 식별해 후속 이월(`task_78c80fec`)로 추적 중인 3건(기본 파라미터 표현식 가독성, `Connection` 타입 재선언, `onDrop` 인라인 오케스트레이션 누적)뿐이며 모두 규모가 작고 우선순위가 낮다. 3회 연속 리뷰에도 신규 유지보수성 결함이 발견되지 않아 수렴 상태로 판단한다.

## 위험도

LOW
