## 발견사항

### [WARNING] `continueExecution` REST 엔드포인트 테스트 누락
- **위치**: `executions.controller.ts` - `POST :id/continue`
- **상세**: `ExecutionsController`에 새로운 `continueExecution` 엔드포인트가 추가되었으나, 컨트롤러 테스트 파일이 없거나 해당 엔드포인트에 대한 테스트가 존재하지 않음. 성공 케이스, `continueExecution`이 throw할 때의 에러 처리, 잘못된 UUID 입력에 대한 ParseUUIDPipe 동작이 테스트되지 않음.
- **제안**: `executions.controller.spec.ts`에 다음 케이스 추가:
  - 유효한 executionId + formData로 `{ success: true }` 반환 확인
  - `executionEngineService.continueExecution`이 throw할 때 에러 전파 확인
  - 잘못된 UUID 형식에 대한 400 응답 확인

### [WARNING] `ExecutionsService.stop` - `WAITING_FOR_INPUT` 상태 처리 테스트 누락
- **위치**: `executions.service.ts:86-89`
- **상세**: `stop()` 메서드가 `WAITING_FOR_INPUT` 상태도 처리하도록 변경되었으나, 해당 케이스를 검증하는 서비스 테스트가 없음. `waiting_for_input` 상태의 실행을 정상적으로 중단할 수 있는지, 그리고 `cancelWaitingExecution`과의 연동(DB 상태 변경 vs 실제 Promise reject)도 검증되지 않음.
- **제안**: `executions.service.spec.ts`에 추가:
  ```ts
  it('should allow stopping execution in waiting_for_input status', async () => {
    // execution.status = WAITING_FOR_INPUT → save() 호출 → CANCELLED 반환
  });
  ```

### [WARNING] `WebsocketGateway.handleSubmitForm` 테스트 누락
- **위치**: `websocket.gateway.spec.ts`
- **상세**: `handleSubmitForm` 메시지 핸들러가 추가되었으나 `websocket.gateway.spec.ts`에 해당 핸들러 테스트가 없음. 성공 시 `{ success: true }` 반환, `continueExecution` throw 시 에러 메시지 반환, `data.executionId` 누락 시 동작 등이 테스트되지 않음.
- **제안**:
  ```ts
  describe('handleSubmitForm', () => {
    it('should return success when continueExecution succeeds', () => { ... });
    it('should return error when continueExecution throws', () => { ... });
  });
  ```

### [WARNING] `cancelWaitingExecution` 호출 경로 미테스트
- **위치**: `execution-engine.service.spec.ts`, `websocket.gateway.spec.ts`
- **상세**: `WebsocketGateway`에 `cancelWaitingExecution`이 mock으로 등록되어 있으나 실제로 이를 호출하는 코드 경로가 테스트되지 않음. `ExecutionsService.stop()`이 DB를 CANCELLED로 업데이트하지만 실제 `pendingContinuations`의 Promise를 reject하는 `cancelWaitingExecution`은 별도 호출이 필요한데, 이 연동이 테스트되지 않음 (통합 갭).
- **제안**: `execution-engine.service.spec.ts`에 stop 후 `cancelWaitingExecution` 검증 테스트 추가.

### [WARNING] Form 노드 blocking 테스트의 `flushPromises` 의존성 취약성
- **위치**: `execution-engine.service.spec.ts:417, 437`
- **상세**: `await flushPromises()` 호출이 내부 비동기 Promise chain이 완전히 처리되었다고 가정하지만, `waitForFormSubmission` 내부의 DB 저장 작업이 여러 단계의 Promise를 포함하므로 타이밍에 따라 불안정할 수 있음. 특히 `continueExecution` 호출 후 end 노드 실행까지의 비동기 체인이 단일 `flushPromises`로 완전히 해소되지 않을 수 있음.
- **제안**: `flushPromises`를 여러 번 호출하거나, `jest.runAllTimersAsync()` 패턴 사용, 또는 명시적인 `waitFor` 조건 기반 assertion으로 대체.

### [INFO] `handleWaitingForInput` - `waitingNodeType !== 'form'` 케이스 미테스트
- **위치**: `use-execution-events.ts:91-100`, `use-execution-events.test.ts`
- **상세**: `handleWaitingForInput`에서 `payload.waitingNodeType === 'form'` 조건 분기가 있으나, form이 아닌 타입의 waiting 이벤트가 왔을 때 아무 작업도 하지 않는 경로가 테스트되지 않음.
- **제안**:
  ```ts
  it('should ignore waiting_for_input event for non-form node types', () => {
    // emit with waitingNodeType !== 'form' → pauseForForm 미호출 확인
  });
  ```

### [INFO] `addNodeResult` 중복 방지 로직 - WebSocket 이벤트와 polling 동시 수신 시나리오 미테스트
- **위치**: `use-execution-events.ts` - `handleNodeCompleted` + polling 내 addNodeResult
- **상세**: WebSocket 이벤트와 polling이 동시에 같은 노드의 결과를 추가할 경우 중복 방지가 동작하는지 통합 테스트가 없음. store 단위 테스트는 있으나 두 경로가 동시에 동작하는 시나리오 검증 부재.
- **제안**: `use-execution-events.test.ts`에 WS 이벤트와 poll 응답이 같은 nodeId를 포함할 때 `nodeResults`가 1개만 유지됨을 확인하는 테스트 추가.

### [INFO] `DynamicFormUI` 컴포넌트 단위 테스트 없음
- **위치**: `run-results-drawer.tsx` - `DynamicFormUI`, `renderField`
- **상세**: 동적 폼 렌더링 로직(`renderField`)이 다양한 field type(textarea, number, email, date, select, radio, checkbox, text)을 처리하며, 이는 복잡한 UI 로직이나 단위 테스트가 없음. 특히 `required` 검증, 기본값 초기화, submit 시 값 수집이 미테스트.
- **제안**: `run-results-drawer.test.tsx` 생성하여 각 field type 렌더링 및 submit 동작 테스트 추가.

### [INFO] `nodeExecutionRepository.findOne` mock의 `order` 파라미터 무시
- **위치**: `execution-engine.service.spec.ts:145-154`
- **상세**: `findOne` mock이 `{ where }` 파라미터만 구조 분해하고 `order: { startedAt: 'DESC' }` 파라미터를 무시함. 실제 구현에서는 최신 nodeExecution을 가져오기 위해 order가 중요하나 mock에서 이를 검증하지 않아 구현 변경 시 테스트가 잡지 못할 수 있음.

---

## 요약

Form 노드 blocking 핵심 로직(`waitForFormSubmission`, `continueExecution`, `cancelWaitingExecution`)과 store(`pauseForForm`, `resumeFromForm`)에 대한 단위 테스트는 잘 작성되어 있어 핵심 비즈니스 로직 커버리지는 양호하다. 그러나 새로 추가된 REST 엔드포인트(`POST :id/continue`), WebSocket 메시지 핸들러(`handleSubmitForm`), `ExecutionsService.stop()`의 `WAITING_FOR_INPUT` 상태 처리에 대한 테스트가 누락되어 있어 API 레이어 커버리지에 갭이 존재한다. 프론트엔드의 `DynamicFormUI` 컴포넌트 테스트도 부재하며, `cancelWaitingExecution`의 실제 호출 경로(DB stop → Promise reject 연동)가 통합 테스트 없이 미검증 상태다.

## 위험도

**MEDIUM**