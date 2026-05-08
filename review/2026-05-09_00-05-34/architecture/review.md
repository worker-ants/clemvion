## 아키텍처 코드 리뷰

---

### 발견사항

---

**[CRITICAL]** `void` 연산자로 publish 오류를 묵시적 파기 — 실행 행잉(hang) 위험

- 위치: `execution-engine.service.ts` — `continueExecution`, `cancelWaitingExecution`, `continueButtonClick`, `continueAiConversation`, `endAiConversation`
- 상세: 5개 진입점 모두 `void this.continuationBus.publish(...)` 형태로 호출한다. Redis 장애나 직렬화 오류로 `publish()`가 reject되면 예외가 완전히 삼켜진다. 이 경우 `pendingContinuations`의 Promise resolver는 영원히 호출되지 않고, 해당 execution은 `WAITING_FOR_INPUT` 상태로 행잉된다. 30분 후 recovery가 처리하기 전까지 사용자는 결과를 받지 못한다.
- 제안: `publish()` 호출에 `.catch(err => this.logger.error(...))` 체인을 붙이거나, `pendingContinuations` 측에 타임아웃 가드를 별도로 두어 Redis 장애 시에도 resolver가 reject될 수 있도록 한다.

---

**[WARNING]** 모듈 경계 위반 — `ExecutionNodeLog` 엔티티가 두 모듈에 직접 노출

- 위치: `executions/executions.module.ts`, `executions/executions.service.ts`
- 상세: `ExecutionNodeLog`는 `execution-engine/entities/`에 위치하며 `ExecutionEngineModule`이 소유하는 엔티티다. 그런데 `ExecutionsModule`이 이 엔티티를 직접 import하여 `TypeOrmModule.forFeature`에 재등록하고, `ExecutionsService`도 `@InjectRepository(ExecutionNodeLog)`로 직접 리포지토리를 주입받는다. 두 모듈이 동일 엔티티의 리포지토리를 각자 등록하는 구조는 소유권이 불명확하고, `execution-engine` 팀이 엔티티를 이동하거나 변경할 때 `executions` 모듈에 암묵적 의존성 충격이 발생한다.
- 제안: `ExecutionNodeLog` 조회 책임을 `ExecutionEngineModule`이 export하는 서비스(예: `ExecutionPathService` 또는 기존 서비스에 메서드 추가)로 캡슐화하고, `executions` 모듈은 해당 서비스를 통해 접근한다. 엔티티 직접 의존을 끊는다.

---

**[WARNING]** `executionPath` API 의미 불일치 — 목록과 단건 응답이 다른 값 반환

- 위치: `executions/executions.service.ts` — `toExecutionDto()` vs `findById()`
- 상세: `findById()`는 `execution_node_log`를 조회해 실제 `executionPath`를 채우지만, `findByWorkflow()`의 DTO 변환(`toExecutionDto`)은 N+1 회피를 위해 `executionPath: []`를 반환한다. 동일한 필드명이 엔드포인트에 따라 의미가 달라지는 것은 API 계약 위반이다. 클라이언트가 목록 응답의 `executionPath`를 신뢰해 렌더링 로직을 작성했을 때 잘못된 동작을 유발할 수 있다.
- 제안: 목록 응답 DTO에서 `executionPath` 필드를 완전히 제거하거나, 명시적으로 `null`로 표현해 "이 엔드포인트는 이 필드를 제공하지 않음"을 API 스키마 수준에서 선언한다.

---

**[WARNING]** `ContinuationBusService`에 이질적 책임 혼재 — 분산 락이 pub/sub 버스에 결합

- 위치: `continuation-bus.service.ts:93–108` — `acquireLock` 메서드
- 상세: `ContinuationBusService`는 이름과 문서상 "continuation 이벤트의 pub/sub 버스"다. 그런데 `acquireLock(key, ttl)` 메서드가 같은 클래스에 있어, 분산 락 기능이 메시징 버스에 결합된다. 이 메서드를 사용하는 `recoverStuckExecutions`는 continuation과 무관한 recovery 로직이다. SRP 위반이며, 향후 Redis 이외의 pub/sub 구현체로 교체 시 락 구현도 함께 교체해야 하는 불필요한 결합이 생긴다.
- 제안: `DistributedLockService`로 분리하거나, 최소한 별도의 `RedisLockService`를 만들어 `ContinuationBusService`가 내부적으로 위임하게 한다. `acquireLock`을 `ContinuationBusService`의 public API에서 제거한다.

---

**[WARNING]** Redis 키 네이밍 컨벤션 미준수

