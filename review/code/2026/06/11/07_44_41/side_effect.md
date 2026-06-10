# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [WARNING] `IntegrationCacheBus.onModuleInit()` — duplicate() 연결의 암묵적 자동 연결 시도
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/db-pool-creds-pubsub/codebase/backend/src/common/redis/integration-cache-bus.service.ts` L558–579 (`onModuleInit`)
- 상세: `base.duplicate()` 가 반환하는 새 ioredis 연결은 ioredis 기본 설정에 따라 즉시 TCP 연결을 시도한다(`lazyConnect: false` 기본값). 주석에 "lazyConnect 연결이라 subscribe 가 connect 를 트리거한다"고 명시돼 있으나, 실제로 `RedisConnectionProvider` 가 `lazyConnect: true` 로 부모 연결을 생성했어도 `duplicate()` 로 복제된 연결의 `lazyConnect` 옵션이 그대로 상속되는지, 혹은 기본값(`false`)으로 초기화되는지 명시가 없다. ioredis `duplicate()` 는 옵션을 그대로 복사하지만, `lazyConnect`가 상속되지 않는 빌드 버전 혹은 future 버전 변경 시 구독 연결이 `subscribe` 호출 전 자동으로 외부 Redis 서버에 암묵적 TCP 연결을 시도하는 부작용이 생긴다.
- 제안: `base.duplicate({ lazyConnect: false })` 등 명시적으로 옵션을 지정하거나, 주석을 실제 `lazyConnect` 동작 전제 조건으로 명확히 보강한다. 이미 의도적이라면 `// intentionally not lazyConnect — subscribe triggers immediate connect` 로 명시.

---

### [WARNING] `DatabaseQueryHandler` 생성자에서 `integrationCacheBus.register()` 호출 — 핸들러 다중 인스턴스 시 invalidator 중복 등록 가능성
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/db-pool-creds-pubsub/codebase/backend/src/nodes/integration/database-query/database-query.handler.ts` L1730–1732
- 상세: `integrationCacheBus.register(fn)` 은 `Set` 기반이라 **동일 함수 참조**이면 idempotent 하다. 그러나 `createHandler(deps)` 가 매 호출마다 새 `DatabaseQueryHandler` 인스턴스를 생성하고, 각 인스턴스의 생성자가 새 화살표 함수 `(integrationId) => this.invalidatePool(integrationId)` 를 register 한다. 화살표 함수는 매번 새 참조로 생성되므로 `Set` 에 중복으로 축적된다. NestJS 싱글톤 모듈에서는 핸들러가 1회만 생성되지만, 단위 테스트나 비싱글톤 시나리오에서 `createHandler` 를 반복 호출하면 invalidator 가 누적된다. `bus` 는 전역 싱글톤이기 때문에 누수가 프로세스 종료까지 지속된다.
- 제안: 핸들러가 소유한 arrow function 참조를 인스턴스 프로퍼티로 고정(`private readonly onInvalidate = (id: string) => this.invalidatePool(id)`)하고 해당 참조로 register 하면 `Set` 의 idempotent 보장이 적용된다. 또는 `createHandler` 가 싱글톤 패턴임을 문서·아키텍처 수준에서 명시적으로 보장한다.

---

### [WARNING] `IntegrationsService.remove()` — `broadcastCredentialChange(id)` 를 DB 삭제 후 await 하되, TypeORM `remove()` 이후 `entity.id` 가 unset 될 수 있는 점을 `id` param 으로 우회하는 패턴의 부작용 위험
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/db-pool-creds-pubsub/codebase/backend/src/modules/integrations/integrations.service.ts` diff L1083–1084
- 상세: 주석 "TypeORM remove 후 entity.id 는 unset 될 수 있어 param `id` 를 쓴다"는 정확한 이해다. 단, `broadcastCredentialChange(id)` 의 내부가 단순히 `bus.publish(id)` 를 위임하는 1줄 래퍼라 현재는 안전하다. 향후 `broadcastCredentialChange` 에 로직이 추가될 때 `id` 가 이미 DB에서 삭제된 후임을 잊어버리면 존재하지 않는 integration 에 대한 추가 DB 조회 등 의도치 않은 부작용이 생길 수 있다.
- 제안: `broadcastCredentialChange` 의 JSDoc 또는 코드에 "호출 시점에 해당 integration 은 이미 DB에서 삭제됐을 수 있으므로 외부 조회 없이 id 전달만 수행해야 한다"는 제약을 명시한다.

---

