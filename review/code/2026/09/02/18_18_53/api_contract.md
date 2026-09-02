# API 계약(API Contract) 리뷰

대상: WS `auth.token_expired` 소켓 수명=토큰 수명 구현 (`websocket-events.types.ts` /
`websocket.gateway.ts` / `websocket.gateway.spec.ts` / `ws-client.ts` / `ws-client.test.ts`) +
관련 plan/CHANGELOG 문서. 이 changeset 은 **2라운드째 리뷰**다 — 직전 라운드
(`review/code/2026/09/02/17_38_12/`)의 api_contract 리뷰(LOW, WARNING 1·INFO 2)와
RESOLUTION.md(C1/C2/W3/W4 조치, W6 등재)를 실제 코드(`git log`: `b019d7de3` 구현 →
`a9316a0a6` 리뷰 1R fix)로 대조 확인했다. `review/consistency/**`·`review/code/17_38_12/**` 는
프로세스 아티팩트로 API 계약과 무관해 제외.

## 발견사항

- **[INFO]** 배포 전환 창 리스크 — 이미 트랙된 항목, 재확인
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:170`(`armExpiryTimers`) ·
    `plan/in-progress/ws-token-expired-socket-lifetime-impl.md:87`(체크리스트 미체크 항목)
  - 상세: 모든 인증된 소켓이 `exp` 도달 시 무조건 `disconnect()` 된다(코드 확인 완료 —
    `client.disconnect()` at `websocket.gateway.ts:204`). Socket.IO 는 서버발신 `disconnect()`
    에 자동 재연결을 발화하지 않으므로, 이 PR 의 재연결 로직을 모르는 구버전 프론트 번들
    (배포 시점에 이미 열려 있던 탭)은 최대 900초 뒤 무통지·복구 불가로 끊긴다. 직전 라운드
    api_contract 리뷰가 이미 WARNING 으로 지적했고, RESOLUTION.md 는 "코드로 해결할 문제가
    아니다"로 판단해 `ws-token-expired-socket-lifetime-impl.md` 체크리스트("배포 전환 창
    리스크… 배포 런북에 남길 것")에 등재만 했다 — 현재도 그 항목은 `[ ]` 미해결 상태다.
    코드 자체에 새로운 문제는 없고, 배포 운영 판단(런북 기록)이 아직 실행되지 않았다는
    사실만 남아 있다.
  - 제안: 코드 조치 불요(재차 동의). PR 머지 전/직후 배포 런북에 "FE 우선 배포 또는 900초
    이내 무통지 이탈 감내" 판단을 실제로 기록해 체크리스트를 닫을 것 — 항목이 열린 채로
    다음 배포자에게 넘어가지 않도록.

- **[INFO]** spec 이 이 이벤트를 여전히 `_(계획·미구현)_`(Planned)로 표기 — 구현 완료와 spec 배지 불일치
  - 위치: `spec/5-system/6-websocket-protocol.md:876`(§4.6 표의 `auth.token_expired` 행,
    `_(계획·미구현)_` 배지) · `:28`(intro) · `:1100`·`:1133`(Rationale, "**backend emit 은
    구현 대기**" / "배지는 구현 전까지 Planned 다")
  - 상세: 이번 diff(파일 1~7)가 정확히 그 backend 타이머·emit·frontend 구독/재연결을
    구현했음을 코드로 확인했다(`AuthEventType.AUTH_TOKEN_EXPIRED` emit, `armExpiryTimers`,
    `ws-client.ts` 의 `auth.token_expired`/`disconnect` 핸들러). 그런데 spec 은 아직 이
    이벤트를 "미구현"으로 표기한다. spec 을 "이 API 가 실제로 존재하는지"의 SoT 로 읽는
    소비자(다음 developer·외부 문서화 작업)는 이 엔드포인트가 아직 없다고 오판할 수 있다.
    developer 는 이 문구의 원저자가 아니므로 자기-반증형 소정정 예외 대상이 아니고, 이미
    `ws-token-expired-socket-lifetime-impl.md:84-86`("머지 후 planner 턴 — spec 배지 flip")에
    후속 조치로 등재돼 있다 — 은닉된 누락은 아니다.
  - 제안: 코드 조치 불요. 이미 등재된 planner 턴을 PR 머지 후 실제로 수행해 배지를 정정할 것.

## 검토했으나 이상 없음으로 판단한 항목 (직전 라운드 대비 재검증)

- **하위 호환성/버전 관리**: `AuthEventType.AUTH_TOKEN_EXPIRED = 'auth.token_expired'` 는
  emit-only 신규 이벤트로 순수 additive — 기존 클라이언트가 구독하지 않으면 영향 없음.
  `KNOWN_WS_EVENTS`(inbound 화이트리스트)에 넣지 않은 것도 emit-only 라 올바르다.
- **응답 형식/스키마**: `AuthTokenExpiredPayload { message: string; expiresAt: string }` 는
  spec §4.6 표(`{ message, expiresAt }`)·Rationale(`:1148`, "이 소켓이 강제 종료되는 시각")과
  코드(`websocket.gateway.ts:194-198`) 가 문구 단위로 일치. `expiresAt` 3중 명명 충돌
  (`_retryState.expiresAt`·`auth.refreshed.expiresAt`)도 JSDoc·spec 양쪽에 명시적으로 구분됨.
- **에러 응답**: 만료 cutoff 의 `disconnect()` 는 `error` 이벤트 없이 곧장 끊는 반면, 핸드셰이크
  인증 실패는 `client.emit('error', {message})` 후 `disconnect()` 한다(`:222-223`,
  `:265-266`) — 신호 방식이 두 갈래이지만 spec §6.1/§9.2 가 사전 통지(`auth.token_expired`)를
  원인 신호로 명시 설계했으므로 계약 위반은 아니다(직전 라운드 INFO 와 동일 결론, 재확인).
- **요청 검증**: `armExpiryTimers` 의 `typeof expSeconds !== 'number' || !Number.isFinite(...)`
  가드(`:174`)는 유효. `exp` 는 이미 서명 검증을 통과한 JWT payload 값만 들어와 공격자 조작
  불가.
- **URL/경로 설계·페이지네이션**: 해당 변경에 REST 엔드포인트·목록 API 변경 없음 — 해당 없음.
- **인증/인가**: 이 변경은 "핸드셰이크 이후 토큰을 재검증하지 않아 만료된 토큰으로도 소켓이
  무기한 인가되던" 실재 갭을 닫는 보강이다. revoke 카브아웃(자연 만료까지만 유효, 명시적
  revoke 는 대상 아님)도 spec Rationale 명시 범위와 코드 주석(`:162-164`)이 일치.
- **직전 라운드 CRITICAL(no-op `connect()`)·WARNING(export 완전성 목록 누락)**: API 계약
  범주 밖(각각 requirement/testing·documentation 소관)이었고 현재 코드에서 실제로 조치됨을
  확인했다 — `ws-client.ts:66-67`(`if (socket.connected) socket.disconnect(); socket.connect();`),
  `websocket-events.types.spec.ts:65-66`(`EXPECTED_EXPORTS` 에 신규 심볼 2개 추가).

## 요약

이번 diff 는 WS 채널에 신규 서버 emit 이벤트(`auth.token_expired`, `{message, expiresAt}`)를
additive 로 추가해 실재하던 인가 갭(만료된 토큰으로도 소켓이 무기한 인가되던 문제)을 닫는다.
이벤트 네이밍·페이로드 shape·요청측 검증·인가 강화는 spec(§1.2/§4.6/§9.2)과 코드 확인 결과
정확히 정합한다. 직전 라운드에서 발견된 API 계약 관련 항목(배포 전환 창 리스크)은 이미
plan 에 등재돼 코드 조치 대상이 아니며 여전히 미해결 상태로 남아 있어 INFO 로 재확인했고,
추가로 spec 의 "Planned/미구현" 배지가 실제 구현 완료와 어긋나는 것도 이미 후속 조치로
트랙된 항목이라 INFO 로 기록한다. 새로운 CRITICAL/WARNING 급 API 계약 위반은 발견되지
않았다.

## 위험도

LOW
