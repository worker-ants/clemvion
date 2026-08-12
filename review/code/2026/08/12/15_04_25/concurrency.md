# 동시성(Concurrency) 리뷰

## 발견사항

- **[WARNING]** fail-open 구간에서 `Idempotency-Key` 중복 억제가 사실상 무력화되고, GET→SET 원자성 부재(TOCTOU)가 장애 구간에서 창(window) 전체로 확대된다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:67-72` (신규 docstring, 이번 diff 로 추가). 근본 메커니즘은 같은 파일의 `cacheTapped()` 내부 `void this.redis.set(redisKey, ..., 'EX', TTL_SEC).catch(...)` (동일 파일 174행 부근, 이번 diff 범위 밖·미변경) — 응답을 클라이언트로 반환한 뒤에도 SET 이 백그라운드로 진행되는 fire-and-forget 구조.
  - 상세: 이번 diff 는 `catchError`를 추가해 `get()` 런타임 reject 를 캐시 미스로 강등한다(fail-open). 이 자체는 spec(`spec/data-flow/15-external-interaction.md`, "전 경로 fail-open — 가용성 우선")이 명시적으로 요구하는 트레이드오프이고 올바르게 구현됐다. 다만 그 대가로: (1) Redis 장애가 **지속되는 동안** 같은 키의 모든 재요청이 캐시 미스로 처리되어 다운스트림(예: execution 생성)이 중복 실행될 수 있고, (2) 정상 시에도 GET(조회)→`next.handle()`(다운스트림 실행)→SET(적재)이 원자적 연산이 아니라 아주 근접한 두 동시 요청이 둘 다 캐시 미스를 관측하고 통과할 수 있는 좁은 경쟁 창이 이미 존재한다(TOCTOU). 장애 구간에서는 이 창이 "매우 좁음"에서 "장애 지속 시간 전체"로 확대된다. 이 대가는 클래스 docstring·CHANGELOG 에 명시적으로 문서화됐고, 직전 리뷰 라운드(`review/code/2026/08/12/14_27_02/RESOLUTION.md` WARNING #1)에서 이미 동일 항목으로 지적·판정(문서화로 대응, 코드 레벨 완화는 보류)됐으며 `plan/in-progress/backend-lint-gate-broken-on-main.md` 에 관측 지표·`SET NX EX` 선점/in-flight dedup 검토가 백로그로 등재돼 있다. 즉 새로 발견된 결함이 아니라 이미 인지·추적 중인 accepted trade-off이지만, 기술적으로는 여전히 살아있는 race 이므로 이번 라운드에서도 동일하게 보고한다.
  - 제안: 코드 변경은 불필요(spec 이 택한 가용성 우선 트레이드오프를 되돌리지 않는 것이 맞다). 이미 백로그에 있는 두 항목(Redis GET 실패율 지표/알람, `SET NX EX` 선점 또는 in-flight dedup 검토)을 유지하고, 이번 라운드에서 새로 되돌리거나 재차 항목화할 필요는 없다.

- **[INFO]** `catchError` 위치가 `switchMap` 앞으로 올바르게 배치되어 409 `ConflictException`(정상 멱등 충돌 검출)을 삼키지 않음 — 검증 확인
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:107-112` (신규 `catchError` 블록), `switchMap` 은 113행부터 시작.
  - 상세: `from(this.redis.get(redisKey))` 직후·`switchMap` 이전에 `catchError`를 둬서, RxJS 파이프 상 이 연산자는 오직 상류(`get()` Observable)의 에러만 가로챈다. `switchMap` 프로젝션 함수 내부에서 던지는 `ConflictException`은 하류 에러라 이 `catchError`가 관측하지 못하므로 멱등성 충돌 검출은 그대로 살아있다. `idempotency.interceptor.spec.ts:393-416`(`'fail-open 이 409 충돌까지 삼키지 않는다 — catchError 위치 캐너리'`)가 이 배치를 회귀 고정한다. 직전 리뷰 라운드에서 리뷰어 하나가 이 순서가 뒤집혔다고 CRITICAL 로 오탐 보고했으나, 원인은 병렬 리뷰어의 공유 워크트리 뮤테이션이었고(`review/code/2026/08/12/14_27_02/RESOLUTION.md` 상단) 커밋 기준 실제 순서는 옳다는 것이 재검증됐다. 이번 세션에서 다시 읽은 소스(`Read`)로도 순서가 올바름을 확인했다.
  - 제안: 없음(정상). 향후 이 파이프라인을 리팩터링할 때 `catchError`가 `switchMap` 뒤로 밀리지 않도록 캐너리 테스트를 유지할 것.

## 요약

핵심 변경은 `IdempotencyInterceptor`의 Redis `GET` 런타임 실패를 `catchError`로 캐시 미스로 강등해 fail-open을 완성한 것이며, `catchError`가 `switchMap` 앞에 정확히 배치되어 409 충돌 검출과의 상호작용도 안전하다(카나리 테스트로 고정, 재검증 완료). 유일한 실질 동시성 이슈는 fail-open 구간 동안 `Idempotency-Key` 중복 억제가 사실상 무력화되고 평시에도 존재하던 GET→SET 비원자성(TOCTOU) 창이 장애 구간 전체로 넓어진다는 점인데, 이는 spec이 명시한 "가용성 우선" 트레이드오프이고 docstring·CHANGELOG에 문서화됐으며 관측·강화 방안이 이미 plan 백로그(`14_27_02` concurrency WARNING 기반)에 등재돼 추적 중이다. 새로운 데드락·스레드 안전성·이벤트 루프 블로킹·리소스 풀 크기 이슈는 발견되지 않았다.

## 위험도

MEDIUM
