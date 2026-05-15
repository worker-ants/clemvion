### 발견사항

- **[INFO]** `waitForFormSubmission`의 emit/set 순서 - 코드 주석과 실제 순서 불일치
  - 위치: `execution-engine.service.ts`, `waitForFormSubmission` 메서드 내 Promise 생성 직전
  - 상세: 주석은 "Store resolve before emit so a fast client can't race"라고 설명하지만, 실제로는 `emitExecutionEvent()`가 먼저 호출되고 이후 `new Promise(constructor)` 내에서 `pendingContinuations.set()`이 실행된다. 기능적으로는 안전한데, Promise 생성자가 동기 실행되고 WebSocket 전송은 비동기 I/O로 다음 틱에서 발생하므로 `set()` 완료 전에 클라이언트 응답이 도달할 수 없기 때문이다. 그러나 주석이 실제 코드 의도를 역순으로 설명하고 있다.
  - 제안: 코드 순서를 주석과 일치시키거나, 주석을 현실에 맞게 수정한다.
    ```typescript
    // Promise 생성자 내에서 set이 동기 실행됨. emit은 다음 틱에서 전송되므로 안전.
    const formData = await new Promise<unknown>((resolve, reject) => {
      this.pendingContinuations.set(executionId, { nodeId: node.id, resolve, reject });
      // ...
    });
    // emit은 set 이후에 호출 (안전 보장 명확화)
    this.websocketService.emitExecutionEvent(...);
    ```

- **[INFO]** template 노드의 `exprContext` 객체 변이(mutation) - 안전함
  - 위치: `execution-engine.service.ts:530–568`, `executeNode` 메서드 내 신규 추가 코드
  - 상세: `buildExpressionContext()`가 반환한 객체에 root-level key를 직접 추가한다. 이 객체는 각 `executeNode` 호출마다 새로 생성되며 공유되지 않으므로 동시성 문제는 없다. `context.nodeOutputCache`와 같은 공유 상태의 참조를 포함할 수 있지만, 새 key만 추가하는 얕은 변이이므로 안전하다.
  - 제안: 현재 구현 유지 가능. 의도를 명확히 하려면 `{ ...exprContext, ...spreadEntries }` 형태로 새 객체를 생성하는 것도 고려할 수 있다.

- **[INFO]** `pendingContinuations` Map의 double-resolve 방어
  - 위치: `continueExecution()`, `cancelWaitingExecution()`, setTimeout 콜백
  - 상세: Node.js 단일 스레드 모델 덕분에 `get → delete → resolve/reject` 시퀀스의 원자성이 보장된다. 동일 executionId에 대한 이중 호출은 두 번째 호출이 `undefined`를 받아 에러를 던지는 방식으로 안전하게 처리된다. `finally` 블록의 `pendingContinuations.delete()`도 이미 삭제된 경우 no-op이므로 안전하다.
  - 제안: 현재 구현 유지 가능.

---

### 요약

변경된 코드의 핵심은 template 노드의 표현식 처리를 기존 커스텀 `{{ }}` 파서에서 통합 표현식 엔진으로 이관한 것이다. 동시성 관점에서 이 리팩토링은 올바르게 구현되었다. `exprContext` 변이는 로컬 객체에 대해서만 이루어지고, `pendingContinuations` Map은 Node.js 단일 스레드 이벤트 루프에서 올바르게 동작하며, 비동기 실행 흐름도 적절히 격리되어 있다. 유일한 주의 사항은 `waitForFormSubmission`의 코드 주석이 실제 실행 순서와 맞지 않는다는 점인데, 기능적 버그는 아니고 가독성 이슈다. 전반적으로 신규 변경사항이 기존 동시성 패턴을 해치지 않으며 안전하다.

### 위험도
**LOW**