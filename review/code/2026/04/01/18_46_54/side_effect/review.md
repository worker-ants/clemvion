## 부작용 코드 리뷰

### 발견사항

---

**[WARNING] `continueExecution` / `cancelWaitingExecution` — 동시성 경쟁 조건**
- 위치: `execution-engine.service.ts` — `continueExecution()`, `cancelWaitingExecution()`
- 상세: 두 메서드 모두 `pendingContinuations.get()` → `pendingContinuations.delete()` → `pending.resolve/reject()` 순으로 실행한다. NestJS는 단일 스레드이지만, 동일 executionId에 대해 두 호출이 microtask queue에서 교차할 경우 (예: WebSocket 이벤트와 REST 엔드포인트가 동시 도달) 두 번 호출될 수 있다. 현재는 `delete` 후 `resolve/reject`를 호출하므로 이중 호출 위험은 낮지만, Promise가 이미 resolve된 상태에서 `reject`가 호출돼도 무시되므로 직접적인 문제는 없다. 그러나 `continueExecution`은 `get()` 후 `delete()` 전에 예외가 발생하면 맵 항목이 남아 리소스 누수가 발생할 수 있다.
- 제안:
```typescript
continueExecution(executionId: string, formData?: unknown): void {
  const pending = this.pendingContinuations.get(executionId);
  if (!pending) throw new Error(`No pending continuation for execution: ${executionId}`);
  this.pendingContinuations.delete(executionId); // delete 먼저
  pending.resolve(formData); // 그 다음 resolve
}
```
현재 코드는 이미 이 순서를 따르므로 양호. 다만 `cancelWaitingExecution`도 동일.

---

**[WARNING] `waitForFormSubmission` — `assertTransition` 상태 머신 우회 가능성**
- 위치: `execution-engine.service.ts:waitForFormSubmission()` — `updateExecutionStatus` 두 번 호출
- 상세: `WAITING_FOR_INPUT → RUNNING` 전환이 상태 머신(`assertTransition`)에 정의되어 있어야 한다. 만약 상태 머신이 이 전환을 허용하지 않으면, 폼 제출 후 `updateExecutionStatus`가 예외를 던지고, catch 블록에서 `ExecutionCancelledError`가 아닌 일반 오류로 처리되어 execution이 `FAILED`로 마킹된다. 또한 `RUNNING` 전환 후 `EXECUTION_STARTED` 이벤트를 다시 발생시키는 것은 의미론적으로 부정확하다 — 이미 시작된 실행에 대해 "started" 이벤트가 재발생하면 프론트엔드가 `startExecution()`을 재호출할 수 있다.
- 제안: `EXECUTION_RESUMED` 또는 별도 이벤트 타입 사용. 상태 머신에 `WAITING_FOR_INPUT → RUNNING` 전환 명시적 추가 확인 필요.

---

**[WARNING] `handleSubmitForm` — 인증 없는 폼 제출 처리**
- 위치: `websocket.gateway.ts:handleSubmitForm()`
- 상세: `@SubscribeMessage('execution.submit_form')` 핸들러에 `@ConnectedSocket()` 파라미터가 없어 제출자가 해당 실행의 소유자인지 검증하지 않는다. 연결된 모든 WebSocket 클라이언트가 임의의 `executionId`를 지정해 다른 사용자의 실행을 재개할 수 있다.
- 제안:
```typescript
@SubscribeMessage('execution.submit_form')
handleSubmitForm(
  @MessageBody() data: { executionId: string; formData: unknown },
  @ConnectedSocket() client: Socket,
): ... {
  const userId = (client as Socket & { userId?: string }).userId;
  // execution 소유자 검증 후 continueExecution 호출
}
```

---

**[WARNING] `resumeFromForm` — 낙관적 상태 전환으로 인한 상태 불일치**
- 위치: `execution-store.ts:resumeFromForm()`, `run-results-drawer.tsx:handleFormSubmit()`
- 상세: `handleFormSubmit`은 WS emit 후 즉시 `resumeFromForm()`(→ `status: "running"`)을 호출한다. 서버 응답을 기다리지 않으므로, WS emit 실패 시 UI는 "Running..." 상태로 전환되지만 서버는 여전히 `WAITING_FOR_INPUT` 상태다. 이후 폴링에서 `waiting_for_input` 상태를 받아 `pauseForForm()`이 다시 호출되면 폼이 재표시될 수 있지만, 이미 폼 항목의 `isWaiting`이 false로 변경되어 제출된 것처럼 보이는 시각적 불일치가 발생한다.
- 제안: `execution.form_submitted` 응답의 `success: true`를 확인한 후에만 `resumeFromForm()` 호출.

