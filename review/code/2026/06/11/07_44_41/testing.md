# Testing Review — Integration Cache Bus (refactor 04 m-4)

## 발견사항

### [INFO] `register` idempotency(Set 중복 방지) 테스트 누락
- 위치: `integration-cache-bus.service.spec.ts` — `subscribe + register` describe
- 상세: `IntegrationCacheBus.invalidators` 는 `Set` 이므로 동일 함수 참조를 두 번 `register` 해도 1회만 실행돼야 한다. 이 idempotency 속성은 JSDoc 에 명시(`Set 이라 idempotent`)되어 있으나 테스트 커버 없음.
- 제안: `bus.register(fn); bus.register(fn);` 후 메시지 수신 시 `fn` 이 1회만 호출되는지 확인하는 케이스 추가.

### [INFO] `onModuleInit` 이후 `subscribe` 실패 경로 미테스트
- 위치: `integration-cache-bus.service.spec.ts` — `subscribe + register` describe
- 상세: `sub.subscribe()` 가 reject 되는 케이스(채널 구독 실패)에 대한 fail-safe(warn 로그 + degrade)는 구현(`integration-cache-bus.service.ts:571-577`)에 있으나 테스트가 없다.
- 제안: `sub.subscribe.mockRejectedValueOnce(new Error('subscribe fail'))` 후 `bus.onModuleInit()` 이 throw 하지 않음을 검증하는 케이스 추가.

### [INFO] `onModuleInit` 의 `error` 이벤트 핸들러 테스트 누락
- 위치: `integration-cache-bus.service.spec.ts`
- 상세: `sub.on('error', ...)` 핸들러가 등록되는지, error 이벤트가 emit 돼도 process crash 가 없는지 테스트되지 않는다. 구현에서는 logger.error 만 호출하는 단순 핸들러이나 커버리지 갭이다.
- 제안: `sub.emitError(new Error('conn drop'))` 형태의 helper 를 `FakeRedis` 에 추가하고 throw 없음을 확인하는 케이스 추가. 단순 INFO 수준으로 필수는 아니지만 `on('error')` 미등록 시 Node.js 프로세스 crash 가 발생하는 위험 대역이므로 커버할 가치 있음.

### [INFO] `runInvalidators` 의 빈 `integrationId` 경계값 테스트 누락
- 위치: `integration-cache-bus.service.spec.ts`
- 상세: `runInvalidators` 내부에 `if (!integrationId) return` 가드(`database-query.handler.ts` 와 동형)가 있으나, 채널 메시지로 빈 문자열이 수신됐을 때 invalidator 가 호출되지 않아야 함을 검증하는 케이스가 없다.
- 제안: `sub.emitMessage(INTEGRATION_CACHE_INVALIDATE_CHANNEL, '')` 후 등록된 invalidator 미호출 확인 케이스 추가.

### [INFO] `DatabaseQueryHandler` 통합 버스 테스트 — `invalidatePool` spy 순서 취약성
- 위치: `database-query.handler.spec.ts` — `integration cache bus (04 m-4)` describe, 첫 번째 케이스
- 상세: `new DatabaseQueryHandler(undefined, bus as never)` 로 생성 후 `jest.spyOn(handler, 'invalidatePool')` 을 적용하는데, `registered` 가 생성자 내 `register(fn)` 시점에 이미 `this.invalidatePool` 의 원본 참조로 묶인다. spy 가 prototype 을 patch 하더라도 클로저 `(integrationId) => this.invalidatePool(integrationId)` 형태여야 spy 가 intercept 된다. 현재 구현(`database-query.handler.ts:731`)은 `integrationCacheBus?.register((integrationId) => this.invalidatePool(integrationId))` 형태로 `this` 를 통해 호출하므로 spy 는 동작한다. 하지만 이 동작은 구현 내부의 arrow function wrapper 에 의존한다 — 만약 미래에 `this.invalidatePool.bind(this)` 형태로 바뀌면 spy 가 끊어진다. 테스트가 구현 내부 형태에 의존하고 있다는 취약성.
- 제안: spy 대신 `handler.pools` Map 에 직접 항목을 삽입하고 `invalidatePool` 호출 후 Map 에서 제거됐는지 검증하는 블랙박스 방식으로 전환하면 더 안정적. 현 수준에서는 INFO 이지만 기록.

