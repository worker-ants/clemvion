# 아키텍처(Architecture) 리뷰

## 검토 배경

본 diff 는 `auth.token_expired` (WS 소켓 수명 = 토큰 수명) 기능의 backend(`websocket.gateway.ts`, `websocket-events.types.ts`) + frontend(`ws-client.ts`) 구현이며, 이미 2 라운드 코드 리뷰(`review/code/2026/09/02/17_38_12/`, `18_18_53/`)를 거쳐 Critical 2건(무한 no-op `connect()`, typecheck ratchet 위반)과 Warning 다수(트리거 중복 통합, in-flight 가드 헬퍼 내재화)가 이미 조치·재검증된 상태다. 현재 소스를 직접 열어 그 조치들이 실제로 반영됐음을 확인했다 (`ws-client.ts` 의 `if (socket.connected) socket.disconnect(); socket.connect();`, `ws-client.test.ts` 의 `connect("old-token")` 호출 등). 아래는 그 위에서 새로 관찰한 아키텍처 관점 항목이다.

## 발견사항

- **[INFO]** 공유 wire 타입의 JSDoc 이 실제 소비자 구현보다 넓은 계약을 문서화하고 있다 (documented guarantee wider than built)
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.ts:293` (JSDoc: "클라이언트는 이 값으로 남은 창을 계산해 재발급 + 명시적 재연결을 수행한다") 대조 `codebase/frontend/src/lib/websocket/ws-client.ts:119-121` (`socket.on("auth.token_expired", () => { void refreshAndReconnect("auth.token_expired"); })`)
  - 상세: `AuthTokenExpiredPayload` 의 `expiresAt` 필드 JSDoc 은 프런트엔드가 "이 값으로 남은 창을 계산"해 재발급을 수행한다고 명시한다. 그러나 실제 핸들러는 이벤트 payload 자체를 인자로 받지 않는다 — `expiresAt`·`message` 어느 필드도 참조하지 않고, 이벤트 수신 즉시 무조건 `refreshAndReconnect()` 를 호출한다. `expiresAt`/`message` 는 저장소 전체에서 프로덕션 코드가 아니라 테스트 fixture(`ws-client.test.ts:161,199,239,254`)에만 등장한다. spec §1.2 의 클라이언트 계약("통지 창 안에 refresh+재연결")은 이 즉시-처리 구현으로 충족되므로 **기능 결함은 아니다** — 다만 이 wire-contract 코멘트는 클라이언트 쪽에 존재하지 않는 "남은 창 계산" 로직이 있다고 다음 독자에게 잘못 전달한다. `message` 필드도 UI 노출 지점이 전혀 없어(grep 결과 소비처 없음) 현재는 정의만 되고 소비되지 않는 필드다.
  - 제안: JSDoc 문구를 실제 동작("통지를 받으면 즉시 refresh+재연결하며 `expiresAt` 은 현재 사용하지 않는다")에 맞게 정정하거나, 반대로 클라이언트가 `expiresAt` 을 실제로 활용(예: 로깅·텔레메트리·남은 시간이 매우 짧을 때의 우선순위 조정)하도록 구현을 넓힌다. 계약 문서와 구현 중 하나를 좁혀 일치시키는 것이 목적이며 지금 당장 병합을 막을 사안은 아니다.

- **[INFO]** `WebsocketGateway` 의 소켓별-상태 책임 누적 — 1R 에서 이미 지적·평가·의도적 보류된 항목, 현재도 동일 상태로 확인됨
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:144-153`(`TOKEN_EXPIRY_LEAD_MS`, `expiryTimers` 필드), `:170-207`(`armExpiryTimers`)
  - 상세: 1R 아키텍처 리뷰(`review/code/2026/09/02/17_38_12/architecture.md` W8)가 이미 "만료 타이머 arm/disarm 을 `WsRateLimiterService` 와 대칭되는 별도 서비스로 추출"을 제안했고, 해당 라운드의 RESOLUTION 이 "타이머 로직이 30줄이고 gateway 생명주기 훅에 직접 붙는다 — 추출하면 arm/disarm 왕복이 생겨 오히려 누수 지점이 늘어난다"는 근거로 명시적으로 보류했다. 소스를 재확인한 결과 이 판단대로 여전히 gateway 클래스 필드로 남아 있다. 새로운 정보는 없다 — `subscriptions`/`wsRateLimiter`/`expiryTimers` 세 축의 소켓별 상태가 `handleConnection`/`handleDisconnect` 쌍에서 대칭적으로 arm/disarm 되는 기존 관례를 그대로 따르고 있어, 지금 시점에는 God-object 로의 악화라기보다 기존 패턴의 일관된 반복에 가깝다.
  - 제안: 추가 조치 불요 — 이미 평가·보류된 트레이드오프이며 이번 diff 가 그 경계를 새로 넘지 않았음을 확인차 기록한다. 다만 소켓별 상태 축이 **네 번째**로 늘어나는 다음 변경이 있다면 그때는 추출을 재검토할 시점이다.