---

**[INFO] `ChartContent` / `TemplateContent` — XSS 위험 (`dangerouslySetInnerHTML`)**
- 위치: `run-results-drawer.tsx:ChartContent()`, `TemplateContent()`
- 상세: 서버에서 반환된 `data.rendered` 문자열을 직접 `dangerouslySetInnerHTML`로 렌더링한다. 서버 측에서 sanitization이 수행되지 않는다면 저장형 XSS 공격 벡터가 된다.
- 제안: DOMPurify 등으로 클라이언트 측 sanitization 적용, 또는 서버에서 렌더링 시 반드시 escape 처리.

---

**[INFO] `handleNodeCompleted` — WebSocket과 폴링 간 이중 `addNodeResult` 호출**
- 위치: `use-execution-events.ts:handleNodeCompleted()` + `pollExecutionStatus()`
- 상세: WebSocket으로 `execution.node.completed` 이벤트를 받아 `addNodeResult`를 호출하고, 동시에 폴링에서도 동일한 노드의 완료 상태를 감지해 `addNodeResult`를 호출할 수 있다. `addNodeResult`에 중복 방지 로직(`exists` 체크 + 업데이트)이 추가되어 있어 직접적인 중복 표시는 없지만, 이미 표시된 결과의 `outputData`가 폴링 타이밍에 따라 덮어써질 수 있다.
- 제안: 현재 중복 방지 로직으로 충분하나, 폴링은 폼 대기 상태 확인 용도로만 제한하고 이미 WS 이벤트로 처리된 노드는 건너뛰는 최적화를 고려.

---

**[INFO] `forwardRef` 순환 의존성 — 런타임 해결 지연**
- 위치: `execution-engine.service.ts:constructor`, `websocket.gateway.ts:constructor`
- 상세: `@Inject(forwardRef(() => WebsocketService))` / `@Inject(forwardRef(() => ExecutionEngineService))` 양방향 순환 참조가 존재한다. NestJS의 `forwardRef`는 이를 해결하지만, 모듈 초기화 순서에 따라 한쪽이 `undefined`인 상태에서 `onModuleInit`이 호출될 수 있다. 현재 `onModuleInit`에서 `websocketService`를 직접 사용하지 않으므로 문제없지만, 향후 추가 시 주의 필요.
- 제안: 순환 참조를 제거하기 위해 `EventEmitter` 또는 별도의 `ExecutionEventBus` 서비스 도입 고려.

---

**[INFO] `pendingContinuations` — 서버 재시작 시 영구 대기 상태**
- 위치: `execution-engine.service.ts:pendingContinuations`
- 상세: `pendingContinuations`는 인메모리 Map이다. 서버가 재시작되면 DB에는 `WAITING_FOR_INPUT` 상태의 execution이 남아있지만 Map은 초기화되어, 해당 execution은 영구적으로 재개 불가능한 좀비 상태가 된다.
- 제안: 서버 시작 시 `WAITING_FOR_INPUT` 상태의 execution을 `FAILED`로 마킹하는 초기화 로직 추가.

---

### 요약

이번 변경은 Form 노드의 blocking 실행 일시정지/재개 메커니즘을 추가한 것으로, 전반적인 설계는 합리적이다. 가장 주목할 부작용 위험은 **WebSocket 폼 제출에 대한 인증/권한 검증 누락**(임의 실행 하이재킹 가능)과 **낙관적 상태 전환으로 인한 UI-서버 상태 불일치**, 그리고 **`dangerouslySetInnerHTML` XSS** 위험이다. 상태 머신의 `WAITING_FOR_INPUT → RUNNING` 전환 누락 여부도 확인이 필요하며, 인메모리 Map의 서버 재시작 취약점은 운영 환경에서 실질적인 문제가 될 수 있다.

### 위험도

**MEDIUM**