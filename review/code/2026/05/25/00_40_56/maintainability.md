# 유지보수성(Maintainability) 코드 리뷰

**리뷰 대상**: workflow-resumable-execution Phase 1.1 / 1.2
**리뷰 일자**: 2026-05-25
**리뷰어**: maintainability sub-agent

---

## 발견사항

### [INFO] `ShutdownStateService` 클래스 — 설계 명확성 우수
- 위치: `codebase/backend/src/modules/execution-engine/shutdown/shutdown-state.service.ts`
- 상세: 단일 책임 원칙이 잘 지켜져 있다. `isShuttingDown`, `registerInFlight`, `unregisterInFlight`, `onApplicationShutdown` 의 퍼블릭 인터페이스가 작고 목적이 명확하다. private 메서드 `waitForDrain` / `markRemainingAsInterrupted` 로 책임이 적절히 분리되어 있다.
- 제안: 없음.

---

### [WARNING] `ShutdownStateService` — `graceMs` / `pollMs` 필드 선언 위치가 생성자 아래
- 위치: `shutdown-state.service.ts` 82–83행
- 상세: `private readonly graceMs: number` 와 `private readonly pollMs: number` 필드가 생성자 블록 아래에 선언되어 있다. TypeScript 관례상 클래스 필드는 생성자보다 위에 한꺼번에 선언하는 것이 가독성이 높다. 현재 코드는 생성자 안에서 `this.graceMs`/`this.pollMs` 에 값을 할당하는데 실제 선언은 그 아래에 있어, 처음 읽는 독자가 필드 존재를 생성자 이후에야 확인하게 된다. NestJS 코드베이스 전반의 스타일 (`private readonly logger = new Logger(...)` 가 상단에 위치함) 과도 불일치.
- 제안: `graceMs`/`pollMs` 필드 선언을 `inFlightNodeExecutions` / `shuttingDown` 필드 옆으로 이동한다.

---

### [INFO] `ShutdownStateService.fromConfig` 정적 팩터리 — 사용처 불분명
- 위치: `shutdown-state.service.ts` 69–80행
- 상세: `static fromConfig(...)` 메서드가 정의되어 있으나 현재 모듈 구성(`execution-engine.module.ts`)에서는 DI `useFactory`를 직접 사용하며 이 팩터리를 호출하지 않는다. 향후 사용 계획이 명시되어 있으면 모르겠으나, 현재 코드에서 dead code 에 가깝다. 주석에 "추후 도입" 이라고 적혀 있지만, 미완성 API를 클래스 퍼블릭 메서드로 노출하면 유지보수 시 혼란을 줄 수 있다.
- 제안: 실제 사용 전까지 `private` 혹은 삭제를 검토한다. 또는 주석에 어떤 시나리오에서 쓰이는지 구체적으로 기술한다.

---

### [WARNING] `execution-engine.module.ts` — 매직 숫자 `30_000` 인라인 중복
- 위치: `execution-engine.module.ts` 77행 / `shutdown-state.service.ts` 61–62행
- 상세: `Number(process.env.SIGTERM_GRACE_MS ?? 30_000)` 에서 `30_000` 이 기본값으로 사용된다. `ShutdownStateService` 생성자에도 `this.graceMs = graceMs ?? 30_000` 로 동일한 기본값이 한 번 더 하드코딩되어 있다. 두 곳이 달라질 경우 어느 쪽이 실제 기본값인지 모호해진다.
- 제안: 기본값을 `ShutdownStateService` 내부의 `private static readonly DEFAULT_GRACE_MS = 30_000` 상수 하나로 정의하고, 모듈의 `useFactory` 에서도 이 상수를 참조하게 하거나, 모듈 쪽 기본값 결정 로직 하나만 남기고 서비스 생성자에서 fallback을 제거한다.

---

