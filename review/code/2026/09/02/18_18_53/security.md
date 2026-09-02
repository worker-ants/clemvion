# 보안(Security) 코드 리뷰

## 범위

WS 소켓 수명을 JWT access token 수명에 종속시키는 기능 (`spec/5-system/6-websocket-protocol.md` §1.2/§1.3/§4.6/§6.1/§9.2, Rationale `R-ws-socket-lifetime-binds-token`). 이 diff 는 직전 라운드(`review/code/2026/09/02/17_38_12/`)에서 나온 CRITICAL/WARNING 을 조치한 결과물이다.

- `codebase/backend/src/modules/websocket/websocket-events.types.ts` — `AuthEventType`/`AuthTokenExpiredPayload` 신규 wire 타입
- `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts` — export 완전성 가드 갱신
- `codebase/backend/src/modules/websocket/websocket.gateway.ts` — 소켓별 만료 사전통지(`notice`)·강제종료(`cutoff`) 타이머
- `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts` — 위 기능 테스트
- `codebase/frontend/src/lib/websocket/ws-client.ts` — `auth.token_expired` 구독 + `disconnect(reason === "io server disconnect")` fallback → 재발급 → 명시적 재연결
- `codebase/frontend/src/lib/websocket/__tests__/ws-client.test.ts` — 위 기능 테스트
- `CHANGELOG.md`, `plan/in-progress/*.md`, `review/code/**`, `review/consistency/**` — 문서/프로세스 아티팩트, 코드 아님(보안 관점 해당 없음)

먼저 이 변경 자체가 닫는 취약점을 짚는다: **종전에는 핸드셰이크 이후 토큰을 한 번도 재검증하지 않아, 만료된 access token 으로 열린 소켓이 무기한 인가된 채 이벤트를 계속 수신했다** — CWE-613 (Insufficient Session Expiration) 계열 결함. 이번 diff 는 이를 닫는다.

## 직전 라운드 CRITICAL/WARNING 조치 확인

이전 라운드 `concurrency.md`(CRITICAL)·`side_effect.md`(WARNING)·`security.md`(WARNING)가 공통으로 지적한 결함 — `auth.token_expired` 통지 시점에는 소켓이 아직 `connected === true` 라, `refreshAndReconnect` 가 새 토큰을 `socket.auth` 에 얹은 뒤 부르는 `socket.connect()` 가 socket.io-client 의 `if (this.connected) return this;` no-op 가드에 막혀 **실제 재핸드셰이크가 전혀 일어나지 않던** 문제 — 는 이번 diff 에서 조치됐다.

- `codebase/frontend/src/lib/websocket/ws-client.ts:66-67` — `if (socket.connected) socket.disconnect(); socket.connect();` 로 재발급 시 명시적으로 끊고 다시 붙어 no-op 가드를 우회한다.
- `codebase/frontend/src/lib/websocket/__tests__/ws-client.test.ts:157, 164-171` — `mockSocket.connected = true` 로 프로덕션 상태를 재현하고, `disconnect`→`connect` **호출 순서**까지 `invocationCallOrder` 로 단언해 순서가 뒤집히는 회귀(다시 no-op)를 잡는다.

직접 코드를 열어 위 두 지점을 확인했다 — 재발급 시 세션이 만료 전 실제로 갱신되며, "매 900초마다 강제 disconnect 뒤에야 fallback 경로에서 복구되는" 세션-연속성 결함은 더 이상 재현되지 않는다.

## 발견사항

- **[INFO]** 소켓별 만료 타이머 등록이 무조건 덮어쓰기라, 같은 `client.id` 로 재진입 시 이전 타이머가 정리되지 않고 유실될 수 있음 (현재는 도달 불가 경로)
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:209` (`this.expiryTimers.set(client.id, timers);`, `armExpiryTimers` 내부)
  - 상세: `armExpiryTimers` 는 진입 시 기존 `this.expiryTimers.get(client.id)` 를 먼저 clear 하지 않고 곧장 새 항목으로 덮어쓴다. 현재 `handleConnection` 은 신규 연결마다 고유한 `client.id` 로 정확히 한 번만 호출되므로(Socket.IO `connectionStateRecovery` 미사용) 실사용 리스크는 없다. 다만 향후 같은 id 로 재연결을 허용하는 경로(connection state recovery 등)가 생기면, 이전 `notice`/`cutoff` 타이머가 `clearTimeout` 없이 유실돼 이미 교체된 소켓 인스턴스에 `emit`/`disconnect` 를 걸거나 타이머가 누수될 수 있다 — 세션 만료 타이밍이 예상과 어긋나는 경로가 될 수 있어 세션 관리 항목으로 기록.
  - 제안: `armExpiryTimers` 진입 시 기존 항목을 먼저 clear 하는 방어 코드를 추가하면(현재 `handleDisconnect` 가 하는 정리를 선제 적용) 향후 재진입 경로가 생겨도 안전하다. 지금 당장 조치 필수는 아님.

- **[INFO]** `exp` 클레임 크기에 대한 명시적 상한 검증이 없어, 이론상 `setTimeout` 32비트 지연 오버플로(Node, ~24.8일 초과 시 즉시 발화) 경로가 코드로 방어되지 않음
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:201-207` (`timers.cutoff = setTimeout(..., Math.max(0, untilCutoff))`)
  - 상세: `exp` 는 `jwtService.verify(token)` 서명 검증을 통과한 페이로드에서만 읽으므로 공격자가 임의 조작할 수 없고, 발급 경로(`auth.module.ts`)의 access token TTL 은 900초로 고정돼 있어 현재는 이 값이 24.8일에 근접할 수 없다. 따라서 지금은 관측 가능한 위험이 아니다. 다만 코드 자체에는 "exp 가 비정상적으로 먼 미래"인 입력에 대한 명시적 상한 가드가 없어, 발급 로직 쪽에 향후 회귀(예: 잘못된 TTL 설정)가 생기면 이 타이머 로직이 조용히 오작동(즉시 발화 또는 오버플로)할 수 있는 잠재적 결합이다.
  - 제안: 필수는 아님 — 발급 측 TTL 이 SoT 이므로 이중 방어가 필요하다고 판단되면 `untilCutoff` 에 합리적 상한(예: 24시간)을 clamp 하는 방어적 코드를 고려할 것.

