# API 계약(API Contract) 리뷰

대상: WS `auth.token_expired` 소켓 수명=토큰 수명 구현. 이 changeset 은 **5라운드째 리뷰**다.
`git log --oneline`: `b019d7de3`(구현) → `a9316a0a6`(1R) → `1bd2000d5`(2R) → `e5b683d75`(3R) →
`a18376f0c`(4R, 현재 HEAD). 직전 라운드(`review/code/2026/09/02/19_12_36/api_contract.md`)가
이미 "애플리케이션 코드에 신규 diff 없음 · 위험도 NONE" 으로 판정했고, `git show a18376f0c`
로 이번 라운드가 추가한 코드 diff 를 직접 대조했다.

## 이번 라운드(4R 대응 커밋 `a18376f0c`)의 실제 변경분

`git show a18376f0c --stat` 기준 `codebase/**` 변경은 딱 2곳뿐이다:

1. `codebase/backend/src/modules/websocket/websocket-events.types.ts` — `AuthTokenExpiredPayload`
   JSDoc 정정. 종전 문구("클라이언트는 이 값으로 남은 창을 계산해 재발급한다")를
   "클라이언트는 이 값을 소비하지 않는다 — 즉시 재발급한다" 로 좁혔다. **타입 시그니처
   (`{ message: string; expiresAt: string }`) 는 변경 없음** — wire payload shape 은 그대로다.
2. `codebase/frontend/src/lib/websocket/ws-client.ts` — 중복 빈 줄 1줄 삭제(순수 포맷팅,
   런타임 동작 무변경).

둘 다 API 계약(요청/응답 스키마·엔드포인트·인증·상태 코드)에 영향을 주는 변경이 아니다.
JSDoc 정정은 오히려 "문서가 구현보다 넓게 약속했던" 상태를 구현에 맞춰 좁힌 것이라
API 계약 관점에서는 개선(문서-구현 불일치 해소)이다.

## 누적 확인 — 핵심 WS 계약 재대조 (직접 `Read`)

- `websocket.gateway.ts` — `AuthEventType.AUTH_TOKEN_EXPIRED = 'auth.token_expired'` 는
  **emit-only** 신규 이벤트. 인바운드 화이트리스트(`KNOWN_WS_EVENTS`)에 넣지 않은 판단이
  올바르다(서버→클라이언트 단방향이므로 인바운드 검증 표면을 넓힐 필요가 없다). 기존
  클라이언트가 이 이벤트를 구독하지 않아도 아무 영향이 없는 **순수 additive 변경**이라
  하위 호환성 문제가 없다.
- `AuthTokenExpiredPayload { message: string; expiresAt: string }` — spec §4.6 표·Rationale·
  구현·JSDoc(4R 정정본) 이 문구 단위로 일치한다. `expiresAt`(ISO 8601, 이 소켓이 강제
  종료되는 시각) 이 `_retryState.expiresAt`(§4.2)·`auth.refreshed.expiresAt`(§1.3 비채택)과
  네임스페이스가 다름을 JSDoc·spec 양쪽이 명시적으로 구분해 두어 이름 충돌에 의한 오용
  위험이 낮다.
- 에러 신호 방식: cutoff `client.disconnect()` 는 별도 error 이벤트 없이 곧장 끊고, 핸드셰이크
  인증 실패는 `client.emit('error', {message})` 후 `disconnect()` — 두 갈래이지만 spec
  §6.1/§9.2 가 사전 통지(`auth.token_expired`)를 원인 신호로 쓰도록 설계했으므로 계약 위반이
  아니다.
- 요청 검증: `armExpiryTimers` 의 `typeof expSeconds !== 'number' || !Number.isFinite(...)`
  가드가 유효하고, `exp` 는 서명 검증을 통과한 JWT payload 값만 진입해 외부에서 조작 불가.
- URL/경로 설계·페이지네이션: 해당 없음 — REST 엔드포인트·목록 API 변경 없음, 이번 라운드도
  WS 이벤트 카탈로그 확장뿐이다.
- 인증/인가: 이 changeset 의 본질이 "핸드셰이크 이후 토큰을 재검증하지 않던 실재 인가 갭"을
  닫는 보강이다 — 만료 토큰으로 무기한 인가되던 상태를 닫아 **인가 계약을 강화**하는
  방향이며 약화가 아니다. revoke 카브아웃(자연 만료까지만 유효, 명시적 revoke 는 refresh
  family 만 무효화)도 spec Rationale 이 명시한 의도적 스코프와 코드 주석이 일치한다.

## 이월 항목 (신규 아님, 참고용 재기재)

- **[INFO]** spec 이 이 이벤트를 여전히 `_(계획·미구현)_`(Planned) 배지로 표기 — 구현 완료와
  spec 배지 표기가 불일치한다. 코드 계약 자체의 결함이 아니라 developer 권한 밖의 문서 갱신
  누락이며, `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` 에 "머지 후 planner
  턴"으로 이미 등재돼 추적이 끊기지 않는다. 4라운드 연속 동일 관측, 이번 라운드도 변동 없음.
- **[INFO]** 배포 전환 창 — 이 재연결 로직을 모르는 구버전 프론트 번들(배포 시점에 이미 열려
  있던 탭)은 서버 cutoff 시 무통지·복구 불가로 끊긴다(Socket.IO 는 서버발신 `disconnect()`
  에 자동 재연결을 발화하지 않음). 코드로 해결할 문제가 아니라 배포 런북 판단 대상으로
  1R 부터 등재돼 있고, 체크박스는 아직 미해결이나 이번 changeset 의 코드 변경 사항은 아니다.

두 항목 모두 API 계약(스키마·버전·인증) 자체에 대한 새로운 위반이 아니라 문서/운영 절차
트래킹 항목이므로 이번 라운드에서 새로 조치를 요구하지 않는다.

## 요약

이번 5라운드(직전 리뷰 이후 신규 코드 diff)의 실제 변경은 JSDoc 문구 정정 1건과 공백 정리
1건뿐이며, 둘 다 wire 이벤트 타입·payload 스키마·엔드포인트·인증 흐름에 영향을 주지 않는다.
WS `auth.token_expired` 이벤트 자체는 emit-only 순수 additive 변경으로 기존 클라이언트에
breaking 영향이 없고, payload 스키마·에러 신호·요청 검증·인가 강화 방향 모두 4라운드에 걸쳐
일관되게 검증됐다. 신규 CRITICAL/WARNING 급 API 계약 위반은 발견되지 않았다. 남은 INFO 2건은
문서/운영 절차 성격이며 이미 plan 에 등재된 이월 항목이다.

## 위험도

NONE
