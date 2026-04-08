### 발견사항

---

**[CRITICAL] 실행 소유권 검증 없음 — Authorization 우회**
- 위치: `websocket.gateway.ts` — `handleSubmitMessage()` (line ~256), `handleEndConversation()` (line ~285)
- 상세: `userId` 존재 여부(인증)만 확인하고, 해당 `executionId`가 요청 사용자의 워크스페이스에 속하는지 검증하지 않음. 인증된 사용자라면 타인의 실행 ID를 알고 있을 경우 임의로 메시지를 주입하거나 대화를 강제 종료할 수 있음. OWASP A01:2021 Broken Access Control에 해당.
- 제안:
  ```typescript
  const execution = await this.executionRepository.findOne({
    where: { id: data.executionId }
  });
  if (!execution || execution.workspaceId !== userWorkspaceId) {
    return { event: '...', data: { success: false, error: 'Forbidden' } };
  }
  ```

---

**[WARNING] 시스템 프롬프트 클라이언트 노출**
- 위치: `ai-agent.handler.ts` — `executeMultiTurn()`, `processMultiTurnMessage()` 반환값의 `conversationConfig.messages`
- 상세: `messages` 배열에 `{ role: 'system', content: '...' }` 메시지가 필터링 없이 WebSocket으로 전송됨. 시스템 프롬프트에는 비즈니스 로직, 내부 지침, RAG 컨텍스트 등 민감한 정보가 포함될 수 있음. OWASP A02:2021 Cryptographic Failures(민감 데이터 노출) 범주.
- 제안:
  ```typescript
  messages: messages.filter(m => m.role !== 'system'),
  ```

---

**[WARNING] 내부 에러 메시지 클라이언트 노출**
- 위치: `websocket.gateway.ts` — `handleSubmitMessage()` / `handleEndConversation()` catch 블록
- 상세: `error instanceof Error ? error.message : '...'` 패턴으로 `"No pending continuation for execution: {uuid}"` 같은 내부 상태 정보와 UUID가 클라이언트에 직접 반환됨. OWASP A09:2021 Security Logging and Monitoring Failures 및 정보 노출 취약점.
- 제안:
  ```typescript
  this.logger.error(`AI conversation error: ${error instanceof Error ? error.message : error}`);
  return { event: '...', data: { success: false, error: 'Message submission failed' } };
  ```

---

**[WARNING] 사용자 메시지 길이·내용 미검증 — 프롬프트 인젝션 / 자원 소진**
- 위치: `ai-agent.handler.ts` — `processMultiTurnMessage()`, `websocket.gateway.ts` — `handleSubmitMessage()`
- 상세: 사용자 메시지가 길이 제한이나 내용 검증 없이 LLM 컨텍스트에 직접 추가됨. 극단적으로 긴 메시지로 인한 토큰 비용 폭증, 또는 시스템 프롬프트 무력화를 의도한 프롬프트 인젝션 공격에 취약. OWASP A03:2021 Injection.
- 제안: WebSocket 핸들러 진입점에서 최대 길이 제한(예: 4,000자) 및 공백 전용 메시지 거부 적용.
  ```typescript
  if (!data.message || data.message.trim().length === 0 || data.message.length > 4000) {
    return { event: '...', data: { success: false, error: 'Invalid message' } };
  }
  ```

---

**[WARNING] AI 대화 전용 Rate Limiting 없음 — LLM API 비용 DoS**
- 위치: `websocket.gateway.ts` — `handleSubmitMessage()`
- 상세: 단일 연결에서 `execution.submit_message`를 연속 전송하면 각 메시지가 LLM API 호출을 유발. 기존 WebSocket Rate Limit(60 msg/min)은 일반 메시지 기준으로, LLM 호출 비용을 고려한 별도 쓰로틀링이 없음. OWASP A05:2021 Security Misconfiguration.
- 제안: executionId당 최소 간격(예: 1초) 쓰로틀링 또는 사용자별 동시 AI 대화 세션 수 제한 추가.

---

