# 보안(Security) 코드 리뷰

## 범위 및 사전 확인

WS 소켓 수명을 JWT access token 수명에 종속시키는 기능(`spec/5-system/6-websocket-protocol.md`
§1.2/§1.3/§4.6/§6.1/§9.2, Rationale `R-ws-socket-lifetime-binds-token`)의 4라운드 누적 diff.
이 기능은 직전 두 라운드(`review/code/2026/09/02/17_38_12/`, `18_18_53/`)에서 이미 보안 관점
리뷰(`security.md`)를 거쳤으므로, 이번 라운드는 (a) 그 두 라운드 이후 실제로 변경된 코드가
있는지 diff 로 재확인하고 (b) 신규 변경분에 새 보안 결함이 있는지를 본다.

`git diff <18_18_53 리뷰 시점 커밋 a9316a0a6> HEAD` 로 대조한 결과:

- `codebase/backend/src/modules/websocket/websocket.gateway.ts` — **변경 없음**. `18_18_53/security.md`
  가 이미 평가한 상태(LOW, INFO 2건) 그대로다.
- `codebase/frontend/src/lib/websocket/ws-client.ts` — 2R/3R/4R 에서 세 가지가 추가됨: (1) `inFlight`
  in-flight promise 가드(2R, 동시 재발급 중복 실행 방지), (2) `mySocket` 세대 스냅샷(3R, `await` 중
  `connect()` 재호출로 소켓 인스턴스가 바뀌는 경우 옛 세대 결과가 새 소켓에 적용되는 것을 차단),
  (3) 핸들러가 promise 를 반환하도록 정리(3R/4R, 테스트 가능성 개선, 런타임 동작은 동일).
- 그 외 변경은 JSDoc 정정(`websocket-events.types.ts`, 4R)과 중복 빈 줄 제거(4R) — 코드 로직 없음.

먼저 이 기능 자체가 닫는 취약점을 다시 짚는다: **종전에는 핸드셰이크 이후 토큰을 한 번도
재검증하지 않아, 만료된 access token 으로 열린 소켓이 무기한 인가된 채 이벤트를 계속 수신했다**
— CWE-613 (Insufficient Session Expiration) 계열 결함. 이 diff 전체가 이를 닫는 보안 개선이다.

## 발견사항

- **[INFO]** 소켓별 만료 타이머 등록이 무조건 덮어쓰기라, 같은 `client.id` 로 재진입 시 이전
  타이머가 `clearTimeout` 없이 유실될 수 있음 (현재는 도달 불가 경로 — 직전 라운드부터 이월,
  미변경)
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:209`
    (`this.expiryTimers.set(client.id, timers);`, `armExpiryTimers` 내부)
  - 상세: `armExpiryTimers` 는 진입 시 `this.expiryTimers.get(client.id)` 를 먼저 clear 하지 않고
    곧장 새 항목으로 덮어쓴다. 현재 `handleConnection` 은 신규 연결마다 Socket.IO 가 새로 발급하는
    고유 `client.id` 로 정확히 한 번만 호출되므로(connection state recovery 미사용) 실사용 리스크는
    없다. 향후 같은 id 로 재연결을 허용하는 경로가 생기면 이전 타이머가 누수되거나 이미 교체된
    소켓 인스턴스에 emit/disconnect 를 걸 수 있어 세션 만료 타이밍이 어긋날 수 있다.
  - 제안: `armExpiryTimers` 진입 시 기존 항목을 먼저 clear. 지금 당장 필수는 아님.

- **[INFO]** `exp` 클레임에 대한 명시적 상한 검증이 없어, 이론상 `setTimeout` 32비트 지연
  오버플로(Node, ~24.8일 초과 시 즉시 발화) 경로가 코드로 방어되지 않음 (직전 라운드부터 이월,
  미변경)
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:206`
    (`timers.cutoff = setTimeout(..., Math.max(0, untilCutoff))`)
  - 상세: `exp` 는 `jwtService.verify(token)` 서명 검증을 통과한 페이로드에서만 읽으므로 공격자가
    임의 조작할 수 없고, 발급 측 access token TTL 은 900초로 고정돼 있어 현재는 이 값이 24.8일에
    근접할 수 없다. 발급 로직(`auth.module.ts` 등)에 향후 TTL 설정 회귀가 생기면 이 타이머가
    조용히 오작동(즉시 발화 또는 오버플로)할 수 있는 잠재적 결합이다.
  - 제안: 필수는 아님 — 이중 방어가 필요하다고 판단되면 `untilCutoff` 에 합리적 상한을 clamp.

