# 보안(Security) 코드 리뷰

## 범위 및 방법

`auth.token_expired` — WS 소켓 수명을 JWT access token 수명에 종속시키는 기능
(`spec/5-system/6-websocket-protocol.md` §1.2/§1.3/§4.6/§6.1/§9.2,
Rationale `R-ws-socket-lifetime-binds-token`)의 **4라운드째 리뷰**다. 이전 세 라운드
(`review/code/2026/09/02/17_38_12/`, `18_18_53/`, `18_45_43/`)에서 이미 Critical 2건·
Warning 다수가 조치됐고, 직전 보안 리뷰(`18_45_43/security.md`)는 위험도 **LOW** 로
판정했다. 이번 diff(`origin/main...HEAD`)의 실질 변경은 3R 리뷰(`18_45_43/`)가 지적한
concurrency 버그(§W1 cross-generation race, §W2 in-flight 가드 리셋, 핸들러가 promise 를
버리던 문제)를 고친 커밋 `e5b683d75` 한 건 + 그 리뷰 산출물 커밋이다. `git diff
origin/main...HEAD -- codebase/` 로 코드 diff 를 직접 열어 재검증했다.

- `codebase/backend/src/modules/websocket/websocket.gateway.ts` — 이번 diff 에서 코드
  변경 없음(3R 이후 그대로). `armExpiryTimers`/`handleConnection`/`handleDisconnect` 재확인만.
- `codebase/frontend/src/lib/websocket/ws-client.ts` — `refreshAndReconnect` 헬퍼에
  `mySocket` 스냅샷 + 세대 비교(`socket !== mySocket`) 추가, 세 핸들러가 promise 를
  반환하도록 변경.
- `codebase/frontend/src/lib/websocket/__tests__/ws-client.test.ts`,
  `codebase/backend/.../websocket.gateway.spec.ts`,
  `codebase/backend/.../websocket-events.types.{ts,spec.ts}` — 테스트/타입, 신규 보안
  표면 없음.
- `CHANGELOG.md`, `plan/in-progress/*.md`,
  `codebase/frontend/.../password-and-sessions*.mdx` — 문서. revoke 카브아웃을 "최대
  15분" 으로 사용자에게 명문화(설계 의도, 이미 2~3라운드에 걸쳐 검토·수용됨).
- `review/code/**`, `review/consistency/**` — 리뷰/컨시스턴시 산출물 커밋. 코드 아님 —
  시크릿 노출 여부만 재확인.

## 발견사항

이번 라운드에서 새로 발견된 CRITICAL/WARNING 은 없다. 3R 이 고친 concurrency 버그를
직접 추적했다:

- 수정 전(2R 상태): `refreshAndReconnect` 가 `await refreshAccessToken()` 뒤에 클로저
  공유 변수 `socket` 을 그대로 참조 — 그 사이 `connect()` 가 다시 불려 소켓 세대가
  바뀌면, 옛 세대의 재발급이 **새로 연결된 소켓을 끊고 다시 붙이는** 예기치 않은
  disconnect 를 유발할 수 있었다(reliability 버그. 별도 사용자 없이는 인가 우회로
  이어지지 않지만 §9.2 "끊김 없음" 계약을 다시 깨는 경로였다).
- 수정 후(현재 코드, `ws-client.ts`): 진입 시점 `mySocket = socket` 스냅샷 +
  `if (!newToken || !mySocket || socket !== mySocket) return;` 세대 비교. 세대가
  바뀐 뒤에는 옛 소켓에 새 토큰을 대입하지도, `disconnect()`/`connect()` 를 걸지도
  않는다 — 코드를 직접 읽어 확인. 새로 추가된 테스트
  (`ws-client.test.ts`, "옛 세대의 재발급은 새 소켓을 건드리지 않는다")가 `gen2` 뿐
  아니라 `gen1.connect` 도 호출되지 않음을 단언해 스냅샷-only 로는 못 잡던 "옛 세대
  부활" 경로까지 덮는다.
- 로그아웃 경로와의 상호작용도 확인: 모듈의 `disconnect()`(사용자 명시적 로그아웃)가
  `socket = null` 로 설정하면, 진행 중이던 `refreshAndReconnect` 는 `socket !==
  mySocket`(`null !== mySocket`) 로 걸려 재연결을 시도하지 않는다 — 로그아웃 후 stale
  토큰으로 소켓이 되살아나는 경로 없음.
- 세 핸들러(`connect_error`/`auth.token_expired`/`disconnect`)가 이제 promise 를
  반환하는 변경은 socket.io 가 반환값을 무시하므로 런타임 동작에 영향 없고, 테스트
  가시성만 개선한다 — 보안 성격 변경 아님.

새로 열린 보안 표면은 없다. 아래는 이전 라운드에서 이미 검토·수용된 항목의 재확인이다
(코드 변화 없음, 참고용으로만 유지):

