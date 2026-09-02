# 아키텍처(Architecture) 리뷰

## 발견사항

- **[WARNING]** `ws-client.ts` 안에 "토큰 갱신 → `socket.auth.token` 교체 → `socket.connect()`" 로직이 두 곳에 거의 동일하게 중복
  - 위치: `codebase/frontend/src/lib/websocket/ws-client.ts:63-77` (`connect_error` 핸들러) 및 `:87-97` (신규 `refreshAndReconnect`)
  - 상세: `connect_error` 핸들러(기존 코드, §Carousel fix)와 이번에 추가된 `refreshAndReconnect`(§1.2/§9.2, `auth.token_expired`/`disconnect` 두 이벤트가 공유)가 `try { const newToken = await refreshAccessToken(); if (newToken && socket) { (socket.auth as {token:string}).token = newToken; socket.connect(); } } catch (...) { console.error(...) }` 몸통을 문자 그대로 복제하고 있다. 차이는 바깥 가드(`refreshAttempted` 플래그 유무)와 로그 문구뿐이다. "토큰 재발급→소켓 재연결" 이라는 단일 계약이 두 군데 독립 구현으로 흩어져 있어, 향후 이 절차(예: 재시도 횟수 제한, 백오프, 에러 분류 추가)가 바뀌면 한쪽만 고치고 다른 쪽을 누락하는 shotgun-surgery 위험이 있다. 실제로 이번 diff 시점에 이미 두 판박이 구현이 나란히 생겼다.
  - 제안: `refreshAndReconnect` 를 유일한 구현으로 삼고 `connect_error` 핸들러는 `if (refreshAttempted) return; refreshAttempted = true; void refreshAndReconnect("connect_error");` 형태로 위임하도록 정리한다. 세 트리거(`connect_error`, `auth.token_expired`, `disconnect: io server disconnect`)가 모두 같은 단일 헬퍼를 호출하게 하면 계약이 한 곳에만 존재한다.

- **[WARNING]** `WebsocketGateway` 가 소켓별 라이프사이클 상태(만료 타이머)를 계속 인라인으로 흡수하며 책임이 누적되는 추세
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:144-210` (`TOKEN_EXPIRY_LEAD_MS`, `expiryTimers` Map, `armExpiryTimers`)
  - 상세: 이 모듈은 이미 rate-limit 카운팅은 `WsRateLimiterService` 로, 채널 인가는 `ChannelAuthorizer[]` (OCP, refactor 02 M-7)로 별도 컴포넌트에 위임해 gateway 를 얇게 유지해 온 전례가 있다. 그런데 이번에 추가된 "소켓당 만료 타이머 arm/disarm" 은 같은 성격(소켓별 상태 소유·`handleConnection`/`handleDisconnect` 양쪽에서 생성·해제 필요)임에도 별도 서비스로 추출하지 않고 gateway 클래스 필드(`expiryTimers` Map)와 메서드(`armExpiryTimers`)로 직접 흡수했다. 결과적으로 `WebsocketGateway` 는 1075줄로 커지며 연결 인증, 구독 상태(`subscriptions` Map), rate-limit 트리거, 7종 메시지 핸들러, 이제는 만료 타이머까지 — 서로 다른 축의 소켓별 상태를 동시에 소유하는 God-object 경향이 강화된다.
  - 제안: 지금 당장 막을 결함은 아니지만, `WsRateLimiterService` 와 대칭되는 `WsTokenExpiryService`(arm/disarm/get 인터페이스)로 추출하는 편이 기존 패턴과 일관되고, 향후 namespace 가 늘거나(다중 gateway) 타이머 정책이 복잡해질 때 재사용·단위 테스트가 쉬워진다.

- **[INFO]** 타이머 Map 값 타입이 항상 함께 설정되는 두 필드를 optional 로 선언해 불변식이 타입에 드러나지 않음
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:150-153` (`expiryTimers` 필드 선언), `:192` (`armExpiryTimers` 내부 `timers` 지역 변수)
  - 상세: `armExpiryTimers` 안에서 `timers.notice`·`timers.cutoff` 는 항상 같은 실행 경로에서 함께 대입된 뒤 Map 에 저장된다(하나만 세팅되는 분기가 없음). 그런데도 타입은 `{ notice?: NodeJS.Timeout; cutoff?: NodeJS.Timeout }` 로 둘 다 optional 이라, "이 두 타이머는 항상 쌍으로 존재한다" 는 실제 불변식이 타입 시스템에 표현되지 않는다. `handleDisconnect` 의 `if (timers.notice) clearTimeout(...)` 같은 방어적 optional-check 도 실제로는 항상 참인 조건이라 코드가 그 사실을 숨긴다.
  - 제안: 값 타입을 `{ notice: NodeJS.Timeout; cutoff: NodeJS.Timeout }` (non-optional)로 좁혀 생성자에서 두 타이머를 한 번에 만들어 대입하면, 향후 "타이머 한쪽만 존재" 하는 상태가 생기는 회귀를 컴파일 타임에 차단할 수 있다. 지금은 동작에 영향 없는 표기 수준 이슈.

## 요약

`auth.token_expired` 기능은 backend(`WebsocketGateway`)와 frontend(`ws-client.ts`) 양쪽에 대칭적으로 배선되어 있고, 기존 관례(enum 기반 wire 이벤트 타입, `handleConnection`/`handleDisconnect` 쌍의 리소스 arm/disarm, rate-limiter 와 동일한 socket.id 키 Map 패턴)를 잘 따른다. SOLID·순환의존·레이어 경계 관점에서 치명적 결함은 없다. 다만 (1) frontend 의 "토큰 갱신→재연결" 로직이 두 트리거 경로에 중복 구현되어 있고, (2) backend gateway 가 이미 커진 상태에서 소켓별 상태 축(rate-limit·구독·이제 만료 타이머)을 계속 인라인으로 흡수하는 추세라 향후 확장 시 서비스 추출을 고려할 필요가 있다. 둘 다 지금 병합을 막을 사안은 아니며 유지보수성 관점의 개선 여지다.

## 위험도

LOW