- **[INFO]** frontend `createWsClient()` 의 `connect()` 클로저가 연결 수명 관리에 더해 인증-갱신 트리거 멀티플렉싱(3개 이벤트 → 1개 헬퍼)까지 흡수 — backend gateway 와 대칭적인 성장 축
  - 위치: `codebase/frontend/src/lib/websocket/ws-client.ts:59-86`(`refreshAndReconnect` 정의, in-flight 가드), `:99-129`(`connect_error`/`auth.token_expired`/`disconnect` 세 리스너)
  - 상세: 이번 변경으로 `connect()` 팩토리 함수 하나가 소켓 생성, 에러 로깅, (신규) 인증 재발급 정책(단일 in-flight 헬퍼 + 3개 트리거 라우팅), 연결 상태 플래그(`refreshAttempted`) 관리를 모두 클로저 하나에 담게 됐다. 지금 규모(트리거 3개)에서는 무리 없이 읽히고, 오히려 W1 통합으로 중복이 사라져 이전보다 개선됐다. 다만 이 성장 축은 backend 의 `armExpiryTimers`/`expiryTimers` 흡수와 동일한 성격이라, 향후 트리거가 하나 더 늘면(예: 클라이언트 자체 refresh 타이머) 팩토리 함수가 계속 넓어지는 방향으로 갈 가능성이 있다.
  - 제안: 지금은 조치 불요. 다음 트리거 추가 시점에 `refreshAndReconnect`+가드를 `createAuthRefreshCoordinator(getSocket, refreshAccessToken)` 류의 독립 모듈로 뽑는 것을 고려 — backend 쪽 `WsTokenExpiryService` 보류 결정과 같은 기준(지금 추출하면 왕복만 늘어난다)으로 지금은 보류가 맞다.

## 우수 사례 (참고)

- `AuthEventType`/`AuthTokenExpiredPayload` 신설은 기존 `ExecutionEventType`/`KbEventType` 처럼 도메인별로 이벤트 enum 을 분리하는 확립된 ISP 패턴을 그대로 따른다. `EXPECTED_EXPORTS` 완전성 목록에도 반영되어(§4.6 회귀 방지) 계약이 한 곳에서 깨지지 않는다.
- backend `armExpiryTimers`(arm)/`handleDisconnect`(disarm) 페어링은 `subscriptions`/`wsRateLimiter` 와 동일한 `Map<socketId, …>` 라이프사이클 관례를 재사용해 신규 추상화를 도입하지 않고 기존 패턴에 편승했다 — 낮은 진입 비용, 낮은 결합도.
- frontend `inFlight` Promise 캐시(`refreshAndReconnect`)는 표준적인 promise-memoization dedup 관용구를 정확히 구현했고(2R W2 재발 방지), 트리거가 아니라 헬퍼 안에 가드를 둬 향후 트리거 추가에도 자동으로 덮이도록 설계한 점이 확장성 관점에서 적절하다.
- backend↔frontend 간 순환 의존은 없다(`websocket-events.types.ts` → 단방향 소비, `api/client.ts` 는 websocket 모듈을 참조하지 않음을 직접 확인). frontend 는 backend enum 을 import 하지 않고 문자열 리터럴을 쓰는데, 이는 이 모듈의 기존 관례(다른 이벤트들도 동일)와 일치해 새로운 결합도 이슈가 아니다.

## 요약

핵심 아키텍처 결정 — 이벤트 타입을 도메인별 enum 으로 분리, gateway 의 `Map<socketId,…>` 기반 소켓별 상태 arm/disarm 대칭 패턴, 프런트 재연결 트리거의 단일 헬퍼 통합 — 은 모두 이 코드베이스의 기존 관례를 일관되게 따르며 SOLID·순환의존·레이어 경계 관점에서 새로운 CRITICAL/WARNING 급 결함은 발견되지 않았다. 1R 아키텍처 리뷰가 지적한 God-object 성장 우려는 이미 근거를 갖춰 의도적으로 보류된 상태이며 이번 diff 가 그 경계를 추가로 넘지 않았음을 재확인했다. 유일하게 새로 발견한 항목은 `AuthTokenExpiredPayload` 의 JSDoc 이 프런트 소비자가 `expiresAt` 으로 "남은 창을 계산"한다고 문서화했지만 실제 핸들러는 payload 를 전혀 읽지 않는다는 점으로, 기능적으로는 spec 계약(즉시 refresh+재연결)을 충족하므로 결함이 아니라 문서-구현 정합성 수준의 관찰이다.

## 위험도

LOW
