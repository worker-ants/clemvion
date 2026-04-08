## 발견사항

---

### **[CRITICAL]** `messages` 배열 공유 참조 변이 — 실행 컨텍스트 캐시 오염

- **위치**: `ai-agent.handler.ts` — `processMultiTurnMessage()` 진입부
- **상세**: `const messages = state.messages as ChatMessage[]`는 복사가 아닌 참조 복사. 이후 `messages.push(...)` 호출이 `state.messages`(= `nodeOutputCache[node.id]._multiTurnState.messages`)를 직접 변이함. LLM 호출 중 예외 발생 시 user 메시지는 추가됐지만 assistant 응답은 없는 반쪽짜리 상태가 컨텍스트 캐시에 잔류. 재시도 시 오염된 메시지 이력이 LLM으로 전송됨.
- **제안**:
  ```typescript
  const messages = [...(state.messages as ChatMessage[])];
  ```

---

### **[CRITICAL]** stale `setTimeout`이 다음 턴의 `pendingContinuations`를 삭제하는 hang 버그

- **위치**: `execution-engine.service.ts` — `waitForAiConversation()` while 루프
- **상세**: 매 턴마다 새 `setTimeout`을 생성하지만 이전 타이머를 취소하지 않음. `turnTimeout` 기본값 1800초 후 stale 콜백이 발화하여 다음 턴의 `pendingContinuations` 항목을 삭제. 이후 대화가 영구 중단(hang). 턴이 쌓일수록 좀비 타이머 누적.
- **제안**: `pendingContinuations` 타입에 `timeoutId` 추가, `continueAiConversation`/`endAiConversation`에서 `clearTimeout(pending.timeoutId)` 호출.

---

### **[WARNING]** `_multiTurnState`가 `nodeOutputCache`를 오염 — 내부 상태 외부 누출 경로

- **위치**: `ai-agent.handler.ts` — `executeMultiTurn()` 반환값, `execution-engine.service.ts` — nodeExec.outputData 저장
- **상세**: `executeMultiTurn`이 반환하는 객체(`_multiTurnState` 포함 전체)가 `nodeOutputCache[node.id]`에 저장됨. 대화 종료 시 `nodeExec.outputData = context.nodeOutputCache[node.id]`로 DB에 저장되어 내부 구현 상세(`llmConfigId`, `workspaceId`, `ragSources`, `messages` 전체)가 `node_execution` 테이블에 영속화됨. 별도 경로에서 nodeOutput이 클라이언트에 노출될 경우 내부 상태 누출.
- **제안**: `nodeExec.outputData` 저장 시 `_multiTurnState` 필드 제거:
  ```typescript
  const { _multiTurnState, ...publicOutput } = context.nodeOutputCache[node.id];
  nodeExec.outputData = publicOutput;
  ```

---

### **[WARNING]** `buildTools(state)` — 후속 턴 tool 호출 무력화

- **위치**: `ai-agent.handler.ts` — `processMultiTurnMessage()`, `executeMultiTurn()`의 `_multiTurnState` 구성
- **상세**: `_multiTurnState`에 `toolNodeIds`/`toolOverrides`가 포함되지 않음. `buildTools(state)` 호출 시 내부에서 `(config.toolNodeIds as string[]) || []`로 방어하여 항상 빈 배열 반환. 후속 모든 턴에서 tool calling이 silent하게 비활성화됨 — ND-AG-14 요구사항 위반.
- **제안**: `_multiTurnState`에 `toolNodeIds`, `toolOverrides` 추가:
  ```typescript
  _multiTurnState: {
    ...
    toolNodeIds: (config.toolNodeIds as string[]) || [],
    toolOverrides: (config.toolOverrides as ...) || [],
  }
  ```

---

### **[WARNING]** RAG 컨텍스트를 `system` 역할로 대화 중간 삽입 — 호출자 영향

- **위치**: `ai-agent.handler.ts` — `processMultiTurnMessage()` L~280
- **상세**: 후속 턴 RAG 결과를 `{ role: 'system', content: ragContext.context }` 메시지로 대화 이력 중간에 삽입. OpenAI는 허용하지만 Anthropic Claude API는 첫 번째 메시지 전에만 system role을 허용함 — 런타임 API 오류 발생. 첫 번째 턴은 시스템 프롬프트에 append하는 방식과도 불일치.
- **제안**: user 메시지 content 앞에 RAG 컨텍스트를 포함하거나, 첫 번째 system 메시지를 업데이트하는 방식으로 통일.

---

### **[WARNING]** `continueAiConversation`/`endAiConversation` 공개 메서드 — 소유권 검증 없는 상태 변경

- **위치**: `execution-engine.service.ts:700–720`, `websocket.gateway.ts` — `handleSubmitMessage`, `handleEndConversation`
- **상세**: 두 메서드 모두 `executionId`만으로 `pendingContinuations`의 Promise를 resolve/reject함. WebSocket 핸들러는 `userId` 인증만 확인하고 해당 execution의 소유권은 미검증. 인증된 타 사용자가 executionId를 알 경우 메시지 주입 또는 대화 강제 종료 가능 — 공유 서비스 상태(`pendingContinuations` Map)를 무단으로 변경하는 부작용.
- **제안**: `executionId → workspaceId` 조회 후 요청 사용자 워크스페이스와 대조하는 소유권 검증 추가.

