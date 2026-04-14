### 발견사항

---

**[WARNING]** `ExecutionDetailPage`에서 스토어 리셋 후 `useExecutionEvents` 호출 순서 문제
- 위치: `page.tsx:75-82`
- 상세: `resetStore()`가 `useEffect`로 실행되어 비동기이므로, 컴포넌트 첫 마운트 시 `useExecutionEvents`가 이미 상태를 채우기 시작한 뒤 리셋이 적용될 가능성이 있습니다. `executionId`가 변경될 때 동일 렌더 사이클 내에서 처리되지 않으면 이전 실행의 대기 상태가 잠깐 표시될 수 있습니다.
- 제안: 리셋을 `useEffect` 밖으로 빼거나, `useExecutionEvents`가 `executionId` 변경 시 자체적으로 클린업하는 구조로 설계 검토

---

**[WARNING]** 렌더 중 setState 호출 (derived-state 패턴)
- 위치: `page.tsx:345-349`
- 상세: 렌더 함수 본문에서 `setLastAutoSelectedWaiting`, `setSelectedNodeId`, `setNodeDetailTab`를 직접 호출하는 방식은 React의 규칙 위반입니다. 이는 추가 렌더를 즉각 유발하며, 특정 시나리오에서 무한 루프나 예기치 않은 동작을 일으킬 수 있습니다. 주석에서 "derived-state 패턴"이라고 설명하고 있으나, 이는 `useEffect`로 처리해야 하는 케이스입니다.
- 제안: `useEffect`로 전환하거나 `useMemo`로 계산된 값으로 처리

---

**[WARNING]** `NodeResultsTab`의 `waitingNodeId`가 `nodeExecutions` 목록에 없을 때 처리 누락
- 위치: `page.tsx:345-349`
- 상세: `waitingNodeId`로 auto-select 시 해당 nodeId가 `nodeExecutions` 배열에 아직 없는 경우(대기 이벤트가 노드 실행 데이터보다 먼저 도달한 경우), `selectedNode`가 null이 됩니다. 이 경우 Preview 탭이 `selectedNodeResult`가 null이어서 렌더링되지 않지만, `isSelectedWaiting`은 true가 됩니다.
- 제안: `waitingNodeId`가 존재하지만 `nodeExecutions`에 없는 경우 인터랙션 UI를 직접 렌더링하는 폴백 처리 필요

---

**[WARNING]** `ExecutionDetailPage`에서 `useExecutionEvents`와 `executionQuery.refetchInterval` 중복 폴링
- 위치: `page.tsx:96-103`
- 상세: `useExecutionEvents`가 자체 폴링 로직을 포함하고 있고(`// REST polling`), `executionQuery`도 2초마다 refetch합니다. 두 개의 독립적인 폴링이 동시에 실행되면 백엔드에 불필요한 부하가 발생합니다.
- 제안: 한쪽으로 폴링 책임을 통합하거나, `useExecutionEvents`의 폴링 결과를 react-query 캐시로 업데이트하는 단일 흐름 고려

---

**[INFO]** `isWaitingButtons`이면서 `isPresentation`인 경우 `PresentationContent`가 렌더링되지만 outputData가 null인 상황 처리 불명확
- 위치: `page.tsx:540-550`
- 상세: 노드가 `waiting_for_input` 상태이고 `outputData`가 null인 경우, `PresentationContent`에 `result.outputData === null`이 전달됩니다. `PresentationContent` 컴포넌트가 이를 처리하는지 확인이 필요합니다.
- 제안: null outputData 케이스에 대한 `PresentationContent` 동작 확인 및 필요시 가드 추가

---

**[INFO]** `use-execution-interaction-commands.test.ts` — `sendMessage` 테스트가 `turnIndex` 계산을 이미 메시지가 0개인 초기 상태에서만 검증
- 위치: `use-execution-interaction-commands.test.ts:54-72`
- 상세: 여러 메시지를 연속으로 보낼 때 `turnIndex`가 정확히 증가하는지 검증하는 테스트가 없습니다.
- 제안: 두 번 이상 `sendMessage` 호출 후 `turnIndex` 누적 증가 검증 테스트 추가

---

**[INFO]** `execution-detail-waiting.test.tsx` — 전송 후 스토어 상태가 `resumeFrom*`으로 초기화되는지 검증 없음
- 위치: `execution-detail-waiting.test.tsx:all`
- 상세: 테스트가 WebSocket emit만 검증하고, 실제로 `resumeFromForm`, `resumeFromButtons` 등이 호출되어 대기 상태가 해제되는지 확인하지 않습니다. 버튼 클릭 후 UI가 대기 상태에서 벗어나는 것을 검증하는 assertion이 없습니다.
- 제안: submit/click 후 `useExecutionStore.getState().waitingNodeId`가 null이 되는지 등의 상태 초기화 검증 추가

---

**[INFO]** `result-detail.tsx`에서 `onSendMessage` prop 제거 후 `ResultDetail` 사용처 일관성
- 위치: `result-detail.tsx:244`, `run-results-drawer.tsx:378`
- 상세: `onSendMessage` prop이 제거되어 `ResultDetail`이 내부적으로 `useExecutionInteractionCommands`를 사용하도록 변경되었습니다. 드로어에서 `handleSendMessage`(store 업데이트 포함)가 제거되고 commands 훅으로 이동했습니다. 이 리팩토링은 일관성이 있습니다.
- 제안: 해당 없음 (정상 변경)

---

### 요약

이번 변경사항은 실행 대기(waiting_for_input) 상태의 인터랙션 기능을 에디터 내 드로어뿐 아니라 실행 상세 페이지(`ExecutionDetailPage`)에서도 동작하도록 확장한 것입니다. 핵심 리팩토링인 `useExecutionInteractionCommands` 훅 추출은 코드 중복을 제거하고 WebSocket 명령 로직을 명확히 집중시킨 점에서 방향이 올바릅니다. 다만 렌더 함수 본문 내 직접 setState(React 규칙 위반), 스토어 리셋과 이벤트 구독 간의 경쟁 조건, 이중 폴링으로 인한 중복 요청 등 런타임에서 문제가 될 수 있는 WARNING 수준 이슈가 존재합니다. 테스트는 주요 경로를 커버하나 상태 정상화 검증 및 다중 메시지 턴 케이스가 부족합니다.

### 위험도

**MEDIUM**