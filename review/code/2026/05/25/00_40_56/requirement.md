# 요구사항(Requirement) 리뷰 결과

**대상**: workflow-resumable-execution Phase 1.1 + Phase 1.2  
**리뷰 일자**: 2026-05-25  
**SoT spec**: `spec/5-system/4-execution-engine.md` §7.4 Recovery / §7.5 / §11 Graceful Shutdown

---

## 발견사항

### [CRITICAL] WS `execution.start` 게이트 누락 — spec §11 요건 미충족

- **위치**: `codebase/backend/src/modules/websocket/websocket.gateway.ts` (미변경)
- **상세**: spec §11 step 1 은 "**`POST /api/executions/start` 및 WS `execution.start` 가** 503 Service Unavailable 응답" 이라고 두 진입점 모두를 명시한다. 현재 변경은 HTTP controller(`WorkflowsController.execute`) 에만 `isShuttingDown` 게이트를 추가했고, WebSocket 게이트웨이에는 동일 게이트가 없다. WS 경로는 websocket.gateway.ts 를 검색한 결과 `SubscribeMessage` 핸들러 중 `execution.start` 에 해당하는 핸들러가 존재하지 않는 것으로 보이지만, spec 이 명시한 진입점이 코드에서 커버됐는지 확인이 필요하다. 만약 WS 경로가 현재 미구현(phase 2 이후 예정)이라면 spec §11 에서 이 사실을 명기하거나 plan 에 pending 으로 표기해야 한다. 그렇지 않으면 spec 과 구현 간 gap 으로 분류된다.
- **제안**: (a) WS `execution.start` 게이트 구현 또는 (b) spec §11 에 "WS 경로는 phase 2 — 현재 HTTP 경로만 적용" 을 명시하거나 plan 에 명기.

---

### [WARNING] spec §11 step 4 — errorPolicy 기반 후속 처리 미구현

- **위치**: `codebase/backend/src/modules/execution-engine/shutdown/shutdown-state.service.ts` L165–224
- **상세**: spec §11 step 4 는 grace period 초과로 남은 NodeExecution 을 `failed + SERVER_INTERRUPTED` 마킹 후, **"Execution 도 노드의 errorPolicy 에 따라 처리(`stop` → Execution `failed`, `continue` → 다음 노드 enqueue)"** 라고 명시한다. 현재 구현은 연관 Execution 을 단순히 `RUNNING → FAILED` 로 일괄 UPDATE 하며, errorPolicy 를 읽거나 `continue` 정책 시 다음 노드를 enqueue 하는 로직이 없다. 이는 스펙 §11 의 `continue` errorPolicy 적용 분기를 누락한 partial implementation 이다.
- **제안**: `markRemainingAsInterrupted` 에서 각 NodeExecution 의 errorPolicy 를 조회해, `stop` → Execution `failed`, `continue` → 다음 노드 enqueue(continuation-queue) 처리하도록 개선. 단기 hotfix 로 `stop` 만 허용하는 보수적 동작을 spec 에 명기(예: "Phase 1.2 는 stop 정책과 동등하게 동작")하는 것도 대안.

---

### [WARNING] 503 응답 body shape — spec §11 과 API 규약 불일치

- **위치**: `codebase/backend/src/modules/workflows/workflows.controller.ts` L229–233
- **상세**: spec §11 step 1 은 "response body 는 표준 API 에러 shape (`{ error: { code: 'SERVER_SHUTTING_DOWN', message: '...' } }`, Spec API 규약)" 을 명시한다. API 규약(`spec/5-system/2-api-convention.md §5.3`) 의 표준 에러 shape 은 `{ error: { code, message, details? } }` 이다. 그런데 현재 구현은 `throw new ServiceUnavailableException({ code: ..., message: ... })` — NestJS 의 `ServiceUnavailableException` 에 body 를 그대로 전달하면 응답은 `{ code: '...', message: '...' }` 최상위 형태가 되어, spec 이 요구하는 `{ error: { code, message } }` 래핑이 없다. `HttpExceptionFilter` 가 변환한다면 일치할 수 있으나 해당 필터가 이를 처리한다는 증거가 변경에 없다.
- **제안**: `{ error: { code: 'SERVER_SHUTTING_DOWN', message: '...' } }` 형태로 직접 throw 하거나, 글로벌 exception filter 가 이 shape 으로 변환함을 명시적으로 확인/테스트.

