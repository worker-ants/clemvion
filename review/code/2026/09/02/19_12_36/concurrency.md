# 동시성(Concurrency) 리뷰 — WS 토큰 만료 소켓 수명 종속 (`auth.token_expired`) 후속 라운드

이전 라운드(`review/code/2026/09/02/17_38_12/`)에서 지적된 **CRITICAL**(사전 통지 시점 "정상 경로"가 이미
연결된 소켓에서 `socket.connect()` no-op 에 막혀 실질적으로 동작하지 않던 결함)은 이번 diff 에서 해소됐다.
`codebase/frontend/src/lib/websocket/ws-client.ts` 의 `refreshAndReconnect` 가
`if (mySocket.connected) mySocket.disconnect();` 를 앞세운 뒤 `mySocket.connect()` 를 호출하도록 바뀌었고,
호출 순서(`disconnect` → `connect`)까지 테스트로 단언한다. 아래는 이번 라운드 diff 를 대상으로 한 재검토다.

## 발견사항

- **[INFO]** `connect()`/`disconnect()` 가 이전 세대 소켓의 이벤트 리스너를 명시적으로 해제하지 않는다 —
  방어적 정리가 없어 향후 리팩토링 시 stale 리스너가 신규 세대에 영향을 줄 여지가 남는다
  - 위치: `codebase/frontend/src/lib/websocket/ws-client.ts:29-44` (`connect()` 내부, `if (socket) { socket.disconnect(); }` 후 `socket = io(...)` 재대입) 및 `:147-152` (`disconnect()`)
  - 상세: `refreshAndReconnect`(`:61-98`)는 진입 시점에 `mySocket = socket`(공유 클로저 변수의 **그 시점 값**)을 스냅샷하고, `await` 이후 `socket !== mySocket` 로 세대 교체를 판별한다 — 이 패턴 자체는 견고하고 전용 테스트(`옛 세대의 재발급은 새 소켓을 건드리지 않는다`, `ws-client.test.ts:287-321`)로 검증돼 있다. 다만 이 판별이 성립하는 전제는 "이벤트 핸들러는 자신이 등록된 그 소켓 인스턴스에서만, 세대 교체 이전(동일 동기 턴)에 발화한다"는 것인데, 현재 `connect()`/`disconnect()` 어디에서도 교체·폐기되는 이전 소켓에 `off()`/`removeAllListeners()` 를 호출하지 않는다. 지금은 `connect()`(`:29-31`)의 `if (socket && (socket.connected || socket.active)) return;` 가드와 `reconnectionAttempts: Infinity` 설정 때문에, 이전 소켓이 아직 connected/active 상태이면 애초에 교체가 일어나지 않고, 교체가 일어나는 경우는 이전 소켓이 이미 명시적으로 `.disconnect()` 된 뒤뿐이라 socket.io-client 내부적으로 추가 이벤트(`connect_error`, `auth.token_expired`, 서버발신 `disconnect`)가 그 이후에 발화할 여지가 낮다. 그러나 이는 socket.io-client 내부 동작(교체 이후엔 이벤트가 안 온다)에 대한 **암묵적 의존**이지, 코드가 그 자체로 보장하는 불변식이 아니다 — 만약 이전 소켓이 진짜로 교체 이후 지연 이벤트를 낸다면, 그 핸들러(옛 세대 클로저)는 `mySocket = socket` 에서 **공유 변수의 현재 값(=새 세대 소켓)**을 읽어 옛 세대가 아니라 **새 세대 소켓을 대상으로** disconnect/connect 를 실행하는 경로가 열린다(세대 비교는 "옛 세대가 스스로를 되살리는 것"은 막지만, "옛 소켓의 리스너가 현재 소켓을 오조작하는 것"까지는 막지 않는다).
  - 제안: `connect()`(교체 직전)와 `disconnect()` 양쪽에서, 폐기되는 소켓 인스턴스에 `oldSocket.removeAllListeners()` 를 호출해 이 암묵적 전제를 코드 수준의 명시적 보장으로 바꾼다. 지금 당장 재현 가능한 결함은 아니며, 이미 3라운드에 걸친 동시성 전용 뮤테이션 테스트(`RESOLUTION.md` — cutoff/exp/reason 가드 제거 RED)로 핵심 race 는 방어돼 있어 위험도는 낮다.

