# 동시성(Concurrency) 리뷰 — WS 토큰 만료 소켓 수명 종속 (`auth.token_expired`)

## 발견사항

- **[CRITICAL]** FE "정상 경로"(사전 통지 기반 재연결)가 Socket.IO `connect()` 의 no-op 가드에 막혀 실질적으로 동작하지 않는다 — 매 세션마다(15분 이상 유지되는 세션이면 100%) "끊김 없는 전환"이라는 설계 계약이 깨진다
  - 위치: `codebase/frontend/src/lib/websocket/ws-client.ts:87-102` (`refreshAndReconnect` 정의 + `socket.on("auth.token_expired", ...)` 핸들러)
  - 상세:
    서버는 만료 60초 전에 `auth.token_expired` 를 emit 하고(§1.2 lead time), 이 시점에 **소켓은 여전히 연결된 상태**다(그래야 사전 통지가 의미가 있다 — 이미 끊긴 뒤라면 통지가 아니라 사후 통보다). 이 시점에 `refreshAndReconnect("auth.token_expired")` 가 실행되어 `socket.auth.token = newToken` 후 `socket.connect()` 를 호출한다(라인 100-102).

    그런데 `socket.connect()` 는 Socket.IO 클라이언트 소스에서 다음과 같이 정의된다(실측 확인 — `node_modules/.pnpm/socket.io-client@4.8.3/node_modules/socket.io-client/build/cjs/socket.js:193-202`):
    ```js
    connect() {
        if (this.connected)
            return this;
        this.subEvents();
        if (!this.io["_reconnecting"])
            this.io.open();
        ...
    }
    ```
    즉 **소켓이 이미 `connected === true` 인 상태에서 `connect()` 를 호출하면 완전한 no-op** 이다. `auth.token_expired` 통지 시점엔 정의상 소켓이 아직 연결돼 있으므로, 라인 100-102 의 "정상 경로"는 `socket.auth.token` 만 갱신하고 실제 재연결은 **전혀 트리거하지 않는다**.

    실제 재연결은 60초 뒤 서버가 `exp` 시각에 `client.disconnect()` 를 호출해 `disconnect` 이벤트(reason `"io server disconnect"`)가 발화된 뒤에야, fallback 핸들러(라인 107-110)가 다시 `refreshAndReconnect` 를 실행해 그때는 `socket.connected === false` 이므로 실제로 `connect()` 가 동작한다.

    결과적으로:
    1. 라인 99 의 주석 "정상 경로 — 통지 창(60초) 안에 갈아탄다. **성공하면 끊김이 보이지 않는다**" 는 사실과 다르다. 현재 구현은 **항상** fallback 경로로만 재연결이 이뤄지므로, 토큰이 만료될 때마다(access token 수명 900초 기준 15분마다) 사용자는 실제 disconnect→reconnect 블립을 겪는다 — "정상 경로"가 의도한 무중단 전환은 구조적으로 발생하지 않는다.
    2. 이는 backend 쪽 `TOKEN_EXPIRY_LEAD_MS` 주석이 명시한 "**관측 가능한 계약이라 구현 자유도가 아니다**"(`codebase/backend/src/modules/websocket/websocket.gateway.ts:141`)와 정면으로 어긋난다 — lead time 이 존재하는 이유 자체(끊기기 전에 갈아타서 끊김을 안 보이게 함)가 FE 구현에서 실현되지 않는다.
    3. `auth.token_expired` 시점에 실행된 `refreshAccessToken()` 호출은 (connect() 가 no-op 이므로) 사실상 낭비이고, 60초 뒤 fallback 이 다시 `refreshAccessToken()` 을 호출한다 — 다행히 `codebase/frontend/src/lib/api/client.ts:85-92` 의 `refreshPromise` singleton 이 **동시에 겹치는** 호출만 de-dup 하지, 60초 간격을 둔 두 번의 순차 호출은 de-dup 하지 못하므로 REST 재발급이 매 만료 주기마다 불필요하게 2회 발생한다(기능은 깨지지 않지만 낭비이자 이 CRITICAL 의 부수 증상).
  - 제안: `refreshAndReconnect` 가 실제로 무중단 전환을 하려면, 아직 연결된 상태에서는 `connect()` 재호출이 아니라 **명시적으로 재연결을 유도하는 경로**(예: `socket.disconnect()` 후 `socket.connect()`, 또는 새 토큰으로 `io()` 인스턴스를 새로 만들어 기존 연결과 겹치게 붙였다가 스위치하는 방식)가 필요하다. 다만 전자는 결국 "보이는 끊김"을 만드므로 설계 자체를 재검토할 필요가 있다 — 최소한 주석과 spec §9.2 의 "끊김이 보이지 않는다" 서술을 실제 동작(=항상 fallback 경로로 짧은 blip 후 재연결)에 맞게 정정해야 한다.

