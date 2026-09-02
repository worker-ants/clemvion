# 요구사항(Requirement) 리뷰 — WS 소켓 수명을 토큰 수명에 종속 (`auth.token_expired`)

## 발견사항

- **[CRITICAL]** frontend "정상 경로"(사전 통지 → 명시적 재연결)가 소켓이 여전히 연결돼 있는 동안엔 **아무 일도 하지 않는다** — `socket.connect()` 는 이미 연결된 소켓에서 no-op 이라, spec §9.2 가 명시한 "성공하면 사용자에게 끊김이 보이지 않는다" 를 달성하지 못한다.
  - 위치: `codebase/frontend/src/lib/websocket/ws-client.ts:87-102` (특히 `refreshAndReconnect` 정의부의 `socket.connect();` 호출 — 92행, 그리고 그것을 부르는 `auth.token_expired` 핸들러 — 99-102행)
  - 상세:
    실제 설치된 `socket.io-client@4.8.3` 소스(`codebase/frontend/node_modules/socket.io-client/build/esm/socket.js:185-192`)를 직접 열어 확인했다:
    ```js
    connect() {
        if (this.connected)
            return this;
        ...
    }
    ```
    `Socket.prototype.connect()` 는 `this.connected === true` 이면 **즉시 return** 한다. `auth.token_expired` 통지는 서버가 **아직 disconnect 하지 않은** 시점(만료 60초 전)에 emit 되므로, 이 시점의 소켓은 여전히 `connected === true` 다. 즉 `refreshAndReconnect("auth.token_expired")` 가 `socket.auth.token` 을 새 토큰으로 갱신하는 것까지는 하지만, 뒤이은 `socket.connect()` 호출은 **아무 효과가 없다** — 새 핸드셰이크가 일어나지 않고, 서버 세션은 여전히 옛 토큰 컨텍스트로 유지된다.
    서버(`websocket.gateway.ts:201-207`)의 `cutoff` 타이머는 클라이언트의 이 동작과 무관하게 `exp` 시각에 무조건 `client.disconnect()` 를 호출한다 (`armExpiryTimers` 가 최초 연결 시 딱 한 번, 원래 토큰의 `exp` 기준으로 예약 — 클라이언트가 그 사이에 토큰을 갱신해도 재조정되지 않는다). 결과적으로 **모든 정상 만료 주기에서 소켓은 실제로 끊긴다** — "정상 경로" 는 사실상 실행되지 않고, 재연결은 언제나 `disconnect` reason `'io server disconnect'` fallback 경로(`ws-client.ts:107-110`)를 통해서만 일어난다. fallback 은 다시 `refreshAccessToken()` 을 호출하므로(`ws-client.ts:89`), 만료 1회당 REST `/auth/refresh` 가 **두 번**(통지 시 1회 — 낭비, 실제 disconnect 시 1회) 불린다.
    코드 자체의 주석(`ws-client.ts:99` `"정상 경로 — 통지 창(60초) 안에 갈아탄다. 성공하면 끊김이 보이지 않는다."`)과 spec 문구(`spec/5-system/6-websocket-protocol.md:1058` §9.2 항목 8 `"성공하면 사용자에게 끊김이 보이지 않는다."`)가 **동일한 주장**을 하는데, 실측 결과 코드가 그 주장을 충족하지 못한다 — 의도(주석/spec)와 구현이 어긋난 경우다(spec 이 권위이고 구현이 그에 못 미치므로 SPEC-DRIFT 가 아니라 CRITICAL).
  - 재현(뮤테이션 없이, 순수 코드 추론 + 패키지 소스 대조로 확정): 저장소 파일은 건드리지 않았다. `git status --short` 확인 결과 이 세션에서 트리 변경 없음.
  - 제안: 통지 시점에 소켓이 이미 연결돼 있다면 명시적으로 재연결 사이클을 강제해야 한다 — 예:
    ```ts
    if (newToken && socket) {
      (socket.auth as { token: string }).token = newToken;
      if (socket.connected) socket.disconnect();
      socket.connect();
    }
    ```
    (혹은 `refreshAndReconnect` 를 "이미 connected 면 disconnect 후 connect" 로 통일해 두 호출부(§1.2 notice·§9.2 fallback)가 같은 규칙을 따르게 한다.) 그래야 실제로 만료 전에 클라이언트 주도로 세션을 교체할 수 있고, spec 이 약속한 "무중단 전환" 이 성립한다.

