# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** `auth.token_expired` "정상 경로" 는 socket.io-client 의 `connect()` no-op 가드 때문에 실제로 재연결을 일으키지 않는다 — 설계 의도("성공하면 끊김이 보이지 않는다")가 코드 그대로는 성립하지 않는다
  - 위치: `codebase/frontend/src/lib/websocket/ws-client.ts:87-110` (`refreshAndReconnect` 정의 + `socket.on("auth.token_expired", …)` 등록, 특히 99번 줄 주석 "정상 경로 — 통지 창(60초) 안에 갈아탄다. 성공하면 끊김이 보이지 않는다.")
  - 상세:
    - 서버는 만료 60초 **전**(아직 연결이 살아있는 시점)에 `auth.token_expired` 를 emit 한다(`codebase/backend/src/modules/websocket/websocket.gateway.ts:193-199`). 이 시점에 클라이언트 소켓의 `connected` 는 여전히 `true` 다.
    - `refreshAndReconnect`(`ws-client.ts:87-97`)는 토큰을 갱신해 `socket.auth.token` 을 교체한 뒤 `socket.connect()` 를 호출한다. 그런데 `socket.io-client@4.8.3` 의 `Socket.prototype.connect`(`node_modules/.pnpm/socket.io-client@4.8.3/node_modules/socket.io-client/build/cjs/socket.js:193-202`)는 `if (this.connected) return this;` 로 **이미 연결된 소켓에서는 즉시 no-op** 한다. 즉 "정상 경로" 에서 `socket.connect()` 는 아무 일도 하지 않고, 갱신된 토큰은 메모리에만 대기한다 — 실제 핸드셰이크 재전송은 일어나지 않는다.
    - 그 결과 서버의 cutoff 타이머가 `exp` 시각에 `client.disconnect()` 를 실제로 호출할 때까지 연결은 그대로 유지되다가, 그 시점에 강제로 끊긴다 — 즉 "정상 경로" 가 있든 없든 사용자는 정확히 같은 순간에 (`disconnect` reason `"io server disconnect"`) 끊김을 겪는다. 실제 재연결은 오직 fallback 경로(`ws-client.ts:107-110`)가 `disconnect` 이벤트를 받아 `socket.connected === false` 인 상태에서 `refreshAndReconnect` 를 다시 호출할 때만 동작한다.
    - 부수적으로 **불필요한 네트워크 호출**이 하나 더 발생한다 — "정상 경로" 가 이미 `refreshAccessToken()` 을 1회 호출(REST `/auth/refresh`)했음에도, 60초 뒤 fallback 경로가 다시 `refreshAccessToken()` 을 호출한다(각 호출은 60초 간격이라 `refreshPromise` dedup(`codebase/frontend/src/lib/api/client.ts:84-92`)의 보호 범위(겹치는 concurrent 호출)를 벗어난다 — 순차 호출이라 dedup 되지 않고 완전한 REST round-trip 이 두 번 발생).
    - 이 결함은 fan-out 되어 사용자를 완전히 끊긴 채로 방치하지는 않는다(fallback 이 결국 복구) — 다만 §1.2/§9.2 코멘트가 명시한 "무중단(seamless) 스왑" 이라는 핵심 설계 목표를 코드가 실제로 달성하지 못하고, 오히려 방지하려던 바로 그 가시적 disconnect(§6.1 예외) 를 매번 겪는다.
    - **테스트가 이 결함을 가리고 있다**: `codebase/frontend/src/lib/websocket/__tests__/ws-client.test.ts` 의 `createMockSocket()`(3-17번 줄)은 `connected: false` 로 하드코딩되며, "정상 경로" 테스트(150-160번 줄)는 핸들러 호출 전에 `mockSocket.connected` 를 `true` 로 전환하지 않는다. mock 의 `connect: vi.fn()` 은 실제 라이브러리의 `if (this.connected) return this;` 가드를 재현하지 않으므로, `expect(mockSocket.connect).toHaveBeenCalled()` 는 **실제로는 no-op 이 됐을 호출**도 통과시킨다 — GREEN 이 증거가 아니다.
  - 제안: (a) "정상 경로" 에서는 `socket.connect()` 대신 `socket.disconnect(); socket.connect();` 로 실제 재핸드셰이크를 강제하거나, (b) 애초에 아직 연결된 소켓에서는 토큰만 갱신해 두고 재연결은 fallback(`disconnect` reason 체크)에만 위임하도록 주석/의도를 정정하거나 — 둘 중 하나로 코드와 주석을 일치시킨다. 어느 쪽을 택하든 `mockSocket.connected` 를 실제 값으로 토글하는 테스트를 추가해 no-op 가드를 재현해야 한다.

