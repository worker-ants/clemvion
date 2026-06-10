# Architecture Review

## 발견사항

### [INFO] IntegrationCacheBus 단일 책임 원칙 준수 — 양호
- 위치: `codebase/backend/src/common/redis/integration-cache-bus.service.ts`
- 상세: `IntegrationCacheBus` 는 pub/sub 연결 관리, invalidator 등록·dispatch, fail-safe 처리의 세 관심사를 하나의 클래스에 가지고 있으나, 이 셋은 모두 "멀티 인스턴스 캐시 무효화 버스" 라는 단일 목적의 코어 동작이다. 분리가 이득을 주지 않는 적절한 응집도다.
- 제안: 유지.

### [INFO] 의존성 역전 — RedisConnectionProvider 추상화 경계 적절
- 위치: `integration-cache-bus.service.ts` 생성자
- 상세: `IntegrationCacheBus` 는 ioredis `Redis` 를 직접 주입받지 않고 `RedisConnectionProvider.getClientOrNull()` 인터페이스를 통해 접근한다. Redis 미가용 시 null 반환이라는 계약이 명확하다.
- 제안: 유지.

### [WARNING] `broadcastCredentialChange` 가 불필요한 indirection 계층
- 위치: `codebase/backend/src/modules/integrations/integrations.service.ts`, `broadcastCredentialChange` private 메서드
- 상세: `broadcastCredentialChange(id)` 가 하는 일은 `this.integrationCacheBus.publish(id)` 호출 단 한 줄이다. `integrationCacheBus.publish` 자체가 이미 fail-safe(throw 안 함)이므로 별도 래퍼를 만드는 것은 불필요한 추상화(over-abstraction) 계층이다. 호출 지점(rotate/remove)이 늘어나면 각각 주석이 달려 있어 의도를 파악할 수 있으므로 직접 호출로도 충분하다.
- 제안: `broadcastCredentialChange` 를 제거하고 `rotate`/`remove` 에서 `await this.integrationCacheBus.publish(id)` 를 직접 호출. 단, 호출 지점이 3곳 이상으로 늘어날 미래 가능성이 있다면 유지도 허용 가능 — 현재 2곳 기준으로는 indirection이 더 복잡하다.

### [INFO] 레이어 책임 분리 — IntegrationsService(비즈니스) ↔ IntegrationCacheBus(인프라) 경계 적절
- 위치: `integrations.service.ts` + `integration-cache-bus.service.ts`
- 상세: `IntegrationsService` 는 자격증명 변경 비즈니스 로직 이후 `integrationCacheBus.publish` 를 호출하는 방식으로, 인프라 세부사항(Redis pub/sub)을 직접 알지 않는다. 레이어 책임이 명확히 분리돼 있다.
- 제안: 유지.

### [INFO] `HandlerDependencies` 에 `IntegrationCacheBus` 를 인터페이스로 선언하지 않고 concrete 타입으로 참조
- 위치: `codebase/backend/src/nodes/core/node-component.interface.ts`, `integrationCacheBus?` 필드
- 상세: `HandlerDependencies` 의 다른 선택적 필드(`agentMemoryService`, `cafe24ApiClient` 등)도 모두 concrete 서비스 타입을 dynamic import 로 사용하는 기존 패턴을 따르고 있다. 전체 파일의 일관성 측면에서 문제 없다. 다만, `IntegrationCacheBus` 에 `publish(id: string): Promise<void>` 와 `register(fn: IntegrationCacheInvalidator): void` 만을 포함하는 별도 인터페이스(`IIntegrationCacheBus`)를 추출하면 테스트 fixture 의 `as never` 캐스팅 없이 타입 안전 mock 이 가능하다.
- 제안: 인터페이스 추출은 선택 사항(INFO 수준). 현재 as-never 패턴도 기존 코드와 일관성이 있으므로 즉각 수정 불필요.

### [INFO] `DatabaseQueryHandler` 의 설계 — 싱글톤 핸들러가 인스턴스-로컬 풀 캐시를 보유하는 구조
- 위치: `database-query.handler.ts`
- 상세: `DatabaseQueryHandler` 는 NestJS 싱글톤 서비스가 아니라 `createHandler(deps)` factory 에서 매 모듈 부팅 시 한 번 생성되는 핸들러 인스턴스다. `pools` Map 과 bus `register` 모두 이 단일 인스턴스에 속하므로, 부팅 시 `register` 가 한 번만 호출된다는 것이 설계 계약의 핵심이다. 이 계약은 JSDoc 에 명시돼 있고 테스트로 검증된다 — 구조적으로 일관적이다.
- 제안: 유지. 단, 미래에 `createHandler` 가 여러 번 호출될 수 있는 리팩터링이 발생하면 register 중복 등록 방어가 필요해진다는 점을 주의.

### [WARNING] `NodeHandlerDependenciesProvider` 에서 `integrationCacheBus` 가 `@Optional()` 로 선언됨
- 위치: `codebase/backend/src/modules/execution-engine/handlers/node-handler-dependencies.provider.ts`
- 상세: `IntegrationCacheBus` 는 `@Global()` 로 선언된 `RedisModule` 에서 export 되므로, 정상 앱 컨텍스트에서는 항상 주입 가능하다. `@Optional()` 은 레거시 fixture 호환을 위한 것이지만, production 경로에서 우발적으로 null 이 되더라도 아무 경고 없이 silently degrade 한다. 이로 인해 프로덕션에서 Redis 없이 배포할 경우 버스 등록 누락이 눈에 보이지 않을 수 있다.
- 제안: 현재 fail-safe 설계 의도와 일치하므로 CRITICAL 수준은 아니다. 다만, startup 시 `integrationCacheBus` 가 null 인 경우 `NodeHandlerDependenciesProvider.build()` 내부에서 적어도 `Logger.warn` 한 번 발행하면 운영 가시성이 향상된다.

