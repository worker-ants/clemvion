---

## 발견사항

### 1. **[WARNING]** `handleSubmitForm` WebSocket 핸들러 테스트 전무
- **위치**: `websocket.gateway.spec.ts`
- **상세**: `WebsocketGateway.handleSubmitForm`이 새로 추가되었으나 테스트가 전혀 없음. 성공 시 `{ success: true }` 반환, 예외 시 `{ success: false, error: message }` 반환하는 두 분기 모두 미검증.
- **제안**: `continueExecution`이 정상 동작할 때와 `throw`할 때의 두 케이스 테스트 추가 필요.

---

### 2. **[WARNING]** `execution.waiting_for_input` WS 이벤트 핸들러 미검증
- **위치**: `use-execution-events.test.ts` - "binds all event handlers" / "WebSocket event handlers update store correctly" 섹션
- **상세**: 폴링 경로의 `waiting_for_input` 처리는 테스트됨(line 218~260). 그러나 실시간 WS 이벤트(`handleWaitingForInput`)를 통한 `pauseForForm` 호출은 테스트가 없음. 또한 "binds all event handlers" 테스트(line 87~101)에서 `execution.waiting_for_input` 이벤트 바인딩 검증이 누락되어 있음.
- **제안**: WS 핸들러를 직접 호출해 `waitingNodeId`, `waitingFormConfig` 상태 반영 여부 검증 테스트 추가.

---

### 3. **[WARNING]** `handleNodeCompleted`의 프레젠테이션 결과 수집 로직 미검증
- **위치**: `use-execution-events.test.ts` - "execution.node.completed updates node status with duration" (line 385)
- **상세**: 현재 테스트는 노드 상태 업데이트만 검증함. `handleNodeCompleted`가 `output.type`이 `PRESENTATION_TYPES`에 해당할 경우 `addNodeResult`를 호출하는 분기가 전혀 테스트되지 않음. 반대로 비프레젠테이션 타입일 때 추가되지 않아야 하는 케이스도 미검증.
- **제안**: `output: { type: "table", label: "My Table", ... }` 포함하는 payload로 핸들러 호출 시 `nodeResults`가 갱신되는지, `type: "http_request"`일 때는 갱신되지 않는지 테스트 추가.

---

### 4. **[WARNING]** `run-results-drawer.tsx` 테스트 파일 부재
- **위치**: `frontend/src/components/editor/run-results/`
- **상세**: 대규모 컴포넌트 변경(`DynamicFormUI`, `HistoryEntry`, `renderField`, 폼 제출 WS emit 등)이 있으나 컴포넌트 테스트가 전혀 없음. 특히 `handleFormSubmit`에서 `getWsClient().emit("execution.submit_form", ...)` 호출 여부와 `onFormSubmit` 콜백 호출 여부가 핵심 행동인데 검증되지 않음.
- **제안**: `DynamicFormUI` 단위 테스트 및 `HistoryEntry`의 폼 제출 통합 테스트 추가 필요.

---

### 5. **[INFO]** `waitForFormSubmission`에서 `nodeExec === null` 케이스 미검증
- **위치**: `execution-engine.service.spec.ts` - "Form node blocking" 섹션
- **상세**: `nodeExecutionRepository.findOne`이 `null`을 반환하는 경우(예: 레이스 컨디션) 코드는 안전하게 분기하지만 해당 경로를 테스트하는 케이스가 없음.
- **제안**: `mockNodeExecutionRepo.findOne.mockResolvedValue(null)` 설정 후 pause/resume 흐름이 정상 동작하는지 테스트.

---

### 6. **[INFO]** `cancelledRef` 코멘트가 `cancelled` 스토어 매핑에 대한 오래된 설명 보유
- **위치**: `use-execution-events.test.ts`, line 201-203
- **상세**: 주석이 "cancelled maps to failed because the store only has idle/running/completed/failed"라고 기술하고 있으나 스토어에 `waiting_for_input` 상태가 추가된 현재 부정확함. 코드 동작은 동일하나 주석이 오해를 유발할 수 있음.

---

### 7. **[INFO]** 동시 `continueExecution` 호출(레이스 컨디션) 테스트 부재
- **위치**: `execution-engine.service.spec.ts` - "Form node blocking" 섹션
- **상세**: 동일한 `executionId`로 `continueExecution`을 두 번 연속 호출할 경우, 첫 번째 호출 후 `pendingContinuations`에서 삭제되므로 두 번째 호출은 throw해야 함. 이 경계값 케이스가 미검증.

---

## 요약

전반적인 테스트 구조는 잘 갖춰져 있으며 핵심 Form 블로킹 플로우(pause/continue/cancel), 스토어 상태 전이, 폴링 기반 `waiting_for_input` 처리 모두 커버됨. 그러나 **새로 추가된 WS 핸들러(`handleSubmitForm`)에 대한 테스트가 전무**하고, **실시간 WS 경로의 `waiting_for_input` 이벤트 처리 및 `handleNodeCompleted`의 프레젠테이션 결과 수집 로직이 미검증**이며, **프론트엔드 UI 컴포넌트 테스트가 부재**한 것이 주요 갭임. CLAUDE.md의 TDD 지침 및 "Warning 이상 이슈 필수 해결" 원칙에 따라 위 3개 WARNING 항목은 반드시 보완이 필요함.

## 위험도

**MEDIUM**