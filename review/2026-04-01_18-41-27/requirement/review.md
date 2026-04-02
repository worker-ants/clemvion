## 발견사항

### [WARNING] Form 노드 blocking 후 실행 재개 시 `execution.started` 이벤트 재사용
- **위치**: `execution-engine.service.ts` - `waitForFormSubmission()` 메서드 내 재개 이벤트 방출
- **상세**: 폼 제출 후 실행을 재개할 때 `EXECUTION_STARTED` 이벤트를 방출함. 프론트엔드 `handleExecutionStarted`는 `startExecution()`을 호출하므로 **기존 히스토리와 상태가 리셋**될 수 있음.
- **제안**: 재개용 이벤트(`execution.resumed` 또는 별도 `EXECUTION_RESUMED` 타입)를 추가하거나, 프론트엔드에서 `execution.started` 수신 시 executionId가 현재와 동일하면 리셋하지 않도록 처리 필요.

---

### [WARNING] `handleWaitingForInput`이 `waitingNodeType !== "form"`인 경우 무시
- **위치**: `use-execution-events.ts:94-102`
- **상세**: 스펙 §10.1에는 "Form만 실행을 일시 정지"한다고 명시되어 있어 현재 구현이 스펙에 부합하지만, `waiting_for_input` 이벤트 수신 시 `waitingNodeType`이 `"form"`이 아닌 경우 **아무것도 하지 않음** — 이 케이스가 실제로 발생할 경우 실행이 영원히 블록됨.
- **제안**: 알 수 없는 `waitingNodeType`에 대해 경고 로그를 남기거나, 안전하게 `continueExecution`을 호출하는 폴백 처리 추가.

---

### [WARNING] 폴링 중 `waiting_for_input` 상태에서 formConfig 없으면 `pauseForForm(nodeId, null)` 호출
- **위치**: `use-execution-events.ts:242-256`
- **상세**: 폴링 응답에서 `waiting_for_input` 노드를 찾았으나 `outputData`가 없거나 `type !== "form"`이면 `pauseForForm`이 호출되지 않음 — 실행이 `waiting_for_input` 상태로 보이지만 프론트엔드는 여전히 `running` 상태를 유지함. 반면 `outputData`에 `type === "form"`이지만 `formConfig`가 null이면 `pauseForForm(nodeId, null)`이 호출되어 드로어에 빈 폼이 렌더링됨.
- **제안**: `formConfig`가 null인 경우 처리 분기 추가. 폼 없이 대기 중인 상태에 대한 처리 명확화.

---

### [WARNING] `continueExecution` REST 엔드포인트에 인증 미적용
- **위치**: `executions.controller.ts:39-47`
- **상세**: `POST /executions/:id/continue`에 `@UseGuards` 또는 인증 관련 데코레이터가 없음. 컨트롤러 레벨 가드가 없다면 인증 없이 임의의 execution을 재개할 수 있음.
- **제안**: 글로벌 JWT 가드가 적용되어 있는지 확인하거나 명시적으로 `@UseGuards(JwtAuthGuard)` 추가. 또한 요청자가 해당 execution의 소유자인지 검증 필요.

---

### [WARNING] `ExecutionsService.stop()`이 DB를 업데이트하지만 `ExecutionEngineService.cancelWaitingExecution()`은 호출되지 않음
- **위치**: `executions.service.ts:80-98`
- **상세**: `stop()` API는 `WAITING_FOR_INPUT` 상태의 execution을 `CANCELLED`로 DB에 저장하지만, 메모리 내 `pendingContinuations`에서 해당 executionId의 Promise를 reject하지 않음 → 인메모리 실행은 계속 대기 상태로 남아 메모리 누수 및 이후 상태 불일치 발생.
- **제안**: `ExecutionsService.stop()`에서 `ExecutionEngineService.cancelWaitingExecution(executionId)`도 호출하도록 수정. 또는 `ExecutionEngineModule`을 `ExecutionsModule`에서 import하므로 `ExecutionEngineService`를 주입하여 처리.

---

