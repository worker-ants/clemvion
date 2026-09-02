# API 계약(API Contract) 리뷰

대상: WS `auth.token_expired` 소켓 수명=토큰 수명 구현
(`websocket-events.types.ts` / `websocket.gateway.ts` / `ws-client.ts` + 대응 spec/test +
유저 가이드 Callout + plan/CHANGELOG). 이 changeset 은 **4라운드째 리뷰**다 — 직전 세 라운드
(`review/code/2026/09/02/{17_38_12,18_18_53,18_45_43}/`)의 api_contract 리뷰(각 LOW)와
RESOLUTION.md 를 실제 코드(`git log`: `b019d7de3` 구현 → `a9316a0a6` 1R → `1bd2000d5` 2R →
`e5b683d75` 3R, 현재 HEAD)로 직접 대조 확인했다. `git status --short` 로 확인한 결과 이번
라운드에 애플리케이션 코드(`codebase/**`)의 신규 미검토 diff는 없다 — 워킹트리에서 유일한
변경은 `review/code/2026/09/02/19_12_36/`(이번 리뷰 세션 자신의 출력) 뿐이며, 프롬프트에 함께
포함된 파일 12~78(과거 3개 라운드의 `review/code/**`·`review/consistency/**` 아티팩트)은 이미
이전 라운드에서 검토·조치된 프로세스 산출물로 API 계약과 무관해 이번 판정에서 제외한다.

## 이번 라운드 재검증 — 코드 직접 열람

`Read` 로 다음을 직접 확인했다 (3R RESOLUTION 의 주장을 받아쓰지 않고 대조):

- `websocket.gateway.ts` — `armExpiryTimers`(§1.2), `handleConnection`/`handleDisconnect` 의
  타이머 arm/disarm, `AuthEventType.AUTH_TOKEN_EXPIRED` emit, `KNOWN_WS_EVENTS`(인바운드
  화이트리스트)에 `auth.token_expired` 미포함(emit-only라 올바름) — 3R 기술과 일치.
- `ws-client.ts` — `refreshAndReconnect`(스냅샷 `mySocket` + `inFlight` 재진입 가드 +
  세대 비교 `socket !== mySocket` + 명시적 `disconnect()`→`connect()`), 세 트리거
  (`connect_error`·`auth.token_expired`·`disconnect("io server disconnect")`)가 모두 이
  헬퍼로 위임 — 3R 기술과 일치.
- `websocket-events.types.ts`/`.spec.ts` — `AuthEventType`/`AuthTokenExpiredPayload` export,
  `EXPECTED_EXPORTS` 완전성 목록에 반영 — 1R W3 조치가 유지됨.
- `spec/5-system/6-websocket-protocol.md:876` — `auth.token_expired` 행이 여전히
  `_(계획·미구현)_` 배지. `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` 체크리스트의
  "머지 후 planner 턴" 항목도 여전히 `[ ]`. 변동 없음.

## 발견사항

- **[INFO]** spec 이 이 이벤트를 여전히 `_(계획·미구현)_`(Planned)로 표기 — 구현 완료와 spec 배지 불일치 (3라운드 연속 재확인, 변동 없음)
  - 위치: `spec/5-system/6-websocket-protocol.md:876`(§4.6 표) · `:1133`(Rationale) /
    `plan/in-progress/ws-token-expired-socket-lifetime-impl.md`의 "머지 후 planner 턴" 체크리스트 항목(`[ ]`)
  - 상세: backend emit·frontend 구독/재연결 모두 구현·테스트 완료가 코드로 재확인됐지만 spec
    배지는 그대로다. developer 는 이 문구의 원저자가 아니므로 자기-반증형 소정정 예외 대상이
    아니고, 이미 plan 에 "머지 후 planner 턴"으로 등재돼 있어 은닉된 누락은 아니다.
  - 제안: 코드 조치 불요(3라운드째 동일 결론). PR 머지 후 이미 등재된 planner 턴을 실제로
    수행해 배지를 정정할 것.

