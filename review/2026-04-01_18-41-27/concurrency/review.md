### 발견사항

---

**[CRITICAL]** `pendingContinuations` Map에 대한 동시 접근 경쟁 조건
- **위치**: `execution-engine.service.ts` — `waitForFormSubmission()`, `continueExecution()`, `cancelWaitingExecution()`
- **상세**: NestJS는 기본적으로 단일 스레드(Node.js 이벤트 루프) 위에서 동작하지만, 여러 요청(WebSocket 메시지 + REST API)이 **동일한 executionId**에 대해 `continueExecution`을 동시에 호출할 수 있다. 현재 구현에서 두 경로(WebSocket `execution.submit_form` + REST `POST /executions/:id/continue`)가 모두 `continueExecution()`을 호출하며, Map에서 `get` → `delete` → `resolve` 사이에 다른 호출이 끼어들 수 있다. 단일 스레드이므로 진정한 race condition은 아니지만, 같은 틱 내에서 두 번 호출되면 두 번째 호출이 `undefined`를 반환해 무시된다 — 이는 정상이나 **에러 응답 없이 소리 없이 실패**하는 문제가 있다.

    ```typescript
    // continueExecution 호출 1: pending 존재, delete 후 resolve
    // continueExecution 호출 2: pending 없음, 에러 throw → 클라이언트에 노출
    ```
- **제안**: `continueExecution`이 이미 처리된 경우에도 멱등성(idempotent)을 보장하도록 처리하거나, 중복 제출 방지 로직을 추가하세요. 또한 WebSocket과 REST 두 채널 모두에서 접근 가능한 것은 설계 결함입니다 — 단일 채널만 허용하는 것을 권장합니다.

---

**[WARNING]** `executionsService.stop()`과 `cancelWaitingExecution()` 간의 원자성 부재
- **위치**: `executions.service.ts` — `stop()` 메서드, `execution-engine.service.ts` — `cancelWaitingExecution()`
- **상세**: `stop()` REST 엔드포인트는 DB에서 execution 상태를 `CANCELLED`로 변경하지만, in-memory `pendingContinuations`에 있는 Promise를 reject하지 않는다. 반대로 `cancelWaitingExecution()`은 Promise를 reject하고 나중에 DB를 업데이트한다. 두 경로가 동시에 실행되면 DB는 중복 업데이트되고, `ExecutionCancelledError` catch 블록에서 이미 `CANCELLED`인 상태를 다시 저장하는 중복 저장이 발생한다.

    ```typescript
    // stop() → DB: CANCELLED
    // cancelWaitingExecution() → reject → catch(ExecutionCancelledError) → DB: CANCELLED (중복)
    ```
- **제안**: `stop()` 메서드에서 `executionEngineService.cancelWaitingExecution(id)`도 함께 호출하거나, `ExecutionEngineService`에서 stop 로직을 통합 관리하세요.

---

**[WARNING]** `waitForFormSubmission` 내 비동기 흐름에서 `nodeExec` null 참조 위험
- **위치**: `execution-engine.service.ts` — `waitForFormSubmission()` 155~190행 근방
- **상세**: `await new Promise(...)` 이후 `formData`를 받아 `nodeExec`를 업데이트하는데, 이 await 지점 전후로 `nodeExec`가 null이면 해당 블록이 통째로 스킵된다. 더 중요한 것은, **await 이후** 코드 실행 시점에 `savedExecution` 객체가 여전히 메모리에 있는 동일 참조인데, 다른 비동기 작업(예: 폴링으로 인한 DB 업데이트)이 그 사이에 상태를 변경했을 가능성이 있다. DB의 실제 상태와 in-memory `savedExecution`이 불일치할 수 있다.
- **제안**: `await` 이후 DB에서 최신 execution 상태를 다시 조회하거나, optimistic locking/versioning을 적용하세요.

---

**[WARNING]** 폴링 중 `waiting_for_input` 상태에서 `pauseForForm` 반복 호출
- **위치**: `frontend/src/lib/websocket/use-execution-events.ts` — `pollExecutionStatus()` 내 `waiting_for_input` 처리
- **상세**: `waiting_for_input` 상태는 terminal이 아니어서 `return false`로 폴링이 계속된다. 2초마다 `pauseForForm(nodeId, formConfig)`가 반복 호출되는데, Zustand `set()`은 동기적으로 처리되므로 실질적 문제는 없지만, 불필요한 re-render를 매 2초마다 트리거한다. 더불어 사용자가 폼을 제출(`resumeFromForm()`)하고 상태가 `running`으로 바뀌었더라도, 다음 폴링 결과가 오기 전까지 이미 예약된 폴링 타이머가 있으면 `pauseForForm`이 한 번 더 호출될 수 있다.
- **제안**: `pauseForForm` 호출 전 현재 store 상태를 확인하여 이미 `waiting_for_input`이면 스킵하거나, `waitingNodeId`가 같은 경우 중복 호출을 방지하세요.

---

**[INFO]** `emit` 이후 WsClient의 소켓 상태 미확인
- **위치**: `frontend/src/lib/websocket/ws-client.ts` — `emit()`, `run-results-drawer.tsx` — `handleFormSubmit()`
- **상세**: `emit()`은 `socket?.emit(event, data)` 형태로 구현되어 소켓이 연결되지 않은 경우 **소리 없이 실패**한다. 폼 제출 시 사용자는 성공 피드백을 받지만 실제로는 메시지가 전송되지 않았을 수 있다.
- **제안**: `emit()` 반환값으로 전송 성공/실패를 알리거나, 소켓 연결 상태를 확인 후 미연결 시 REST fallback(`POST /executions/:id/continue`)을 사용하세요.

---

**[INFO]** `cancelledRef` 체크와 `pauseForForm` 호출 사이의 순서 보장
- **위치**: `use-execution-events.ts` — `pollExecutionStatus()` 내 cleanup
- **상세**: cleanup 함수에서 `cancelledRef.current = true`를 설정하지만, 이미 진행 중인 `pollExecutionStatus()` Promise 내부에서는 `await executionsApi.getById()` 이후에도 `cancelledRef.current` 체크가 있다. 그러나 `pauseForForm` 호출 직전에는 `cancelledRef` 체크가 없어, 컴포넌트 언마운트 후에도 `pauseForForm`이 호출될 수 있다 (React "Can't perform a state update on an unmounted component" 패턴).
- **제안**: `waiting_for_input` 처리 블록 앞에도 `if (cancelledRef.current) return true;` 체크를 추가하세요.

---

### 요약

이번 변경의 핵심인 Form 노드 blocking 패턴(`pendingContinuations` Map + Promise 기반 suspend)은 Node.js 단일 스레드 환경에서 동작하는 영리한 접근이지만, **두 개의 독립 채널(WebSocket + REST)이 동일 continuation을 트리거할 수 있다는 구조적 문제**가 가장 심각하다. `stop()` ↔ `cancelWaitingExecution()` 간의 DB 중복 업데이트 가능성도 데이터 일관성을 해칠 수 있다. 프론트엔드에서는 2초 폴링 중 `waiting_for_input` 상태에서 `pauseForForm` 반복 호출 및 unmount 후 상태 업데이트 시도가 사소한 문제를 일으킬 수 있다. 전반적으로 설계 방향은 올바르나 두 진입점 통합과 stop/cancel 흐름 정리가 필요하다.

### 위험도
**MEDIUM**