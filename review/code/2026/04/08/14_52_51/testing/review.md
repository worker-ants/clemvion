### 발견사항

---

- **[CRITICAL]** `waitForAiConversation`, `continueAiConversation`, `endAiConversation` 서비스 메서드 테스트 전무
  - 위치: `execution-engine.service.ts` — 세 메서드 모두, `execution-engine.service.spec.ts` 부재
  - 상세: 이번 변경의 가장 복잡한 비동기 흐름(Promise blocking, 타임아웃, 상태 전환, 대화 루프)에 대한 단위 테스트가 전혀 없음. 특히 ① 타임아웃 경로(1800초 후 `ai_timeout` resolve), ② `continueAiConversation`/`endAiConversation` 호출 시 `pendingContinuations` 정리, ③ 대화 종료 후 `NodeExecution.status = COMPLETED` 전이, ④ `pendingContinuations` 미존재 시 예외 발생이 모두 미검증
  - 제안: `execution-engine.service.spec.ts`에 Jest fake timer(`jest.useFakeTimers()`)를 활용한 테스트 추가. 최소 커버리지: 정상 메시지 수신 → 대화 계속, 종료 명령 → 대화 종료, 타임아웃 → `ai_timeout` 분기

---

- **[CRITICAL]** `processMultiTurnMessage`에서 후속 턴 tool calling 무력화 버그 — 테스트로 검증되지 않음
  - 위치: `ai-agent.handler.ts:290` — `this.buildTools(state)`, `ai-agent.handler.spec.ts` — `processMultiTurnMessage` describe
  - 상세: `_multiTurnState`에 `toolNodeIds`/`toolOverrides`가 포함되지 않아 `buildTools(state)`가 항상 `[]`를 반환함. 이는 ND-AG-14(멀티턴 Tool Use 지속 지원) 위반이나, 현재 테스트는 이 동작을 검증하지 않음. `processMultiTurnMessage` 테스트에서 `toolNodeIds`를 포함한 state로 mock tool 호출 여부를 검증했다면 사전에 발견되었을 버그
  - 제안: 두 가지 수정 필요: ① `executeMultiTurn`의 `_multiTurnState`에 `toolNodeIds`, `toolOverrides` 추가, ② `processMultiTurnMessage` 테스트에 tool calling 시나리오 추가

```typescript
it('should call tools in follow-up turns', async () => {
  const state = {
    ...baseState,
    toolNodeIds: ['node-1'],
    toolOverrides: [],
    maxToolCalls: 10,
  };
  mockLlmService.chat
    .mockResolvedValueOnce({ toolCalls: [{ id: 't1', name: 'tool_node-1', arguments: {} }], ... })
    .mockResolvedValueOnce({ content: 'Done', ... });

  await handler.processMultiTurnMessage('Use a tool', state);
  expect(mockLlmService.chat).toHaveBeenCalledTimes(2); // tool loop
});
```

---

- **[WARNING]** WebSocket 신규 핸들러(`handleSubmitMessage`, `handleEndConversation`) 테스트 부재
  - 위치: `websocket.gateway.ts` — 두 핸들러, 게이트웨이 스펙 파일 부재
  - 상세: 인증 실패(userId 없음) → `{ success: false }` 반환, 정상 동작, 서비스 예외 전달 경로가 검증되지 않음. 기존 `handleSubmitForm`, `handleClickButton`도 테스트가 없으나 신규 핸들러에서도 같은 패턴이 반복됨
  - 제안: 게이트웨이 스펙 파일 생성 후 아래 케이스 추가

```typescript
describe('handleSubmitMessage', () => {
  it('should return error when not authenticated', () => { ... });
  it('should call continueAiConversation and return success', () => { ... });
  it('should return error when service throws', () => { ... });
});
```

---

- **[WARNING]** `maxTurns = 0` (무제한) 경계값 테스트 누락
  - 위치: `ai-agent.handler.spec.ts` — `processMultiTurnMessage` describe
  - 상세: `isLastTurn = maxTurns > 0 && turnCount >= maxTurns` 조건에서 `maxTurns = 0`이면 항상 `false` — 즉 무제한 모드. 이 동작이 의도된 것인지 검증하는 테스트 없음. `maxTurns = 1`인데 turnCount도 1인 경우(즉 `isLastTurn = true`) 경계값 테스트도 없음
  - 제안:

```typescript
it('should continue conversation when maxTurns is 0 (unlimited)', async () => {
  const result = await handler.processMultiTurnMessage('hi', { ...state, maxTurns: 0, turnCount: 9999 });
  expect((result as Record<string, unknown>).status).toBe('waiting_for_input');
});
```

---

