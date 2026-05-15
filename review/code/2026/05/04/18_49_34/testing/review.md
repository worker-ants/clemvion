### 발견사항

---

**[WARNING] 멀티턴 경로의 tool call telemetry 테스트 부재**
- 위치: `ai-agent.handler.ts` 멀티턴 재개 경로 (~line 891), `ai-agent.handler.spec.ts`
- 상세: `toolCallTraces` 누적과 WS 이벤트 emit은 단일턴/멀티턴 두 경로 모두에 추가됐으나, 새 spec 블록의 4개 테스트는 전부 단일턴 경로(`baseContext`)만 검증. 멀티턴 재개 시 `turnIndex: turnCount`가 올바로 전달되는지, `state.nodeId`가 빈 문자열 fallback으로 처리되는지 미검증.
- 제안: multi-turn resume 시나리오 — `execute` 후 `waiting_for_input` 상태를 재개하는 픽스처를 사용해 WS 이벤트의 `turnIndex`가 1이 아닌 값임을 검증하는 테스트 추가.

---

**[WARNING] `KbToolProvider` / `McpToolProvider` 에러 반환 필드 추가에 대한 단위 테스트 부재**
- 위치: `kb-tool-provider.ts`, `mcp-tool-provider.ts`
- 상세: 두 provider 모두 기존 에러 반환 경로에 `status: 'error'`와 `error` 필드를 추가했으나, 해당 provider의 기존 spec 파일(`kb-tool-provider.spec.ts`, `mcp-tool-provider.spec.ts`) 수정이 diff에 없음. `AgentToolResult.status/error`가 실제로 채워지는지 provider 레벨에서 검증하는 테스트가 없어 핸들러의 `result.status ?? 'success'` 분기가 provider 에러 신호를 올바로 전달하는 전체 흐름이 테스트 사각지대에 있음.
- 제안: `kb-tool-provider.spec.ts`에 `execute`가 unknown_kb_tool / missing query / search_failed 경로에서 `{ status: 'error', error: '...' }`를 반환함을 검증하는 케이스 추가.

---

**[WARNING] `execution.waiting_for_input` 핸들러의 새 message 파싱 경로 미검증**
- 위치: `use-execution-events.ts` waiting_for_input 핸들러, `use-execution-events.test.ts`
- 상세: waiting_for_input 핸들러 내부의 메시지 파싱 로직이 기존 수동 루프에서 `messagesToConversationItems`로 대체됐으나, 새 테스트 블록("tool call events")은 이 코드 경로를 전혀 건드리지 않음. 기존 waiting_for_input 테스트가 tool message가 포함된 `convConfig.messages`를 커버하는지 불명확하며, tool item이 초기 대기 상태 seed 시 올바로 생성되는지 미검증.
- 제안: `execution.waiting_for_input` 이벤트에 tool message를 포함한 `messages` payload를 주입하는 테스트를 추가해 `conversationMessages`에 tool type 항목이 포함됨을 검증.

---

**[WARNING] `provider.execute`가 throw 없이 `status: 'error'`를 반환하는 경로 미검증**
- 위치: `ai-agent.handler.ts:runProviderTool`, `ai-agent.handler.spec.ts`
- 상세: `runProviderTool`은 두 가지 에러 경로를 갖는다: (a) provider가 throw — 테스트 3번에서 커버됨, (b) provider가 `{ status: 'error', error: msg }` 반환 — 미검증. `status = result.status ?? 'success'`로 처리되지만, kb-tool-provider가 search_failed 시 throw 없이 에러 status를 반환하는 케이스와 핸들러 간의 통합이 테스트로 확인되지 않음.
- 제안: `mockRagService`가 에러를 throw하는 대신 KbToolProvider가 에러 객체를 반환하도록(provider 레벨에서 catch) 시뮬레이션하는 테스트 추가. 단, 현 KbToolProvider 구현은 내부적으로 catch 후 반환하므로 핸들러 입장에서는 (b) 경로에 해당.

---

