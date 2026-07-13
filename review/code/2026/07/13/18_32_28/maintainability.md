# 유지보수성(Maintainability) Review

대상: 워크플로 편집기 엣지 중간 노드 삽입(§4.1) — `workflow-canvas.tsx` `onDrop`, `editor-store.ts` `removeEdge`, `edge-utils.ts` 신규 헬퍼(`firstOutputHandleId`/`isContainerBoundaryEdge`/`buildEdgeSplitPlan`/`findEdgeIdAtPoint`) + 테스트 + 문서(CHANGELOG/plan/spec).

## 발견사항

- **[WARNING]** `isContainerBoundaryEdge` 가 기존 "컨테이너 판정" 로직보다 정밀도가 낮은 중복 구현이라 실제 오탐(false positive) 위험이 있다
  - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts:230-243`(`CONTAINER_SOURCE_HANDLES`/`isContainerBoundaryEdge`), `:263-292`(`buildEdgeSplitPlan`)
  - 상세: 새 함수는 핸들 이름(`sourceHandle ∈ {body, done}` 또는 `targetHandle === emit`)만으로 "컨테이너 경계 엣지"를 판정하고 노드가 실제로 컨테이너인지는 보지 않는다. 그런데 같은 파일의 기존 `resolvePortType`(`edge-utils.ts:48`, `def?.isContainer && sourceHandle === "done"`)과 `editor-store.ts` 의 `detectContainerConflict`/`propagateContainerOnConnect`(`editor-store.ts:259-260, 273-274, 323-325, 331-333`, `isContainerNode(node) && handle === ...`)는 모두 "핸들 이름 + 실제 컨테이너 노드 여부"를 함께 검사한다 — 즉 같은 개념(컨테이너 경계 판정)이 이미 두 곳에 정밀하게 구현돼 있는데, 세 번째 구현(`isContainerBoundaryEdge`)만 노드 타입 검사를 생략했다.
    이 정밀도 차이는 실제 기능 오작동으로 이어진다: `resolve-dynamic-ports.ts` 의 `parallelBranchPorts`(line 46)가 Parallel Branch 노드(컨테이너 아님, `dynamicPorts.kind === "parallel-branches"`)의 출력 포트로 `id: "done"`(`type: "data"`)을 노출한다. 이 노드의 `done` 출력에서 나가는 **평범한 데이터 엣지** 위에 새 노드를 드롭해도 `isContainerBoundaryEdge` 가 핸들 이름만 보고 컨테이너 경계로 오판 → `buildEdgeSplitPlan` 이 null 을 반환해 **분할이 조용히 생략**된다(사용자는 이유를 알 수 없이 "가끔 분할이 안 되는" 엣지를 겪는다). spec §4.1/R-3 이 명시한 "컨테이너 경계만 제외" 의도와 어긋나는 사각지대다.
  - 제안: `buildEdgeSplitPlan`/`isContainerBoundaryEdge` 에 source/target 노드(혹은 그 `isContainer` 여부)를 함께 넘겨 `editor-store.ts` 의 `isContainerNode(node) && handle === ...` 패턴과 동일한 정밀도로 판정하도록 맞춘다. 노드 리스트를 헬퍼까지 끌고 가기 부담스러우면 최소한 `onDrop` 호출부에서 source/target 노드의 `isContainer` 를 조회해 `isContainerBoundaryEdge` 앞단 가드로 추가한다. 시급하지 않다면 최소한 이 근사의 알려진 한계(Parallel Branch `done`)를 spec R-3 또는 함수 주석에 명시해 향후 디버깅 시간을 줄인다.

- **[INFO]** `SplitConnection` 인터페이스가 `@xyflow/react` `Connection` 타입과 구조적으로 동일한 필드를 재선언
  - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts:245-250`
  - 상세: 파일이 `Edge`/`Node` 타입은 `@xyflow/react` 에서 import 하면서 `Connection` 은 import 하지 않고, `SplitConnection`(및 기존 `buildAutoConnectConnection` 의 인라인 반환 타입)으로 유사 모양을 매번 새로 선언한다. 새 코드가 기존 파일의 패턴을 그대로 답습한 것이라 이번 diff 만의 문제는 아니지만, 세 곳에서 사실상 같은 shape 이 반복돼 향후 `Connection` 타입이 필드를 추가/변경하면 갱신 누락 위험이 있다.
  - 제안: 후속 정리 시 `import type { Connection } from "@xyflow/react"` 로 통일하거나, 최소한 파일 내 공용 로컬 타입 alias 하나로 모아 재사용.

- **[INFO]** `onDrop` 내 `edges.find((e) => e.id === droppedEdgeId)` 는 O(n) 선형 탐색
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx:719-722`
  - 상세: 참고용 — 같은 파일의 `detectContainerConflict`/`propagateContainerOnConnect`(`editor-store.ts`) 등 기존 컨트롤 흐름도 동일하게 `nodes.find`/`edges.find` 선형 탐색을 쓰고 있어 스타일 일관성은 유지된다. 일반적인 워크플로우 그래프 규모에서 성능 문제로 보이진 않는다.

이 외 항목(가독성/네이밍/함수 길이/중첩 깊이/매직 넘버)은 문제 없음: `onDrop` 추가분(약 20줄)은 단일 책임(엣지 hit-test → 분할 계획 조립 → 적용)을 유지하며 중첩 2단 이내, 주석이 각 단계의 의도(§4.1, undo 단일화)를 명확히 설명한다. `firstOutputHandleId`/`isContainerBoundaryEdge`/`buildEdgeSplitPlan`/`findEdgeIdAtPoint` 는 각각 단일 책임의 순수 함수로 짧고, 기존 `firstInputHandleId`/`buildAutoConnectConnection` 네이밍 컨벤션과 대칭을 이뤄 일관적이다. `removeEdge` 의 `{skipUndo}` 옵션 추가는 `onConnect` 의 기존 패턴과 대칭이라 코드베이스 관행에 부합한다. 테스트(`edge-utils.test.ts`, `editor-store.test.ts`)는 핸들 보존·emit 제외·트리거/sink·컨테이너 제외 등 분기를 고르게 커버하며 기존 describe/it 스타일을 따른다. CHANGELOG/plan/spec R-3 간 서술 중복은 이 프로젝트의 SDD 다중 SoT(스펙 Rationale·plan·CHANGELOG 동시 기록) 관행에 따른 의도된 반복이라 코드 중복 문제로 보지 않는다.

## 요약

전체적으로 가독성·네이밍·함수 길이·중첩 깊이는 기존 코드베이스 컨벤션과 잘 맞고 테스트도 꼼꼼하다. 다만 신규 `isContainerBoundaryEdge` 가 "컨테이너 경계 판정"이라는 이미 두 곳(같은 파일의 `resolvePortType`, `editor-store.ts` 의 `detectContainerConflict`/`propagateContainerOnConnect`)에 정밀하게 구현된 개념을 노드 타입 검사 없이 핸들 이름만으로 재구현하면서, Parallel Branch 노드의 일반 데이터 출력 포트(`done`)가 우연히 예약 핸들 이름과 충돌해 엣지 분할이 조용히 생략되는 실질적 회귀 위험을 만들었다 — 전형적인 "동일 개념의 정밀도가 다른 중복 구현" 패턴으로, 착수 전 impl-prep 이 지적한 "컨테이너 경계 상호작용" 갭이 완전히 해소되지 않았음을 시사한다. 이 한 건을 제외하면 나머지는 사소한 개선 여지(타입 재사용)만 있는 수준이다.

## 위험도

MEDIUM