- **[INFO]** frontend `refreshAndReconnect` 의 cross-generation 가드(3R)가 리뷰어 환경에서 76회 중
  1회 재현되었으나 원인 미확정인 flaky 관측이 있음 — 보안 경계 위반은 아니나 세션 연속성과
  맞닿아 있어 참고로 남김
  - 위치: `codebase/frontend/src/lib/websocket/ws-client.ts:60-98` (`inFlight`/`mySocket` 가드),
    관련 watch 항목: `plan/in-progress/ws-token-expired-socket-lifetime-impl.md:98-109`
  - 상세: 가드가 실패하는 극히 드문 인터리빙에서 옛 세대의 `refreshAndReconnect` 가 새 소켓
    인스턴스에 `connect()` 를 걸 가능성이 이론상 있다. 다만 적용되는 토큰은 항상 **같은 사용자
    자신의** 새로 발급된 access token 이므로(공격자가 다른 사용자의 토큰을 주입할 경로는 없음),
    최악의 경우도 인가 우회나 세션 혼선이 아니라 중복 연결 시도 수준의 신뢰성 결함이다. 재현
    실패가 부재의 증거는 아니므로 plan 에 이미 재개 신호("한 번이라도 더 실패하면 끝까지 판다")와
    함께 watch 항목으로 등재돼 있다 — 이 리뷰에서 별도 조치를 요구하지 않는다.
  - 제안: 조치 불요(추적 중). 재발 시 concurrency 관점에서 근본 원인을 확인할 것.

- **[INFO]** 사용자 가이드(mdx)가 "다른 기기 로그아웃 시 그 기기의 실시간 화면은 최대 15분 안에
  끊긴다"는 revoke 카브아웃의 유예 창을 사용자에게 명시적으로 공개함 — 의도된 설계이며 이번
  라운드에서 신규로 지적하는 결함은 아니고 투명성 확인 차원의 기록
  - 위치: `codebase/frontend/src/content/docs/07-workspace-and-team/password-and-sessions.en.mdx:52-58`,
    `codebase/frontend/src/content/docs/07-workspace-and-team/password-and-sessions.mdx:68-74`
  - 상세: 명시적 revoke(다른 기기 로그아웃)는 refresh family 만 무효화하고, 이미 발급된 access
    token 으로 열린 WS 소켓은 그 토큰의 자연 `exp`(최대 900초, 통지 lead time 포함해도 15분 미만)
    까지 살아있다 — spec Rationale 이 명시적으로 승인한 카브아웃이며 `websocket.gateway.ts` 주석과
    정확히 일치한다. 세션 무효화가 "즉시"가 아니라 "최대 15분 지연"이라는 것은 보안 관점에서
    검토할 가치가 있는 사실이지만, 그 창을 (a) 무한대에서 유계로 줄이고 (b) 사용자에게 정직하게
    공개하는 방향으로 이번 diff 가 개선했으므로 새 결함이 아니라 기존에 승인된 트레이드오프의
    정상적인 문서화로 판단한다.
  - 제안: 조치 불요.

## 검토했으나 이상 없음으로 판단한 항목

