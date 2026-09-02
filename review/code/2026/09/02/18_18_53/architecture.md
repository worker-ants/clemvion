# 아키텍처(Architecture) 리뷰

대상: WS `auth.token_expired` 사전 통지 + 소켓 만료 disconnect 구현 (파일 1~9). 나머지
`review/code/2026/09/02/17_38_12/**`·`review/consistency/**` 산출물(파일 10~44)은 이전 라운드의
프로세스 로그로, SOLID·결합도·레이어·순환의존 등 아키텍처 판단 대상인 애플리케이션 코드가
아니므로 이번 리뷰에서 제외한다.

## 이전 라운드(17_38_12) 대비 델타 확인

이번 diff 는 `review/code/2026/09/02/17_38_12/RESOLUTION.md` 가 기록한 조치 이후의 상태다.
실제 소스(`Read`)로 대조한 결과:

- **W1(중복 — 재발급+재연결 로직이 `connect_error` 와 신규 트리거 두 곳에 반복)은 해소됨.**
  `codebase/frontend/src/lib/websocket/ws-client.ts` 의 `connect_error` 핸들러(현재 87~92행)가
  `refreshAndReconnect("connect_error")` 를 호출하도록 위임돼, "재발급 → `auth.token` 교체 →
  재연결" 계약이 `refreshAndReconnect`(52~71행) 한 곳에만 존재한다. 세 트리거
  (`connect_error`·`auth.token_expired`·`disconnect: io server disconnect`)가 모두 같은 헬퍼를
  호출한다.
- **W8(God-object 추세 — `expiryTimers` 를 별도 서비스로 추출할지)은 리뷰어 스스로 "지금 당장
  결함은 아님" 으로 판단해 의도적으로 미조치 처리됐다** (RESOLUTION.md 참조, 추출 시 gateway
  훅과 서비스 사이 arm/disarm 왕복이 오히려 누수 지점을 늘린다는 근거). 이번 라운드에서 코드가
  더 이상 커지지 않았으므로 새로 재지적하지 않는다 — 이미 근거를 남기고 내려진 결정이다.
- **INFO(타이머 쌍 타입이 optional — 항상 함께 세팅되는 불변식이 타입에 드러나지 않음)은 여전히
  미조치**로 남아 있다(`websocket.gateway.ts` 현재 150~153행 `expiryTimers` 필드, 192행
  `armExpiryTimers` 지역 변수 `timers` 모두 `{ notice?: NodeJS.Timeout; cutoff?: NodeJS.Timeout }`
  그대로). 동작에 영향은 없고 지난 라운드와 동일한 관찰이라 INFO 로만 재기록한다.

## 발견사항

