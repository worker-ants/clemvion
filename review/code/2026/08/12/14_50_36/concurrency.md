# 동시성(Concurrency) 코드 리뷰

## 발견사항

- **[WARNING]** Redis `get()` fail-open이 GET→SET 비원자 구조와 결합해 "동시 중복 실행" 위험을 좁은 타이밍 창에서 Redis 장애 지속 구간 전체로 넓힌다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:98-113` (신설 `catchError`, `intercept()` 파이프)와 `:174-180`(`cacheTapped()` 내 `void this.redis.set(...).catch(...)`, 이 diff로 미변경된 기존 코드)
  - 상세: 이번 fix는 `redis.get()`이 런타임에 reject하는 경로를 `catchError`로 캐시 미스(`of(null)`)로 강등해 spec(`spec/data-flow/15-external-interaction.md`)이 요구하는 "전 경로 fail-open"을 만족시킨다 — 방향 자체는 spec이 명시적으로 요구한 것이라 타당하고, `catchError`가 `switchMap`(113행) 앞에 정확히 위치해 캐시 충돌 시 던지는 `ConflictException`(정상 동작)을 삼키지 않는 것도 직접 확인했다. 다만 조회(`get`, 98행)와 적재(`set`, 175-176행) 사이에는 원자적 CAS/락이 전혀 없다. 종전에는 이 GET→SET 비원자 구간이 문제가 되려면 두 요청이 캐시 조회 응답 시간 이내(수 ms)에 동시 도착해야 했다. 이번 fix 이후에는 **Redis 장애가 지속되는 동안 도착하는 모든 요청**이 타이밍과 무관하게 무조건 캐시 미스 분기를 타므로, 같은 `Idempotency-Key`로 온 중복 요청(클라이언트 재시도 등)이 장애 구간 내내 전부 `next.handle()`로 통과해 다운스트림(execution 생성 등)이 중복 실행될 위험이 커진다.
  - 제안: 이미 클래스 docstring(`idempotency.interceptor.ts:61-72`)과 `CHANGELOG.md`에 이 트레이드오프가 명시됐고, `plan/in-progress/backend-lint-gate-broken-on-main.md`에 관측 지표·`SET NX EX` 검토가 백로그로 등재돼 향후 조치 경로는 확보돼 있다. 이 PR 범위에서 코드를 되돌릴 필요는 없음(spec이 가용성을 명시적으로 우선한 결정) — 다만 백로그 항목(Redis GET 실패율 알람)이 실제로 구현되기 전까지는 운영이 이 구간을 인지할 수단이 없다는 점은 남는 리스크로 유지된다.

- **[INFO]** GET→SET 비원자 구간 자체는 선재하는 구조이며 이번 diff의 신규 결함이 아니다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:98`(`from(this.redis.get(redisKey))`)와 `:174-180`(`cacheTapped()`의 `void this.redis.set(...)`)
  - 상세: Redis `SET NX`(또는 Lua 스크립트) 같은 원자적 "미존재 시 선점" 연산이 아니라 GET 후 별도 SET이라, 장애가 없는 정상 동작 시에도 두 요청이 캐시 응답 왕복 시간 이내에 동시 도착하면 둘 다 캐시 미스로 판정돼 `next.handle()`을 각각 실행할 수 있다. `plan/in-progress/backend-lint-gate-broken-on-main.md`가 이미 이 항목(§`14_27_02` concurrency INFO 7)을 백로그로 추적 중이다.
  - 제안: 이번 PR 스코프 밖으로 유지해도 무방. 후속으로 `SET redisKey value NX EX ttl` 선점 방식이나 in-flight dedup 검토를 권장(이미 backlog화됨, 추가 조치 불요).

- **[없음 — 확인 결과 문제 없음, 참고로 기록]** `catchError` 위치 정확성을 소스에서 직접 재검증함
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:107`(`catchError`) / `:113`(`switchMap`) — `grep -n "catchError|switchMap"`으로 직접 확인(`git status --porcelain` clean, `git diff HEAD` 빈 출력).
  - 상세: RxJS `catchError`는 자신보다 상류(upstream)에서 발생한 에러만 잡고, 하류(downstream) 연산자(`switchMap`의 project 함수 내부에서 던지는 `ConflictException`)는 잡지 않는다. `catchError`가 `from(this.redis.get(...))` 직후·`switchMap` 앞에 있으므로 배치가 정확하다. `idempotency.interceptor.spec.ts:389-412`("fail-open이 409 충돌까지 삼키지 않는다 — catchError 위치 캐너리")가 이 배치를 회귀 테스트로 고정한다. 참고로 동일 파일에 대해 이전 리뷰 세션(`review/code/2026/08/12/14_27_02/documentation.md`)이 "순서 역전" CRITICAL을 보고했으나, 이는 병렬 리뷰 세션의 워크트리 뮤테이션(캐너리 검증용 임시 뮤턴트)이 만든 순간적 아티팩트였고 `RESOLUTION.md`가 이미 오탐으로 확정했다 — 이번 리뷰에서도 독립적으로 동일 결론(오탐)에 도달했다.

- **[없음 — 확인]** 이벤트 루프 블로킹·async/await 누락·리소스 풀링 문제 없음
  - `from(promise)` → RxJS Observable 변환, `void redis.set(...).catch(...)`(fire-and-forget이나 `.catch()`로 unhandled rejection 방지, `:174-180`)는 기존 패턴 그대로다. 신규 Redis 커넥션 생성 없이 기존 공유 provider/injected client를 재사용하므로 커넥션 풀 관리에 영향이 없다. 데드락 가능성 있는 락/세마포어 사용도 없다(Node.js 단일 이벤트 루프 + RxJS 파이프라인만 존재).

## 요약

이번 diff의 핵심 프로덕션 코드 변경은 `IdempotencyInterceptor`의 Redis 조회(`get()`) 런타임 실패를 `catchError`로 캐시 미스로 강등해 spec이 요구하는 "전 경로 fail-open"을 구현하는 것이다. `catchError`의 파이프 내 위치(`switchMap` 앞, 실제 소스 107행 vs 113행)를 직접 grep/git diff로 재검증한 결과 정확하며, 이전 세션이 보고한 순서 역전 CRITICAL은 공유 워크트리 뮤테이션 아티팩트였음을 독립적으로 재확인했다(코드 결함 아님). 데드락·스레드 세이프티·async 오용·리소스 풀 문제는 없다. 다만 이 fix의 동시성 함의로, GET→SET 사이 원자성 부재(선재 구조)와 결합해 Redis 장애 지속 구간 동안 같은 Idempotency-Key의 중복 요청이 다운스트림을 중복 실행할 위험이 좁은 타이밍 창에서 장애 전체 구간으로 넓어진다. spec이 명시적으로 승인한 가용성 우선 트레이드오프이므로 코드를 되돌릴 사안은 아니며, 이번 diff가 이미 docstring·CHANGELOG·plan 백로그(관측 지표, `SET NX EX` 검토)로 그 대가를 문서화·추적하고 있어 조치 경로는 확보돼 있다.

## 위험도

MEDIUM