- **[INFO]** 배포 전환 창 리스크 — 이미 트랙된 항목, 재확인 (변동 없음)
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` `armExpiryTimers` 의
    cutoff 타이머 콜백(`client.disconnect()`) · `plan/in-progress/ws-token-expired-socket-lifetime-impl.md`
    "배포 전환 창 리스크" 체크리스트 항목(`[ ]`)
  - 상세: 모든 인증된 소켓이 `exp` 도달 시 무조건 `disconnect()` 된다. Socket.IO 는 서버발신
    `disconnect()`에 자동 재연결을 발화하지 않으므로, 이 재연결 로직을 모르는 구버전 프론트
    번들(배포 시점에 이미 열려 있던 탭)은 최대 900초 뒤 무통지·복구 불가로 끊긴다. 1R 이
    WARNING(W6)으로 지적했고 "코드로 해결할 문제가 아니다"로 판단해 배포 런북 등재만
    남겼는데, 그 체크박스는 여전히 미해결이다.
  - 제안: 코드 조치 불요(재차 동의). PR 머지 전/직후 배포 런북에 판단을 실제로 기록해
    체크리스트를 닫을 것.

## 검토했으나 이상 없음으로 판단한 항목 (직전 라운드 판정 유지, 재확인)

- **하위 호환성/버전 관리**: `AuthEventType.AUTH_TOKEN_EXPIRED = 'auth.token_expired'`는
  emit-only 신규 이벤트로 순수 additive — 기존 클라이언트가 구독하지 않으면 영향 없음.
  `KNOWN_WS_EVENTS`에 넣지 않은 것도 emit-only라 올바름.
- **응답 형식/스키마**: `AuthTokenExpiredPayload { message: string; expiresAt: string }`는
  spec §4.6 표·Rationale·구현이 문구 단위로 일치. `expiresAt` 3중 명명 충돌(`_retryState.expiresAt`·
  `auth.refreshed.expiresAt`)도 JSDoc·spec 양쪽에 명시적으로 구분.
- **에러 응답**: cutoff `disconnect()`는 `error` 이벤트 없이 곧장 끊고, 핸드셰이크 인증 실패는
  `client.emit('error', {message})` 후 `disconnect()` — 신호 방식이 두 갈래이지만 spec
  §6.1/§9.2가 사전 통지를 원인 신호로 명시 설계했으므로 계약 위반 아님.
- **요청 검증**: `armExpiryTimers`의 `typeof expSeconds !== 'number' || !Number.isFinite(...)`
  가드 유효, `exp`는 서명 검증을 통과한 JWT payload 값만 진입 — 공격자 조작 불가.
- **URL/경로 설계·페이지네이션**: 해당 없음 — REST 엔드포인트·목록 API 변경 없음.
- **인증/인가**: 핸드셰이크 이후 토큰을 재검증하지 않던 실재 인가 갭(만료 토큰으로 무기한
  인가)을 닫는 보강. revoke 카브아웃(자연 만료까지만 유효, 명시적 revoke는 대상 아님)도
  spec Rationale 명시 범위와 코드 주석이 일치.
- **동시성 가드(`inFlight`)**: REST 요청 자체의 파라미터·헤더는 변경 없고 호출 빈도만 dedup —
  API 계약 관점에서 breaking 요소 없음(3R 신규 diff, 재확인).

## 요약

이번 4라운드 재검토에서 애플리케이션 코드에 새로운 diff는 없었다(워킹트리 신규 변경은 이
리뷰 세션 자신의 산출물뿐). 직접 `Read`로 대조한 결과 WS wire 계약(이벤트명·payload shape·
인증 흐름·재진입 가드)은 3라운드 전체에 걸쳐 이미 검증된 상태 그대로 유지되고 있다.
남은 항목은 코드가 아니라 절차·문서 성격의 INFO 2건뿐이다 — (1) spec의 `_(계획·미구현)_`
배지가 구현 완료와 어긋나 있고, (2) 배포 전환 창 리스크가 런북 기록 미완 상태다. 둘 다
developer 권한 밖이거나 "코드로 해결할 문제가 아님"으로 이미 판정돼 plan 체크리스트에
등재돼 있어 새 조치 요구가 아니라 재확인 기록이다. 신규 CRITICAL/WARNING 급 API 계약 위반은
발견되지 않았다.

## 위험도

NONE
