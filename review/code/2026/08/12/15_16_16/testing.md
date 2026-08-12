# 테스트(Testing) 리뷰 — IdempotencyInterceptor Redis 런타임 장애 fail-open (4라운드째, `15_16_16`)

## 검증 방법 (직접 실행)

같은 fix 를 검토하는 4번째 세션이라 프롬프트 서술을 그대로 받지 않고 현재 작업 트리 소스를
`Read` 로 직접 열어 재검증했다:

- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` — `catchError`
  107행 < `switchMap` 113행. 인라인 주석("위치 주의 — `switchMap` 앞이어야 한다")이 주장하는
  배치와 실제 소스가 일치한다.
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` — 세 번째
  `describe('IdempotencyInterceptor (Redis 런타임 장애 fail-open)', …)`(354-481행)에 테스트 5건
  확인: GET reject passthrough+warn(355-383) · GET reject → 캐시 미스 강등+적재(385-403) ·
  `catchError` 위치 캐너리(405-428) · SET reject passthrough+warn(430-463) · 비-Error reject
  (465-480).
- `npx jest idempotency.interceptor.spec.ts --silent` 을 이 worktree 에서 직접 실행 —
  **16/16 통과**. 로그에 `IdempotencyInterceptor cache GET 실패 — fail-open: ECONNRESET` /
  `... connection lost` 두 줄이 출력돼 `catchError` 분기와 `String(err)` else 분기가 실제로
  실행됨을 확인했다.
- `git status --porcelain` → 이 리뷰 세션 산출물 디렉터리 외 변경 없음(clean). 과거 라운드에서
  다른 sub-agent 의 뮤테이션 검증이 공유 워크트리를 오염시켜 `documentation` 리뷰어의 CRITICAL
  오탐(`catchError`/`switchMap` 순서 역전)을 만든 전례가 있어(`review/code/2026/08/12/14_27_02/
  RESOLUTION.md`), 소스를 재뮤테이션하지 않고 정적 확인 + 실행 결과로 판단했다.

## 발견사항

