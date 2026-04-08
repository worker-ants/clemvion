### 발견사항

- **[WARNING]** `execution.ai_message` 이벤트 타입을 문자열 캐스팅으로 전달
  - 위치: `execution-engine.service.ts` — `'execution.ai_message' as ExecutionEventType`
  - 상세: `ExecutionEventType` 열거형에 `EXECUTION_AI_MESSAGE` 값이 추가되지 않아 타입 안전성 없이 강제 캐스팅 처리됨. 향후 타입 검사나 열거형 스위치에서 누락될 위험
  - 제안: `ExecutionEventType`에 `EXECUTION_AI_MESSAGE = 'execution.ai_message'` 상수 추가

- **[WARNING]** WebSocket 명령 ACK 이벤트명 불일치
  - 위치: `websocket.gateway.ts` — `handleSubmitMessage`, `handleEndConversation`
  - 상세: 반환하는 `event` 필드(`execution.submit_message.ack`, `execution.end_conversation.ack`)가 Socket.IO의 `@SubscribeMessage` 방식에서는 클라이언트에 자동 전달되지 않음. 기존 `handleSubmitForm`은 `execution.form_submitted`, `handleClickButton`은 `execution.click_button.ack`로 일관성 없이 혼용 중. 스펙(§4.4)에는 ACK 응답 형식이 정의되어 있지 않아 클라이언트 구현 시 혼란 발생 가능
  - 제안: 스펙에 `execution.submit_message.ack`, `execution.end_conversation.ack` 응답 구조 명시 또는 기존 패턴 통일

- **[WARNING]** `continueAiConversation` / `endAiConversation` 에서 authorization 검증 없음
  - 위치: `execution-engine.service.ts:700–720`, `websocket.gateway.ts`
  - 상세: WebSocket 핸들러에서 `userId` 존재 여부만 확인하고, 해당 `executionId`가 실제로 그 사용자의 것인지 검증하지 않음. 다른 사용자의 실행 ID를 알면 대화를 가로채거나 종료할 수 있음. 기존 `handleSubmitForm`, `handleClickButton`도 동일한 문제를 가지고 있으나 신규 핸들러에서도 반복됨
  - 제안: `executionId`를 통해 실행의 소유 워크스페이스/사용자를 조회하여 권한 검증 추가

- **[INFO]** `_multiTurnState`가 WebSocket 페이로드에 노출됨
  - 위치: `execution-engine.service.ts` — `waitForAiConversation` 내 `emitExecutionEvent`
  - 상세: `EXECUTION_WAITING_FOR_INPUT` 이벤트 payload의 `nodeOutput`에 `conversationConfig`만 포함하도록 설계되어 있어 `_multiTurnState`는 노출되지 않음. 현재 구현은 올바르나, `ai_agent.handler.ts`의 전체 반환값(`_multiTurnState` 포함)이 `nodeOutputCache`에 저장되므로 다른 경로에서 전체 캐시가 클라이언트에 노출되지 않도록 주의 필요
  - 제안: 현재 구현 유지, 단 노드 완료 후 `outputData` 저장 시(`nodeExec.outputData = context.nodeOutputCache[node.id]`) `_multiTurnState` 필드를 제거하는 것이 권장됨

- **[INFO]** `conversationConfig.messages`에 전체 대화 이력 포함
  - 위치: `ai-agent.handler.ts` — `executeMultiTurn`, `processMultiTurnMessage` 반환값
  - 상세: 턴마다 전체 `messages` 배열을 WebSocket으로 전달. 대화가 길어질수록 페이로드 크기가 선형 증가. 스펙(§4.4)에는 명시되어 있으나 실제 운영 시 대역폭 문제 유발 가능
  - 제안: `execution.ai_message` 이벤트에서는 증분 메시지만 전달하고, `execution.waiting_for_input`에서는 `messages` 전체 대신 최근 N개만 포함하는 방식 검토

---

### 요약

이번 변경은 AI Agent Multi Turn 모드를 위한 새로운 WebSocket 명령(`execution.submit_message`, `execution.end_conversation`)과 이벤트(`execution.ai_message`)를 추가한다. 스펙과 구현의 정합성은 전반적으로 양호하며, 기존 `waiting_for_input` 메커니즘을 확장한 설계는 하위 호환성을 유지한다. 다만 `ExecutionEventType` 열거형 미등록으로 인한 타입 안전성 결함, WebSocket 핸들러의 소유권 기반 인가 검증 누락, ACK 이벤트명 불일치가 실제 운영에서 문제가 될 수 있으며, 특히 인가 검증 부재는 다른 사용자의 AI 대화 세션에 무단으로 메시지를 주입하거나 종료할 수 있는 보안 위험이다.

### 위험도
**MEDIUM**