## 발견사항

---

### **[CRITICAL]** 이전 턴의 stale `setTimeout`이 다음 턴의 `pendingContinuations` 항목을 삭제하는 버그

- **위치**: `execution-engine.service.ts` — `waitForAiConversation()` 내 while 루프

- **상세**: 각 턴마다 새 Promise와 `setTimeout`을 생성하지만, **이전 턴의 타임아웃을 취소하지 않는다**. 다음 시나리오에서 버그가 발생한다:

  ```
  턴 1: pendingContinuations.set(execId, {resolve: R1}) + setTimeout(cb1, 1800s)
  사용자 메시지 수신 → continueAiConversation() → delete(execId) → R1.resolve(ai_message)
  턴 2: pendingContinuations.set(execId, {resolve: R2}) + setTimeout(cb2, 1800s)
  cb1 발화 (1800초 후): pendingContinuations.has(execId) === true (턴 2의 항목!)
      → delete(execId)  ← 턴 2의 항목을 삭제!
      → R1.resolve(ai_timeout)  ← R1은 이미 resolved, 무효
  결과: 턴 2의 Promise는 resolve될 방법이 없음 → 대화 영구 중단 (hang)
  ```

  대화가 N턴 진행될수록 N개의 stale 타임아웃이 누적되며, 마지막 타임아웃이 발화할 때까지 이 위험이 지속된다.

- **제안**: `setTimeout` 반환값을 저장하고 continuation이 resolve될 때 반드시 `clearTimeout`을 호출한다.

  ```ts
  // pendingContinuations 타입에 timeoutId 추가
  type PendingContinuation = {
    nodeId: string;
    resolve: (value: unknown) => void;
    reject: (reason?: unknown) => void;
    timeoutId?: ReturnType<typeof setTimeout>;
  };

  // waitForAiConversation 루프 내부
  const userData = await new Promise<unknown>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      if (this.pendingContinuations.has(executionId)) {
        this.pendingContinuations.delete(executionId);
        resolve({ type: 'ai_timeout' });
      }
    }, timeoutMs);

    this.pendingContinuations.set(executionId, {
      nodeId: node.id,
      resolve,
      reject,
      timeoutId,
    });
  });

  // continueAiConversation / endAiConversation 내부
  const pending = this.pendingContinuations.get(executionId);
  if (!pending) throw new Error(...);
  clearTimeout(pending.timeoutId);  // ← 반드시 추가
  this.pendingContinuations.delete(executionId);
  pending.resolve(...);
  ```

---

### **[WARNING]** 실행 소유권 검증 없이 대화 인터랙션 허용

- **위치**: `websocket.gateway.ts` — `handleSubmitMessage()`, `handleEndConversation()`

- **상세**: 두 핸들러 모두 `userId`가 존재하는지(인증 여부)만 확인하고, 해당 사용자가 `executionId`로 식별되는 실행의 소유자인지 검증하지 않는다. 인증된 모든 사용자가 임의의 `executionId`를 지정하여 타인의 AI 대화에 메시지를 주입하거나 강제 종료할 수 있다. 기존 `handleSubmitForm`과 `handleClickButton`도 동일한 패턴이므로, 일관된 소유권 검증 로직을 서비스 계층에 추가해야 한다.

- **제안**: `continueAiConversation()` / `endAiConversation()` 내부 또는 서비스 레이어에서 execution의 `userId`와 WebSocket 연결의 `userId`가 일치하는지 확인한다.

---

### **[WARNING]** 턴 전환 중 중복 메시지 제출 시 예외 발생 (빈 구간)

- **위치**: `execution-engine.service.ts` — `waitForAiConversation()` while 루프

- **상세**: 사용자 메시지를 수신하여 `continueAiConversation()`이 `pendingContinuations`에서 항목을 삭제한 후, LLM 호출(`processMultiTurnMessage`) 완료 전까지 새 항목이 등록되지 않은 **빈 구간**이 존재한다. 이 구간에 재전송된 메시지나 다른 WebSocket 이벤트가 도착하면 "No pending continuation" 예외가 발생하고 클라이언트에는 단순 오류로 반환되어 대화 상태가 불명확해진다.

- **제안**: 오류 응답을 "처리 중입니다, 잠시 후 재시도하세요"와 같이 상태를 명확히 전달하는 메시지로 구분하거나, 처리 중 상태를 별도 플래그로 관리한다.

---

### **[INFO]** `messages` 배열 직접 변이(mutation)

- **위치**: `ai-agent.handler.ts` — `processMultiTurnMessage()`

- **상세**: `state.messages`를 참조하여 `messages.push(...)`로 직접 변이한다. Node.js 단일 스레드 특성상 단일 실행 내에서는 안전하지만, 상태 객체를 공유하거나 향후 병렬 처리 도입 시 예측 불가능한 동작을 유발할 수 있다. 반환 시 `_multiTurnState` spread(`{...state, messages, ...}`)가 새 참조를 만들지만 내부 `messages` 배열은 동일 참조다.

- **제안**: `messages.push()` 대신 `[...messages, newMessage]` 패턴으로 불변 처리를 적용한다.

---

## 요약

이번 변경의 핵심 동시성 위험은 **multi-turn 대화 루프에서 이전 턴의 `setTimeout` 콜백이 취소되지 않아 다음 턴의 `pendingContinuations` 항목을 삭제할 수 있다는 점**이다. 이는 대화가 특정 턴 이후 영구적으로 응답 불가 상태(hang)에 빠지는 실제 버그를 유발하며, 턴 수가 많을수록 확률이 증가한다. `clearTimeout` 호출 누락은 반드시 수정이 필요하다. 부가적으로 소유권 검증 부재는 보안-동시성 교차 문제로, 인증된 사용자라면 누구든 타인의 실행을 방해할 수 있어 운영 환경에서 위험하다.

## 위험도

**CRITICAL**