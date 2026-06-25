# API 계약(API Contract) 리뷰 결과

## 발견사항

이 변경은 `WebsocketGateway` 내부의 behavior-preserving 리팩토링입니다. 인증·소유권 검증 로직을 private helper로 추출하였으며, 외부 클라이언트에 노출되는 wire 형태(이벤트명, payload 구조, 에러 메시지 문자열)는 변경되지 않았습니다.

- **[INFO]** wire 문자열 불변 보존 확인
  - 위치: `MSG_NOT_AUTHENTICATED = 'Not authenticated'`, `MSG_NOT_AUTHORIZED_EXECUTION = 'Not authorized for this execution'`
  - 상세: 기존 인라인 리터럴 `'Not authenticated'` / `'Not authorized for this execution'` 을 상수로 승격하였고 값은 동일합니다. 테스트가 정확한 값을 검증한다고 명시되어 있어 계약 일관성이 유지됩니다.
  - 제안: 현 상태 유지. 상수화는 오히려 값 오타를 컴파일 타임에 방지합니다.

- **[INFO]** ack 이벤트명 및 payload 구조 불변 확인
  - 위치: `handleSubmitForm`, `handleClickButton`, `handleSubmitMessage`, `handleEndConversation`, `handleRetryLastTurn`
  - 상세: 5개 핸들러 모두 ack 이벤트명(`execution.form_submitted`, `execution.click_button.ack`, 등)과 payload 구조가 변경되지 않았습니다. `retry_last_turn` 의 nested `{error:{code,message}}` 형태와 나머지 4종의 flat `{error:string}` 형태의 의도적 분리도 그대로 보존됩니다.
  - 제안: 해당 없음.

- **[INFO]** `subscribe` 경로 계약 보존 확인
  - 위치: `handleSubscribe` — `channelAuthorizers` OCP 경로 유지
  - 상세: `subscribe` 핸들러는 새 helper(`getCommandAuthContext`)를 사용하지 않고 기존 `channelAuthorizers` 경로를 그대로 유지합니다. 채널 인가 응답 형태(`event: 'subscribed'`, `data.success/error/channel`)도 변경 없음.
  - 제안: 해당 없음.

- **[INFO]** 인증/인가 정책 보존 확인
  - 위치: `getCommandAuthContext`, `verifyExecutionOwnership`
  - 상세: `verifyOwnership`을 NotFound로 통일하는 IDOR 정책이 helper 내부에도 동일하게 적용됩니다(`catch` 블록이 모두 `false`로 환원). 명령 핸들러의 인증 검사 순서(인증 먼저 → 소유권 검증)도 동일합니다.
  - 제안: 해당 없음.

## 요약

이 변경은 WebSocket 게이트웨이의 순수 내부 리팩토링으로, 외부 클라이언트와 맺는 API 계약(이벤트명, ack payload 구조, 에러 메시지 문자열, 인증/인가 흐름)에 어떠한 변경도 없습니다. 인라인 타입 단언과 중복 인증 보일러플레이트를 `AuthenticatedSocket` 타입 alias 및 private helper로 추출하였으며, wire shape 분리(continuation 4종 flat vs retry_last_turn nested)와 IDOR 정책(NotFound 통일)이 그대로 보존되었습니다. API 계약 관점에서 검토할 breaking change 나 위험 요소는 없습니다.

## 위험도

NONE