### [WARNING] WebSocket `execution.submit_form` 핸들러에 인증 없음
- **위치**: `websocket.gateway.ts:156-178`
- **상세**: `handleSubmitForm`은 클라이언트로부터 `executionId`를 받아 그대로 사용하지만, 해당 클라이언트가 이 execution에 접근 권한이 있는지 검증하지 않음. 악의적인 클라이언트가 타인의 폼을 제출할 수 있음.
- **제안**: `@ConnectedSocket() client: Socket`을 추가하여 `client.userId`와 execution의 소유자를 비교 검증.

---

### [INFO] `DynamicFormUI`에서 `required` 검증이 HTML 네이티브에만 의존
- **위치**: `run-results-drawer.tsx` - `DynamicFormUI` 컴포넌트
- **상세**: `required` 속성이 `checkbox` 타입에는 적용되지 않음. `renderField`의 `checkbox` 케이스에 `required` prop이 없어, 필수 체크박스를 강제할 수 없음. 또한 클라이언트 측 JS 검증 없이 HTML `required`만 사용하므로 커스텀 컴포넌트(textarea 등)에서 브라우저 네이티브 동작에 의존.
- **제안**: 폼 제출 시 JS 레벨에서 required 필드 검증 추가, 특히 checkbox 타입에 대한 처리.

---

### [INFO] `HistoryEntry`의 `result` prop이 없을 때 `nodeType`이 항상 `"form"`으로 고정
- **위치**: `run-results-drawer.tsx:340`
- **상세**: `const nodeType = result?.nodeType ?? "form"` — 대기 중인 항목에서 result가 없으면 nodeType이 "form"으로 fallback되는데, 이는 현재 스펙 상 올바름. 그러나 미래에 form 외 다른 대기 유형이 생기면 문제 발생 가능.
- **제안**: `waitingNodeType` prop을 별도로 받거나 명시적인 타입 기반 처리로 개선.

---

### [INFO] 스펙 §3.4 Form 노드 대기 상태 바 포맷과 실제 구현 불일치
- **위치**: `run-results-drawer.tsx` - statusLabel 처리
- **상세**: 스펙 §3.4에는 `⏸ Waiting for input   "Approval Form"` 형태로 Form 노드의 **라벨을 포함**해야 한다고 명시. 현재 구현은 `"Waiting for input..."` 문자열만 표시하고 Form 노드 라벨은 포함하지 않음.
- **제안**: `waitingNodeId`에 해당하는 노드 라벨을 `waitingFormConfig`의 `title` 또는 `nodeStatuses`에서 가져와 표시.

---

### [INFO] `execution.service.ts`의 `cancelWaitingExecution`이 이미 삭제된 키에 대해 조용히 실패
- **위치**: `execution-engine.service.ts:430-435`
- **상세**: pending이 없으면 아무것도 하지 않음 (no-op). 이미 완료된 execution에 대해 cancel을 호출해도 오류 없이 무시됨. `continueExecution`은 에러를 throw하는 반면 cancel은 그렇지 않아 API 행동이 비대칭.
- **제안**: 일관성을 위해 이미 완료된 execution에 대한 cancel 호출을 로그로 기록하거나 경고 반환.

---

## 요약

이번 변경은 Form 노드 blocking/resuming의 핵심 흐름(백엔드 Promise 기반 대기, WebSocket/REST 재개 엔드포인트, 프론트엔드 채팅형 히스토리 UI)을 전반적으로 잘 구현하였으며 스펙 §10의 요구사항을 대부분 충족한다. 그러나 가장 심각한 결함은 **`ExecutionsService.stop()`이 WAITING_FOR_INPUT 상태의 인메모리 Promise를 정리하지 않아 메모리 누수와 상태 불일치가 발생**하는 부분이며, **WebSocket과 REST 엔드포인트 모두에서 execution 소유권 검증이 없어** 권한 없는 폼 제출이 가능하다. 또한 폼 재개 시 `EXECUTION_STARTED` 이벤트를 재사용하는 것은 프론트엔드 상태를 의도치 않게 리셋할 위험이 있어 수정이 필요하다.

## 위험도

**MEDIUM**