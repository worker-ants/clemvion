# 요구사항(Requirement) 리뷰 — WS 소켓 수명 = 토큰 수명 (`auth.token_expired`)

## 검증 방법

diff·주석 서술을 그대로 믿지 않고 직접 재현·실행해 확인했다 (저장소 파일은 읽기만, 뮤테이션 없음 —
`git status --short` 클린 확인):

- `npx jest src/modules/websocket/websocket.gateway.spec.ts src/modules/websocket/websocket-events.types.spec.ts`
  → **79/79 PASS**
- `npx vitest run src/lib/websocket/__tests__/ws-client.test.ts` → **20/20 PASS**
- `python3 scripts/check-frontend-typecheck-ratchet.py` → **OK (baseline 52/15 와 일치)**
- `node_modules/socket.io-client@4.8.3` 소스 직접 열람: `connect() { if (this.connected) return this; ... }`
  (이미 연결된 소켓에서 완전 no-op, 코드 주석의 주장과 일치) · `disconnect()` → `destroy()` →
  `onclose()` 가 **동기적으로** `this.connected = false` 를 세팅한 뒤 `emitReserved("disconnect", "io client disconnect", …)` 를 호출함을 확인 — 즉 `if (socket.connected) socket.disconnect(); socket.connect();` 는
  실제로 재핸드셰이크를 일으키고, 그 자체 `disconnect()` 호출이 클라이언트의 `disconnect` 리스너를
  `"io client disconnect"` reason 으로 동기 발화시키지만 그 reason 은 `ws-client.ts` 의
  `if (reason !== "io server disconnect") return;` 가드에 걸려 재귀 호출을 만들지 않는다(무한루프 없음,
  직접 소스 대조로 확인).
- `codebase/backend/src/modules/auth/auth.module.ts:41` → `expiresIn: 900` 확인(spec·plan·코드 JSDoc
  이 공통으로 인용하는 "900초"와 일치). `ignoreExpiration` 미설정(default `false`) → `jwtService.verify()`
  가 이미 만료된 토큰을 던지므로 `armExpiryTimers` 가 음수 `exp` 를 받는 실경로가 없음을 재확인.

## 이전 라운드(17_38_12) 대비 상태

이번 diff 에는 코드 자체(파일 1~9)뿐 아니라 직전 리뷰 라운드(`review/code/2026/09/02/17_38_12/**`,
`review/consistency/2026/09/02/**`)의 산출물도 함께 커밋돼 있다. `RESOLUTION.md` 가 서술한 두 Critical—
(C1) `socket.connect()` 가 이미 연결된 소켓에서 no-op 이라 "정상 경로" 재연결이 실제로는 서버 강제
종료 뒤에만 일어나던 문제, (C2) 신규 프론트 테스트가 `WsClient.connect(token: string)` 시그니처를
어겨 typecheck ratchet 을 깨던 문제 — 둘 다 **현재 코드에 실제로 반영돼 있고, 위 실행 결과로 재검증
완료**다. `websocket.gateway.ts:66`(`if (socket.connected) socket.disconnect(); socket.connect();`),
`ws-client.test.ts:157`(`mockSocket.connected = true` 토글) 두 곳이 그 증거다.

## Spec fidelity — `spec/5-system/6-websocket-protocol.md`

§1.2(`:52`)·§1.3(`:57-72`)·§4.6(`:876`)·§6.1 예외(`:969`)·§9.2(`:1060-1062`)·Rationale
`R-ws-socket-lifetime-binds-token`(`:1135-1148`)를 전문 대조했다. 아래가 line-level 로 일치한다:

- 60초 lead time — spec `:52`,`:1144` "만료 60초 전" ↔ `websocket.gateway.ts:144`
  `TOKEN_EXPIRY_LEAD_MS = 60_000`
- 이벤트명·payload shape — spec `:876` `auth.token_expired` `{ message, expiresAt }` ↔
  `websocket-events.types.ts:283-300` `AuthEventType.AUTH_TOKEN_EXPIRED` / `AuthTokenExpiredPayload`
- "닫는 범위는 자연 만료뿐" 카브아웃 — spec `:55`,`:1146` ↔ `websocket.gateway.ts:162-164` JSDoc 문구
  단위로 일치
- 서버발신 `disconnect()` 는 자동 재연결 미발화, 클라이언트가 명시적 `connect()` 필요 — spec
  `:969`,`:1145` ↔ `ws-client.ts:58-67` 주석·구현
- 사전 통지/fallback 두 경로 — spec §9.2 항목 8(`:1060-1062`) ↔ `ws-client.ts:104-114`
  (`auth.token_expired` 구독 + `disconnect` reason 필터)
- `handleDisconnect` 에서 타이머 해제 — spec `:52` "(`handleDisconnect` 에서 타이머 해제)" ↔
  `websocket.gateway.ts:284-291`

불일치는 발견하지 못했다. 코드가 spec 을 정확히 구현한다.

## 발견사항

