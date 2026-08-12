# 부작용(Side Effect) Review — EIA §R8 idempotency 캐시 스코프 (최종 라운드)

이번 diff 는 `IdempotencyInterceptor` 의 캐시 대상을 Spec EIA §R8 의 닫힌 목록(`2xx`·`409`·`410`)에
맞춘 버그 수정의 확정본이다(직전 두 라운드 `16_29_45`→CRITICAL 발견·`16_53_26`→WARNING 1건 발견
이 이미 이 코드베이스에서 해소된 상태). 나머지 다수 파일(`review/code/2026/08/12/16_29_45/**`,
`16_53_26/**`)은 그 두 라운드의 산출물을 그대로 커밋하는 정적 마크다운/JSON 기록이라 런타임 부작용은
없다. 아래는 실제 런타임 코드(`idempotency.interceptor.ts`, 그 스펙)에 대한 독립 재검토다.

## 발견사항

- **[WARNING]** 신규 `catchError` 캐시-적재 경로가 `JSON.stringify` 실패에 무방비 — 캐시 부작용이
  실패하면 **원래의 409/410 예외를 가리고 다른 에러로 대체**할 수 있다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:186-201`
    (`catchError` 블록), `:190-195`(`this.storeEntry(...)` 호출), `:206-225`(`storeEntry` 정의),
    `:215`(`responseJson: JSON.stringify(payload ?? null)`)
  - 상세: `catchError` 셀렉터 안에서 `this.storeEntry(redisKey, bodyHash, statusCode, err.getResponse())`
    를 **동기 호출**하고, 그 안의 `JSON.stringify(payload ?? null)`(`:215`)은 `try/catch` 로 감싸여
    있지 않다. RxJS 문서상 `catchError` 의 셀렉터 함수 자체가 throw 하면 **그 새 에러가 원래 에러를
    대체해 하류로 전파된다.** 즉 `payload`(= `err.getResponse()`)가 순환 참조·BigInt 등
    JSON-비직렬화 가능 값을 담고 있으면, `JSON.stringify` 가 던지는 `TypeError` 가 원래
    `ConflictException`(409)/`GoneException`(410) 을 **대체**해 클라이언트는 의도한 409/410 대신
    일반 500 을 받는다 — 게다가 `return throwError(() => err)`(`:200`) 는 실행되지 못하므로 이
    인터셉터가 "응답을 기록할 뿐 삼키지 않는다"(`:198-199` 주석)는 스스로의 불변식이 이 경로에서
    깨진다.
    현재는 `interaction.service.ts` 의 409/410 throw 지점(253·431·478·505행)이 전부
    `{ error: { code, message } }` 형태의 단순 plain object 만 넘기므로 즉시 트리거되는 살아있는
    버그는 아니다(실측: `interaction.service.ts` 4개 throw 지점 전수 확인). 다만 이 실패 형태는
    **Redis I/O 실패(`.set().catch()`, fail-open)와 달리 어떤 방어도 없다** — 같은 파일의 다른
    Unreleased CHANGELOG 항목("Redis 런타임 장애가 External Interaction API 를 500 으로 무너뜨리던
    결함 수정")이 정확히 이 형태(부수 경로 실패가 본 응답을 500 으로 왜곡)의 버그를 막 고친
    맥락이라, 같은 클래스의 새 표면을 이번 diff 가 무방비로 열어 둔 셈이다. `storeEntry` 는 2xx
    경로(`tap.next`)에서도 같은 무방비 패턴을 이미 갖고 있었지만(선재, 이번 diff 변경 아님), 409/410
    쪽 `catchError` 는 **이번 diff 가 신설한 표면**이라 새로 도입된 리스크다. 테스트 스위트에도
    비직렬화 payload 케이스는 0건이다(`grep -n "circular\|storeEntry" idempotency.interceptor.spec.ts`
    로 미검증 확인).
  - 제안: `storeEntry` 내부의 `JSON.stringify(payload ?? null)` 을 `try/catch` 로 감싸 실패 시
    (a) 캐시 적재만 skip 하고 (b) 호출자(`catchError`)는 원래 `err` 를 그대로 재throw 하도록
    분리한다. 최소한 이 함수가 "캐시 적재 실패는 항상 fail-open" 이라는, 클래스 상단 docstring이
    이미 명시한 불변식(`:59-63`)을 이 경로에서도 지키도록 방어를 추가할 것.

- **[INFO]** 새 `catchError` 표면이 인터셉터 자신이 던지는 `IDEMPOTENCY_KEY_CONFLICT`(같은 키 +
  다른 body, 409) 는 포착 범위 밖임을 확인 — 의도대로 정확히 스코프됨, 조치 불요.
  - 위치: `idempotency.interceptor.ts:122-129`(`throw new ConflictException(...)`, `next.handle()`
    호출 **이전**에 `switchMap` 콜백 안에서 던져짐) vs `:163-203`(`cacheTapped()` 는
    `next.handle()` 이 반환한 Observable 에만 파이프됨)
  - 상세: `.pipe(this.cacheTapped(...))` 가 감싸는 대상은 오직 `next.handle()`(다운스트림 서비스
    호출)뿐이라, 캐시 조회 직후 던지는 충돌 예외는 이 `catchError` 를 거치지 않는다. 새 `catchError`
    표면이 과잉 포착하지 않는지 재확인한 결과, 문제 없음.

- **[INFO]** 캐시-히트 재현 경로가 409/410 에 한해 "성공 채널 반환(`res.status()` + `of(...)`)"에서
  "예외 재throw(`throw new HttpException(...)`)"로 바뀐 것은 클라이언트가 관측 가능한 인터페이스
  변경이지만, CHANGELOG(`CHANGELOG.md:26-29`)가 이를 정확히 서술하고 `requestId` 는 재현 대상이
  아니라는 caveat 까지 명시했다 — 신규 리스크 아님, 문서-코드 정합 확인.
  - 위치: `idempotency.interceptor.ts:135-140`, `CHANGELOG.md:26-29`

- **[INFO]** `cacheTapped()` 의 반환 형태가 `tap({next})` 단일 오퍼레이터에서
  `(source) => source.pipe(tap(...), catchError(...))` 커스텀 오퍼레이터로 바뀌었으나, `private`
  메서드이고 호출부 2곳(`:120`, `:147`) 모두 이 diff 안에서 함께 갱신됐다. 공개 API
  (`intercept(context, next)`, 생성자)·전역 변수·환경 변수·파일시스템·외부 네트워크 호출에는
  변화가 없다.
  - 위치: `idempotency.interceptor.ts:163-203`(정의), `:120`·`:147`(호출부)

- **[INFO]** Redis `SET` 이 발생하는 지점이 `tap.next`(2xx)와 `catchError`(409/410) 두 곳으로 늘어난
  것은 이 PR 의 의도된 목적 그 자체이며, CHANGELOG·spec·plan·회귀 테스트(409/410/5xx/404/400/3xx
  6케이스)로 충분히 문서화·검증됐다. `storeEntry()` 로 단일화해 두 경로가 같은
  `IdempotencyEntry` 스키마를 쓰도록 만든 것도 스코프 드리프트 없이 안전한 리팩터다.
  - 위치: `idempotency.interceptor.ts:170-179`(2xx), `:186-201`(409/410), `:206-225`(공유 `storeEntry`)

## 요약

핵심 변경(캐시 적재를 `catchError` 로 확장하고 캐시-히트 시 409/410 을 예외로 재현)은 함수
시그니처·공개 인터페이스·전역 상태·환경 변수·파일시스템·외부 네트워크 호출 관점에서 안전하며,
새 `catchError` 표면이 인터셉터 자신의 409(`IDEMPOTENCY_KEY_CONFLICT`)를 과잉 포착하지도 않는다.
다만 이번 diff 가 신설한 `catchError` 캐시-적재 경로(`storeEntry` 안의
`JSON.stringify(payload ?? null)`, `:215`)는 실패 시 `try/catch` 없이 예외를 그대로 전파시켜, 원래
캐시하려던 409/410 도메인 예외를 대체해 버릴 수 있는 latent 실패 모드다. 현재 `interaction.service.ts`
가 넘기는 payload 는 전부 단순 plain object 라 즉시 트리거되지는 않지만, 같은 파일의 CHANGELOG 가
바로 옆에서 "부수 경로 실패가 본 응답을 500 으로 왜곡"하던 유사 결함을 막 고친 참이라 방치하기엔
아쉬운 비대칭 방어다. 그 외에는 모든 부작용(캐시 SET 빈도 증가, 응답 채널 변경, `requestId` 재발급)이
문서·테스트로 폭넓게 뒷받침된 의도된 변경이다.

## 위험도

LOW
