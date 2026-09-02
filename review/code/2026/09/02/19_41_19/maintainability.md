# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `createWsClient()` 안의 `connect()` 가 4개의 중첩 클로저(가드 → 소켓 생성 →
  `refreshAndReconnect`(그 안에 다시 `run` async IIFE) → 3개 이벤트 핸들러 등록)를 한 함수
  안에 계속 흡수하며 123줄까지 커졌다
  - 위치: `codebase/frontend/src/lib/websocket/ws-client.ts:22-144` (`connect` 함수 전체),
    특히 `:60-98` (`refreshAndReconnect` 및 내부 `run` async IIFE)
  - 상세: 실행문 자체(주석 제외)는 ~70줄 수준이고 분기도 대부분 조기 반환 1개짜리라 순환
    복잡도는 낮지만, 함수 하나가 (1) 재진입 가드, (2) `io()` 소켓 생성, (3) 토큰 재발급+
    재연결 공통 헬퍼 정의, (4) `connect_error`/`auth.token_expired`/`disconnect` 세 이벤트
    핸들러 등록까지 네 가지 책임을 모두 떠안고 있다. `refreshAndReconnect` 는 `connect()`
    의 지역 클로저라 다른 어디서도 재사용·단위 테스트 대상으로 분리할 수 없고, `mySocket`
    스냅샷·세대 비교 로직(`:64-68`, `:73-74`)이 그 안에 한 단 더 중첩돼 있어 전체 중첩
    깊이가 `connect → refreshAndReconnect → run(IIFE) → try → if` 로 4~5단에 이른다.
    지난 4라운드 리뷰가 `refreshAndReconnect` 자체(25~35줄, try/catch 1단)는 반복해서
    "무난하다" 고 판정했지만, 그 판정은 매번 헬퍼 하나만 떼어서 본 것이고 이를 감싸는
    `connect()` 전체의 길이·책임 누적은 별도로 다뤄진 적이 없다.
  - 제안: 지금 당장 결함은 아니다. 다만 다음에 이 파일을 다시 만질 때는
    `refreshAndReconnect` 를 `connect()` 바깥의 모듈 스코프 팩토리(`getSocket`/`setSocket`
    접근자를 인자로 받는 형태)로 승격해, `connect()` 는 "소켓 생성 + 핸들러 배선"만
    남기고 재발급 로직은 독립적으로 단위 테스트할 수 있게 하는 편을 고려할 만하다.

- **[INFO]** `ws-client.test.ts` 신규 `describe` 블록에서 동일한 타입 캐스팅·페이로드
  리터럴이 문자 그대로 6회 반복
  - 위치: `codebase/frontend/src/lib/websocket/__tests__/ws-client.test.ts:159,161,198-199,
    237,239,252,254,269,271,299-300` — 전부
    ``(handlerFor("auth.token_expired") as (a: unknown) => Promise<void>)({ message: ...,
    expiresAt: new Date().toISOString() })`` 형태
  - 상세: `handlerFor` 헬퍼가 이미 존재하는데도, 그 반환값을 실제로 호출하려면 매 테스트마다
    동일한 `as (a: unknown) => Promise<void>` 캐스팅과 `{ message, expiresAt: new
    Date().toISOString() }` 페이로드 리터럴을 새로 써야 한다. 시그니처가 바뀌면(예: payload
    필드 추가) 6곳을 함께 고쳐야 하는 반복이다. 다만 각 테스트는 서로 독립적이고 production
    코드 변경 위험은 없어 심각도는 낮다.
  - 제안: `fireTokenExpired(payload?: Partial<AuthTokenExpiredPayload>)` 같은 로컬 헬퍼로
    캐스팅+기본 페이로드 생성을 한 곳에 모으면 반복이 사라지고 개별 테스트는 차이점(override
    되는 필드)만 남길 수 있다.