**[WARNING] RAG 컨텍스트를 통한 프롬프트 인젝션 가능성**
- 위치: `ai-agent.handler.ts` — `processMultiTurnMessage()` 내 RAG 삽입 (`messages.push({ role: 'system', content: ragContext.context })`)
- 상세: Knowledge Base 문서 내용이 검증 없이 `system` 역할 메시지로 삽입됨. KB에 악의적인 콘텐츠(`"Ignore previous instructions and..."`)가 포함되어 있을 경우 RAG를 통한 간접 프롬프트 인젝션 공격이 가능. OWASP A03:2021 Injection.
- 제안: Knowledge Base 저장 시 인젝션 패턴 필터링 적용, 또는 RAG 컨텍스트를 마크다운 코드블록으로 감싸 지시문으로 해석되지 않도록 포맷팅.

---

**[WARNING] `stale setTimeout`이 다음 턴 pendingContinuations를 삭제하는 버그 — 간접 보안 영향**
- 위치: `execution-engine.service.ts` — `waitForAiConversation()` while 루프
- 상세: 각 턴마다 `clearTimeout` 없이 새 타이머를 생성. 이전 턴의 타이머가 발화 시 다음 턴의 continuation을 삭제하여 대화가 영구 중단될 수 있음. 의도적으로 긴 대화를 유도하여 특정 타이밍에 타이머를 발화시키는 방식으로 타인의 대화를 강제 중단시키는 보조 공격 수단이 될 수 있음.
- 제안:
  ```typescript
  const timeoutId = setTimeout(() => { ... }, timeoutMs);
  this.pendingContinuations.set(executionId, { nodeId: node.id, resolve, reject, timeoutId });
  // continueAiConversation / endAiConversation에서:
  clearTimeout(pending.timeoutId);
  ```

---

**[INFO] `executionId` / `nodeId` UUID 형식 미검증**
- 위치: `websocket.gateway.ts` — `handleSubmitMessage()`, `handleEndConversation()` 입력 파라미터
- 상세: UUID 형식 검증 없이 서비스 레이어에 직접 전달됨. 비정상적인 값이 DB 쿼리나 Map 조회에 전달될 경우 예상치 못한 동작 가능.
- 제안: `class-validator`의 `@IsUUID()` 데코레이터 적용 또는 UUID 정규식 검증 추가.

---

**[INFO] `_multiTurnState` 내부 상태 구조 무결성 검증 없음**
- 위치: `execution-engine.service.ts` — `waitForAiConversation()`, `ai-agent.handler.ts` — `processMultiTurnMessage()`
- 상세: 내부 상태 객체를 `Record<string, unknown>` 캐스팅으로만 처리. `workspaceId`, `maxTurns`, `knowledgeBases` 등 핵심 필드가 변조될 경우 런타임에서 감지되지 않음. 현재는 서버 메모리에만 존재하나, 향후 Redis 등 외부 저장소로 이관 시 직렬화/역직렬화 과정에서 조작 가능성 증가.
- 제안: `MultiTurnState` 인터페이스 또는 Zod 스키마로 상태 구조를 타입 안전하게 정의하여 암묵적 계약을 명시적으로 전환.

---

### 요약

이번 변경의 핵심 보안 취약점은 **Authorization 계층 누락**이다. WebSocket 핸들러(`handleSubmitMessage`, `handleEndConversation`)가 사용자 인증(Authentication)은 확인하지만 특정 실행(Execution)에 대한 접근 권한은 검증하지 않아, 인증된 사용자라면 타인의 AI 대화에 메시지를 주입하거나 강제 종료할 수 있다. 더불어 시스템 프롬프트(`role: 'system'` 메시지)가 클라이언트로 그대로 전송되어 비즈니스 로직이 노출되고, 내부 에러 메시지에 실행 UUID 등 내부 상태 정보가 포함되어 반환된다. 사용자 메시지 길이·내용 미검증 및 Rate Limiting 부재는 LLM API 비용 기반 DoS 공격에 취약하며, RAG 컨텍스트를 통한 간접 프롬프트 인젝션 경로도 존재한다. 소유권 검증 추가, 시스템 메시지 필터링, 에러 메시지 일반화는 즉시 수정이 필요하다.

### 위험도
**HIGH**