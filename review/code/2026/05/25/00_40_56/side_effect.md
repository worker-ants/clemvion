# 부작용(Side Effect) 리뷰

**대상 PR**: workflow-resumable-execution Phase 1.1 + 1.2
**리뷰 일자**: 2026-05-25
**리뷰어**: side-effect reviewer

---

## 발견사항

### [WARNING] `SHUTDOWN_GRACE_MS` 토큰 — 환경변수 읽기가 모듈 초기화 시점에 단 한 번 평가됨

- **위치**: `execution-engine.module.ts` lines 73–77
- **상세**: `useFactory: () => Number(process.env.SIGTERM_GRACE_MS ?? 30_000)` 는 NestJS DI 컨테이너가 모듈을 처음 초기화할 때 단 한 번만 실행된다. 이는 의도된 동작이나, 환경변수 이름이 `SIGTERM_GRACE_MS` 임에도 토큰 이름은 `SHUTDOWN_GRACE_MS` 여서 둘의 불일치가 생겼다. 토큰 이름(`SHUTDOWN_GRACE_MS`)은 k8s/운영자가 실제로 설정해야 하는 환경변수명(`SIGTERM_GRACE_MS`)과 다르다. 이것 자체가 기능 오류는 아니지만, 장래에 토큰을 env-mapped config로 마이그레이션할 때 혼동을 유발할 수 있다.
- **제안**: 토큰명을 `SIGTERM_GRACE_MS_TOKEN` 처럼 환경변수명에 가깝게 유지하거나, 반대로 주석에 "토큰명과 환경변수명이 다르다"는 사실을 명시한다.

---

### [WARNING] `registerInFlight` 호출 위치 — try 블록 바깥, 예외 발생 시 unregister 누락 위험

- **위치**: `execution-engine.service.ts` — `executeNode` 메서드, diff의 `+this.shutdownState.registerInFlight(nodeExecution.id, executionId);` 라인
- **상세**: `registerInFlight` 는 `try` 블록 외부에서, `createNodeExecution` 직후에 호출된다. `finally` 블록은 `try` 안에서 throw 된 예외만 보장한다. `registerInFlight` 호출과 `try {` 사이에 동기적으로 예외가 발생할 가능성은 극히 낮지만, `this.eventEmitter.emitNode(...)` 역시 `try` 바깥에 위치하며 이 호출이 throw 한다면 `finally` 가 실행되지 않아 `inFlightNodeExecutions` Map에 해당 항목이 영구히 남는다. 서버가 종료될 때 drain wait가 영원히 끝나지 않거나 잘못된 DB row가 SERVER_INTERRUPTED로 마킹될 수 있다.

  실제 코드 순서:
  ```
  registerInFlight(...)        // ← try 밖
  this.eventEmitter.emitNode(...)   // ← try 밖, emit이 throw하면 finally 불실행
  try { ... } finally {
    unregisterInFlight(...)
  }
  ```

- **제안**: `registerInFlight` 호출을 `try` 블록 내부 첫 번째 줄로 이동하거나, `emitNode` 까지 포함하는 try/finally 구조를 만든다:
  ```typescript
  this.shutdownState.registerInFlight(nodeExecution.id, executionId);
  try {
    this.eventEmitter.emitNode(...);
    // ... 기존 try body
  } finally {
    this.shutdownState.unregisterInFlight(nodeExecution.id);
  }
  ```

---

### [WARNING] `WorkflowsController`에 `@Res({ passthrough: true })` 추가 — 기존 인터셉터/테스트 영향

- **위치**: `workflows.controller.ts` line 608 (`@Res({ passthrough: true }) res: Response`)
- **상세**: NestJS에서 `@Res()` 데코레이터(passthrough 여부와 무관)를 핸들러 파라미터에 추가하면 NestJS의 응답 직렬화 파이프라인(인터셉터의 `map` 체인, `ClassSerializerInterceptor`, `TransformInterceptor` 등)의 동작이 미묘하게 달라진다. `passthrough: true` 를 사용해도 일부 버전의 NestJS에서는 인터셉터의 응답 변환(`next.handle().pipe(map(...))`)이 `void` 를 반환하면 인터셉터가 응답 본문을 직렬화하지 않을 수 있다. 기존에 이 엔드포인트에 적용된 전역 또는 컨트롤러 레벨 인터셉터가 있다면 호환성 검증이 필요하다.
  
  또한 `workflows.controller.spec.ts`가 diff에서 omitted로 표시되어 실제 테스트가 `@Res()` 추가를 적절히 mock하고 있는지 확인이 필요하다.

- **제안**: 전역 인터셉터 목록(`APP_INTERCEPTOR` 등록 여부)을 확인하고, `execute` 핸들러가 기존과 동일한 응답 직렬화 경로를 타는지 통합 테스트로 검증한다. 특히 성공 케이스(503이 아닌 정상 실행 시작)에서 응답 본문이 의도한 형태인지 확인이 필요하다.

---

### [INFO] `app.enableShutdownHooks()` — 프로세스 시그널 핸들러 전역 등록

