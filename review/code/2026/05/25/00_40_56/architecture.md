# 아키텍처(Architecture) 리뷰

**대상**: workflow-resumable-execution Phase 1.1 / 1.2 — Graceful Shutdown + Recovery 정책 변경  
**리뷰 일자**: 2026-05-25

---

## 발견사항

### [INFO] `ShutdownStateService` 의 단일 책임 원칙 (SRP) — 잘 준수됨

- **위치**: `codebase/backend/src/modules/execution-engine/shutdown/shutdown-state.service.ts`
- **상세**: 서비스가 정확히 세 가지 책임만 수행한다. (a) in-flight 레지스트리 관리, (b) drain 대기, (c) 잔여 row 마킹. 이 세 가지는 "graceful shutdown 상태 관리"라는 하나의 응집된 도메인에 속하며 다른 부수 효과를 포함하지 않는다. 메서드 분리(`waitForDrain`, `markRemainingAsInterrupted`)도 적절하다.
- **제안**: 없음.

---

### [WARNING] `WorkflowsController` 가 `ShutdownStateService` 를 직접 주입 — 프레젠테이션 레이어가 인프라 관심사를 직접 알고 있음

- **위치**: `codebase/backend/src/modules/workflows/workflows.controller.ts` — `constructor` 의 `ShutdownStateService` 주입 및 `execute()` 의 `isShuttingDown` / `retryAfterSec` 직접 참조
- **상세**: 현재 구조에서 컨트롤러는 shutdown 상태를 직접 판단하고 `res.setHeader` 를 직접 조작한다. 이는 프레젠테이션 레이어가 인프라 수명주기 관심사(서버 종료 상태)를 직접 알게 만드는 결합이다. 전통적인 레이어 분리 기준에서는 이 게이트 로직이 NestJS Guard(`@UseGuards(ShutdownGuard)`) 또는 Interceptor 로 추출되어야 프레젠테이션 레이어가 인프라 상태를 모르게 할 수 있다. 현재 규모에서 기능적으로 올바르게 동작하지만, 향후 다른 엔드포인트(예: trigger API, webhook 수신)에서 동일 shutdown gate 가 필요할 때 각 컨트롤러에 반복 코드가 생긴다.
- **제안**: `ShutdownGuard` (`CanActivate`) 로 추출하여 `@UseGuards(ShutdownGuard)` 데코레이터로 적용. Guard 내부에서 `Response` 헤더 설정 후 `ServiceUnavailableException` throw. 컨트롤러는 `ShutdownStateService` 를 알 필요가 없어진다. 단, Phase 1 hotfix 범위에서는 현재 구조도 실용적으로 수용 가능하며 즉시 차단 수준은 아니다.

---

### [WARNING] `SHUTDOWN_GRACE_MS` 주입 토큰이 문자열 리터럴 — 타입 안전성 약화

- **위치**: `codebase/backend/src/modules/execution-engine/execution-engine.module.ts` — `provide: 'SHUTDOWN_GRACE_MS'` / `codebase/backend/src/modules/execution-engine/shutdown/shutdown-state.service.ts` — `@Inject('SHUTDOWN_GRACE_MS')`
- **상세**: 매직 스트링 토큰은 타입 시스템의 보호를 받지 못한다. 토큰명 오타는 런타임 DI 오류로만 발견되며, IDE 리네이밍 도구가 추적하지 못한다. `SHUTDOWN_POLL_MS` 도 동일 패턴이다.
- **제안**: `export const SHUTDOWN_GRACE_MS = Symbol('SHUTDOWN_GRACE_MS')` 또는 `InjectionToken` 상수를 별도 파일(`shutdown.tokens.ts`)에 정의하고 module 과 service 양쪽에서 import. 소규모 서비스이므로 Symbol 사용이 가장 간단하다.

---

### [INFO] `ExecutionEngineService` 의존성 목록이 이미 크고 `ShutdownStateService` 추가로 더 증가 — 과도한 의존성 누적 경향

- **위치**: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `constructor` 의 총 7개 이상 주입
- **상세**: `ShutdownStateService` 추가 자체는 합리적이나, `ExecutionEngineService` 가 이미 많은 서비스를 직접 주입받고 있다는 패턴이 지속 누적되고 있다. 단일 책임 위반이라기보다 경계 위반 징후다. 현재 변경에서는 `registerInFlight` / `unregisterInFlight` 호출이 `executeNode` 의 진입·finally 블록에 추가되는 minimal coupling 이므로 심각도는 낮다.
- **제안**: 중장기적으로 `ExecutionEngineService` 가 AggregateRoot 성격의 신God Object 로 성장하지 않도록, `executeNode` 의 생명주기 이벤트를 도메인 이벤트(NestJS `EventEmitter2`)로 발행하고 `ShutdownStateService` 가 이를 구독하는 구조를 검토할 수 있다. Phase 1 범위에서는 현재 직접 호출이 더 단순하고 실용적이다.

---

### [INFO] `ShutdownStateService.fromConfig` static factory 메서드 — DI 외 생성 경로 이중화

