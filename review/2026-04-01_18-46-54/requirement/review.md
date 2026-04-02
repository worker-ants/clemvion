### 발견사항

---

**[WARNING]** Form 노드 실행 후 `waitForFormSubmission` 호출 순서 문제
- 위치: `execution-engine.service.ts` L267-276
- 상세: `executeNode()`가 완료된 후 `waitForFormSubmission()`을 호출하는데, `executeNode()` 내부에서 이미 `nodeExecution.status = COMPLETED`로 저장하고 `NODE_COMPLETED` 이벤트를 emit한다. 이후 `waitForFormSubmission()`에서 동일 nodeExecution을 다시 `WAITING_FOR_INPUT`으로 변경하려 시도하지만, `findOne()`으로 DB에서 재조회하기 때문에 타이밍 경쟁 없이 동작은 하나, 프론트엔드는 `NODE_COMPLETED` 이벤트를 먼저 받고 곧이어 `EXECUTION_WAITING_FOR_INPUT`을 받는 이중 상태 전이가 발생한다.
- 제안: Form 핸들러가 실행 결과를 반환한 후 COMPLETED 저장 이전에 waiting 전환하거나, Form 타입 노드는 `executeNode()` 내에서 NODE_COMPLETED를 emit하지 않도록 분기 처리

---

**[WARNING]** `cancelWaitingExecution()` 공개 API이나 호출 경로 없음
- 위치: `execution-engine.service.ts` L432-438, `websocket.gateway.ts` 전체
- 상세: `cancelWaitingExecution()`가 구현되어 있으나 WebSocket 게이트웨이나 REST 컨트롤러 어디에도 이를 호출하는 핸들러가 없다. 사용자가 Form 대기 중에 실행을 취소할 방법이 없음.
- 제안: `execution.cancel_form` WebSocket 이벤트 핸들러 또는 REST DELETE `/executions/:id` 엔드포인트에서 `cancelWaitingExecution()` 호출 추가

---

**[WARNING]** `handleNodeCompleted`에서 node output의 `type` 필드 의존성 불안정
- 위치: `use-execution-events.ts` L123-158
- 상세: 프레젠테이션 노드 결과를 식별하는 기준이 `output.type` 필드 존재 여부인데, 백엔드 `FormHandler`, `TableHandler` 등이 output에 `type` 필드를 실제로 포함하는지 보장이 없다. WebSocket `NODE_COMPLETED` 이벤트 payload 구조와 polling의 `ne.outputData` 구조가 동일하다고 가정하나, 이벤트 emit 시 `output` 필드를 포함하는지 확인 필요.
- 제안: 백엔드 `NodeEventType.NODE_COMPLETED` emit 시 output을 명시적으로 포함시키도록 확인하거나, nodeType은 node 메타데이터에서 별도로 전달

---

**[WARNING]** polling 중 `waiting_for_input` 상태에서 formConfig 누락 시 무한 폴링 가능
- 위치: `use-execution-events.ts` L230-250
- 상세: `execution.status === "waiting_for_input"`이나 `waitingNode?.outputData`가 없거나 `output.type !== "form"`인 경우 `pauseForForm()`이 호출되지 않고 `return false`로 폴링이 계속된다. 이 상태가 유지되면 2초마다 API를 계속 호출하게 된다.
- 제안: waiting 상태에서 formConfig를 찾지 못해도 `pauseForForm(nodeId, null)`을 호출하여 UI 상태는 waiting으로 전환하거나, 폴링 최대 횟수 제한 추가

---

**[INFO]** `resumeFromForm()` 호출 후 실제 WebSocket 이벤트 수신 전 상태 불일치
- 위치: `run-results-drawer.tsx` `handleFormSubmit`, `execution-store.ts` `resumeFromForm`
- 상세: 폼 제출 시 즉시 `status: "running"`으로 전환하지만, 서버에서 실제로 실행이 재개되기 전까지 UI는 "Running..." 상태를 표시한다. 네트워크 지연이나 서버 오류 시 "Running..."이 영구 표시될 수 있다.
- 제안: 폼 제출 후 `execution.form_submitted` 응답의 `success: false` 케이스를 `useExecutionStore`와 연동하여 처리 필요

---

**[INFO]** `handleSubmitForm`에서 `@ConnectedSocket()` 없어 인증 검증 불가
- 위치: `websocket.gateway.ts` L156-177
- 상세: `execution.submit_form` 핸들러가 `executionId`만 받고 해당 소켓이 실제로 그 execution을 소유한 사용자인지 검증하지 않는다. 다른 사용자가 임의의 `executionId`로 폼을 제출할 수 있다.
- 제안: `@ConnectedSocket() client: Socket`을 추가하고 `client.userId`가 해당 execution의 소유자인지 검증

---

**[INFO]** `DynamicFormUI`에서 `required` 검증이 HTML 기본 동작에만 의존
- 위치: `run-results-drawer.tsx` `DynamicFormUI`
- 상세: `required` 필드 검증이 브라우저 native validation에만 의존하며, JavaScript 레벨의 명시적 검증 없음. 커스텀 컴포넌트(`textarea`, `select`)는 form submit 시 일부 브라우저에서 native validation이 트리거되지 않을 수 있음.
- 제안: `handleSubmit`에서 required 필드 값이 비어있는지 명시적으로 검증 추가

---

### 요약

핵심 기능인 Form 노드의 실행 중단 → 사용자 입력 대기 → 재개 흐름은 전반적으로 올바르게 구현되어 있다. 백엔드의 `pendingContinuations` Map을 활용한 Promise 기반 blocking 패턴, 프론트엔드의 WebSocket + polling 이중 경로, 동적 폼 렌더링까지 요구사항의 주요 흐름을 충족한다. 다만 Form 노드 실행 완료 후 대기 전환 시의 이중 상태 이벤트, 취소 기능의 미노출, 폼 제출자 인증 부재가 운영 환경에서 문제가 될 수 있으며, 특히 보안 관점의 인증 검증 누락과 취소 API 미완성이 기능 완전성 면에서 보완이 필요하다.

### 위험도

**MEDIUM**