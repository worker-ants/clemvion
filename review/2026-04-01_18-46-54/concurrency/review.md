## 발견사항

---

### **[CRITICAL]** 수평 확장(Multi-Instance) 환경에서의 경쟁 조건

- **위치**: `execution-engine.service.ts` — `pendingContinuations` Map, `continueExecution()`
- **상세**: `pendingContinuations`는 프로세스 로컬 in-memory Map입니다. 서버가 2개 이상의 인스턴스로 실행될 경우, 실행을 멈춘 인스턴스(A)와 `execution.submit_form` WebSocket 메시지를 수신한 인스턴스(B)가 다를 수 있습니다. 인스턴스 B의 `continueExecution()`은 자신의 Map에서 해당 `executionId`를 찾지 못해 `No pending continuation` 에러를 던집니다.
- **제안**: Redis Pub/Sub, BullMQ, 혹은 DB 폴링 방식으로 교체하거나, sticky session으로 같은 인스턴스에 고정하고 문서화해야 합니다. 현재 단일 인스턴스 전제라면 해당 제약을 명시적 주석으로 기록해야 합니다.

---

### **[WARNING]** 폼 제출 무한 대기 — 타임아웃 없음

- **위치**: `execution-engine.service.ts:waitForFormSubmission()` — `new Promise<unknown>((resolve, reject) => { this.pendingContinuations.set(...) })`
- **상세**: 사용자가 브라우저를 닫거나 폼을 영원히 제출하지 않으면, 해당 Promise는 절대 settle되지 않습니다. `pendingContinuations`에 항목이 남아 있고, `runExecution`의 async 태스크가 Node.js 태스크 큐에 영구적으로 걸려 있게 됩니다. `cancelWaitingExecution()`이 외부에서 호출되지 않으면 메모리 누수 및 실행 좀비화가 발생합니다.
- **제안**: `Promise.race`를 사용하여 설정 가능한 타임아웃(예: 30분)을 구현하거나, `setTimeout` 기반 자동 취소 로직을 추가해야 합니다.

```typescript
const formData = await Promise.race([
  new Promise<unknown>((resolve, reject) => {
    this.pendingContinuations.set(executionId, { nodeId: node.id, resolve, reject });
  }),
  new Promise<never>((_, reject) =>
    setTimeout(() => reject(new ExecutionCancelledError()), FORM_TIMEOUT_MS)
  ),
]);
```

---

### **[WARNING]** 프론트엔드 상태가 서버 확인 전에 전환됨

- **위치**: `run-results-drawer.tsx:handleFormSubmit()` — `client.emit(...)` 직후 `onFormSubmit()` 호출
- **상세**: `client.emit`은 fire-and-forget이며, `onFormSubmit()`(`resumeFromForm()`)은 서버 응답을 기다리지 않고 즉시 스토어를 `waiting_for_input` → `running`으로 전환합니다. 서버가 `continueExecution`에서 에러를 반환해도(`{ success: false }` 응답), 프론트엔드는 이미 `running` 상태로 전환되어 있어 UI가 불일치 상태가 됩니다.
- **제안**: `execution.form_submitted` 응답 이벤트를 수신한 후 `resumeFromForm()`을 호출하거나, 서버의 다음 WS 이벤트(`execution.started` 재발행)에 의존하도록 변경해야 합니다.

---

### **[WARNING]** 프론트엔드 정리(cleanup) 시 서버 측 대기 상태 미취소

- **위치**: `use-execution-events.ts` — `useEffect` cleanup 함수
- **상세**: React 컴포넌트가 언마운트되거나 `executionId`가 변경되면 cleanup이 실행되어 `cancelledRef.current = true`로 설정되지만, 서버 측 `pendingContinuations`에 남아 있는 대기 Promise는 취소되지 않습니다. 실행이 서버에서 무한 대기 상태로 남게 됩니다.
- **제안**: cleanup 시 `executionId`가 있고 상태가 `waiting_for_input`이면 REST API를 통한 취소 요청 또는 WS 이벤트(`execution.cancel`)를 전송해야 합니다.

---

### **[INFO]** 폴링이 `waiting_for_input` 중 `pauseForForm`을 2초마다 반복 호출

- **위치**: `use-execution-events.ts:pollExecutionStatus()` — `waiting_for_input` 분기
- **상세**: 폴링이 terminal 상태가 아닌 경우 `false`를 반환하여 계속 폴링하므로, 폼 대기 중에는 2초마다 `pauseForForm(nodeId, formConfig)`가 반복 호출됩니다. Zustand의 `set`은 동일한 참조값에 대해 리렌더링을 최적화하지 않기 때문에 불필요한 리렌더링이 발생할 수 있습니다.
- **제안**: 스토어에서 현재 `waitingNodeId`와 동일한 경우를 early-return으로 처리하거나, 폴링 주기를 늘리는 것을 고려하세요.

---

### **[INFO]** `emitExecutionEvent` 이후 `pendingContinuations.set` 순서 의존

- **위치**: `execution-engine.service.ts:waitForFormSubmission()` — WS emit과 Promise 생성자 사이
- **상세**: WS 이벤트 emit 직후 `new Promise(executor)`가 실행되므로, Promise 생성자의 `pendingContinuations.set`은 Node.js 단일 스레드 이벤트 루프 특성상 다음 I/O 틱 이전에 동기적으로 완료됩니다. 단일 프로세스에서는 안전하지만, 해당 순서 의존성이 명시적이지 않아 향후 코드 변경 시 취약점이 될 수 있습니다.
- **제안**: `pendingContinuations.set`을 먼저 실행한 뒤 WS 이벤트를 emit하는 순서로 변경하면 더 명시적이고 안전합니다.

---

## 요약

전체 설계는 Node.js 단일 이벤트 루프의 비선점형(non-preemptive) 특성 덕분에 **단일 프로세스 환경에서는 경쟁 조건 없이 동작**합니다. `pendingContinuations` Map에 대한 모든 접근(get→delete→resolve/reject)이 단일 동기 실행 틱 내에서 완료되기 때문입니다. 그러나 **가장 심각한 문제는 수평 확장 불가능성**으로, in-memory Map 기반 continuation 패턴은 복수 인스턴스 배포 시 즉각 실패합니다. 그 외에도 폼 제출 타임아웃 부재로 인한 좀비 실행 가능성, 프론트엔드의 낙관적 상태 전환으로 인한 UI 불일치, 컴포넌트 언마운트 시 서버 측 대기 상태 미정리가 운영 환경에서 실질적인 위험을 초래할 수 있습니다.

## 위험도

**HIGH**