### [INFO] `execution-engine.module.ts` — `'SHUTDOWN_GRACE_MS'` 토큰 이름이 ENV 변수명과 유사하나 다름
- 위치: `execution-engine.module.ts` 76행
- 상세: DI 토큰 이름은 `'SHUTDOWN_GRACE_MS'` 이고 실제 환경 변수명은 `SIGTERM_GRACE_MS` 이다. 두 이름이 유사하지만 다른 prefix 를 쓴다. 미래 유지보수자가 `SHUTDOWN_GRACE_MS` ENV 변수가 있다고 착각할 여지가 있다.
- 제안: 주석에 이미 `ENV var name 은 spec 표와 일치` 라고 기재되어 있으나, DI 토큰 이름도 `'SIGTERM_GRACE_MS'` 로 맞추거나, 코드 내 주석에 "DI 토큰명은 `SHUTDOWN_GRACE_MS`, ENV 변수명은 `SIGTERM_GRACE_MS` — 의도적으로 구분" 을 명시하면 혼동이 줄어든다.

---

### [WARNING] `workflows.controller.ts` — `@Res({ passthrough: true })` 도입으로 파라미터 리스트 확장
- 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts` 208–614행
- 상세: `execute` 핸들러에 `@Res({ passthrough: true }) res: Response` 파라미터가 추가되었다. `Retry-After` 헤더 설정이라는 단일 목적을 위해 `express.Response` 를 컨트롤러 핸들러 시그니처에 직접 노출하면, NestJS 의 플랫폼 추상화를 깨고 향후 Fastify 전환 시 수정 범위가 늘어난다. 또한 `res.setHeader` 단 한 줄만 쓰기 위한 `Response` 타입 임포트는 불필요한 결합도를 만든다.
- 제안: NestJS `@Header()` 데코레이터로 정적 헤더를 설정하거나, `ServiceUnavailableException` 생성 직전에 `Retry-After` 를 `HttpException` 의 응답 body 에 포함하는 방식으로 변경을 검토한다. 또는 공통 shutdown 예외 필터에서 `Retry-After` 헤더를 설정하는 패턴이 더 재사용성이 높다.

---

### [WARNING] `execution-engine.service.ts` — Phase 레이블 주석이 프로덕션 코드에 다수 삽입
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (변경된 여러 행)
- 상세: `// Phase 1.2 — Graceful Shutdown 추적.`, `// Phase 1.2 — register 짝.` 등 구현 phase 를 명시하는 주석이 프로덕션 코드에 직접 삽입되어 있다. 해당 주석들은 구현 이력/컨텍스트를 설명하기 위한 것으로 초기에는 유용하나, Phase 가 완료된 이후에도 코드에 남아 있으면 진화하지 않는 stale 주석이 될 위험이 있다. 코드베이스 전반적으로 이런 패턴이 확산되면 의미 있는 주석과 이력성 주석이 뒤섞여 가독성이 떨어진다.
- 제안: Phase 레이블 정보는 git commit 메시지 / PR description 에 위임하고, 코드 주석에는 "왜 이 코드가 필요한가(이유·의도)" 만 남긴다. 예를 들어 `// Phase 1.2 — register 짝. handler 결과·에러·throw 무관 항상 해제.` 는 `// handler 결과·에러·throw 무관 항상 해제.` 로 충분하다.

---

### [INFO] `execution-engine.service.ts` — `registerInFlight` 호출 위치가 `try` 블록 바깥
- 위치: `execution-engine.service.ts` (변경된 3307~3340행 구간)
- 상세: `this.shutdownState.registerInFlight(nodeExecution.id, executionId)` 가 `try` 시작 전에 위치하고, `unregisterInFlight` 는 `finally` 블록에 있다. 코드 구조상 register 가 예외를 throw 하면 finally 의 unregister 가 호출되지 않는다. `registerInFlight` 는 현재 Map 에 값을 삽입하는 단순 연산이라 예외 가능성이 없어 실질적 위험은 없으나, 구조적으로 register/unregister 쌍이 동일한 `try/finally` 블록 안에 있지 않으면 독자가 불안감을 느낄 수 있다.
- 제안: `registerInFlight` 를 `try` 블록 최상단으로 이동하면 구조적 대칭이 명확해진다. 현재 `try` 직전에 `this.eventEmitter.emitNode(...)` 호출도 있는데, emit 실패 시 register 만 된 채로 finally 에 도달하지 못하는 미묘한 상황이 발생할 수 있다.

---

