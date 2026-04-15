### 발견사항

---

**[WARNING] `emitExecutionSnapshot`에 인가(Authorization) 검증 없음**
- 위치: `websocket.gateway.ts` — `emitExecutionSnapshot` 메서드
- 상세: WS 연결은 JWT로 인증되지만, 특정 `execution:*` 채널 구독 시 해당 Execution의 소유권 검증 없이 스냅샷을 전송합니다. 기존 REST `GET /executions/:id`는 미들웨어 레벨에서 소유권을 검사했으나, WS 경로에서는 `findById`가 존재하기만 하면 반환합니다. 인증된 사용자라면 타인의 실행 ID를 알 때 스냅샷을 수신할 수 있습니다.
- 제안: `findById`를 `findByIdForUser(executionId, userId)` 형태로 호출하거나, 서비스 레이어에서 `userId` 기반 소유권을 검증하세요. `client.userId`는 이미 핸들러 내에서 접근 가능합니다.

---

**[WARNING] 스냅샷 수신 시 `running` 상태에서 실행 상태가 갱신되지 않음**
- 위치: `use-execution-events.ts` — `handleSnapshot` 내 분기 로직
- 상세: 사용자가 실행 중인 워크플로우 페이지로 재진입(또는 새로 진입)하면, 로컬 스토어의 `prevStatus`는 `"idle"`입니다. 스냅샷 `execution.status === "running"` + `prevStatus !== "waiting_for_input"` 조건은 아무 분기에도 해당하지 않아, 전체 실행 상태가 `"idle"`로 남습니다. 노드별 상태는 정상 갱신되지만, 실행 수준 상태 표시기는 `"idle"`을 유지합니다.
- 제안: 아래 분기를 추가하세요:
  ```ts
  if (execution.status === "running" && prevStatus === "idle") {
    startExecution(execution.id); // 상태를 "running"으로 설정
  }
  ```

---

**[WARNING] `reconnect` 시 스냅샷 중복 적용 가능성**
- 위치: `use-execution-events.ts` — `onReconnect` / `handleSnapshot`
- 상세: 재연결 시 `trySubscribe()`를 재호출하여 백엔드로부터 새 스냅샷을 수신합니다. 이때 `addNodeResult`는 기존 결과와 병합하는지, 덮어쓰는지가 명확하지 않습니다. 이미 `completed` 상태인 실행의 경우 노드 결과가 중복 삽입될 수 있습니다.
- 제안: `handleSnapshot` 진입 시 이미 terminal 상태(`completed`/`failed`)인 로컬 스토어라면 조기 반환하는 가드를 추가하세요:
  ```ts
  const { status: prevStatus } = useExecutionStore.getState();
  if (prevStatus === "completed" || prevStatus === "failed") return;
  ```

---

**[INFO] `finishedAt` 필드가 WS 이벤트 payload에 포함되나 프론트엔드에서 미사용**
- 위치: `use-execution-events.ts` — `handleNodeCompleted`, `handleNodeFailed` 타입 정의
- 상세: `finishedAt?: string`이 타입에 선언되어 있고 백엔드도 전송하지만, `addNodeResult` 호출 시 해당 값이 전달되지 않습니다. 노드 상세 패널에서 종료 시각 표시가 필요한 경우 이를 소비하지 못합니다.
- 제안: `addNodeResult` 호출에 `finishedAt: payload.finishedAt`을 추가하거나, 스토어 타입에 해당 필드를 포함시켜 일관성을 맞추세요.

---

**[INFO] `EXECUTION_SNAPSHOT` enum이 정의되었으나 실제 emit 지점에서 미사용**
- 위치: `websocket.service.ts`, `websocket.gateway.ts:145`
- 상세: `ExecutionEventType.EXECUTION_SNAPSHOT = 'execution.snapshot'`이 enum에 추가되었지만, `emitExecutionSnapshot`에서는 `client.emit('execution.snapshot', ...)` 문자열 리터럴을 직접 사용합니다. 다른 이벤트들은 `emitExecutionEvent(executionId, ExecutionEventType.XXX, ...)` 패턴을 따르나, 스냅샷은 `client.emit`을 직접 호출합니다.
- 제안: `WebsocketService.emitExecutionEvent`를 통해 전송하거나, 최소한 enum 상수를 사용하세요.

---

**[INFO] `?.toISOString?.()` 이중 옵셔널 체이닝 과잉 방어**
- 위치: `execution-engine.service.ts` — 전체 diff의 `finishedAt` 관련 줄
- 상세: `Date` 인스턴스라면 `toISOString`은 항상 존재합니다. `?.toISOString?.()` 패턴은 타입 안전성을 표현하지 않고 런타임 동작도 동일합니다. `finishedAt`이 `null | undefined`일 수 있는 경우는 `nodeExec.finishedAt?.toISOString()` 으로 충분합니다.

---

### 요약

이번 변경은 REST 폴링을 WebSocket 스냅샷 방식으로 전환하는 의도는 명확하고, 프론트엔드·백엔드 양측 구현이 전반적으로 일관되게 작성되었습니다. 그러나 **실행 중 페이지 재진입 시 `running` 상태가 갱신되지 않는 기능적 갭**과 **스냅샷 전송 시 인가 검증 누락**이 핵심 요구사항 관점에서 미충족 사항으로 식별됩니다. 재연결 시 중복 적용 위험도 실제 환경에서 타임라인 UI 오염으로 이어질 수 있어 보완이 필요합니다.

### 위험도

**MEDIUM**