- **[INFO]** 백엔드 신규 테스트에서 `900`(access token TTL 초)·`60`(lead time 초)이 이름
  없는 리터럴로 7회 이상 반복
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts:717(주석),
    745,747,758,768,770,774,780,784` (전부 `describe('토큰 만료 — 사전 통지 후 disconnect
    (§1.2)')` 블록 안)
  - 상세: `connectWithExp('client-exp', 900)`, `(900 - 60) * 1000 - 1`, `900 * 1000 - 1`
    등 프로덕션 상수(`WebsocketGateway.TOKEN_EXPIRY_LEAD_MS = 60_000`)와 access token TTL
    (900초)을 나타내는 값이 매번 리터럴로 다시 등장한다. `TOKEN_EXPIRY_LEAD_MS` 가 `private
    static` 라 테스트에서 직접 참조할 수 없다는 사정은 이해되지만, 로컬 상수
    (`const ACCESS_TOKEN_TTL_S = 900; const LEAD_S = 60;`)로 한 번만 이름 붙이면 두 값의
    의미가 코드에서 바로 드러나고, lead time 이 향후 바뀔 때 고칠 자리가 한 곳으로 줄어든다.
    각 줄에 주석이 붙어 있어 지금 당장 오독 위험은 낮다.
  - 제안: `describe` 블록 상단에 두 상수를 선언하고 리터럴을 치환.

- **[INFO]** `expiryTimers` 값 타입이 여전히 `{ notice?: NodeJS.Timeout; cutoff?:
  NodeJS.Timeout }` 로 두 필드 모두 optional — "항상 쌍으로 존재" 불변식이 타입에 없음
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:91-94` (필드 선언),
    `:133` (`armExpiryTimers` 내부 `timers` 지역 변수)
  - 상세: 이 항목은 1라운드(`review/code/2026/09/02/17_38_12/maintainability.md`)와
    architecture.md 에서 이미 지적됐고 "동작 영향 없는 표기 수준" 으로 명시적으로 보류된
    사안이 이번 diff 에도 그대로 남아 있다. 새로운 위험은 아니며 재확인 차원의 기록.
  - 제안: 기존 제안(non-optional 타입 + 생성자에서 한 번에 대입) 유지. 착수 우선순위 낮음.

## 요약

이번 diff 는 5라운드째 반복 리뷰를 거친 `auth.token_expired` 기능의 문서·테스트·plan
정리 단계로, production 코드(`websocket.gateway.ts`, `ws-client.ts`)는 이전 라운드에서
지적된 실질적 결함(연결 상태 갱신 로직 중복, 재진입 가드 누락, 세대 비교 누락)이 모두
반영된 상태다. 특히 1라운드 architecture/maintainability 가 지적한 "`connect_error` 핸들러
vs `refreshAndReconnect` 중복" 은 `connect_error` 가 공통 헬퍼로 위임하도록 통합돼 그대로
해소되어 있다. 신규로 확인한 것은 전부 INFO 수준이다 — `connect()` 함수가 여러 클로저를
계속 흡수하며 길어진 점(추출 여지는 있으나 지금 복잡도·중첩은 낮음), 프론트 테스트의 반복
캐스팅+페이로드 리터럴, 백엔드 테스트의 이름 없는 시간 상수(900/60) 반복, 그리고 이미
1라운드에서 보류 결정된 타이머 페어 optional 타입 잔존. 네이밍(`AuthEventType`,
`TOKEN_EXPIRY_LEAD_MS`, `armExpiryTimers`, `refreshAndReconnect`)과 주석 스타일(근거·
기각 대안·범위 경계를 남기는 두꺼운 JSDoc)은 코드베이스 기존 컨벤션을 일관되게 따른다.
CHANGELOG·plan 트래커(`spec-draft-ws-socket-lifetime-binds-token.md`,
`ws-token-expired-socket-lifetime-impl.md`)·이전 라운드 `review/**` 산출물은 코드가
아닌 프로세스 기록이라 전통적 유지보수성 지표(함수 길이·중첩·매직넘버 등) 적용 대상이
아니며 특이사항 없음. 병합을 막을 사안은 없다.

## 위험도

LOW
