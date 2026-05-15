### 발견사항

---

**[CRITICAL] 실행 소유권 검증 없음 — 인가(Authorization) 우회**
- 위치: `websocket.gateway.ts` — `handleSubmitMessage()`, `handleEndConversation()`
- 상세: `userId` 존재 여부(인증)만 확인하고, 해당 `executionId`가 요청 사용자의 워크스페이스에 속하는지 검증하지 않음. 인증된 사용자라면 타인의 실행 ID를 알고 있을 경우 임의로 메시지를 주입하거나 대화를 강제 종료할 수 있음.
- 제안: `executionEngineService`에서 execution의 `workspaceId`와 현재 사용자의 워크스페이스를 대조하는 소유권 검증 로직 추가. 기존 `handleSubmitForm`, `handleClickButton`도 동일 문제를 공유하므로 공통 가드로 처리 권장.

```typescript
// 예: executionId → workspaceId 조회 후 사용자 권한 확인
const execution = await this.executionRepository.findOne({ where: { id: data.executionId } });
if (!execution || execution.workspaceId !== userWorkspaceId) {
  return { event: '...', data: { success: false, error: 'Forbidden' } };
}
```

---

**[WARNING] 사용자 메시지 길이·내용 미검증 — 프롬프트 인젝션 / 리소스 소진**
- 위치: `ai-agent.handler.ts` — `processMultiTurnMessage()` L275 (`messages.push({ role: 'user', content: userMessage })`)
- 상세: 사용자 메시지가 길이 제한이나 내용 검증 없이 LLM 컨텍스트에 직접 추가됨. 극단적으로 긴 메시지로 인한 토큰 비용 폭증, 혹은 시스템 프롬프트 무력화를 의도한 프롬프트 인젝션 공격에 취약.
- 제안: WebSocket 핸들러 또는 서비스 진입점에서 `message` 필드에 최대 길이 제한 적용 (예: 4,000자), 공백만으로 이루어진 메시지 거부.

---

**[WARNING] 시스템 프롬프트가 클라이언트에 노출됨**
- 위치: `ai-agent.handler.ts` — `executeMultiTurn()`, `processMultiTurnMessage()` 반환 값의 `conversationConfig.messages`
- 상세: `messages` 배열에 `{ role: 'system', content: '...' }` 메시지가 포함된 채 클라이언트로 전송됨. 시스템 프롬프트에는 비즈니스 로직, 내부 지침, RAG 컨텍스트 등 민감한 정보가 포함될 수 있음.
- 제안: 클라이언트로 전달하는 `conversationConfig.messages`에서 `role === 'system'` 메시지를 필터링.

```typescript
conversationConfig: {
  messages: messages.filter(m => m.role !== 'system'),
  // ...
}
```

---

**[WARNING] 내부 에러 메시지가 클라이언트에 노출됨**
- 위치: `websocket.gateway.ts` — `handleSubmitMessage()` / `handleEndConversation()` catch 블록
- 상세: `error instanceof Error ? error.message : '...'` 패턴으로 내부 예외 메시지(예: `"No pending continuation for execution: {uuid}"`)가 클라이언트에 직접 반환됨. 실행 내부 상태 및 UUID가 노출됨.
- 제안: 에러 메시지를 일반화하고 세부 내용은 서버 로그에만 기록.

```typescript
this.logger.error(`AI conversation error: ${error instanceof Error ? error.message : error}`);
return { event: '...', data: { success: false, error: 'Message submission failed' } };
```

---

**[WARNING] 대화 메시지 전송에 속도 제한(Rate Limit) 없음**
- 위치: `websocket.gateway.ts` — `handleSubmitMessage()`
- 상세: 단일 연결에서 `execution.submit_message`를 초당 수십~수백 회 전송하더라도 차단 로직이 없음. 이는 LLM API 비용 폭증 및 서비스 가용성 저하로 이어질 수 있음.
- 제안: 기존 WebSocket 레벨 Rate Limit(`RATE_LIMITED`, 60 msg/min)과는 별도로 AI 대화 전용 쓰로틀링 추가 (예: executionId당 최소 1초 간격).

---

**[WARNING] `_multiTurnState` 객체 구조 검증 없이 신뢰**
- 위치: `execution-engine.service.ts` — `waitForAiConversation()` (state를 `as Record<string, unknown>`으로 캐스팅), `ai-agent.handler.ts` — `processMultiTurnMessage()` 파라미터
- 상세: 내부 상태 객체가 타입 캐스팅으로만 처리되어 예상치 못한 필드 변조 시 런타임 오류 또는 예외 동작 가능. 특히 `workspaceId`, `knowledgeBases`, `maxTurns` 등의 필드가 외부에서 조작될 수 있는 경로가 존재하는지 검토 필요.
- 제안: 상태 객체를 타입 가드 또는 Zod 스키마로 검증하거나, 상태를 클라이언트에 노출하지 않고 서버 메모리(Redis 등)에만 보관.

---

**[INFO] RAG 컨텍스트가 `system` 역할 메시지로 삽입됨**
- 위치: `ai-agent.handler.ts` — `processMultiTurnMessage()` L298
  ```typescript
  messages.push({ role: 'system', content: ragContext.context });
  ```
- 상세: Knowledge Base 문서 내용이 `system` 메시지로 삽입됨. Knowledge Base에 악의적인 콘텐츠(예: "Ignore previous instructions and...")가 포함되어 있을 경우 RAG를 통한 프롬프트 인젝션이 가능.
- 제안: RAG 컨텍스트는 `system` 대신 별도 포맷 문자열로 기존 시스템 프롬프트에 병합하거나, Knowledge Base 문서 저장 시 메타 인젝션 패턴을 필터링.

---

**[INFO] `executionId` / `nodeId` 형식 미검증**
- 위치: `websocket.gateway.ts` — 모든 핸들러의 `data.executionId`, `data.nodeId`
- 상세: UUID 형식 검증 없이 곧바로 서비스 레이어에 전달됨. UUID가 아닌 값이 전달될 경우 DB 쿼리 오류 또는 예상치 못한 동작 가능.
- 제안: UUID 정규식 검증 또는 `class-validator`의 `@IsUUID()` 적용.

---

### 요약

이번 변경의 핵심 취약점은 **인가(Authorization) 계층 누락**이다. WebSocket 핸들러가 사용자 인증(Authentication)은 확인하지만, 특정 실행(Execution)에 대한 접근 권한은 검증하지 않아 인증된 사용자라면 타인의 AI 대화에 메시지를 주입하거나 강제 종료할 수 있다. 또한 시스템 프롬프트가 클라이언트에 노출되고, 내부 에러 메시지가 그대로 반환되는 정보 노출 문제도 존재한다. 속도 제한 부재는 LLM API 비용 측면의 DoS 위험을 내포한다.

### 위험도

**HIGH**