## 발견사항

### [WARNING] ai_message 스냅샷이 tool_call_completed 패치를 덮어씀
- **위치**: `frontend/src/lib/websocket/use-execution-events.ts` — `handleAiMessage` (메시지 배열 분기)
- **상세**: 이벤트 도착 순서가 `tool_call_started` → `tool_call_completed` (store patch) → `ai_message` (snapshot replace)일 때, `setConversationMessages`가 전체 배열을 새로 파싱된 항목으로 교체한다. 이 경로의 `messagesToConversationItems` 호출에는 `toolStatusByCallId`가 전달되지 않으므로 (`debugByTurn`만 전달), tool item들의 `toolStatus / durationMs / error`가 `undefined`로 초기화된다. `tool_call_completed`로 얻은 success/error 배지가 `ai_message` 도착 즉시 사라진다.
  ```typescript
  // 현재: toolStatusByCallId 누락
  const items = messagesToConversationItems(payload.messages, {
    debugByTurn,
    metaModel: payload.metadata?.model,
    // toolStatusByCallId 없음 → tool items에 status 없음
  });
  setConversationMessages(items);
  ```
- **제안**: `ai_message` payload에 turnDebug toolCalls가 있으면 `toolStatusMapFromDebug`를 경유해 `toolStatusByCallId`를 구성하거나, 스냅샷 replace 전에 기존 store에서 toolCallId별 status를 회수해 병합한다:
  ```typescript
  const existingStatusMap = new Map(
    useExecutionStore.getState().conversationMessages
      .filter(i => i.toolCallId && i.toolStatus && i.toolStatus !== 'pending')
      .map(i => [i.toolCallId!, { status: i.toolStatus!, durationMs: i.durationMs, error: i.error }])
  );
  const items = messagesToConversationItems(payload.messages, {
    debugByTurn,
    toolStatusByCallId: existingStatusMap,
    metaModel: payload.metadata?.model,
  });
  ```

---

### [WARNING] tool_call_completed가 tool_call_started보다 먼저 도달하면 dangling pending item 발생
- **위치**: `frontend/src/lib/websocket/use-execution-events.ts` — `handleToolCallCompleted` / `handleToolCallStarted`
- **상세**: 같은 TCP 연결 내 WS 순서는 보장되지만, 재연결·재구독 시나리오에서는 `execution.snapshot` 이후 이벤트 재전송 순서가 뒤집힐 수 있다. `updateToolItem`이 먼저 오면 매칭 항목이 없어 no-op으로 처리되고(`touched = false` 분기), 이후 `upsertToolItem`으로 생성된 pending item은 영구적으로 pending 상태에 머문다. `ai_message` 스냅샷이 도달하지 않으면 UI에 pending spinner가 잔존한다.
- **제안**: `handleToolCallCompleted`에서 대응 항목이 없을 때를 대비해, completed 정보를 일시 보관하는 map(예: `pendingCompletions: Map<toolCallId, patch>`)을 두고 `upsertToolItem` 시 merge하거나, `tool_call_started` 누락 시 status가 confirmed인 항목을 직접 append하는 fallback을 추가한다.

---

### [INFO] `toolCallTraces`의 불필요한 spread copy
- **위치**: `backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` — 여러 `turnDebug` 구성 지점
- **상세**: 동시성 문제는 아니나, `{ toolCalls: [...toolCallTraces] }` 형태로 동일 실행 내 최대 4군데서 copy가 발생한다. 단일 스레드·순차 루프 컨텍스트이므로 원본 공유해도 안전하다.
- **제안**: `toolCallTraces.length > 0 ? { toolCalls: toolCallTraces } : {}`로 불필요한 spread를 제거한다.

---

### [INFO] `toolCallCount` 누적과 `toolCallTraces.push`의 순서 일관성
- **위치**: `backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` — single-turn / multi-turn 양쪽 loop
- **상세**: `toolCallCount++`가 `runProviderTool` 호출 전에 위치하고 `toolCallTraces.push(trace)`가 후에 위치한다. 루프가 순차 `await`로 구성되어 있으므로 실질적 경쟁은 없다. 단, 미래에 `Promise.all`로 병렬화할 경우 `toolCallCount`와 `toolCallTraces` 모두 동시 뮤테이션 위험이 생긴다.
- **제안**: 현재 구조(순차 await)를 유지하거나, 향후 병렬화 시 `results = await Promise.all(...)` 후 count/traces를 일괄 처리하도록 의도를 주석으로 명시한다.

---

## 요약

백엔드(`runProviderTool`)는 순차 `await` 루프로 구성되어 있어 공유 상태 경쟁이 없고, WS 이벤트 emit도 fire-and-forget(void)로 올바르게 처리된다. 주요 위험은 프론트엔드 이벤트 파이프라인에 집중된다. `tool_call_started` → `tool_call_completed` 패치 후 `ai_message` 스냅샷이 도달하면 `setConversationMessages`가 status 정보 없이 전체를 교체하여 tool 상태 배지(success/error/duration)가 소실된다. JavaScript 단일 스레드 환경이므로 전통적 deadlock·race condition은 없으나, WS 이벤트 도착 순서에 따른 논리적 race가 사용자 가시 UI 상태(pending badge 잔존, tool status 소실)에 영향을 준다.

## 위험도

**MEDIUM**