### [INFO] `IntegrationCacheBus` 의 `@Global()` 모듈 등록 — 새 전역 싱글톤 도입
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/db-pool-creds-pubsub/codebase/backend/src/common/redis/redis.module.ts`
- 상세: `IntegrationCacheBus` 가 `@Global()` 모듈의 provider/export 로 등록됨에 따라 애플리케이션 전체에 단일 공유 인스턴스가 생긴다. `onModuleInit` 시 Redis `duplicate()` 연결이 열리고, `onModuleDestroy` 시 quit 된다. 이 연결은 애플리케이션 생명주기 동안 유지되는 추가 TCP 연결(공유 command 연결 외 1개)이다. 의도된 설계이나, Redis 연결 수 제한이 있는 환경에서 인스턴스 수 × 1 추가 연결이 발생함을 운영 측에 인지시켜야 한다.
- 제안: 운영 문서 또는 spec 에 "각 인스턴스가 subscriber 전용 연결 1개를 추가로 사용"을 명시(현재 `integration-cache-bus.service.ts` JSDoc 에 이미 충분히 설명돼 있음 — 현 수준 적절).

---

### [INFO] e2e 테스트 — `received` 배열이 테스트 간 공유 (teardown 없음)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/db-pool-creds-pubsub/codebase/backend/test/integration-cache-invalidate.e2e-spec.ts` L433 (`const received: string[] = []`)
- 상세: `received` 배열은 describe-scope 변수이며, 테스트 A 에서 push 된 integrationId 가 테스트 B 실행 중에도 배열에 남아 있다. `waitForBroadcast` 는 `received.includes(integrationId)` 로 검사하므로, 우연히 두 테스트가 같은 integrationId 를 생성하면(실제로는 `uniqueName` 으로 방지됨) 오탐이 생길 수 있다. 또한 외부 Redis 에 이미 해당 id 를 publish 한 다른 테스트나 서비스가 있다면 누적된다.
- 제안: 각 테스트 전에 `received.length = 0` 으로 초기화하거나, 테스트별 전용 `received` 배열을 사용하는 것을 고려한다. 현재 `uniqueName` 보호로 실제 오탐 위험은 낮음.

---

### [INFO] `HandlerDependencies` 인터페이스 확장 — 공개 인터페이스 변경, 기존 소비자 영향
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/db-pool-creds-pubsub/codebase/backend/src/nodes/core/node-component.interface.ts` L1461–1466
- 상세: `integrationCacheBus?: IntegrationCacheBus` 가 `HandlerDependencies` 인터페이스에 optional 로 추가됐다. TypeScript 구조적 타이핑상 optional 필드 추가는 기존 구현체/fixture 를 깨지 않는다. `NodeHandlerDependenciesProvider.build()` 가 해당 값을 전달하므로 소비자가 별도 코드 변경 없이 주입받는다. 호환성 문제 없음.
- 제안: 없음 (정상 패턴).

---

### [INFO] `IntegrationCacheBus.broadcastCredentialChange` private 래퍼 — 불필요한 간접 계층
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/db-pool-creds-pubsub/codebase/backend/src/modules/integrations/integrations.service.ts` diff L1069–1073
- 상세: `broadcastCredentialChange` 는 `this.integrationCacheBus.publish(id)` 를 직접 호출하는 1줄 래퍼다. 현재 시점에서는 불필요한 간접 계층이지만, 향후 broadcast 정책을 통합하거나 pre-/post-condition 을 추가하는 확장점으로 의도된 것으로 보인다. 부작용 관점에서는 neutral.
- 제안: 없음.

---

## 요약

이번 변경은 Redis pub/sub 기반 멀티 인스턴스 credential 캐시 무효화 버스를 추가하는 것으로, 의도된 부작용(Redis 네트워크 호출, 공유 invalidator 상태 변경)은 모두 명시적으로 설계됐으며 fail-safe 처리가 일관되게 적용돼 있다. 주요 우려점은 두 가지다: (1) `DatabaseQueryHandler` 생성자에서 매번 새 화살표 함수 참조를 register 하는 패턴이 비싱글톤 시나리오에서 `Set` 의 idempotent 보장을 우회해 invalidator 가 중복 누적될 수 있고, (2) `duplicate()` 연결의 `lazyConnect` 상속 여부가 명확히 문서화되지 않아 암묵적 TCP 연결 시도 시점에 불확실성이 있다. `IntegrationsService.remove()` 이후 `broadcastCredentialChange` 에 id 를 넘기는 패턴은 현재 코드에서는 안전하나 향후 확장 시 실수 유발 가능성이 있어 주의가 필요하다. 전역 상태·파일시스템·환경변수·이벤트 콜백 측면에서 의도치 않은 변경은 발견되지 않았다.

## 위험도

LOW
