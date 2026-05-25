# 동시성(Concurrency) 리뷰

**대상 변경**: workflow-resumable-execution Phase 1.1 / 1.2 — Graceful Shutdown + Recovery 정책 변경
**리뷰 일자**: 2026-05-25
**핵심 신규 파일**: `codebase/backend/src/modules/execution-engine/shutdown/shutdown-state.service.ts`

---

## 발견사항

### [WARNING] `inFlightNodeExecutions` Map 에 대한 동시 read/write 경쟁 조건

- **위치**: `shutdown-state.service.ts` — `registerInFlight` (line 102–105), `unregisterInFlight` (line 108–109), `onApplicationShutdown` (line 112–151), `waitForDrain` (line 153–163)
- **상세**: Node.js 는 단일 이벤트 루프로 동작하므로 순수 JS 수준에서는 일반적으로 동시 접근 문제가 없다. 그러나 이 코드는 async/await 를 사용하며 `waitForDrain` 내 `setTimeout` 으로 제어를 양보(yield)한다. 양보 지점 사이에 이벤트 루프가 다른 microtask/macrotask 를 처리하면서 `registerInFlight` / `unregisterInFlight` 가 호출될 수 있다.

  구체적인 시나리오:
  1. `onApplicationShutdown` 이 `this.shuttingDown = true` 설정 (line 117).
  2. `waitForDrain` 내에서 `setTimeout(resolve, pollMs)` 로 이벤트 루프에 제어 양보.
  3. 이 양보 기간 중 `ExecutionEngineService.executeNode` 의 finally 블록에서 `unregisterInFlight` 가 호출 — 정상이며 의도된 흐름.
  4. 단, `waitForDrain` 가 `inFlightCount === 0` 을 확인하는 시점과 `markRemainingAsInterrupted` 에 남은 ID 목록을 스냅샷으로 넘기는 시점 사이(line 131–148)에 또 다른 `unregisterInFlight` 가 실행될 수 있다.

  실제 위험: `drained = false` 판단 이후 `remainingNodeExecutionIds` 를 `Array.from(this.inFlightNodeExecutions.keys())` 로 수집하는 사이(lines 137–141)에 handler 가 완료되어 Map 에서 삭제되면, 이미 정상 완료된 NodeExecution 을 `SERVER_INTERRUPTED` 로 마킹할 수 있다.

  단, 이 시나리오가 실제 피해를 유발하려면 TypeORM update 의 `andWhere('status = :status', { status: NodeExecutionStatus.RUNNING })` 가드가 없어야 한다. 코드를 보면 이 `andWhere` 가드가 존재하므로(line 186–188), 핸들러가 정상 완료하면서 DB 에 `FINISHED/FAILED` 로 이미 마킹한 행에는 UPDATE 가 적용되지 않는다. 따라서 실제 DB 피해는 없다. 하지만 로그에 불필요한 경고가 남을 수 있고, 설계 의도가 코드에서 명확하지 않다.

- **제안**: `markRemainingAsInterrupted` 호출 직전에 Map 의 스냅샷(freeze)을 명시적으로 만들어 의도를 표현한다. 이미 `Array.from(...)` 으로 스냅샷화하고 있으나, 스냅샷 수집과 drain 판단 사이의 창(window)이 문서화되지 않았다. `waitForDrain` 반환 이후 스냅샷을 즉시 `const snapshot = new Map(this.inFlightNodeExecutions)` 형태로 고정하거나, 주석으로 "status guard 가 spurious UPDATE 를 차단한다"는 설계 근거를 추가하면 충분하다.

---

### [WARNING] `registerInFlight` 의 셧다운 중 race — `isShuttingDown` 체크 이후 Map 삽입

- **위치**: `shutdown-state.service.ts` line 102–105

  ```ts
  registerInFlight(nodeExecutionId: string, executionId: string): void {
    if (this.shuttingDown) return;
    this.inFlightNodeExecutions.set(nodeExecutionId, executionId);
  }
  ```