**[INFO] `setConversationMessages`의 selection index 보존 로직 미검증**
- 위치: `execution-store.ts:setConversationMessages`, `execution-store.test.ts`
- 상세: 구현은 `selectedConversationItemIndex`가 새 배열 길이를 초과할 때 `null`로 초기화하는 로직을 포함하지만, 이를 검증하는 테스트 없음.
- 제안:
```ts
it("setConversationMessages drops selection when new array is shorter", () => {
  store.setConversationMessages([...5 items...]);
  store.setState({ selectedConversationItemIndex: 4 });
  store.setConversationMessages([...2 items...]);
  expect(store.getState().selectedConversationItemIndex).toBeNull();
});
```

---

**[INFO] `upsertToolItem`에 `toolCallId` 없을 때의 fallback 동작 미검증**
- 위치: `execution-store.ts:upsertToolItem`, `execution-store.test.ts`
- 상세: `toolCallId`가 없으면 dedup 없이 단순 append하는 분기가 있으나 테스트 없음. 실제로는 발생하기 어렵지만 `if (!item.toolCallId)` 분기가 커버되지 않음.
- 제안: `toolCallId`를 생략한 항목으로 두 번 `upsertToolItem`을 호출 시 2개 항목이 생성됨을 검증하는 케이스 추가(현재 spec에서의 idempotent 테스트와 대비).

---

**[INFO] WS 핸들러의 guard 조건(`!payload.toolCallId` 등) 미검증**
- 위치: `use-execution-events.ts:handleToolCallStarted/handleToolCallCompleted`
- 상세: 두 핸들러 모두 `toolCallId`나 `name`이 없으면 early return하는 guard를 포함하나, 이를 검증하는 테스트 없음.
- 제안:
```ts
it("tool_call_started is a no-op when toolCallId is missing", () => {
  toolStarted!({ name: "kb_search" }); // no toolCallId
  expect(store.getState().conversationMessages).toHaveLength(0);
});
```

---

**[INFO] `tryParseJson` 중복 정의**
- 위치: `use-execution-events.ts:7-13`, `conversation-utils.ts` 내 동일 함수
- 상세: 동일한 함수가 두 파일에 각각 선언돼 있음. 테스트 측면에서는 두 경로가 독립적으로 동작하므로 edge case를 각각 커버해야 하지만 현재 어느 쪽도 명시적으로 단위 테스트하지 않음. 구조적 중복은 유지보수 위험.
- 제안: 공용 유틸로 추출 후 단위 테스트 추가, 또는 최소한 conversation-utils의 `messagesToConversationItems` 테스트에서 non-string args, 깨진 JSON 케이스를 명시적으로 커버.

---

**[INFO] `durationMs` 측정 정확도 검증 방식**
- 위치: `ai-agent.handler.spec.ts` — `emits TOOL_CALL_STARTED + TOOL_CALL_COMPLETED`
- 상세: `typeof completed?.payload.durationMs === 'number'` 만 검증하고 있음. `Date.now()` 기반 측정은 flaky하지 않으나, `>= 0` 조건 정도는 포함하는 것이 의도를 더 명확히 표현.
- 제안: `expect(completed?.payload.durationMs).toBeGreaterThanOrEqual(0)`.

---

### 요약

이번 변경의 테스트 커버리지는 전반적으로 양호하다. 핵심 경로인 단일턴 WS emit, turnDebug 기록, 에러 회복, BC 호환, 프론트엔드 store 액션, 대화 유틸리티 파싱 모두 명시적으로 검증된다. 다만 멀티턴 재개 경로의 tool telemetry, KbToolProvider/McpToolProvider의 에러 반환 필드 추가에 대한 provider 레벨 단위 테스트, `waiting_for_input` 핸들러의 새 message 파싱 경로 세 가지가 의미있는 회귀 위험으로 남아 있다. 특히 `provider.execute`가 throw 없이 `status: 'error'`를 반환하는 경로는 핸들러가 `result.status ?? 'success'`로 처리하는 미묘한 분기를 포함하므로, 통합 레벨에서 검증해야 할 필요성이 있다.

### 위험도

**MEDIUM**