- **[INFO]** spec 의 `_(계획·미구현)_`/`_(Planned)_` 배지가 구현 완료 후에도 미갱신 — 이미 plan 에
  추적 중, developer 권한 밖이라 이번 diff 범위 밖
  - 위치: `spec/5-system/6-websocket-protocol.md:52`(§1.2 "서버발신 emit 은 미구현 (Planned)"),
    `:876`(§4.6 표 `auth.token_expired` _(계획·미구현)_`, `:1100`,`:1133`(Rationale 서문 "Planned 로
    남는다")
  - 상세: 이번 diff 가 정확히 이 backend emit + frontend 구독·재연결을 구현했으나 spec 배지는 아직
    구현 전 상태를 서술한다. `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` 체크리스트가
    "머지 후 planner 턴 — spec 의 `_(계획·미구현)_` 배지 flip" 을 이미 명시적으로 등재했고, developer
    가 이 문구의 원저자가 아니라 자기-반증형 소정정 예외 대상도 아니라고 스스로 기록해 뒀다 — 조용한
    누락이 아니라 추적 중인 후속 조치다.
  - 제안: 조치 불요(이 PR 범위 밖). 머지 후 planner 턴에서 §1.2·§4.6·Rationale 서문·`:1133` 4곳의
    배지를 flip.

- **[INFO]** `armExpiryTimers` 의 `setTimeout` 지연에 Node 32비트 상한(~24.8일, `TIMEOUT_MAX`) 클램프가
  없음 — 현재 access token TTL(900초)에서는 도달 불가하나 방어적 여지는 아님
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` `armExpiryTimers` 의
    `timers.notice = setTimeout(..., untilNotice)` / `timers.cutoff = setTimeout(..., Math.max(0, untilCutoff))`
  - 상세: `auth.module.ts:41` 로 `expiresIn: 900` 을 확인했고, 900초 규모에서는 오버플로 위험이 없다는
    api_contract.md 의 기존 판단이 맞다. 다만 향후 이 정확히 같은 코드 경로가 다른 TTL(예: 장기
    "remember me" 액세스 토큰)의 소켓에도 재사용된다면, Node 는 `setTimeout` 지연이 2^31-1ms 를
    넘으면 오버플로를 1ms 로 클램프해 조용히 즉시 발화시킨다 — "관측 가능한 계약" 이라고 JSDoc 이
    명시한 lead time 이 그 경우 깨진다.
  - 제안: 현재 결함 아님(access token 은 항상 900초). 방어적 클램프는 access token TTL 이 가변화되는
    시점에 재검토.

- **[INFO]** `exp` 가 이미 과거인 입력(음수 지연, notice·cutoff 동시 0ms 발화) 조합은 여전히
  유닛테스트로 직접 검증되지 않음 — 도달 불가 경로임을 이번 라운드에서 재확인
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts`
    `describe('토큰 만료 — 사전 통지 후 disconnect (§1.2)', …)` (기존 4개 케이스 중 가장 근접한 것은
    `secondsFromNow: 30`, 이는 양수)
  - 상세: `auth.module.ts` 의 `JwtModule` 설정에 `ignoreExpiration` 이 없어 기본값 `false` 다 — 즉
    `jwtService.verify()` 가 이미 만료된 `exp` 의 토큰을 던지므로(`handleConnection` 의 `catch` 로
    귀결) `armExpiryTimers` 가 음수 `untilCutoff` 를 받는 실경로가 현재 없다. 이전 라운드
    (`testing.md` INFO)의 같은 결론을 `auth.module.ts` 직접 대조로 재검증했다.
  - 제안: 조치 불요.

## 요약

핵심 요구사항 — "WS 소켓 수명을 토큰 수명에 종속시키고, 만료 60초 전 `auth.token_expired` 를
1회 통지한 뒤 `exp` 에 강제 종료하며, 클라이언트는 사전 통지 또는 `disconnect` fallback 경로로 REST
재발급 후 명시적으로 재핸드셰이크한다" — 는 backend(`websocket.gateway.ts`)·frontend(`ws-client.ts`)
양쪽에 정확히 구현돼 있고, `spec/5-system/6-websocket-protocol.md` §1.2·§1.3·§4.6·§6.1·§9.2 및
Rationale `R-ws-socket-lifetime-binds-token` 과 line-level 로 일치한다. 직전 라운드가 잡은 두 Critical
(연결된 소켓에서 `connect()` no-op 로 "끊김 없는 전환" 이 실제로 성립하지 않던 문제, 프론트 신규
테스트가 typecheck ratchet 을 깨던 문제)은 이번 코드에 실제로 수정돼 있고, 이번 리뷰가 직접 재실행한
backend 79/79·frontend 20/20·typecheck ratchet 52/15·socket.io-client 소스 대조로 독립 재검증했다.
타이머 arm/disarm 페어링, 방어적 `exp` 타입 체크, revoke 카브아웃 범위, fallback 분기의 좁은 조건
(`"io server disconnect"` 만) 모두 spec 의도와 정확히 일치하고 에러/엣지 케이스(exp 없음·lead time
보다 짧은 잔여시간·해제 누락 방지)도 테스트로 커버된다. 남은 항목은 전부 이미 plan 에 추적 중이거나
(spec Planned 배지 flip) 현재 실경로에 도달 불가능한(exp 과거값·32비트 오버플로) 방어적 여지로,
기능 완전성을 저해하지 않는 INFO 수준이다.

## 위험도

LOW
