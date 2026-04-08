## 발견사항

---

### **[CRITICAL]** 이전 턴 `setTimeout` 미취소로 인한 다음 턴 `pendingContinuations` 항목 삭제 버그

- **위치**: `execution-engine.service.ts` — `waitForAiConversation()` while 루프
- **상세**: 각 대화 턴마다 새 Promise와 `setTimeout`을 생성하지만 이전 타이머를 취소하지 않는다. 아래 시나리오에서 hang 버그가 발생한다:

  ```
  턴 1: pendingContinuations.set(execId, {resolve: R1}) + setTimeout(cb1, 1800s)
  사용자 메시지 수신 → continueAiConversation() → delete(execId) → R1.resolve(ai_message)
  턴 2: pendingContinuations.set(execId, {resolve: R2}) + setTimeout(cb2, 1800s)
  
  [1800초 후] cb1 발화:
    → pendingContinuations.has(execId) === true (턴 2의 항목!)
    → delete(execId)  ← 턴 2 항목 삭제
    → R1.resolve(ai_timeout)  ← R1은 이미 resolved, 무효
  
  결과: 턴 2의 Promise를 resolve할 수 있는 경로 소멸 → 대화 영구 중단(hang)
  ```

  대화 N턴이 진행될수록 N개의 stale 타이머가 누적되며, 각 타이머가 순차적으로 발화하면서 계속 다음 턴 항목을 삭제할 수 있다.

- **제안**:
  ```typescript
  // PendingContinuation 타입에 timeoutId 추가
  type PendingContinuation = {
    nodeId: string;
    resolve: (value: unknown) => void;
    reject: (reason?: unknown) => void;
    timeoutId: ReturnType<typeof setTimeout>;
  };

  // while 루프 내부
  const userData = await new Promise<unknown>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      if (this.pendingContinuations.has(executionId)) {
        this.pendingContinuations.delete(executionId);
        resolve({ type: 'ai_timeout' });
      }
    }, timeoutMs);

    this.pendingContinuations.set(executionId, {
      nodeId: node.id, resolve, reject, timeoutId,
    });
  });

  // continueAiConversation / endAiConversation
  const pending = this.pendingContinuations.get(executionId);
  if (!pending) throw new Error(...);
  clearTimeout(pending.timeoutId);  // 반드시 추가
  this.pendingContinuations.delete(executionId);
  pending.resolve(...);
  ```

---

### **[WARNING]** 턴 전환 중 빈 구간(gap)에서 중복 메시지 도착 시 race condition

- **위치**: `execution-engine.service.ts` — `waitForAiConversation()` while 루프 / `continueAiConversation()`
- **상세**: `continueAiConversation()`이 `pendingContinuations`에서 항목을 삭제하고 Promise를 resolve한 시점부터, `processMultiTurnMessage()` 완료 후 새 항목이 등록될 때까지 **빈 구간**이 존재한다. 이 구간에 재전송이나 네트워크 재연결로 인한 중복 메시지가 도착하면 `"No pending continuation for execution: {id}"` 예외가 발생하고 대화 상태가 모호해진다. Node.js 단일 스레드 특성상 실제 동시 실행은 없지만, 비동기 이벤트 큐에서 이 시나리오는 충분히 발생 가능하다.
- **제안**: 처리 중 상태를 나타내는 별도 `processingExecutions: Set<string>` 플래그를 관리하여, 빈 구간에서 도착한 메시지를 "처리 중, 잠시 후 재시도" 오류로 명확히 구분 응답한다.

---

### **[WARNING]** 실행 소유권 검증 없이 대화 인터랙션 허용

- **위치**: `websocket.gateway.ts` — `handleSubmitMessage()`, `handleEndConversation()`
- **상세**: 두 핸들러 모두 `userId` 존재 여부(인증)만 확인하고, 해당 사용자가 `executionId`로 식별되는 실행의 소유자인지 검증하지 않는다. 인증된 모든 사용자가 타인의 실행 ID를 지정하여 AI 대화에 메시지를 주입하거나 강제 종료할 수 있다. 동시 접속 환경에서 실행 ID 충돌/오염 시나리오와 결합되면 위험도가 높아진다.
- **제안**: `continueAiConversation()` / `endAiConversation()` 내부에서 execution의 `workspaceId`와 요청 사용자의 워크스페이스를 대조하는 소유권 검증 추가.

---

### **[INFO]** `messages` 배열 직접 변이(mutation)

- **위치**: `ai-agent.handler.ts` — `processMultiTurnMessage()`
- **상세**: `const messages = state.messages as ChatMessage[]`는 참조만 복사한다. 이후 `messages.push(...)` 호출은 `nodeOutputCache`에 저장된 원본 배열을 직접 변이한다. Node.js 단일 스레드 특성상 단일 실행 내에서는 안전하지만, 처리 중 예외 발생 시 절반만 변이된 상태가 잔류할 수 있다. 또한 `processMultiTurnMessage` 재호출 시 이전 변이 결과가 누적되어 메시지가 중복 추가될 위험이 있다.
- **제안**: `const messages = [...(state.messages as ChatMessage[])]`로 shallow copy 후 사용.

---

## 요약

이번 변경의 핵심 동시성 위험은 **multi-turn 대화 루프에서 이전 턴의 `setTimeout` 콜백이 취소되지 않아, 타임아웃 경과 후 다음 턴의 `pendingContinuations` 항목을 삭제하는 hang 버그**다. 이는 대화가 특정 턴 이후 영구적으로 응답 불가 상태에 빠지는 실제 버그를 유발하며, 대화 턴 수가 많을수록 발생 확률이 증가한다. Node.js는 단일 스레드이므로 전통적인 스레드 경쟁 조건은 없으나, 비동기 이벤트 큐 기반 타이머 콜백이 예상치 못한 시점에 공유 Map을 변경하는 구조가 문제다. `clearTimeout` 미호출은 반드시 즉시 수정이 필요하며, 턴 전환 빈 구간의 race condition과 소유권 검증 누락도 운영 환경에서 위험하다.

## 위험도

**CRITICAL**