- **상세**: `this.shuttingDown = true` 설정(line 117)과 `waitForDrain` 진입 사이에는 제어 양보가 없다. 그러나 `app.enableShutdownHooks()` 가 SIGTERM 을 받아 `onApplicationShutdown` 을 실행하는 시점 이전에 이미 큐에서 꺼내진 job 이 handler 진입 직전에 있을 수 있다. Node.js 단일 스레드 모델에서 `onApplicationShutdown` 이 실행되려면 현재 실행 중인 microtask 가 먼저 완료되어야 하므로, `if (this.shuttingDown) return` 이 실제 경쟁 조건이 되려면 두 async 함수가 동시에 실행되어야 한다.

  실제로는: `shuttingDown = true` 가 동기적으로 설정되고, 이후 `await waitForDrain` 에서 첫 yield 가 발생한다. 이 yield 이후 이벤트 루프에서 새로운 `registerInFlight` 가 호출될 수 있다 — BullMQ worker 가 새 job 을 consume 하는 경우. BullMQ 의 concurrency 설정에 따라 grace period 시작 이후에도 이미 큐에서 dequeue 된 job 이 `registerInFlight` 를 호출할 수 있다.

  테스트(spec.ts line 499–508)의 "shutdown 중 register 호출은 무시(멱등)" 케이스가 이 상황을 커버하며 `isShuttingDown = true` 직후 `registerInFlight` 가 noop 임을 검증한다. 설계 자체는 이 race 를 인식하고 방어하고 있다.

  잔존 위험: `shuttingDown` 플래그 설정(line 117)과 BullMQ worker 가 새 job consume 을 멈추는 시점 사이의 window. BullMQ worker 는 `onApplicationShutdown` 에서 별도로 `close()` 를 호출해야 graceful stop 된다. 현재 변경에서 BullMQ worker 의 `close()` 호출 위치가 확인되지 않으므로, `ShutdownStateService.onApplicationShutdown` 이 호출되는 Nest lifecycle 순서와 BullMQ worker 종료 순서가 조율되지 않으면 grace period 중에도 새 job 이 dispatch 될 수 있다.

- **제안**: BullMQ `Queue`/`Worker` 의 `close()` 또는 `pause()` 호출이 `ShutdownStateService.onApplicationShutdown` 과 같은 lifecycle 단계 혹은 그 이전에 호출되는지 확인할 것. `registerInFlight` 의 `if (this.shuttingDown) return` guard 는 최후 안전망이지, BullMQ 신규 dispatch 를 막는 주 수단이 되어선 안 된다.

---

### [INFO] `waitForDrain` 의 polling 기반 구현 — 이벤트 루프 특성상 문제 없음, 단 성능 trade-off 인식

- **위치**: `shutdown-state.service.ts` line 153–163

  ```ts
  private async waitForDrain(timeoutMs: number, pollMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (this.inFlightCount === 0) return true;
      await new Promise<void>((resolve) => setTimeout(resolve, pollMs));
    }
    return this.inFlightCount === 0;
  }
  ```

- **상세**: polling 방식은 단순하고 올바르게 구현됐다. `setTimeout` 으로 이벤트 루프에 제어를 돌려주어 다른 callback (handler finally 블록) 이 실행될 수 있게 한다. 기본 `pollMs=200` 은 적절하며 이벤트 루프 블로킹을 유발하지 않는다. 이상적으로는 `unregisterInFlight` 에서 count=0 에 도달하는 시점에 `Promise resolve` 로 즉시 깨어나는 signal 방식(예: counting semaphore 또는 EventEmitter 활용)이 응답성이 더 높겠으나, grace period(30초) 맥락에서 200ms polling 은 실용적으로 충분하다. 오버엔지니어링 없이 단순성을 선택한 것은 타당하다.

- **제안**: 없음. 현재 구현으로 충분하다.

---