- **위치**: `main.ts` line 41
- **상세**: `app.enableShutdownHooks()` 는 `process.on('SIGTERM', ...)`, `process.on('SIGINT', ...)` 등의 OS 시그널 핸들러를 Node.js 프로세스 전역에 등록한다. 이 호출 전에는 SIGTERM이 Nest 라이프사이클 훅을 트리거하지 않았으므로 기존 배포에서 SIGTERM은 프로세스를 즉시 종료했을 것이다. 이제부터는 SIGTERM 수신 시 `ShutdownStateService.onApplicationShutdown` 이 최대 `SIGTERM_GRACE_MS`(기본 30초) 동안 블로킹하게 된다. k8s `terminationGracePeriodSeconds` 가 기본값(30초)으로 설정된 경우, grace period가 `terminationGracePeriodSeconds`와 동일해지면 k8s가 SIGKILL을 보내기 직전에 drain이 완료되지 못할 수 있다. `self-hosting-deployment.md`의 변경에서 이 점을 언급하고 있으나(`terminationGracePeriodSeconds: ceil(SIGTERM_GRACE_MS/1000) + 5`), 기존 배포된 k8s 클러스터에서 Helm chart를 갱신하기 전까지는 운영상 race가 존재한다.
- **제안**: 즉각적 조치는 없으나, 배포 시 `terminationGracePeriodSeconds` 설정을 Phase 1.2 코드와 반드시 동기화할 것. 기존 클러스터 Helm 설정 갱신이 코드 배포와 동시에 이루어져야 한다.

---

### [INFO] `ShutdownStateService.fromConfig` 정적 팩토리 메서드 — 미사용이나 공개 API로 잠재 혼란

- **위치**: `shutdown-state.service.ts` lines 69–80
- **상세**: `fromConfig` 는 `static` 팩토리 메서드로 선언되어 있으나 현재 모듈 어디에서도 호출되지 않는다. DI 컨테이너는 `useFactory` 를 통해 `SHUTDOWN_GRACE_MS` 토큰으로 값을 주입하므로 이 메서드는 사용되지 않는 dead code다. 이름과 시그니처를 보면 이전 설계 시도의 흔적으로 보인다. 삭제하지 않으면 향후 개발자가 NestJS DI를 우회해 `fromConfig`로 인스턴스를 직접 만들 가능성이 있어 라이프사이클 훅이 연결되지 않는 문제가 생긴다.
- **제안**: `fromConfig` 정적 메서드를 제거하거나, 사용 목적이 테스트 편의라면 `private` 으로 변경하고 doc comment를 추가한다.

---

### [INFO] `ShutdownStateService` 테스트에서 `buildChain` 체인의 `andWhere` 구조 — 실제 서비스의 WHERE 절 구조와 불일치

- **위치**: `shutdown-state.service.spec.ts` lines 382–392
- **상세**: 테스트 mock chain은 `update → set → where → andWhere → execute` 구조를 만든다. 그런데 실제 `markRemainingAsInterrupted`는 `.where('id IN (:...ids)', ...)` 다음에 `.andWhere('status = :status', ...)` 를 호출한다. 테스트의 `buildChain`은 체인 각 단계가 항상 같은 단계를 반환하도록 단순화되어 있어 `.andWhere` 반환값 내에 `.execute`가 있는 구조다. 이는 테스트 구현상의 mock 구조가 실제 QueryBuilder 체인과 어느 정도 일치하므로 기능적 문제는 없다. 그러나 체인 assert 방식(`neChain.update.mock.results[0].value`)이 TypeORM QueryBuilder의 실제 체인 순서를 1:1 반영하지 않아, 향후 서비스 코드에서 체인 순서가 변경될 경우 테스트가 false-positive를 반환할 수 있다.
- **제안**: 명시적 부작용은 없으나 유지보수 위험으로 기록. 중요도는 낮다.

---

### [INFO] `inFlightNodeExecutions` Map — 동일 `nodeExecutionId` 중복 등록 시 executionId 덮어쓰기

- **위치**: `shutdown-state.service.ts` line 104
- **상세**: `inFlightNodeExecutions.set(nodeExecutionId, executionId)` 는 같은 `nodeExecutionId`가 두 번 등록되면 기존 `executionId`를 덮어쓴다. `nodeExecutionId`는 DB에서 생성된 UUID이므로 중복 발생 가능성은 극히 낮다. 그러나 race condition 하에서 같은 `nodeExecution.id`가 두 번 `registerInFlight`를 통과한다면 `unregisterInFlight` 한 번으로 Map 항목이 사라지므로 drain 카운트가 올바르게 관리된다. 의도하지 않은 상태 변경은 아니다.
- **제안**: 방어적으로 이미 등록된 id에 대해 warn 로그를 남기는 것을 고려할 수 있으나 필수는 아니다.

---

## 요약

이번 변경의 핵심은 `ShutdownStateService` 신규 도입과 `app.enableShutdownHooks()` 활성화다. 전반적으로 부작용 설계가 의도적이고 문서화가 잘 되어 있다. 주목할 두 가지 실질적 위험이 있다. 첫째, `registerInFlight` 가 `try` 블록 외부에서 호출된 직후 `emitNode`가 예외를 throw하면 `finally`의 `unregisterInFlight`가 실행되지 않아 Map이 오염되고 drain wait가 영구 블로킹 상태에 빠질 수 있다 (WARNING). 둘째, `@Res({ passthrough: true })` 추가로 인해 `WorkflowsController.execute` 핸들러에 적용된 기존 인터셉터의 응답 변환 동작이 달라질 수 있어 통합 테스트 검증이 필요하다 (WARNING). `SHUTDOWN_GRACE_MS` 토큰명과 `SIGTERM_GRACE_MS` 환경변수명의 불일치도 운영상 혼동 소지가 있다. `fromConfig` 미사용 정적 메서드는 dead code로 향후 오용 가능성이 있다.

---

## 위험도

**MEDIUM**

`registerInFlight`/`unregisterInFlight` 의 try 블록 범위 문제가 실제 운영에서 발생하면 SIGTERM 수신 후 graceful shutdown이 무기한 블로킹되는 결과를 낳으므로 수정을 권장한다.
