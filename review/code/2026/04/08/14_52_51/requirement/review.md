### 발견사항

---

**[CRITICAL]** `_multiTurnState`에 `toolNodeIds`/`toolOverrides` 미포함 — ND-AG-14 위반
- 위치: `ai-agent.handler.ts` — `executeMultiTurn()` `_multiTurnState` 구성부
- 상세: `processMultiTurnMessage`에서 `buildTools(state)` 호출 시 `state`에 `toolNodeIds`/`toolOverrides`가 없어 항상 빈 배열 반환. 결과적으로 **첫 턴에만 Tool Use가 동작하고 후속 턴에서는 Tool Use가 완전히 비활성화**됨. "Multi Turn 대화 중 Tool Use 지속 지원" 요구사항(ND-AG-14)을 위반.
- 제안:
  ```typescript
  _multiTurnState: {
    // 기존 필드들...
    toolNodeIds: (config.toolNodeIds as string[]) || [],
    toolOverrides: (config.toolOverrides as Array<...>) || [],
  }
  ```

---

**[CRITICAL]** 타임아웃 시 실행 상태 전이가 스펙과 불일치
- 위치: `execution-engine.service.ts` — `waitForAiConversation()` 타임아웃 처리 경로
- 상세: 타임아웃(`action.type === 'ai_timeout'`) 발생 시 `buildMultiTurnFinalOutput`으로 출력을 생성하고 `RUNNING` 상태로 복구하여 워크플로우를 계속 진행함. 그러나 `spec/5-system/4-execution-engine.md §1.1`에 따르면 타임아웃은 `waiting_for_input → cancelled` 전이여야 함. 스펙 문서(ND-AG-13)도 타임아웃을 종료 조건으로 규정함.
- 제안: 타임아웃 시 워크플로우를 계속 실행할지 `CANCELLED` 처리할지 비즈니스 규칙을 명확히 정의하고 스펙과 구현을 정렬. 현재 타임아웃 후 계속 실행되는 동작은 스펙 위반.

---

**[WARNING]** RAG 컨텍스트를 `system` 메시지로 대화 중간 삽입 — 프로바이더 호환성 문제
- 위치: `ai-agent.handler.ts` — `processMultiTurnMessage()` ~L272-278
- 상세: 후속 턴 RAG 결과를 `{ role: 'system', content: ragContext.context }` 메시지로 대화 이력 중간에 삽입. Anthropic Claude 등 일부 프로바이더는 대화 중간에 `system` 메시지를 허용하지 않아 API 오류 발생 가능. 첫 번째 턴의 RAG 처리(시스템 프롬프트에 append)와 방식도 불일치.
- 제안: user 메시지 앞에 `[Context]\n{rag}\n\n` 형태로 user role에 포함하거나, 첫 시스템 메시지를 업데이트하는 방식으로 통일.

---

**[WARNING]** `messages` 배열 직접 변이(mutation) — 상태 오염 위험
- 위치: `ai-agent.handler.ts` — `processMultiTurnMessage()` L258 이후 `messages.push(...)`
- 상세: `const messages = state.messages as ChatMessage[]`는 참조만 복사. `push()` 호출이 `state.messages` 원본 배열을 직접 변이시킴. LLM 호출 중 예외 발생 시 절반만 변이된 상태로 `nodeOutputCache`가 오염됨. 재시도 로직이나 에러 복구 시 예측 불가능한 동작 유발.
- 제안: `const messages = [...(state.messages as ChatMessage[])]` shallow copy 후 사용.

---

**[WARNING]** `maxTurns = 0` 무제한 모드에서 탈출 경로 단일화
- 위치: `ai-agent.handler.ts:320` — `const isLastTurn = maxTurns > 0 && turnCount >= maxTurns`
- 상세: `maxTurns = 0` 시 `isLastTurn`이 항상 `false`로 무제한 동작. 탈출 수단이 `end_conversation` 명령 또는 `turnTimeout` 만료뿐. `turnTimeout` 기본값이 1800초(30분)이므로 클라이언트가 `end_conversation`을 보내지 않으면 30분간 대기. 스펙(ND-AG-13)에서 `0=무제한`으로 명시했으나 UI 힌트만으로는 사용자가 이 동작을 이해하기 어려움.
- 제안: 스펙에 `maxTurns = 0` 시 클라이언트 표시 방식 명시. `conversationConfig`에 `isUnlimited: true` 필드 추가 검토.

---