- **[INFO]** `armExpiryTimers` 의 `setTimeout` 지연값에 대한 Node.js 32-bit 상한(`2^31-1`ms ≈ 24.8일) 방어가 없다 — 현재는 도달 불가 경로
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:170-210` (`armExpiryTimers`, 특히 `:193`·`:201-207` 의 `setTimeout(..., untilNotice)`/`setTimeout(..., Math.max(0, untilCutoff))`)
  - 상세: Node.js 의 `setTimeout`/`setInterval` 은 지연값이 32-bit signed integer 범위(`2147483647`ms)를 초과하면 오버플로되어 **즉시 발화**한다(공식 문서화된 동작). `armExpiryTimers` 는 JWT `exp` 클레임으로부터 산출한 `untilCutoff`/`untilNotice` 를 그대로 `setTimeout` 에 넘기며 상한 clamp 가 없다. access token 수명이 spec 상 900초(15분)로 고정돼 있어 **현재 경로에서는 도달 불가**하지만, 만약 향후 어떤 발급 경로가 24.8일을 넘는 `exp` 를 가진 토큰을 이 gateway 로 흘려보내면(예: 서비스 계정 토큰 재사용, 설정 실수) 해당 소켓은 정상적인 만료 시각이 아니라 **연결 직후 즉시** 사전 통지·강제 종료를 당한다 — "관측 가능한 계약"이라고 명시한 라인 141 의 의도와 어긋나는 조용한 오동작이다.
  - 제안: `armExpiryTimers` 진입부에 `MAX_SETTIMEOUT_MS = 2_147_483_647` 상한을 clamp 하거나(예: 그 이상이면 타이머를 걸지 않고 재검증을 다음 통신 계기로 미룸), 최소한 그런 `exp` 가 이 gateway 에 도달하지 않는다는 전제를 주석으로 명시. 지금은 발생 조건이 없어 우선순위는 낮다.

- **[INFO]** (이전 라운드 INFO#11 재확인, 여전히 미해소 — 도달 불가 경로) `expiryTimers` Map 은 동일 `client.id` 로 `armExpiryTimers` 가 두 번 호출되면 이전 타이머 쌍이 `clearTimeout` 없이 덮어써진다
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:209` (`this.expiryTimers.set(client.id, timers);`)
  - 상세: 현재 `@WebSocketGateway` 설정에 `connectionStateRecovery` 가 없고 `handleConnection` 은 신규 연결마다 새 `client.id` 로 정확히 한 번만 호출되므로 재현 불가 경로다. 이번 라운드에서도 방어 코드는 추가되지 않았다(변경 없음) — 회귀는 아니지만 이전 라운드에서 지적된 항목이 그대로 남아 있다는 사실만 기록.
  - 제안: 낮은 우선순위. `armExpiryTimers` 진입 시 `this.expiryTimers.get(client.id)` 를 선제적으로 clear 하면 향후 재진입 경로가 생겨도 안전하다.

## 요약

이전 라운드의 CRITICAL(사전 통지 "정상 경로"가 `socket.connect()` no-op 에 막혀 매 900초마다 결정적으로
끊김을 노출하던 결함)은 명시적 `disconnect()` → `connect()` 재핸드셰이크로 해소됐고, 그 과정에서 발견된
후속 레이스(겹친 트리거의 이중 재연결, 세대 교체 시 옛 재발급이 새 소켓을 잘못 조작, in-flight 가드 미초기화로
인한 두 번째 주기부터의 영구 무시)까지 전용 유닛 테스트 + 뮤테이션 테스트로 각각 봉인됐다(`RESOLUTION.md` 검증
로그: cutoff/exp/reason 가드 제거 RED, fixture 실제 상태 교정 RED). backend `armExpiryTimers`/`expiryTimers`
의 arm-disarm 쌍은 `handleConnection`/`handleDisconnect` 양쪽에서 정확히 대칭 관리되고, JS 단일 이벤트 루프
특성상 `handleSubscribe` 의 tentative-add 패턴을 포함해 별도 mutex 없이도 원자성이 보장된다. 잔여 항목은 모두
INFO 수준의 방어적 코딩 여지(폐기 소켓의 리스너 미정리, `setTimeout` 32-bit 상한 미방어, 동일 client.id 재진입
시 타이머 덮어쓰기)로, 셋 다 현재 코드 경로에서는 재현 불가능하거나 낮은 확률의 미래 리스크다. 병합을 막을
동시성 결함은 없다.

## 위험도

LOW
