# 보안(Security) 코드 리뷰

## 범위 및 방법

`auth.token_expired` — WS 소켓 수명을 JWT access token 수명에 종속시키는 기능
(`spec/5-system/6-websocket-protocol.md` §1.2/§1.3/§4.6/§6.1/§9.2,
Rationale `R-ws-socket-lifetime-binds-token`)의 **3라운드째 리뷰**다. 이 diff 는
직전 두 라운드(`review/code/2026/09/02/17_38_12/`, `review/code/2026/09/02/18_18_53/`)에서
발견된 Critical 2건·Warning 다수가 조치된 결과물 + 그 리뷰 산출물 자체의 커밋 + 사용자 가이드
문서(`password-and-sessions.mdx`/`.en.mdx`) 갱신을 포함한다.

- `codebase/backend/src/modules/websocket/websocket.gateway.ts` — 소켓별 만료 사전통지(`notice`)·
  강제종료(`cutoff`) 타이머(`armExpiryTimers`), 신규 `AuthEventType`/`AuthTokenExpiredPayload`
- `codebase/backend/src/modules/websocket/websocket-events.types.ts` / `*.spec.ts` — wire 타입 +
  export 완전성 가드
- `codebase/frontend/src/lib/websocket/ws-client.ts` — `auth.token_expired`/서버발신
  `disconnect` 구독 → `refreshAndReconnect`(in-flight 가드 포함) → 명시적 재핸드셰이크
- `codebase/backend/.../websocket.gateway.spec.ts`, `codebase/frontend/.../ws-client.test.ts` — 대응 테스트
- `CHANGELOG.md`, `plan/in-progress/*.md`, `codebase/frontend/.../password-and-sessions*.mdx` — 문서
- `review/code/**`, `review/consistency/**`(파일 12~62) — 직전 라운드 리뷰/컨시스턴시 체크 산출물 커밋.
  코드 아님 — 시크릿 노출 여부만 확인(아래 참조), 보안 결함 관점 해당 없음

직전 라운드에서 지적된 **C1(재발급 후 `socket.connect()` no-op 로 실제 재핸드셰이크 없음)** 은
`ws-client.ts:76-77` (`if (socket.connected) socket.disconnect(); socket.connect();`)로,
**W2(신규 트리거 무가드 재진입)** 는 `inFlight` Promise 가드(`ws-client.ts:59-86`)로 조치된 상태를
현재 코드에서 직접 확인했다. 두 조치 모두 이번 diff 범위 안에 있다.

먼저 이 변경 자체가 닫는 취약점: **종전에는 핸드셰이크 이후 토큰을 한 번도 재검증하지 않아, 만료된
access token 으로 열린 소켓이 무기한 인가된 채 이벤트를 계속 수신했다** — CWE-613
(Insufficient Session Expiration) 계열 결함이며, 이번 diff 는 이를 닫는다.

## 발견사항

- **[INFO]** 명시적 세션 revoke(다른 기기 로그아웃 등) 후에도 이미 열려 있던 WS 소켓은 access
  token 의 자연 만료 시각까지(최대 900초, 사전 통지는 그 60초 전) 계속 인가된 채 이벤트를 수신한다
  — 세션 폐기 전파에 최대 15분의 창이 있다
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` (`armExpiryTimers` docstring,
    "닫는 범위는 자연 만료뿐이다" 단락) · `codebase/frontend/src/content/docs/07-workspace-and-team/password-and-sessions.mdx:68-74`
    및 `.en.mdx:52-58` (같은 카브아웃의 사용자 대면 서술)
  - 상세: `armExpiryTimers` 는 JWT `exp` 클레임만으로 cutoff 를 건다. refresh token family 를
    무효화하는 명시적 revoke(비밀번호 변경·"다른 기기 로그아웃")는 이미 발급된 access token 자체를
    무효화하지 않으므로, 그 access token 으로 열려 있던 WS 소켓은 `verifyExecutionOwnership`·채널
    구독 등 인가된 동작을 자연 만료까지 계속 수행할 수 있다. 이는 코드 결함이 아니라
    spec Rationale `R-ws-socket-lifetime-binds-token` 이 명시적으로 승인한 스코프이고, 직전
    두 라운드(`review/code/2026/09/02/17_38_12/security.md` 없음 확인·`18_18_53/security.md:42`)가
    이미 "카브아웃은 spec 이 명시적으로 승인한 범위"로 검토·수용했으며, 이번 diff 에서 사용자 가이드에
    그 창을 "최대 15분"으로 명문화(`password-and-sessions.mdx` Callout)했다. 다만 보안 리뷰
    기록으로서 재확인해 둔다 — REST 세션(짧은 access token TTL + 401 즉시 거부)과 달리 WS 채널은
    revoke 시점과 실제 차단 시점 사이에 관측 가능한 지연이 있다는 점은, 계정 탈취·강제 로그아웃
    같은 실제 위협 모델에서 "즉시 차단"을 기대하는 사용자/운영자에게 여전히 유의미한 정보다.
  - 제안: 조치 불요(설계 의도, 이미 문서화·2라운드 승인됨). 향후 "강제 즉시 세션 종료"(예: 계정
    탈취 대응, 관리자 강제 로그아웃) 요구가 생기면 access token 자체를 서버측 revocation
    list/블랙리스트로 관리하는 별도 설계가 필요하다는 점만 인지해 둘 것 — 지금 범위 밖.

- **[INFO]** (재확인, 조치 불요) 소켓별 만료 타이머 등록이 무조건 덮어쓰기라 동일 `client.id` 재진입
  시 이전 타이머 유실 가능 / `exp` 상한 미검증으로 이론상 32비트 `setTimeout` 오버플로 경로가
  방어되지 않음 — 둘 다 직전 라운드(`18_18_53/security.md` INFO #1·#2)에서 이미 지적됐고 "현재
  도달 불가"로 판정된 항목이며, 이번 diff 에서도 코드가 동일해 재확인만 한다
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:209` (`this.expiryTimers.set(client.id, timers)` — 기존 타이머 clear 없이 덮어씀) · `:201-207` (`Math.max(0, untilCutoff)` — `exp` 크기 상한 없음)
  - 상세: `handleConnection` 은 신규 연결마다 고유 `client.id` 로 한 번만 호출되고(`connectionStateRecovery` 미사용), access token TTL 은 900초로 고정돼 32비트 오버플로(~24.8일) 근접 불가 — 실사용 리스크는 이번에도 관측되지 않는다.
  - 제안: 조치 불요. 향후 connection state recovery 도입이나 TTL 가변화가 생기면 재평가.

