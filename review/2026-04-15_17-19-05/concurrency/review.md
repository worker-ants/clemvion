## 리뷰 결과

### 발견사항

---

**[WARNING]** `emitExecutionSnapshot`의 fire-and-forget 패턴에서 클라이언트 연결 해제 후 emit 가능성
- **위치**: `websocket.gateway.ts` — `handleSubscribe` → `void this.emitExecutionSnapshot(...)`
- **상세**: `handleSubscribe`는 동기적으로 즉시 반환하지만, `emitExecutionSnapshot`은 비동기로 실행됩니다. DB 조회가 완료되기 전에 클라이언트가 연결을 끊으면 `client.emit()`이 이미 disconnect된 소켓 객체에 호출됩니다. Socket.IO는 이 경우 예외를 던지지 않고 묵시적으로 무시하므로 functional 버그는 아니지만, disconnect 시점과 emit 시점 사이의 경쟁 조건이 존재합니다.
- **제안**: `client.connected` 속성으로 guard 추가:
  ```ts
  if (client.connected) {
    client.emit('execution.snapshot', { ... });
  }
  ```

---

**[WARNING]** 스냅샷 수신과 실시간 WS 이벤트 간의 경쟁 조건 (프론트엔드)
- **위치**: `use-execution-events.ts` — `handleSnapshot` 내부 `addNodeResult` 루프
- **상세**: 백엔드는 구독 직후 스냅샷을 전송하지만, 그 사이 실시간 `execution.node.completed` 이벤트가 먼저 도착할 수 있습니다. 이 경우 이벤트 핸들러가 store에 최신 상태를 기록한 뒤, 뒤늦게 도착한 스냅샷이 과거 상태(예: `running`)로 덮어씁니다. `addNodeResult`가 내부적으로 upsert를 처리하더라도, `updateNodeStatus`는 `shouldUpdateStatus` priority 체크를 거치지 않고 스냅샷 루프에서 직접 호출되므로 completed → running 역행이 발생할 수 있습니다.
- **제안**: 스냅샷 내 node 처리 시에도 `shouldUpdateStatus`를 적용하여 이미 더 높은 우선순위의 상태가 기록된 경우 skip:
  ```ts
  const currentStatus = useExecutionStore.getState().nodeStatuses.get(ne.nodeId)?.status;
  if (shouldUpdateStatus(currentStatus, mapNodeStatus(ne.status))) {
    updateNodeStatus(ne.nodeId, { ... });
  }
  ```

---

**[WARNING]** `onReconnect`에 의한 중복 스냅샷 처리 시 경쟁 조건
- **위치**: `use-execution-events.ts` — `onReconnect` → `trySubscribe` / `websocket.gateway.ts` — `handleSubscribe`
- **상세**: 재연결 시 `trySubscribe`가 다시 `subscribe` 메시지를 보내고, 게이트웨이는 다시 `emitExecutionSnapshot`을 fire합니다. 이미 store에 실시간 이벤트로 쌓인 상태 위에 과거 스냅샷이 덮어씌워질 수 있습니다. 특히 실행이 완료된 후 재연결하면 중복 `nodeResults` 항목이 추가될 수 있습니다.
- **제안**: `handleSnapshot` 앞에 실행 종료 상태(`completed`/`failed`) 체크를 추가하여, 이미 terminal state이면 nodeResults 재처리를 건너뛰도록 처리:
  ```ts
  const { status: prevStatus } = useExecutionStore.getState();
  const isTerminal = prevStatus === 'completed' || prevStatus === 'failed';
  if (!isTerminal && execution.nodeExecutions) { /* rebuild */ }
  ```

---

**[INFO]** `pendingContinuations` Map의 단일 인스턴스 경쟁 조건
- **위치**: `execution-engine.service.ts` — `private readonly pendingContinuations`
- **상세**: 이번 diff에서 직접 변경되지 않았으나, Node.js 이벤트 루프 특성상 단일 스레드이므로 Map 접근 자체는 안전합니다. 단, `inputData`가 `createNodeExecution` 호출 이전에 resolve되는 경우와 이후에 저장되는 경우 사이의 타이밍은 이번 변경과 무관하게 기존부터 유지되고 있어 추가 위험은 없습니다. 참고 수준의 관찰입니다.

---

**[INFO]** `void` 패턴의 일관성
- **위치**: `websocket.gateway.ts` — `void client.join(channel)`, `void this.emitExecutionSnapshot(...)`
- **상세**: `void` 키워드로 Promise를 명시적으로 무시하는 패턴이 일관되게 사용되고 있습니다. 이는 TypeScript 린트(no-floating-promises) 규칙을 만족하면서 fire-and-forget 의도를 표현하는 올바른 방식입니다. 다만, 앞서 지적한 대로 스냅샷 emit에 대한 error boundary는 `try/catch`로 이미 처리되어 있어 예외 전파 위험은 없습니다.

---

### 요약

이번 변경의 핵심은 REST 폴링을 제거하고 WebSocket 구독 직후 서버가 전송하는 일회성 스냅샷(`execution.snapshot`)으로 대체한 것입니다. 동시성 관점에서 가장 주목할 부분은 **스냅샷 도착 타이밍과 실시간 WS 이벤트 간의 경쟁 조건**입니다. 특히 프론트엔드의 `handleSnapshot`이 노드 상태를 갱신할 때 `shouldUpdateStatus` 우선순위 체크를 거치지 않아, 고속 실행 환경에서 스냅샷이 늦게 도착하면 이미 `completed`로 기록된 노드가 `running`으로 역행할 수 있습니다. 백엔드의 `emitExecutionSnapshot`은 fire-and-forget으로 처리되며 연결 해제 race에 대해 Socket.IO가 자체적으로 방어하지만, 명시적 guard가 없는 상태입니다. 전반적으로 Node.js 단일 스레드 환경이므로 데드락이나 스레드 안전성 문제는 없으나, 비동기 이벤트 순서에 의존하는 상태 머신 로직에서 경쟁 조건이 발생할 수 있는 구조입니다.

### 위험도
**MEDIUM**