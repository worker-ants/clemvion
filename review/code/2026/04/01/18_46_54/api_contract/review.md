### 발견사항

- **[WARNING]** `execution.submit_form` WebSocket 메시지에 인가 검증 없음
  - 위치: `websocket.gateway.ts` - `handleSubmitForm()` 메서드
  - 상세: `@ConnectedSocket()` 데코레이터가 없어 요청자가 해당 execution의 소유자인지 검증하지 않음. JWT로 연결은 인증되지만, 임의의 인증된 사용자가 다른 사용자의 execution에 폼 데이터를 제출할 수 있음
  - 제안: `@ConnectedSocket() client: Socket`을 추가하고 `client.userId`와 execution owner를 비교하는 인가 로직 추가

- **[WARNING]** `continueExecution` / `cancelWaitingExecution` 메서드가 public API로 노출되나 입력 검증 없음
  - 위치: `execution-engine.service.ts` - `continueExecution()` L455, `cancelWaitingExecution()` L466
  - 상세: `formData`가 `unknown` 타입으로 수신되며, 폼 스펙에 대한 유효성 검증(필드 타입, 필수값) 없이 그대로 `submittedData`에 저장됨. 악의적이거나 잘못된 데이터가 downstream 노드로 전달될 수 있음
  - 제안: Form 노드의 `config.fields` 스펙을 기반으로 `formData` 유효성 검증 로직 추가

- **[WARNING]** WebSocket 이벤트 `execution.waiting_for_input` 페이로드 스키마 불일치 위험
  - 위치: `execution-engine.service.ts` L396 (emit) vs `use-execution-events.ts` L93 (consume)
  - 상세: 백엔드는 `{ status, waitingNodeId, waitingNodeType, nodeOutput }` 형태로 emit하고, 프론트엔드는 `nodeOutput.formConfig`에서 formConfig를 추출. 그런데 `formConfig`가 `nodeOutput` 안에 있는 구조는 암묵적 계약으로 문서화되지 않음. `FormHandler`가 출력에 `formConfig`를 포함하지 않으면 프론트엔드는 폼을 렌더링하지 못함
  - 제안: `EXECUTION_WAITING_FOR_INPUT` 이벤트 페이로드에 `formConfig`를 명시적 최상위 필드로 포함시키고 타입 인터페이스로 문서화

- **[WARNING]** 폴링 경로의 `waiting_for_input` 처리에서 `nodeOutput.formConfig` 접근 경로가 상이
  - 위치: `use-execution-events.ts` L220-L235 (폴링) vs L93-L103 (WebSocket)
  - 상세: WebSocket 경로는 `nodeOutput.formConfig`를 참조하지만, 폴링 경로는 `nodeExecution.outputData.formConfig`를 참조. 두 경로가 동일한 데이터 소스에서 formConfig를 가져오는지 보장이 없음
  - 제안: formConfig 추출 로직을 단일 헬퍼 함수로 추상화하여 두 경로 모두 동일한 접근 방식 사용

- **[INFO]** `execution.form_submitted` 응답 이벤트가 ACK 방식이 아닌 별도 이벤트로 반환됨
  - 위치: `websocket.gateway.ts` - `handleSubmitForm()` 반환값
  - 상세: NestJS WebSocket에서 `return { event, data }` 패턴은 emit back이 보장되지 않을 수 있음. 클라이언트 측(`run-results-drawer.tsx`)에서 이 응답을 수신하는 코드가 없어 성공/실패 피드백이 UI에 반영되지 않음
  - 제안: 클라이언트에서 `execution.form_submitted` 이벤트 리스너를 등록하거나, Socket.IO ACK 패턴(`callback` 방식)으로 변경

- **[INFO]** `handleSubmitForm`의 에러 응답이 HTTP 상태 코드 없이 메시지만 반환
  - 위치: `websocket.gateway.ts` L171-L178
  - 상세: `No pending continuation for execution: {id}` 에러가 클라이언트에 그대로 노출됨. 내부 구현 세부사항이 외부에 노출되는 정보 유출 문제
  - 제안: 에러 메시지를 `"Execution is not waiting for input"` 등 클라이언트 친화적인 메시지로 래핑

---

### 요약

이번 변경은 Form 노드 실행 일시정지/재개를 위한 새로운 WebSocket API 계약(`execution.submit_form` 메시지, `execution.waiting_for_input` 이벤트)을 도입했습니다. 기존 REST API와의 하위 호환성은 유지되었고, 전반적인 WebSocket 이벤트 네이밍 규칙도 일관성이 있습니다. 그러나 `execution.submit_form` 핸들러에 실행 소유자 인가 검증이 누락된 점이 가장 중요한 보안 이슈이며, `waiting_for_input` 이벤트 페이로드에서 `formConfig`를 추출하는 경로가 WebSocket/폴링 두 경로 간에 암묵적으로 결합되어 있어 유지보수 리스크가 존재합니다. 폼 제출 응답(`execution.form_submitted`)을 클라이언트에서 수신하는 코드가 없는 것도 보완이 필요합니다.

### 위험도
**MEDIUM**