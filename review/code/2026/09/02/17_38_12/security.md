# 보안(Security) 코드 리뷰

## 범위

이번 변경은 WS 소켓 수명을 JWT 토큰 수명에 종속시키는 기능이다(spec §1.2/§1.3/§4.6/§6.1/§9.2,
Rationale `R-ws-socket-lifetime-binds-token`).

- `codebase/backend/src/modules/websocket/websocket-events.types.ts` — `AuthEventType`/`AuthTokenExpiredPayload` 신규 타입
- `codebase/backend/src/modules/websocket/websocket.gateway.ts` — 소켓별 만료 사전통지(`notice`)·강제종료(`cutoff`) 타이머
- `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts` — 위 기능 테스트
- `codebase/frontend/src/lib/websocket/ws-client.ts` — `auth.token_expired` 구독 + `disconnect(reason === "io server disconnect")` fallback → 재발급 → 명시적 재연결
- `codebase/frontend/src/lib/websocket/__tests__/ws-client.test.ts` — 위 기능 테스트
- `plan/in-progress/spec-draft-ws-socket-lifetime-binds-token.md`, `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` — 계획 문서(코드 아님)
- `review/consistency/2026/09/02/**` — 이전 라운드의 consistency-check 산출물(프로세스 메타데이터, 코드 아님) — 보안 관점에서 검토 대상 아님

먼저 이 변경 자체가 닫는 취약점을 짚고 간다: **종전에는 핸드셰이크 이후 토큰을 한 번도
재검증하지 않아, 만료된 access token 으로 열린 소켓이 무기한 인가된 채 이벤트를 계속
수신했다(CWE-613 Insufficient Session Expiration에 해당하는 결함).** 이번 diff 는 그 결함을
막는 수정이며, 아래 발견사항은 그 위에서 남은 잔여 이슈다.

## 발견사항

- **[WARNING]** 프론트엔드의 "사전 통지(notice) 시점 선제 재연결" 이 Socket.IO 클라이언트의
  `connect()` no-op 특성 때문에 실제로는 무효화되어, 설계가 의도한 "끊김 없는 전환" 이 성립하지
  않는다.
  - 위치: `codebase/frontend/src/lib/websocket/ws-client.ts:87-102` (`refreshAndReconnect` 함수 및
    `socket.on("auth.token_expired", ...)` 핸들러)
  - 상세: `socket.on("auth.token_expired", () => { void refreshAndReconnect("auth.token_expired"); })`
    는 소켓이 **아직 연결된 상태**에서 발화한다(백엔드 `armExpiryTimers` 의 `notice` 타이머는
    `client.disconnect()` 를 호출하지 않고 emit 만 한다 — `websocket.gateway.ts:192-199`).
    `refreshAndReconnect` 는 새 토큰을 받아 `socket.auth.token = newToken` 후 `socket.connect()`
    를 호출하지만, socket.io-client v4 의 `Socket.prototype.connect()` 는
    `if (this.connected) return this;` 로 시작한다(`node_modules/socket.io-client/build/cjs/socket.js:193-202`,
    실측 확인). 즉 아직 연결돼 있는 소켓에서 `connect()` 호출은 **아무 일도 하지 않는다** — 새
    토큰으로 실제 재연결이 일어나지 않고, `socket.auth.token` 값만 갱신된 채 대기한다.
    결과적으로 서버의 `cutoff` 타이머는 클라이언트 행동과 무관하게 `exp` 시점에 항상
    `client.disconnect()` 를 실행하므로(`websocket.gateway.ts:201-207`), **모든 소켓이 정확히
    토큰 만료 시점에 실제로 끊긴다** — 코드 주석("성공하면 끊김이 보이지 않는다",
    `ws-client.ts:99`)과 spec §9.2 가 의도한 "사전 갱신으로 끊김을 감추는 것"이 실제로는
    일어나지 않는다. 실제 재연결은 `disconnect` 이벤트의 fallback 경로
    (`ws-client.ts:107-110`, `reason === "io server disconnect"`)에서만 성립하는데, 이 시점엔
    이미 `socket.connected === false`라 `connect()` 가 정상 동작한다 — 대신 `refreshAccessToken()`
    이 두 번(notice 1회 + fallback 1회) 호출되는 중복도 발생한다.
    이는 인증 우회나 정보 노출은 아니지만, "인증/인가 — 세션 관리" 체크리스트 항목에 해당하는
    설계-구현 불일치다: 사용자는 매 토큰 만료 시점마다 실제 disconnect→reconnect 를
    경험하며, 그 사이 짧게라도 실시간 이벤트(예: `execution:*`, `notifications:*`) 수신이
    끊길 수 있다. `ws-client.test.ts` 의 신규 테스트는 `mockSocket.connect = vi.fn()` 로
    `connected` 상태를 추적하지 않는 mock 을 쓰기 때문에 이 불일치를 검출하지 못한다
    (`codebase/frontend/src/lib/websocket/__tests__/ws-client.test.ts:150-160` — mock 이
    `connected`/no-op 의미를 재현하지 않음).
  - 제안: notice 핸들러에서 실제로 새 연결을 성립시키려면 (a) 새 토큰으로 별도의 `io(...)`
    인스턴스를 미리 열어 성공 시 기존 소켓을 교체하거나, (b) 통지 수신 시 기존 소켓을
    명시적으로 `disconnect()` 한 뒤 새 토큰으로 `connect()` 하는 식으로 "연결된 상태에서
    connect() 호출은 no-op" 이라는 socket.io 특성을 우회해야 한다. 최소한 mock 이 아닌
    e2e/통합 테스트로 "notice 이후 실제 재연결이 성립하는지" 를 검증할 것을 권장한다(이 PR
    범위 밖일 수 있으나 §9.2 계약의 실효성 확인 차원).