### [INFO] `onApplicationShutdown` 의 멱등성 — 이중 SIGTERM 방어

- **위치**: `shutdown-state.service.ts` line 112–116

  ```ts
  if (this.shuttingDown) {
    return;
  }
  this.shuttingDown = true;
  ```

- **상세**: Node.js 단일 스레드에서 `if (this.shuttingDown)` 체크와 `this.shuttingDown = true` 설정은 원자적으로 보장된다 (두 연산 사이에 이벤트 루프 yield 없음). 따라서 이중 SIGTERM 으로 `onApplicationShutdown` 이 두 번 호출되어도 race condition 없이 멱등 동작한다. 테스트(line 532–540)가 이를 명시적으로 검증한다.

- **제안**: 없음.

---

### [INFO] `recoverStuckExecutions` 의 분산 락 (기존 코드 변경)

- **위치**: `execution-engine.service.ts` — `recoverStuckExecutions` 메서드 변경 부분
- **상세**: 변경 내용은 WHERE 절의 `status` 조건을 `WAITING_FOR_INPUT` → `RUNNING` 으로 바꾼 것이다. 분산 락(`SET NX`)을 통해 다중 인스턴스가 동시에 recovery 를 수행하지 않도록 방어하는 기존 메커니즘은 변경되지 않았다. 락 획득 실패 시 UPDATE 를 수행하지 않는 guard 도 유지된다. 동시성 관점에서 회귀 없음.

- **제안**: 없음.

---

### [INFO] `WorkflowsController` 의 503 gate — `isShuttingDown` 읽기 시점

- **위치**: `workflows.controller.ts` line 621–628

  ```ts
  if (this.shutdownState.isShuttingDown) {
    res.setHeader('Retry-After', ...);
    throw new ServiceUnavailableException(...);
  }
  ```

- **상세**: `isShuttingDown` getter 는 `this.shuttingDown` boolean 을 단순 반환한다. Node.js 단일 스레드에서 boolean 읽기는 원자적이다. `true` 로 바뀐 이후 컨트롤러가 호출되면 정확히 503 을 반환한다. `false` 를 읽고 통과한 뒤 shutdown 이 시작되는 TOCTOU(Time-of-check/time-of-use) 창이 존재하지만, 이 경우 해당 실행은 `registerInFlight` → drain → `SERVER_INTERRUPTED` 마킹 경로로 처리된다. 설계상 허용된 창이며 별도 보호 불필요.

- **제안**: 없음.

---

## 요약

이번 변경의 핵심 동시성 관련 코드는 `ShutdownStateService` 이다. Node.js 단일 이벤트 루프 모델 하에서 `isShuttingDown` flag 와 `inFlightNodeExecutions` Map 의 read/write 는 대부분 안전하게 설계됐다. 가장 주의할 WARNING 은 두 가지다. 첫째, `waitForDrain` 반환 이후 `Array.from(Map.keys())` 로 스냅샷을 수집하는 사이 handler 가 완료되어 Map 에서 삭제될 수 있으나, TypeORM UPDATE 의 `andWhere('status = RUNNING')` 가드가 spurious UPDATE 를 실질적으로 차단한다. 둘째, BullMQ worker 의 `close()`/`pause()` 호출이 `ShutdownStateService.onApplicationShutdown` 과 lifecycle 순서가 맞지 않으면 grace period 중에도 새 job 이 dispatch 될 수 있어 `registerInFlight` guard 가 최후 방어선이 되는 상황이 발생한다. `recoverStuckExecutions` 변경, 멱등성 보장, 503 gate 는 동시성 관점에서 올바르게 구현됐다.

---

## 위험도

**LOW**

실질적인 DB 데이터 손상 경로는 TypeORM status guard 에 의해 차단된다. BullMQ lifecycle 순서 미조율 위험은 코드 밖(인프라/모듈 구성) 문제이며 현재 변경만으로 판단하기 어렵다. 나머지 항목은 INFO 수준으로 차단 불필요.
