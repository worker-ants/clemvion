# 테스트(Testing) 리뷰 — IdempotencyInterceptor Redis 런타임 장애 fail-open

## 검증 방법

리뷰 중 다음을 직접 실행해 주장을 검증했다(무수정 코드 추가 관측 아님, 실측):

- `npx jest idempotency.interceptor.spec.ts` — **14/14 통과**.
- plan 문서(`plan/in-progress/backend-lint-gate-broken-on-main.md`)가 주장하는
  "`catchError` 를 `switchMap` 뒤로 옮기면 4건 RED(신규 3 + 기존 409 테스트)"를
  실제로 소스를 뮤테이션해 재현 — **정확히 4건 RED**(신규 3건 전부 +
  `IdempotencyInterceptor (캐시 히트 · 응답 형태 방어) › 같은 key + 다른 body →
  409 IDEMPOTENCY_KEY_CONFLICT`)로 확인했다. 검증 후 `git checkout --` 로
  즉시 원복(이 worktree에 다른 미커밋 변경 없음을 `git status`로 먼저 확인).
  → 이 캐너리 테스트는 실제로 로드베어링이며 주석의 주장은 정확하다.

## 발견사항

- **[INFO]** docstring 이 주장하는 "세 경로 모두" 중 `set()` 적재 실패 경로가
  유닛 테스트로 직접 커버되지 않는다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:61-65`
    (클래스 docstring, "이 fail-open 은 **세 경로 모두**에 걸린다: 기동 시 미주입 ·
    조회 실패 · **적재 실패(`set()` reject → warn 후 통과)**")
  - 상세: 이번 diff 는 조회 실패(`get()` reject) 경로에 대한 테스트 2건과 위치
    캐너리 1건을 신설했다(`idempotency.interceptor.spec.ts:349-417`, describe
    `IdempotencyInterceptor (Redis 런타임 장애 fail-open)`). 그러나 `set()` 이
    reject 하는 경우(`cacheTapped()` 의 `.catch(err => logger.warn(...))`,
    interceptor.ts:167-173)를 만드는 테스트는 spec 파일 전체에 없다
    (`grep -n "set.mockRejectedValue" idempotency.interceptor.spec.ts` → 0건,
    직접 확인). `void this.redis.set(...).catch(...)` 가 fire-and-forget 이라
    요청 자체가 실패하지 않는다는 것은 코드 구조상 자명하지만, docstring 이
    "세 경로 모두" 를 명시적으로 주장하는 이상 그 경로도 테스트로 고정해 두는 것이
    문서-구현-테스트 일관성 관점에서 자연스럽다. 이 경로는 이번 diff 가 새로 만든
    것이 아니라 선재 코드(`35ff9c19b`, 2026-05-21)이므로 CRITICAL/WARNING 은 아니다.
  - 제안: `redis.set.mockRejectedValue(new Error('ECONNRESET'))` 로 SET 실패 시에도
    `intercept()` 의 결과가 정상 반환됨을 고정하는 테스트 1건 추가 검토(선택적,
    이번 PR 스코프 밖이어도 무방).

- **[INFO]** `catchError` 핸들러의 비-Error reject 분기(`String(err)`)가 테스트되지 않는다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:102`
    (`err instanceof Error ? err.message : String(err)`)
  - 상세: 신규 테스트 2건(`idempotency.interceptor.spec.ts:357`, `:375`) 모두
    `redis.get.mockRejectedValue(new Error('ECONNRESET'))` 로 `Error` 인스턴스만
    사용한다. ioredis 가 문자열이나 비-`Error` 값으로 reject 하는 경우는 실무에서
    드물지만, 삼항 분기가 소스에 명시적으로 존재하는 이상 그 분기를 지나가는 입력이
    하나도 없다 — mutation testing 관점에서 이 삼항의 `else` 가지는 죽은 코드로
    보일 수 있다.
  - 제안: 낮은 우선순위. `redis.get.mockRejectedValue('some-string')` 케이스 1건을
    추가하면 두 분기 모두 실행됨을 고정할 수 있다.

