### 발견사항

- **[INFO]** 신규 WS 이벤트 페이로드에 공식 타입 정의 없음
  - 위치: `websocket.service.ts` — `TOOL_CALL_STARTED`, `TOOL_CALL_COMPLETED` 열거형 추가
  - 상세: 두 이벤트의 페이로드 형태는 `ai-agent.handler.ts` `runProviderTool` 내부에 인라인으로 정의되어 있고, 프론트엔드의 `handleToolCallStarted` / `handleToolCallCompleted`는 `data: unknown`을 수동 캐스트로 소비한다. 백엔드-프론트엔드 간 계약이 타입으로 공유되지 않으므로 필드명 오탈자가 런타임까지 침묵하게 된다.
  - 제안: `tool_call_started.payload.d.ts`(또는 shared 패키지)에 `ToolCallStartedPayload`, `ToolCallCompletedPayload` 인터페이스를 정의하고, 백엔드 emit 지점과 프론트엔드 수신부 모두 이를 참조

- **[INFO]** `TOOL_CALL_COMPLETED` 페이로드의 `content` 필드는 JSON 문자열
  - 위치: `ai-agent.handler.ts:runProviderTool`, `use-execution-events.ts:handleToolCallCompleted`
  - 상세: `content: result.content`는 `JSON.stringify(...)` 된 문자열이며 프론트엔드는 `tryParseJson`으로 역직렬화한다. 계약상 타입이 `string`인지 `unknown`인지 명시되어 있지 않아, 향후 다른 소비자가 raw 문자열로 취급할 위험이 있다.
  - 제안: 페이로드 정의에 `content: string (JSON-encoded)` 또는 `result: unknown`으로 의도를 명시

- **[INFO]** `execution.ai_message` 이벤트 처리 전략이 append → replace로 변경됨
  - 위치: `use-execution-events.ts` — `handleAiMessage` (기존 `addConversationMessage` → `setConversationMessages`)
  - 상세: `messages` 배열이 존재하면 전체를 교체하고, 없으면 단일 assistant item을 추가하는 레거시 경로가 남는다. 두 동작이 같은 이벤트 타입에 혼재하므로 계약 명세 없이는 소비 측에서 어느 경로가 실행될지 예측하기 어렵다.
  - 제안: `messages` 필드 유무에 따른 두 모드를 이벤트 페이로드 스펙(spec 문서)에 명시

- **[INFO]** `nodeId` 필드가 `ExecutionContext`에 optional로 추가되었으나 핸들러에서 빈 문자열 폴백 사용
  - 위치: `ai-agent.handler.ts:696`, `ai-agent.handler.ts:891`
  - 상세: `context.nodeId ?? ''` 또는 `(state.nodeId as string | undefined) ?? ''`로 WS 이벤트의 `nodeId`에 빈 문자열이 전달될 수 있다. 프론트엔드 `handleToolCallStarted`는 `nodeId`를 사용하지 않아 현재는 무해하지만, 미래 소비자가 이 필드를 신뢰할 때 계약 위반이 된다.
  - 제안: `nodeId`가 없는 경우 WS 이벤트를 emit하지 않거나 `nodeId` 필드를 페이로드에서 제외하도록 조건 처리

---

### 요약

이번 변경은 모두 **가산적(additive)** 입니다. 새 WS 이벤트 타입 2종은 기존 클라이언트가 알 수 없는 이벤트를 무시하므로 호환성이 깨지지 않고, `AgentToolResult.status/error`, `ExecutionContext.nodeId`, `HandlerDependencies.websocketService`, `AiAgentHandler` 세 번째 생성자 인자 모두 optional로 추가되어 기존 호출부에 영향이 없습니다. `ai_message` 이벤트의 append → replace 동작 전환도 내부 store 변경으로 외부 WS API 계약에는 영향이 없습니다. 다만 신규 이벤트 페이로드 형태가 공유 타입 없이 인라인 캐스트로만 관리되고 있어, 소비자가 늘어날수록 계약 불일치가 침묵하고 누적될 수 있습니다.

### 위험도

LOW