- **[WARNING]** 위 CRITICAL 을 검증해야 할 프론트 테스트가 vacuous 하다 — mock 이 실제 no-op 시맨틱을 재현하지 못해 버그를 통과시킨다.
  - 위치: `codebase/frontend/src/lib/websocket/__tests__/ws-client.test.ts:150-160` (`"auth.token_expired 를 받으면 재발급 → auth.token 교체 → 명시적 connect"`), mock 정의는 같은 파일 `3-17`행
  - 상세: `createMockSocket()` 은 `connected: false` 로 초기화되고(3-17행), 이 테스트는 `mockSocket.connected` 를 한 번도 `true` 로 설정하지 않는다. 반면 `mockSocket.connect` 는 순수 `vi.fn()` 이라 `connected` 상태와 무관하게 호출만 기록한다 — 즉 이 mock 은 "이미 연결된 소켓에서 `connect()` 가 no-op" 이라는 실제 socket.io-client 시맨틱을 전혀 흉내 내지 못한다. 프로덕션에서 이 핸들러가 발화하는 시점(통지, 만료 60초 전)에는 소켓이 실제로 `connected === true` 인데, 테스트는 `connected: false` 상태에서 검증하므로 정확히 버그가 숨는 자리에서 GREEN 이 나온다.
  - 제안: 테스트에서 `mockSocket.connected = true` 로 설정한 뒤 `auth.token_expired` 핸들러를 발화시키고, "실제로 새 핸드셰이크가 트리거되는지"(예: `disconnect` 가 먼저 호출된 뒤 `connect` 가 호출되는지, 혹은 향후 구현에 맞는 관측 가능한 신호)를 단언하도록 보강. 위 CRITICAL 수정 전까지는 이 테스트가 회귀를 못 잡는다.

- **[INFO]** `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` 의 체크리스트가 이 커밋의 실제 구현 상태를 아직 반영하지 않는다.
  - 위치: `plan/in-progress/ws-token-expired-socket-lifetime-impl.md:77-78` (`- [ ] backend: 소켓별 타이머 + emit + disconnect + 해제 (TDD)`, `- [ ] frontend: 구독 + disconnect reason 분기 + 명시 재연결 (TDD)`)
  - 상세: 이 리뷰 대상 커밋(`b019d7de3`)이 두 항목을 실제로 구현했음에도 체크박스는 미체크 상태다. 프로젝트 관례(`developer` SKILL 워크플로 — 리뷰 뒤 마무리 커밋에서 체크·`complete/` 이동)상 정상적인 중간 상태일 수 있어 결함으로 보진 않지만, 위 CRITICAL 항목이 해소되기 전까지는 "구현 완료" 로 체크하지 않는 것이 맞다.

- **[INFO]** spec 본문의 `_(계획·미구현)_`/"backend emit 은 구현 대기" 배지(`spec/5-system/6-websocket-protocol.md:28,52,876,1100,1133`)가 이번 구현 이후에도 아직 갱신되지 않았다.
  - 상세: 프로젝트 선례(`spec-sync-websocket-protocol-gaps.md:71` — 알림 이벤트 구현 완료 후 "계획·미구현" 배지 flip 은 별도 planner 트랙 plan 으로 위임)에 따르면 이 배지 갱신은 developer 몫이 아니라 `project-planner` 턴으로 위임하는 것이 이 리포의 관례다. 자기-반증형 소정정 예외(다섯 조건)에도 해당하지 않는다(이 문장을 쓴 사람은 developer 가 아니라 이전 planner 커밋 `6ffadb1f4`). 위 CRITICAL 수정이 완료된 뒤 별도 planner 턴에서 배지 flip 을 다루면 된다 — 지금 당장 구현을 막을 사유는 아니다.