- **[INFO]** `get()` reject → 캐시 미스 강등 테스트가 저장된 엔트리 중 `bodyHash` 만 단언하고
  `responseJson`/`statusCode` 는 단언하지 않는다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:396-403`
    (``it('`get()` 이 reject 하면 캐시 미스로 취급해 새 응답을 적재한다', …)``)
  - 상세: 바로 위 "손상된 캐시 JSON" 테스트(259-289행)는 `bodyHash`·`statusCode`·`responseJson`
    세 필드를 모두 단언하는데, 이 테스트는 `bodyHash` 만 본다. 같은 `cacheTapped()` 경로를 타므로
    다른 테스트(291-316행)가 `statusCode`/`responseJson` 조립을 이미 커버해 기능 결함은 아니다.
    이전 라운드(`14_27_02` requirement INFO)에서 이미 지적·유예된 항목이고(`bodyHash` 가 핵심
    식별자라 충분하다는 판단), 이번 라운드에도 그대로 남아 있다 — 새로 생긴 갭은 아니다.
  - 제안: 조치 불요(선택 시 `stored.statusCode`/`stored.responseJson` 단언 추가 가능, 낮은 우선순위).

- **[INFO]** 비-`Error` reject 테스트가 `logger.warn` 호출 자체는 검증하지 않는다(응답만 단언)
  - 위치: `idempotency.interceptor.spec.ts:465-480`
    (``it('비-Error 값으로 reject 해도 로그 조립이 죽지 않는다', …)``)
  - 상세: 같은 describe 안의 GET reject 테스트(355-383)와 SET reject 테스트(430-463)는 둘 다
    `jest.spyOn(Logger.prototype, 'warn')` 로 로그 문자열까지 단언하는데, 이 테스트만 `Logger`
    를 mock 하지 않아 실제 `Logger.prototype.warn` 이 그대로 실행되며 콘솔에 로그가 찍힌다
    (`npx jest --silent` 실행 로그에서 `... connection lost` 로 확인). `err instanceof Error ?
    err.message : String(err)` 의 `else` 분기가 실제로 실행됨은 확인되지만, 조립된 문자열의
    정확성은 응답 성공 여부로만 간접 검증된다. `RESOLUTION.md`(`14_27_02` INFO 5)가 이미
    `String(err)` → `(err as Error).message.toUpperCase()` 뮤테이션으로 이 간접 검증이 실제로
    RED 를 내는 것을 실측 확인해 뒀으므로(비-Error 값에서 `.message` 접근 시 `undefined.
    toUpperCase()` 가 던져 응답 단언이 깨진다) 판별력은 있다 — 다만 GET/SET 두 케이스와 스타일이
    다르다는 점(warn spy 부재)은 일관성 관점의 사소한 비대칭으로 남는다.
  - 제안: 조치 불요. 여유가 되면 `warnSpy` 를 추가해 `String(err)` 결과값을 직접 단언하면 GET/SET
    두 케이스와 스타일이 대칭된다(낮은 우선순위, 판별력은 이미 확보됨).

- **[INFO]** (선재, 새 갭 아님) `readKey`/`hashBody` 경계값 단위 테스트 부재
  - 위치: `idempotency.interceptor.ts:189-194`(`readKey`), `:196-200`(`hashBody`)
  - 상세: 키 길이 초과(`MAX_KEY_LENGTH=200`), 공백뿐인 키, non-string 헤더에 대한 직접 테스트가
    여전히 없다. `plan/in-progress/backend-lint-gate-broken-on-main.md` 에 `testing INFO 10` 으로
    이미 등재돼 있고 이번 PR 스코프 밖으로 명시돼 있다. 새로 만든 갭이 아니므로 조치 불요, 재확인
    목적으로만 기록.
  - 제안: 조치 불요(백로그 추적 중).

- **[INFO]** fail-open 구간의 "동시 중복 요청" 결과(다운스트림 중복 실행)를 직접 재현하는 테스트가
  없다
  - 위치: `idempotency.interceptor.spec.ts:354-481`(신규 describe 전체)
  - 상세: concurrency 리뷰(WARNING, 3라운드 연속 지적·수용)가 짚은 "Redis 장애 지속 구간 동안
    동일 `Idempotency-Key` 로 온 두 요청이 둘 다 `next.handle()` 을 태운다"는 결과 자체를 직접
    재현하는 단위 테스트는 없다(개별 GET reject 테스트는 요청 1건씩만 검증). spec 이 승인한
    트레이드오프라 코드 변경이 필요 없다는 판정에는 동의하지만, 이 트레이드오프의 **동작**을
    회귀 고정하는 테스트(예: 동일 키로 `redis.get` 을 두 번 reject 시키고 두 응답 모두
    `next.handle()` 을 태웠는지 확인)가 있으면 향후 누군가 "in-flight dedup" 을 부분적으로
    구현하다 실수로 깨뜨리는 경우를 잡을 수 있다. 다만 이번 PR 의 목적(fail-closed → fail-open
    전환) 자체는 이미 충분히 테스트로 고정돼 있어 이 항목은 부가적 개선 여지다.
  - 제안: 조치 불요(이번 PR 스코프 밖). 백로그의 "in-flight dedup 검토" 항목이 실제로 구현될 때
    이 캐너리도 함께 추가하는 것을 권장.

## 회귀 테스트

- 기존 W-4(provider 경로) 4건 + 캐시 히트/응답 형태 방어 7건 + 신규 fail-open 5건 = 16/16 전체
  통과. `catchError` 를 `switchMap` 앞에 추가해도 정상 경로(캐시 히트/미스/충돌)의 RxJS 파이프라인
  흐름은 실측으로도 바뀌지 않았다.
- `catchError` 위치 캐너리(405-428행)는 기존 409 충돌 테스트(201-220행)와 assertion 로직이
  거의 동일하지만 로드베어링 근거가 인라인 주석(406-409행)에 명시돼 있고, 과거 두 라운드가
  독립적으로 위치를 뒤로 옮기는 뮤테이션으로 4건 RED 를 재현해 판별력을 실측 확인했다. 이번
  라운드는 재뮤테이션 없이 정적 확인 + 16/16 GREEN 으로 충분하다고 판단했다(공유 워크트리
  뮤테이션 오염 전례 때문에 재현을 반복하지 않음).

## Mock 적절성 · 테스트 격리

- `RedisStub` 은 `jest.fn()` 두 개(`get`/`set`)만 노출 — 인터셉터가 실제로 호출하는 표면과
  정확히 일치해 mock 과 실제 동작의 괴리가 낮다.
- `jest.spyOn(Logger.prototype, 'warn')` 은 전역 prototype patch 이지만 GET/SET 두 fail-open
  테스트 모두 `try/finally` 로 `mockRestore()` 하므로 다른 테스트로 누출되지 않는다(격리 양호).
  비-Error reject 테스트만 이 패턴을 안 써서 실제 로거가 콘솔에 출력되지만(위 발견사항 참조),
  다른 테스트 결과에 영향을 주는 오염은 아니다.
- 각 `it` 이 `makeRedis()`/`makeInterceptor()` 로 독립 mock·인스턴스를 새로 생성해 테스트 간
  공유 가변 상태가 없다. `bodyHashOf` 헬퍼가 모듈 최상단(94-97행)으로 통합돼 있어(이전 라운드
  WARNING 이 실제로 해소됨, `grep -n "bodyHashOf ="` → 정의 1곳) 세 describe 블록이 동일 정의를
  공유한다.

## 테스트 용이성

- `IdempotencyInterceptor` 생성자가 `injectedRedis` 를 `@Optional()` 로 노출해 DI 로 mock 주입이
  가능한 구조라, 이번 fail-open 시나리오(런타임 reject)도 추가 리팩터 없이 테스트할 수 있었다.

## 종합 판단

4라운드째 같은 diff 를 검토하는 시점이다. 직접 소스를 읽고(`catchError` 107행 < `switchMap`
113행 확인) 테스트를 실행(16/16 GREEN, GET/SET 양쪽 fail-open 경로의 warn 로그가 실제로 찍히는
것까지 확인)한 결과, 이전 라운드들(`14_27_02`→`14_50_36`→`15_04_25`)이 지적하고 조치한 사항 —
`bodyHashOf` 중복 통합, GET 경로 warn 비대칭 해소(SET 과 동일하게 `warnSpy` 단언 추가), 헤더
docstring 갱신 — 이 실제로 코드에 반영돼 있음을 독립적으로 재확인했다. 신규 CRITICAL/WARNING 급
테스트 갭은 발견되지 않았다. 남은 것은 전부 이미 알려졌거나(readKey/hashBody 경계값, GET→SET
비원자 구조) 이번 PR 스코프를 넘는 부가적 개선 여지(비-Error reject 케이스의 warn 직접 단언,
캐시 미스 저장 엔트리 전체 단언, 동시 중복 실행 시나리오 자체의 캐너리)뿐이며 전부 INFO 수준이다.

## 위험도

LOW
