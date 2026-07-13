### 발견사항

- **[WARNING]** "nodeId 의 최신 실행 결과" 조회 로직 3중 중복 + 문서가 주장하는 추상화(`findNodeResult`)와 실제 구현 불일치
  - 위치: `codebase/frontend/src/components/editor/canvas/edge-data-preview.tsx` `useEdgeFlowData`(신규) vs `codebase/frontend/src/components/editor/settings-panel/node-settings-panel.tsx` `InfoTab`(기존)
  - 상세: `useEdgeFlowData` 는 `nodeResults` 배열을 뒤에서부터 선형 스캔해 `nodeId` 매치되는 첫 항목(=최신)을 찾는다. 그런데 **동일한 로직이 이미 `node-settings-panel.tsx` `InfoTab`에 거의 동일한 코드(같은 역순 for 루프 + 같은 주석 "도착 순서라 뒤에서 첫 매치가 최신")로 존재한다**. 여기에 더해 `use-expression-context.ts`/`transform/preview.tsx` 는 `selectSortedNodeResults` 로 정렬된 프로젝션 위에서 유사한 역순 스캔을 한다 — 즉 "nodeId 로 최신 결과 찾기"가 이미 세 군데에서 서로 다른 변형(raw 배열 순, sorted 프로젝션 순)으로 재구현되어 있고, 이번 PR 이 그 목록에 네 번째(사실상 세 번째 변형과 동일)를 추가한다. 한편 store(`execution-store.ts`) 는 이미 이 클래스의 문제를 O(1) 로 풀기 위해 `nodeResultIndexByExecId`/`lastIndexByNodeId`/`firstNoExecIdIndexByNodeId` 인덱스 맵과 공개 액션 `findNodeResult(nodeExecutionId, nodeId)`(주석: "O(1) replacement for the 4 `.find()` sites")를 두고 있는데, 이 신규 코드도 기존 `InfoTab` 도 그 공개 API 를 쓰지 않고 raw 배열을 직접 스캔한다.
    또한 `edge-data-preview.tsx` 의 JSDoc, `CHANGELOG.md`, `spec/3-workflow-editor/2-edge.md §5` 세 곳 모두 "엣지 source 노드 실행 결과를 `findNodeResult` 로 찾아"라고 서술하지만, 실제 코드는 `findNodeResult` 를 import/호출하지 않는다(그리고 `findNodeResult`의 실제 시그니처는 nodeExecutionId 가 없을 때 "nodeExecutionId 없이 기록된 첫 항목"을 반환하도록 설계돼 있어, 이 훅이 원하는 "nodeId 최신 항목"과 의미도 다르다). 설계 의도(문서)와 실제 구현이 어긋난 상태다.
  - 제안: `execution-store.ts` 에 `lastIndexByNodeId` 를 활용하는 공개 선택자(예: `findLatestResultByNodeId(nodeId)`)를 추가해 `edge-data-preview.tsx`·`node-settings-panel.tsx`·(가능하면 `use-expression-context.ts`) 가 공유하도록 단일화하고, 문서(JSDoc/CHANGELOG/spec)의 `findNodeResult` 언급을 실제 사용 API 에 맞게 정정한다.

- **[WARNING]** 이미 존재하는 재사용 가능한 JSON 뷰어 컴포넌트를 두고 동일 마크업을 다시 작성
  - 위치: `codebase/frontend/src/components/editor/canvas/edge-data-preview.tsx` (`EdgeDataModal`, `<pre>{JSON.stringify(data, null, 2)}</pre>`)
  - 상세: `components/editor/run-results/renderers/presentation-renderers.tsx` 는 이미 `export function JsonContent({ data }) { return <pre className="...">{JSON.stringify(data, null, 2)}</pre>; }` 를 정의해 `result-detail.tsx` 여러 곳(정확히 같은 데이터인 `unwrapNodeOutput(result.outputData).output` 포함)에서 재사용 중이다. `EdgeDataModal` 은 거의 동일한 마크업(다른 Tailwind 클래스만 약간 차이)을 인라인으로 새로 작성했다 — "노드 산출값을 pretty-JSON 으로 보여준다"는 동일한 책임이 이제 두 곳에 존재해, 추후 표시 포맷(예: 최대 높이, 줄바꿈, 복사 버튼 등)을 바꿀 때 한쪽만 갱신되는 drift 위험이 생긴다.
  - 제안: `EdgeDataModal` 이 `JsonContent` 를 import 해 재사용하거나(모듈 경계상 부담되면 `JsonContent` 를 `lib/` 혹은 공용 위치로 승격), 최소한 두 구현이 같은 유틸/컴포넌트를 공유하도록 리팩터.

- **[INFO]** `canvas/` → `run-results/` 신규 크로스 임포트 — 모듈 경계 명확화 여지
  - 위치: `codebase/frontend/src/components/editor/canvas/edge-data-preview.tsx:6` `import { unwrapNodeOutput } from "../run-results/output-shape";`
  - 상세: 확인 결과 `canvas/` 디렉터리가 `run-results/` 를 import 하는 최초 사례다(`grep` 전수 확인). `unwrapNodeOutput` 은 노드 실행 산출값의 신/구 shape 을 정규화하는 범용 로직이라 재사용 자체는 타당하지만, 현재 위치(`run-results/output-shape.ts`)는 그 폴더가 소유하는 구현 세부사항처럼 보인다. 이제 두 번째 독립 기능 모듈(`canvas/`)이 직접 의존하게 되면서 "이 유틸은 사실 두 기능이 공유하는 cross-cutting 개념"이라는 사실이 폴더 구조에는 드러나지 않는다.
  - 제안: 당장 급하진 않으나, 향후 세 번째 소비처가 생기기 전에 `output-shape.ts` 를 `lib/utils/` 등 중립 위치로 옮겨 공유 계약임을 명시하는 편이 결합 방향을 더 명확히 한다.