- **[INFO]** `WebsocketGateway.expiryTimers` 에는 모듈/앱 종료 시 잔여 타이머를 정리하는 backstop 이 없다 — 같은 모듈의 자매 서비스는 이 패턴을 이미 갖추고 있다
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:150-153` (`expiryTimers` 필드 선언), 대조: `codebase/backend/src/modules/websocket/execution-seq-allocator.service.ts:146-150` (`onModuleDestroy` 로 in-memory 상태 반납)
  - 상세: 정상 경로(모든 소켓이 `handleDisconnect` 를 거쳐 종료)에서는 `notice`/`cutoff` 타이머가 매번 정리되므로(`websocket.gateway.ts:284-291`) 현재 진단된 실사용 리스크는 없다 — 이번 diff 의 신규/인접 테스트들은 `jest.useFakeTimers()` 로 격리돼 있고(`websocket.gateway.spec.ts:722-728`), 그 밖의 기존 `JwtService.verify` mock 들(65, 829, 846번 줄)은 `exp` 필드를 포함하지 않아 실제 `setTimeout` 이 걸리지 않는다(확인함). 다만 `WebsocketGateway` 는 Nest 싱글턴이고 `OnModuleDestroy`/`beforeApplicationShutdown` 을 구현하지 않으므로, 향후 그레이스풀 셧다운 경로가 소켓별 `disconnect` 이벤트 없이 모듈을 파괴하는 경우(또는 향후 테스트가 `exp` 를 채운 payload 를 fake timer 없이 사용하는 경우) 타이머가 프로세스/테스트 종료를 지연시키거나 이미 파괴된 `client`/`logger` 를 참조하는 콜백이 남을 수 있다.
  - 제안: `expiryTimers` 전량을 `clearTimeout` 하는 `onModuleDestroy` 를 추가해 그레이스풀 셧다운·테스트 격리 양쪽의 안전망을 갖춘다(선택적 — 현재 관측된 결함은 아님).

## 요약

핵심 변경(백엔드 `armExpiryTimers`/`handleConnection`/`handleDisconnect` 의 타이머 arm·해제, `AuthEventType`/`AuthTokenExpiredPayload` 신규 export)은 순수 추가적이며 기존 시그니처·전역 상태·환경 변수·파일시스템에 부작용이 없고, 타이머 생성-해제 페어링도 `handleDisconnect` 경로에서 일관되게 지켜진다. 다만 프론트엔드 `ws-client.ts` 의 "정상 경로"(사전 통지 시점 재연결)는 socket.io-client 가 이미 연결된 소켓의 `connect()` 를 no-op 처리하는 라이브러리 동작 때문에 실질적으로 아무 side effect 도 일으키지 못하고, 실제 재연결은 항상 fallback(`disconnect` reason 체크) 경로 하나에서만 발생한다 — 사용자 관점에서 최종적으로는 복구되지만, 이 PR 이 명시한 "무중단 스왑" 목표는 코드로 구현되지 않았고 불필요한 REST 호출이 하나 더 발생한다. 새로 추가된 프론트 테스트는 `connected` 상태를 실제로 토글하지 않아 이 결함을 검출하지 못한다. 그 외에는 review/consistency 세션 아티팩트(파일 8~27)를 포함해 관측된 이상 파일시스템 부작용은 없다(plan 문서가 명시적으로 예산 실험 이력을 설명).

## 위험도
MEDIUM