## 검증한 항목 (문제 없음)

- backend 이벤트명·payload shape(`{ message, expiresAt }`) — `AuthEventType.AUTH_TOKEN_EXPIRED = 'auth.token_expired'`, `AuthTokenExpiredPayload` 가 spec §4.6 표(`6-websocket-protocol.md:876`)와 필드 단위로 일치.
- lead time 60초 상수·산출식(`untilNotice = max(0, untilCutoff - 60000)`, `untilCutoff = expiresAtMs - Date.now()`) — spec §1.2(`:52`)·Rationale(`:1139-1148`)와 일치.
- `handleDisconnect` 에서 두 타이머(`notice`/`cutoff`) 모두 `clearTimeout` — 누수 방지 서술과 일치, 테스트(`websocket.gateway.spec.ts:777-791`)로 커버.
- `exp` 미존재 시 타이머 미장착(`typeof expSeconds !== 'number' || !Number.isFinite`) — spec Rationale 의 "만료 없는 토큰을 만료로 다루지 않는다" 카브아웃과 일치, 테스트(`:807-824`) 커버.
- lead time 보다 짧게 남은 토큰의 즉시 통지(`Math.max(0, …)` clamp) — 테스트(`:793-805`) 커버.
- frontend `disconnect` reason 분기(`reason !== 'io server disconnect'` 이면 조기 return) — Socket.IO 내장 재연결과의 이중 개입(재연결 폭풍) 방지 서술과 일치, 테스트(`ws-client.test.ts:173-183`) 커버.
- 명시적 revoke 카브아웃(자연 만료만 닫음) — 코드에 별도 revoke 처리 없음(구현 범위 밖으로 명시), spec Rationale 의 "여기서 넓히지 않는다" 와 일치.
- `AuthEventType`/`AuthTokenExpiredPayload` 네이밍이 `token_expired`(Integration DB 슬러그)·`TOKEN_EXPIRED`(JWT 에러 코드)와 혼동되지 않도록 JSDoc 이 명시적으로 구분(`websocket-events.types.ts:274-296`), `integration-status-reason.ts:18-19` 도 상호 참조 — naming_collision 우려 해소 확인.

## 요약

backend 쪽(소켓별 만료 타이머 두 개, `auth.token_expired` emit, `exp` 도달 시 `disconnect()`, `handleDisconnect` 에서의 타이머 이중 해제)은 spec §1.2·§4.6·Rationale `R-ws-socket-lifetime-binds-token` 과 필드·상수·상태 전이 단위로 정확히 일치하며 테스트 커버리지도 탄탄하다. 그러나 frontend 의 "정상 경로"(사전 통지 60초 창 안에 갈아타 무중단 전환한다는 §9.2 의 핵심 약속)는 실제로 동작하지 않는다 — `socket.io-client` 의 `connect()` 가 이미 연결된 소켓에서 no-op 이기 때문에, 통지 핸들러의 재발급+재연결 시도는 실질적으로 아무 효과가 없고, 실제 재연결은 항상 서버의 강제 disconnect 이후 fallback 경로로만 일어난다. 이는 이 기능의 핵심 설계 목표(끊김 없는 전환)를 무력화하며, 이를 검증해야 할 단위 테스트가 `mockSocket.connected` 를 실제 상황과 다르게(항상 `false`) 두고 있어 회귀를 잡지 못하는 vacuous 테스트다. 이 CRITICAL 을 고치기 전까지는 기능이 "약속한 대로" 동작한다고 보기 어렵다.

## 위험도

HIGH