- **위치**: `codebase/backend/src/modules/execution-engine/shutdown/shutdown-state.service.ts` — `static fromConfig()`
- **상세**: NestJS DI 를 통해 인스턴스가 생성되는 동시에 `static fromConfig()` 도 공개 API 로 존재한다. 테스트에서는 생성자 직접 호출(`new ShutdownStateService(...)`)을 사용하므로 `fromConfig` 의 실사용처가 현재 없다. 코드베이스에 사용되지 않는 공개 API 는 유지보수 표면을 늘린다.
- **제안**: 현재 테스트가 생성자 직접 호출로 충분히 커버하고 있으므로 `fromConfig` 를 제거하거나, `private` 또는 `/** @internal */` 로 범위를 축소하는 것이 바람직하다.

---

### [INFO] `recoverStuckExecutions` 의 status 필터 변경 (WAITING_FOR_INPUT → RUNNING) — 명시적 WAITING_FOR_INPUT 보호가 회귀 가드 테스트로 잠김

- **위치**: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` + `execution-engine.service.spec.ts`
- **상세**: 정책 변경 자체는 아키텍처적으로 올바르다. WAITING_FOR_INPUT 을 recovery 대상에서 제외하는 것은 상태 전이 모델의 관심사 분리 — recovery 경로와 rehydration 경로의 독립성 — 를 강화한다. 회귀 방지 테스트(`WAITING_FOR_INPUT 은 recovery WHERE 절에 절대 포함되지 않는다`)가 명시적으로 추가된 점은 아키텍처 의도를 코드로 인코딩한 좋은 사례다.
- **제안**: 없음.

---

### [INFO] `app.enableShutdownHooks()` 위치 — `app.listen()` 전 호출이 올바르며 순서 의존성 명확

- **위치**: `codebase/backend/src/main.ts`
- **상세**: NestJS 에서 `enableShutdownHooks()` 는 `listen()` 전에 호출해야 프로세스 시그널 핸들러가 등록된다. 현재 위치는 올바르다. 주석에 SoT 참조가 명시된 점도 적절하다.
- **제안**: 없음.

---

### [INFO] `ShutdownStateService` 의 `in-flight Map` 에 대한 동시성 안전성 — Node.js 단일 스레드 모델에서 충분

- **위치**: `shutdown-state.service.ts` — `inFlightNodeExecutions: Map<string, string>`
- **상세**: `registerInFlight` / `unregisterInFlight` 는 동기 Map 연산이고, `onApplicationShutdown` 의 drain loop 는 `await setTimeout` 이 있는 비동기 루프다. Node.js 이벤트 루프의 단일 스레드 특성 덕분에 `Map` 에 대한 동시성 경쟁은 없다. SIGTERM 수신 후 `shuttingDown = true` 로 설정하는 것도 같은 이유로 원자적이다. Worker threads 가 도입될 경우 재검토가 필요하다.
- **제안**: 없음 (현재 아키텍처 기준).

---

### [WARNING] `ShutdownStateService` 가 `WorkflowsModule` 에서도 사용 가능하도록 `ExecutionEngineModule.exports` 에 포함 — 모듈 경계가 shutdown 관심사를 프레젠테이션 모듈로 노출

- **위치**: `execution-engine.module.ts` — `exports: [..., ShutdownStateService]`
- **상세**: `ShutdownStateService` 를 `ExecutionEngineModule` 이 export 함으로써 `WorkflowsModule` (통해 `WorkflowsController`) 이 이를 직접 주입받는 구조가 만들어졌다. 이는 인프라 수명주기 서비스가 두 모듈 경계를 횡단하여 프레젠테이션 레이어까지 전파되는 구조다. 기능적으로는 정상이나, 이 패턴을 계속 유지하면 인프라 관심사가 점점 더 많은 모듈로 퍼진다. `ShutdownGuard` 로 추출하면 export 자체도 불필요해진다(Guard 가 같은 모듈 내에서 `ShutdownStateService` 를 주입받으면 됨).
- **제안**: WARNING #2(`WorkflowsController` 직접 주입) 와 동일 해결책 — Guard 패턴 도입 시 `ShutdownStateService` 의 export 를 제거할 수 있다. 현재는 기능 정합성 있음, 구조 개선은 Phase 2 에서 권장.

---

## 요약

Phase 1.1/1.2 변경은 전반적으로 아키텍처 관점에서 건전하다. `ShutdownStateService` 는 단일 책임이 명확하고 NestJS 수명주기 훅(`OnApplicationShutdown`)을 올바르게 활용한다. `recoverStuckExecutions` 의 status 필터 변경은 상태 전이 모델의 관심사를 올바르게 분리하며 회귀 가드 테스트로 잠근 점도 긍정적이다. 주요 구조적 약점은 두 가지다. 첫째, shutdown gate 로직이 컨트롤러에 직접 인라인되어 프레젠테이션 레이어가 인프라 수명주기를 알게 된다는 점으로, NestJS Guard 로 추출하면 해소된다. 둘째, 이 과정에서 `ShutdownStateService` 가 `ExecutionEngineModule.exports` 에 추가되어 모듈 경계를 횡단하는 노출이 생겼으며 Guard 도입 시 불필요해진다. 매직 스트링 주입 토큰과 사용되지 않는 `fromConfig` static factory 는 유지보수 부채이므로 점진적으로 정리할 것을 권고한다. Phase 1 hotfix 의 긴급성을 고려하면 현재 구조를 즉시 차단할 수준은 아니며, 언급된 개선사항은 Phase 2 리팩토링 단계에서 통합하는 것이 현실적이다.

---

## 위험도

**LOW**