- **[INFO]** 타이머 쌍 optional 타입이 실제 불변식(항상 둘 다 존재)을 표현하지 않음 (전 라운드 이월, 미조치)
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:150-153` (`expiryTimers` 필드 선언),
    `:192` (`armExpiryTimers` 내부 `timers` 지역 변수 선언)
  - 상세: `armExpiryTimers` 는 `notice`·`cutoff` 를 항상 같은 실행 경로에서 함께 대입해 Map 에 저장한다
    (한쪽만 세팅되는 분기 없음). 그런데도 타입은 둘 다 optional 이라 "이 두 타이머는 항상 쌍" 이라는
    불변식이 컴파일 타임에 강제되지 않고, `handleDisconnect`(:287-290) 의 `if (timers.notice) …` 같은
    방어적 optional-check 이 실제로는 항상 참인 조건을 숨긴다.
  - 제안: `{ notice: NodeJS.Timeout; cutoff: NodeJS.Timeout }` 로 non-optional 화해 생성자에서 한 번에
    대입. 지금 당장의 결함은 아니며, 향후 "타이머 한쪽만 존재" 회귀를 타입으로 막고 싶을 때 반영.

- **[INFO]** `ws-client.ts` `connect()` 클로저가 초기화 + 3개 재연결 트리거(연결 실패·사전 통지·서버발신
  종료) 배선을 계속 흡수하는 추세
  - 위치: `codebase/frontend/src/lib/websocket/ws-client.ts:22-115` (`connect` 함수 전체)
  - 상세: 이번 변경으로 `connect()` 안에 `refreshAndReconnect` 헬퍼 정의(52-71행) + 3개
    `socket.on(...)` 트리거 배선(87-114행)이 모두 한 클로저에 누적됐다. 지금 규모(공유 헬퍼로
    중복은 이미 제거됨)에서는 문제가 아니지만, 향후 재연결 트리거가 더 늘어나면(예: 서버 유지보수
    공지, 레이트리밋 백오프) 이 함수가 계속 커지는 방향이다. 백엔드 쪽에서 이미 동일한 성격의
    확장 축(rate-limit·구독·만료 타이머)이 gateway 클래스에 인라인으로 누적되는 추세가 있었고
    (17_38_12 라운드 W8, 의도적 defer) 이 프론트 클로저도 같은 궤적을 밟고 있다는 점만 기록해 둔다.
  - 제안: 지금 조치 불요. 트리거가 하나 더 늘어나는 시점에는 `refreshAndReconnect` 를
    `createReconnectPolicy(socket, refreshAccessToken)` 류의 독립 모듈로 뽑아 `connect()` 는
    "어떤 이벤트가 재연결을 트리거하는가"만 나열하는 얇은 배선으로 남기는 편을 고려.

## SOLID·모듈 경계·순환 의존 점검 (이상 없음)

- **SRP/모듈 경계**: `AuthEventType`/`AuthTokenExpiredPayload` 는 `websocket-events.types.ts` 안에
  `ExecutionEventType`/`KbEventType` 과 같은 층위·같은 파일에 추가돼 기존 "wire 이벤트 타입 전용,
  로직 없음" 경계를 그대로 지킨다.
- **순환 의존**: `websocket-events.types.ts` 는 자체 스펙(`websocket-events.types.spec.ts`)이
  "의존성-프리(zero import)" 를 강제하는 파일이고, 이번 추가분(enum·interface)도 import 를 새로
  들이지 않아 그 불변식을 유지한다. `websocket.gateway.ts` → `websocket-events.types.ts` 단방향
  import 만 있고 역방향은 없다 — 순환 없음.
- **DIP/레이어 책임**: `armExpiryTimers` 는 connection-lifecycle 을 다루는 NestJS Gateway(프레젠테이션/
  프로토콜 레이어) 안에 남아 있고, 인가 판단(JWT 검증)이나 비즈니스 로직을 침범하지 않는다 — 기존
  `WsRateLimiterService`(별도 서비스로 분리된 관심사)와 대비하면 결합도가 살짝 높지만, 이는 이미
  전 라운드에서 지적·검토·의도적 defer 된 사안이라 재차 WARNING 으로 올리지 않는다.
- **개방-폐쇄**: 신규 이벤트 추가가 기존 `KNOWN_WS_EVENTS` 화이트리스트(인바운드 전용)를 건드리지
  않은 판단은 올바르다 — `auth.token_expired` 는 서버 emit-only 이므로 인바운드 검증 표면을
  넓히지 않는다.

## 요약

이 diff 는 이전 리뷰 라운드에서 아키텍처 관점 WARNING 으로 지적된 프론트엔드 재연결 로직 중복을
실제로 해소했음을 소스 대조로 확인했다(`refreshAndReconnect` 단일화). 백엔드 gateway 의 책임 누적
추세(WARNING)는 근거를 남기고 의도적으로 defer 된 상태이며 이번 라운드에서 더 나빠지지 않았다.
SOLID·레이어 분리·순환 의존·모듈 경계 모두 기존 확립된 패턴(이벤트 enum 카탈로그·소켓별 상태
Map·arm/disarm 쌍)을 일관되게 따르고 있어 구조적으로 안전하다. 남은 것은 두 건의 INFO — 타이머
쌍 타입의 optional 완화 미반영(전 라운드 이월)과, 프론트 `connect()` 클로저가 재연결 트리거를
계속 흡수하는 추세에 대한 조기 관찰 — 둘 다 지금 병합을 막을 사안이 아니다.

## 위험도

LOW