---

### **[WARNING]** `nodeExec` stale entity 재사용 — DB 상태 덮어쓰기

- **위치**: `execution-engine.service.ts` — `waitForAiConversation()` 시작과 종료 블록
- **상세**: `nodeExec`를 대화 시작 시 1회 조회 후 수십 분의 대화 루프 종료 시 동일 객체로 저장. 루프 중 다른 프로세스가 해당 레코드를 수정했을 경우 그 변경이 덮어씌워짐. `outputData`에 stale 루프 시작 시점의 `startedAt` 기준 `durationMs` 계산은 의도된 동작이나 명시적 문서화 부재.
- **제안**: 루프 종료 후 `findOne`으로 재조회하거나 조건부 UPDATE(`WHERE status = 'waiting_for_input'`) 사용.

---

### **[WARNING]** `execution.ai_message as ExecutionEventType` 강제 캐스팅 — enum 계약 위반

- **위치**: `execution-engine.service.ts` — `waitForAiConversation()` 내 emit 호출
- **상세**: `ExecutionEventType` enum에 없는 값을 `as ExecutionEventType`으로 강제 캐스팅. `emitExecutionEvent`가 내부에서 enum switch로 처리할 경우 무음 실패. 컴파일 타임 타입 검사 우회.
- **제안**: `ExecutionEventType` enum에 `EXECUTION_AI_MESSAGE = 'execution.ai_message'` 추가.

---

### **[INFO]** `handleEndConversation`에서 `nodeId` 수신 후 미사용

- **위치**: `websocket.gateway.ts` — `handleEndConversation()`
- **상세**: `data.nodeId`를 수신하지만 `endAiConversation(executionId)`에 전달하지 않음. 클라이언트가 잘못된 `nodeId`를 보내도 성공 응답 반환. 향후 nodeId 기반 검증 도입 시 프로토콜 변경 없이 사용 가능하나, 현재는 dead parameter.
- **제안**: 미사용 파라미터임을 주석으로 명시하거나, `pendingContinuations`의 `nodeId`와 일치 여부 검증에 활용.

---

### **[INFO]** `ragSources` 누산으로 동일 문서 중복 포함

- **위치**: `ai-agent.handler.ts` — `processMultiTurnMessage()` 내 `ragSources = [...ragSources, ...ragContext.sources]`
- **상세**: 매 턴 RAG 소스를 누산. 동일 Knowledge Base 문서가 여러 턴에 걸쳐 검색될 경우 `ragSources`에 중복 포함. 최종 출력 `metadata.ragSources`가 의미상 부정확해지고 불필요하게 큰 데이터가 DB에 저장됨.
- **제안**: Set 기반 dedup(`chunkId` 기준) 또는 최신 턴 소스만 기록.

---

### **[INFO]** `executeMultiTurn` 첫 턴 tool call 루프에서 토큰 카운팅 불정확

- **위치**: `ai-agent.handler.ts` — `executeMultiTurn()` 내 `totalInputTokens = result.usage.inputTokens`
- **상세**: tool call 루프에서 여러 번 LLM을 호출하지만 마지막 `result.usage`만 기록. 중간 tool call 토큰이 `totalInputTokens`/`totalOutputTokens`에서 누락됨. 실제 비용과 기록된 비용 불일치.
- **제안**: 루프 내에서 `+=` 누산 방식으로 변경.

---

## 요약

이번 변경의 핵심 부작용 위험은 두 가지다. 첫째, `processMultiTurnMessage`에서 `state.messages`를 참조 복사 후 직접 변이하여 `nodeOutputCache`에 저장된 원본 상태가 처리 중 예외 시 오염되는 구조적 문제가 있다. 둘째, 매 턴 생성하는 `setTimeout` 타이머를 취소하지 않아 stale 타이머가 다음 턴의 `pendingContinuations` 항목을 삭제하여 대화가 영구 hang 상태에 빠지는 재현 가능한 버그가 존재한다. 추가로 `_multiTurnState`에 `toolNodeIds`가 누락되어 후속 턴의 tool calling이 항상 비활성화되고, `nodeOutputCache`에 저장된 내부 상태가 `nodeExec.outputData`를 통해 DB에 영속화되는 부작용이 있다. WebSocket 핸들러의 소유권 검증 부재는 인증된 사용자가 타인의 대화 세션에 영향을 줄 수 있는 공유 상태 변경 위험을 내포한다.

## 위험도

**CRITICAL** — stale setTimeout hang 버그와 messages 배열 공유 참조 변이는 즉시 수정 필요. tool calling 비활성화(ND-AG-14 위반)와 소유권 검증 누락은 프로덕션 운영 전 필수 해결 대상.