### 발견사항

---

**[INFO] `ToolCallTrace` 인터페이스 JSDoc — 클라이언트 소비 관계 명시는 충분하나 `providerKey` 필드 설명 누락**
- 위치: `ai-agent.handler.ts` — `ToolCallTrace` 인터페이스
- 상세: `providerKey`가 optional인 이유(MCP는 항상 있고 KB도 있지만 미래 provider는 없을 수 있음)에 대한 설명이 없음. `status` 필드의 의미(provider.execute throw 시에도 'error'가 채워짐)는 `AgentToolResult`에 중복 기술되어 있으나 `ToolCallTrace`에는 없음.
- 제안: `providerKey?: string; // undefined when provider.key is absent` 수준의 한 줄 인라인 주석 추가

---

**[INFO] `runProviderTool` private 메서드 — JSDoc와 실제 동작 간 미세한 불일치**
- 위치: `ai-agent.handler.ts` — `runProviderTool` JSDoc
- 상세: JSDoc에 "catch exceptions so the LLM can still recover"라고 기술되어 있으나, catch 블록이 실제로 어떤 형태의 `AgentToolResult`를 만드는지(JSON `{"error": message}` content) 언급이 없어 호출자가 반환 shape을 추론해야 함.
- 제안: `@returns` 태그 또는 catch 결과의 content shape을 한 줄로 기술 (`content: JSON.stringify({ error: message })`)

---

**[WARNING] `ExecutionContext.nodeId` — optional 처리 이유가 주석에만 있고, 누가 반드시 채워야 하는지 불명확**
- 위치: `node-handler.interface.ts` — `ExecutionContext.nodeId` 필드 JSDoc
- 상세: 주석에 "set by the engine before each handler call"이라는 문구가 `nodeExecutionId`에는 있으나 `nodeId`에는 없음. `nodeId`는 optional(`?`)인데 엔진이 항상 채우는지, 일부 경로(sub-workflow inline run)에서만 있는지 명확하지 않음. `execution-engine.service.ts` diff를 보면 엔진이 `node.id`로 채우므로 "set by the engine before each handler call" 패턴이지만 주석에 없음.
- 제안: `nodeExecutionId`의 JSDoc 패턴을 그대로 따라 "Set by the engine before each handler call; may be absent in legacy test fixtures" 추가

---

**[INFO] `HandlerDependencies.websocketService` 주석 — 소비자 목록이 현재는 AI Agent 하나뿐이나 "e.g."로 처리되어 적절**
- 위치: `node-component.interface.ts` — `HandlerDependencies`
- 상세: `/** Optional — handlers that emit live debug WS events (e.g. AI Agent's tool_call_started/completed) consume it. Other handlers ignore. */` — 내용은 충분함. 다만 `websocketService`가 optional인데 `execution-engine.service.ts`에서 항상 주입되므로 "Test fixtures may omit this"라는 설명이 `ai-agent.handler.ts`에는 있으나 `HandlerDependencies`에는 없어 불일치.
- 제안: "Production always injects this; test fixtures may omit it" 한 줄 추가 또는 현행 유지(수용 가능)

---

**[INFO] `TurnToolCallEntry` 인터페이스 — `status` 필드가 `"pending"`을 지원하지 않는 이유 미기술**
- 위치: `conversation-utils.ts` — `TurnToolCallEntry`
- 상세: 파일 상단 JSDoc에 "handler builds this … so UI can render success/error/pending without parsing tool content"라고 기술했으나 `TurnToolCallEntry.status`는 `"success" | "error"`만 허용. `"pending"`은 WS 라이브 이벤트 전용이고 `turnDebug`에는 완료 후 기록됨을 명시하지 않으면 혼란 유발.
- 제안: `status: "success" | "error"; // 'pending' only exists as a live WS state; persisted turnDebug always has a terminal status` 인라인 주석 추가

---

**[INFO] `messagesToConversationItems` — `options` 파라미터 문서화 미흡**
- 위치: `conversation-utils.ts` — `messagesToConversationItems` JSDoc
- 상세: 함수 JSDoc이 `messages`와 반환값의 linking 로직을 잘 설명하나, `ConvertOptions`의 세 필드(`debugByTurn`, `toolStatusByCallId`, `metaModel`) 각각이 언제 필요한지 기술 없음. `toolStatusByCallId`가 없으면 모든 tool 아이템에 `toolStatus`가 없어 UI에서 배지가 미렌더링됨.
- 제안: `@param options.toolStatusByCallId` 등 JSDoc `@param` 태그로 각 옵션의 역할 한 줄씩 기술

---