- **[INFO]** (재확인, 조치 불요) 명시적 세션 revoke(다른 기기 로그아웃 등) 후에도 이미
  열려 있던 WS 소켓은 access token 자연 만료 시각까지(최대 900초, 사전 통지는 그 60초
  전) 계속 인가된 채 이벤트를 수신한다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` 의
    `armExpiryTimers` 바로 위 JSDoc("닫는 범위는 자연 만료뿐이다" 단락) ·
    `codebase/frontend/src/content/docs/07-workspace-and-team/password-and-sessions.mdx:68-74`
    / `.en.mdx:52-58`(이번 diff 에서 "최대 15분" 으로 사용자 대면 명문화).
  - 상세: spec Rationale `R-ws-socket-lifetime-binds-token` 이 명시적으로 승인한
    스코프이고, 1~3R 이 이미 반복 검토·수용했다. 계정 탈취·강제 로그아웃 대응처럼
    "즉시 차단" 을 기대하는 위협 모델에서는 여전히 유의미한 정보라 재확인만 해 둔다.
  - 제안: 조치 불요(설계 의도, 문서화 완료). "강제 즉시 세션 종료" 요구가 생기면
    access token revocation list 같은 별도 설계가 필요하다는 점만 인지.

- **[INFO]** (재확인, 조치 불요) `expiryTimers` 등록은 무조건 덮어쓰기이고 `exp` 크기
  상한 검증이 없다.
  - 위치: `websocket.gateway.ts`(`armExpiryTimers` 내부 `this.expiryTimers.set(...)`,
    `Math.max(0, untilCutoff)`).
  - 상세: `handleConnection` 이 연결마다 고유 `client.id` 로 1회만 호출되고 access
    token TTL 이 900초 고정이라(connectionStateRecovery 미사용) 32비트 `setTimeout`
    오버플로(~24.8일)에 근접하지 않는다 — 2R/3R 에서 "현재 도달 불가"로 판정된 항목,
    코드 변화 없음.
  - 제안: 조치 불요. TTL 가변화·connection state recovery 도입 시 재평가.

- **[INFO]** 참고 — 재발급 실패 로깅(`console.error(...refreshErr)`)이 이번 diff 에서
  `connect_error` 1개 트리거에서 `connect_error`/`auth.token_expired`/`disconnect`
  3개 트리거로 확장됐다.
  - 위치: `codebase/frontend/src/lib/websocket/ws-client.ts` (`refreshAndReconnect`
    내부 `catch (refreshErr) { console.error(...) }`).
  - 상세: 로깅 패턴 자체(브라우저 콘솔에만 출력, `why` 는 고정 리터럴 3종)는 diff
    이전부터 있던 것을 그대로 재사용한 것이라 새로운 결함은 아니다. 다만 `refreshErr`
    가 axios 에러일 경우 `error.config.headers.Authorization`(당시 access token)이
    `console.error` 로 개발자 콘솔에 펼쳐질 수 있는 기존 관례가, 트리거 지점이 1곳에서
    3곳으로 늘며 발생 빈도가 늘 수 있다. 서버/네트워크로 전송되지 않고 사용자 자신의
    브라우저 devtools 안에만 남으므로 위협 모델상 낮다.
  - 제안: 조치 불요(범위 밖 — 이번 diff 가 새로 만든 로깅 방식이 아님). 필요하면
    별도 후속으로 `refreshErr` 를 `error.message` 만 뽑아 로깅하도록 정리 가능.

## 검토했으나 이상 없음으로 판단한 항목

- **인젝션**: 신규/변경 코드에 SQL·커맨드·경로 탐색 인젝션 표면 없음. `exp` 는
  `jwtService.verify()` 서명 검증을 통과한 페이로드에서만 읽고(`websocket.gateway.ts`
  `handleConnection` 내부), `client.emit` payload(`message`, `expiresAt`)는 서버
  계산값·고정 문자열이며 사용자 입력을 반영하지 않는다.
- **하드코딩된 시크릿**: 없음. `git diff origin/main...HEAD | grep -niE
  'api[_-]?key|secret|password\s*=|BEGIN.*PRIVATE KEY|AKIA...'` 재확인 결과 실제
  시크릿 매칭 없음(이전 라운드 리뷰 문구 인용만 매칭). 테스트 픽스처
  `"old-token"`/`"new-token"`/`"valid-jwt"` 는 mock 문자열.
- **인증/인가**: `armExpiryTimers` 가 소비하는 `exp` 는 서명 검증 통과 페이로드
  전용이라 공격자가 임의 조작으로 타이머를 흔들 수 없다. 이번 라운드 수정(세대 비교)은
  오히려 "로그아웃 후 stale 소켓 되살아남" 경로를 닫아 인가 경계를 더 좁힌다.
  `client.emit(AuthEventType.AUTH_TOKEN_EXPIRED, ...)` 는 해당 소켓 단독 전송이고
  브로드캐스트가 아니다.
- **입력 검증**: `typeof expSeconds !== 'number' || !Number.isFinite(expSeconds)`
  가드 유지(변경 없음).
- **암호화**: 신규 해시/암호화 로직 없음.
- **에러 처리**: catch 블록들이 스택트레이스·내부 구현 정보를 클라이언트에 노출하지
  않는다. 위 INFO 참고 항목 제외하면 새로운 정보 노출 경로 없음.
- **의존성 보안**: 신규 의존성 없음. 기존 `socket.io-client@4.8.3` 사용 방식만 정정.
- **정보 노출**: `password-and-sessions*.mdx` 신규 Callout 은 일반적 동작 설명(자동
  재연결·최대 15분 창)일 뿐 PII·내부 구현 세부 없음.

## 요약

이번 diff 는 3라운드 리뷰가 지적한 concurrency 버그(옛 세대 소켓이 재발급 완료 시점에
새 소켓을 끊거나 스스로 되살아나는 경로)를 `mySocket` 스냅샷 + 세대 비교로 닫는
수정이며, 코드를 직접 열어 스냅샷·세대비교·로그아웃 상호작용 세 갈래를 모두
확인했다 — 새로 열린 인젝션·인증우회·시크릿노출·암호화 결함은 없다. 이전 라운드에서
이미 "설계 의도로 수용"된 두 INFO(revoke 카브아웃 최대 15분 창, 타이머 덮어쓰기/32비트
상한 도달 불가)는 코드 변화가 없어 재확인만 했고, 재발급 실패 로깅이 트리거 3곳으로
확장된 점은 기존 관례의 연장이라 참고 수준으로만 남긴다. 이번 diff 를 차단할 보안
사안은 없다.

## 위험도

LOW