- **[WARNING]** RAG system 메시지 삽입 구조 미검증 — messages 배열 assert 없음
  - 위치: `ai-agent.handler.spec.ts` — `processMultiTurnMessage > should perform RAG search on follow-up messages`
  - 상세: 현재 RAG 테스트는 `mockRagService.search`가 호출되었는지만 검증하고, 반환된 컨텍스트가 `{ role: 'system', content: ragContext }` 형태로 messages 배열에 삽입되었는지 검증하지 않음. Anthropic 등 일부 프로바이더는 대화 중간의 system 메시지를 거부하므로, 삽입 방식 자체의 정합성 검증이 중요
  - 제안: `llmService.chat`에 전달된 messages 인수를 캡처하여 system 메시지 위치/내용 검증

```typescript
const chatCall = mockLlmService.chat.mock.calls[0];
const passedMessages = chatCall[1].messages;
const systemRagMsg = passedMessages.find(m => m.role === 'system' && m.content.includes('New context'));
expect(systemRagMsg).toBeDefined();
```

---

- **[WARNING]** `setTimeout` 미정리로 타이머 기반 테스트 작성 어려움
  - 위치: `execution-engine.service.ts` — `waitForAiConversation` while 루프 내 `setTimeout`
  - 상세: `setTimeout` 반환 핸들을 저장하지 않아 `clearTimeout`이 불가능. Jest fake timer 환경에서 타임아웃 경로를 테스트하려면 `jest.runAllTimers()`를 호출해야 하는데, stale 타이머가 다음 턴의 `pendingContinuations`를 삭제하는 CRITICAL 버그와 맞물려 타이머 테스트 자체가 의도치 않은 부작용을 일으킬 수 있음
  - 제안: `timeoutId`를 `pendingContinuations` 항목에 포함시켜 resolve 시 `clearTimeout` 호출 — 이렇게 해야 fake timer 기반 테스트도 안전하게 작성 가능

---

- **[WARNING]** 멀티턴 첫 번째 턴에서 tool calling 루프 테스트 누락
  - 위치: `ai-agent.handler.spec.ts` — `execute - multi_turn` describe
  - 상세: `executeMultiTurn` 내에도 `while (result.toolCalls?.length && toolCallCount < maxToolCalls)` 루프가 존재하나, 첫 턴에서 tool_calls → 최종 응답 시나리오를 검증하는 테스트가 없음. single_turn에는 해당 시나리오가 있음(`should handle tool calling loop`)
  - 제안: `execute - multi_turn` 블록에 tool calling 시나리오 추가

---

- **[INFO]** 테스트 state 객체 중복 정의 — 픽스처 미추출
  - 위치: `ai-agent.handler.spec.ts` — `processMultiTurnMessage` describe 블록 내 3개 테스트
  - 상세: 거의 동일한 state 객체가 세 테스트에 반복 정의됨. `maxTurns`, `messages` 등 핵심 필드 변경 시 모든 테스트에서 수동 수정 필요
  - 제안: `const baseMultiTurnState = { ... }` 공통 픽스처로 추출, 각 테스트에서 `{ ...baseMultiTurnState, maxTurns: 2 }` 패턴으로 override

---

- **[INFO]** RAG 테스트 state에 `temperature`/`maxTokens` 미포함 — 의도 불명확
  - 위치: `ai-agent.handler.spec.ts` — `processMultiTurnMessage > should perform RAG search on follow-up messages`
  - 상세: 해당 state에 `temperature`, `maxTokens` 필드가 없어 `undefined`가 LLM에 전달됨. 동작에는 문제 없으나(`|| undefined` 허용) 의도적 생략인지 실수인지 불명확. 명시적으로 `temperature: undefined`를 포함하거나 이 케이스를 "최소 필드로 동작 검증" 테스트로 명명해야 함

---

### 요약

`ai-agent.handler.spec.ts`는 validate, execute(single/multi_turn), processMultiTurnMessage, buildMultiTurnFinalOutput에 대한 기본 케이스를 잘 구성했으나, 이번 변경의 핵심 리스크 영역이 테스트에서 완전히 누락되어 있다. 가장 복잡한 비동기 흐름인 `waitForAiConversation`의 대화 루프, 타임아웃, 상태 전환은 `execution-engine.service.spec.ts`가 없어 전혀 검증되지 않으며, WebSocket 핸들러도 마찬가지다. 더 심각한 것은 `_multiTurnState`에 `toolNodeIds`가 빠져 후속 턴 tool calling이 무력화되는 버그가 테스트로 포착되지 않았다는 점으로, 이는 ND-AG-14 요구사항 위반이다. `maxTurns = 0` 경계값과 RAG 메시지 삽입 구조도 추가 검증이 필요하다.

### 위험도

**HIGH**