**[INFO] `toolStatusMapFromDebug` — private helper이나 두 소비처(parseHistoryMessages, live event handler)를 주석에서 명시 — 적절, 추가 지적 없음**

---

**[INFO] `setConversationMessages` JSDoc — 선택 보존 로직 설명이 코드보다 간략**
- 위치: `execution-store.ts` — `setConversationMessages`
- 상세: 인터페이스 JSDoc에 "Preserve the user's selection when the new array is at least as long" 로직이 구현에는 있으나 인터페이스 주석에는 없음. 소비자가 부작용(selectedConversationItemIndex 변경)을 알아야 안전하게 호출 가능.
- 제안: "Side-effect: resets `selectedConversationItemIndex` if the prior index falls outside the new array bounds." 한 줄 추가

---

**[WARNING] `upsertToolItem` — `toolCallId` 없을 때 dedup 불가 동작이 인터페이스 JSDoc에 미기술**
- 위치: `execution-store.ts` — `upsertToolItem` 인터페이스 JSDoc
- 상세: 인터페이스 주석은 "toolCallId가 없으면 dedup 없이 append"라는 edge case를 언급하지 않음. 구현에는 주석 없이 처리됨. 잘못된 사용(toolCallId 없이 반복 호출)이 조용히 중복 아이템을 만들 수 있음.
- 제안: 인터페이스 JSDoc에 "When `item.toolCallId` is undefined, falls back to plain append without dedup." 추가

---

**[INFO] `handleToolCallStarted` / `handleToolCallCompleted` 콜백 — 인라인 주석 없음**
- 위치: `use-execution-events.ts` — 두 핸들러 함수
- 상세: `handleAiMessage`, `handleWaitingForInput` 등 기존 핸들러들은 내부 로직에 한국어/영어 인라인 주석이 있으나, 두 신규 핸들러는 아무 주석 없이 payload 파싱 → store 액션 호출만 있음. guard clause(`if (!payload.toolCallId || !payload.name) return`)의 이유(백엔드가 두 필드를 항상 보내지만 방어적으로)가 불명확.
- 제안: 현재 코드 스타일(짧은 함수에 주석 생략)에서는 수용 가능. `handleAiMessage`와 일관성을 원한다면 "Legacy fallback"급의 한 줄 주석 추가 검토.

---

**[INFO] `ai_message` 핸들러의 `execution.waiting_for_input` 내 legacy quirk 주석 — 충분히 설명됨**
- 위치: `use-execution-events.ts` — `handleWaitingForInput` 내 turnDebug 처리
- 상세: "Legacy quirk: backend nests llmCalls under another `llmCalls` key here" 주석이 명확. 다만 이 quirk가 언제 제거될 예정인지(TODO/FIXME) 없음.
- 제안: INFO 수준 — 현행 유지 가능. 제거 일정이 있다면 `// TODO: simplify once backend normalises this field` 추가

---

**[INFO] `ExecutionEventType` enum 한국어 주석 일관성**
- 위치: `websocket.service.ts` — `TOOL_CALL_STARTED`, `TOOL_CALL_COMPLETED`
- 상세: 두 신규 값에만 한국어 JSDoc 주석이 있고 기존 값(`EXECUTION_STARTED`, `EXECUTION_COMPLETED` 등)에는 없음(또는 일부만 있음). `EXECUTION_SNAPSHOT`에는 영어 주석. 스타일 불일치.
- 제안: 일관성 정책 선택: 모두 한국어, 모두 영어, 또는 복잡한 것만 주석. 현행 신규 추가분은 내용상 적절하나 스타일 통일 필요.

---

### 요약

이번 변경은 AI Agent tool call 텔레메트리(WS 이벤트, turnDebug.toolCalls, pending/success/error 배지)라는 복잡한 기능을 백엔드·프론트엔드 양측에 걸쳐 추가한 것으로, 핵심 인터페이스(`ToolCallTrace`, `ConversationItem`, `HandlerDependencies`)와 공개 함수(`messagesToConversationItems`, `parseHistoryMessages`, store 액션들)의 문서화 품질은 전반적으로 양호하다. 특히 `runProviderTool`의 에러 복구 의도, `toolStatusMapFromDebug`의 두 소비처 명시, `messagesToConversationItems`의 toolCallId linking 로직 설명은 유지보수에 충분한 컨텍스트를 제공한다. 단, `ExecutionContext.nodeId`에 "set by engine" 문구 누락, `upsertToolItem`의 toolCallId 없을 때 동작 미기술, `TurnToolCallEntry.status`가 `"pending"`을 포함하지 않는 이유 미설명 등 소수의 인터페이스 계약 명확성 문제가 있어 향후 API 소비자 혼란을 유발할 수 있다.

### 위험도

**LOW**