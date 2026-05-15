## 유지보수성 코드 리뷰

### 발견사항

---

**[WARNING] `waitForFormSubmission` 메서드의 과도한 책임**
- 위치: `execution-engine.service.ts` — `waitForFormSubmission()`
- 상세: 단일 메서드가 상태 전환, DB 업데이트(Execution + NodeExecution), WebSocket 이벤트 발행, Promise 대기, 출력 병합까지 ~60줄에 걸쳐 처리하고 있음. SRP 위반 수준.
- 제안: `updateNodeToWaiting()`, `mergeFormDataIntoOutput()` 등 세분화하거나 최소한 논리 블록별로 private helper로 분리.

---

**[WARNING] 프레젠테이션 노드 타입 감지 로직의 중복**
- 위치: `use-execution-events.ts` L29-36, `run-results-drawer.tsx` 내 `ResultContent` switch, `NodeTypeIcon` switch, `renderField` switch
- 상세: `PRESENTATION_TYPES` Set은 프론트엔드에만 있고, 백엔드에는 동등한 상수가 없음. 또한 동일한 노드 타입 목록을 여러 switch문에서 반복 처리.
- 제안: 노드 타입을 단일 상수(`PRESENTATION_NODE_TYPES`)로 정의하고 공유. 백엔드 핸들러 등록 시에도 동일 타입 목록 참조.

---

**[WARNING] `run-results-drawer.tsx` 파일 크기 (~550줄 추가)**
- 위치: `run-results-drawer.tsx` 전체
- 상세: 단일 파일에 `NodeTypeIcon`, `TableContent`, `CarouselContent`, `ChartContent`, `TemplateContent`, `PdfContent`, `FormSubmittedContent`, `JsonContent`, `ResultContent`, `DynamicFormUI`, `renderField`, `HistoryEntry`, `RunResultsDrawer` 13개 컴포넌트/함수가 모두 존재. 변경 시 영향 범위가 넓고 컴포넌트 단위 테스트가 불가능.
- 제안: `presentation-renderers/` 디렉토리로 분리 (예: `table-content.tsx`, `dynamic-form-ui.tsx`, `history-entry.tsx`).

---

**[WARNING] `renderField` 함수가 컴포넌트 외부에 노출된 순수하지 않은 패턴**
- 위치: `run-results-drawer.tsx` — `renderField()` 함수
- 상세: `renderField`가 JSX를 반환하는 헬퍼 함수로 선언되었지만, React 컴포넌트 규칙을 따르지 않음(대문자 아님, Hook 사용 불가). 향후 내부에 `useState`가 필요해질 경우 리팩터링 비용이 큼.
- 제안: `FormField` 컴포넌트로 승격시켜 일반 컴포넌트로 관리.

---

**[WARNING] `forwardRef` 순환 의존성 — 설계 냄새**
- 위치: `websocket.module.ts` ↔ `execution-engine.module.ts`, `websocket.gateway.ts` ↔ `execution-engine.service.ts`
- 상세: 양방향 `forwardRef` 의존성은 모듈 경계가 잘못 설계되었음을 나타냄. `WebsocketGateway`가 `ExecutionEngineService`를 직접 참조하는 것은 레이어 역전.
- 제안: `execution.submit_form` WebSocket 이벤트 처리를 별도 `ExecutionWebsocketHandler` 서비스로 분리하거나, 이벤트 버스(EventEmitter) 패턴으로 간접 참조.

---

**[WARNING] `handleWaitingForInput`의 조건부 무시**
- 위치: `use-execution-events.ts` — `handleWaitingForInput()`
- 상세: `payload.waitingNodeType !== 'form'`인 경우 아무 처리도 하지 않고 조용히 무시됨. 추후 다른 타입의 `waiting_for_input`이 추가될 경우 디버깅이 어려움.
- 제안: `else` 분기에 `console.warn` 또는 로깅 추가.

---

**[INFO] `continueExecution` 에러 메시지가 내부 구현 정보를 노출**
- 위치: `execution-engine.service.ts` — `continueExecution()` L451 근방
- 상세: `throw new Error('No pending continuation for execution: ${executionId}')` 메시지가 그대로 WebSocket 클라이언트에 전달됨 (`websocket.gateway.ts`의 catch 블록).
- 제안: `BadRequestException` 또는 커스텀 도메인 에러 사용. Gateway에서 외부 노출 메시지를 별도로 정의.

---

**[INFO] `DynamicFormUI`의 초기값 계산이 렌더링 시마다 재실행 가능**
- 위치: `run-results-drawer.tsx` — `DynamicFormUI` `useState` 초기화
- 상세: `useState(() => {...})` lazy initializer를 사용하고 있어 올바르지만, `fields` 배열 변경 시 상태가 갱신되지 않음. `formConfig` prop이 변경되면 폼 값이 stale해짐.
- 제안: `useEffect`로 `fields` 변경 감지 후 초기화하거나, `key={JSON.stringify(formConfig)}`로 컴포넌트 리마운트 유도.

---

**[INFO] 폴링과 WebSocket 이벤트의 중복 처리 경로**
- 위치: `use-execution-events.ts` — `pollExecutionStatus()` + `handleWaitingForInput()`
- 상세: `waiting_for_input` 상태는 WebSocket 이벤트(`handleWaitingForInput`)와 폴링(`pollExecutionStatus` 내 else-if 블록) 두 경로에서 동일한 `pauseForForm` 호출을 중복으로 수행. 두 경로가 동시에 실행될 경우 이중 호출 가능.
- 제안: 폴링에서 이미 `waiting_for_input` 상태이고 `waitingNodeId`가 동일하면 `pauseForForm`을 스킵하는 idempotency 가드 추가.

---

**[INFO] `__execution__` 매직 스트링**
- 위치: `execution-store.ts` — `failExecution()`, 테스트 코드
- 상세: `"__execution__"`이 여러 파일에 하드코딩되어 있음.
- 제안: `EXECUTION_ERROR_KEY = '__execution__'` 상수로 추출하여 export.

---

### 요약

이번 변경은 Form 노드의 blocking 실행을 구현하는 의미있는 기능 추가이며 전반적인 구조는 합리적이다. 그러나 몇 가지 유지보수성 우려사항이 있다. 가장 큰 문제는 **`WebsocketModule` ↔ `ExecutionEngineModule`의 양방향 순환 의존성**으로 향후 모듈 확장과 테스트를 어렵게 만들며, **`run-results-drawer.tsx`의 과도한 파일 크기**는 컴포넌트 단위 관리를 불가능하게 한다. `waitForFormSubmission` 메서드 역시 단일 책임 원칙을 위반하는 수준의 복잡도를 가지고 있다. 폴링과 WebSocket 이중 경로에서의 `pauseForForm` 중복 호출은 잠재적 idempotency 버그를 내포한다. 전반적으로 기능은 완성도 있게 구현되었으나, 모듈 경계 설계와 파일 분리 측면에서 개선이 필요하다.

### 위험도

**MEDIUM**