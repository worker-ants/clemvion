### 발견사항

---

**[INFO]** `ExecutionCancelledError` 클래스 문서 부재
- 위치: `execution-engine.service.ts:66-71`
- 상세: 파일 최상위에 정의된 커스텀 에러 클래스에 JSDoc이 없음. 언제, 왜 이 에러가 던져지는지 불명확
- 제안:
  ```ts
  /**
   * Thrown when an execution is cancelled while waiting for user input
   * (e.g. via cancelWaitingExecution). Causes the execution to be marked
   * CANCELLED rather than FAILED.
   */
  class ExecutionCancelledError extends Error { ... }
  ```

---

**[INFO]** `waitForFormSubmission` 내 "resume" 이벤트로 `EXECUTION_STARTED` 재사용
- 위치: `execution-engine.service.ts:420-424`
- 상세: 재개 시 `EXECUTION_STARTED` 이벤트를 emit하는데, 이 이벤트는 이미 실행 시작 시 사용됨. 주석에 "Transition back to RUNNING" 이라고만 되어 있어 프론트엔드 개발자가 오해할 수 있음
- 제안: 인라인 주석 보강
  ```ts
  // Re-emit EXECUTION_STARTED to signal the frontend that execution has resumed.
  // A dedicated EXECUTION_RESUMED event would be clearer, but reuses the existing event type.
  ```

---

**[INFO]** `handleSubmitForm` — 입력 유효성 미문서화
- 위치: `websocket.gateway.ts:156-183`
- 상세: `data.executionId`가 없거나 빈 문자열인 경우의 동작이 문서화되지 않음. 현재는 `continueExecution` 내부에서 에러가 throw되어 catch되지만, 호출자 입장에서 예상되는 payload 구조가 명확하지 않음
- 제안:
  ```ts
  /**
   * Handles form submission for a waiting execution.
   * @param data.executionId - The ID of the execution waiting for input
   * @param data.formData - The form field values submitted by the user
   * @returns `{ success: true }` on success, `{ success: false, error }` if no pending continuation exists
   */
  @SubscribeMessage('execution.submit_form')
  handleSubmitForm(...) { ... }
  ```

---

**[INFO]** `DynamicFormUI` / `renderField` — FormField 인터페이스 문서 부재
- 위치: `run-results-drawer.tsx:FormField interface`
- 상세: `FormField` 인터페이스가 백엔드 `FormHandler`의 출력 스키마와 1:1 대응되어야 하나 이를 명시하는 주석이 없음. `type` 필드의 허용값(`text | textarea | number | email | date | select | radio | checkbox`)도 문서화되지 않음
- 제안:
  ```ts
  /**
   * Form field descriptor emitted by the backend FormHandler node.
   * `type` must be one of: text | textarea | number | email | date | select | radio | checkbox
   */
  interface FormField { ... }
  ```

---

**[INFO]** `waitingFormConfig: unknown` 타입 — 의도 불명확
- 위치: `execution-store.ts:40`
- 상세: `unknown` 타입 사용이 적절하나, 실제로는 `FormField[]` 기반 객체임. 주석 한 줄이 전부임. 실제 런타임 shape를 알려주는 설명이 없어 store를 처음 보는 개발자가 혼란스러울 수 있음
- 제안:
  ```ts
  /**
   * Form node configuration while waiting for user input.
   * Shape: { title?: string; description?: string; fields: FormField[]; submitLabel?: string }
   * Null when not waiting.
   */
  waitingFormConfig: unknown;
  ```

---

**[INFO]** `PRESENTATION_TYPES` 상수 — 출처 미기재
- 위치: `use-execution-events.ts:21-28`
- 상세: 이 Set이 백엔드 NodeHandler 등록 목록의 subset임이 문서화되어 있지 않음. 새 프레젠테이션 노드 타입 추가 시 이 Set도 동기화해야 한다는 경고가 없음
- 제안:
  ```ts
  /**
   * Node types whose output should be displayed in the results drawer.
   * Must stay in sync with presentation handlers registered in ExecutionEngineService.registerHandlers().
   */
  const PRESENTATION_TYPES = new Set([...]);
  ```

---

**[INFO]** `handleWaitingForInput` — `waitingNodeType === "form"` 조건 의도 불명확
- 위치: `use-execution-events.ts:88-100`
- 상세: Form 타입만 처리하고 나머지 waiting 타입은 무시하는 이유가 주석으로 설명되어 있지 않음. 향후 다른 노드 타입이 waiting 상태를 가질 수 있을 때 혼란 유발 가능
- 제안: `// Currently only 'form' nodes can enter waiting state` 인라인 주석 추가

---

**[WARNING]** `ChartContent` / `TemplateContent` — XSS 위험 미경고
- 위치: `run-results-drawer.tsx:ChartContent, TemplateContent`
- 상세: `dangerouslySetInnerHTML` 사용 시 백엔드가 안전한 HTML을 반환한다는 전제를 문서화해야 함. 주석 없이 사용하면 코드 리뷰어가 의도적 선택인지 누락인지 판단 불가
- 제안:
  ```tsx
  {/* Rendered HTML is sanitized by the backend ChartHandler before emission */}
  <div dangerouslySetInnerHTML={{ __html: data.rendered }} />
  ```

---

**[INFO]** README / CHANGELOG 업데이트 미확인
- 상세: Form 노드 대기 입력 기능은 사용자 대면 워크플로우에 영향을 미치는 주요 기능이나, README나 CHANGELOG에 WebSocket 이벤트(`execution.submit_form`, `execution.waiting_for_input`) 추가가 반영되었는지 확인 필요

---

### 요약

전반적으로 핵심 메서드(`waitForFormSubmission`, `continueExecution`, `cancelWaitingExecution`)에 JSDoc이 잘 작성되어 있고 인라인 주석도 적절히 사용되었습니다. 다만 `FormField` 인터페이스의 허용 타입 명세, `PRESENTATION_TYPES`와 백엔드 핸들러 간의 동기화 책임, `dangerouslySetInnerHTML` 사용의 안전 전제, 그리고 신규 WebSocket 이벤트에 대한 외부 문서(README/API 문서) 업데이트가 누락된 점이 아쉽습니다. 특히 `dangerouslySetInnerHTML`에 안전성 근거 주석이 없는 점은 보안 리뷰 관점에서 Warning 수준입니다.

### 위험도

**LOW**