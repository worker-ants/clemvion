### 발견사항

- **[WARNING]** `ExecutionEventType` enum에 `EXECUTION_AI_MESSAGE` 미등록
  - 위치: `execution-engine.service.ts` — `'execution.ai_message' as ExecutionEventType`
  - 상세: 신규 서버→클라이언트 이벤트 `execution.ai_message`가 `ExecutionEventType` enum에 등록되지 않아 문자열 강제 캐스팅으로 우회. 향후 이벤트 타입 기반 라우팅·스위치 처리 시 누락될 위험이 있으며, 컴파일 타임 안전성이 없음
  - 제안: `ExecutionEventType` enum에 `EXECUTION_AI_MESSAGE = 'execution.ai_message'` 추가

- **[WARNING]** WebSocket 명령 ACK 응답 패턴 불일치
  - 위치: `websocket.gateway.ts` — `handleSubmitMessage`, `handleEndConversation`
  - 상세: 기존 `handleSubmitForm`은 `execution.form_submitted`, `handleClickButton`은 `execution.click_button.ack`를 반환하는 반면, 신규 핸들러는 `execution.submit_message.ack` / `execution.end_conversation.ack`를 반환. ACK 이벤트명 규칙이 혼용되어 클라이언트 구현 시 혼란 발생 가능. 스펙(§4.4)에도 ACK 응답 형식이 정의되어 있지 않음
  - 제안: 스펙에 각 명령의 ACK 응답 구조 명시, 또는 기존 패턴(`execution.<action>.ack`)으로 통일

- **[WARNING]** `execution.submit_message` / `execution.end_conversation` 명령에 실행 소유권 검증 없음
  - 위치: `websocket.gateway.ts` — `handleSubmitMessage()`, `handleEndConversation()`
  - 상세: `userId` 존재 여부(인증)만 확인하고 `executionId`가 해당 사용자 소유인지 검증하지 않음. 인증된 임의 사용자가 타인의 실행 ID를 알면 AI 대화에 메시지 주입 또는 강제 종료 가능. HTTP REST API에서 403 Forbidden으로 처리되어야 할 케이스가 WebSocket 계층에서 무방비로 처리됨
  - 제안: `executionId`로 실행 레코드를 조회하여 `workspaceId` 또는 `userId`와 현재 연결 사용자를 대조하는 소유권 검증 추가

- **[WARNING]** `execution.waiting_for_input` 페이로드에 `waitingNodeId`/`waitingNodeType` 필드명 스펙 불일치
  - 위치: `execution-engine.service.ts` — `waitForAiConversation()` 내 `emitExecutionEvent` 호출
  - 상세: 기존 WebSocket 프로토콜 스펙(§4.1)은 `nodeId`, `nodeType` 필드를 정의하나, 코드에서는 `waitingNodeId`, `waitingNodeType`으로 emit. 기존 `waitForFormInput`/`waitForButtonInteraction` 패턴과의 일관성 여부 확인 필요
  - 제안: 스펙 필드명(`nodeId`, `nodeType`)과 코드 필드명 통일

- **[WARNING]** `execution.resumed` 이벤트 스펙 미문서화
  - 위치: `execution-engine.service.ts` — `waitForAiConversation()` 종료 처리 / `spec/5-system/6-websocket-protocol.md`
  - 상세: 대화 종료 후 `EXECUTION_RESUMED` 이벤트를 emit하지만 WebSocket 프로토콜 스펙 §4.1 이벤트 목록에 `execution.resumed`가 없음. 클라이언트가 이 이벤트를 처리해야 하나 계약이 미정의
  - 제안: `spec/5-system/6-websocket-protocol.md` §4.1에 `execution.resumed` 이벤트와 페이로드 구조 추가

- **[INFO]** `conversationConfig.messages`에 `role: 'system'` 메시지 포함 — 내부 정보 노출
  - 위치: `ai-agent.handler.ts` — `executeMultiTurn`, `processMultiTurnMessage` 반환값
  - 상세: 시스템 프롬프트 및 RAG 컨텍스트가 포함된 `system` 메시지가 필터링 없이 WebSocket 페이로드로 전송. 비즈니스 로직·내부 지침이 클라이언트에 노출됨
  - 제안: 클라이언트 전달 시 `messages.filter(m => m.role !== 'system')` 적용

- **[INFO]** `executionId` / `nodeId` UUID 형식 검증 부재
  - 위치: `websocket.gateway.ts` — `handleSubmitMessage`, `handleEndConversation`
  - 상세: 요청 페이로드의 `executionId`, `nodeId`가 UUID 형식인지 검증 없이 서비스 레이어에 전달. 잘못된 형식의 값이 DB 쿼리 오류를 유발할 수 있음
  - 제안: `class-validator`의 `@IsUUID()` 또는 DTO 클래스로 입력 검증 적용

---

### 요약

이번 변경은 AI Agent Multi Turn 모드를 위한 신규 WebSocket 명령(`execution.submit_message`, `execution.end_conversation`)과 이벤트(`execution.ai_message`, `execution.waiting_for_input` 확장)를 추가한다. 기존 `waiting_for_input` 메커니즘을 확장하여 하위 호환성을 유지한 설계는 적절하나, `ExecutionEventType` enum 미등록으로 인한 타입 안전성 결함, WebSocket 핸들러의 소유권 기반 인가 검증 누락, ACK 이벤트명 규칙 불일치, `execution.resumed` 이벤트의 스펙 미문서화가 API 계약 측면의 주요 문제다. 특히 소유권 검증 부재는 인증된 사용자가 타인의 AI 대화 세션에 무단으로 메시지를 주입하거나 강제 종료할 수 있는 인가 우회 취약점으로, 프로덕션 적용 전 반드시 수정이 필요하다.

### 위험도
**MEDIUM**