### [INFO] `integrations.service.spec.ts` — `rotate` 테스트의 `result.id` 의존성
- 위치: `integrations.service.spec.ts:1017` — `broadcasts cache invalidation after a successful rotation` 케이스
- 상세: `expect(integrationCacheBus.publish).toHaveBeenCalledWith(result.id)` 로 rotate 반환 값의 id 를 사용한다. `result.id` 가 무엇인지(fixture 설정)는 추적해야 알 수 있어 테스트 자체의 가독성이 낮다. `'int-1'` 같은 명시적 값을 직접 사용하면 의도가 더 분명해진다.
- 제안: `expect(integrationCacheBus.publish).toHaveBeenCalledWith('int-1')` 과 같이 fixture 의 id 값을 인라인 명시(또는 상수화)하면 가독성 향상.

### [INFO] e2e 테스트의 `received` 배열 공유로 인한 테스트 간 오염 가능성
- 위치: `integration-cache-invalidate.e2e-spec.ts:553` — `const received: string[] = []`
- 상세: `received` 배열이 `describe` 스코프에서 공유되고 초기화가 없다. 테스트 A 에서 받은 메시지가 테스트 B 에서 `waitForBroadcast` 로도 검색된다. 우연히 동일 id 가 충돌하지 않는 한 문제없지만(`uniqueName` 으로 분리), `beforeEach` 에서 배열을 clear 하지 않으면 실패 디버깅 시 혼선 발생 가능.
- 제안: 각 테스트 케이스가 고유한 id 를 생성하므로 실제 오염은 없으나, 명시적으로 `beforeEach(() => received.length = 0)` 를 추가하면 격리 의도가 드러나고 향후 케이스 추가 시 안전.

### [INFO] e2e 테스트의 `waitForBroadcast` — `while(true)` 루프 + `eslint-disable`
- 위치: `integration-cache-invalidate.e2e-spec.ts:2488`
- 상세: `while (true)` + `eslint-disable-next-line no-constant-condition` 는 동작에는 문제없으나 timeout 분기가 `return false` 로 끝나고 그에 대한 실패 메시지가 없다. `waitForBroadcast` 가 `false` 를 반환했을 때 `expect(...).toBe(true)` 의 실패 메시지만으로는 어느 id 가 몇 ms 후에도 오지 않았는지 알기 어렵다.
- 제안: `expect(await waitForBroadcast(id), `broadcast not received for ${id} within 5s`).toBe(true)` 와 같이 jest expect 메시지를 추가하거나, `waitForBroadcast` 실패 시 직접 `throw` 하는 helper 로 변경.

## 요약

변경 코드(IntegrationCacheBus, DatabaseQueryHandler 버스 연동, IntegrationsService rotate/remove broadcast, e2e pub/sub 확인)에 대한 테스트 커버리지는 전반적으로 충실하다. 핵심 분기(publish/subscribe/fail-safe/degrade/isolate/destroy)가 단위 테스트로 커버되고, rotate·remove 의 broadcast 호출이 통합 서비스 스펙으로 검증되며, 실 Redis 경유 e2e 케이스까지 구비된 3계층 커버가 갖춰졌다. 발견된 사항은 모두 INFO 수준으로, `register` idempotency·subscribe 실패·error 이벤트·빈 id 경계값 등 보완 가능한 커버리지 갭과 테스트 격리 명확성 제안이다. 기존 테스트의 회귀 안정성과 테스트 용이성(의존성 주입, Optional 패턴)은 양호하다.

## 위험도

LOW