---

### [WARNING] `unregisterInFlight` 호출 위치 — `executeNode` finally 가 아닌 내부 try 블록 범위 한정

- **위치**: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` diff (registerInFlight/unregisterInFlight 추가 부분)
- **상세**: diff 에서 `registerInFlight` 는 `executeNode` 내부의 `this.eventEmitter.emitNode(...)` 이전에 호출되고, `unregisterInFlight` 는 내부 try/finally (handler.execute 래핑 블록)의 finally 에서 호출된다. 그런데 `executeNode` 전체를 감싸는 outer try/catch 가 있고, `registerInFlight` 이후 `unregisterInFlight` 이전에 outer catch 로 빠져나가는 경로가 있다면 Map 에 잔류할 수 있다. diff 만으로는 전체 메서드 구조를 완전히 파악하기 어려우나, spec 의 "unregister 는 finally 블록(성공/실패/예외 무관)" 요건은 외부 예외에서도 보장되어야 한다.
- **제안**: `registerInFlight` 를 감싸는 finally 가 `executeNode` 전체 스코프와 일치하는지 확인. 그렇지 않으면 외부 try 에도 unregister 로직을 보호.

---

### [WARNING] `ShutdownStateService` — `ConfigService` 미사용, ENV 반영 경로 불명확

- **위치**: `codebase/backend/src/modules/execution-engine/shutdown/shutdown-state.service.ts` L49–63, L69–80
- **상세**: 클래스 생성자는 `@Inject('SHUTDOWN_GRACE_MS')` 토큰으로 graceMs 를 받는다. 모듈(`execution-engine.module.ts`)에서는 `process.env.SIGTERM_GRACE_MS` 를 직접 읽는 `useFactory` 로 제공한다. 그러나 `ShutdownStateService` 에는 `ConfigService` import 와 `static fromConfig(...)` 정적 메서드가 있으며, 이 메서드도 `config.get('SIGTERM_GRACE_MS')` 로 읽는다. 두 경로가 공존해 어느 것이 production 경로인지 모호하고, `ConfigService` 를 통한 타입 안전한 설정 접근이 권장되는 NestJS 패턴과 달리 `process.env` 직접 접근은 테스트에서 위험할 수 있다. `fromConfig` 는 사용되지 않는 dead code 가 될 가능성이 있다.
- **제안**: production DI 경로를 `ConfigService` 기반으로 통일하거나, `process.env` 직접 접근이 의도된 것임을 주석으로 명시. `fromConfig` 가 테스트 전용이면 `@VisibleForTesting` 등으로 표기.

---

### [WARNING] `ShutdownStateService` — Execution 마킹 시 `errorPolicy` 미고려로 `WAITING_FOR_INPUT` 상태의 Execution 오마킹 가능성

- **위치**: `codebase/backend/src/modules/execution-engine/shutdown/shutdown-state.service.ts` L199–215
- **상세**: Execution UPDATE 쿼리에 `status = 'running'` 가드가 있어 `WAITING_FOR_INPUT` Execution 은 건드리지 않도록 되어 있다. 그러나 `inFlightNodeExecutions` 에 등록된 executionId 를 SET 으로 dedup 해 Execution 을 업데이트하는데, 만약 동일 executionId 아래 일부 NodeExecution 은 RUNNING(등록됨), 나머지는 WAITING_FOR_INPUT 이라면 Execution 자체는 여전히 `running` 상태이므로 spec 정책대로 `FAILED` 마킹 대상이 된다. 이 경우는 스펙에 부합하므로 이슈는 아니다. 다만 `andWhere('status = :status', { status: ExecutionStatus.RUNNING })` 가드가 반드시 있어야 한다는 점을 명시적으로 테스트하는 케이스가 없다.
- **제안**: `markRemainingAsInterrupted` 의 Execution UPDATE 에 `status = 'running'` 가드가 있음을 검증하는 별도 테스트 케이스 추가.

---

### [INFO] spec §11 — `SIGTERM_GRACE_MS` ENV 반영 방식이 spec 표와 코드 상수 간 일부 차이

- **위치**: `codebase/backend/src/modules/execution-engine/execution-engine.module.ts` L77–80
- **상세**: spec §11 표는 `SIGTERM_GRACE_MS` 기본값 30000 을 명시한다. 모듈의 `useFactory` 는 `process.env.SIGTERM_GRACE_MS ?? 30_000` 로 일치. 그러나 `ShutdownStateService` 생성자에서도 `graceMs ?? 30_000` 이중 폴백을 둔다. 이는 무해하지만 기본값이 두 곳에 중복 정의된다.
- **제안**: 기본값 `30_000` 을 단일 상수(`DEFAULT_GRACE_MS`)로 추출해 한 곳에서만 정의.

---

### [INFO] spec §11 — `SIGTERM_GRACE_MS` ENV 이름이 spec 과 코드에서 일치함 (fidelity 확인)

- **위치**: `execution-engine.module.ts` useFactory, `shutdown-state.service.ts` fromConfig
- **상세**: spec §11 표의 환경변수명 `SIGTERM_GRACE_MS`, 코드의 `process.env.SIGTERM_GRACE_MS`, `config.get('SIGTERM_GRACE_MS')` 모두 일치. spec fidelity 충족.

---

### [INFO] spec §7.4 Recovery — `status='running'` 대상 한정 구현이 spec 요건과 정확히 일치

- **위치**: `execution-engine.service.ts` diff (recoverStuckExecutions 변경)
- **상세**: spec §7.4 "Stale 대상 한정: `status='running'` 인 row 만 stuck recovery 대상. WAITING_FOR_INPUT 무기한 보존" 과 코드의 `.where('status = :status', { status: ExecutionStatus.RUNNING })` 가 line-level 일치. 에러 메시지 `'worker heartbeat timeout'` 은 spec 에 정확한 문자열이 정의되어 있지 않으나 의미 부합. spec fidelity 충족.

---

### [INFO] spec §7.5 rehydration — Phase 1 scope 에서 미구현임이 코드 주석에 명시

- **위치**: `execution-engine.service.ts` diff L2176–2298 주석
- **상세**: Phase 2(BullMQ continuation-queue + rehydration) 에서 본격 구현 예정임이 주석에 명시되어 있다. Phase 1.1 의 의도(WAITING_FOR_INPUT 을 auto-FAIL 시키지 않음)는 달성되었고, rehydration 미구현으로 인한 silent skip 동작도 주석에 명기. spec §7.5 는 Phase 2 scope 으로 현재 구현 미완성은 계획된 상태.

---

### [INFO] `ShutdownStateService` 테스트 커버리지 — 멱등성·drain·timeout 케이스 충분

- **위치**: `shutdown-state.service.spec.ts` 신규 파일
- **상세**: 초기 상태, register/unregister, retryAfterSec ceil, drain 성공, grace 초과 마킹, 중복 shutdown, 멱등성, WHERE 절 nodeExecutionId 검증 등 핵심 시나리오가 테스트됨. spec §11 의 주요 계약 항목(isShuttingDown 플래그, inFlight 추적, SERVER_INTERRUPTED 마킹)이 단위 테스트로 커버.

---

## 요약

Phase 1.1(recoverStuckExecutions WAITING_FOR_INPUT 제외)과 Phase 1.2(Graceful Shutdown 인프라) 의 핵심 구현은 spec §7.4 Recovery 요건 및 §11 의 주요 계약(SIGTERM_GRACE_MS, isShuttingDown gate, SERVER_INTERRUPTED 마킹, WAITING_FOR_INPUT 불간섭)을 충족한다. 그러나 세 가지 주요 갭이 남는다. 첫째, spec §11 이 명시한 WS `execution.start` 503 게이트가 구현에 없어 CRITICAL 로 분류한다(WS 경로가 미구현이라면 spec 또는 plan 에 명기 필요). 둘째, grace period 초과 후 errorPolicy 기반 `stop`/`continue` 분기가 구현되지 않아 spec §11 step 4 를 부분 충족에 그친다. 셋째, 503 응답 body 가 API 규약의 `{ error: { code, message } }` 래핑을 충족하는지 불명확하다. 나머지 발견사항은 INFO 또는 경미한 WARNING 수준이다.

---

## 위험도

**HIGH**

WS 진입점 shutdown gate 누락(CRITICAL)과 errorPolicy 분기 미구현(WARNING)이 운영 시 서비스 동작에 직접 영향을 줄 수 있는 사항으로, 머지 전 검토 및 조치가 필요하다.