### [INFO] `shutdown-state.service.spec.ts` — 중첩 mock 체인 직접 참조가 취약
- 위치: `shutdown-state.service.spec.ts` 481–526행
- 상세: 테스트에서 `(neChain.update.mock.results[0].value as { set: jest.Mock }).set.mock.calls[0][0]` 와 같이 mock 체인의 내부 구조를 직접 탐색하는 방식이 사용되었다. `buildChain` 함수의 mock 구조가 변경되거나 TypeORM QueryBuilder 인터페이스가 바뀌면 이 어서션들이 일제히 깨진다. 테스트 자체는 올바른 behavior 를 검증하고 있으나, 깨지기 쉬운(fragile) 방식으로 작성되어 있다.
- 제안: `set` 호출의 인자를 캡처하는 spy 변수를 `buildChain` 에서 외부로 노출하여 테스트가 직접 접근할 수 있게 하거나, `set.mock.calls[0][0]` 대신 `expect(setMock).toHaveBeenCalledWith(expect.objectContaining({ status: ... }))` 방식으로 어서션을 작성한다. 이렇게 하면 체인 내부 구조 변경에 덜 취약해진다.

---

### [INFO] `shutdown-state.service.spec.ts` — `buildChain` 이 `andWhere` 까지만 체인 구성
- 위치: `shutdown-state.service.spec.ts` 382–403행
- 상세: `buildChain` 헬퍼가 `createQueryBuilder → update → set → where → andWhere → execute` 체인을 구성한다. 실제 서비스 코드의 `markRemainingAsInterrupted` 도 동일한 체인을 쓰므로 구조는 일치한다. 그러나 `buildChain` 이 클로저로 단일 `executor` 를 받아 두 레포지터리 공용으로 재사용되는데, executionRepo 와 nodeExecutionRepo 가 각각 독립적으로 추적되어야 함을 이 구현이 명확히 드러내지 않는다. 기능상 문제는 없으나 `buildChain(executionUpdateMock)` / `buildChain(nodeExecutionUpdateMock)` 라는 호출이 서로 다른 mock 인스턴스를 생성하는지 한눈에 확인하기 쉽지 않다.
- 제안: 헬퍼 이름을 `buildQueryBuilderChain` 등 용도를 명확히 드러내는 이름으로 변경하고, 인자 이름도 `executor` 대신 `executeImpl` 처럼 목적을 더 명확히 표현한다.

---

### [INFO] `main.ts` — `console.log` 혼용
- 위치: `codebase/backend/src/main.ts` 44–45행 (변경 외 기존 코드)
- 상세: 변경 대상 라인은 아니나 `console.log(`Application running on port ${port}`)` 가 `NestJS Logger` 가 아닌 원시 `console.log` 를 사용하고 있다. 이미 존재하던 코드이므로 이번 변경의 책임은 아니지만, `app.enableShutdownHooks()` 추가 위치 인접이라 함께 언급한다. 코드베이스 다른 곳에서 `Logger` 를 일관되게 사용하는 패턴과 불일치한다.
- 제안: 이번 변경 범위 밖이므로 별도 PR 에서 `NestFactory` 와 함께 구성된 앱 로거를 사용하는 방식으로 정리 권장.

---

## 요약

이번 변경의 핵심 코드(`ShutdownStateService`, `ExecutionEngineService` 변경, 컨트롤러 게이트)는 단일 책임이 명확하고 전반적으로 가독성이 양호하다. 주요 유지보수성 우려 사항은 세 가지다. 첫째, `graceMs` / `pollMs` 기본값 `30_000` 이 모듈과 서비스 생성자 두 곳에 중복 하드코딩되어 있어 향후 불일치 위험이 있다. 둘째, `WorkflowsController.execute` 가 단순 `Retry-After` 헤더 설정을 위해 `express.Response` 에 직접 의존하게 되어 플랫폼 독립성이 낮아졌다. 셋째, Phase 레이블 주석이 프로덕션 코드에 다수 삽입되어 있어 Phase 가 완료되면 stale 해질 가능성이 있다. 테스트 코드의 mock 체인 직접 탐색 패턴도 fragility 측면에서 개선 여지가 있다. 전반적으로 기능 구현 완성도는 높고 치명적 유지보수성 문제는 없다.

---

## 위험도

LOW