### [INFO] `IntegrationCacheBus` 의 `onModuleInit` 동기 반환 — subscribe 결과를 await 하지 않음
- 위치: `integration-cache-bus.service.ts`, `onModuleInit()` 반환 타입 `void`
- 상세: NestJS `OnModuleInit` 는 `Promise<void>` 도 지원하나, 여기서는 `subscribe` 를 fire-and-forget (`.catch` 붙인 floating promise)로 처리하고 동기 반환한다. 구독 완료 전에 첫 `rotate` publish 가 도달할 경우 메시지가 유실될 수 있는 race window 가 존재한다. 문서에 명시된 fail-safe 설계(best-effort)와 일관적이고, subscribe 실패 시 로컬 credsHash evict 가 fallback 이므로 정합성은 깨지지 않는다.
- 제안: 수용 가능. subscribe race window 를 문서 comment 에 명시하거나, `onModuleInit(): Promise<void>` 로 선언해 `await sub.subscribe(...)` 를 직접 기다리는 것을 고려할 수 있다 (구독 실패는 catch 로 계속 처리).

### [INFO] `IntegrationCacheBus` 의 `register` — `onModuleInit` 이후에 등록되는 경우 무방비
- 위치: `integration-cache-bus.service.ts`, `register()` 메서드
- 상세: `register` 는 부팅 시 1회 호출된다는 설계 계약이 있지만, 런타임 중 `register` 호출은 막지 않는다. Set 이라 중복 등록은 idempotent 하지만, `onModuleInit` 이후 동적 등록을 시도해도 아무 경고가 없다. 현재 사용 패턴에서는 문제 없다.
- 제안: INFO 수준. 필요 시 `private initialized = false` 플래그로 post-init 등록 시 warn 로그를 남길 수 있다.

### [INFO] e2e 테스트에서 `waitForBroadcast` polling 루프 — busy-wait
- 위치: `codebase/backend/test/integration-cache-invalidate.e2e-spec.ts`, `waitForBroadcast`
- 상세: `while(true) + setTimeout(50ms)` 폴링 패턴은 기능적으로 올바르나, `received` 배열에 대해 외부 `sub` 이벤트 핸들러와 polling 루프가 동시에 접근한다. Node.js 단일 스레드 이벤트 루프에서는 race condition 이 없으므로 안전하다.
- 제안: 유지. 단, 타입 선언 없이 `const received: string[] = []` 를 `let` 대신 outer scope 에 두는 것은 병렬 테스트 실행 시 크로스 오염 가능성이 있다. 현재 `beforeAll`/`afterAll` 가 단일 describe block 스코프이므로 문제 없지만, 테스트 격리를 위해 `beforeEach` 에서 `received.length = 0` 을 추가하는 것이 방어적이다.

### [INFO] 순환 의존성 없음 — 확인
- 위치: 전체 변경 파일
- 상세: `IntegrationCacheBus`(`common/redis`) → `RedisConnectionProvider`(`common/redis`). `IntegrationsService`(`modules/integrations`) → `IntegrationCacheBus`. `DatabaseQueryHandler`(`nodes/integration`) → `IntegrationCacheBus`. `NodeHandlerDependenciesProvider`(`execution-engine`) → `IntegrationCacheBus`. 주석 `build(workflowExecutor)` 에서 순환 의존 방지를 명시적으로 언급한다. 순환 참조 없음.
- 제안: 유지.

### [INFO] `spec/4-nodes/4-integration/2-database-query.md` frontmatter `code:` 배열에 `integration-cache-bus.service.ts` 추가
- 위치: `spec/4-nodes/4-integration/2-database-query.md`
- 상세: spec-impl 커버리지 추적 관점에서 올바른 갱신이다. `IntegrationCacheBus` 는 database-query 뿐 아니라 향후 send-email 등 다른 핸들러도 사용할 수 있는 integration-generic 인프라인데, database-query spec 의 `code:` 에만 등재됐다. 향후 다른 핸들러가 bus 를 사용할 때 해당 spec 의 `code:` 에 추가하거나, `IntegrationCacheBus` 를 별도 shared-infra spec 으로 분리하는 것이 일관성을 유지한다.
- 제안: 현재는 acceptable. 두 번째 핸들러가 bus 를 사용할 시점에 공용 Redis pub/sub infra spec 을 별도 문서로 추출하는 것을 권고.

---

## 요약

전반적인 아키텍처 설계는 양호하다. `IntegrationCacheBus` 를 `common/redis` 에 격리하고 `IntegrationsService` → bus → handler 방향의 단방향 의존 흐름을 유지했으며, Redis 미가용 상황의 fail-safe 계층(credsHash 비교 evict)이 설계 의도와 코드·스펙·테스트 모두에 일관되게 문서화돼 있다. `broadcastCredentialChange` 래퍼 메서드의 불필요한 indirection 과 `NodeHandlerDependenciesProvider` 에서 `@Optional()` 로 인한 운영 가시성 부족이 개선 여지로 남는다. 순환 의존성 없음, 레이어 책임 분리 적절, 확장성(새 핸들러는 `register` 호출 한 줄로 편입 가능) 우수.

## 위험도

LOW