- **인젝션**: 신규/변경 코드에 SQL·커맨드·경로 탐색 등 인젝션 표면 없음. `exp` 는 서명 검증을
  통과한 값만 사용하고, `client.emit(AuthEventType.AUTH_TOKEN_EXPIRED, payload)` 의 `message`/
  `expiresAt` 은 고정 문자열/서버 계산값이며 사용자 입력을 반영하지 않는다.
- **하드코딩된 시크릿**: 없음. 테스트 픽스처의 `"valid-jwt"`/`"old-token"`/`"new-token"` 은 mock
  문자열이지 실제 시크릿이 아니다.
- **인증/인가**: `armExpiryTimers` 가 소비하는 `exp` 는 `jwtService.verify()` 서명 검증을 통과한
  페이로드에서만 읽는다 — 공격자가 임의 `exp` 를 주입해 만료 타이머를 조작할 수 없다. 프론트
  `refreshAndReconnect` 의 세대 스냅샷(`mySocket`, `socket !== mySocket` 비교)은 재발급 결과가
  스테일 소켓 인스턴스에 잘못 적용되는 경로를 새로 차단해 오히려 인가 상태 일관성을 강화했다.
  revoke 카브아웃(명시적 로그아웃이 refresh family 만 무효화)은 spec Rationale 이 승인한 범위와
  코드 주석이 정확히 일치한다.
- **입력 검증**: `armExpiryTimers` 는 `typeof expSeconds !== 'number' || !Number.isFinite(expSeconds)`
  로 방어하고, `exp` 부재/비정상 시 타이머를 걸지 않는다(fail-safe).
- **암호화**: 신규 코드에 해시/암호화 로직 없음. 기존 JWT 서명 검증 경로를 그대로 사용.
- **에러 처리**: 백엔드 인증 실패 catch 경로(`Invalid token` 류)는 이번 diff 로 변경되지 않았다.
  프론트 `console.error` 로그는 브라우저 콘솔에만 남고, 고정된 `why` 문자열(`"connect_error"`/
  `"auth.token_expired"`/`"io server disconnect"`)만 사용해 사용자 입력을 반영하지 않는다.
- **의존성 보안**: 신규 의존성 추가 없음. 기존 `socket.io-client`(v4.8.3) 사용 방식만 정정.
- **정보 노출**: `client.emit` 은 해당 소켓에만 전송되며(브로드캐스트 아님) `message`/`expiresAt`
  어디에도 PII·내부 구현 세부가 없다.
- **동시성 가드가 만든 새 표면**: `inFlight` promise 캐시와 `mySocket` 세대 스냅샷은 클로저
  지역 변수(`connect()` 호출마다 새로 생성)라 여러 사용자/세션 간에 공유되지 않는다 — cross-user
  누출 경로 없음.

## 요약

이번 diff(누적 4라운드)는 "핸드셰이크 이후 토큰이 재검증되지 않아 만료된 토큰으로도 WS 세션이
무기한 유지된다"는 실질적 세션 관리 취약점(CWE-613 계열)을 닫는 보안 개선이다. 직전 두 라운드의
보안 리뷰가 이미 백엔드(`websocket.gateway.ts`, 변경 없음)와 프론트 1R 수정(no-op 가드 우회)을
평가했고, 이번에 새로 검토한 2R~4R 변경분(in-flight 중복 방지, 세대 스냅샷, JSDoc 정정)은 코드
로직상 보안 경계를 넓히거나 좁히지 않으며 오히려 스테일 소켓에 재발급 결과가 잘못 적용되는
경로를 막아 인가 상태 일관성을 강화했다. 신규 인젝션·하드코딩 시크릿·인가 우회·정보 노출·암호화
결함은 발견되지 않았다. 남은 항목은 전부 INFO 수준(현재 도달 불가능한 경로에 대한 방어-심화
제안 2건, flaky 가드 관측 1건, 이미 승인된 revoke 카브아웃의 문서화 1건)이며 어느 것도 이 diff 를
차단할 사안이 아니다.

## 위험도

LOW
