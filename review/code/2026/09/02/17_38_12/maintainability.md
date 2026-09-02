# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** 토큰 갱신+재연결 로직이 사실상 동일한 코드로 두 군데(세 경로) 존재
  - 위치: `codebase/frontend/src/lib/websocket/ws-client.ts:63-77` (기존 `connect_error` 핸들러)
    vs `codebase/frontend/src/lib/websocket/ws-client.ts:87-97` (신설 `refreshAndReconnect`)
  - 상세: 신설된 `refreshAndReconnect` 헬퍼(`refreshAccessToken()` → `socket.auth.token` 교체 →
    `socket.connect()` → 실패 시 `console.error`)는 바로 위에 있는 기존 `connect_error` 핸들러의
    본문과 로직이 사실상 동일하다(로그 접두 문자열만 다름: `"[ws] Token refresh failed:"` vs
    `"[ws] Token refresh failed (${why}):"`). 이번 변경은 `auth.token_expired`·`disconnect`
    두 신규 경로에서는 새 헬퍼로 중복을 피했지만, 정작 이미 존재하던 `connect_error` 핸들러는
    통합 대상에서 빠져 파일 안에 "토큰 갱신 후 재연결"을 수행하는 거의 동일한 구현이 두 자리
    남았다. 다음에 재연결 로직(예: 백오프, 재시도 횟수 제한)을 바꿀 때 한쪽만 고치고 다른 쪽을
    놓치기 쉽다.
  - 제안: `connect_error` 핸들러 본문도 `refreshAndReconnect("connect_error")` 호출로 교체해
    구현을 하나로 모은다(`refreshAttempted` 가드는 호출부에 유지).

- **[INFO]** 소켓별 만료 타이머 쌍 타입 리터럴이 2곳에 그대로 중복
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:150-153`
    (클래스 필드 `expiryTimers` 선언) 및 `codebase/backend/src/modules/websocket/websocket.gateway.ts:192`
    (`armExpiryTimers` 지역 변수 `timers` 선언)
  - 상세: `{ notice?: NodeJS.Timeout; cutoff?: NodeJS.Timeout }` 형태가 두 곳에 문자 그대로
    반복된다. 필드가 하나만 늘어도 두 자리를 함께 고쳐야 한다.
  - 제안: `type ExpiryTimerPair = { notice?: NodeJS.Timeout; cutoff?: NodeJS.Timeout };` 로
    이름 붙여 두 자리에서 재사용.

- **[INFO]** 신규 wire 메시지 문자열이 파일 내 기존 컨벤션(상수화)과 다르게 인라인 리터럴로 존재
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` — `armExpiryTimers` 내부의
    `message: 'Access token expires soon — refresh and reconnect.'`
  - 상세: 같은 파일 상단에는 `MSG_NOT_AUTHENTICATED` / `MSG_NOT_AUTHORIZED_EXECUTION` 처럼
    "값은 명문 wire 문자열 — 변경 금지" 주석과 함께 모듈 스코프 상수로 뽑아 두는 확립된 관례가
    있다(라인 86-87 부근). 새로 추가된 `auth.token_expired` payload 의 `message` 는 이 관례를
    따르지 않고 함수 안에 그대로 남아 있다. 테스트가 `expect.any(String)` 으로만 검증하므로
    지금 당장 깨지진 않지만, 파일 스타일 일관성 관점에서 어긋난다.
  - 제안: 다른 wire 상수들과 나란히 `MSG_AUTH_TOKEN_EXPIRING` 류의 모듈 상수로 승격.

## 요약

변경분 전반이 이 코드베이스의 확립된 스타일(근거·범위 경계·기각 대안을 남기는 두꺼운 JSDoc,
`Map<socketId, …>` 형태의 소켓별 상태 관리, 헬퍼 분리, 명명된 상수)을 충실히 따르고 있고,
함수 길이·중첩 깊이·순환 복잡도 모두 무난한 수준이다(`armExpiryTimers`는 단일 책임의 ~40줄,
분기는 조기 반환 1개뿐). 유일하게 눈에 띄는 실질적 문제는 프론트엔드 `ws-client.ts` 에서
"토큰 갱신 후 명시적 재연결" 로직이 기존 `connect_error` 핸들러와 신설 `refreshAndReconnect`
사이에 사실상 중복된 채로 남은 것이며, 그 외에는 타입 리터럴 중복·wire 문자열 상수화 누락 등
경미한 개선 여지만 있다.

## 위험도

LOW
