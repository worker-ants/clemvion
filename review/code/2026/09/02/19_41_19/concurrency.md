# 동시성(Concurrency) 리뷰 — WS 토큰 만료 소켓 수명 종속 (`auth.token_expired`), 리뷰 후속 라운드

이번 diff 는 `review/code/2026/09/02/17_38_12/` 라운드에서 발견된 동시성 CRITICAL(소켓이 이미
`connected` 인 상태에서 `socket.connect()` 가 no-op 이라 "정상 경로" 재연결이 실질적으로 동작하지
않던 문제)과 그 이후 라운드(2R/3R/4R)에서 발견된 후속 레이스(재진입 가드 누락, in-flight 리셋
누락, 소켓 세대(generation) 불일치)를 모두 반영한 결과물이다. 소스(`websocket.gateway.ts`,
`ws-client.ts`, 각 `*.spec.ts`/`*.test.ts`)를 직접 열어 실측했다.

## 발견사항

- **[INFO]** (carry-over, 미해결) backend `expiryTimers` Map 은 동일 `client.id` 로
  `armExpiryTimers` 가 재호출되면 이전 타이머 참조가 `clearTimeout` 없이 덮어써진다
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:209`
    (`this.expiryTimers.set(client.id, timers);` — 기존 항목 존재 여부를 확인하지 않고
    무조건 덮어씀), 호출부 `codebase/backend/src/modules/websocket/websocket.gateway.ts:243`
    (`handleConnection` 안의 `this.armExpiryTimers(client, payload.exp);`)
  - 상세: 이번 라운드에도 `armExpiryTimers` 진입 시 `this.expiryTimers.get(client.id)` 를 먼저
    비우는 방어 코드는 추가되지 않았다. 현재는 `@WebSocketGateway({ cors, namespace: '/ws' })`
    설정에 Socket.IO `connectionStateRecovery` 가 켜져 있지 않음을 재확인했다(grep 0건) —
    즉 `handleConnection` 은 신규 연결마다 항상 새 `client.id` 로 정확히 한 번만 호출되는
    것이 현재 유일한 경로이고, 이 경로에서는 재현되지 않는다. 이전 라운드에서도 같은
    판단(우선순위 낮음·도달 불가)이 내려졌고 이번 라운드에서도 여전히 유효하다 — 다만
    코드가 고쳐지지 않았으므로 재발 가능성 자체는 그대로 남아 있어 재기재한다.
  - 제안: `armExpiryTimers` 시작부에 `handleDisconnect` 와 동일한 정리 로직(기존 `notice`/
    `cutoff` 를 `clearTimeout` 후 `set`)을 선제 적용하면, 향후 `connectionStateRecovery` 를
    켜거나 같은 `client.id` 로 재호출되는 경로가 생겨도 안전하다. 지금 당장 막을 결함은 아니다.

## 이번 라운드에서 확인된, 이전 라운드 CRITICAL 의 해소 상태 (참고)

이전 라운드 CRITICAL — "통지 시점에 소켓이 이미 `connected` 라 `socket.connect()` 가 no-op 이라
정상 경로 재연결이 항상 skip 되고 fallback(서버 강제 disconnect 후) 경로로만 재연결됐다" —
는 이번 diff 에서 `refreshAndReconnect` 헬퍼(`codebase/frontend/src/lib/websocket/ws-client.ts:61-98`)
가 `if (mySocket.connected) mySocket.disconnect(); mySocket.connect();` (`:85-86`) 로 명시적
재핸드셰이크하도록 고쳐 해소됐다. 후속으로 드러났던 두 레이스도 확인했다:

- **in-flight 재진입**: `connect_error`·`auth.token_expired`·`disconnect("io server disconnect")`
  세 트리거가 동일 `inFlight` 프라미스(`:60-98`)를 공유해, 느린 재발급 도중 서버 cutoff 가
  겹쳐도 두 번째 트리거가 첫 번째에 흡수된다(`:62` `if (inFlight) return inFlight;`). 완료 후
  `.finally(() => { inFlight = null; })`(`:94-96`)로 반드시 리셋해 다음 900초 주기에도 다시
  동작한다.
- **소켓 세대(generation) 불일치**: `refreshAccessToken()` 의 `await` 도중 `connect()` 가
  다시 불려 `socket` 클로저 변수가 새 인스턴스를 가리킬 수 있는 문제를, 진입 시점 스냅샷
  `const mySocket = socket;`(`:68`)과 완료 시점 재검증 `if (!newToken || !mySocket || socket !== mySocket) return;`
  (`:74`)으로 막는다 — 옛 세대의 지연된 재발급이 새 소켓을 끊거나, 버려진 옛 소켓을 되살리지
  않는다.

세 시나리오 모두 `codebase/frontend/src/lib/websocket/__tests__/ws-client.test.ts` 의
"겹친 트리거는 한 번만 재연결한다 — in-flight 가드", "가드는 완료 후 초기화된다", "옛 세대의
재발급은 새 소켓을 건드리지 않는다" 테스트로 mutation-검증(가드 제거 시 RED 확인)돼 있다.
backend `armExpiryTimers`/`handleDisconnect` 의 타이머 arm/disarm 쌍은 동기 함수 내에서
완결되고(`await` 없음) `handleDisconnect` 가 `notice`/`cutoff` 둘 다 해제하므로, 이 두
파일 사이의 새로운 레이스는 발견되지 않았다.

## 요약

이번 diff 는 4라운드에 걸쳐 실제로 재현·격리된 레이스(소켓 no-op 재연결, 트리거 간 재진입,
소켓 세대 불일치)를 순차로 막아 온 결과물이며, 소스 레벨 실측과 해당 테스트의 mutation
검증(가드 제거 시 RED)까지 확인했다. 이번 라운드에서 새로 발견된 CRITICAL/WARNING 급
동시성 결함은 없다. 유일하게 남은 항목은 이전 라운드에서도 지적됐던 backend `expiryTimers`
Map 의 이중 arm 시 무조건 덮어쓰기(현재 `connectionStateRecovery` 미사용으로 도달 불가,
INFO, 우선순위 낮음)이며 이번 라운드에도 고쳐지지 않아 재기재한다.

## 위험도

LOW
