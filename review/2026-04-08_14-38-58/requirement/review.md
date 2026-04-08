## 요구사항 코드 리뷰 결과

### 발견사항

---

**[WARNING]** `execution.ai_message` 이벤트가 스펙과 불일치하는 채널로 발송됨
- 위치: `execution-engine.service.ts` — `waitForAiConversation()` 내 `execution.ai_message` emit
- 상세: `'execution.ai_message' as ExecutionEventType` 타입 캐스팅으로 강제 처리. `ExecutionEventType` enum에 해당 값이 없어 캐스팅을 사용한 것으로 보임. 런타임에 실제 emit은 되지만, 타입 안전성 부재로 오타/변경 시 컴파일 에러 없이 무음 실패
- 제안: `ExecutionEventType` enum에 `EXECUTION_AI_MESSAGE = 'execution.ai_message'` 추가

---

**[WARNING]** `processMultiTurnMessage`에서 state mutation 발생
- 위치: `ai-agent.handler.ts:258` — `messages.push({ role: 'user', content: userMessage })`
- 상세: `state.messages`를 직접 참조하여 push. JavaScript 배열은 참조 타입이므로 호출자의 `multiTurnState.messages`가 함께 변경됨. 재시도 로직이나 실패 복구 시 상태가 오염될 수 있음
- 제안: `const messages = [...(state.messages as ChatMessage[])]` 복사 후 사용

---

**[WARNING]** Multi Turn 타임아웃 시 `NodeExecution` 상태가 `WAITING_FOR_INPUT`으로 잔류
- 위치: `execution-engine.service.ts` — `waitForAiConversation()` 타임아웃 처리 경로
- 상세: 타임아웃 발생 시 `action.type === 'ai_timeout'`으로 분기하여 대화를 종료하지만, 이 경우 `Execution` 상태가 `RUNNING`으로 복구됨. 그러나 스펙(execution-engine.md §1.1)에 따르면 타임아웃은 `waiting_for_input → cancelled` 전이여야 함. 현재는 타임아웃 후에도 워크플로우가 계속 실행됨
- 제안: 타임아웃 시 `endReason: 'timeout'`으로 출력을 만들어 계속 실행할지, 아니면 `CANCELLED` 처리할지 비즈니스 규칙 명확화 및 구현 정렬 필요

---

**[WARNING]** `maxTurns: 0` (무제한) 시 종료 조건 누락
- 위치: `ai-agent.handler.ts:320` — `const isLastTurn = maxTurns > 0 && turnCount >= maxTurns`
- 상세: `maxTurns = 0`이면 `isLastTurn`이 항상 `false`. 스펙과 일치하지만, 이 경우 사용자가 `end_conversation`을 보내지 않으면 영구히 대기. `turnTimeout`이 유일한 탈출 수단인데, `waitForAiConversation`의 `turnTimeout`은 `_multiTurnState`에서 읽어오는데 첫 번째 실행 시 `multiTurnState`가 `nodeOutput._multiTurnState`로부터 읽힘 — 이 경로는 정상. 단, 무제한 모드임을 UI/프론트엔드에 명시적으로 전달하는 필드가 `conversationConfig.maxTurns: 0`인데, 클라이언트가 이를 올바르게 해석해야 함
- 제안: 스펙에 `maxTurns: 0`의 클라이언트 표시 방식 명시 권장

---

**[INFO]** RAG 컨텍스트를 `system` 메시지로 conversation history에 삽입
- 위치: `ai-agent.handler.ts:272-278` — `messages.push({ role: 'system', content: ragContext.context })`
- 상세: 후속 턴에서 RAG 결과를 system 메시지로 대화 이력 중간에 삽입. 일부 LLM 프로바이더(Anthropic 등)는 대화 중간에 system 메시지를 허용하지 않으므로 provider-specific 오류 발생 가능. 또한 이 system 메시지가 누적되어 context window를 소모
- 제안: RAG 결과를 user 메시지 앞에 `[Context]\n{rag}\n\n[User]\n{message}` 형태로 user 메시지에 포함하거나, 첫 system prompt를 업데이트하는 방식 검토

---

**[INFO]** `buildTools`가 `state` 타입의 파라미터를 받지만 실제 `toolNodeIds`가 state에 없을 수 있음
- 위치: `ai-agent.handler.ts:290` — `const tools = this.buildTools(state)`
- 상세: `processMultiTurnMessage`에서 `state` 객체를 `buildTools`에 전달. `state`는 `_multiTurnState`이고 여기에는 `toolNodeIds`/`toolOverrides`가 포함되어 있지 않음 (`executeMultiTurn`에서 state 구성 시 미포함). 결과적으로 후속 턴에서 항상 `tools = []`
- 제안: `executeMultiTurn`의 `_multiTurnState`에 `toolNodeIds`, `toolOverrides` 포함 필요

```typescript
// 현재 (_multiTurnState에 tool 정보 없음)
_multiTurnState: {
  llmConfigId, model, temperature, maxTokens,
  knowledgeBases, ragTopK, ragThreshold, maxToolCalls,
  // toolNodeIds 누락!
  ...
}
```

---

**[INFO]** 테스트에서 `processMultiTurnMessage` state에 `temperature`, `maxTokens` 미포함 케이스 미검증
- 위치: `ai-agent.handler.spec.ts:259` — RAG 테스트 state에 `temperature`, `maxTokens` 미포함
- 상세: `processMultiTurnMessage` 내부에서 `state.temperature`, `state.maxTokens`를 `as number | undefined`로 읽으므로 undefined여도 동작. 단 타입 안전성 테스트 케이스 부재
- 제안: 선택적 필드가 없는 최소 state로 동작 검증 테스트 추가

---

### 요약

AI Agent Multi Turn 모드의 핵심 기능(대화 루프, WebSocket 이벤트, 종료 조건)은 스펙(ND-AG-11~14) 요구사항을 대체로 충족한다. 그러나 **후속 턴에서 tool use가 항상 비활성화**되는 버그(`_multiTurnState`에 `toolNodeIds` 미포함)가 발견되었으며, 이는 ND-AG-14(Multi Turn 대화 중 Tool Use 지속 지원) 요구사항을 위반한다. 또한 타임아웃 시의 실행 상태 전이가 스펙과 상이하고, RAG 컨텍스트를 system 메시지로 중간 삽입하는 방식은 일부 LLM 프로바이더와 호환성 문제를 일으킬 수 있다. `messages` 배열 직접 mutation은 잠재적 상태 오염 위험을 내포한다.

### 위험도

**MEDIUM** — 기능 골격은 완성되어 있으나 Tool Use 비활성화 버그(ND-AG-14 위반)와 상태 mutation 문제가 실제 사용 시 발현될 수 있음