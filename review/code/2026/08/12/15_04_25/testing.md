# 테스트(Testing) 코드 리뷰 — EIA idempotency Redis 런타임 장애 fail-open fix

## 검증 방법 (직접 실행)

- `npx jest idempotency.interceptor.spec.ts --silent` 를 이 worktree 에서 직접 실행 —
  **16/16 통과** (기존 14 + `f933f2cf6` 라운드에서 추가된 신규 2건). 로그에도 `catchError`
  블록의 `IdempotencyInterceptor cache GET 실패 — fail-open: ...` warn 메시지가 3회
  출력되어(신규 fail-open 테스트 3건 중 warn 을 유발하는 경로) 그 분기가 실제로 실행됨을
  확인했다.
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` 를 직접
  열어 `catchError`(107행)가 `switchMap`(113행) **앞**에 위치함을 확인 — 두 차례 선행
  라운드(`14_27_02`, `14_50_36`)가 보고한 documentation 리뷰어의 "순서 역전" CRITICAL 은
  현재 소스에 재현되지 않는다(공유 worktree 뮤테이션 아티팩트였다는 기존 판정과 일치).
- 소스를 직접 뮤테이션해 재현하는 절차(`catchError` → `switchMap` 뒤로 이동, `.catch()`
  제거/무음화 등)는 **이번 라운드에서는 반복하지 않았다** — 같은 fix 의 캐너리를 여러
  세션이 동시에 뮤테이션-원복하다가 다른 리뷰어(`14_27_02` documentation)의 CRITICAL 오탐을
  만든 전례가 이미 이 세션 안에 있고(`review/code/2026/08/12/14_27_02/RESOLUTION.md`), 그
  주장은 이미 requirement/testing 리뷰어가 두 라운드에 걸쳐 독립적으로 재현·기록했다(`4건
  RED`, `.catch()` 제거/무음화 각각 `1 failed`). 정적 확인 + 실행 결과(16/16, 로그에 찍힌
  warn)로 충분하다고 판단했다.

## 발견사항

- **[INFO]** `get()` reject 시 fail-open 테스트가 `logger.warn` 호출을 단언하지 않는다 —
  같은 describe 안의 `set()` reject 테스트와 비대칭
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts`
    — `` it('`get()` 이 reject 해도 요청은 통과한다 (fail-open)', ...) `` (게이트
    355행 부근, `catchError` 도입 첫 테스트)
  - 상세: 같은 describe 블록의 `` it('`set()` 이 reject 해도 응답 정상 + warn 로그 ...') ``
    (게이트 418행)는 `jest.spyOn(Logger.prototype, 'warn')` 으로 `cache SET 실패` 문자열까지
    단언해 "조용히 삼키는" 뮤턴트를 잡도록 설계돼 있다(RESOLUTION.md 가 이 설계를 뮤테이션
    2형태로 실측 근거를 남겼다). 반면 `get()` reject 케이스(게이트 355행)와 비-Error reject
    케이스(게이트 453행)는 응답값만 단언하고 `catchError` 핸들러 안의
    `this.logger.warn(...)` 호출은 단언하지 않는다. 실제로 `catchError` 콜백에서
    `this.logger.warn(...)` 줄만 삭제하고 `return of(null);` 은 그대로 두는 뮤턴트를 만들면,
    응답·`redis.set` 호출·`bodyHash` 단언 전부 그대로 통과해 이 삭제를 잡을 테스트가 없다
    (직접 뮤테이션은 하지 않았고 코드 정독으로 판단 — 근거: `warnSpy`/`toHaveBeenCalledWith`
    가 이 describe 안에서 `set()` 테스트 1건에만 존재).
  - 제안: 낮은 우선순위. `get()` reject 테스트 중 하나에
    `jest.spyOn(Logger.prototype, 'warn').mockImplementation()` 을 추가해
    `cache GET 실패` 문자열 포함 여부를 단언하면 GET/SET 두 fail-open 경로의 관측 가능성
    (운영자가 warn 로그로 장애를 인지할 수 있다는 concurrency WARNING #1 의 전제)이 대칭적으로
    보장된다.

- **[INFO]** (선재, 이번 PR 이 새로 만든 갭 아님 — 재확인 목적으로만 기록)
  `readKey`/`hashBody` 경계값(키 길이 초과 `MAX_KEY_LENGTH=200`, 공백뿐인 키, non-string
  헤더)에 대한 단위 테스트가 여전히 없다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`
    — `readKey()` (189-194행), `hashBody()` (196-201행)
  - 상세: `plan/in-progress/backend-lint-gate-broken-on-main.md` 에 이미
    `testing INFO 10` 으로 등재돼 있고 이번 PR 스코프 밖으로 명시돼 있다. 새 결함이
    아니므로 조치를 요구하지 않되, 스코프 확인 차 재확인.
  - 제안: 조치 불요(이미 백로그 추적 중).

## Mock 적절성

- `RedisStub`(`{ get, set }` 두 `jest.fn()`)이 인터셉터가 실제로 호출하는 표면과 정확히
  일치한다 — ioredis 클라이언트 전체를 흉내 내지 않아 실제 동작과의 괴리가 낮다.
- `makeContext()` 의 `responseOverride` 로 `status`/`statusCode` 가 없는 응답 객체를 만들 수
  있어, 인터셉터의 `typeof res.status === 'function'` / `typeof res.statusCode === 'number'`
  방어(HttpResponseLike 가드)를 실제로 두 방향 모두 태울 수 있는 구조다.
- `jest.spyOn(Logger.prototype, 'warn')` 은 전역 prototype 패치이지만 `try/finally` 로
  즉시 `mockRestore()` 하므로 다른 테스트로의 누출이 없다 — 격리 양호.

## 테스트 격리

- 각 `it` 이 `makeRedis()`/`makeInterceptor()` 로 독립 mock·인스턴스를 새로 만들어 테스트 간
  공유 가변 상태가 없다. `beforeEach` 없이도 순서 의존성이 생기지 않는 구조.
- `bodyHashOf` 헬퍼는 이번 PR(`f933f2cf6`)에서 파일 최상단(게이트 93-97행)으로 통합되어
  기존 describe 블록과 신규 블록이 동일 정의를 공유한다 — 두 라운드 전 지적됐던 문자 단위
  중복(WARNING)이 실제로 해소됐음을 `grep -n "bodyHashOf"` 로 재확인(정의 1곳, 나머지는
  호출부).

## 회귀 테스트

- 기존 W-4 4건 + 캐시 히트/응답 형태 방어 7건은 이번 diff 로 로직이 바뀌지 않았고 16/16
  전체 실행 결과에서 모두 통과한다. `catchError` 를 `switchMap` 앞에 추가해도 정상 경로
  (캐시 히트/미스/충돌)의 RxJS 파이프라인 흐름은 바뀌지 않는다는 주장이 실행 결과와
  일치한다.
- "`catchError` 위치 캐너리"(게이트 393-416행)는 기존 409 충돌 테스트와 assertion 로직이
  거의 동일하지만, 그 중복이 의도적이고 로드베어링이라는 근거가 주석(394-397행)에 명시돼
  있다 — 두 차례 선행 라운드가 이 주장을 독립적으로(뮤테이션 4건 RED) 재현했으므로 이번
  라운드는 정적 확인 + 16/16 GREEN 으로 충분하다고 판단했다.

## 테스트 용이성

- `IdempotencyInterceptor` 생성자가 `injectedRedis` 를 `@Optional()` 로 노출해 DI 로 mock
  주입이 가능한 구조라, 이번 fail-open 시나리오(런타임 reject)를 추가 리팩터 없이
  테스트할 수 있었다 — `makeInterceptor(redis)` 헬퍼가 그 경로를 그대로 재사용한다.

## 종합 판단

3라운드째 같은 fix 를 검토하는 시점에서, 코드 자체의 결함은 이미 이전 두 라운드에서
전부 처리됐다(런타임 GET reject fail-open 구현·`catchError` 위치 캐너리·`set()` 실패
테스트·비-Error reject 테스트·`bodyHashOf` 중복 통합·헤더 docstring 갱신). 이번 라운드에서
직접 실행(16/16 GREEN)과 정적 재확인으로 그 처분들이 실제로 유효함을 재검증했고, 새로
발견한 것은 GET-fail-open 경로의 warn 로그 미검증(SET 경로와의 비대칭) 하나뿐이며 이는
INFO 수준으로 머지를 막을 사안이 아니다. `readKey`/`hashBody` 경계값 테스트 부재는
선재·스코프 밖으로 이미 추적 중이라 새로 카운트하지 않는다.

## 위험도

LOW