**[WARNING]** 스펙 문서의 `execution.resumed` 이벤트 누락
- 위치: `execution-engine.service.ts` 대화 종료 후 / `spec/5-system/6-websocket-protocol.md §4.1`
- 상세: 대화 종료 후 `ExecutionEventType.EXECUTION_RESUMED` 이벤트를 emit하지만 WebSocket 프로토콜 스펙 이벤트 목록에 해당 이벤트가 없음. 클라이언트 구현자가 이 이벤트를 처리해야 하는데 스펙 근거가 없음.
- 제안: `spec/5-system/6-websocket-protocol.md §4.1`에 `execution.resumed` 이벤트 추가.

---

**[WARNING]** `ExecutionEventType` enum에 `EXECUTION_AI_MESSAGE` 미등록
- 위치: `execution-engine.service.ts` — `'execution.ai_message' as ExecutionEventType`
- 상세: 강제 캐스팅으로 타입 안전성 우회. 이벤트 문자열 오타 시 컴파일 에러 없이 무음 실패. `ExecutionEventType` 기반 스위치 처리 시 누락됨.
- 제안: `ExecutionEventType`에 `EXECUTION_AI_MESSAGE = 'execution.ai_message'` 추가.

---

**[WARNING]** `stale setTimeout`이 다음 턴의 `pendingContinuations`를 삭제하는 hang 버그
- 위치: `execution-engine.service.ts` — `waitForAiConversation()` while 루프
- 상세: 각 턴마다 새 Promise + `setTimeout`을 생성하지만 이전 타이머를 취소하지 않음. 1800초 후 이전 콜백이 발화하여 다음 턴의 continuation 항목을 삭제 → 대화 영구 중단(hang). 요구사항(ND-AG-13)의 타임아웃 종료 조건이 의도치 않게 다음 턴에 적용됨.
- 제안: `pendingContinuations` 타입에 `timeoutId` 추가, `continueAiConversation`/`endAiConversation`에서 `clearTimeout(pending.timeoutId)` 호출.

---

**[INFO]** `conversationConfig.messages`에 `system` 메시지 포함 — 시스템 프롬프트 노출
- 위치: `ai-agent.handler.ts` — `executeMultiTurn()`, `processMultiTurnMessage()` 반환값
- 상세: `messages` 배열이 `role: 'system'` 메시지를 포함한 채 클라이언트로 전송됨. 시스템 프롬프트에 비즈니스 로직, RAG 컨텍스트 등 민감한 정보 포함 가능.
- 제안: `messages.filter(m => m.role !== 'system')` 적용 후 클라이언트 전송.

---

**[INFO]** 테스트: `maxTurns = 0` 경계값 및 후속 턴 tool calling 시나리오 누락
- 위치: `ai-agent.handler.spec.ts`
- 상세: 무제한 모드(`maxTurns = 0`) 동작 검증 테스트 없음. 후속 턴에서 tool calling 동작 검증 테스트 없음(ND-AG-14 핵심 기능인데 이 버그가 테스트로 포착되지 않음).
- 제안: `maxTurns: 0` 케이스 테스트 추가. `_multiTurnState`에 `toolNodeIds` 포함 후 후속 턴 tool use 동작 테스트 추가.

---

### 요약

AI Agent Multi Turn 모드(ND-AG-11~14)의 기본 골격은 완성되어 있으나, **ND-AG-14(Multi Turn 중 Tool Use 지속 지원)가 `_multiTurnState`에 `toolNodeIds`/`toolOverrides` 미포함으로 인해 후속 턴에서 Tool Use가 완전히 비활성화**되는 실제 기능 결함이 존재한다. 타임아웃 시 실행 상태 전이(`RUNNING` 복구 vs 스펙의 `CANCELLED`)도 스펙과 불일치한다. `stale setTimeout` 버그는 장기 대화에서 hang을 유발하며, RAG 컨텍스트의 `system` 메시지 중간 삽입은 프로바이더 호환성 문제를 내포한다. `messages` 배열 직접 변이는 오류 복구 시 상태 오염 위험을 가진다. 핵심 비즈니스 로직인 대화 흐름 제어 메서드(`waitForAiConversation`, `continueAiConversation`, `endAiConversation`)에 대한 서비스 레이어 테스트가 전무하여 회귀 위험이 높다.

### 위험도
**HIGH** — ND-AG-14 요구사항 위반(tool use 비활성화), 스펙과 다른 타임아웃 처리, hang 유발 가능한 타이머 버그가 복합적으로 존재