- **[WARNING]** 위 CRITICAL 을 유닛 테스트가 잡지 못하는 이유 — mock 소켓이 `connect()` 의 `connected` 가드를 모델링하지 않고, 해당 테스트도 `connected` 상태를 discriminating 하게 세팅하지 않는다
  - 위치: `codebase/frontend/src/lib/websocket/__tests__/ws-client.test.ts:3-17` (`createMockSocket` — `connect: vi.fn()`, `connected: false` 로 초기화된 채 방치), `:150-160` (`"auth.token_expired 를 받으면 재발급 → auth.token 교체 → 명시적 connect"` 테스트)
  - 상세: `createMockSocket()` 의 `connect` 는 단순 `vi.fn()` 이라 호출 여부만 기록할 뿐, 실제 Socket.IO 의 "이미 connected 면 no-op" 의미론을 전혀 반영하지 않는다. 게다가 `auth.token_expired` 테스트는 `mockSocket.connected` 를 `true` 로 세팅하지 않은 채(기본값 `false`) 핸들러를 실행하므로, 설령 mock 이 `connected` 가드를 흉내 냈더라도 이 테스트는 여전히 통과했을 것이다 — 즉 이 테스트는 실제 프로덕션 시나리오(통지 시점엔 소켓이 **연결된 상태**)를 판별(discriminate)하지 못하는 입력을 쓴다. 같은 파일의 `"skips connect if already connected"`(라인 82-88) 테스트는 `mockSocket.connected = true` 를 세팅해 이 가드 자체는 알고 있음이 드러나는데, `auth.token_expired`/`disconnect` 시나리오에는 이 지식이 적용되지 않았다.
  - 제안: `auth.token_expired` 테스트는 `mockSocket.connected = true` 로 세팅한 뒤 "connect() 가 실질적 재연결을 일으키는지"(예: mock 을 실제 no-op 가드처럼 만들거나, `disconnect()`→`connect()` 시퀀스를 기대하도록)를 검증해야 위 CRITICAL 을 잡을 수 있다.

- **[INFO]** `auth.token_expired` 경로와 `disconnect`(fallback) 경로 사이에 명시적 재진입 가드가 없다 — 기존 `connect_error` 핸들러의 `refreshAttempted` 패턴과 비대칭
  - 위치: `codebase/frontend/src/lib/websocket/ws-client.ts:59-77`(`connect_error` 핸들러의 `refreshAttempted` 플래그) vs `:87-110`(`auth.token_expired`/`disconnect` 핸들러 — 가드 없음)
  - 상세: `refreshAccessToken()` 자체는 `client.ts` 의 `refreshPromise` singleton 이 **동시에 겹치는 호출**은 de-dup 하므로 두 핸들러가 아주 근접한 타이밍에 함께 발화해도 중복 REST 호출까지는 가지 않는다. 다만 세 경로(`connect_error`/`auth.token_expired`/`disconnect`)가 거의 동일한 "refresh → auth 교체 → connect()" 로직을 서로 다른 재진입 방어 수준으로 각각 구현하고 있어, 향후 `refreshAccessToken` 의 캐싱 정책이 바뀌면(예: dedup 제거) 조용히 레이스가 드러날 수 있는 구조다.
  - 제안: 세 핸들러의 refresh-and-reconnect 로직을 단일 helper 로 통합하고, 진행 중 플래그(예: `refreshAttempted` 와 유사한)로 방어를 명시적으로 통일하면 향후 리팩토링에도 안전하다.

- **[INFO]** backend `expiryTimers` Map 은 동일 `client.id` 로 `armExpiryTimers` 가 두 번 호출되면(정상 흐름에서는 발생하지 않음) 이전 타이머 참조가 유실되어 정리되지 않는다
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:170-210`(`armExpiryTimers`, 특히 `this.expiryTimers.set(client.id, timers)` 무조건 덮어쓰기)
  - 상세: 현재 게이트웨이 옵션(`@WebSocketGateway({cors, namespace: '/ws'})`)에 Socket.IO 의 `connectionStateRecovery` 가 설정돼 있지 않으므로, `handleConnection` 은 각 신규 연결마다 새 `client.id` 로 정확히 한 번만 호출되는 것이 정상 경로이며 이 경로에서는 문제가 재현되지 않는다. 다만 향후 connection state recovery 를 켜거나 같은 id 로 `handleConnection` 이 재호출되는 경로가 생기면, 이전 `notice`/`cutoff` 타이머가 `clearTimeout` 없이 Map 에서 유실돼(overwrite) 이미 끊긴/재사용된 소켓에 emit·disconnect 를 걸거나 타이머가 누수될 수 있다.
  - 제안: 방어적으로 `armExpiryTimers` 진입 시 `this.expiryTimers.get(client.id)` 를 먼저 clear 하고 진행하면(현재 `handleDisconnect` 가 하는 것과 동일한 정리를 `armExpiryTimers` 에도 선제 적용) 향후 재진입 경로가 생겨도 안전하다. 현재는 도달 불가 경로라 우선순위는 낮다.

## 요약

핵심 결함은 프론트엔드 `ws-client.ts` 의 "정상 경로"(사전 통지 기반 무중단 재연결)가 Socket.IO 클라이언트의 `connect()` no-op 가드(`if (this.connected) return this;`, 소스 레벨로 확인)에 막혀 구조적으로 동작하지 않는다는 점이다 — 통지 시점엔 소켓이 아직 연결돼 있으므로 `connect()` 호출이 아무 효과가 없고, 실제 재연결은 항상 60초 뒤 서버 강제 disconnect 이후의 fallback 경로에서만 일어난다. 이는 "성공하면 끊김이 보이지 않는다"는 코드 주석·spec §9.2 의도, 그리고 backend 의 "관측 가능한 계약" 주석과 정면으로 배치되며, 매 토큰 수명 주기(900초)마다 재현되는 결정적(deterministic) 결함이다. 이 결함은 mock 소켓이 `connected` 상태 가드를 반영하지 않고 테스트 fixture 도 `connected=true` 로 세팅하지 않아 유닛 테스트를 통과했다 — vacuous test 패턴. backend 의 타이머 arm/disarm(둘 다 해제) 로직 자체와 gateway 의 subscribe 원자성 처리(§07 concurrency 주석들)는 견고하며 별도 동시성 결함은 발견되지 않았다.

## 위험도

CRITICAL
