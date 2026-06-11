# Performance Review

## 발견사항

- **[INFO]** `broadcastCredentialChange` 는 단순 위임 메서드로 성능 이점 없음
  - 위치: `integrations.service.ts` — `broadcastCredentialChange` (라인 ~1069–1073)
  - 상세: 메서드 본문이 `await this.integrationCacheBus.publish(integrationId)` 한 줄이며, 인라인으로 대체해도 동일하다. 단일 호출자 관점에서 불필요한 스택 프레임과 래퍼 할당이 생긴다. JSDoc 이 설명하는 "OAuth 토큰 갱신은 제외" 정책 문서화 가치는 있으나, 성능 부담은 무시 가능한 수준이다.
  - 제안: 문서화 목적으로 유지하거나 주석과 함께 인라인으로 제거 — 어느 쪽이든 성능 영향은 미미하다.

- **[INFO]** `waitForBroadcast` e2e 폴링 루프의 50 ms busy-wait
  - 위치: `integration-cache-invalidate.e2e-spec.ts` — `waitForBroadcast` 함수 (라인 ~2488–2493)
  - 상세: 테스트 전용 코드이므로 프로덕션 성능과 무관하다. 그러나 5초 타임아웃 + 50 ms 간격이면 최악의 경우 100회 Promise 생성이 발생한다. 실 Redis 구독으로 수신하는 구조라면 이벤트 기반 Promise resolve 패턴으로 교체하면 더 깔끔하다.
  - 제안: `sub.on('message', …)` 콜백에서 `Promise resolve()` 를 직접 호출하는 방식으로 폴링 제거 가능. 다만 테스트 코드이므로 낮은 우선순위.

- **[INFO]** `invalidatePool` 에서 `pool.end()` 직렬 await
  - 위치: `database-query.handler.ts` — `invalidatePool` 메서드 (라인 ~1973–1982)
  - 상세: 단일 풀에 대한 `await entry.pool.end()` 는 드라이버가 현재 체크아웃된 클라이언트를 모두 반납할 때까지 블로킹된다. `pg` 는 기본 타임아웃이 없으므로 스테일 클라이언트가 오래 점유 중이면 이 await 가 임의로 길어질 수 있다. 한편 `shutdown` 메서드는 `Promise.allSettled` 로 모든 풀을 병렬 종료한다 — `invalidatePool` 의 단일 풀 종료에도 동일한 타임아웃/타임리밋 고려가 필요하다.
  - 제안: `pool.end()` 에 타임아웃 래퍼를 추가하거나, 이미 존재하는 에러 suppression(`catch(() => {})`) 패턴과 함께 완전히 fire-and-forget(`void`) 처리를 검토한다. 현행 `resolvePgPool` 의 stale 풀 교체도 `void existing.pool.end().catch(() => {})` 로 처리하고 있어 일관성이 없다.

- **[INFO]** `runInvalidators` 의 `instanceof Promise` 체크
  - 위치: `integration-cache-bus.service.ts` — `runInvalidators` 메서드 (라인 ~581–603)
  - 상세: `result instanceof Promise` 는 thenable 을 제대로 감지하지 못한다. async 함수가 반환한 native Promise 는 문제없지만, 커스텀 thenable(예: Bluebird Promise, test mock 반환값)은 누락될 수 있다. `result != null && typeof result.then === 'function'` 가 더 일반적이다. 이번 코드베이스에서는 실제로 문제가 발생할 가능성이 낮으나, 지금의 테스트에서 `mockRejectedValue` 를 사용한 jest mock 은 native Promise 를 반환하므로 현재는 안전하다.
  - 제안: 테스트 픽스처를 통해 실제로 커버되고 있다면 유지해도 무방. 방어적으로 `typeof result?.then === 'function'` 으로 교체하는 것을 고려.

- **[INFO]** e2e `received` 배열이 테스트 간 공유
  - 위치: `integration-cache-invalidate.e2e-spec.ts` — 클래스 레벨 `const received: string[] = []` (라인 ~2434)
  - 상세: `received` 가 beforeAll 스코프의 클로저 변수로, 테스트 A 에서 수신한 메시지가 테스트 B 실행 중에도 남아있다. 테스트 순서가 뒤바뀌거나 이전 테스트의 잔여 메시지가 있으면 `waitForBroadcast` 가 즉시 `true` 를 반환해 검증을 통과할 수 있다. 성능 오탐(false-positive timeout 없음)이 아니라 테스트 신뢰성 문제지만, 잘못된 캐시 히트를 방지하려면 각 테스트 전 배열을 비우거나 `received.indexOf(id, searchFrom)` 형태로 이전 항목을 무시해야 한다.
  - 제안: 각 `it` 블록 시작에 `received.length = 0` 추가, 또는 `waitForBroadcast` 에 검색 시작 인덱스를 파라미터로 추가.

- **[INFO]** `hashCredentials` 에서 매 실행마다 SHA-256 계산
  - 위치: `database-query.handler.ts` — `hashCredentials` 함수 (라인 ~2195–2205)
  - 상세: `resolvePgPool` / `resolveMysqlPool` 은 쿼리 실행마다 `hashCredentials(creds)` 를 호출하여 새 문자열 결합 + `createHash('sha256')` 계산을 수행한다. 자격증명 객체가 변하지 않으면 동일한 해시를 매번 재계산한다. 다만 이 함수는 이번 PR 의 변경 사항이 아닌 기존 코드이므로 참고 수준으로 기록한다.
  - 제안: 향후 개선 여지: `Map<integrationId, {hash, creds}>` 로 해시를 함께 저장하면 자격증명 변경 여부만 확인 시 해시 재계산을 피할 수 있다. 단 현재 pool 재사용 빈도가 높지 않다면 무시 가능한 수준.

## 요약

이번 변경은 Redis pub/sub 기반 멀티 인스턴스 credential 캐시 무효화 계층을 추가한다. 핵심 경로(`IntegrationCacheBus`)는 싱글톤 pub/sub 연결 1개와 전용 subscriber 연결 1개만 유지하는 경량 설계로, N+1 쿼리나 대용량 메모리 할당 등의 명백한 성능 이슈는 없다. `runInvalidators` 는 Set 을 순회하므로 O(n) — 구독자 수가 서비스 타입 수(현재 database-query 1개)에 비례하기 때문에 실질적으로 O(1) 수준이다. `invalidatePool` 의 `pool.end()` await 시간이 stale 연결 보유 시 길어질 수 있는 점과 e2e 테스트의 공유 상태 배열이 테스트 신뢰성에 미칠 수 있는 영향은 주목할 만하지만, 프로덕션 임계 경로에서 회전·삭제는 저빈도 관리 작업이므로 전반적인 성능 위험도는 낮다.

## 위험도

LOW