## 검토했으나 이상 없음으로 판단한 항목

- **인젝션**: 신규 코드에 SQL/커맨드/경로 탐색 등 인젝션 표면이 없다. `exp` 는 신뢰 경계(서명 검증)를 통과한 값만 사용하고, `client.emit(AuthEventType.AUTH_TOKEN_EXPIRED, payload)` 의 payload(`message`, `expiresAt`)는 고정 문자열/서버 계산값이며 사용자 입력을 반영하지 않는다.
- **하드코딩된 시크릿**: 없음. 테스트 픽스처의 `"valid-jwt"`/`"old-token"`/`"new-token"` 은 mock 문자열이지 실제 시크릿이 아니다.
- **인증/인가**: `armExpiryTimers` 가 소비하는 `exp` 는 `jwtService.verify()` 서명 검증을 통과한 페이로드에서만 읽는다(`websocket.gateway.ts:236, 243`) — 공격자가 임의 `exp` 를 주입해 만료 타이머를 조작할 수 없다. 이 변경 자체가 기존 인가 갭(만료 토큰의 무기한 소켓 인가)을 닫는 보강이다. 명시적 revoke 는 refresh family 만 무효화하고 이미 발급된 access token 소켓은 자연 만료까지 유지되는 카브아웃은 spec Rationale 이 명시적으로 승인한 범위이며 코드 주석(`websocket.gateway.ts:162-164`)과 정확히 일치한다.
- **입력 검증**: `armExpiryTimers` 는 `typeof expSeconds !== 'number' || !Number.isFinite(expSeconds)` 로 방어하고(`:174`), `exp` 부재/비정상 시 타이머를 걸지 않는다(fail-safe, 만료 없는 토큰을 만료로 취급하지 않음).
- **암호화**: 신규 코드에 해시/암호화 로직 없음. 토큰은 기존 JWT 서명 검증 경로를 그대로 사용한다.
- **에러 처리**: `catch { ... client.emit('error', { message: 'Invalid token' }); client.disconnect(); }` 는 기존 경로 그대로이며 스택트레이스나 내부 구현 정보를 클라이언트에 노출하지 않는다. 프론트 `console.error` 로그(`ws-client.ts:69, 88`)는 브라우저 콘솔에만 남고 고정된 `why` 문자열(`"connect_error"`/`"auth.token_expired"`/`"io server disconnect"`)만 사용해 사용자 입력을 반영하지 않는다.
- **의존성 보안**: 신규 의존성 추가 없음. 기존 `socket.io-client`(v4.8.3) 사용 방식만 정정됐다.
- **정보 노출**: `client.emit` 은 해당 소켓에만 전송되며(브로드캐스트 아님) `message`/`expiresAt` 어디에도 PII·내부 구현 세부가 없다.

## 요약

이번 diff 는 "핸드셰이크 이후 토큰이 재검증되지 않아 만료된 토큰으로도 WS 세션이 무기한 유지된다"는 실질적 세션 관리 취약점(CWE-613 계열)을 닫는 보안 개선이며, 백엔드(`exp` 는 서명 검증된 페이로드에서만 신뢰, 타이머 이중 해제, revoke 스코프의 명시적 문서화)와 프론트엔드(재발급 후 명시적 `disconnect()`→`connect()` 재핸드셰이크, 순서 단언 테스트) 구현 모두 직전 라운드에서 지적된 CRITICAL(사전 통지 재연결이 `connect()` no-op 에 막혀 무효화되던 결함)을 실측 코드로 조치했다. 신규 인젝션·하드코딩 시크릿·인가 우회·정보 노출·암호화 결함은 발견되지 않았다. 남은 두 건은 모두 INFO 수준(현재 도달 불가능한 경로에 대한 방어-심화 제안)이며 이 diff 를 차단할 사안이 아니다.

## 위험도

LOW
