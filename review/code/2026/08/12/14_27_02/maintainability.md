# 유지보수성(Maintainability) Review

## 발견사항

- **[WARNING]** `bodyHashOf` 헬퍼가 describe 블록마다 동일하게 복제된다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:350-353` (신규 추가분). 기존 동일 함수는 `:162-165` (`IdempotencyInterceptor (캐시 히트 · 응답 형태 방어)` describe) 에 이미 존재
  - 상세: 이번 PR 이 추가한 `describe('IdempotencyInterceptor (Redis 런타임 장애 fail-open)', ...)` 블록이 기존 `캐시 히트` describe 블록의 `bodyHashOf` 를 (import/공유 없이) 그대로 재선언한다. 두 정의는 문자 단위로 동일하다:
    ```ts
    const bodyHashOf = (body: unknown) =>
      createHash('sha256')
        .update(typeof body === 'string' ? body : JSON.stringify(body ?? null))
        .digest('hex');
    ```
    같은 파일 안에 `makeRedis`/`makeRedisConn`/`makeContext`/`makeCallHandler`/`makeInterceptor` 는 이미 모듈 최상위로 뽑아 여러 describe 가 공유하는 관례가 서 있는데, `bodyHashOf` 만 그 패턴을 따르지 않고 이번에 두 번째 복제본이 생겼다. 해시 알고리즘·직렬화 규칙이 바뀔 때 한쪽만 갱신되고 다른 쪽이 stale 해질 위험이 있다.
  - 제안: `bodyHashOf` 를 파일 최상단(모듈 스코프)으로 옮겨 두 describe 블록이 함께 참조하도록 통합한다.

- **[INFO]** Redis 캐시 실패 로그 포맷팅이 GET/SET 두 경로에서 중복된다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:100-105` (신규 `catchError` — GET 실패) vs `:167-173` (기존 `cacheTapped()` 내 `.catch()` — SET 실패, 이번 diff 로 직접 수정되진 않았으나 신규 코드가 같은 패턴을 한 번 더 만든다)
  - 상세: 두 자리 모두 `` `IdempotencyInterceptor cache ${OP} 실패 — fail-open: ${err instanceof Error ? err.message : String(err)}` `` 형태의 동일한 에러 메시지 조립 로직을 갖는다(`OP` 만 `GET`/`SET` 로 다름). 로그 포맷이나 `instanceof Error` 판별 로직을 바꿀 일이 생기면 두 자리를 모두 찾아 고쳐야 한다.
  - 제안: `private warnCacheFailure(op: 'GET' | 'SET', err: unknown): void` 같은 작은 private 메서드로 추출하면 두 호출부가 한 줄로 줄고 포맷 변경 시 단일 지점만 수정하면 된다. 다만 현재 2회 중복·각 3~4줄 수준이라 우선순위는 낮다.

- **[INFO]** 테스트 파일 최상단 docstring 이 신규 describe 블록을 언급하지 않는다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:1-14` (파일 헤더 docstring)
  - 상세: 헤더는 "아래 두 번째 describe 는 캐시 히트 경로와 응답 형태 방어…" 까지만 안내하고, 이번 PR 이 추가한 **세 번째** describe(`Redis 런타임 장애 fail-open`, `:349` 이하)는 언급이 없다. 세 번째 블록 자체에는 충분한 docstring(`:338-348`)이 있어 실질적 이해에는 지장이 없지만, 파일 전체를 훑는 목적의 헤더로서는 완전성이 한 칸 떨어진다.
  - 제안: 헤더에 "세 번째 describe 는 Redis 런타임 장애 fail-open(조회 reject) 을 검증" 한 줄만 추가하면 목록이 다시 완전해진다.

## 요약

이번 변경은 `IdempotencyInterceptor` 의 fail-open 보장이 생성자 시점 null 체크에만 걸려 있고 런타임 `get()` reject 경로는 빠져 있던 결함을 `catchError` 추가로 닫는 작은 diff다. 프로덕션 코드 변경은 RxJS 파이프라인에 연산자 하나를 정확한 위치(`switchMap` 앞)에 삽입하는 수준으로 작고 국소적이며, 그 위치가 왜 중요한지(뒤로 가면 `ConflictException` 까지 삼켜 멱등성 충돌 검출이 죽는다)를 코드 주석과 "catchError 위치 캐너리" 테스트로 함께 고정해 둔 점이 특히 좋다 — 향후 리팩터링이 실수로 순서를 바꿔도 테스트가 즉시 RED 로 알린다. 함수 길이·중첩 깊이·매직 넘버·순환 복잡도 측면에서 새로 유입된 문제는 없고, 기존 코드베이스의 명명·주석 스타일과도 일관된다. 다만 테스트 파일에서 `bodyHashOf` 헬퍼가 describe 블록마다 동일하게 복제되는 패턴이 이번 PR 로 한 번 더 반복됐고(WARNING), 인터셉터의 GET/SET 캐시 실패 로그 포맷도 소규모 중복이 있다(INFO). 둘 다 기능적 위험은 없는 순수 리팩터링 기회이며 이번 PR 의 스코프(런타임 fail-open 버그 수정)를 넘어서지 않는 후속 개선으로 처리해도 무방하다.

## 위험도

LOW