- **[INFO]** `bodyHashOf` 헬퍼가 파일 내 세 곳(`:162-165`, `:350-353`, 그리고
  W-4 describe 는 미사용)에서 동일하게 중복 정의된다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:350-353`
    (신규 describe 블록 로컬 정의) — `:162-165` 의 기존 정의와 완전히 동일.
  - 상세: 기능상 문제는 없으나(각 `describe` 스코프에 독립적으로 정의되어 격리에는
    영향 없음), 파일 최상단 공용 헬퍼로 옮기면 유지보수 시 두 곳을 동기화할 필요가
    없어진다.
  - 제안: 선택적 리팩터. 급하지 않음.

- **[INFO]** `fail-open 이 409 충돌까지 삼키지 않는다 — catchError 위치 캐너리`
  테스트가 기존 `같은 key + 다른 body → 409 IDEMPOTENCY_KEY_CONFLICT`
  (`:196-215`)와 assertion 로직이 사실상 동일하다(다른 것은 idempotency key
  값과 소속 describe 뿐).
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:393-416`
  - 상세: 의도된 중복이며 주석(`:394-397`)이 "이 테스트가 fix 의 설계를 고정한다"고
    명확히 근거를 남겨 두었다. 실측으로도 확인했듯 이 테스트는 로드베어링이라
    문제는 아니지만, 향후 리팩터 시 "중복이니 하나만 남기자"는 판단이 나올 수
    있어 주석의 존재가 특히 중요하다는 점만 기록해 둔다. 조치 불필요.

## 회귀·기존 테스트 유효성

- 기존 W-4(provider 경로) 4건 + 캐시 히트/응답 형태 방어 7건은 diff 로 변경되지
  않았고 실행 결과도 그대로 통과한다(총 14/14, 신규 3건 포함).
  `switchMap` 앞에 `catchError` 를 추가해도 정상 경로(캐시 히트/미스/충돌)의
  RxJS 파이프라인 동작은 바뀌지 않으므로 회귀 위험은 낮다 — 실측으로 확인됨.
- 신규 describe 블록의 `makeRedis()` / `makeInterceptor()` 재사용은 기존 W-4
  블록의 패턴을 그대로 따르고 있어 스타일 일관성이 좋다.

## Mock 적절성 · 테스트 격리

- `RedisStub` 은 `jest.fn()` 두 개(`get`/`set`)만 노출하는 최소 mock 으로,
  ioredis 클라이언트 전체를 흉내 내지 않아 실제 동작과의 괴리 위험이 낮다
  (인터셉터가 `get`/`set` 두 메서드만 호출하므로 mock 표면이 실제 사용 표면과
  일치).
  각 테스트가 `makeRedis()` 로 독립된 mock 인스턴스를 새로 만들어 테스트 간
  상태 공유가 없다 — 격리 양호.
- `catchError` 위치 캐너리 테스트는 `redis.get.mockResolvedValue(...)` (성공)로
  설정해 캐시 히트 경로를 태우는데, describe 이름("Redis 런타임 장애
  fail-open")과 달리 이 개별 테스트는 Redis 장애 시나리오가 아니다. 주석이
  이유를 명확히 설명하므로 오해 소지는 낮지만, describe 제목만 보면 살짝
  어긋나 보일 수 있다는 점을 참고로 남긴다(조치 불필요, INFO 이하).

## 테스트 용이성

- `catchError` 를 추가하기 전에도 `IdempotencyInterceptor` 는 생성자 주입
  (`injectedRedis`)으로 Redis mock 을 직접 교체할 수 있는 구조였고, 이번 diff 는
  그 기존 DI 경로를 그대로 활용해 새 실패 시나리오를 테스트했다 — 추가 리팩터
  없이 테스트 가능했다는 점에서 테스트 용이성이 양호함을 재확인.

## 요약

이번 diff 는 문서화된 "Redis 전 경로 fail-open" 요구와 실제 구현(생성자 시점
null 체크만 존재, 런타임 `get()` reject 는 미보호) 사이의 간극을 메우는
`catchError` 추가이며, 그에 대한 테스트 3건(fail-open passthrough·캐시 미스
강등·`switchMap` 앞 위치 고정 캐너리)이 신설되었다. 캐너리 테스트의 로드베어링
주장은 직접 뮤테이션으로 재현 검증했고(4건 RED, 원복 완료), 회귀·격리·mock
적절성 모두 양호하다. 남은 갭은 전부 INFO 수준(문서가 주장하는 "세 경로" 중
`set()` 실패 경로 미검증, non-Error reject 분기 미검증, 헬퍼 중복)이며 이번
PR 스코프를 넘어서는 선택적 개선 사항이다.

## 위험도

LOW