- **[INFO]** 전체 `edges` 배열 prop-drilling → leaf 컴포넌트에서 재탐색
  - 위치: `workflow-canvas.tsx` (JSX 에서 `edges={edges}` 를 `EdgeDataPreviewTooltip`/`EdgeDataModal` 양쪽에 전달) / `edge-data-preview.tsx` `useEdgeFlowData(edgeId, edges)` 내부 `edges.find((e) => e.id === edgeId)`
  - 상세: `onEdgeMouseEnter` 시점에 캔버스는 이미 `RFEdge` 객체(따라서 `edge.source`) 를 쥐고 있는데도 `edgeId` 문자열만 하위로 넘기고, 하위 두 컴포넌트가 각자 전체 `edges` 배열을 받아 동일한 `.find()` 를 반복한다. 기능상 문제는 없지만 필요한 최소 데이터(`sourceNodeId`) 대신 컬렉션 전체를 전달하는 결합이라, `edges` 배열이 구조적으로 바뀔 때마다(엣지 추가/삭제/재연결) 두 leaf 컴포넌트가 불필요하게 재탐색·재렌더 대상이 된다.
  - 제안: hover 시점에 `sourceNodeId` 를 함께 커밋해 `EdgeHoverPreviewState` 에 태우거나, 최소한 `useEdgeFlowData` 시그니처를 `edge: Edge | undefined` 를 직접 받도록 바꿔 두 컴포넌트의 중복 `.find()` 를 제거.

- **[INFO]** `workflow-canvas.tsx` 오케스트레이션 누적 — 기존에 인지된 이슈, 이번 PR 로 한 겹 더 추가
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx`(1034줄, 엣지 관련 훅만 `useEdgeHighlighting`/`useEdgeReconnect`/`useEdgeExecutionState`/`useEdgeHoverPreview` 4개 + 컨텍스트 메뉴·노드 검색 팝업·단일 노드 실행 등 다수 책임 공존)
  - 상세: `plan/in-progress/spec-sync-edge-gaps.md` 자체가 "§1.2 popup 실배선은 컴포넌트 state 결합... 잔여 glue 는 §4 오케스트레이션 정리 시로 이월"이라고 이미 이 파일의 God-component 화를 인지·추적 중이다. 이번 PR 은 그 파일에 `edgeHoverPreview`/`dataModalEdgeId` state 와 두 콜백을 추가로 얹어 부채를 한 겹 더 쌓는다(개별 로직은 `use-edge-hover-preview.ts`/`edge-data-preview.tsx` 로 잘 추출돼 있어 신규 로직 자체의 응집도는 양호). 새로운 결함은 아니나, 확장성 관점에서 이 파일의 오케스트레이션 정리가 계속 미뤄지고 있다는 점은 재확인할 가치가 있다.
  - 제안: 별건 아님 — 기존 계획대로 후속 "§4 오케스트레이션 정리"에서 캔버스 이벤트 배선을 별도 컨테이너/커스텀훅으로 재정리할 때 이번에 추가된 hover/modal 배선도 함께 이동 대상에 포함.

- **[INFO]** (양호한 설계 선택 — 참고) 신규 순수 유틸 `lib/utils/edge-data-preview.ts` 를 이미 390줄인 `edge-utils.ts` 에 얹지 않고 별도 파일로 분리했고, `use-edge-hover-preview.ts` 훅 명명·구조가 형제 훅(`use-edge-reconnect.ts`, `use-edge-execution-state.ts`)과 일관된다. `summarizeDataForPreview`/`formatBytes` 는 React/스토어 의존이 없는 순수 함수로 단위 테스트 10케이스가 딸려 있어 축약 규칙의 응집도가 높다. 순환 의존성은 발견되지 않았다.

### 요약

이번 변경은 엣지 hover 데이터 미리보기 기능을 "순수 축약 함수(`lib/utils/edge-data-preview.ts`) + 타이밍 전용 훅(`use-edge-hover-preview.ts`) + 프레젠테이션 컴포넌트(`edge-data-preview.tsx`) + 오케스트레이터(`workflow-canvas.tsx`)"로 계층을 나눠 구현했고, 형제 엣지 훅들과 명명·구조 일관성을 유지해 전반적인 응집도는 양호하다. 다만 두 가지가 눈에 띈다 — (1) "nodeId 로 최신 실행 결과 찾기" 로직이 `node-settings-panel.tsx`(및 `use-expression-context.ts` 계열)에 이미 존재하는데도 다시 인라인 구현했고, 정작 문서(JSDoc/CHANGELOG/spec)가 주장하는 `findNodeResult` 공개 API 는 실제로 쓰이지 않아 설계 의도와 구현이 어긋나 있다. (2) 전체 데이터 모달이 이미 재사용 가능한 `JsonContent` 컴포넌트와 사실상 동일한 마크업을 다시 작성했다. 순환 의존성·레이어 위반·심각한 SOLID 위반은 없으며, 위 두 항목은 기능 결함이 아니라 유지보수성/일관성 관점의 리팩터 권고에 해당한다.

### 위험도
LOW
