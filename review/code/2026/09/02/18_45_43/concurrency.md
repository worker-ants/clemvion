# 동시성(Concurrency) 리뷰 — WS 토큰 만료 소켓 수명 종속 (`auth.token_expired`)

## 발견사항

- **[WARNING]** `ws-client.ts` — `connect()` 가 재호출되면, 이전 소켓 세대의 in-flight `refreshAndReconnect` 가 **공유된 외부 `socket` 변수**를 통해 새 소켓 세대를 건드리는 cross-generation race
  - 위치: `codebase/frontend/src/lib/websocket/ws-client.ts:20` (`let socket: Socket | null = null;` — `createWsClient()` 스코프의 단일 가변 변수), `:28`(`connect()` 재진입 가드 `if (socket && (socket.connected || socket.active))`), `:59-86`(`refreshAndReconnect` — `await refreshAccessToken()` 이후 `socket`·`socket.auth`·`socket.connected` 를 참조), `:126-129`(신규 fallback `socket.on("disconnect", …)` — `active=false` 로의 상태 전이를 유발하는 지점)
  - 상세:
    `socket` 은 `createWsClient()` 호출 시 **한 번** 선언되는 가변 변수이고, `connect()` 가 재호출될 때마다 재할당된다. 반면 `refreshAndReconnect`(및 그 안의 `socket.auth.token = …`, `socket.connected`, `socket.disconnect()/connect()` 참조)는 자신이 등록된 시점의 소켓 인스턴스를 스냅샷으로 캡처하지 않고, `await refreshAccessToken()` 이후에도 계속 **그 시점의 외부 `socket` 값**을 읽는다.

    이번 diff 가 추가한 fallback 경로(`disconnect` 이벤트, reason `"io server disconnect"`)는 socket.io-client 소스로 확인한 대로(`node_modules/.pnpm/socket.io-client@4.8.3/.../socket.js` `ondisconnect()` → `destroy()`가 `this.subs = undefined` 를 먼저 실행해 `active` 를 `false` 로 만든 뒤 `onclose()` 가 `connected = false` 로 만들고 `"disconnect"` 를 emit) **정확히 `connected === false && active === false`** 상태로 소켓을 전이시킨다. 바로 이 조건은 `connect()` 상단의 재진입 가드(`:28`)가 막지 못하는 유일한 창이다 — 즉 이 fallback 이 발화한 직후부터, 그 안에서 시작된 `refreshAndReconnect` 의 `await refreshAccessToken()` 이 끝날 때까지, **외부에서 `connect(token)` 이 다시 호출되면 가드를 통과해 새 소켓 인스턴스를 만든다.**

    이 시점에 이전 세대의 `refreshAndReconnect` 가 resolve 되면, 그 코드는 (자신이 시작된 소켓이 아니라) **현재 공유 변수가 가리키는 새 소켓**의 `.auth.token` 을 덮어쓰고, 새 소켓이 이미 연결에 성공했더라도 `if (socket.connected) socket.disconnect();` → `socket.connect();` 를 실행해 **방금 성공한 새 연결을 다시 끊고 재연결시킨다** — 이 PR 이 명시적으로 방지하려던 바로 그 "보이는 끊김"이 새 소켓 세대에서 재현된다.

    실제 애플리케이션에서 `connect()` 의 유일한 호출부는 `codebase/frontend/src/components/editor/workflow-editor.tsx:65-70` 인데, `useEffect(() => { … getWsClient().connect(token); }, [])` 에 **unmount cleanup 이 없다**. `getWsClient()` 는 모듈 싱글턴이라, 사용자가 다른 워크플로 에디터로 라우팅해 `WorkflowEditor` 가 재마운트되면 같은 `WsClient` 인스턴스에 `connect()` 가 다시 호출된다. 이 재마운트가 (a) 서버 강제 disconnect(§1.2 cutoff, 또는 다른 기기 로그아웃에 따른 세션 종료 — 프론트 문서 `password-and-sessions.mdx` 가 말하는 "최대 15분" 창)가 막 발생했고, (b) 그 fallback 의 REST 재발급이 아직 끝나지 않은 좁은 시간창(수십ms~네트워크 상태에 따라 수백ms 이상)과 겹치면 이 race 가 실제로 발화한다.

    **격리된 코드로 재현 확인**(저장소 밖 scratch 스크립트, `ws-client.ts` 의 실제 구조를 그대로 모사): 소켓A 가 강제 disconnect 되어 fallback refresh 가 진행 중인 상태에서 두 번째 `connect()` 호출로 소켓B 가 생성·연결에 성공한 뒤, 소켓A 용으로 시작됐던 refresh 가 resolve 되며 **소켓B 를 disconnect() 후 다시 connect()** 시키는 것을 확인했다:
    ```
    [socketA] connect() -> now connected
    [socketA] disconnect()
      refreshAndReconnect(io server disconnect) started on behalf of socketA
    --- second connect() call arrives while refresh is in flight ---
    [socketA] disconnect()
    [socketB] connect() -> now connected
      refreshAndReconnect(io server disconnect) resolved; outer socket is now [socketB] (started on [socketA])
    [socketB] disconnect()
    [socketB] connect() -> now connected
    ```
    (스크립트는 `private/tmp/.../scratchpad/race_repro.mjs` — 저장소 밖, repo 파일은 건드리지 않음.)

    이 패턴(외부 가변 `socket` 변수를 async 콜백이 스냅샷 없이 참조) 자체는 이번 diff 이전의 `connect_error` 핸들러에도 있었지만, `connect_error` 트리거 중에는 socket.io 의 자동 재연결이 `_reconnecting` 을 유지해 `active` 가 계속 `true` 로 남아 이 race 창이 사실상 열리지 않았다. 이번 diff 가 추가한 `disconnect`(`io server disconnect`) fallback 트리거는 **정상 운영 중 반복적으로(매 토큰 주기, 또는 세션 종료마다) `active=false` 전이를 발생시키는 유일한 경로**라서, 같은 아키텍처적 결함을 훨씬 더 자주 도달 가능한 상태로 만든다.

    영향은 데이터 손상·보안 침해는 아니고(스스로 재-connect 하므로 자가 치유), §9.2 가 명시한 "끊김이 보이지 않는다" 는 계약을 좁은 타이밍 창에서 다시 깨는 사용자 체감 blip 이다 — 이 PR 자체가 막으려 한 바로 그 증상이 다른 경로로 재현된다는 점에서 등급을 WARNING 으로 매긴다.

    **테스트가 이 창을 못 본다**: `codebase/frontend/src/lib/websocket/__tests__/ws-client.test.ts` 는 `vi.mock("socket.io-client", () => ({ io: vi.fn(() => mockSocket) }))` 로 **`io()` 를 몇 번 호출하든 항상 같은 `mockSocket` 객체**를 반환한다(`:19-23`, `:38-39`). 즉 현재 테스트 하네스는 "두 개의 서로 다른 소켓 인스턴스" 자체를 표현할 수 없어, 이 cross-generation staleness 는 구조적으로 검출 불가능하다.
  - 제안: `connect()` 내부에서 새 소켓을 만든 직후 `const mySocket = socket;` 로 로컬 스냅샷을 잡고, `refreshAndReconnect` 의 `await` 이후 모든 접근(`socket.auth`, `socket.connected`, `socket.disconnect()`, `socket.connect()`)을 `mySocket` 기준으로 하되 시작한다. 그리고 이어서 `if (socket !== mySocket) return;` (자신이 관여하던 소켓이 이미 교체됐으면 아무 것도 하지 않는다) 가드를 `await` 직후에 추가한다 — 이러면 오래된 세대의 refresh 가 새 세대를 건드리지 못한다. 테스트 쪽은 `io: vi.fn()` 이 매 호출마다 **다른** mock 객체를 반환하도록 바꿔야 이 클래스의 회귀를 잡을 수 있다.

