# API 계약(API Contract) 리뷰

## 발견사항

### [INFO] REST 엔드포인트에 422 INVALID_STATE 응답 신규 추가 (하위 호환성 주의)

- 위치: `codebase/backend/src/modules/executions/executions.controller.ts` L151-163
- 상세: `continueExecution` 엔드포인트가 기존에는 `continueExecution` 호출을 `await` 없이 fire-and-forget 으로 실행하여 실제 실행 결과에 무관하게 항상 200 `{ success: true }` 를 반환하였다. 이번 변경에서 `await` 가 추가되고 `InvalidExecutionStateError` 를 422 `UnprocessableEntityException` 으로 전환하는 로직이 삽입되었다. 기존 클라이언트는 성공 경로(200)에서 동작 변화가 없으나, 이전에는 silent fail 이었던 케이스(execution 이 waiting_for_input 이 아닌 상태에서 continue 요청)가 이제 422 를 수신하게 된다. 기존 동작이 버그(상태 불일치를 무음 처리)에 가까웠으므로 실질적 breaking change 위험은 낮다.
- 제안: 클라이언트 코드가 해당 엔드포인트의 에러 응답을 처리하지 않았다면, 422 신규 수신에 대한 클라이언트 측 처리를 병행 업데이트하는 것을 권장한다.

### [INFO] 422 응답 본문 스키마가 NestJS 표준 형식과 차이

- 위치: `codebase/backend/src/modules/executions/executions.controller.ts` L155-160
- 상세: 422 응답 본문은 `{ error: { code: 'INVALID_STATE', message: '...' } }` 구조이다. NestJS 표준 예외 응답 형식(`{ statusCode, message, error }`)과 다른 커스텀 래핑을 사용한다. `@ApiUnprocessableEntityResponse` 데코레이터가 추가되어 Swagger 문서화는 되어 있으나, 실제 본문 스키마를 설명하는 DTO 클래스 없이 description 문자열만 기재된다.
- 제안: 에러 응답 DTO(`InvalidStateErrorResponseDto` 등)를 정의하고 `@ApiUnprocessableEntityResponse({ type: ... })` 에 연결하면 스키마 문서화가 명확해진다. 또한 프로젝트의 다른 에러 응답 형식(기존 ConflictException 응답 구조 등)과 일치하는지 확인이 필요하다.

### [INFO] WebSocket ACK 응답에 `errorCode` 필드 신규 추가 (하위 호환)

- 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` (4개 이벤트 핸들러 — form_submitted, click_button.ack, submit_message.ack, end_conversation.ack)
- 상세: 실패 ACK 데이터에 `errorCode?: string` 필드가 추가되었다. 성공 케이스(`success: true`)에는 해당 필드가 포함되지 않는다. 기존 클라이언트는 알 수 없는 추가 필드를 무시하는 방식으로 동작하므로 하위 호환성은 유지된다.
- 제안: 프론트엔드와 공유하는 WS 이벤트 타입 정의가 있다면 `errorCode` 필드를 추가하여 클라이언트가 명시적으로 처리할 수 있도록 한다.

### [INFO] `InteractionService.dispatchContinuation` — 기존 409 STATE_MISMATCH 코드 재사용 (일관성 양호)

- 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts` L266-280
- 상세: `InvalidExecutionStateError` 발생 시 409 `ConflictException` 을 `{ error: { code: 'STATE_MISMATCH', message } }` 구조로 반환한다. `assertWaiting` 이 이미 동일 코드를 사용하고 있어 일관성이 있다. 클라이언트 입장에서는 동일한 409/STATE_MISMATCH 가 `assertWaiting` 단계와 `dispatchContinuation` 단계(race window) 두 곳에서 올 수 있으나, 클라이언트 처리 방식은 동일하므로 문제 없다.
- 제안: 현재 구현이 적절하다. 추가 조치 불필요.

### [INFO] `resolveWaitingNodeExecutionId` 에서 DB 인프라 실패 시 500 전파로 동작 변경

- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L2964-2990
- 상세: 기존에는 DB lookup 실패도 `__no_node_exec__` sentinel 을 반환하며 soft fail 처리하였다. 변경 후에는 DB 인프라 실패는 원본 에러를 재던져 REST 진입점에서 500 으로 표출된다. 컨트롤러의 catch 블록이 `InvalidExecutionStateError` 만 명시적으로 처리하고 나머지를 `throw error` 로 전파하므로, DB 실패는 NestJS 글로벌 예외 필터가 500 으로 처리한다.
- 제안: 현재 구현이 적절하다. DB 인프라 장애 시 클라이언트에게 더 명확한 에러 신호가 전달된다.

---

## 요약

이번 변경의 핵심 API 계약 변화는 두 가지이다. 첫째, `continueExecution` REST 엔드포인트가 fire-and-forget 에서 await 기반으로 전환되면서 상태 불일치 케이스에 422 INVALID_STATE 응답을 신규로 반환한다. 기존 동작이 버그(silent fail)에 가까웠으므로 실질적 breaking change 위험은 낮으나, 클라이언트 코드 업데이트가 병행되어야 한다. 둘째, WebSocket ACK 응답에 선택적 `errorCode` 필드가 추가되어 하위 호환성을 유지하면서 에러 원인을 클라이언트에 전달한다. 에러 응답 본문 구조(`{ error: { code, message } }`)는 EIA 기존 관례와 일치하나, REST 엔드포인트의 422 응답에 대해 Swagger DTO 문서화 보강이 권장된다. DLQ 모니터(`ContinuationDlqMonitorService`)는 내부 모니터링 서비스로 외부 API 계약에 직접 노출되지 않는다.

## 위험도

LOW
