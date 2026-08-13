# 테스트(Testing) 리뷰 — `IdempotencyInterceptor` 경계값 테스트 추가

대상: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts`,
`codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`,
`plan/in-progress/backend-lint-gate-broken-on-main.md`

검증 방법: 파일을 직접 읽고, `npx jest idempotency.interceptor.spec.ts` 로 54건 전량 통과를
1차 확인한 뒤, `isHttpStatusCode()` 의 하한 리터럴을 실제로 뮤테이션(`>= 100` → `>= 50`)해
테스트 스위트가 여전히 54/54 GREEN 인지 재확인(사살 후 원본 복구·`git diff` 로 clean 확인).
아울러 `헤더가 배열이면(중복 전송)` 테스트의 "express 는 중복 헤더를 string[] 로 준다" 주장을
실제 Node `http` 서버로 중복 헤더를 보내 검증했다.

## 발견사항

- **[WARNING]** `isHttpStatusCode()` 하한(100) 의 "바로 아래" 경계가 테스트되지 않아, 하한을
  넓히는 뮤테이션이 생존한다 (뮤테이션 실측으로 확인)
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:394-399`
    (`isHttpStatusCode`), 테스트: `idempotency.interceptor.spec.ts:1348-1389`(무효값 it.each: 음수·0·600·200.5),
    `idempotency.interceptor.spec.ts:1391-1425`(유효 경계값 it.each: 100·599)
  - 상세: 새로 추가된 "유효 범위 경계(%s)는 손상으로 보지 않는다" 테스트는 하한 100 과 상한 599
    를 유효로, 그리고 별도 it.each 에서 -1·0·600·200.5 를 무효로 고정한다. 그런데 하한 쪽은
    "바로 아래" 값(99)이 어느 케이스에도 없다 — 무효 케이스가 0 과 -1 로 100 에서 멀리 떨어져
    있다. 이 파일 자신이 `MAX_KEY_LENGTH` 경계에서 명시한 원칙("양쪽을 한 테스트에서 본다 — 한쪽만
    두면 `>=`/`>` 를 뒤집는 off-by-one 이 통과한다", L1223)이 상한(599 유효/600 무효, 정확히
    인접)에는 지켜졌지만 하한에는 지켜지지 않았다.
    직접 뮤테이션으로 확인: `(value as number) >= 100` 을 `(value as number) >= 50` 으로 바꿔도
    (statusCode 50~99 구간이 전부 "정상"으로 오판되도록 하한을 넓히는 뮤턴트) **54개 테스트가 전부
    그대로 통과**했다 — 이 자리를 지키는 뮤턴트가 없다는 뜻이다. (검증 후 원본으로 복구, `git diff`
    clean 확인.)
    실질 위험은 낮다 — 이 값은 사용자 입력이 아니라 인터셉터 자신이 이전에 캐시에 적재한 엔트리를
    되읽는 것이므로, 이 하한 경계가 실제로 넓게 잘못될 경로는 별도 버그가 선행해야 한다. 다만
    plan(`backend-lint-gate-broken-on-main.md:682-693`)이 "뮤턴트 10개 전부 사살(… statusCode
    하한/상한/정수 …)"이라고 기록한 것과 달리, 리터럴을 넓히는 유형의 뮤턴트는 이 스위트로 잡히지
    않는다.
  - 제안: `it.each` 의 무효 케이스에 `['하한 바로 아래(99)', 99]` 를 추가해 "100 유효 / 99 무효"
    인접 페어를 완성한다. 상한은 이미 599/600 페어가 있어 대칭이 맞다.