- 위치: `execution-engine.service.ts:380` — `'exec:recover:lock'`
- 상세: spec §9.1의 키 패턴은 `{service}:{workspaceId}:{resource}:{id}:{sub}`이다. `exec:recover:lock`은 `workspaceId` 세그먼트 없이 전역 키로 사용되며, 컨벤션에서 이탈한다. 멀티테넌트 환경에서 전역 키는 워크스페이스 격리를 깨트릴 수 있다. 단, recovery 자체가 전역 작업이므로 전역 키가 의도적이라면 컨벤션에 예외 항목으로 명시해야 한다.
- 제안: spec §9.2에 `exec:global:lock:recover:boot` 같은 명시적 전역 키 패턴을 추가하고, 코드 상수도 그에 맞게 갱신한다.

---

**[INFO]** `ContinuationBusService`에 인터페이스 추상화 부재 — DIP 미적용

- 위치: `execution-engine.service.ts:354`, `continuation-bus.service.ts`
- 상세: `ExecutionEngineService`가 `ContinuationBusService` 구체 클래스에 직접 의존한다. 테스트에서는 수동 mock 객체를 `useValue`로 주입하는 방식으로 우회하지만, 컴파일 타임 계약이 없어 mock이 실제 서비스와 시그니처 불일치를 일으켜도 타입 에러로 잡히지 않는다. 실제로 spec 파일의 mock 객체는 `as unknown` 캐스팅 없이 구성되어 있어 타입 안정성이 낮다.
- 제안: `IContinuationBus` 인터페이스를 정의하고 `ContinuationBusService`가 구현하게 한다. `ExecutionEngineService`는 인터페이스에 의존한다. 테스트 mock도 해당 인터페이스를 구현해 타입 안정성을 확보한다.

---

**[INFO]** 단일 채널 fan-out — 규모 확장 시 잠재적 병목

- 위치: `continuation-bus.service.ts:27` — `const CHANNEL = 'execution:continuation'`
- 상세: 모든 워크플로우, 모든 워크스페이스의 continuation 이벤트가 단일 Redis 채널을 통해 흐른다. 인스턴스 N개 환경에서 메시지당 N번의 dispatch가 발생하며, 그 중 N-1번은 `pendingContinuations` Map miss로 무처리 종료된다. 현재 규모에서는 무시 가능하지만, 동시 실행 수가 증가할수록 불필요한 처리 비율이 선형 증가한다.
- 제안: 즉각 변경이 필요하진 않으나, 향후 `execution:{executionId}:continuation` 같이 execution별 채널로 세분화하거나 Redis Streams로 이전하는 경로를 spec에 미리 명시해 두면 좋다.

---

**[INFO]** `on()` 핸들러 단일 등록 제약 — 미래 확장성 제한

- 위치: `continuation-bus.service.ts:82–87` — `this.handlers.set(type, handler)`
- 상세: 동일 타입에 `on()`을 두 번 호출하면 마지막 등록만 유효하다(Map.set 덮어쓰기). 현재 사용처는 `ExecutionEngineService` 단독이므로 문제 없지만, 다른 서비스가 동일 채널 메시지에 반응해야 하는 요구사항이 생기면 API를 파괴적으로 변경해야 한다.
- 제안: `handlers` 타입을 `Map<ContinuationType, Array<handler>>` 로 바꾸고 `on()`이 배열에 push하도록 수정한다. 현재 동작은 유지하면서 미래 확장을 허용한다.

---

### 요약

이번 변경은 단일 `execution_path` 배열 컬럼을 append-only `execution_node_log` 테이블로 이행하고, Redis pub/sub Continuation Bus를 통해 다중 인스턴스 환경에서의 사용자 입력 fan-out을 구현한 아키텍처적으로 올바른 리팩토링이다. 핵심 설계 결정(항상 publish, 로컬 Map miss는 silent skip, BIGSERIAL을 통한 순서 보장)은 분산 환경의 실제 문제를 잘 해결하고 있으며 문서화도 충실하다. 다만 `void publish()` 호출에 의한 오류 묵시적 파기는 Redis 장애 시 실행 행잉을 유발할 수 있는 실질적 위험이고, `ExecutionNodeLog` 엔티티가 모듈 경계를 넘어 직접 공유되는 구조와 `executionPath` 필드의 목록/단건 응답 간 의미 불일치는 장기적으로 유지보수 부채가 될 수 있다.

---

### 위험도

**MEDIUM** — `void publish()` 오류 파기(CRITICAL 항목)가 수정되기 전까지는 Redis 장애 시 조용한 hang이 발생할 수 있으며, 나머지 항목들은 기능보다 구조적 부채 성격이다.