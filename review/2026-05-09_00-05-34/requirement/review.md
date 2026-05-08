### 발견사항

---

**[WARNING]** `executions.service.ts`의 `cancelWaitingExecution` 관련 주석이 구현과 불일치
- 위치: `executions.service.ts` — `stop()` 메서드 내 `WAITING_FOR_INPUT` 분기 주석
- 상세: `"cancelWaitingExecution 은 동기 함수로 pendingContinuation.reject() 만 트리거한다"` 라는 주석이 남아 있으나, 실제 구현은 `void this.continuationBus.publish(...)` — Redis round-trip 비동기 흐름으로 바뀌었다. `re-fetch` 시 DB 상태 반영 여부가 이전보다 더 불확실해졌지만 주석은 이를 반영하지 않는다.
- 제안: 주석을 `"cancelWaitingExecution 은 Redis pub/sub 비동기 publish 로 동작하므로 즉시 re-fetch 한 DB 상태는 여전히 WAITING_FOR_INPUT 일 수 있다"` 로 갱신한다.

---

**[WARNING]** Redis `subscriber` / `publisher` 에 `error` 이벤트 핸들러 미등록
- 위치: `continuation-bus.service.ts` — `onModuleInit()`
- 상세: Node.js `EventEmitter`에서 `error` 이벤트 리스너가 없을 때 이벤트가 emit 되면 프로세스가 즉시 crash 된다. ioredis는 연결 실패·재연결 한도 초과 시 `error` 이벤트를 emit한다. 현재 `subscriber.on('message', ...)` 만 등록하고 `subscriber.on('error', ...)` / `publisher.on('error', ...)` 는 없다.
- 제안:
  ```typescript
  this.subscriber.on('error', (err) => this.logger.error(`Subscriber error: ${err.message}`));
  this.publisher.on('error', (err) => this.logger.error(`Publisher error: ${err.message}`));
  ```

---

**[WARNING]** `continuation-bus.service.ts` — `redis.host` / `redis.port` 미설정 시 묵시적 fallback
- 위치: `continuation-bus.service.ts` — `onModuleInit()`, `new Redis({ host, port })`
- 상세: `configService.get<string>('redis.host')`가 `undefined`를 반환해도 ioredis는 기본값(`localhost:6379`)으로 묵시적 연결을 시도한다. 운영 환경에서 환경 변수 누락 시 잘못된 Redis에 연결될 수 있다.
- 제안:
  ```typescript
  const host = this.configService.get<string>('redis.host');
  const port = this.configService.get<number>('redis.port');
  if (!host || !port) throw new Error('redis.host / redis.port 설정 누락');
  ```

---

**[WARNING]** `executions.service.spec.ts` — `findById`의 `executionPath` 채움 로직 테스트 미존재
- 위치: `executions.service.spec.ts` — `findById` 관련 테스트 전체
- 상세: `executionNodeLogRepo.find`는 항상 `[]`를 반환하도록 고정 설정되어 있어, `execution_node_log`의 정렬 결과로 `executionPath`를 채우는 핵심 로직이 실제로 검증되지 않는다. PR-B의 핵심 요구사항(BIGSERIAL 정렬 → 실행 순서 재현)이 단위 테스트로 보장되지 않는다.
- 제안: `executionNodeLogRepo.find`가 `[{ nodeId: 'n1' }, { nodeId: 'n2' }]` 등 mock 데이터를 반환하는 케이스를 추가하고, `findById` 결과의 `executionPath`가 올바르게 채워지는지 검증한다.

---

**[WARNING]** `continuation-bus.service.spec.ts` — `acquireLock` 직접 테스트 없음
- 위치: `continuation-bus.service.spec.ts`
- 상세: `acquireLock`은 Recovery 흐름의 핵심 분산 lock 메커니즘이지만 `ContinuationBusService` 단위 테스트에는 없다. `execution-engine.service.spec.ts`의 mock을 통한 간접 검증만 존재한다. `SET NX` semantics — 첫 호출 `true`, 두 번째 호출 `false` — 를 FakeRedis 수준에서 검증하지 않는다.
- 제안: `FakeRedis`에 `set(key, value, ...args)` 구현을 추가하고, `acquireLock`의 SET NX 동작(첫 획득 `true`, 재획득 `false`, TTL 만료 후 재획득 `true`)을 독립 테스트로 추가한다.

---

**[WARNING]** `executions.service.spec.ts` — `FakeExec` 타입에 제거된 `executionPath` 필드 잔존
- 위치: `executions.service.spec.ts` — `FakeExec` type 정의, `baseFake` 헬퍼
- 상세: `Execution` 엔티티에서 `executionPath` 컬럼이 V035로 제거되었으나, `FakeExec` 타입과 `baseFake` 헬퍼에 `executionPath: string[]`가 그대로 남아 있다. `toExecutionDto`는 이제 항상 `executionPath: []`를 하드코딩하므로 이 픽스처 필드는 dead code이며 미래 개발자에게 혼란을 준다.
- 제안: `FakeExec.executionPath` 제거, `baseFake`에서도 해당 필드 제거.

---

**[INFO]** `exec:recover:lock` 키가 spec §9.2 Redis 키 네이밍 컨벤션에 없음
- 위치: `execution-engine.service.ts` — `recoverStuckExecutions()`, `spec/5-system/4-execution-engine.md` §9.2
- 상세: 스펙 §9.2의 용도별 키 정의 테이블에 `exec:recover:lock`이 없다. 스펙 §7.4에는 기술됐으나 §9.2와 싱크가 맞지 않는다. 또한 `{service}:{workspaceId}:{resource}:{id}:{sub}` 패턴을 따르지 않는 의도적 예외지만 문서화가 필요하다.
- 제안: §9.2 테이블에 `exec:recover:lock | 분산 recovery 가드 (전역 단일 lock) | 60초` 행 추가.

---

**[INFO]** 목록 조회 API의 `executionPath` 빈 배열 반환 — 기존 API 소비자에 대한 breaking change
- 위치: `executions.service.ts` — `toExecutionDto()`
- 상세: 이전에는 `executionPath`가 실제 데이터로 채워졌으나 이제 목록 응답에서는 항상 `[]`를 반환한다. 스펙에 명시된 의도적 설계이지만, 이 필드를 활용하는 프론트엔드/외부 소비자가 있다면 조용한 동작 변경이 된다.
- 제안: CHANGELOG 또는 API 변경 공지에 `findByWorkflow` 응답의 `executionPath`가 항상 `[]`임을 명시한다. 단건 `findById`를 통해서만 populated 값을 얻을 수 있음을 문서화한다.

---

### 요약

전체적으로 요구사항(`execution_node_log` append-only 모델, Continuation Bus fan-out, 분산 lock 기반 Recovery)이 스펙 §7.4와 잘 대응되어 구현되어 있다. 다만 **Redis error 이벤트 핸들러 미등록**은 운영 중 Redis 연결 장애 시 프로세스 crash로 이어질 수 있는 실제 위험이며, **`cancelWaitingExecution` 관련 주석의 동기/비동기 불일치**는 미래 유지보수 시 잘못된 타이밍 가정으로 이어질 수 있다. `findById`의 `executionPath` 채움 로직 미테스트와 `acquireLock` 직접 테스트 부재는 PR-B 핵심 기능의 단위 테스트 커버리지 공백으로, 보완이 필요하다.

### 위험도

**MEDIUM**