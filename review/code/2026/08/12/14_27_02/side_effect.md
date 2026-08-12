# 부작용(Side Effect) 리뷰 결과

## 발견사항

- **[INFO]** `catchError` 가 Redis `get()` 에서 발생하는 **모든** 에러를 무차별적으로 "캐시 미스"로 강등한다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:100` (catchError 블록, ~100-105)
  - 상세: `catchError((err: unknown) => { this.logger.warn(...); return of(null); })` 는 연결 끊김·타임아웃 같은 가용성 문제뿐 아니라, 예를 들어 `redisKey` 조립 로직의 프로그래밍 버그로 인한 예외까지 동일하게 삼켜 조용히 캐시 미스로 처리한다. 종전에는 이런 에러가 그대로 500 으로 드러났지만 이제는 warn 로그 한 줄만 남기고 요청이 정상 처리된다.
  - 제안: `spec/data-flow/15-external-interaction.md` 가 "전 경로 fail-open" 을 명시적으로 요구하므로 의도된 설계로 보이나, 실제 원인이 연결 장애가 아닌 다른 버그일 때도 동일하게 은폐될 수 있다는 점은 인지해 둘 필요가 있다(현재 수정 범위에서 조치 불요, 기록 목적).

- **[INFO]** Redis 전면 장애 시 `get()` 실패와 `set()` 실패가 요청당 각각 별도 warn 로그를 남겨 로그 볼륨이 배가될 수 있다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:100`-`105` (get 실패 로그) 및 `:167`-`173` (기존 set 실패 로그, 이번 diff 로 변경되지 않음)
  - 상세: 이번 변경으로 `get()` 이 실패해도 캐시 미스로 취급해 `next.handle()` 이후 `cacheTapped()` 를 통해 여전히 `set()` 을 시도한다(신규 테스트 `` `get()` 이 reject 하면 캐시 미스로 취급해 새 응답을 적재한다 ``, spec.ts:373-391 로 명시적으로 검증됨). Redis 가 완전히 죽어 있으면 이 `set()` 도 실패하므로 요청 하나당 warn 로그가 두 번(GET 실패 + SET 실패) 발생한다.
  - 제안: `set()` 실패는 기존에 이미 `.catch()` 로 감싸져 있어 unhandled rejection 위험은 없다(안전). 다만 완전 장애 상황에서 로그가 배가되는 점은 운영 관점에서 참고할 사항이며, 이번 PR 스코프의 결함은 아니다.

- **[INFO]** 신규 테스트가 인터셉터 인스턴스마다 독립적인 mock(`makeRedis()`)을 생성해 전역/공유 상태 오염이 없음을 확인
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:356`, `:374`, `:398` (각 `it` 블록의 `makeRedis()` 호출)
  - 상세: 세 신규 테스트 모두 `beforeEach` 없이도 각자 새 `RedisStub` 을 생성하고, `bodyHashOf` 는 `describe` 스코프의 지역 `const` 라 다른 `describe` 블록(예: 161행, 89행)과 격리되어 있다. 전역 변수 도입이나 테스트 간 상태 누수는 관측되지 않는다.

## 요약

핵심 변경은 `IdempotencyInterceptor.intercept()` 의 RxJS 파이프라인에 `catchError` 오퍼레이터 하나를 `from(this.redis.get(...))` 직후·`switchMap` 이전에 삽입해, 캐시 조회 실패를 캐시 미스로 강등시키는 fail-open 동작을 추가한 것이다. 함수/클래스 시그니처, 공개 인터페이스, 환경 변수 접근, 외부 네트워크 호출(신규 호출 없음, 기존 Redis 호출의 에러 처리만 변경)에는 변화가 없다. `catchError` 를 `switchMap` **앞**에 두어 캐시 히트 시 던지는 `ConflictException` 을 삼키지 않도록 위치를 신중히 설계했고, 이를 전용 캐너리 테스트(`idempotency.interceptor.spec.ts:393-416`)와 뮤테이션 실측(위치를 뒤로 옮기면 신규 3건 + 기존 409 테스트까지 RED)으로 고정해 두어 회귀 위험이 낮다. 테스트 파일 추가분은 순수 추가이며 공유 가변 상태나 전역 변수를 도입하지 않는다. plan 문서 변경은 체크리스트 갱신·서술 추가뿐으로 부작용 없음. 유일하게 짚을 점은 `catchError` 가 연결 장애와 무관한 예외까지 동일하게 삼킨다는 점과, 완전 장애 시 로그가 이중으로 남을 수 있다는 점인데, 둘 다 spec 이 명시한 "전 경로 fail-open" 요구와 일치하는 의도된 트레이드오프로 판단된다.

## 위험도

LOW