- **[INFO]** 명시적 revoke(로그아웃) 이후에도 이미 발급된 access token 은 자연 만료까지
  WS 세션이 유지된다 — 문서화된 의도적 스코프이나 보안 검토 관점에서 residual 노출 창으로
  기록.
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:156-168`
    (`armExpiryTimers` 독스트링의 "닫는 범위는 자연 만료뿐이다" 단락)
  - 상세: `armExpiryTimers` 는 JWT `exp` 클레임 기준으로만 타이머를 걸고, refresh family
    revoke(로그아웃·강제 세션 종료 등)는 다루지 않는다. 즉 사용자가 로그아웃하거나 관리자가
    세션을 강제 종료해도, 이미 발급된 access token 을 쥔 소켓은 자기 `exp`(최대 900초 ≈ 15분)
    까지 계속 인가된 채 살아있고 실행/알림 채널 이벤트를 계속 수신할 수 있다. 코드·spec
    Rationale 이 이를 명시적 카브아웃으로 선언하고 이미 `--spec`/`--impl-prep` 라운드에서
    검토·승인됐으므로 새로운 미승인 결함은 아니지만, "인증/인가 — 세션 관리 문제" 체크리스트
    관점에서 완전성을 위해 기록한다.
  - 제안: 조치 불필요(설계상 의도, 이미 gate 통과). 다만 향후 "즉시 revoke가 필요한" 상위
    민감도 작업(예: 계정 정지·보안 사고 대응)이 생기면 이 카브아웃을 재검토할 근거로 남겨둔다.

- **[INFO]** 신규 코드에서 하드코딩된 시크릿·SQL/커맨드 인젝션·안전하지 않은 암호화·평문
  전송·민감정보 로그 노출은 발견되지 않았다. `armExpiryTimers` 가 사용하는 `exp` 값은
  `jwtService.verify(token)` 로 서명 검증을 통과한 페이로드에서만 읽으므로(신규 코드가
  신뢰 경계를 넓히지 않음), 공격자가 임의의 `exp` 를 주입할 수 없다. `client.emit(...)` 은
  해당 소켓에만 전송되며(브로드캐스트 아님) 응답 페이로드(`message`, `expiresAt`)에 내부
  구현 정보나 PII 는 없다. 테스트 파일의 `"valid-jwt"`/`"old-token"`/`"new-token"` 은
  픽스처 문자열이며 실제 시크릿이 아니다.

## 요약

이번 변경은 "핸드셰이크 이후 토큰이 재검증되지 않아 만료된 토큰으로도 WS 세션이 무기한
유지된다"는 실질적인 세션 관리 취약점(CWE-613 계열)을 닫는 보안 개선이며, 백엔드 구현
(신뢰된 서명 페이로드의 `exp` 사용, 소켓 disconnect 시 타이머 이중 해제, revoke 스코프의
명시적 문서화)은 견고하다. 다만 프론트엔드의 "사전 통지 시점 선제 재연결" 경로가
Socket.IO `connect()` 의 no-op 특성 때문에 실제로 동작하지 않아, 설계 의도(끊김 없는 토큰
전환)와 구현이 어긋나는 WARNING 급 세션-관리 이슈가 있다 — 보안 우회는 아니지만 실시간
채널의 가용성/연속성에 영향을 줄 수 있고 현재 mock 기반 테스트로는 검출되지 않는다.
그 외 인젝션·시크릿·암호화·에러 노출 등 다른 OWASP Top 10 카테고리에서는 문제를 발견하지
못했다.

## 위험도

LOW
