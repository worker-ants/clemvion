# API 계약(API Contract) 리뷰

대상: WS `auth.token_expired` 소켓 수명=토큰 수명 구현. 이 changeset 은 **3라운드째 리뷰**다 —
직전 두 라운드(`review/code/2026/09/02/17_38_12/`, `review/code/2026/09/02/18_18_53/`)의
api_contract 리뷰(각 LOW)와 두 RESOLUTION.md 를 실제 코드(`git log`: `b019d7de3` 구현 →
`a9316a0a6` 1R fix → `1bd2000d5` 2R fix)로 대조 확인했다. 이번 라운드의 실질 diff 는
2R fix(`refreshAndReconnect` 내부 `inFlight` Promise 재진입 가드 — `codebase/frontend/src/lib/websocket/ws-client.ts`)와
유저 가이드 Callout 2건(`password-and-sessions.{mdx,en.mdx}`), plan/CHANGELOG 문서다.
`review/consistency/**`·`review/code/{17_38_12,18_18_53}/**` 는 프로세스 아티팩트로 API 계약과
무관해 제외.

## 발견사항

- **[INFO]** spec 이 이 이벤트를 여전히 `_(계획·미구현)_`(Planned)로 표기 — 구현 완료와 spec 배지 불일치 (직전 라운드 대비 변동 없음, 재확인)
  - 위치: `spec/5-system/6-websocket-protocol.md:876`(§4.6 표의 `auth.token_expired` 행,
    `_(계획·미구현)_` 배지) · `:1133`(Rationale, "배지는 구현 전까지 Planned 다") /
    `plan/in-progress/ws-token-expired-socket-lifetime-impl.md:84`(체크리스트 "머지 후 planner
    턴" 항목, 아직 `[ ]`)
  - 상세: backend emit(`armExpiryTimers`)·frontend 구독/재연결이 모두 구현·테스트 완료됐음을
    이번 라운드에도 코드로 재확인했다. 그런데도 spec 은 이 WS 이벤트를 "미구현"으로 표기해,
    spec 을 "이 API 가 존재하는지"의 SoT 로 읽는 소비자(다음 developer·외부 문서화 작업)가
    오판할 수 있다. developer 는 이 문구의 원저자가 아니므로 자기-반증형 소정정 예외 대상이
    아니고, 이미 plan 체크리스트에 "머지 후 planner 턴" 으로 등재돼 있어 은닉된 누락은 아니다.
  - 제안: 코드 조치 불요(재차 동의). PR 머지 후 이미 등재된 planner 턴을 실제로 수행해 배지를
    정정할 것.

- **[INFO]** 배포 전환 창 리스크 — 이미 트랙된 항목, 재확인 (직전 라운드 대비 변동 없음)
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` `armExpiryTimers` 의
    `client.disconnect()` (cutoff 타이머 콜백) · `plan/in-progress/ws-token-expired-socket-lifetime-impl.md:109`(체크리스트 미해결 항목)
  - 상세: 모든 인증된 소켓이 `exp` 도달 시 무조건 `disconnect()` 된다. Socket.IO 는 서버발신
    `disconnect()` 에 자동 재연결을 발화하지 않으므로, 이 PR 의 재연결 로직을 모르는 구버전
    프론트 번들(배포 시점에 이미 열려 있던 탭)은 최대 900초 뒤 무통지·복구 불가로 끊긴다.
    1R api_contract 리뷰가 WARNING(W6)으로 지적했고 코드로 해결할 문제가 아니라고 판단해 배포
    런북 등재만 남겼는데, 그 체크박스는 여전히 `[ ]` 미해결이다.
  - 제안: 코드 조치 불요(재차 동의). PR 머지 전/직후 배포 런북에 "FE 우선 배포 또는 900초 이내
    무통지 이탈 감내" 판단을 실제로 기록해 체크리스트를 닫을 것.

## 이번 라운드 신규 diff(`inFlight` 재진입 가드) 검토 — 이상 없음

- `refreshAndReconnect` 에 `inFlight: Promise<void> | null` 가드가 추가돼 `connect_error` ·
  `auth.token_expired` · `disconnect(io server disconnect)` 세 트리거가 동시에 겹쳐도
  `refreshAccessToken()`(REST `/auth/refresh`)이 중복 호출되지 않는다 — 클라이언트가 서버로
  보내는 요청 형태(REST 요청 자체의 파라미터·헤더)는 변경 없고 **호출 빈도만 dedup** 되므로
  API 계약 관점에서 breaking 요소 없음.
- 두 번째 이후 트리거가 첫 트리거의 in-flight Promise 를 공유해 자신의 `why`(로그 접두사)를
  잃는 점은 관측했으나(예: `connect_error` 로 시작한 갱신이 실패해도 그사이 도착한
  `auth.token_expired` 트리거는 자신의 실패 이유로 로그되지 않음), 이는 순수 클라이언트 로깅
  관측성 이슈이며 wire 프로토콜·요청/응답 계약에는 영향이 없다 — API 계약 범주 밖으로 판단.

## 검토했으나 이상 없음으로 판단한 항목 (직전 라운드 판정 유지)

- **하위 호환성/버전 관리**: `AuthEventType.AUTH_TOKEN_EXPIRED = 'auth.token_expired'` 는
  emit-only 신규 이벤트로 순수 additive. `KNOWN_WS_EVENTS`(inbound 화이트리스트,
  `websocket.gateway.ts:41-50`)에 넣지 않은 것도 emit-only 라 올바름(재확인).
- **응답 형식/스키마**: `AuthTokenExpiredPayload { message: string; expiresAt: string }` 는
  spec §4.6 표·Rationale·구현이 문구 단위로 일치.
- **에러 응답**: cutoff `disconnect()` 는 `error` 이벤트 없이 곧장 끊고, 핸드셰이크 인증
  실패는 `client.emit('error', {message})` 후 `disconnect()` — 신호 방식이 두 갈래이지만
  spec §6.1/§9.2 가 사전 통지를 원인 신호로 명시 설계했으므로 계약 위반 아님.
- **요청 검증**: `armExpiryTimers` 의 `typeof expSeconds !== 'number' || !Number.isFinite(...)`
  가드 유효, `exp` 는 서명 검증을 통과한 JWT payload 값만 진입.
- **URL/경로 설계·페이지네이션**: 해당 없음 — REST 엔드포인트·목록 API 변경 없음.
- **인증/인가**: 핸드셰이크 이후 토큰을 재검증하지 않던 실재 인가 갭을 닫는 보강. revoke
  카브아웃(자연 만료까지만 유효)도 spec Rationale 명시 범위와 코드 주석이 일치.

## 요약

이번 3라운드 diff 의 실질은 프론트 `refreshAndReconnect` 재진입 가드(`inFlight`)와 유저
가이드 Callout·plan 체크박스 갱신으로, WS wire 계약(이벤트명·payload shape·인증 흐름)에
영향을 주는 변경은 없다. 직전 두 라운드에서 이미 검증된 API 계약 항목(additive 이벤트,
payload 스키마, revoke 카브아웃, 인가 강화)은 재확인 결과 그대로 유지된다. 남은 항목은 코드가
아니라 절차·문서 성격의 INFO 2건뿐이다 — (1) spec 의 `_(계획·미구현)_` 배지가 구현 완료와
어긋나 있고, (2) 배포 전환 창 리스크가 런북 기록 미완 상태다. 둘 다 developer 권한 밖이거나
"코드로 해결할 문제가 아님"으로 이미 판정돼 plan 체크리스트에 등재돼 있어 새 조치 요구가
아니라 재확인 기록이다. 신규 CRITICAL/WARNING 급 API 계약 위반은 발견되지 않았다.

## 위험도

LOW
