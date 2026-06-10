# 동시성(Concurrency) 리뷰 결과

## 발견사항

### 발견사항 1
- **[WARNING]** `DatabaseQueryHandler.pools` Map 에 대한 비원자적 invalidate/resolve 경쟁 조건
  - 위치: `/codebase/backend/src/nodes/integration/database-query/database-query.handler.ts` — `invalidatePool()` (라인 1976–1985) vs `resolvePgPool()` / `resolveMysqlPool()` (라인 1996–2060)
  - 상세: Node.js 는 단일 이벤트 루프이지만 `invalidatePool` 은 `async` 함수다. `this.pools.delete(integrationId)` 후 `await entry.pool.end()` 를 호출하는 사이, 동일 integrationId 에 대한 `resolvePgPool` / `resolveMysqlPool` 이 실행되면 새 풀이 Map 에 등록된다. 이때 `pool.end()` 가 완료되지 않은 상태에서 새 풀이 이미 쿼리를 받을 수 있으므로 문제는 없다. 그러나 반대 방향도 점검이 필요하다: `resolvePgPool` 의 `void existing.pool.end().catch(()=>{})` 는 스테일 풀 종료를 비동기로 fire-and-forget 한 뒤 새 풀을 즉시 Map 에 덮어쓴다. `invalidatePool` 이 동시에 같은 integrationId 에 대해 `this.pools.get` → `this.pools.delete` 를 실행 중이면, delete 직전에 `resolvePgPool` 이 새 풀을 `set` 해도 그 직후 `delete` 가 새 풀을 지워버리는 시나리오가 이론적으로 가능하다. 단, Node.js 싱글 스레드 이벤트 루프 특성상 실제로 동 시 진입은 await 경계를 지나야만 일어나므로 현재 구현에서 `invalidatePool` 의 `await entry.pool.end()` 이전에 모든 동기 코드가 원자적으로 실행된다. 즉, `get` → `delete` → `await` 순서는 중단 없이 실행되어 실질적인 경쟁 조건은 발생하지 않는다.
  - 보완 관점: 현재 구조는 안전하나, 향후 Worker Threads 또는 외부에서 `pools` 를 직접 조작하는 코드가 추가될 경우 취약해질 수 있다. `invalidatePool` 이 "delete 후 end" 패턴을 유지하는 한 현재 단일 루프 환경에서는 안전.
  - 제안: 현재 구현 수준에서 실질적 위험은 없으나, 주석으로 "단일 이벤트 루프 원자성 의존" 을 명시해 향후 Worker Thread 환경 도입 시 재검토 신호를 남기는 것을 권장한다.

### 발견사항 2
- **[INFO]** `IntegrationCacheBus.onModuleInit` 에서 `subscribe()` Promise 가 detach 된 채 `this.subscriber = sub` 가 먼저 실행됨
  - 위치: `/codebase/backend/src/nodes/integration/database-query/../../common/redis/integration-cache-bus.service.ts` — `onModuleInit()` 라인 553–582
  - 상세: `sub.subscribe(...)` 는 `.catch(...)` 만 붙이고 await 없이 반환된 뒤 `this.subscriber = sub` 로 구독 연결을 저장한다. subscribe 가 아직 확인되기 전에 `onModuleDestroy` 가 호출되면 `sub.quit()` 이 subscribe 핸드쉐이크 중인 연결에 발행되는 race 가 생긴다. ioredis 는 이 상황을 내부적으로 처리하지만 `quit` 이 구독 확인 전에 전송되면 경고 로그 없이 조용히 중단될 수 있다.
  - 제안: 치명적 문제는 아니지만 `onModuleInit` 을 `async` 로 변경하고 `await sub.subscribe(...)` 로 구독 완료를 확인한 뒤 `this.subscriber = sub` 를 할당하면 destroy race 를 없앨 수 있다. NestJS 의 `OnModuleInit` 훅은 반환된 Promise 를 await 하므로 지원된다.

### 발견사항 3
- **[INFO]** `runInvalidators` 에서 비동기 invalidator 의 rejection 을 `result.catch(...)` 로 처리하지만 테스트의 microtask flush (`await Promise.resolve()`) 의존 검증 방식
  - 위치: `/codebase/backend/src/nodes/integration/database-query/../../common/redis/integration-cache-bus.service.spec.ts` 라인 206–211
  - 상세: `result.catch(...)` 로 rejection 을 핸들하는 것은 올바르나, 테스트에서 `await Promise.resolve()` 한 번만으로 microtask 큐를 충분히 플러시하는지 확인이 필요하다. 현재 mock 이 단일 rejected Promise 를 반환하고 `.catch()` 가 단일 microtask 체인이라 1회 flush 로 충분하다. 향후 체인이 깊어질 경우 `await Promise.resolve()` 를 여러 번 호출하거나 `jest.runAllMicrotasks()` 를 활용해야 할 수 있다. 현재 구현 대상에서는 문제없다.
  - 제안: 참고용 INFO. 현재 단계에서 수정 불필요.

### 발견사항 4
- **[INFO]** `e2e` 테스트의 `received` 배열이 `sub.on('message', ...)` 콜백에서 push 되고 `waitForBroadcast` 폴링에서 read 되는 패턴
  - 위치: `/codebase/backend/test/integration-cache-invalidate.e2e-spec.ts` 라인 2436, 2456, 2492
  - 상세: Node.js 단일 이벤트 루프에서 `received.push(message)` 와 `received.includes(integrationId)` 는 동 타임에 실행될 수 없어 경쟁 조건 없음. `waitForBroadcast` 의 polling loop 는 `await new Promise(r => setTimeout(r, 50))` 로 이벤트 루프에 제어를 양보하므로 Redis 메시지 이벤트가 정상적으로 처리된다. 설계 자체는 올바르다.
  - 제안: 수정 불필요.

---

## 요약

변경의 핵심 동시성 설계 — `IntegrationCacheBus` 를 통한 Redis pub/sub 캐시 무효화 및 `DatabaseQueryHandler.pools` Map 에 대한 invalidate/resolve 패턴 — 은 Node.js 단일 이벤트 루프 특성을 올바르게 활용하고 있다. `runInvalidators` 의 동기 예외 격리와 비동기 rejection catch 처리는 적절하며, `onModuleDestroy` 의 subscriber null 처리도 올바르다. 주요 지적 사항은 `onModuleInit` 의 `subscribe()` 가 fire-and-forget 된 상태에서 `this.subscriber` 가 할당되는 미묘한 race (모듈 셧다운 타이밍 한정, ioredis 내부 처리로 실질 피해는 드묾) 뿐으로, 위험도 수준은 낮다. `pools` Map 에 대한 비원자적 조작 우려는 단일 이벤트 루프 동기 구간이 보호하고 있어 현재 아키텍처에서는 실질적 문제가 없다.

## 위험도

LOW