- **[WARNING]** "헤더가 배열이면(중복 전송)" 테스트의 근거 주석이 실제 Express/Node 동작과
  다르다 — 실측으로 반증됨
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:1280-1296`
  - 상세: 테스트 제목·주석이 "실제로 도달하는 경로다: 클라이언트가 `Idempotency-Key` 를 두 번
    보내면 express 가 배열을 넘긴다"고 명시하지만, 이 앱은 `main.ts:161` 에서
    `NestFactory.create(AppModule, …)` 를 FastifyAdapter 없이 호출해 기본 Express(=Node `http`)
    어댑터를 쓴다. Node `http` 모듈은 `set-cookie` 를 제외한 모든 헤더의 중복 값을 `", "` 로
    **조인한 단일 문자열**로 만든다(Node 문서, RFC 9110 §5.3). 실제로 로컬에서 raw socket 으로
    `Idempotency-Key` 를 두 번 보내 확인한 결과:
    ```
    headers.idempotency-key = "a, b"
    typeof = string
    isArray = false
    ```
    즉 실제 중복 헤더는 `typeof raw !== 'string'` 분기에 **닿지 않는다** — 대신 `"a, b"` 라는
    (trim 후 비지 않고 200자 이내인) **유효한 키**로 처리돼 캐시가 정상 적용된다. 테스트가
    수작업으로 주입한 `['a', 'b']` (진짜 배열)은 `IncomingHttpHeaders` 타입이 이론상 허용하는
    값(주로 `set-cookie` 전용)을 흉내 낸 것이지, 문서가 주장하는 "클라이언트가 헤더를 두 번 보내는"
    시나리오의 실제 산출물이 아니다. 코드의 `typeof` 방어 자체는 여전히 정당한 타입 방어이므로
    이 테스트를 지우라는 뜻은 아니지만, "실제로 도달하는 경로"라는 근거는 오도성이고, **실제로
    발생하는 시나리오(중복 헤더 → 조인된 문자열 키)는 어떤 테스트도 다루지 않는다** — 이 경로가
    의도한 대로 동작하는지(예: 조인된 문자열이 유효한 키로 받아들여지는 게 맞는 동작인지)는
    검증되지 않은 채 남는다.
  - 제안: 주석을 "이 분기는 `IncomingHttpHeaders` 타입이 허용하는 형태에 대한 방어이며, 실제
    Express 중복 헤더는 `", "` 로 조인돼 별도 분기(`readKey` 통과)를 탄다"로 정정하거나, 조인된
    문자열 케이스(`headers[IDEMPOTENCY_HEADER] = 'a, b'`)를 별도 테스트로 추가해 실제 발생
    경로도 함께 고정한다.

- **[INFO]** `makeContext` 의 `body` mock 정규화 수정은 회귀 없이 적용됨 (참고 확인)
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:127-131`
  - 상세: `opts.body ?? {}` → `'body' in opts ? opts.body : {}` 로 바뀌어 `body: undefined`/
    `body: null` 을 명시한 케이스가 실제로 그 값 그대로 인터셉터에 전달된다. `npx jest` 로 54건
    전량 통과를 확인했고, 이 변경이 기존 테스트(대부분 `body: {}` 를 명시하거나 아예 생략)의
    동작을 바꾸지 않음을 확인했다. 이 파일 스스로가 기록한 교훈("mock 이 만드는 상태 ≠ 시스템이
    실제로 만드는 상태")에 부합하는 수정이다. 조치 불필요, 기록 목적.

## 요약

`readKey`/`hashBody` 경계값을 메우는 13건의 신규 테스트와 `isHttpStatusCode()` 범위 검사는
전반적으로 견고하다 — `intercept()` 를 통한 호출부 테스트 원칙을 지키고, 키 길이 상한은 200/201
양쪽 인접 경계를 정확히 짝지었으며, `warnSpy` 는 전부 `try/finally` 로 격리돼 있고, 신규 테스트는
54/54 통과를 확인했다. 다만 같은 파일이 스스로 명시한 "양쪽 인접 경계를 함께 본다"는 원칙이
`isHttpStatusCode` 하한(100)에는 적용되지 않아 하한을 넓히는 뮤테이션이 생존함을 직접 뮤테이션
실험으로 확인했고(plan 이 "10개 전부 사살"이라 기록한 것과 부분적으로 어긋남), "중복 헤더 →
배열" 테스트는 실제 Express/Node 동작(콤마 조인 문자열)과 다른 전제를 근거로 들고 있어 실제
발생 경로는 여전히 미검증 상태임을 실측으로 확인했다. 둘 다 실무 위험은 낮지만(전자는 자기
생성 캐시 데이터, 후자는 코드 자체는 안전) 문서화된 완결성 주장과 실측 결과가 어긋나는 지점이므로
보완이 필요하다.

## 위험도
LOW
