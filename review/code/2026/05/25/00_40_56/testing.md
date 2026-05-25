# 테스트(Testing) 리뷰

**대상**: workflow-resumable-execution Phase 1.1 / 1.2 (Graceful Shutdown + Recovery 정책 변경)
**리뷰 일자**: 2026-05-25

---

## 발견사항

### [INFO] `ShutdownStateService` 단위 테스트 — 전반적으로 충분하고 격리 우수

- **위치**: `codebase/backend/src/modules/execution-engine/shutdown/shutdown-state.service.spec.ts` (신규, 184줄)
- **상세**: 초기 상태·register/unregister 카운팅·`retryAfterSec` ceil 계산·즉시 drain·graceMs 초과 후 SERVER_INTERRUPTED 마킹·shutdown 중 register noop·멱등성·WHERE 절 id 필터링·enum sanity 등 핵심 시나리오를 모두 단위 수준에서 커버한다. 각 `it` 블록이 독립적인 `buildService()` 호출로 시작해 테스트 간 상태 오염이 없다. 격리 설계 우수.
- **제안**: 없음.

---

### [WARNING] `ShutdownStateService` — DB UPDATE 실패(`markRemainingAsInterrupted` catch 분기) 테스트 누락

- **위치**: `shutdown-state.service.ts:190–196` (executionRepo catch 블록), `172–197` (nodeExecutionRepo catch 블록)
- **상세**: 구현 내 `markRemainingAsInterrupted` 는 각 repo UPDATE를 개별 try/catch 로 감싸 오류를 `logger.error` 로만 기록하고 `onApplicationShutdown` 이 throw 없이 정상 반환되도록 설계되어 있다. 그러나 테스트에서 `executionUpdateMock.mockRejectedValue(new Error('DB down'))` 같은 시나리오가 없다. DB가 shutdown 직전 연결 해제되는 상황은 실제 운영에서 발생 가능하므로, catch 분기가 실행될 때 서비스가 throw 하지 않고 종료되는지(graceful degradation) 검증이 필요하다.
- **제안**:
  ```ts
  it('UPDATE 실패해도 onApplicationShutdown 은 throw 하지 않는다', async () => {
    executionUpdateMock.mockRejectedValue(new Error('DB connection lost'));
    nodeExecutionUpdateMock.mockRejectedValue(new Error('DB connection lost'));
    service = buildService(30, 10);
    service.registerInFlight('ne-1', 'exec-1');
    await expect(service.onApplicationShutdown('SIGTERM')).resolves.toBeUndefined();
  });
  ```

---

### [WARNING] `ExecutionEngineService` — `executeNode`에서 `registerInFlight`/`unregisterInFlight` 호출 여부 미검증

