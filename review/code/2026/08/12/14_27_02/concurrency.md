# 동시성(Concurrency) 코드 리뷰

## 발견사항

- **[WARNING]** Redis `get()` fail-open 이 "동시 중복 실행" 경합을 확률적 창(narrow timing window)에서 장애 지속 시간 전체로 넓힌다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:91-106` (신설 `catchError` 블록, `from(this.redis.get(redisKey)).pipe(...)`)
  - 상세: 이번 diff 전에는 `redis.get()` 이 런타임에 reject 하면 Observable 이 그대로 error 를 흘려 요청이 500 으로 fail-closed 됐다. 이 diff 는 `catchError` 로 그 reject 를 캐시 미스(`of(null)`)로 강등해 spec(`data-flow/15-external-interaction.md` §외부 의존)이 요구하는 "전 경로 fail-open" 을 만족시킨다 — 방향 자체는 spec 이 명시적으로 요구한 것이라 타당하다.
    다만 이 변경이 만드는 부작용이 하나 있다: `redis.get()`(조회)과 `cacheTapped()` 안의 `void this.redis.set(...)`(적재, `idempotency.interceptor.ts:162-173`, 이 diff 로 손대지 않은 기존 코드) 사이에는 원자적 CAS 나 락이 전혀 없다. 종전에는 이 GET→SET 비원자 구간이 문제가 되려면 두 요청이 캐시 조회 응답 시간 이내(수 ms)에 동시 도착해야 했다(좁은 타이밍 창). 이제는 **Redis 장애가 지속되는 동안 도착하는 모든 요청**이 타이밍과 무관하게 무조건 "캐시 미스" 분기를 타므로, 같은 `Idempotency-Key` 로 온 중복 요청(클라이언트의 네트워크 재시도 등, `spec/5-system/14-external-interaction-api.md` §5.6 이 바로 이 시나리오를 막기 위해 `Idempotency-Key` 동봉을 권장함)이 장애 구간 내내 전부 `next.handle()` 로 통과해 다운스트림 부작용(예: execution 생성, 외부 API 호출)이 중복 실행될 위험이 실질적으로 커진다.
  - 제안: 이 자체를 이 PR 범위에서 되돌릴 필요는 없다(spec 이 가용성을 명시적으로 우선한 결정) — 다만 (1) 클래스 docstring/`spec/data-flow`에 "fail-open 중에는 Idempotency-Key 중복 억제가 무력화될 수 있다" 는 trade-off 를 한 줄 명시하고, (2) Redis GET 실패율에 대한 관측/알람을 두어 장애 시 다운스트림 부작용의 중복 위험을 운영이 인지할 수 있게 하는 것을 권장한다. 코드 정확성 결함은 아니며, spec 이 승인한 가용성 우선 트레이드오프의 관측되지 않은 확장 범위를 표면화하는 성격의 지적이다.

- **[INFO]** GET→SET 비원자 구간 자체는 이 diff 가 만든 것이 아니라 선재하는 구조
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` — `intercept()` 의 `from(this.redis.get(redisKey))` (조회, 91행)와 `cacheTapped()` 의 `void this.redis.set(...)` (적재, 162-173행) 사이. 둘 다 이 PR 에서 로직을 바꾸지 않은 자리(적재 쪽)와, 조회 성공 경로(변경 안 됨) 양쪽 다 해당.
  - 상세: Redis `SET NX`(또는 Lua 스크립트) 같은 원자적 "미존재 시에만 선점" 연산이 아니라 GET 후 별도 SET 이라, 정상 동작(장애 없음) 시에도 두 요청이 캐시 응답 왕복 시간 이내에 동시 도착하면 둘 다 캐시 미스로 판정돼 `next.handle()` 을 각각 실행할 수 있다. 위 WARNING 항목은 이 기존 갭이 fail-open 확장으로 인해 "장애 시" 노출 폭이 넓어진다는 점을 지적하는 것이고, 이 항목 자체(정상 동작 시의 좁은 타이밍 창)는 이번 diff 가 만든 신규 결함이 아니다.
  - 제안: 이번 PR 스코프 밖으로 유지해도 무방하나, 후속으로 다룰 경우 `SET redisKey value NX EX ttl` 형태의 선점 방식이나 in-flight 요청 dedup(같은 키에 대한 진행 중 Promise 공유)을 검토할 만하다. 별도 backlog 항목으로 남기는 편을 권장(이 plan 은 이미 `plan/in-progress/backend-lint-gate-broken-on-main.md` 에서 여러 후속을 추적 중이므로 그쪽에 추가하는 것이 적절해 보인다).

- **[없음 — 확인 결과 문제 없음, 참고로 기록]** `catchError` 위치는 정확하며 회귀 테스트로 고정돼 있음
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:91-106` / 테스트: `idempotency.interceptor.spec.ts:393-416`("fail-open 이 409 충돌까지 삼키지 않는다 — catchError 위치 캐너리")
  - 상세: `catchError` 가 `from(this.redis.get(...))` 직후·`switchMap` 앞에 위치해, `switchMap` 내부에서 캐시 충돌 시 던지는 `ConflictException`(동기 throw → RxJS 가 downstream error 로 변환)을 삼키지 않는다. RxJS 의 `catchError` 는 자신보다 **상류(upstream)** 에서 발생한 에러만 잡고, 자신보다 **하류(downstream)** 연산자(`switchMap` 의 project 함수)에서 발생한 에러는 잡지 않으므로 이 배치는 올바르다. 캐너리 테스트가 "위치가 뒤로 가면 RED" 를 명시적으로 보장하는 점도 좋은 설계.

- **[없음 — 확인]** 이벤트 루프 블로킹 / async-await 누락 없음
  - `from(promise)` → RxJS Observable 변환, `void redis.set(...).catch(...)` (fire-and-forget 이지만 `.catch()` 로 unhandled rejection 방지) 모두 기존 패턴 그대로이며 이 diff 로 인한 블로킹 연산이나 await 누락은 없다. 리소스 풀(Redis 커넥션)도 새로 생성하지 않고 기존 공유 provider/injected client 를 그대로 재사용한다.

## 요약

이번 diff 는 `IdempotencyInterceptor` 의 Redis 조회(`get()`) 런타임 실패를 `catchError` 로 캐시 미스로 강등해 spec 이 요구하는 "전 경로 fail-open" 을 구현한다. `catchError` 의 파이프 내 위치(스위치맵 앞)는 정확하고 캐너리 테스트로 고정돼 있어 데드락·스레드 세이프티·async 오용 등 전형적 결함은 없다. 다만 이 변경의 동시성 함의로, GET→SET 사이에 원자성이 없는 기존 구조(선재)와 결합해 **Redis 장애 지속 구간 동안 같은 Idempotency-Key 의 중복 요청이 다운스트림을 중복 실행할 위험**이 좁은 타이밍 창에서 장애 전체 구간으로 넓어진다. 이는 spec 이 명시적으로 승인한 가용성 우선 트레이드오프이므로 되돌릴 사안은 아니지만, 문서화·관측 관점에서 보강할 여지가 있어 WARNING 으로 표기한다.

## 위험도

MEDIUM
