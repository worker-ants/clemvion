# API 계약(API Contract) 리뷰

## 범위 판단

이번 변경은 REST 엔드포인트(URL/버전/페이지네이션/요청 바디 검증)를 전혀 건드리지 않는다.
건드리는 것은 WebSocket `auth.token_expired` 통지의 내부 구현(타이머 무장/해제 하드닝)과
그 wire 문구를 리터럴에서 export 상수로 승격한 것, 그리고 관련 테스트 3종 추가, plan
트래커 문서 갱신뿐이다. `auth.token_expired` 는 `spec/5-system/6-websocket-protocol.md §4.6`
가 정의하는 wire 계약의 일부이므로 완전한 "해당 없음"은 아니라고 판단해 WS 관점에서
점검했다.

## 발견사항

- **[INFO]** `MSG_AUTH_TOKEN_EXPIRING` 상수 승격은 순수 additive 변경 — 하위 호환성 영향 없음
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.ts:309-310` (신규 export), `codebase/backend/src/modules/websocket/websocket.gateway.ts:219` (사용처)
  - 상세: `auth.token_expired` 페이로드의 `message` 필드 값은 종전 리터럴 `'Access token expires soon — refresh and reconnect.'`(gateway.ts 구 코드, diff 상 `-        message: 'Access token expires soon — refresh and reconnect.',`)과 신규 상수값(`websocket-events.types.ts:310`)이 문자 그대로 동일하다. 즉 이번 diff 는 **wire 상 실제로 전송되는 값을 바꾸지 않았다** — 리터럴을 단일 SoT 상수로 옮겼을 뿐이다. 새 export 심볼 추가는 기존 클라이언트에 영향이 없는 additive 변경이며, `websocket-events.types.ts` 헤더 JSDoc(`websocket.service.ts` 가 재-export)에 따라 기존 import 경로도 그대로 동작한다.
  - 제안: 없음 — 향후 이 상수값이 실제로 바뀌는 시점에는(문서상 "wire 문구 단일 SoT"로 명시됐으므로) 클라이언트가 `message` 필드를 파싱/매칭하지 않는지 재확인 필요(JSDoc `AuthTokenExpiredPayload`가 "클라이언트는 이 값을 소비하지 않는다 — 진단·로깅용"이라고 명시하므로 현재는 안전).

- **[INFO]** 동일 `client.id` 재무장 시 옛 타이머 선제 해제 — wire 계약 신뢰성 개선(현재 프로덕션 경로엔 영향 없음)
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:215` (`this.clearExpiryTimers(client.id);` in `armExpiryTimers`)
  - 상세: 종전에는 같은 `client.id` 로 재무장되는 경우(현재 Socket.IO 기본 설정에서는 연결마다 새 id 를 발급하므로 도달 불가하나, `connectionStateRecovery` 활성화 시 도달 가능) 옛 타이머 쌍이 해제되지 않아 `auth.token_expired` 가 2회 emit 되거나 `disconnect()` 가 이미 끊긴 소켓에 걸릴 수 있었다. 이번 변경은 무장 진입부에서 기존 타이머를 먼저 정리해 "소켓당 정확히 1회 통지 + 1회 강제종료"라는 wire 계약을 보장한다. `websocket.gateway.spec.ts:809-830` 의 신규 테스트가 `oldEmits + newEmits === 1`, `disconnect 총 1회`를 단언해 이 계약을 회귀 가드로 고정했다. API 계약 관점에서는 개선이며 새로운 위험을 도입하지 않는다.
  - 제안: 없음.

- **[INFO]** `expiryTimers` 맵 값 타입을 `{ notice?: ...; cutoff?: ... }` → `{ notice: ...; cutoff: ... }` 로 non-optional 화
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:157-160`
  - 상세: 순수 내부 타입 강화(둘은 항상 함께 생성/해제되므로 optional 이 불가능한 상태를 허용하던 것을 제거)로, wire 계약이나 공개 API 표면에 영향 없음.
  - 제안: 없음.

관련 테스트 파일(`websocket.gateway.spec.ts`)의 신규 3개 테스트는 모두 위 내부 하드닝을 검증하는 것으로, 인증/인가·요청 검증·에러 응답 형식·페이지네이션 등 다른 관점에서 다루는 계약 표면을 새로 만들거나 바꾸지 않는다. `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` 는 진행상황 기록용 문서로 계약 자체에 영향 없음.

## 요약

이번 변경은 REST API 표면(엔드포인트·버전·응답 스키마·에러 코드·페이지네이션)을 전혀 건드리지 않으며, 유일하게 관련 있는 WS wire 계약(`auth.token_expired` 페이로드)도 실제 전송 값은 그대로이고(리터럴→상수 승격만) 동작은 "소켓당 1회 통지/1회 종료"를 더 확실히 보장하는 방향으로만 개선됐다. 새로 export 된 `MSG_AUTH_TOKEN_EXPIRING` 상수는 additive 라 하위 호환성 문제가 없고, 인증/인가 로직·채널 인가·에러 ack 형식 등 나머지 gateway 계약은 이번 diff 에서 변경되지 않았다. 계약 관점에서 우려할 항목은 없다.

## 위험도

NONE