- **[INFO]** (참고, 신규 아님) backend `armExpiryTimers` 는 같은 `client.id` 로 두 번째 호출되면 이전 타이머가 `clearTimeout` 없이 덮어써진다
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:170-210`(특히 `:209` `this.expiryTimers.set(client.id, timers)` 무조건 덮어쓰기)
  - 상세: 직전 라운드 concurrency 리뷰(`review/code/2026/09/02/17_38_12/concurrency.md`)가 이미 지적하고 저위험으로 판정한 항목과 동일하다 — 현재 `@WebSocketGateway` 옵션에 `connectionStateRecovery` 가 없고 `handleConnection` 은 신규 연결마다 새 `client.id` 로 정확히 한 번만 불리므로 지금은 도달 불가 경로다. RESOLUTION.md 의 조치 목록에도 포함되지 않아 여전히 미해결이지만, 우선순위는 낮다는 이전 판정에 동의한다. 재조치를 요구하지는 않는다.

## 요약

핵심 신규 로직(backend `armExpiryTimers`/`handleConnection`/`handleDisconnect` 의 타이머 arm·해제 쌍, frontend `refreshAndReconnect` 의 in-flight 중복 방지)은 각 소켓 생명주기 **내부**에서는 견고하다 — 이전 라운드가 지적한 두 CRITICAL(‘정상 경로’ no-op, 타입 회귀)과 W2(트리거별 무가드 재진입)는 RESOLUTION.md 대로 수정·테스트 확인됨을 코드에서 직접 검증했다. 다만 이번 라운드에서 새로 발견한 것은 소켓 생명주기를 **가로지르는** race 다 — `createWsClient()` 의 `socket` 변수가 단일 가변 참조로 공유되고, 새로 추가된 `disconnect("io server disconnect")` fallback 이 그 변수를 `connected=false && active=false` 상태로 전이시키는 유일한 반복 가능 경로라서, 그 상태에서 `connect()` 가 외부(예: `WorkflowEditor` 재마운트, cleanup 없음)에서 다시 호출되면 이전 세대의 in-flight 재발급이 새 세대의 소켓을 건드려 방금 성공한 연결을 다시 끊는다. 격리된 재현 스크립트로 이 흐름을 직접 확인했다. 테스트 하네스가 `io()` 호출마다 동일 mock 객체를 반환하는 구조라 이 클래스의 결함은 현재 회귀 방지망 밖에 있다.

## 위험도

MEDIUM