## 검토했으나 이상 없음으로 판단한 항목

- **인젝션**: 신규 코드에 SQL/커맨드/경로 탐색 등 인젝션 표면 없음. `exp` 는 `jwtService.verify()`
  서명 검증을 통과한 페이로드에서만 읽고(`websocket.gateway.ts:236, 243`), `client.emit`
  payload(`message`, `expiresAt`)는 고정 문자열/서버 계산값이며 사용자 입력을 반영하지 않는다.
- **하드코딩된 시크릿**: 없음. 테스트 픽스처의 `"valid-jwt"`류 문자열은 mock 이지 실제 시크릿이
  아니다. 커밋된 리뷰/컨시스턴시 산출물(파일 12~62, `_retry_state.json`·`meta.json` 포함)에도
  API 키·비밀번호·토큰·인증서 패턴 검색(`grep -rniE 'api[_-]?key|secret|password|BEGIN.*PRIVATE
  KEY|AKIA[0-9A-Z]{16}'`) 결과 실제 시크릿 없음 — `PASSWORD_INVALID`/`INVALID_PASSWORD` 에러 코드
  명명 논의(무관한 기존 기능 언급)만 매칭됐다. 참고: `review/code/2026/09/02/17_38_12/_prompts/`
  등 `_prompts/` 하위는 `.gitignore:38`(`review/**/_prompts/`)로 커밋 대상이 아니므로 이번 diff
  스코프 밖.
- **인증/인가**: `armExpiryTimers` 가 소비하는 `exp` 는 서명 검증을 통과한 페이로드에서만 읽어 공격자가
  임의 조작으로 타이머를 흔들 수 없다. 이 변경 자체가 기존 인가 갭(만료 토큰의 무기한 소켓 인가)을
  닫는 보강이다. `client.emit`(신규 `auth.token_expired`) 은 해당 소켓에만 전송되며(`server.to(channel).emit`
  브로드캐스트 아님) 다른 사용자에게 노출되지 않는다.
- **입력 검증**: `typeof expSeconds !== 'number' || !Number.isFinite(expSeconds)` 가드로 `exp`
  부재/비정상 시 타이머를 걸지 않는 fail-safe(`websocket.gateway.ts:174`).
- **암호화**: 신규 해시/암호화 로직 없음. 기존 JWT 서명 검증 경로 그대로 사용.
- **에러 처리**: catch 블록은 스택트레이스·내부 구현 정보를 클라이언트에 노출하지 않는다
  (`client.emit('error', { message: 'Invalid token' })` 등 기존 패턴 그대로). 프론트
  `console.error("[ws] Token refresh failed (${why}):", refreshErr)`(`ws-client.ts:79`) 는
  브라우저 콘솔에만 남고 `why` 는 고정 리터럴 3종(`"connect_error"`/`"auth.token_expired"`/
  `"io server disconnect"`)만 사용해 사용자 입력을 반영하지 않는다 — `connect_error` 경로는
  이번 diff 이전부터 있던 동일 로깅 패턴.
- **의존성 보안**: 신규 의존성 없음. 기존 `socket.io-client`(v4.8.3) 사용 방식만 정정.
- **정보 노출**: `auth.token_expired` payload(`message`, `expiresAt`)에 PII·내부 구현 세부 없음.
  사용자 가이드 문서(`password-and-sessions*.mdx`) 신규 Callout 도 일반적 동작 설명일 뿐 민감정보
  없음.

## 요약

이번 diff 는 "핸드셰이크 이후 토큰이 재검증되지 않아 만료된 토큰으로도 WS 세션이 무기한
유지된다"는 CWE-613 계열 세션 관리 취약점을 닫는 보안 개선이며, 직전 2라운드가 지적한 Critical
(사전 통지 재연결이 `connect()` no-op 에 막혀 무효화)·Warning(재진입 가드 누락)이 현재 코드에
실측 반영돼 있다. 신규 인젝션·하드코딩 시크릿·인가 우회·정보 노출·암호화 결함은 발견되지 않았고,
커밋된 리뷰/컨시스턴시 산출물에도 실제 시크릿 노출은 없다. 유일하게 재확인할 가치가 있는 항목은
명시적 세션 revoke 가 이미 열린 WS 소켓의 access token 자체는 무효화하지 못해 최대 15분의 인가
전파 지연이 남는다는 점인데, 이는 spec Rationale 이 명시적으로 승인하고 두 라운드에 걸쳐 검토됐으며
이번 diff 에서 사용자 가이드에 그 창을 명문화한, 의도된 설계다. 나머지 두 건(타이머 재진입 덮어쓰기,
`exp` 상한 미검증)도 직전 라운드에서 "현재 도달 불가"로 판정된 채 변화가 없다. 이번 diff 를
차단할 보안 사안은 없다.

## 위험도

LOW