- **위치**: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`, `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3307–3340`
- **상세**: `execution-engine.service.ts` 의 `executeNode` 메서드에서 Phase 1.2 로 `this.shutdownState.registerInFlight(...)` (핸들러 호출 직전)와 `this.shutdownState.unregisterInFlight(...)` (finally 블록)이 추가되었다. `execution-engine.service.spec.ts` 의 ShutdownStateService mock 에는 `registerInFlight: jest.fn()`, `unregisterInFlight: jest.fn()` 이 선언되어 있으나, 기존 혹은 신규 어떤 `it` 블록에서도 이 두 호출이 실제로 발생했는지(`toHaveBeenCalled`, `toHaveBeenCalledWith`) 단언하지 않는다. 특히 핸들러 throw 시 `finally` 블록의 `unregisterInFlight` 가 호출되는지 검증이 완전히 없다.
- **제안**: 기존 `executeInline` 또는 별도 `executeNode in-flight tracking` describe 블록에 다음 케이스 추가:
  1. 핸들러 성공 시 `registerInFlight` 1회, `unregisterInFlight` 1회 호출 검증
  2. 핸들러 throw 시에도 `unregisterInFlight` 가 반드시 호출되는지 (finally 보장) 검증

---

### [WARNING] `WorkflowsController` — 503 응답의 `message` 필드 검증 누락

- **위치**: `codebase/backend/src/modules/workflows/workflows.controller.spec.ts:206–213`
- **상세**: 503 테스트는 `body.code === 'SERVER_SHUTTING_DOWN'` 과 `Retry-After` 헤더를 검증하지만, `body.message` 필드는 assert 하지 않는다. 컨트롤러 구현에서 `message` 는 클라이언트가 사람이 읽을 수 있는 안내 문자열로 포함되며, 공백·오타·누락 시 클라이언트 UX에 영향을 준다.
- **제안**:
  ```ts
  expect(typeof body.message).toBe('string');
  expect((body.message as string).length).toBeGreaterThan(0);
  ```

---

### [INFO] `recoverStuckExecutions` 테스트 — `WAITING_FOR_INPUT` 회귀 가드 설계 적절

- **위치**: `execution-engine.service.spec.ts:731–743`
- **상세**: `WAITING_FOR_INPUT` 이 WHERE 절에 절대 포함되지 않음을 `JSON.stringify` 기반 string 검색으로 검증한다. 리터럴 문자열 `'waiting_for_input'` 과 `'WAITING_FOR_INPUT'` 두 케이스 모두 체크해 대소문자 변환 회귀도 방지한다. 의도가 명확하고 회귀 방지 목적에 충분히 부합한다.
- **제안**: 없음.

---

### [INFO] `recoverStuckExecutions` 테스트 — 에러 메시지 변경 후 회귀 가드 적절히 갱신됨

- **위치**: `execution-engine.service.spec.ts:696–728`
- **상세**: `'server restarted'` → `'worker heartbeat timeout'` 메시지 변경에 맞춰 `toContain('worker heartbeat timeout')` 과 `not.toContain('server restarted while waiting for user input')` 양쪽 모두 명시적으로 검증한다. 변경 전 메시지가 재등장하면 바로 실패하도록 설계된 회귀 가드 패턴으로 적절하다.
- **제안**: 없음.

---

### [INFO] `ShutdownStateService.buildChain` mock — `andWhere` 체인 구조 제약

- **위치**: `shutdown-state.service.spec.ts:382–392` (`buildChain` helper)
- **상세**: mock chain이 `update → set → where → andWhere → execute` 의 고정 순서를 가정한다. 구현이 `andWhere` 없이 `where.execute()` 를 직접 호출하거나 체인 순서가 바뀌면 mock 이 silent `undefined` 반환으로 테스트가 이상하게 통과할 수 있다. 현재 구현 코드와 1:1 대응하므로 즉각 위험은 낮지만, 구현 변경 시 오탐 위험이 있다.
- **제안**: `execute` mock이 실제 호출됐는지 `toHaveBeenCalled()` 로 각 테스트에서 최소 확인하거나, chain spy 노출 방식을 `jest.spyOn` 기반으로 리팩터링 검토.

---

### [WARNING] `SHUTDOWN_GRACE_MS` DI 토큰 — 환경변수 파싱 로직(`Number(process.env.SIGTERM_GRACE_MS ?? 30_000)`)에 대한 모듈 레벨 테스트 없음

- **위치**: `codebase/backend/src/modules/execution-engine/execution-engine.module.ts:74–78`
- **상세**: `SHUTDOWN_GRACE_MS` factory는 `process.env.SIGTERM_GRACE_MS` 를 `Number()` 로 파싱한다. `SIGTERM_GRACE_MS=abc` 처럼 비숫자 값이 들어오면 `NaN` 이 `graceMs` 로 주입되어 `waitForDrain`의 `Date.now() < deadline` 연산이 항상 false가 된다 (`NaN` 비교). `execution-engine.module.spec.ts` 가 존재하지 않아 이 경계값 파싱은 완전히 테스트 사각지대이다.
- **제안**: `ShutdownStateService` 단위 테스트에 `buildService(NaN)` 케이스를 추가하거나, 모듈 factory에 `Number.isFinite(graceMs) ? graceMs : 30_000` 방어 코드를 넣고 해당 분기를 테스트에 포함할 것.

---

### [INFO] `enableShutdownHooks()` — `main.ts` 변경은 단위 테스트 불가, 통합/e2e 수준 검증 필요

- **위치**: `codebase/backend/src/main.ts` (bootstrap 함수 내 `app.enableShutdownHooks()`)
- **상세**: `app.enableShutdownHooks()` 한 줄 추가는 NestJS 생명주기 훅 활성화이며, 이 호출 없이는 `onApplicationShutdown` 이 SIGTERM에 트리거되지 않는다. 이 동작을 단위 테스트로 검증하는 것은 구조적으로 어렵다. 현재 e2e 테스트가 이를 커버하는지 확인되지 않으며, 누락 시 운영 환경에서 Graceful Shutdown 전체가 무력화된다.
- **제안**: `enableShutdownHooks` 가 실제로 호출되는지를 보장하는 smoke 수준 통합 테스트 또는 e2e 시나리오(SIGTERM 후 503 응답 확인)를 추가할 것. 최소한 plan 문서에 "e2e 검증 항목: SIGTERM 수신 → `onApplicationShutdown` 호출 여부"를 추적 항목으로 명시할 것.

---

### [INFO] `ShutdownStateService.fromConfig` 정적 팩터리 — 테스트 없음

- **위치**: `shutdown-state.service.ts:69–80` (`static fromConfig`)
- **상세**: `fromConfig` 는 `ConfigService` 에서 `SIGTERM_GRACE_MS` 를 읽어 인스턴스를 생성하는 팩터리이다. 현재 테스트는 `new ShutdownStateService(...)` 직접 생성 경로만 검증하며, `fromConfig` 는 커버되지 않는다. 이 팩터리가 실제 DI 외부에서 사용되지 않는다면 삭제를 검토하거나, 사용된다면 최소 smoke 테스트가 필요하다.
- **제안**: `fromConfig` 가 `graceMs` 를 `ConfigService` 에서 올바르게 읽는지 간단한 단위 테스트 1건 추가.

---

## 요약

이번 변경에서 테스트 품질은 전반적으로 준수하다. `ShutdownStateService`는 신규 서비스임에도 불구하고 184줄 전용 spec 파일로 핵심 경로를 충분히 커버하며, `recoverStuckExecutions` 의 `WAITING_FOR_INPUT` 회귀 가드와 `WorkflowsController` 의 503 gate 테스트도 명확하다. 그러나 세 가지 중요 갭이 존재한다. 첫째, `executeNode` 의 `registerInFlight`/`unregisterInFlight` 짝 호출 — 특히 핸들러 throw 시 finally 보장 — 이 검증되지 않아 in-flight 누수 버그가 실수로 도입되어도 테스트가 통과할 수 있다. 둘째, DB 연결 실패 시 `markRemainingAsInterrupted` catch 분기가 graceful하게 동작하는지 검증이 없다. 셋째, `SIGTERM_GRACE_MS` 환경변수에 비숫자 값이 입력될 때 `NaN` 이 주입되는 엣지 케이스가 모듈 레벨에서 완전히 사각지대이다. 이 세 가지는 운영 환경 Graceful Shutdown 의 핵심 보장 코드 경로이므로 합류 전 보강이 권장된다.

---

## 위험도

**MEDIUM**

핵심 in-flight 등록/해제 짝 검증 부재와 DB 장애 시 graceful degradation 미검증이 운영 안정성에 직결되는 코드 경로를 커버하지 못하고 있다. 기능 자체가 동작 불능 상태가 되는 수준은 아니나, 회귀 발생 시 테스트가 잡지 못할 가능성이 있어 MEDIUM으로 판정한다.
