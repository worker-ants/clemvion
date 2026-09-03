# API 계약(API Contract) 리뷰

## 범위 판단

이번 diff 는 REST API 가 아니라 **WebSocket 프로토콜**(`auth.token_expired` 이벤트) 관련
코드다. `codebase/backend/src/modules/websocket/{websocket-events.types.ts, websocket.gateway.ts,
websocket.gateway.spec.ts}` 3개 소스 파일과 `plan/in-progress/ws-token-expired-socket-lifetime-impl.md`
1개 plan 문서가 실질 변경 대상이며, 나머지(파일 5~19, `review/code/2026/09/03/11_57_58/**`)는
직전 리뷰 라운드의 산출물이 새로 추가된 것으로 API 계약과 무관하다(리뷰 리포트 그 자체).

이 기능은 이미 spec 결정(`R-ws-socket-lifetime-binds-token`, `#1266` 로 머지)이 끝난 뒤,
직전 5라운드 리뷰에서 이월(carry-over)된 INFO 5건을 한 번에 정리하는 **내부 리팩터·경화
(hardening)** 커밋이다. 신규 엔드포인트·신규 이벤트·신규 REST 경로는 없다.

## 점검 결과

### 1. 하위 호환성
- `AuthTokenExpiredPayload` 인터페이스(`{ message: string; expiresAt: string }`)는 필드 추가·삭제·타입
  변경 없이 그대로다.
- wire 로 나가는 `message` 값은 리터럴 `'Access token expires soon — refresh and reconnect.'` 을
  상수 `MSG_AUTH_TOKEN_EXPIRING` 으로 추출했을 뿐 **바이트 단위로 동일**하다
  (`websocket-events.types.ts:315-316` vs 종전 리터럴, diff 로 확인). 클라이언트가 관측하는
  값에 변화가 없다.
- `MSG_AUTH_TOKEN_EXPIRING` 신규 export 는 **추가적(additive)** 이라 기존 소비자에게 영향 없다.
- breaking change 없음.

### 2. 버전 관리
- WS 프로토콜에 별도 버전 스킴이 없고 이번 변경도 그것을 요구하는 성격이 아니다. 해당 없음.

### 3. 응답 형식
- spec §4.6(`spec/5-system/6-websocket-protocol.md:874`)이 규정한 `{ message, expiresAt }` shape
  과 정확히 일치. `expiresAt` 의미(ISO 8601, "이 소켓이 강제 종료되는 시각")도 JSDoc 과 spec 이
  동일하게 서술한다. 스키마 이탈 없음.

### 4. 에러 응답
- 이번 diff 는 에러 응답 경로(`error` emit, `WsErrorCode`)를 건드리지 않는다. 해당 없음.

### 5. 요청 검증
- 이번 diff 는 클라이언트→서버 요청 바디를 다루지 않는다(핸드셰이크 토큰 검증 로직은
  `handleConnection` 에 있고 diff 밖). 해당 없음.

### 6. URL/경로 설계
- 이벤트명 `auth.token_expired` 변경 없음. 네임스페이스(`/ws`) 변경 없음. 해당 없음.

### 7. 페이지네이션
- 목록 API 아님. 해당 없음.

### 8. 인증/인가
- `armExpiryTimers` 에 `this.clearExpiryTimers(client.id)` 를 **조기 return 보다 먼저** 두도록
  옮긴 변경(`websocket.gateway.ts` — `armExpiryTimers` 함수 앞부분)은 실질적으로 인가 경계를
  강화한다: 같은 `client.id` 로 재무장할 때 옛 타이머 쌍이 살아남으면 이미 무효화됐어야 할
  `disconnect`/`auth.token_expired` 콜백이 이중으로 걸릴 수 있었다(spec §1.2 의 "60초 전 **1회**
  emit" 요구와 어긋날 잠재적 경로). 이번 수정으로 그 경로가 닫혔다 — 계약 위반 리스크를
  줄이는 방향의 변경이며, `websocket.gateway.spec.ts` 의 신규 테스트("같은 client.id 로
  재무장하면 옛 타이머를 먼저 해제한다")가 정확히 이 지점을 단언한다.
- `expiryTimers` 맵 값 타입을 `{ notice?: …; cutoff?: … }` → `{ notice: …; cutoff: … }` 로
  non-optional 화한 것은 순수 내부 타입 정제이며 인증/인가 흐름 자체(`handleConnection` 의
  JWT 검증, `payload.exp` 추출)는 diff 밖에서 변경되지 않았다.
- `setTimeout(...).unref()` 추가는 프로세스 셧다운 지연을 막는 운영상 개선이며 인가 판단
  로직에는 영향 없다.

## 발견사항

없음 (CRITICAL/WARNING/INFO 모두 해당 사항 없음). 참고로 `armExpiryTimers` 조기-clear 변경은
spec 의 "1회 emit" 요구를 더 견고하게 만드는 긍정적 보강이며, 별도 조치가 필요한 결함은
아니다.

## 요약

이번 변경은 이미 결정·구현·머지된 `auth.token_expired` WS 프로토콜 기능의 후속 하드닝
커밋으로, REST API 표면을 전혀 건드리지 않고 WS wire 계약(`{ message, expiresAt }` shape·
이벤트명·메시지 문구)도 값 단위로 동일하게 유지한다. `armExpiryTimers` 재무장 시 조기 clear
는 오히려 spec 이 요구하는 "60초 전 1회 emit" 불변식을 재무장 경로에서도 지키도록 만드는
개선이며, 테스트로 뮤테이션 검증까지 됐다. API 계약 관점에서 breaking change, 스키마 이탈,
에러 응답 불일치, 인가 약화 등 어떤 항목도 발견되지 않았다.

## 위험도

NONE
