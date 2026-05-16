# 의존성(Dependency) Review Payload

본 파일은 orchestrator 가 의존성(Dependency) reviewer 용으로 작성한 입력입니다. 다음 코드 변경을 의존성 관점에서 분석한다.
sub-agent 의 system prompt 에 정의된 호출 규약·등급 기준·출력 형식을 그대로
따르되, 분석 시 아래 "점검 관점" 을 빠짐없이 적용하세요. 결과는 `output_file`
인자에 review.md 로 Write 하고 호출자에게는 STATUS 한 줄만 반환합니다.

## 점검 관점 (의존성(Dependency))

1. **새 의존성**: 새 외부 패키지/라이브러리 추가 여부와 필요성
2. **버전 고정**: 의존성 버전 고정(pinning) 여부
3. **라이선스**: 새 의존성의 라이선스가 프로젝트와 호환되는지
4. **취약점**: 알려진 보안 취약점이 있는 의존성 사용 여부
5. **불필요한 의존성**: 표준 라이브러리·기존 의존성으로 대체 가능한지
6. **의존성 크기**: 번들 크기·빌드 시간 영향
7. **호환성**: 기존 의존성과의 버전 충돌·호환성
8. **내부 의존성**: 프로젝트 내부 모듈 간 의존 관계

## 리뷰 대상 파일

### 파일 1: backend/src/modules/execution-engine/execution-engine.service.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/modules/execution-engine/execution-engine.service.spec.ts b/backend/src/modules/execution-engine/execution-engine.service.spec.ts
index 89ed0013..6b90f445 100644
--- a/backend/src/modules/execution-engine/execution-engine.service.spec.ts
+++ b/backend/src/modules/execution-engine/execution-engine.service.spec.ts
@@ -6091,9 +6091,36 @@ describe('buildConversationConfigFromOutput', () => {
         { role: 'system', content: 'reset' },
       ],
     });
+    // Each non-system message gets `source: 'live'` backfilled per
+    // spec/5-system/6-websocket-protocol.md §4.4.6 (default when handler
+    // didn't tag the push site explicitly).
     expect(conv.messages).toEqual([
-      { role: 'user', content: 'hi' },
-      { role: 'assistant', content: 'hello' },
+      { role: 'user', content: 'hi', source: 'live' },
+      { role: 'assistant', content: 'hello', source: 'live' },
+    ]);
+  });
+
+  it("preserves explicit source: 'injected' from ConversationThread injection (§4.4.6)", () => {
+    const conv = buildConversationConfigFromOutput({
+      messages: [
+        { role: 'system', content: 'You are helpful' },
+        {
+          role: 'user',
+          content: '[from Template] start',
+          source: 'injected',
+        },
+        { role: 'user', content: 'live message', source: 'live' },
+        { role: 'assistant', content: 'response' }, // unmarked → backfilled
+      ],
+    });
+    expect(conv.messages).toEqual([
+      {
+        role: 'user',
+        content: '[from Template] start',
+        source: 'injected',
+      },
+      { role: 'user', content: 'live message', source: 'live' },
+      { role: 'assistant', content: 'response', source: 'live' },
     ]);
   });
 

```

---

### 파일 2: backend/src/modules/execution-engine/execution-engine.service.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/modules/execution-engine/execution-engine.service.ts b/backend/src/modules/execution-engine/execution-engine.service.ts
index e915422d..7b0b8977 100644
--- a/backend/src/modules/execution-engine/execution-engine.service.ts
+++ b/backend/src/modules/execution-engine/execution-engine.service.ts
@@ -271,9 +271,28 @@ export function buildAiMessageDebugFromResumeState(
   return result;
 }
 
+/**
+ * Backfill `source: 'live'` on any non-system message that lacks the marker.
+ * The handler's `messages.push` sites leave `source` undefined so the
+ * 'live' default applies here in one place; injection results from
+ * `mapTurnsToChatMessages` already set `'injected'` and are preserved.
+ * Spec: spec/5-system/6-websocket-protocol.md §4.4.6.
+ */
+function withSourceMarker(
+  messages: Array<Record<string, unknown>>,
+): Array<Record<string, unknown>> {
+  return messages.map((m) =>
+    m.source === 'injected' || m.source === 'live'
+      ? m
+      : { ...m, source: 'live' as const },
+  );
+}
+
 /**
  * Build the WS-event `conversationConfig` block from a NodeHandlerOutput's
- * `output`. System messages are filtered out for client display.
+ * `output`. System messages are filtered out for client display, and each
+ * remaining message is guaranteed to carry a `source: 'live' | 'injected'`
+ * marker per spec/5-system/6-websocket-protocol.md §4.4.6.
  */
 export function buildConversationConfigFromOutput(
   output: Record<string, unknown> | undefined,
@@ -301,7 +320,7 @@ export function buildConversationConfigFromOutput(
   } = {
     message: (o.message as string | undefined) ?? '',
     turnCount: (o.turnCount as number | undefined) ?? 0,
-    messages: messagesAll.filter((m) => m.role !== 'system'),
+    messages: withSourceMarker(messagesAll.filter((m) => m.role !== 'system')),
   };
   const maxTurns = o.maxTurns as number | undefined;
   if (maxTurns !== undefined) result.maxTurns = maxTurns;
@@ -2163,7 +2182,9 @@ export class ExecutionEngineService
     const sourceMessages = Array.isArray(newResult.messages)
       ? (newResult.messages as Array<Record<string, unknown>>)
       : [];
-    const condMessages = sourceMessages.filter((m) => m.role !== 'system');
+    const condMessages = withSourceMarker(
+      sourceMessages.filter((m) => m.role !== 'system'),
+    );
     const responseText = (newResult.response as string | undefined) ?? '';
     const turnCount = newResult.turnCount as number | undefined;
     const metaSource =

```

---

### 파일 3: backend/src/modules/integrations/third-party-oauth.controller.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/modules/integrations/third-party-oauth.controller.spec.ts b/backend/src/modules/integrations/third-party-oauth.controller.spec.ts
index 0249d57a..49190f1a 100644
--- a/backend/src/modules/integrations/third-party-oauth.controller.spec.ts
+++ b/backend/src/modules/integrations/third-party-oauth.controller.spec.ts
@@ -425,9 +425,10 @@ describe('ThirdPartyOAuthController — cafe24 install routes', () => {
       res as never,
     );
     expect(res.statusCode).toBe(404);
-    const contentType = (res as { headers?: Record<string, unknown> })
-      .headers?.['Content-Type'];
-    expect(String(contentType ?? '')).toContain('text/html');
+    const contentType = (res as { headers?: Record<string, string> }).headers?.[
+      'Content-Type'
+    ];
+    expect(contentType ?? '').toContain('text/html');
     const bodyStr = String(res.body);
     expect(bodyStr).toContain('CAFE24_INSTALL_INVALID_TOKEN');
     expect(bodyStr).toContain('token gone');

```

---

### 파일 4: backend/src/modules/llm/interfaces/llm-client.interface.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/modules/llm/interfaces/llm-client.interface.ts b/backend/src/modules/llm/interfaces/llm-client.interface.ts
index cc1b64a7..29d26e29 100644
--- a/backend/src/modules/llm/interfaces/llm-client.interface.ts
+++ b/backend/src/modules/llm/interfaces/llm-client.interface.ts
@@ -3,6 +3,18 @@ export interface ChatMessage {
   content: string;
   toolCallId?: string;
   toolCalls?: ToolCall[];
+  /**
+   * Origin marker for AI Agent's WebSocket emit per
+   * spec/5-system/6-websocket-protocol.md §4.4.6:
+   *  - `'live'`: produced by the current AI node's handler in this turn.
+   *  - `'injected'`: prepended via ConversationThread injection (an upstream
+   *    node's turn mapped per spec/conventions/conversation-thread.md §5.1).
+   *
+   * Strictly transport-layer metadata — `LlmService` strips this field
+   * before forwarding to provider clients so LLM APIs only see the canonical
+   * `{role, content, toolCalls?, toolCallId?}` shape.
+   */
+  source?: 'live' | 'injected';
 }
 
 export interface ToolDef {

```

---

### 파일 5: backend/src/modules/llm/llm.service.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/modules/llm/llm.service.ts b/backend/src/modules/llm/llm.service.ts
index 0e61df17..7b07e0e3 100644
--- a/backend/src/modules/llm/llm.service.ts
+++ b/backend/src/modules/llm/llm.service.ts
@@ -80,6 +80,18 @@ export class LlmService {
     opts?: { timeoutMs?: number; disableInnerRetry?: boolean },
   ): Promise<ChatResult> {
     const client = this.createClient(config);
+    // Strip `source` (WebSocket emit metadata per
+    // spec/5-system/6-websocket-protocol.md §4.4.6) before forwarding to the
+    // provider client — LLM APIs only see the canonical
+    // {role, content, toolCalls?, toolCallId?} shape. The handler keeps the
+    // marker on its in-memory `messages` array so emit paths preserve it.
+    const sanitized: ChatParams = {
+      ...params,
+      messages: params.messages.map(({ source, ...rest }) => {
+        void source;
+        return rest;
+      }),
+    };
     // disableInnerRetry: 호출자가 외부에서 retryWithBackoff 같은 자체 재시도 layer 를 가진 경우
     // 내부 rate-limit 재시도 (withRetry) 와 겹쳐 호출 횟수가 비선형 증폭되는 것을 막는다.
     const run = () =>
@@ -87,8 +99,8 @@ export class LlmService {
         ? // LLMClient.chat 은 아직 AbortSignal 을 받지 않으므로 race 만 적용
           // (후속 PR 에서 인터페이스 확장 시 signal 도 전달). 백그라운드 소켓은
           // provider HTTP 클라이언트가 자체 keep-alive 풀로 GC.
-          withTimeout(() => client.chat(params), opts.timeoutMs)
-        : client.chat(params);
+          withTimeout(() => client.chat(sanitized), opts.timeoutMs)
+        : client.chat(sanitized);
     const result = await (opts?.disableInnerRetry
       ? run()
       : this.withRetry(run));

```

---

### 파일 6: backend/src/nodes/ai/ai-agent/ai-agent.handler.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts b/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts
index ae88e819..d2df363f 100644
--- a/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts
+++ b/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts
@@ -294,31 +294,50 @@ class RagAccumulatorGroup {
 function mapTurnsToChatMessages(
   turns: readonly import('../../../shared/conversation-thread/conversation-thread.types').ConversationTurn[],
 ): ChatMessage[] {
+  // All messages produced here are prepended via ConversationThread injection
+  // and must carry `source: 'injected'` for the WebSocket emit layer
+  // (spec/5-system/6-websocket-protocol.md §4.4.6). The current node's
+  // handler will push its own `live` messages on top of these.
   return turns.map((t): ChatMessage => {
     switch (t.source) {
       case 'presentation_user':
         return {
           role: 'user',
           content: `[from ${t.nodeLabel}] ${t.text}`,
+          source: 'injected',
         } as ChatMessage;
       case 'ai_user':
-        return { role: 'user', content: t.text } as ChatMessage;
+        return {
+          role: 'user',
+          content: t.text,
+          source: 'injected',
+        } as ChatMessage;
       case 'ai_assistant':
         return {
           role: 'assistant',
           content: t.text,
           ...(t.toolCalls ? { toolCalls: t.toolCalls } : {}),
+          source: 'injected',
         } as ChatMessage;
       case 'ai_tool':
         return {
           role: 'tool',
           content: t.text,
           ...(t.toolCallId ? { toolCallId: t.toolCallId } : {}),
+          source: 'injected',
         } as ChatMessage;
       case 'system':
-        return { role: 'system', content: t.text } as ChatMessage;
+        return {
+          role: 'system',
+          content: t.text,
+          source: 'injected',
+        } as ChatMessage;
       default:
-        return { role: 'user', content: t.text } as ChatMessage;
+        return {
+          role: 'user',
+          content: t.text,
+          source: 'injected',
+        } as ChatMessage;
     }
   });
 }

```

---

### 파일 7: backend/src/nodes/ai/ai-agent/ai-agent.thread.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/ai/ai-agent/ai-agent.thread.spec.ts b/backend/src/nodes/ai/ai-agent/ai-agent.thread.spec.ts
index 366c6f7b..0b906c54 100644
--- a/backend/src/nodes/ai/ai-agent/ai-agent.thread.spec.ts
+++ b/backend/src/nodes/ai/ai-agent/ai-agent.thread.spec.ts
@@ -560,5 +560,66 @@ describe('AiAgentHandler — ConversationThread push & inject', () => {
         droppedTurns: 0,
       });
     });
+
+    // spec/5-system/6-websocket-protocol.md §4.4.6 — `source: 'injected'`
+    // must mark every message that comes from ConversationThread injection
+    // (mapTurnsToChatMessages) so the frontend can skip them when computing
+    // turn indices. Handler push sites leave `source` undefined; the emit
+    // layer (buildConversationConfigFromOutput) backfills `'live'` there.
+    it("tags injected messages with source: 'injected' and leaves handler-pushed messages unmarked", async () => {
+      const context = makeContext();
+      seedThreadFromOtherNode(context);
+      const first = await handler.execute(
+        undefined,
+        {
+          mode: 'multi_turn',
+          model: 'gpt-4o',
+          systemPrompt: 'You are helpful',
+          maxToolCalls: 10,
+          maxTurns: 20,
+          contextScope: 'thread',
+          contextInjectionMode: 'messages',
+        },
+        context,
+      );
+      const state = (first as { _resumeState: Record<string, unknown> })
+        ._resumeState;
+
+      const turnResult = (await handler.processMultiTurnMessage(
+        '실제 메시지',
+        state,
+      )) as {
+        output: {
+          messages: Array<{
+            role: string;
+            content: string;
+            source?: 'live' | 'injected';
+          }>;
+        };
+      };
+
+      const msgs = turnResult.output.messages;
+      // Expect: [system?, injected user (form), injected assistant (prev), live user, live assistant]
+      const injected = msgs.filter((m) => m.source === 'injected');
+      const unmarked = msgs.filter((m) => m.source === undefined);
+      const live = msgs.filter((m) => m.source === 'live');
+
+      // mapTurnsToChatMessages marked the 2 injected entries.
+      expect(injected.length).toBeGreaterThanOrEqual(2);
+      const injectedRoles = injected.map((m) => m.role);
+      expect(injectedRoles).toEqual(
+        expect.arrayContaining(['user', 'assistant']),
+      );
+      // Handler push sites (user message + final assistant) stay unmarked —
+      // the emit layer fills 'live' there. No accidental 'live' tagging on
+      // handler push.
+      expect(live.length).toBe(0);
+      // Exactly 1 live user + 1 live assistant in unmarked bucket.
+      expect(unmarked.filter((m) => m.role === 'user')).toHaveLength(1);
+      expect(unmarked.filter((m) => m.role === 'assistant')).toHaveLength(1);
+      expect(unmarked.find((m) => m.role === 'user')?.content).toBe(
+        '실제 메시지',
+      );
+    });
   });
 });

```

---

### 파일 8: frontend/src/lib/conversation/__tests__/conversation-utils.test.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/frontend/src/lib/conversation/__tests__/conversation-utils.test.ts b/frontend/src/lib/conversation/__tests__/conversation-utils.test.ts
index 3d4fced8..5898c657 100644
--- a/frontend/src/lib/conversation/__tests__/conversation-utils.test.ts
+++ b/frontend/src/lib/conversation/__tests__/conversation-utils.test.ts
@@ -325,3 +325,119 @@ describe("parseHistoryMessages — tool message integration", () => {
     expect(items).toHaveLength(2);
   });
 });
+
+describe("messagesToConversationItems — source marker (spec/5-system/6-websocket-protocol.md §4.4.6)", () => {
+  it("does not increment currentTurn for injected user messages so assistant turnIndex matches backend turnCount", () => {
+    // Scenario from the regression that motivated source markers: a
+    // ConversationThread injection from an upstream Template node prepends
+    // `role: 'user'` with source='injected'. Without the marker, the
+    // converter would assign turnIndex=2 to the assistant message even
+    // though backend's turnCount=1 — breaking llmCalls lookup in the
+    // debugging timeline.
+    const debugByTurn = new Map([
+      [
+        1,
+        {
+          turnIndex: 1,
+          llmCalls: [
+            {
+              requestPayload: { messages: ["..."] },
+              responsePayload: { content: "응답", usage: {} },
+              durationMs: 100,
+            },
+          ],
+        },
+      ],
+    ]);
+    const items = messagesToConversationItems(
+      [
+        {
+          role: "user",
+          content: "[from Template] clicked: 시작",
+          source: "injected",
+        },
+        { role: "user", content: "어떤 상품이 있는지 알려줘", source: "live" },
+        { role: "assistant", content: "죄송합니다...", source: "live" },
+      ],
+      { debugByTurn },
+    );
+
+    expect(items).toHaveLength(3);
+    expect(items[0]).toMatchObject({
+      type: "user",
+      content: "[from Template] clicked: 시작",
+      turnIndex: 1,
+      isInjected: true,
+    });
+    expect(items[1]).toMatchObject({
+      type: "user",
+      content: "어떤 상품이 있는지 알려줘",
+      turnIndex: 1,
+      isInjected: false,
+    });
+    expect(items[2]).toMatchObject({
+      type: "assistant",
+      content: "죄송합니다...",
+      turnIndex: 1,
+      isInjected: false,
+    });
+    // Debug payload now attaches because debugByTurn.get(1) matches.
+    expect(items[2].requestPayload).toEqual({ messages: ["..."] });
+    expect(items[2].responsePayload).toMatchObject({ content: "응답" });
+  });
+
+  it("treats missing source as 'live' for backward compatibility with older payloads", () => {
+    const items = messagesToConversationItems([
+      { role: "user", content: "안녕" },
+      { role: "assistant", content: "안녕하세요!" },
+    ]);
+    expect(items[0]).toMatchObject({ turnIndex: 1, isInjected: false });
+    expect(items[1]).toMatchObject({ turnIndex: 1, isInjected: false });
+  });
+
+  it("handles multiple injected user messages followed by a live turn (multi-thread injection)", () => {
+    const items = messagesToConversationItems([
+      { role: "user", content: "[from Form] name=Alice", source: "injected" },
+      { role: "user", content: "[from AI Agent] 안녕", source: "injected" },
+      {
+        role: "assistant",
+        content: "[from AI Agent] 안녕하세요",
+        source: "injected",
+      },
+      { role: "user", content: "실제 사용자 메시지", source: "live" },
+      { role: "assistant", content: "응답", source: "live" },
+    ]);
+    const liveAssistant = items.find(
+      (i) => i.type === "assistant" && !i.isInjected,
+    );
+    expect(liveAssistant?.turnIndex).toBe(1);
+    // Two injected user messages do not bump turn.
+    const liveUser = items.find((i) => i.type === "user" && !i.isInjected);
+    expect(liveUser?.turnIndex).toBe(1);
+  });
+
+  it("tool message inherits turnIndex of its originating assistant call (injected vs live aware)", () => {
+    const items = messagesToConversationItems([
+      { role: "user", content: "[from Template] start", source: "injected" },
+      { role: "user", content: "오늘 날씨", source: "live" },
+      {
+        role: "assistant",
+        content: "",
+        toolCalls: [
+          { id: "call_1", name: "get_weather", arguments: '{"city":"Seoul"}' },
+        ],
+        source: "live",
+      },
+      {
+        role: "tool",
+        toolCallId: "call_1",
+        content: '{"temperature":12.3}',
+      },
+      { role: "assistant", content: "기온 12.3도입니다.", source: "live" },
+    ]);
+    const tool = items.find((i) => i.type === "tool");
+    expect(tool).toMatchObject({ turnIndex: 1 });
+    const finalAssistant = items.filter((i) => i.type === "assistant").at(-1);
+    expect(finalAssistant?.turnIndex).toBe(1);
+  });
+});

```

---

### 파일 9: frontend/src/lib/conversation/conversation-utils.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/frontend/src/lib/conversation/conversation-utils.ts b/frontend/src/lib/conversation/conversation-utils.ts
index df27dd7e..5df5a59f 100644
--- a/frontend/src/lib/conversation/conversation-utils.ts
+++ b/frontend/src/lib/conversation/conversation-utils.ts
@@ -36,6 +36,15 @@ interface RawMessage {
   content?: string;
   toolCalls?: Array<{ id?: string; name?: string; arguments?: string }>;
   toolCallId?: string;
+  /**
+   * Origin marker emitted by backend per
+   * spec/5-system/6-websocket-protocol.md §4.4.6. `'live'` = produced by the
+   * current AI node's handler in this turn. `'injected'` = prepended by
+   * ConversationThread injection (an upstream node's turn). Missing → treated
+   * as `'live'` for backward compatibility with older payloads and persisted
+   * `outputData.messages`.
+   */
+  source?: "live" | "injected";
 }
 
 interface ToolStatusInfo {
@@ -75,20 +84,37 @@ export function messagesToConversationItems(
   >();
 
   for (const msg of messages) {
+    // spec/5-system/6-websocket-protocol.md §4.4.6 — `source` defaults to
+    // `'live'` when absent (older backends / persisted outputData).
+    const isInjected = msg.source === "injected";
+
     if (msg.role === "user") {
-      currentTurn++;
-      assistantIdxInTurn = 0;
+      // Only `live` user messages advance the turn counter. Injected user
+      // messages (ConversationThread prepended an upstream node's turn) are
+      // displayed in the timeline but must NOT shift `currentTurn`, or the
+      // assistant's `turnIndex` would diverge from backend `turnCount` and
+      // the debug payload lookup in `debugByTurn` would miss.
+      if (!isInjected) {
+        currentTurn++;
+        assistantIdxInTurn = 0;
+      }
       items.push({
         type: "user",
         content: msg.content ?? "",
-        turnIndex: currentTurn,
+        turnIndex: currentTurn || 1,
+        isInjected,
       });
       continue;
     }
 
     if (msg.role === "assistant") {
+      // For injected assistant messages (other AI Agent's turn prepended via
+      // thread injection), keep the current turn so they group with whatever
+      // injected user messages preceded them. `assistantIdxInTurn` increment
+      // is also skipped — the current node's `llmCalls[]` only covers live
+      // assistant calls.
       const turn = currentTurn || 1;
-      const debug = debugByTurn?.get(turn);
+      const debug = isInjected ? undefined : debugByTurn?.get(turn);
 
       let callDebug: LlmCallEntry | undefined;
       if (debug?.llmCalls && debug.llmCalls.length > 0) {
@@ -131,6 +157,7 @@ export function messagesToConversationItems(
         type: "assistant",
         content: msg.content ?? "",
         turnIndex: turn,
+        isInjected,
         assistantToolCalls: toolCalls?.length ? toolCalls : undefined,
         requestPayload: callDebug?.requestPayload,
         responsePayload: callDebug?.responsePayload,
@@ -142,7 +169,12 @@ export function messagesToConversationItems(
         },
       });
 
-      assistantIdxInTurn++;
+      // Only advance the per-turn assistant index for live calls — injected
+      // assistant messages aren't backed by an entry in this node's
+      // `debugByTurn` so they shouldn't claim a `llmCalls[]` slot.
+      if (!isInjected) {
+        assistantIdxInTurn++;
+      }
       continue;
     }
 
@@ -155,6 +187,7 @@ export function messagesToConversationItems(
         type: "tool",
         content: info?.name ?? "(unknown tool)",
         turnIndex: info?.turnIndex ?? (currentTurn || 1),
+        isInjected,
         toolCallId: callId,
         toolArgs: info?.arguments ? tryParseJson(info.arguments) : undefined,
         toolResult: tryParseJson(msg.content),

```

---

### 파일 10: frontend/src/lib/stores/execution-store.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/frontend/src/lib/stores/execution-store.ts b/frontend/src/lib/stores/execution-store.ts
index ce5b7115..9fdc476d 100644
--- a/frontend/src/lib/stores/execution-store.ts
+++ b/frontend/src/lib/stores/execution-store.ts
@@ -82,6 +82,16 @@ export interface ConversationItem {
   /** Human-readable error message when toolStatus is 'error'. */
   error?: string;
   turnIndex: number;
+  /**
+   * `true` when this item was produced by `ConversationThread` injection
+   * (an upstream node's turn prepended to messages) rather than processed
+   * live by the current AI node. Mirrors the WebSocket payload's
+   * `messages[].source === 'injected'` (spec/5-system/6-websocket-protocol.md
+   * §4.4.6). Used by the debugging timeline to skip injected user messages
+   * when computing turn indices and by UI to render an "injected context"
+   * chip.
+   */
+  isInjected?: boolean;
   /** Timestamp when the message was sent/received */
   timestamp?: string;
   /** Duration in ms (for assistant: LLM latency, for tool: provider exec time) */

```

---

### 파일 11: frontend/src/lib/websocket/use-execution-events.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/frontend/src/lib/websocket/use-execution-events.ts b/frontend/src/lib/websocket/use-execution-events.ts
index 8d3c1c72..294bb497 100644
--- a/frontend/src/lib/websocket/use-execution-events.ts
+++ b/frontend/src/lib/websocket/use-execution-events.ts
@@ -222,6 +222,8 @@ export function useExecutionEvents({
             content?: string;
             toolCalls?: Array<{ id?: string; name?: string; arguments?: string }>;
             toolCallId?: string;
+            // spec/5-system/6-websocket-protocol.md §4.4.6
+            source?: "live" | "injected";
           }>;
           turnCount?: number;
           maxTurns?: number;
@@ -317,6 +319,8 @@ export function useExecutionEvents({
           content?: string;
           toolCalls?: Array<{ id?: string; name?: string; arguments?: string }>;
           toolCallId?: string;
+          // spec/5-system/6-websocket-protocol.md §4.4.6
+          source?: "live" | "injected";
         }>;
         metadata?: {
           model?: string;

```

---

### 파일 12: plan/in-progress/spec-update-impl-prep-findings.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/plan/in-progress/spec-update-impl-prep-findings.md b/plan/in-progress/spec-update-impl-prep-findings.md
new file mode 100644
index 00000000..b2c009b8
--- /dev/null
+++ b/plan/in-progress/spec-update-impl-prep-findings.md
@@ -0,0 +1,29 @@
+---
+worktree: ai-thread-source-mark-7c4f2a
+started: 2026-05-16
+owner: planner (위임)
+---
+
+# Spec Update 제안 — impl-prep consistency-check 부산물
+
+`/consistency-check --impl-prep spec/5-system/` (세션 `review/consistency/2026/05/16/10_01_06/`) 에서 발견된 Critical 4건은 본 작업(AI 대화 messages[].source 마커 구현)과 인과 관계가 없는 **다른 spec 영역의 기존 이슈**다. 본 plan 은 그 이슈들을 project-planner 가 별도 작업으로 처리하도록 위임 메모.
+
+## 처리 항목
+
+- [ ] **C1**: `spec/1-data-model.md §2.13 Execution` 에 `re_run_of UUID NULL` / `chain_id UUID NOT NULL` 컬럼·인덱스 추가. `spec/5-system/13-replay-rerun.md §9.1` 와 정합.
+- [ ] **C2**: `spec/5-system/10-graph-rag.md §2.2` 의 `graph_extraction_status` Enum 목록에 `failed` 추가 — 동일 문서 §7·§3.2 에서 이미 사용 중이므로 명백한 자체 모순.
+- [ ] **C3**: `spec/5-system/10-graph-rag.md Rationale` 의 폐기된 `memory/graph-rag-decisions.md` 참조 제거 또는 `plan/complete/archive/from-memory/` 실제 경로로 갱신.
+- [ ] **C4**: `spec/5-system/10-graph-rag.md Rationale` 의 폐기된 `prd/*.md` 경로 4건을 `spec/` 이관 경로로 갱신 또는 "역사 기록" 주석 부기.
+
+## 부수 Warning (참고용)
+
+상세는 세션 `SUMMARY.md` 참조. 본 작업과 무관하므로 별도 처리.
+
+- W1: API 경로 prefix 혼재 (`/api/v1/` vs `/api/`) — `spec/5-system/2-api-convention.md` 에서 정책 확정 필요.
+- W4: `11-mcp-client.md §8.3` 가 존재하지 않는 `4-integration.md §14` 참조.
+- W8/W9/W10: 일부 spec 의 Overview/Rationale 섹션 누락.
+- W11: webhook spec Overview 에 `prd/` 출처 표기 잔류.
+
+## 위임
+
+위 항목은 project-planner 가 별도 worktree 에서 spec 갱신해야 한다. 본 작업(`ai-thread-source-mark-7c4f2a`) 의 PR 머지와 무관하게 진행.

```

---

### 파일 13: review/consistency/2026/05/16/10_01_06/SUMMARY.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/10_01_06/SUMMARY.md b/review/consistency/2026/05/16/10_01_06/SUMMARY.md
new file mode 100644
index 00000000..e7f615a7
--- /dev/null
+++ b/review/consistency/2026/05/16/10_01_06/SUMMARY.md
@@ -0,0 +1,39 @@
+# Consistency Check 통합 보고서 (impl-prep, scope=spec/5-system/)
+
+**BLOCK: YES** — Critical 발견 4건. 단, 발견된 Critical 모두 **본 작업(AI 대화 messages[].source 마커 구현)과 인과 관계 없음** — 별도 spec 영역의 기존 이슈.
+
+## 본 작업의 영향 범위 안 결과 (필터링)
+
+- `spec/5-system/6-websocket-protocol.md` (§4.4.6 신규 추가) — Critical 없음
+- `spec/conventions/conversation-thread.md` (§5.1 보강) — Critical 없음
+- `spec/3-workflow-editor/3-execution.md` (§8.1 동기화) — Critical 없음
+- 직전 spec write 단계 검토(2026-05-16 09:42:54)에서 WARNING 1건이 보강 문장으로 해소된 상태 그대로
+
+## 발견된 Critical (모두 본 작업 범위 밖)
+
+| # | 파일 | 이슈 | 본 작업과의 관련성 |
+|---|---|---|---|
+| C1 | `spec/5-system/13-replay-rerun.md §9.1` | `re_run_of`/`chain_id` 컬럼이 `spec/1-data-model.md §2.13` 과 미동기 | 없음 — 다른 작업(`plan/in-progress/replay-rerun.md`) 영역 |
+| C2 | `spec/5-system/10-graph-rag.md §2.2` | `graph_extraction_status` Enum 에 `failed` 누락 | 없음 — Graph RAG 영역 |
+| C3 | `spec/5-system/10-graph-rag.md Rationale` | 폐기된 `memory/graph-rag-decisions.md` 직접 참조 | 없음 — docs-consolidation 잔존물 |
+| C4 | `spec/5-system/10-graph-rag.md Rationale` | 폐기된 `prd/*.md` 경로 참조 잔존 | 없음 — docs-consolidation 잔존물 |
+
+## 결정
+
+- **본 작업의 구현은 진행 가능** — 모든 Critical 이 다른 spec 영역의 기존 이슈이고, 본 작업이 이를 도입/악화시키지 않음.
+- 발견된 Critical 들은 `plan/in-progress/spec-update-impl-prep-findings.md` 에 별도 기록해 project-planner 가 처리하도록 위임.
+
+## WARNING / INFO (전체 21건) 중 본 작업 관련
+
+- 본 작업 직접 관련: 없음.
+- 관련성 있을 가능성: I17 (`document:graph_error` 이벤트 의미 변경) — frontend 핸들러 마이그레이션 확인 필요. 본 작업 외 영역이지만 frontend 작업 중 발견되면 별도 fix.
+
+## 권장 후속 조치
+
+1. **본 작업 진행** (developer 가 backend → frontend 차례로 구현).
+2. **별도 plan 작성** — `spec-update-impl-prep-findings.md` 에 C1–C4 항목 기록 → project-planner 에 위임.
+3. 다음 spec/5-system 작업 진입 시 이 SUMMARY 와 별도 plan 을 다시 참조해 미해결 잔존 여부 확인.
+
+## 원본 Critical/Warning/Info 전문
+
+(consistency-summary sub-agent 보고서 본문은 `_retry_state.json` 에서 참고 — 항목 수: cross_spec 9 / rationale_continuity 7 / convention_compliance 10 / plan_coherence 7 / naming_collision 6. 본 SUMMARY 는 본 작업 의사결정에 필요한 부분만 압축.)

```

---

### 파일 14: review/consistency/2026/05/16/10_01_06/_prompts/convention_compliance.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/10_01_06/_prompts/convention_compliance.md b/review/consistency/2026/05/16/10_01_06/_prompts/convention_compliance.md
new file mode 100644
index 00000000..74a65b42
--- /dev/null
+++ b/review/consistency/2026/05/16/10_01_06/_prompts/convention_compliance.md
@@ -0,0 +1,2688 @@
+# 정식 규약 준수 Check Payload
+
+본 파일은 orchestrator 가 정식 규약 준수 checker 용으로 작성한 입력입니다. target 문서가 정식 규약(`spec/conventions/**`) 을 따르고 있는지 분석한다.
+sub-agent 의 system prompt 에 정의된 호출 규약·등급 기준·출력 형식을 그대로
+따르되, 분석 시 아래 "점검 관점" 을 빠짐없이 적용하세요. 결과는 `output_file`
+인자에 review.md 로 Write 하고 호출자에게는 STATUS 한 줄만 반환합니다.
+
+## 점검 관점 (정식 규약 준수)
+
+1. **명명 규약** — 파일·식별자·API endpoint 명명이 conventions 규칙과 일치하는가
+2. **출력 포맷 규약** — 노드 Output, API 응답, error code 형식 등이 정식 규약을 따르는가
+3. **문서 구조 규약** — Overview / 본문 / Rationale 3섹션 권장, `_product-overview.md`·`0-` prefix 등 CLAUDE.md 의 명명 컨벤션 준수
+4. **API 문서 규약** — Swagger 패턴·request/response DTO 명명
+5. **금지 항목** — conventions 에서 명시적으로 금지한 패턴(예: 옛 prd/, memory/ 경로 사용)을 답습하고 있지 않은가
+
+## 검토 모드
+구현 착수 전 검토 (--impl-prep, scope=spec/5-system/)
+
+## Target 문서
+경로: `spec/5-system/`
+
+```
+### 구현 대상 영역: `spec/5-system/`
+
+#### `spec/5-system/1-auth.md`
+```
+# Spec: 인증/인가 시스템
+
+> 관련 문서: [PRD 비기능 요구사항](./_product-overview.md#2-보안) · [Spec 아키텍처 개요](../0-overview.md) · [Spec 사용자 프로필](../2-navigation/9-user-profile.md) · [데이터 모델 - User](../1-data-model.md#21-user)
+
+---
+
+## 1. 인증 (Authentication)
+
+### 1.1 이메일/비밀번호 인증
+
+| 항목 | 설명 |
+|------|------|
+| 회원가입 | 이메일 + 비밀번호. 이메일 인증 필수 |
+| 비밀번호 정책 | 최소 8자, 대소문자 + 숫자 + 특수문자 중 3가지 이상 조합 |
+| 비밀번호 저장 | bcrypt (cost factor ≥ 12) |
+| 로그인 | 이메일 + 비밀번호 → JWT 발급 |
+| 비밀번호 분실 | 이메일로 재설정 링크 발송 (유효기간 30분) |
+| 로그인 실패 | 5회 실패 시 10분 잠금, 이메일 알림 |
+
+### 1.2 OAuth 소셜 로그인
+
+| 프로바이더 | 설명 |
+|-----------|------|
+| Google | Google OAuth 2.0 |
+| GitHub | GitHub OAuth Apps |
+
+- 소셜 로그인 시 기존 이메일 계정과 자동 연결 (이메일 일치 시)
+- 최초 소셜 로그인 시 자동 회원가입 + 개인 워크스페이스 생성
+
+### 1.3 셀프 호스팅 추가 인증
+
+| 방식 | 설명 |
+|------|------|
+| LDAP | LDAP/Active Directory 연동 (선택) |
+| SAML 2.0 | 기업 SSO 연동 (선택) |
+
+### 1.4 2FA (Two-Factor Authentication)
+
+| 항목 | 설명 |
+|------|------|
+| 방식 | TOTP (Time-based One-Time Password) |
+| 앱 호환 | Google Authenticator, Authy 등 |
+| 설정 플로우 | QR 코드 표시 → 인증 앱 스캔 → 6자리 코드 입력 확인 |
+| 백업 코드 | 10개 일회용 복구 코드 생성 및 다운로드 |
+| 비활성화 | 현재 코드 입력 후 비활성화 |
+
+### 1.5 초대 토큰 흐름
+
+팀 워크스페이스 Admin+ 가 **미가입자** 를 이메일로 초대하기 위한 토큰 기반 흐름. 가입 사용자 즉시 추가는 별도 API (`POST /api/workspaces/:id/members`) 를 사용한다 — 본 섹션은 미가입자 시나리오만 다룬다.
+
+#### 1.5.1 토큰 정책
+
+| 항목 | 값 | 비고 |
+|------|-----|------|
+| 토큰 생성 | `crypto.randomBytes(48)` → base64url (64자) | 추측 불가 |
+| 저장 형태 | DB 에는 토큰 자체를 저장 (`WorkspaceInvitation.token`, UNIQUE) | URL 조회 시 즉시 lookup |
+| 만료 | 발급 시점 + **7일** | 산업 표준. 만료 시 410 응답 |
+| 사용 횟수 | **1회** — accept 트랜잭션에서 `acceptedAt` 갱신 시 동시에 사용 처리 | 동시 accept 경쟁은 `UPDATE … WHERE accepted_at IS NULL RETURNING …` 로 직렬화 |
+| 재발송 | 기존 토큰 invalidate(만료 처리) + 신규 토큰 발급 + 만료 시계 재시작 | 한 초대 row 는 항상 0~1개의 유효 토큰만 보유 |
+| 동일 이메일 중복 초대 | 새 발송이 들어오면 기존 대기 중 토큰 invalidate 후 신규 발급 | 다중 토큰이 동시에 살아있지 않도록 |
+| **이메일 일치 강제** | accept·가입 시 `토큰.email == 로그인/가입 사용자 이메일` 강제. 불일치 시 400 | 토큰 누출 시 임의 사용자가 임의 워크스페이스에 진입하는 위협 차단 |
+| 발송 채널 | 시스템 SMTP (`backend/src/modules/mail/`) 만 사용. 워크스페이스 SMTP Integration 은 **사용하지 않음** | 운영 단순화. 자세한 근거는 [Rationale §1.5.B](#rationale) |
+| Rate Limit | 워크스페이스·invited_by 단위 분당 N회 (구현 시 결정) | 이메일 폭격 방지 |
+
+#### 1.5.2 흐름 (미가입자 가입 경로)
+
+```
+1. Admin+ 가 POST /api/v1/workspaces/:id/invitations { email, role }
+   → 토큰 생성, expiresAt = NOW() + 7d, 이메일 발송
+2. 수신자가 메일의 링크 클릭 → 프론트엔드 가입 페이지 `/auth/register?invitationToken={token}`
+3. 프론트엔드: GET /api/invitations/:token 로 메타 prefetch
+   → 응답: { workspaceName, invitedByName, email, expiresAt, role }
+   → 이메일 입력란을 prefill + readOnly 로 고정
+4. 사용자가 비밀번호·이름 입력 후 가입 제출
+   → POST /api/auth/register { name, password, invitationToken }
+   → 서버 검증:
+     a. 토큰 유효성 (존재·미만료·미사용)
+     b. 토큰의 email 과 가입 요청 본문에 동봉된 email (또는 토큰에서 유도) 일치
+     c. 일치 → User 생성 + WorkspaceMember 추가 + invitation.acceptedAt 갱신
+        세 작업은 단일 트랜잭션 내에서 처리 (실패 시 전체 롤백)
+     d. 불일치/만료 → 400 + 가입 자체 거부 (User row 생성 안 함)
+5. 가입 성공 → 자동 로그인 → 초대된 워크스페이스로 컨텍스트 진입
+   ※ 6.1 의 "개인 워크스페이스 자동 생성" 트리거는 **발화하지 않음**
+```
+
+#### 1.5.3 흐름 (이미 가입한 사용자가 다른 워크스페이스에 초대된 경우)
+
+```
+1. 메일 링크 클릭 → 프론트엔드가 토큰 메타 조회
+2. 로그인되어 있고 본인 이메일과 토큰 이메일이 일치 → 수락 페이지에 [수락] 버튼 노출
+3. POST /api/workspaces/invitations/accept { token }
+   → 서버 검증: 토큰 유효 + 본인 이메일 = 토큰 이메일
+   → WorkspaceMember 추가 + acceptedAt 갱신 (단일 트랜잭션)
+4. 응답 후 프론트엔드가 해당 워크스페이스로 컨텍스트 전환
+```
+
+토큰 이메일과 로그인 사용자의 이메일이 다르면 수락 페이지에서 "이 초대는 {토큰.email} 에게 발송되었습니다. 해당 계정으로 로그인하세요" 안내 + 로그아웃 버튼만 노출한다.
+
+#### 1.5.4 에러 응답
+
+| 상황 | HTTP | 코드 |
+|------|------|------|
+| 토큰 없음·잘못된 형식 | 404 | `invitation_not_found` |
+| 만료 | 410 | `invitation_expired` |
+| 이미 사용됨 | 410 | `invitation_already_used` |
+| 이메일 불일치 (accept 또는 register) | 400 | `invitation_email_mismatch` |
+| 권한 부족 (발송·재발송·취소) | 403 | `forbidden` |
+| Rate limit 초과 | 429 | `rate_limited` |
+
+---
+
+## 2. 세션 관리
+
+### 2.1 JWT 토큰 구조
+
+| 토큰 | 저장 위치 | 유효 기간 | 용도 |
+|------|-----------|-----------|------|
+| Access Token | 메모리 (JS 변수) | 15분 | API 요청 인증 |
+| Refresh Token | HttpOnly Cookie | 7일 | Access Token 갱신 |
+
+### 2.2 Access Token Payload
+
+```json
+{
+  "sub": "user-uuid",
+  "email": "user@example.com",
+  "workspaceId": "workspace-uuid",
+  "role": "editor",
+  "iat": 1711406400,
+  "exp": 1711407300
+}
+```
+
+### 2.3 세션 정책
+
+| 항목 | 설명 |
+|------|------|
+| 세션 단위 | `family_id` — refresh 회전 시 row가 갱신되더라도 동일 family는 하나의 "디바이스 세션" |
+| 동시 세션 | 기본 5개 (관리자 설정 가능) |
+| 초과 시 | 가장 오래된 세션 자동 종료 |
+| 비활동 만료 | 30일간 미사용 시 Refresh Token 무효화 |
+| 강제 종료 | 사용자가 활성 세션 목록에서 개별 종료 가능 (family 전체 revoke) |
+| 강제 종료 재인증 | 비밀번호 재확인 필수. OAuth-only 사용자는 2FA TOTP 또는 이메일 OTP 로 대체 |
+| 현재 세션 식별 | 서버가 요청의 refresh-token 쿠키 해시를 조회해 `isCurrent` 플래그로 응답 — raw token은 JS로 노출하지 않음 |
+| 메타데이터 | 발급 시점의 IP·User-Agent·디바이스 라벨 및 마지막 사용 시각을 RefreshToken 에 기록 |
+| 클라이언트 IP | Cloudflare 무료 플랜 호환: `CF-Connecting-IP` 헤더를 1순위, `X-Forwarded-For` 첫 IP, `req.ip` 순으로 추출 |
+
+### 2.4 토큰 갱신 플로우
+
+```
+1. Access Token 만료 감지 (API 401 응답)
+2. Refresh Token으로 /api/auth/refresh 호출
+3. 새 Access Token + 새 Refresh Token 발급 (Rotation)
+4. 이전 Refresh Token 즉시 무효화
+5. 무효화된 Refresh Token 사용 시도 → 모든 세션 종료 (탈취 의심)
+```
+
+---
+
+## 3. 인가 (Authorization)
+
+### 3.1 RBAC 역할
+
+| 역할 | 설명 |
+|------|------|
+| **Owner** | 워크스페이스 소유자. 모든 권한 + 워크스페이스 삭제 |
+| **Admin** | 관리자. 멤버 관리 + 설정 변경 + 모든 리소스 CRUD |
+| **Editor** | 편집자. 워크플로우/트리거/스케줄 CRUD + 실행 |
+| **Viewer** | 조회자. 읽기 전용 |
+
+### 3.2 리소스별 권한 매트릭스
+
+| 리소스 | Owner | Admin | Editor | Viewer |
+|--------|-------|-------|--------|--------|
+| Workspace 설정 | CRUD | RU | R | R |
+| Workspace 삭제 | D | — | — | — |
+| 멤버 관리 | CRUD | CRU | R | R |
+| Admin 역할 부여 | ✅ | — | — | — |
+| Workflow | CRUD | CRUD | CRUD | R |
+| Workflow 실행 | ✅ | ✅ | ✅ | — |
+| Trigger | CRUD | CRUD | CRUD | R |
+| Schedule | CRUD | CRUD | CRUD | R |
+| Integration (Org) | CRUD | CRUD | R | R |
+| Integration (Personal) | 자기 것 | 자기 것 | 자기 것 | 자기 것 |
+| Knowledge Base | CRUD | CRUD | CRUD | R |
+| Auth Config | CRUD | CRUD | R | R |
+| LLM Config | CRUD | CRUD | R | R |
+| Statistics | R | R | R | R |
+| Marketplace 설치 | ✅ | ✅ | ✅ | — |
+| Audit Log | R | R | — | — |
+
+### 3.3 API 인가 흐름
+
+```
+1. 요청 수신 → Access Token 검증
+2. Token에서 workspaceId, role 추출
+3. 요청 리소스가 해당 워크스페이스에 속하는지 확인
+4. 역할이 해당 액션에 대한 권한을 가지는지 확인
+5. 권한 없음 → 403 Forbidden
+```
+
+---
+
+## 4. 감사 로그 (Audit Log)
+
+### 4.1 기록 대상 액션
+
+| 카테고리 | 액션 |
+|----------|------|
+| 인증 (워크스페이스 컨텍스트) | password_change, 2fa_enable/disable |
+| 워크스페이스 | workspace.create, workspace.update, workspace.delete |
+| 멤버 | member.invite, member.role_change, member.remove |
+| 워크플로우 | workflow.create, workflow.update, workflow.delete, workflow.execute |
+| 트리거 | trigger.create, trigger.update, trigger.delete, trigger.toggle |
+| 스케줄 | schedule.create, schedule.update, schedule.delete |
+| Integration | integration.create, integration.update, integration.delete |
+| 설정 | auth_config.*, llm_config.* |
+
+> 워크스페이스 컨텍스트가 없는 인증 이벤트(login, logout, login_failed 등)는 AuditLog 가 아닌 §4.3 **LoginHistory** 에 기록된다.
+
+### 4.2 조회
+
+- 관리자(Admin+)만 조회 가능
+- 기간, 사용자, 액션 유형으로 필터링
+- 최근 90일 보관 (설정 가능)
+
+### 4.3 로그인 이력 (LoginHistory)
+
+사용자 단위 인증 이벤트는 별도 테이블 `login_history` 에 보관한다 (데이터 모델 §2.18.2). 사용자가 본인의 이력만 조회할 수 있다.
+
+| 이벤트 | 설명 |
+|--------|------|
+| login_success | 비밀번호 또는 OAuth 로그인 성공 |
+| login_failed | 비밀번호 불일치·계정 잠금·이메일 미인증 등 실패 |
+| totp_failed | 2FA 코드 검증 실패 |
+| logout | 사용자가 `/auth/logout` 호출 → 호출 디바이스 family 전체 revoke |
+| session_revoked | 사용자가 활성 세션 목록에서 다른 family 강제 종료 |
+| token_reuse_detected | revoke된 refresh token 재사용 감지 → family 전체 revoke |
+
+보존: **180일** 경과 row 는 일일 배치(`@Cron('0 3 * * *')`)로 자동 삭제. 조회는 사용자 본인만 가능하며 워크스페이스 관리자에게는 노출되지 않는다.
+
+---
+
+## 5. API 엔드포인트
+
+| 메서드 | 경로 | 설명 |
+|--------|------|------|
+| POST | /api/auth/register | 회원가입 |
+| POST | /api/auth/login | 로그인 |
+| POST | /api/auth/logout | 로그아웃 (호출 디바이스 family 전체 revoke) |
+| POST | /api/auth/refresh | 토큰 갱신 |
+| POST | /api/auth/forgot-password | 비밀번호 재설정 요청 |
+| POST | /api/auth/reset-password | 비밀번호 재설정 |
+| GET | /api/auth/oauth/:provider | OAuth 시작 |
+| GET | /api/auth/oauth/:provider/callback | OAuth 콜백 |
+| GET | /api/audit-logs | 감사 로그 조회 (Admin+) |
+| GET | /api/invitations/:token | 초대 토큰 메타 조회 (인증 불요, 가입 페이지 prefill). 만료·invalidated 토큰은 410 |
+
+사용자 본인 세션·이력 관리 엔드포인트는 [사용자 프로필 spec §6.1](../2-navigation/9-user-profile.md#61-사용자워크스페이스-api) 에 정의 (`/api/users/me/sessions`, `/api/users/me/login-history`).
+
+초대 발송·재발송·취소·수락 엔드포인트는 [사용자 프로필 spec §6.1](../2-navigation/9-user-profile.md#61-사용자워크스페이스-api) 에 정의 (`/api/workspaces/:id/invitations`, `/api/workspaces/invitations/accept`).
+
+`POST /api/auth/register` 는 본문에 `invitationToken?` 을 받아 [§1.5.2 흐름](#152-흐름-미가입자-가입-경로) 의 트랜잭션을 수행한다.
+
+---
+
+## Rationale
+
+### 1.5.A — 가입 시 이메일 일치 강제
+
+토큰 이메일 ≠ 가입/로그인 사용자 이메일인 경우의 처리로 세 옵션을 검토했다:
+
+- **이메일 일치 강제 (선택)** — 다르면 가입·accept 모두 차단.
+- 토큰만 무효화, 가입은 허용 — 가입은 끝나지만 워크스페이스 멤버는 안 됨. UX 가 모호.
+- 검증 없이 자동 accept — 토큰 누출 시 임의 워크스페이스 진입 가능.
+
+이메일 일치 강제를 채택한 이유:
+
+- 토큰은 (긴 random 이지만) URL·메일 경유로 유출 가능. 일치 검증이 없으면 누출 토큰 단독으로 워크스페이스 진입이 가능해 권한 escalate 위협이 큼.
+- 가입 페이지에서 이메일을 prefill + readOnly 로 고정하면 정상 사용자에게는 UX 마찰이 거의 없음 (이메일을 "고를" 필요가 사라짐).
+- 다른 이메일로 가입하고 싶은 경우는 일반 회원가입 경로(`/auth/register`, `invitationToken` 없음) 를 따로 거치게 되므로 안내가 단순함.
+
+### 1.5.B — 초대 메일 SMTP: 시스템 전역 사용
+
+`backend/src/modules/mail/` 는 현재 시스템 전역 SMTP 만 지원한다. 워크스페이스 단위 SMTP Integration 을 초대 메일에도 사용할지 검토했지만, 다음 이유로 시스템 SMTP 만 사용한다:
+
+- 초대는 "워크스페이스에 진입하기 전" 단계의 시스템 인입 행위에 가깝다. 워크스페이스의 비즈니스 SMTP 가 끊겨도 초대 흐름은 계속 동작해야 함.
+- 워크스페이스 SMTP Integration 은 워크스페이스 내부 워크플로의 알림·메일 발송 용도로 설계되었으며, 초대 같은 시스템 메시지를 그쪽으로 흘리면 책임 경계가 흐려진다.
+- 운영·디버깅이 단일 채널로 단순해진다 — 초대 메일 누락 원인을 추적할 때 시스템 SMTP 로그만 보면 됨.
+
+### 1.5.C — 토큰 만료 7일
+
+7일은 산업 표준이면서, "주말 끼고 가입" 같은 사용자 행동도 충분히 흡수한다. 더 짧으면 (예: 24~48시간) 재발송이 잦아져 운영 부담이 늘고, 더 길면 (14일+) 토큰 누출 시 노출 기간이 길어진다. 재발송 시 만료 시계는 새 토큰 발급 시점부터 다시 7일이므로, 특수 케이스는 재발송으로 해결한다.
+
+```
+
+#### `spec/5-system/10-graph-rag.md`
+```
+# Spec: Graph RAG
+
+> 관련 문서: [PRD Graph RAG](./10-graph-rag.md) · [Spec RAG 검색](./9-rag-search.md) · [Spec 임베딩 파이프라인](./8-embedding-pipeline.md) · [Spec Knowledge Base 화면](../2-navigation/5-knowledge-base.md) · [Spec 데이터 모델 - KnowledgeBase / Entity / Relation](../1-data-model.md#211-knowledgebase) · [Spec AI Agent](../4-nodes/3-ai/1-ai-agent.md)
+
+---
+
+## Overview (제품 정의)
+
+> 출처: `prd/9-graph-rag.md` — docs-consolidation(2026-05-12)으로 본 문서에 흡수.
+
+> **구현 상태**: ✅ **P0~P2 구현 완료** (검증 일자: 2026-05-11). KB 모드 선택, 추출 파이프라인 (`graph-extraction` 큐 chained dispatch), Hybrid 검색 (`RagSearchService` graph 분기), Entity / Relation CRUD, 3D 그래프 시각화 (`graph-3d-renderer.tsx`) 까지 동작. 마이그레이션 `V025__graph_rag.sql` ~ `V027__relation_head_tail_index.sql` 적용. 본 문서 범위 밖 (§2.2) 의 community detection / Neo4j 등 P2 이후 항목만 미구현으로 남는다.
+
+---
+
+### 1. 목표
+
+기존 vector RAG 가 단순 유사도 매칭이라 multi-hop 추론(예: "A가 만든 제품을 사용한 고객")이나 entity 중심 질의에 약하다. **문서에서 entity/relation 을 추출해 지식 그래프를 구성하고, 검색 시 vector seed → 그래프 확장 → rerank 흐름으로 답변 품질을 높이는 Graph RAG 옵션**을 제공한다.
+
+| 구분 | 목표 |
+|------|------|
+| **사용자 가치** | entity 중심 질의·다단계 추론 시 답변 정확도 향상. KB 별로 vector / graph 모드 선택해 비용/품질 trade-off 직접 제어 |
+| **기술 목표** | 기존 vector RAG 는 그대로 유지하면서 graph 모드를 추가. PostgreSQL 인프라 안에서 신규 의존성 없이 동작 (entity / relation / chunk_entity 관계형 테이블) |
+| **제품 차별화** | LLM 기반 자동 추출 + 사용자 보정 가능한 그래프 뷰로, 지식 그래프 구축 비용을 코딩 없이 흡수 |
+
+---
+
+### 2. 범위
+
+#### 2.1 본 문서 범위
+
+| 영역 | 상태 | 기능 |
+|------|------|------|
+| KB 모드 선택 | ✅ | KB 생성 시 `vector` / `graph` 모드 선택 (불변). `kb-form-body.tsx` 셀렉트 + `V025__graph_rag.sql` 의 `rag_mode` 컬럼 + `chk_kb_rag_mode` CHECK |
+| 그래프 추출 파이프라인 | ✅ | 문서 임베딩 완료 시 `document-embedding.processor` 가 `graph-extraction` 큐로 chained dispatch → `GraphExtractionService` 가 chunk 단위 LLM 추출 → entity / relation / chunk_entity UPSERT |
+| 추출 LLM 설정 | ✅ | KB 단위 `extractionLlmConfigId` (V025 컬럼 + `kb-form-body.tsx` 셀렉트, 미지정 시 워크스페이스 default 사용) |
+| Hybrid 검색 흐름 | ✅ | `RagSearchService` 가 KB `rag_mode === 'graph'` 면 분기 — vector seed → 1~2 hop recursive CTE traversal → expanded chunk 회수 → rerank |
+| 추출 상태 / 통계 UI (P0) | ✅ | KB 상세에 진행률 + entity / relation 카운트 카드 (캐시 컬럼 `entity_count` / `relation_count`). 통계 갱신은 `document:graph_completed` payload 의 `entityCount` / `relationCount` 또는 REST `GET /:id/graph/stats` 폴링으로 조회 |
+| Entity 목록 보정 UI (P1) | ✅ | `entity-list.tsx` / `relation-list.tsx` — 검색·정렬 + 개별 삭제 (`Delete /entities/:id`, `Delete /relations/:id`) |
+| 그래프 시각화 (P2) | ✅ | `graph-3d-renderer.tsx` + `graph-visualization.tsx` — 3D / 2D 렌더링, 줌, 호버 시 chunk 미리보기 |
+
+#### 2.2 본 문서 범위 밖
+
+| 항목 | 사유 |
+|------|------|
+| Microsoft GraphRAG community detection / 글로벌 요약 | 빌드 비용·복잡도가 커서 P2 이후 |
+| Apache AGE / Neo4j 도입 | 데이터 규모 임계 도달 시 검토. 현재는 PostgreSQL 관계형 + recursive CTE 로 충분 |
+| 룰 기반 entity 추출 (spaCy 등) | LLM 추출 단일 경로로 시작. 도메인 적응 비용 회피 |
+| KB 모드 사후 변경 (vector ↔ graph) | 마이그레이션 비용 큼. 모드 전환은 새 KB 생성으로 대체 |
+
+---
+
+### 3. 요구사항
+
+#### 3.1 KB 모드 (`KB-GR-MD-*`)
+
+| ID | 요구사항 | 우선순위 | 상태 |
+|----|----------|----------|------|
+| KB-GR-MD-01 | KB 생성 시 검색 모드를 `vector` / `graph` 중에서 선택 (기본값: `vector`) | 필수 | ✅ |
+| KB-GR-MD-02 | 모드는 생성 시점에만 결정. 사후 변경은 차단되며 변경이 필요하면 새 KB 를 만든다 | 필수 | ✅ |
+| KB-GR-MD-03 | 모드 정보는 KB 목록·상세 화면에 배지로 표시 | 필수 | ✅ |
+
+#### 3.2 그래프 추출 파이프라인 (`KB-GR-EX-*`)
+
+| ID | 요구사항 | 우선순위 | 상태 |
+|----|----------|----------|------|
+| KB-GR-EX-01 | `graph` 모드 KB 의 문서가 임베딩 완료(`embedding_status = 'completed'`)되면 자동으로 그래프 추출 큐(`graph-extraction`)에 dispatch | 필수 | ✅ |
+| KB-GR-EX-02 | 추출 LLM 모델은 KB 의 `extractionLlmConfigId` 가 가리키는 LLMConfig 의 chat 모델을 사용 (미지정 시 워크스페이스 default LLMConfig) | 필수 | ✅ |
+| KB-GR-EX-03 | 추출 단위: chunk 1개 → entity 목록 + relation 목록. 추출 결과는 KB 범위에서 dedup (이름·타입 정규화) | 필수 | ✅ |
+| KB-GR-EX-04 | 추출 진행 상태는 문서별로 추적 (`graph_extraction_status`: pending / processing / completed / error / failed) | 필수 | ✅ |
+| KB-GR-EX-05 | 추출 실패 시 문서 단위 재시도 가능 (KB 상세에서 "Re-extract" 액션) | 필수 | ✅ (`POST /knowledge-bases/:id/documents/:docId/re-extract`) |
+| KB-GR-EX-06 | 임베딩 재실행(`reEmbed`) 또는 KB 전체 재임베딩 시 그래프도 함께 재추출 | 필수 | ✅ |
+| KB-GR-EX-07 | 추출 비용을 사용자에게 표시 — 이번 추출에 사용된 토큰 수와 KB 누적 토큰 수 | 권장 | ✅ (`LlmService.chat` 가 자동으로 `LlmUsageLog` 기록 + KB 상세 토큰 통계) |
+| KB-GR-EX-08 | LLM 호출 timeout (청크 90s) + 일시 오류 자동 재시도 (1s/4s/16s 백오프, 최대 3회). 비재시도성 오류는 즉시 `failed` 전환. UI 영구 "처리중" stuck 방지 | 필수 | ✅ (V037 + `retryWithBackoff`) |
+| KB-GR-EX-09 | 최종 실패한 문서를 한 번에 재큐잉 (`POST /knowledge-bases/:id/retry-failed` `{ scope: 'graph'/'embedding'/'all' }`). 재시도 카운터·error 메시지 리셋 후 큐 add | 필수 | ✅ |
+| KB-GR-EX-10 | 부팅 시 `graph_last_attempted_at` 가 10분 전 이전인 `processing` 문서 자동 회수 (`StuckDocumentRecoveryService`) | 필수 | ✅ |
+| KB-GR-EX-11 | 진행 박스에 실패 카운트 + 재시도 버튼 표시. WS 이벤트 (`document:graph_retry`·`graph_failed`) 로 실시간 반영 | 필수 | ✅ |
+
+#### 3.3 데이터 모델 (`KB-GR-DM-*`)
+
+| ID | 요구사항 | 우선순위 | 상태 |
+|----|----------|----------|------|
+| KB-GR-DM-01 | KB 단위로 entity 를 저장. 동일 KB 안에서 `(name, type)` 으로 dedup | 필수 | ✅ (V025 `uq_entity_kb_name_type`) |
+| KB-GR-DM-02 | KB 단위로 relation 을 저장. (`head_entity_id`, `predicate`, `tail_entity_id`) 복합 unique | 필수 | ✅ (V025 `uq_relation_kb_head_pred_tail` + V027 인덱스) |
+| KB-GR-DM-03 | chunk → entity 매핑(`chunk_entity`)으로 검색 시 chunk 회수 가능 | 필수 | ✅ (V025 `chunk_entity` 테이블) |
+| KB-GR-DM-04 | entity 메타에 등장 횟수(`mention_count`) 와 마지막 등장 청크(`last_seen_chunk_id`) 보관 | 권장 | ✅ |
+
+#### 3.4 검색 흐름 (`KB-GR-SR-*`)
+
+| ID | 요구사항 | 우선순위 | 상태 |
+|----|----------|----------|------|
+| KB-GR-SR-01 | KB.rag_mode 가 `graph` 면 RagSearchService 가 graph 검색 흐름으로 분기 | 필수 | ✅ |
+| KB-GR-SR-02 | 검색 1단계: query 임베딩 → KB 의 chunk 에서 vector top-K (`vectorSeedTopK`, 기본 5) 회수 | 필수 | ✅ |
+| KB-GR-SR-03 | 검색 2단계: 회수된 chunk 가 언급한 entity 들에서 1~`maxHops` (기본 1) 까지 그래프 확장 | 필수 | ✅ (recursive CTE) |
+| KB-GR-SR-04 | 검색 3단계: 확장된 entity 들이 등장한 chunk 를 추가 회수 (총 chunk 수는 `expandedChunkLimit`, 기본 15 내) | 필수 | ✅ |
+| KB-GR-SR-05 | 검색 4단계: vector seed + expanded chunk 를 score 재정렬해 상위 `topK` 반환 (graph expansion 청크는 entity centrality 기반 가중치 부여) | 필수 | ✅ |
+| KB-GR-SR-06 | 검색 결과 메타데이터에 `traversedEntities`, `traversalDepth`, `seedChunkIds` 포함 | 권장 | ✅ (`GraphTraversalSummary` — `maxDepthUsed` 포함) |
+
+#### 3.5 KB 검색 파라미터 (`KB-GR-PA-*`)
+
+| ID | 요구사항 | 우선순위 | 상태 |
+|----|----------|----------|------|
+| KB-GR-PA-01 | KB 설정에 `maxHops` (1 또는 2, 기본 1), `vectorSeedTopK` (기본 5), `expandedChunkLimit` (기본 15) 노출 | 필수 | ✅ (V025 컬럼 + KB 상세 페이지 편집 폼) |
+| KB-GR-PA-02 | 파라미터 변경 시 추출/임베딩 재실행은 불필요 (검색 시점 적용) | 필수 | ✅ |
+| KB-GR-PA-03 | AI Agent 노드의 KB 연동 UI 는 그대로 유지 (`ragTopK`, `ragThreshold`만 노출). 그래프 파라미터는 KB 단위에서만 제어 | 필수 | ✅ (`ai-agent.schema.ts` 에 `maxHops` / `vectorSeedTopK` / `expandedChunkLimit` 미노출 확인) |
+
+#### 3.6 UI (`KB-GR-UI-*`)
+
+| ID | 요구사항 | 우선순위 | 상태 |
+|----|----------|----------|------|
+| KB-GR-UI-01 (P0) | KB 생성 폼에 모드 셀렉트 (`vector` / `graph`) + 모드별 도움말 | 필수 | ✅ |
+| KB-GR-UI-02 (P0) | KB 상세 화면에 추출 진행률 배너 (`processing N/M`, `error K`) | 필수 | ✅ |
+| KB-GR-UI-03 (P0) | KB 상세에 entity 수 / relation 수 통계 카드 | 필수 | ✅ |
+| KB-GR-UI-04 (P1) | Entity 목록 화면 — 이름·타입·등장 횟수 컬럼, 검색·정렬, 개별 삭제 | 권장 | ✅ (`entity-list.tsx`) |
+| KB-GR-UI-05 (P1) | Relation 목록 화면 — head·predicate·tail, 등장 chunk 미리보기, 개별 삭제 | 권장 | ✅ (`relation-list.tsx`) |
+| KB-GR-UI-06 (P1) | 문서 상세에서 해당 문서 chunk 가 언급한 entity 목록 표시 | 권장 | ✅ (`entity-detail-dialog.tsx`) |
+| KB-GR-UI-07 (P2) | 그래프 시각화 (react-flow 또는 동등) — 노드/엣지 렌더, 줌, 호버 시 chunk 미리보기 | 선택 | ✅ (`graph-3d-renderer.tsx` + `graph-visualization.tsx` — react-flow 대신 3D / 2D 렌더러 채택) |
+
+#### 3.7 비용·관측성 (`KB-GR-OB-*`)
+
+| ID | 요구사항 | 우선순위 | 상태 |
+|----|----------|----------|------|
+| KB-GR-OB-01 | 추출에 사용된 LLM 토큰을 LLMUsageLog 에 기록 (기존 사용량 추적과 동일 채널) | 필수 | ✅ (`LlmService.chat` 호출 boundary 에서 자동 기록) |
+| KB-GR-OB-02 | 추출 진행 / 완료 / 에러 이벤트를 WebSocket 으로 노출 (KB 상세 실시간 갱신) | 필수 | ✅ (`document:graph_started` / `_progress` / `_completed` / `_error` / `_retry` / `_failed`) |
+| KB-GR-OB-03 | KB 단위 entity / relation 카운트는 캐시 컬럼으로 유지 (조회 시 매번 SELECT COUNT 회피) | 권장 | ✅ (V025 `entity_count` / `relation_count` 컬럼) |
+
+---
+
+### 4. 기술 결정 사항
+
+| 항목 | 결정 | 근거 |
+|------|------|------|
+| 그래프 저장소 | **PostgreSQL 관계형 테이블** (`entity`, `relation`, `chunk_entity`) | 기존 인프라 그대로. 1~2 hop traversal 은 recursive CTE 로 충분 |
+| 그래프 빌딩 | **LLM 추출 (BullMQ `graph-extraction` 큐)** | 기존 `document-embedding` 큐 패턴과 동일. 인프라 추가 0 |
+| 추출 트리거 | **임베딩 완료 후 자동 chained** | 사용자 개입 없이 그래프가 자동 구축됨. 비용은 사후 통계로 표시 |
+| 추출 LLM | **KB 단위 `extractionLlmConfigId` 신설** | 임베딩 모델과 분리해 reasoning 용 chat 모델을 따로 선택 |
+| 검색 흐름 | **Hybrid (vector seed + graph expansion + rerank)** | 순수 graph traversal 은 정밀도 낮음. vector seed 가 진입점을 보장 |
+| KB 모드 선택 | **생성 시 결정, 불변** | 사후 변경의 마이그레이션·UX 부담이 점진 도입의 가치를 넘어섬 |
+| 검색 파라미터 노출 | **KB 단위에만** | AI Agent 노드 설정의 단순성 유지 (`ragTopK`/`ragThreshold` 만) |
+
+---
+
+### 5. 비기능 요구사항
+
+| ID | 요구사항 | 기준 |
+|----|----------|------|
+| NF-GR-01 | 그래프 추출 처리 속도 | 평균 30 chunk / 분 (LLM API 의존) |
+| NF-GR-02 | 그래프 검색 응답 시간 | < 800ms (10만 entity·relation 기준, vector seed 포함) |
+| NF-GR-03 | 추출 실패 graceful degrade | 추출 실패 chunk 는 그래프 검색 시 vector-only fallback 으로 회수 |
+| NF-GR-04 | KB 당 entity 수 한계 | 100,000개 (P0). 초과 시 cleanup / community detection 필요 |
+| NF-GR-05 | 토큰 사용 가시성 | 추출 토큰을 LLMUsageLog 에 기록, KB 상세에서 누적 표시 |
+
+---
+
+### 6. 단계별 도입 (Phase Plan)
+
+| Phase | 범위 | 상태 | 검증 기준 |
+|-------|------|------|-----------|
+| **P0** | DB 마이그레이션 + 추출 큐 + 검색 분기 + 모드 선택 UI + 추출 진행 상태 | ✅ | 새 graph KB 생성 → 문서 업로드 → 자동 추출 → graph 검색 동작 |
+| **P1** | Entity/Relation 목록 UI + 개별 삭제 + 사용자 보정 | ✅ | 추출 결과 검토/정정 후 검색 결과에 반영됨 |
+| **P2** | 그래프 시각화 (3D/2D) | ✅ | 시각적 탐색 가능 |
+| **P2+ (후속)** | community detection / 글로벌 요약 / 도메인별 entity 타입 사전 / KB 단위 prompt override | ❌ | §8 미결 항목 — 별도 PRD 로 검토 |
+
+---
+
+### 7. 의존성
+
+| 의존 항목 | 현재 상태 | 비고 |
+|----------|----------|------|
+| BullMQ `document-embedding` 큐 | ✅ | `graph-extraction` 큐 추가 완료 (동일 패턴) |
+| LLMConfig | ✅ | `V025` 에서 `extractionLlmConfigId` 컬럼 추가 완료 |
+| pgvector | ✅ | vector seed 그대로 사용 |
+| KB 모드 선택 UI | ✅ | `kb-form-body.tsx` 셀렉트 도입 완료 |
+| AI Agent 의 KB 연동 | ✅ | 변경 없음 (`ragTopK`/`ragThreshold` 그대로) |
+
+---
+
+### 8. 미결 / 후속 검토
+
+- entity 타입 사전: 도메인 비종속 (PERSON / ORG / CONCEPT / LOCATION / EVENT) 으로 시작. 사용자가 KB 별 entity 타입 사전을 정의할 수 있게 할지는 P2 검토.
+- relation predicate 형식: P0 는 free-form 문자열. 정합성/검색 품질을 위해 enum 화는 P2 검토.
+- 추출 prompt 의 사용자 커스터마이즈: P0 는 시스템 prompt 고정. 도메인 정확도가 부족하면 P2 에 KB 단위 prompt override 도입.
+- 그래프 community detection: 구현 후 데이터 패턴을 보고 GraphRAG 스타일 클러스터 요약을 P2 에 검토.
+
+---
+
+## 1. 개요
+
+Graph RAG 는 KB 의 검색 모드(`rag_mode`) 가 `graph` 일 때 활성화되는 검색 흐름이다. vector seed → graph expansion → rerank 의 Hybrid 형태로 동작하며, 기존 `vector` 모드 KB 와 동일 인프라(PostgreSQL + pgvector + BullMQ) 위에서 추가 의존성 없이 작동한다.
+
+```
+문서 업로드
+  ↓
+Document 레코드 생성 (status: pending)
+  ↓
+embedding 큐 (document-embedding) → EmbeddingService.processDocument
+  ↓
+embedding_status = 'completed'
+  ↓
+[graph KB 일 때만] graph-extraction 큐로 chained dispatch
+  ↓
+GraphExtractionService.extractDocument
+  ↓
+chunk 마다 LLM 호출 → entity / relation 추출 + dedup → DB INSERT
+  ↓
+graph_extraction_status = 'completed'
+  ↓
+WebSocket 알림 (KB 상세 실시간 갱신)
+```
+
+---
+
+## 2. 데이터 모델
+
+### 2.1 KnowledgeBase 추가 컬럼
+
+[Spec 데이터 모델 §2.11](../1-data-model.md#211-knowledgebase) 의 KnowledgeBase 에 다음 컬럼이 추가된다.
+
+| 필드 | 타입 | 설명 |
+|------|------|------|
+| `rag_mode` | Enum | `vector` (default) / `graph`. **생성 시에만 결정, 사후 변경 불가** |
+| `extraction_llm_config_id` | UUID? | 그래프 추출에 사용할 LLMConfig 의 chat 모델. NULL 이면 워크스페이스 default LLMConfig |
+| `max_hops` | Integer | 검색 시 그래프 확장 깊이 (1 또는 2, default 1). `vector` 모드에서는 무시 |
+| `vector_seed_top_k` | Integer | 검색 시 vector seed 개수 (default 5). `vector` 모드에서는 무시 |
+| `expanded_chunk_limit` | Integer | graph expansion 후 회수할 청크 상한 (default 15). `vector` 모드에서는 무시 |
+| `entity_count` | Integer | KB 의 entity 총 수 (캐시) |
+| `relation_count` | Integer | KB 의 relation 총 수 (캐시) |
+
+> `rag_mode = 'vector'` 인 KB 는 graph 관련 컬럼/테이블을 사용하지 않는다. AI Agent 의 RAG 호출도 `vector` 흐름 그대로.
+
+### 2.2 Document 추가 컬럼
+
+[Spec 데이터 모델 §2.12](../1-data-model.md#212-document) 의 Document 에 다음 컬럼이 추가된다.
+
+| 필드 | 타입 | 설명 |
+|------|------|------|
+| `graph_extraction_status` | Enum | pending / processing / completed / error. `vector` 모드 KB 에서는 항상 `pending` 으로 두고 사용하지 않음 |
+
+### 2.3 Entity (신규)
+
+| 필드 | 타입 | 설명 |
+|------|------|------|
+| `id` | UUID | PK |
+| `knowledge_base_id` | UUID | FK → KnowledgeBase (CASCADE) |
+| `name` | String | 정규화된 entity 이름 (소문자·trim) |
+| `display_name` | String | 사용자 표시용 원형 |
+| `type` | String | entity 타입. P0 enum: `person` / `organization` / `concept` / `location` / `event` / `other` |
+| `description` | Text? | LLM 이 추출한 짧은 설명 (옵션) |
+| `mention_count` | Integer | KB 내 청크에서 언급된 횟수 (캐시) |
+| `last_seen_chunk_id` | UUID? | 마지막으로 등장한 청크 (FK → DocumentChunk) |
+| `created_at` | Timestamp | 첫 추출 시각 |
+| `updated_at` | Timestamp | 마지막 갱신 시각 |
+
+**제약조건**: `UNIQUE(knowledge_base_id, name, type)` — KB 안에서 동일 이름·타입 entity 는 한 row 로 통합
+
+**인덱스**:
+- `(knowledge_base_id, type)` — 타입별 조회
+- `(knowledge_base_id, mention_count DESC)` — centrality 정렬
+
+### 2.4 Relation (신규)
+
+| 필드 | 타입 | 설명 |
+|------|------|------|
+| `id` | UUID | PK |
+| `knowledge_base_id` | UUID | FK → KnowledgeBase (CASCADE) |
+| `head_entity_id` | UUID | FK → Entity |
+| `tail_entity_id` | UUID | FK → Entity |
+| `predicate` | String | 관계 서술어 (예: "founded", "employs", "is_part_of"). P0 free-form |
+| `evidence_chunk_id` | UUID? | 추출 근거 청크 (FK → DocumentChunk) |
+| `weight` | Integer | 동일 (head, predicate, tail) 가 여러 chunk 에서 발견되었을 때의 누적 횟수 |
+| `created_at` | Timestamp | 첫 추출 시각 |
+| `updated_at` | Timestamp | 마지막 갱신 시각 |
+
+**제약조건**: `UNIQUE(knowledge_base_id, head_entity_id, predicate, tail_entity_id)`
+
+**인덱스**:
+- `(knowledge_base_id, head_entity_id)` — head 기준 1-hop 확장
+- `(knowledge_base_id, tail_entity_id)` — tail 기준 역방향 확장
+
+### 2.5 ChunkEntity (신규)
+
+| 필드 | 타입 | 설명 |
+|------|------|------|
+| `chunk_id` | UUID | PK 일부, FK → DocumentChunk (CASCADE) |
+| `entity_id` | UUID | PK 일부, FK → Entity (CASCADE) |
+| `mention_text` | String? | 청크에서 등장한 원형 표기 (정규화 전) |
+
+**제약조건**: `PRIMARY KEY (chunk_id, entity_id)`
+
+**인덱스**:
+- `(entity_id)` — entity → chunk 역방향 회수 (검색 expansion 단계에서 사용)
+
+---
+
+## 3. 그래프 추출 파이프라인
+
+### 3.1 큐 라우팅
+
+`document-embedding` 큐의 worker 가 임베딩을 마치고 `embedding_status = 'completed'` 로 갱신한 직후, KB 의 `rag_mode` 가 `graph` 면 `graph-extraction` 큐로 다음 job 을 add 한다.
+
+```
+document-embedding job (completed)
+  └→ if (kb.rag_mode === 'graph') queue('graph-extraction').add({ documentId, knowledgeBaseId })
+```
+
+### 3.2 GraphExtractionProcessor
+
+`@Processor('graph-extraction', { concurrency: 2 })` (LLM 호출 비용·rate limit 고려해 임베딩보다 낮은 동시성).
+
+1. `Document.graph_extraction_status = 'processing'` 갱신, WebSocket `document:graph_started` 발사
+2. 해당 document 의 모든 chunk 를 순회 (재시도 시 기존 entity/relation 은 KB 단위 dedup 으로 자연 통합)
+3. chunk 마다 LLM 호출 (`extraction_llm_config_id` 또는 default LLMConfig 의 chat 모델):
+   - 시스템 prompt: entity 타입 / relation 형식 / JSON schema 강제
+   - user 메시지: chunk content (max 2000 token)
+   - 응답: `{ entities: [{ name, displayName, type, description? }], relations: [{ head, predicate, tail }] }`
+4. 결과를 KB 단위로 dedup INSERT/UPSERT (Entity 는 `(name, type)` 충돌 시 `mention_count += 1`, Relation 은 `(head, predicate, tail)` 충돌 시 `weight += 1`)
+5. ChunkEntity 매핑 INSERT (chunk_id × entity_id)
+6. 진행률 WebSocket emit (`document:graph_progress`, 0~100)
+7. 모든 chunk 종료 시 `Document.graph_extraction_status = 'completed'` + WebSocket `document:graph_completed`
+
+### 3.3 추출 LLM 응답 스키마
+
+LLM 호출 시 JSON Schema 강제:
+
+```json
+{
+  "type": "object",
+  "properties": {
+    "entities": {
+      "type": "array",
+      "items": {
+        "type": "object",
+        "properties": {
+          "name": { "type": "string", "description": "정규화된 이름 (소문자·trim·동의어 통합)" },
+          "displayName": { "type": "string", "description": "원문에서 등장한 자연 표기" },
+          "type": {
+            "type": "string",
+            "enum": ["person", "organization", "concept", "location", "event", "other"]
+          },
+          "description": { "type": "string" }
+        },
+        "required": ["name", "displayName", "type"]
+      }
+    },
+    "relations": {
+      "type": "array",
+      "items": {
+        "type": "object",
+        "properties": {
+          "head": { "type": "string", "description": "head entity 의 name (정규화 형)" },
+          "predicate": { "type": "string", "description": "동사·관계 서술어. snake_case 권장" },
+          "tail": { "type": "string", "description": "tail entity 의 name (정규화 형)" }
+        },
+        "required": ["head", "predicate", "tail"]
+      }
+    }
+  },
+  "required": ["entities", "relations"]
+}
+```
+
+응답 검증:
+- `relation.head` / `relation.tail` 은 동일 응답 내 `entities[*].name` 에 존재해야 한다 (LLM 환각 방지). 매칭 실패 relation 은 drop 후 warn.
+- entity 가 0개로 추출된 chunk 는 그래프에 영향 없음 (skip).
+
+### 3.4 재추출
+
+- 문서 단건: `POST /api/knowledge-bases/:kbId/documents/:docId/re-extract`
+- KB 전체: `POST /api/knowledge-bases/:kbId/re-extract` — KB 의 모든 entity/relation/chunk_entity 를 삭제 후 모든 문서에 대해 큐잉
+- 임베딩 재실행 (`re-embed`) 은 그래프 추출도 자동 chained (KB 가 graph 모드인 경우)
+
+---
+
+## 4. 검색 흐름 (Hybrid)
+
+KB.rag_mode 별로 `RagSearchService.search()` 가 분기한다. `vector` 모드는 [Spec 9-rag-search.md](./9-rag-search.md) 그대로.
+
+### 4.1 graph 모드 단계
+
+```
+[1] query 임베딩 (KB.embedding_model)
+    ↓
+[2] vector seed: vectorSeedTopK 만큼 chunk 회수 (기존 vector 검색 동일)
+    ↓
+[3] seed chunk 가 언급한 entity 집합 수집 (chunk_entity JOIN)
+    ↓
+[4] graph expansion: 1~maxHops 깊이까지 head/tail 양방향 traversal
+    ↓
+[5] expanded entity 들이 등장한 chunk 추가 회수 (chunk_entity 역방향)
+    ↓
+[6] 합쳐진 chunk 집합을 score 재정렬:
+       - vector seed: 원래 cosine similarity score
+       - expanded chunk: cosine similarity × centrality_weight
+       - centrality_weight = log(entity.mention_count + 1) / log(MAX_MENTION + 1)
+    ↓
+[7] 상위 ragTopK 만 컨텍스트에 주입
+```
+
+### 4.2 SQL 흐름 (recursive CTE)
+
+```sql
+-- 1. vector seed
+WITH seed AS (
+  SELECT dc.id AS chunk_id, dc.content, dc.metadata,
+         d.id AS document_id, d.name AS document_name,
+         1 - (dc.embedding::vector(1536) <=> $1) AS score
+    FROM document_chunk dc
+    JOIN document d ON d.id = dc.document_id
+   WHERE d.knowledge_base_id = $2
+     AND d.embedding_status = 'completed'
+   ORDER BY score DESC
+   LIMIT $3        -- vectorSeedTopK
+),
+-- 2. seed entity 들
+seed_entities AS (
+  SELECT DISTINCT ce.entity_id
+    FROM chunk_entity ce
+    JOIN seed s ON s.chunk_id = ce.chunk_id
+),
+-- 3. graph expansion (recursive)
+expanded_entities AS (
+  SELECT entity_id, 0 AS depth FROM seed_entities
+  UNION
+  SELECT CASE WHEN r.head_entity_id = e.entity_id THEN r.tail_entity_id ELSE r.head_entity_id END,
+         e.depth + 1
+    FROM expanded_entities e
+    JOIN relation r ON (r.head_entity_id = e.entity_id OR r.tail_entity_id = e.entity_id)
+   WHERE e.depth < $4   -- maxHops
+),
+-- 4. expanded chunk
+expanded_chunks AS (
+  SELECT DISTINCT ce.chunk_id
+    FROM chunk_entity ce
+    JOIN expanded_entities e ON e.entity_id = ce.entity_id
+)
+-- 5. final select with rerank
+SELECT chunk_id, content, score FROM (
+  SELECT s.chunk_id, s.content, s.document_name, s.metadata, s.score, 'seed' AS origin
+    FROM seed s
+  UNION ALL
+  SELECT ec.chunk_id, dc.content, d.name, dc.metadata,
+         (1 - (dc.embedding::vector(1536) <=> $1)) * COALESCE(centrality_weight(ec.chunk_id), 1) AS score,
+         'expanded' AS origin
+    FROM expanded_chunks ec
+    JOIN document_chunk dc ON dc.id = ec.chunk_id
+    JOIN document d ON d.id = dc.document_id
+   WHERE ec.chunk_id NOT IN (SELECT chunk_id FROM seed)
+) t
+ORDER BY score DESC
+LIMIT $5;        -- ragTopK
+```
+
+> 위 SQL 은 개념 정의이며 실제 구현은 차원별 partial HNSW (V022 / V023) 와 동일 cast 표현식을 따른다.
+
+### 4.3 출력 메타데이터
+
+검색 응답에 graph 흐름 추적 메타가 추가된다.
+
+```json
+{
+  "ragSources": [
+    {
+      "chunkId": "uuid",
+      "documentId": "uuid",
+      "documentName": "Customer FAQ",
+      "chunk": "관련 텍스트 (앞 200자)...",
+      "score": 0.92,
+      "origin": "seed"
+    },
+    {
+      "chunkId": "uuid",
+      "documentId": "uuid",
+      "documentName": "Product Manual",
+      "chunk": "그래프 확장으로 회수된 텍스트...",
+      "score": 0.78,
+      "origin": "expanded"
+    }
+  ],
+  "graphTraversal": {
+    "mode": "graph",
+    "seedChunkCount": 5,
+    "traversedEntityCount": 12,
+    "maxDepth": 1,
+    "expandedChunkCount": 8
+  }
+}
+```
+
+`graphTraversal` 객체는 `mode === 'vector'` 일 때 생략된다.
+
+---
+
+## 5. API
+
+### 5.1 추출 / 재추출
+
+| 메서드 | 경로 | 설명 |
+|--------|------|------|
+| POST | `/api/knowledge-bases/:kbId/documents/:docId/re-extract` | 문서 단건 그래프 재추출 (graph 모드 KB 에서만 유효) |
+| POST | `/api/knowledge-bases/:kbId/re-extract` | KB 전체 재추출 — 모든 entity/relation/chunk_entity 삭제 후 모든 문서 재추출. `KB_REEXTRACT_IN_PROGRESS` 잠금 (재임베딩과 동일 패턴) |
+
+### 5.2 그래프 조회 (P1)
+
+| 메서드 | 경로 | 설명 |
+|--------|------|------|
+| GET | `/api/knowledge-bases/:kbId/entities` | entity 목록 (페이지네이션, 검색, 타입 필터) |
+| GET | `/api/knowledge-bases/:kbId/entities/:entityId` | entity 상세 + 등장 chunk 목록 |
+| DELETE | `/api/knowledge-bases/:kbId/entities/:entityId` | entity 삭제 (관련 relation, chunk_entity CASCADE) |
+| GET | `/api/knowledge-bases/:kbId/relations` | relation 목록 (페이지네이션, head/tail 검색) |
+| DELETE | `/api/knowledge-bases/:kbId/relations/:relationId` | relation 삭제 |
+| GET | `/api/knowledge-bases/:kbId/graph/stats` | entity_count / relation_count / 추출 진행 상태 요약 |
+| GET | `/api/knowledge-bases/:kbId/graph/visualization` | 상위 mention_count entity + relation 페이로드 (시각화 용) |
+
+---
+
+## 6. WebSocket 이벤트
+
+기존 `document:embedding_*` 이벤트와 같은 패턴으로 다음을 추가한다. 채널은 `kb:{documentId}` (`spec/5-system/8-embedding-pipeline.md §8` 과 동일).
+
+| 이벤트 | 페이로드 | 시점 |
+|--------|---------|------|
+| `document:graph_started` | `{ documentId, knowledgeBaseId }` | 추출 시작 |
+| `document:graph_progress` | `{ documentId, progress: number, entityDelta: number, relationDelta: number }` | chunk 처리마다 |
+| `document:graph_completed` | `{ documentId, entityCount, relationCount }` | 완료 |
+| `document:graph_error` | `{ documentId, error: string }` | **(의미 변경, 2026-05-11)** in-flight 일시 오류 — `document:graph_retry` 또는 `graph_failed` 가 곧 따라온다. **영구 실패 신호로 사용하지 말 것** (이전 동작은 `graph_failed` 로 이관됨) |
+| `document:graph_retry` | `{ documentId, attempt: number, maxAttempts: number, error: string }` | 일시 오류 후 재시도 큐잉 직전 |
+| `document:graph_failed` | `{ documentId, error: string }` | 재시도 모두 소진 또는 비재시도성 오류로 최종 실패 |
+
+---
+
+## 7. 에러 처리
+
+| 상황 | 처리 |
+|------|------|
+| 추출 LLM 호출 일시 실패 (timeout / 5xx / network / 429) | `Document.graph_extraction_status = 'error'`, `graph_retry_count++`, `graph_error_message` 갱신, WS `document:graph_retry`. 1s/4s/16s 백오프로 최대 3회 자동 재시도 |
+| 추출 LLM 호출 영구 실패 (재시도 소진 또는 4xx) | `Document.graph_extraction_status = 'failed'`, WS `document:graph_failed`. 사용자 액션 (단건 `/re-extract` 또는 일괄 `/retry-failed`) 까지 유지 |
+| 추출 응답 JSON 파싱 실패 | chunk 단위 silent skip + warn (LLM 응답 형식 문제는 재시도해도 동일하므로 비재시도) |
+| relation 의 head/tail 가 응답 entities 에 없음 | 해당 relation drop + warn (LLM 환각) |
+| graph 모드 KB 인데 entity_count = 0 (추출 미완료/실패) | 검색이 vector-only 흐름으로 자동 fallback (빈 그래프 expansion = vector top-K 와 동일) |
+| `re-extract` 동시 호출 | DB 컬럼 (`reextract_status`) atomic compare-and-swap 으로 차단, 409 `KB_REEXTRACT_IN_PROGRESS` |
+| 워커 정상 종료 후 `processing` 상태에서 멈춤 | `StuckDocumentRecoveryService` 가 부팅 시점에 `graph_last_attempted_at < NOW() - 10min` 인 문서를 회수해 큐 재 add |
+
+### 7.1 Retry & Failure 정책 상세
+
+- LLM `chat()` 호출에 `{ timeoutMs: 90_000 }` 적용 — 청크 응답 hang 시 90s 안에 즉시 reject.
+- 문서 단위 `retryWithBackoff(maxRetries=3, baseDelayMs=1_000)` (1s → 4s → 16s).
+- chunk_entity 정리 (`DELETE FROM chunk_entity WHERE chunk_id IN ...`) 가 추출 진입부에 있어 idempotent — 재시도 시 dedup INSERT 가 안전하게 누적됨.
+- 청크 단위 LLM 재시도는 별도 적용하지 않음 (문서 단위 재시도로 단순화 — LLM 비용 vs 코드 복잡도 트레이드오프). 후속 PR 에서 정밀화 검토.
+
+> **원칙**: 그래프 검색이 어떠한 이유로든 빈 결과를 만들 경우, vector seed 결과만으로 응답을 구성한다 (graceful degradation).
+
+---
+
+## 8. 비-목표
+
+- Entity disambiguation (서로 다른 사람 동명이인 구분) — P2 검토. 현재는 `(name, type)` 일치 시 동일 entity 로 간주.
+- Cross-KB graph linking — KB 간 entity 통합 검색은 P2 이후 (현재는 KB 단위로 격리).
+- Graph embedding (Node2Vec 등) — 검색에 활용하지 않음 (P2 이후).
+- 자동 prompt tuning — 추출 prompt 는 시스템 prompt 고정 (P2 에 KB 단위 prompt override 검토).
+
+---
+
+## Rationale
+
+Graph RAG 도메인 모델 결정의 배경·근거. memory/ 에 남아있던 작업 메모를 inline 흡수한 것이며, 폐기된 대안과 1회성 분석 자료는 `plan/complete/archive/from-memory/` 를 참조.
+
+_원본 메모: memory/graph-rag-decisions.md_
+
+### Memory: Graph RAG 기획 결정 (2026-05-02)
+
+#### 도메인 용어
+
+- **Graph RAG**: 문서에서 추출한 entity/relation 으로 구성된 지식 그래프를 RAG 검색에 활용하는 방식. 본 제품에서는 vector top-K seed → 1~2 hop graph expansion → rerank 하는 Hybrid 흐름을 의미한다.
+- **Entity**: 문서 chunk 에서 추출된 의미 단위 (인물, 조직, 개념, 위치, 이벤트 등). KB 단위로 dedup.
+- **Relation**: 두 entity 사이의 방향성 있는 관계 (head, predicate, tail).
+- **ChunkEntity**: 어느 청크가 어떤 entity 를 언급했는지 추적하는 매핑.
+- **KB.rag_mode**: 검색 모드. `vector` (default) / `graph` 두 가지. **생성 시에만 결정, 사후 변경 불가.**
+
+#### 사용자 결정 (2026-05-02)
+
+| # | 결정 사항 | 선택 |
+| --- | --- | --- |
+| 1 | PRD 위치 | 별도 파일 `prd/9-graph-rag.md` |
+| 2 | 모드 옵션 범위 | `vector` / `graph` 2종 (graph 안에 hybrid 통합) |
+| 3 | 추출 트리거 | 임베딩 완료 후 자동 chained (사용자 개입 없이 graph-extraction 큐 dispatch) |
+| 4 | UI 우선순위 | P0 = 추출 진행/완료 상태만, P1 = entity 목록 + 통계, P2 = 그래프 시각화 |
+| 5 | 검색 파라미터 노출 | KB 단위에만 (maxHops, vectorSeedTopK, expandedChunkLimit). AI Agent 노드는 기존 ragTopK/ragThreshold 유지 |
+| 6 | KB 모드 사후 변경 | 생성 시에만 결정 (불변). 모드 전환 필요 시 새 KB 생성 |
+| 7 | 추출 LLM | KB.`extraction_llm_config_id` 필드 신설 (임베딩 모델과 별도 chat LLM 지정) |
+
+#### 결정 근거 (요약)
+
+- **단일 PRD 파일**: 도메인 동기/요구사항/스펙이 응집되어 한 곳에서 읽힘
+- **mode 2종**: graph 안에 vector seed 가 이미 포함된 Hybrid 형태라 mode 3개로 쪼갤 가치 작음
+- **자동 chained**: 사용자에게 별도 액션 강요하지 않음, 임베딩 큐 → 추출 큐 자연 흐름
+- **사후 변경 불가**: vector→graph 전환은 기존 chunk 에 대한 추출 트리거가 필요해 마이그레이션이 무겁고, graph→vector 는 entity/relation 폐기. 새 KB 가 더 단순
+- **추출 LLM 분리**: 임베딩 모델은 표현 학습용, 추출 모델은 reasoning 용. 비용/품질을 분리 제어 가능
+
+#### 영향 범위
+
+- 신규: `prd/9-graph-rag.md`, `spec/5-system/10-graph-rag.md`
+- 갱신: `prd/0-overview.md`, `prd/4-integration.md`, `prd/6-phase2-ai.md`
+- 갱신: `spec/1-data-model.md`, `spec/5-system/9-rag-search.md`, `spec/5-system/8-embedding-pipeline.md`, `spec/2-navigation/5-knowledge-base.md`, `spec/4-nodes/3-ai/1-ai-agent.md`
+- 작업 plan: `plan/complete/ai-knowledge-base/graph-rag-prd.md`
+
+#### 비-목표 (이번 PRD 범위 밖)
+
+- Microsoft GraphRAG community detection / 글로벌 요약 (P2 이후)
+- Apache AGE / Neo4j 도입 (데이터 규모 임계 도달 시 검토)
+- 룰 기반 entity 추출 (LLM 추출 단일 경로)
+
+```
+
+#### `spec/5-system/11-mcp-client.md`
+```
+# Spec: MCP Client (Model Context Protocol)
+
+> 관련 문서: [Spec AI Agent](../4-nodes/3-ai/1-ai-agent.md) · [Spec RAG 검색 §7 확장 포인트](./9-rag-search.md#7-확장-포인트--agenttoolprovider) · [Spec 통합 관리 §5.6 MCP Server](../2-navigation/4-integration.md#56-mcp-server) · [Spec Integration 공통 §1 Integration 참조](../4-nodes/4-integration/0-common.md#1-integration-참조) · [데이터 모델 - Integration §2.10](../1-data-model.md#210-integration)
+
+---
+
+## 1. 개요
+
+AI Agent 노드가 외부 [Model Context Protocol (MCP)](https://modelcontextprotocol.io) 서버의 능력(Tools / Resources / Prompts)을 LLM 의 도구 호출 인터페이스로 노출해 활용할 수 있도록 하는 클라이언트 추상화 계층.
+
+**위치**: AI Agent 노드 핸들러 내부의 `AgentToolProvider` 구현체(`McpToolProvider`)와, 그 하위에서 MCP 프로토콜 통신을 담당하는 `McpClientService` 모듈로 구성된다. 외부 프로토콜·인증·세션을 모두 캡슐화하여 AI Agent 핸들러는 KB 검색과 동일한 추상화로 MCP 도구를 다룬다.
+
+**범위**:
+- LLM 의 능동적 tool calling 으로만 호출 (KB 와 동일 — 핸들러가 prefill 하지 않음)
+- 워크스페이스 공용 자원 (사용자 개인 MCP 서버는 본 spec 의 범위 밖)
+- 외부 서버용 **Streamable HTTP (SSE)** transport (§2.1) + 내부 모듈용 **Internal Bridge** transport (§2.3). stdio·websocket 미지원
+
+**MVP 미포함**:
+- stdio MCP 서버 spawn (멀티테넌트 SaaS에서 프로세스·보안 격리 부담)
+- MCP `prompts/get` 결과를 systemPrompt 슬롯에 정적으로 핀하는 UX
+- MCP server-to-server proxy / 응답 캐싱 레이어
+- MCP 서버 헬스체크의 자체 cron (만료 스캐너 §11.1 의 token_expires_at 흐름은 사용 안 함)
+
+---
+
+## 2. Transport
+
+본 클라이언트는 두 종류의 transport 를 지원한다 — **외부 서버용 HTTP transport** 와 **내부 모듈용 Internal Bridge**. 두 transport 모두 `IMcpClient` 인터페이스를 구현하여 AI Agent 핸들러가 차이를 신경 쓰지 않는다.
+
+### 2.1 Streamable HTTP (외부 서버용)
+
+`service_type='mcp'` Integration 에 적용. MCP 의 **Streamable HTTP** transport 만 지원한다.
+
+| 항목 | 동작 |
+|------|------|
+| 엔드포인트 | Integration `credentials.url` 의 단일 URL — 클라이언트 → 서버는 `POST`, 서버 → 클라이언트는 `GET` + `text/event-stream` |
+| 세션 | 서버가 `Mcp-Session-Id` 응답 헤더로 발급하면 이후 모든 요청에 동일 헤더로 echo. 발급되지 않으면 stateless 모드 |
+| 프로토콜 버전 | 클라이언트 SDK 가 협상. 서버가 미지원 버전을 거부하면 `INTEGRATION_NOT_CONNECTED` 로 격하 |
+| 인증 | HTTP 헤더 (§3.2 `auth_type` 별 매핑) |
+
+### 2.2 stdio 미지원 사유
+
+- 멀티테넌트 백엔드에서 사용자별 subprocess 를 spawn 하는 비용·보안 부담
+- 임의 명령 실행 권한 노출 위험
+- 워크스페이스 공용 모델과 부정합
+
+향후 데스크톱 bridge agent 등을 통해 우회적으로 stdio 서버를 노출하는 방안은 별도 spec 으로 분리한다.
+
+### 2.3 Internal Bridge (in-process)
+
+**일부 first-party Integration 은 외부 MCP 서버 없이 backend in-process 모듈로 MCP 인터페이스를 노출한다.** 이는 같은 Integration 이 워크플로 노드와 AI Agent 양쪽에서 사용되는 케이스의 표준 패턴이다.
+
+| 항목 | 동작 |
+|------|------|
+| 적용 service_type | 현재 `cafe24` — 향후 first-party 통합(예: Shopify, Naver Smartstore)이 같은 패턴 사용 가능 |
+| 구현 형태 | backend 모듈이 `IMcpClient` 인터페이스를 구현 (예: `Cafe24McpBridge`). HTTP fetch 가 아니라 직접 함수 호출 |
+| connect / initialize | no-op — 메모리 안에서 즉시 사용 가능. `capabilities` / `serverInfo` 는 정적 상수 |
+| 세션 | 노드 실행 단위 mutex 만 — `Mcp-Session-Id` 헤더 불필요 |
+| 인증 | Integration 의 자체 인증 (예: Cafe24 OAuth) 을 그대로 활용. `credentials.url` / `auth_type` 표(§3.2) 는 적용되지 않음 |
+| SSRF 검증 | 미적용 — 외부 fetch 가 없음. base URL 의 안전성 검증은 Integration 의 `service_type` 별 로직(예: Cafe24 의 `mall_id` 유효성)이 담당 |
+| Rate Limit | Integration 의 자체 wrapper (예: Cafe24 의 `Cafe24ApiClient`) 가 처리. 동일 프로세스 인스턴스 내 mutex 로 노드 호출과 공유 |
+
+**도구 노출**: §5 의 일반 모델을 그대로 적용. `Cafe24McpBridge.listTools()` 는 Cafe24 메타데이터 테이블에서 자동 생성된 도구 목록 반환 ([Spec Cafe24 §8.1](../4-nodes/4-integration/4-cafe24.md#81-도구-이름-매핑) · [Cafe24 API Metadata 컨벤션](../conventions/cafe24-api-metadata.md)).
+
+**capability 보고**: Internal Bridge 별로 capability 가 다를 수 있다 — Cafe24 는 `tools` 만 보고, `resources` / `prompts` 미보고. AI Agent 는 §5.1 노출 규칙에 따라 메타도구를 생성하지 않는다.
+
+**에러 처리**: §8 의 에러 vocabulary 그대로 적용. Cafe24 의 경우 `tool_result.error` 의 `code` 는 Cafe24 노드 §6 의 vocabulary (`CAFE24_AUTH_FAILED` 등)를 그대로 사용하며, `mcpDiagnostics.errors` 에는 동일하게 누적된다.
+
+> Internal Bridge 도 §8.4 의 인증 실패 자동 status 전환 정책을 따른다 — 401/403 응답 시 `Integration.status = error(auth_failed)` 로 전이.
+
+---
+
+## 3. Integration 모델
+
+MCP 서버는 **신규 노드가 아니라** 기존 Integration 엔티티의 새 `service_type` 으로 등록된다 ([데이터 모델 §2.10](../1-data-model.md#210-integration)). 별도 테이블·컬럼은 추가하지 않는다.
+
+### 3.1 service_type / auth_type
+
+본 절(§3) 의 `service_type='mcp'` 와 `auth_type` / `credentials` 스키마는 **외부 HTTP transport (§2.1) 한정**이다. Internal Bridge (§2.3) 로 노출되는 service_type 은 자체 인증 모델을 사용한다.
+
+| 필드 | 값 (외부 HTTP) |
+|------|----|
+| `Integration.service_type` | `mcp` |
+| `Integration.auth_type` | `bearer_token` / `api_key` / `none` |
+| `Integration.scope` | 기본 `organization` (개인 등록 미지원) |
+
+**Internal Bridge 적용 service_type** (현재):
+
+| service_type | Bridge 구현 | spec |
+|---|---|---|
+| `cafe24` | `Cafe24McpBridge` | [Spec Cafe24 §8 AI Agent 노출](../4-nodes/4-integration/4-cafe24.md#8-ai-agent-노출-internal-mcp-bridge) |
+
+### 3.2 credentials JSONB 스키마
+
+`auth_type` 에 따라 다음 필드를 갖는다 — 모든 비밀 필드는 [Integration §5.6](../2-navigation/4-integration.md#56-mcp-server) 의 정책으로 AES-256-GCM 암호화된다.
+
+| `auth_type` | 필드 | 비밀 |
+|-------------|------|------|
+| 공통 | `url` (https URL, 필수) | × |
+| 공통 | `default_headers` (Record<string,string>?) | × |
+| `bearer_token` | `token` | 🔒 |
+| `api_key` | `header_name` (e.g. `X-Api-Key`), `value` | `value` 만 🔒 |
+| `none` | — | — |
+
+> **본 §3.2 의 URL 검증 / SSRF 정책은 외부 HTTP transport (§2.1) 한정.** Internal Bridge (§2.3) 는 외부 fetch 가 없으므로 적용되지 않는다.
+>
+> `url` 은 **HTTPS 강제** (테스트 연결 시 `https://` 시작 검증, 미충족 시 `MCP_HTTPS_REQUIRED`). 호스트가 다음 중 하나에 해당하면 동일한 코드로 차단된다 (SSRF 방어):
+>
+> - loopback (`127.0.0.0/8`, `::1`) / link-local (`169.254.0.0/16`, `fe80::/10`)
+> - RFC 1918 사설 대역 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`)
+> - IPv6 unique-local (`fc00::/7`)
+> - cloud metadata 호스트명 (`metadata.google.internal`, `metadata.azure.com` 등)
+>
+> 호스트명이 IP literal 이 아닐 경우 즉시 차단하지는 않지만 (DNS 결과를 기다리지 않음), connect 단계에서 SDK 가 시도하는 실제 fetch 가 사설망 IP로 해석되더라도 transport 가 동일 검증을 1회 더 수행한다. 본 룰은 [Spec API §SSRF 가이드](./2-api-convention.md) 의 일반화이며, MCP 등록 단계에서 일관 적용된다.
+>
+> **로컬 개발 escape hatch** — 환경변수 `MCP_ALLOW_INSECURE_URL=true` 가 설정되면:
+>
+> - `http://` URL 허용 (단 `file://` / `ws://` 등 다른 scheme 은 여전히 거부)
+> - 위 SSRF 호스트 블록리스트 전체 우회 (loopback / RFC 1918 / cloud metadata 모두 등록 가능)
+>
+> 본 토글은 운영 환경에서 절대 활성화해서는 안 된다 — 워크스페이스 admin 이 등록한 URL 을 그대로 신뢰하게 되어 SSRF 방어 표면이 다시 열린다. 기본값 `false`. `backend/.env.example` 에 경고와 함께 명시.
+
+### 3.3 capabilities 캐시 (선택)
+
+`Integration.last_error` 와 별개로, 서버 등록 시 1회 `initialize` 응답의 `capabilities` 객체를 `credentials.cached_capabilities` (write-only로 처리하지 않음, 메타데이터) 에 저장해 노드 설정 UI 의 즉시 미리보기에 활용할 수 있다. **저장된 capabilities 는 hint 일 뿐, 실제 실행 시점에 다시 조회한 결과를 우선한다.**
+
+> `cached_capabilities` 는 **외부 HTTP transport (§2.1) 전용**. Internal Bridge (§2.3) 는 capability 가 정적 상수이므로 캐시 불필요 (`Cafe24McpBridge` 는 `tools` capability 만 hardcoded 보고).
+
+---
+
+## 4. Connection Lifecycle
+
+### 4.1 단위
+
+**AI Agent 노드 실행 1회 = MCP 세션 1회**. 노드 실행 시작 시 `mcpServers` 에 등록된 각 Integration 에 대해 lazily connect 하고, 노드 실행 종료(또는 multi-turn `waiting_for_input` 진입) 시 close.
+
+| 시점 | 동작 |
+|------|------|
+| AI Agent `execute` 진입 | `mcpServers` 목록만 조회 (connect 지연) |
+| `buildTools` 첫 호출 | 각 서버에 대해 connect → `initialize` → capabilities 검사 → `tools/list` (+ resources/prompts capability 보고 시 each list) |
+| LLM 이 `mcp_*` tool 호출 | 동일 세션에서 `tools/call` (또는 메타도구 §6) |
+| 노드 종료 / `waiting_for_input` | 모든 세션 close. 재개(resume) 시 `mcpServers` config 로부터 결정론적으로 재연결 |
+| Multi-turn 동일 노드의 turn N+1 | 동일 세션 유지 (waiting 진입하지 않은 인-메모리 turn 의 경우) |
+
+### 4.2 재연결 / 재개
+
+Multi-turn AI Agent 가 `waiting_for_input` 상태로 일시 중단되면 세션은 close 되며 사용자 메시지 수신 후 재개 시점에 동일한 `mcpServers` 로부터 새 세션을 만든다. 세션 ID 와 capability list 는 **재개 시 재조회**해도 안전한 설계이며, AI Agent 내부 상태(`messages` 등)는 영향받지 않는다.
+
+### 4.3 동시성 / 풀링
+
+같은 노드 실행 내에서 한 서버에 대한 connect 는 **1회**만 일어난다 (`(integrationId, executionId)` 캐시). 노드 간·실행 간 세션 공유는 하지 않는다 — 사용자 격리·세션 라이프사이클의 단순함을 위해 의도적으로 풀을 키우지 않는다.
+
+워크스페이스 단위 동시 connect 수는 백엔드 환경 변수 `MCP_MAX_CONCURRENT_CONNECTIONS` (기본 20) 로 상한한다.
+
+> **Internal Bridge (§2.3)**: connect / `initialize` / close 가 모두 no-op. `buildTools` 는 메모리에서 즉시 메타데이터 테이블 기반 도구 목록 생성. `tools/call` 은 직접 함수 호출. `(integrationId, executionId)` 캐시 규칙은 동일 적용 (Bridge 인스턴스가 같은 execution 내에서 1회 lazy init). `MCP_MAX_CONCURRENT_CONNECTIONS` 상한은 외부 HTTP transport 에만 카운트되며 Internal Bridge 는 별도 상한 없음.
+
+### 4.4 타임아웃
+
+| 단계 | 기본 타임아웃 |
+|------|-------------|
+| connect + initialize | 10s |
+| `tools/list`, `resources/list`, `prompts/list` | 10s |
+| `tools/call`, `resources/read`, `prompts/get` | 30s |
+
+타임아웃은 환경 변수로 override 가능. 초과 시 §8 의 에러 처리에 따라 격리된다.
+
+---
+
+## 5. 도구 노출 모델
+
+MCP 의 세 capability(Tools / Resources / Prompts) 를 모두 **LLM 의 도구 호출 인터페이스로 평탄화** 하여 노출한다. 이는 다음 이유로 일관성 있고 단순하다:
+
+- LLM 이 능동적으로 호출 시점·인자를 결정 (KB 검색과 동일 모델)
+- AI Agent 핸들러의 `AgentToolProvider` 추상화 그대로 재사용 가능
+- 사용자 설정 UI 가 "MCP 서버 추가 + 도구 allowlist" 한 가지 흐름으로 끝남
+
+향후 systemPrompt 에 prompt 를 정적으로 핀하거나 Resource 를 KB 와 같은 정적 컨텍스트 주입으로 다루는 변형은 별도 spec 으로 도입할 수 있다.
+
+### 5.1 노출 규칙
+
+서버가 `initialize` 응답에서 보고한 capability 에 따라 다음 도구가 자동 생성된다.
+
+| MCP capability | 노출되는 LLM 도구 | 종류 |
+|----------------|-----------------|------|
+| `tools` (서버가 보고) | 각 tool 마다 1개 — `mcp_<sid>__<toolName>` | 일반 도구 |
+| `resources` (서버가 보고) | `mcp_<sid>__list_resources`, `mcp_<sid>__read_resource` | 메타 도구 |
+| `prompts` (서버가 보고) | `mcp_<sid>__list_prompts`, `mcp_<sid>__get_prompt` | 메타 도구 |
+
+서버가 capability 를 보고하지 않으면 해당 분류의 도구는 **생성 자체를 생략**한다 (LLM 에 노출 안 됨).
+
+### 5.2 도구 이름 규칙
+
+모든 MCP 관련 도구는 `mcp_` prefix 를 갖는다 — AI Agent 의 기존 prefix(`tool_`, `kb_`, `cond_`) 와 충돌하지 않는다.
+
+```
+mcp_<sid>__<toolName>
+mcp_<sid>__list_resources
+mcp_<sid>__read_resource
+mcp_<sid>__list_prompts
+mcp_<sid>__get_prompt
+```
+
+| 토큰 | 정의 |
+|------|------|
+| `<sid>` | `Integration.id` (UUID) 의 앞 8자에서 비-`[a-z0-9]` 문자를 `_` 로 치환한 값. 워크스페이스 내 8자 충돌 시 12자로 확장 (`McpToolProvider` 가 등록 시점에 결정) |
+| `<toolName>` | MCP 서버가 `tools/list` 로 보고한 원본 이름. LLM API 호환을 위해 `[^a-zA-Z0-9_]` 를 `_` 로 치환 (sanitize) |
+| `__` | server ↔ tool 구분자. 단일 underscore 로는 sanitized tool name 과 분리 불가능하므로 double underscore 사용 |
+
+**역파싱**: `McpToolProvider.matches(name)` 는 `name.startsWith('mcp_')` 만 검사하고, `execute` 단계에서 `__` 의 첫 발생 위치로 split 하여 `<sid>` 와 도구 식별자를 분리한다. 메타도구는 식별자가 예약어(`list_resources`, `read_resource`, `list_prompts`, `get_prompt`) 와 일치하는지로 분기.
+
+### 5.3 Tools — 일반 도구
+
+MCP `tools/list` 응답의 각 tool 을 `ToolDef` ([Spec LLM 클라이언트 §3.4](./7-llm-client.md#34-tooldef--toolcall)) 로 변환한다.
+
+```json
+{
+  "name": "mcp_<sid>__<sanitized_toolName>",
+  "description": "<MCP tool.description>\n\n(via MCP server: <integration.name>)",
+  "parameters": <MCP tool.inputSchema>
+}
+```
+
+- `inputSchema` 는 JSON Schema (MCP 표준) — 변환 없이 그대로 LLM 의 `parameters` 로 전달
+- `description` 끝에 출처(서버 별칭) 를 자동 부기하여 LLM 이 같은 의미의 도구가 여러 서버에 있을 때 출처 인지 가능하게 함
+
+#### 사용자 오버라이드 (선택)
+
+AI Agent config 의 `mcpServers[].toolOverrides[]` ([Spec AI Agent §1 설정](../4-nodes/3-ai/1-ai-agent.md#1-설정-config)) 로 도구별 description 을 커스터마이즈할 수 있다. 이름은 변경 불가 — 호환성 유지 위함.
+
+### 5.4 Resources — 메타 도구 2종
+
+서버가 `resources` capability 를 보고할 때만 자동 추가.
+
+```json
+{
+  "name": "mcp_<sid>__list_resources",
+  "description": "List available resources on MCP server \"<integration.name>\".",
+  "parameters": {
+    "type": "object",
+    "properties": {
+      "cursor": { "type": "string", "description": "Pagination cursor (optional)" }
+    }
+  }
+}
+```
+
+```json
+{
+  "name": "mcp_<sid>__read_resource",
+  "description": "Read a resource by URI from MCP server \"<integration.name>\".",
+  "parameters": {
+    "type": "object",
+    "properties": {
+      "uri": { "type": "string", "description": "Resource URI (use list_resources to discover)" }
+    },
+    "required": ["uri"]
+  }
+}
+```
+
+`tool_result` 는 MCP `Resource` / `ResourceContents` 객체를 JSON 직렬화하여 그대로 전달. 텍스트는 `content[].text`, 바이너리는 `content[].blob` (base64) — LLM 의 멀티모달 입력은 별도 노드(추후) 에서 활용.
+
+### 5.5 Prompts — 메타 도구 2종
+
+서버가 `prompts` capability 를 보고할 때만 자동 추가.
+
+```json
+{
+  "name": "mcp_<sid>__list_prompts",
+  "description": "List available prompt templates on MCP server \"<integration.name>\".",
+  "parameters": {
+    "type": "object",
+    "properties": {
+      "cursor": { "type": "string", "description": "Pagination cursor (optional)" }
+    }
+  }
+}
+```
+
+```json
+{
+  "name": "mcp_<sid>__get_prompt",
+  "description": "Render a prompt template from MCP server \"<integration.name>\". Returns a list of messages you should incorporate into your reasoning.",
+  "parameters": {
+    "type": "object",
+    "properties": {
+      "name":      { "type": "string" },
+      "arguments": { "type": "object", "description": "Prompt arguments (server-defined)" }
+    },
+    "required": ["name"]
+  }
+}
+```
+
+`get_prompt` 의 `tool_result` 는 MCP `GetPromptResult.messages` 배열을 JSON 직렬화. LLM 은 이 메시지들을 자신의 reasoning 에 통합한다 (시스템 프롬프트 슬롯에 정적으로 주입하지 않음 — MVP).
+
+### 5.6 도구 allowlist
+
+AI Agent config (`mcpServers[].enabledTools`) 에서 일반 도구별로 화이트리스트를 적용할 수 있다.
+
+| 값 | 의미 |
+|----|------|
+| `['*']` 또는 미설정 | 서버가 노출하는 모든 일반 도구 LLM 에 노출 (기본) |
+| `['toolA', 'toolB']` | 명시된 일반 도구만 노출. 서버에 없는 이름은 무시(경고만) |
+
+**메타도구는 allowlist 의 영향을 받지 않는다** — 서버 단위 on/off 만으로 제어. (resource/prompt 별로 allowlist 를 두지 않은 이유: MCP 서버 측에서 권한 모델로 제어하는 것이 자연스럽고, AI Agent 입장에서는 capability 단위 toggle 만으로 충분.)
+
+`mcpServers[].includeResources: false` / `mcpServers[].includePrompts: false` 토글로 capability 단위 옵트아웃 가능 — 기본은 모두 `true` (서버가 보고했다면 노출).
+
+### 5.7 도구 호출 한도
+
+MCP 도구 호출은 AI Agent 의 `maxToolCalls` (기본 10) 카운트에 **포함**된다 — KB tool 과 동일 정책. 한도 도달 시 loop 종료 후 마지막 LLM 응답 반환.
+
+---
+
+## 6. AgentToolProvider 구현 (`McpToolProvider`)
+
+[`AgentToolProvider`](../4-nodes/3-ai/1-ai-agent.md) 인터페이스의 두 번째 구현체 (첫 번째는 `KbToolProvider`).
+
+### 6.1 인터페이스 매핑
+
+| 메서드 | 동작 |
+|--------|------|
+| `key` | `'mcp'` |
+| `matches(name)` | `name.startsWith('mcp_')` |
+| `buildTools(ctx)` | `ctx.config.mcpServers` 순회 → 각 서버 connect/initialize → §5 규칙으로 ToolDef[] 생성. 실패 서버는 skip하고 §8 의 진단 정보 누적 |
+| `execute(call, ctx)` | `name` 에서 `<sid>` 추출 → 해당 서버 세션에서 §5.3–5.5 분기 따라 RPC 호출 → 결과를 `AgentToolResult.content` 로 직렬화 |
+
+### 6.2 진단 누적 (`mcpDiagnostics`)
+
+KB 의 `ragDiagnostics` 와 동일한 패턴으로, AI Agent 의 `meta.mcpDiagnostics` 에 호출 통계를 누적한다.
+
+```json
+{
+  "mcpDiagnostics": {
+    "attempted": true,
+    "serverCount": 2,
+    "toolCalls": 4,
+    "resourceReads": 1,
+    "promptGets": 0,
+    "errors": [
+      { "integrationId": "uuid", "phase": "tools/list", "code": "MCP_TIMEOUT", "message": "..." }
+    ]
+  }
+}
+```
+
+| 필드 | 의미 |
+|------|------|
+| `attempted` | MCP 도구가 1번 이상 호출되었거나 노출되었는지 |
+| `serverCount` | 본 노드 실행에서 성공적으로 connect 된 서버 수 |
+| `toolCalls` / `resourceReads` / `promptGets` | 각 호출 누적 |
+| `errors` | 서버별 부분 실패 기록 (전체 실패가 아닌 격리된 실패) |
+
+Multi-turn 모드에서는 KB 와 동일하게 turn 단위 delta 가 `meta.turnDebug[].mcpDiagnostics` 로도 분리되어 노출된다.
+
+---
+
+## 7. 실행 흐름 (요약)
+
+```
+AI Agent.execute()
+  ↓
+[setup] config.mcpServers 조회
+  ↓
+[buildTools] 각 server lazy connect → initialize → tools/resources/prompts list
+            → §5 규칙으로 LLM ToolDef[] 생성
+            → 실패 서버는 skip + mcpDiagnostics.errors 누적
+  ↓
+[1st LLM call] (KB tool, MCP tool, condition tool, 그리고 일반 tool 모두 함께 노출)
+  ↓
+LLM 응답
+  ├─ tool_use(mcp_*) → §6.1 execute → tool_result 주입 → 다음 turn
+  ├─ tool_use(kb_*) → KbToolProvider 처리 (변경 없음)
+  ├─ tool_use(cond_*) → 조건 처리 (변경 없음)
+  └─ 일반 텍스트 → 종료
+  ↓
+모든 세션 close → meta.mcpDiagnostics 확정
+```
+
+---
+
+## 8. 에러 처리
+
+### 8.1 격리 원칙
+
+**한 MCP 서버의 장애가 AI Agent 노드 전체를 죽이지 않는다.** KB 검색과 같은 graceful degradation 전략.
+
+| 상황 | 처리 |
+|------|------|
+| `initialize` 실패 / `tools/list` 실패 / connect 타임아웃 | 해당 서버 도구는 LLM 에 **노출하지 않음**. `meta.mcpDiagnostics.errors` 에 기록. 다른 서버·KB·일반 도구는 정상 노출 |
+| `tools/call` 실패 (네트워크 / 5xx / RPC error) | 해당 호출만 실패. LLM 에 `tool_result` 로 `{ "error": "<code>", "message": "..." }` 전달 → LLM 이 graceful 응답 결정. `mcpDiagnostics.errors` 에도 누적 |
+| 401 / 403 (인증 실패) | 위와 동일하되 `Integration.status` 를 `error(auth_failed)` 로 갱신, `last_error` 기록. 사용자에게 reauthorize/rotate 권장 |
+| 도구 인자 schema 검증 실패 | LLM 이 보낸 인자가 `inputSchema` 를 위반하면 호출 시도 없이 `tool_result.error = 'INVALID_TOOL_ARGUMENTS'` 반환 (LLM 이 다음 턴에 보정) |
+| `tool_result.content` 가 너무 큼 (>100KB 텍스트 또는 >1MB 바이너리) | truncate 후 `tool_result` 끝에 `[truncated: original_size_bytes]` 마커. mcpDiagnostics 경고 |
+
+### 8.2 에러 코드 vocabulary
+
+`tool_result.error` 또는 `mcpDiagnostics.errors[].code` 에 사용:
+
+| 코드 | 의미 |
+|------|------|
+| `MCP_CONNECT_FAILED` | TCP / TLS / DNS 실패, HTTPS 강제 위반, `initialize` RPC 실패 (프로토콜 버전 불일치 등 포함) — connect 단계의 모든 실패가 하나로 흡수된다. SDK 가 connect 와 initialize 를 하나의 호출로 묶어 처리하므로 두 단계를 의미적으로 분리하기 어려움 |
+| `MCP_LIST_FAILED` | `tools/list` 등 list RPC 실패 |
+| `MCP_CALL_FAILED` | `tools/call` / `resources/read` / `prompts/get` 실패 |
+| `MCP_TIMEOUT` | §4.4 타임아웃 초과 |
+| `MCP_AUTH_FAILED` | credential 누락/포맷 오류, 또는 401/403. `Integration.status` 갱신 동반 |
+| `MCP_HTTPS_REQUIRED` | URL 이 https:// 가 아니거나, 파싱 불가, 또는 사설/내부망 호스트(SSRF 차단) — preview-test 단계에서 검출 |
+| `INVALID_TOOL_ARGUMENTS` | 인자 schema 검증 실패 (호출 자체는 발생 안 함) |
+| `MCP_RESPONSE_TOO_LARGE` | content 사이즈 상한 초과 (truncate 적용됨을 알림) |
+
+`Integration.last_error` 에는 `MCP_AUTH_FAILED` 와 같은 status 전이를 유발한 에러만 기록한다 — 일반 호출 실패는 `IntegrationUsageLog` (있다면) 와 `mcpDiagnostics.errors` 로 충분.
+
+### 8.3 IntegrationUsageLog
+
+[Spec 통합 §14 핸들러 실행 세멘틱](../2-navigation/4-integration.md#14-연관-동작) 에서 정의한 Integration 노드의 usage 로깅 패턴은 AI Agent 의 MCP 호출에도 적용된다 — `tools/call` 1회당 1 record, `node_execution_id` 는 호출 시점의 AI Agent NodeExecution.
+
+| 필드 | 값 |
+|------|----|
+| `status` | `success` / `failed` |
+| `error` | 실패 시 `{ code, message }` (§8.2 vocabulary). `message` 는 2KB 로 clamp |
+| `duration_ms` | RPC 호출 단위의 elapsed |
+
+**메타 도구 (`list_resources` · `read_resource` · `list_prompts` · `get_prompt`) 는 usage 로그에 기록하지 않는다** — 외부 API 호출이라기보다 MCP 세션의 내부 discovery 흐름이며, 매 호출 기록은 Activity 탭의 신호 대비 잡음을 키운다. 추후 별도 dashboard 가 필요해지면 분리된 trace 로 도입.
+
+`tools/list` / `resources/list` / `prompts/list` 등 buildTools 단계의 setup RPC 도 usage 로그에 기록하지 않는다.
+
+usage 로그 쓰기는 **fire-and-forget** — `tools/call` 의 응답 반환 직후 비동기로 발사되어 핫패스를 블로킹하지 않는다. DB 쓰기 실패는 swallow + warn log.
+
+### 8.4 인증 실패 자동 status 전환
+
+`tools/call` 응답이 401/403 (또는 `unauthorized`/`forbidden` 메시지) 이면 다음을 동시에 수행:
+
+1. `tool_result.error.code = MCP_AUTH_FAILED` 로 LLM 에 전달 — 사용자 경험을 위해 호출 자체는 graceful fail
+2. `IntegrationUsageLog.error.code = MCP_AUTH_FAILED` 로 로그 기록
+3. **`Integration.status` 를 `error` 로, `status_reason` 을 `auth_failed` 로 atomic UPDATE 전환** — 다음 노드 실행이 기동될 때 통합 관리 화면이 "Need attention" 배너로 자동 노출
+
+자동 복구는 하지 않는다 — 토큰이 다시 유효해지면 사용자가 명시적으로 `Rotate credentials` 또는 OAuth `Reauthorize` 를 통해 `connected` 로 복귀시킨다. 자동 복구 정책을 도입하면 만료된 토큰이 일시 회복되는 race-of-clock 시나리오에서 status 가 깜빡일 수 있어 운영 가시성을 해친다.
+
+단일 실패로 status 가 전환되는 점은 OAuth integration 의 기존 정책과 동일하며 의도적 — 임계값 (예: 3회 연속) 도입은 반복 실패 비용 증가 vs status 가시성 trade-off 분석 후 별도로 결정.
+
+---
+
+## 9. 연결 테스트 (Test Connection)
+
+[Spec 통합 §3.3 Step 3](../2-navigation/4-integration.md#33-step-3-연결-테스트) 의 `POST /api/integrations/preview-test` 흐름과 동일한 방식. MCP 서비스의 테스트 절차:
+
+1. `credentials.url` 이 `https://` 시작인지 검증 — 아니면 `MCP_INVALID_URL` (test 단계 한정 코드)
+2. Streamable HTTP 클라이언트로 connect → `initialize` 호출 (10s 타임아웃)
+3. 응답의 `capabilities` 와 `serverInfo` 를 메모리에 보유
+4. (선택) `tools/list` 1회 호출하여 도구 카운트 미리보기 생성
+5. 세션 close
+
+성공 시 응답 body 에 다음을 포함한다 (UI 가 capability 미리보기에 사용):
+
+```json
+{
+  "capabilities": { "tools": {}, "resources": {}, "prompts": {} },
+  "serverInfo": { "name": "filesystem-mcp", "version": "1.2.0" },
+  "preview": { "toolCount": 12, "resourceSupported": true, "promptSupported": false }
+}
+```
+
+실패 시 `INTEGRATION_TEST_FAILED` (HTTP 422) + `details.code` 에 §8.2 의 vocabulary.
+
+---
+
+## 10. 클라이언트 라이브러리 의존성
+
+- **Backend**: 공식 TypeScript SDK `@modelcontextprotocol/sdk` (Streamable HTTP transport 모듈) 를 사용한다. Nest.js `McpClientModule` 이 SDK 를 감싸 워크스페이스 격리·로깅·타임아웃을 주입.
+- 단일 transport 사용으로 SDK import 표면을 최소화하며, stdio·websocket 모듈은 import 하지 않는다.
+
+---
+
+## 11. 데이터 모델 영향
+
+신규 컬럼 / 신규 엔티티 **없음**. [Integration §2.10](../1-data-model.md#210-integration) 의 `service_type` String 컬럼에 다음 값들이 본 spec 의 영역에서 사용된다 — `mcp` (외부 HTTP transport §2.1), `cafe24` (Internal Bridge §2.3). 두 값 모두 String 컬럼이므로 enum 마이그레이션 불필요.
+
+`IntegrationUsageLog §2.10.1` 의 사용 패턴이 양쪽 transport 모두에 적용된다 (`tools/call` 1회당 1 record).
+
+---
+
+## 12. 확장 포인트
+
+- **stdio transport**: 데스크톱 bridge 또는 사내 격리 환경 한정으로 도입 가능. credentials 스키마에 `command`, `args`, `env` 추가하고 transport 분기.
+- **prompt 의 정적 핀**: `mcp_<sid>__get_prompt` 결과를 systemPrompt 슬롯에 고정 주입하는 사용자 흐름. AI Agent 설정 UI 의 systemPrompt 섹션 옆에 "MCP Prompt 첨부" 추가.
+- **resource 의 KB-style 정적 컨텍스트**: 특정 resource URI 를 노드 실행 시 자동으로 read 하여 `messages[].content` prefix 에 주입. `mcpServers[].pinnedResources: string[]`.
+- **OAuth 2.1 (PKCE) auth_type**: `bearer_token` 만 MVP. 동적 OAuth 흐름은 [통합 §10 OAuth 콜백](../2-navigation/4-integration.md#10-oauth-콜백-엔드포인트) 패턴을 재사용해 추가 가능.
+- **server-to-server proxy / 응답 캐싱**: 트래픽 분석 후 별도 spec.
+- **Internal Bridge 확장**: Shopify, Naver Smartstore 등 first-party 이커머스 통합이 `cafe24` 와 동일한 §2.3 패턴으로 추가 가능. backend 에 `<Service>McpBridge` 모듈 + 메타데이터 테이블을 두고 service_type 화이트리스트(§3.1) 에 추가.
+
+각 항목은 본 spec 의 평탄화 모델(§5) 을 깨지 않고 추가 가능하도록 설계되었다.
+
+```
+
+#### `spec/5-system/12-webhook.md`
+```
+# Spec: Webhook 트리거 시스템
+
+> 관련 문서: [PRD Webhook](./12-webhook.md) · [Spec 트리거 목록](../2-navigation/2-trigger-list.md) · [Spec 데이터 모델](../1-data-model.md#28-trigger) · [Spec 실행 엔진](./4-execution-engine.md)
+
+---
+
+## Overview (제품 정의)
+
+> 출처: `prd/8-webhook.md` — docs-consolidation(2026-05-12)으로 본 문서에 흡수.
+
+---
+
+### 1. 개요
+
+외부 서비스(GitHub, Stripe 등)나 사용자 정의 시스템에서 HTTP 요청을 보내 워크플로우를 자동으로 실행하는 Webhook 트리거 기능을 정의한다. Webhook은 이벤트 기반 자동화의 핵심 진입점으로, 외부 이벤트 발생 시 실시간으로 워크플로우를 트리거한다.
+
+---
+
+### 2. 사용 시나리오
+
+| 시나리오 | 설명 |
+|----------|------|
+| GitHub PR 이벤트 | PR 생성/머지 시 코드 리뷰 워크플로우 자동 실행 |
+| 이메일 수신 | 특정 메일 수신 시 AI 에이전트 워크플로우 실행 |
+| Stripe 결제 이벤트 | 결제 완료/실패 시 알림 워크플로우 실행 |
+| 폼 제출 | 외부 웹 폼에서 제출 시 데이터 처리 워크플로우 실행 |
+| IoT 데이터 수신 | 센서 데이터 도착 시 분석 워크플로우 실행 |
+
+---
+
+### 3. 요구사항
+
+#### 3.1 Webhook 엔드포인트
+
+| ID | 요구사항 | 우선순위 |
+|----|----------|----------|
+| WH-EP-01 | 트리거별 고유한 webhook URL 자동 생성 | 필수 |
+| WH-EP-02 | URL 형식: `{base_url}/api/hooks/{endpoint_path}` | 필수 |
+| WH-EP-03 | HTTP POST 메서드 지원 | 필수 |
+| WH-EP-04 | JSON, form-urlencoded 요청 본문 수신 | 필수 |
+| WH-EP-05 | 요청 본문 전체를 워크플로우 입력 데이터로 전달 (`body`) | 필수 |
+| WH-EP-05-1 | Manual Trigger 노드가 선언한 `parameters` 스키마에 따라 body에서 파라미터를 추출/검증하여 `$input.parameters` / `$params`로 제공 | 필수 |
+| WH-EP-05-2 | required 파라미터 누락 또는 타입 강제 변환 실패 시 `400 Bad Request`와 누락 필드 목록 반환 | 필수 |
+| WH-EP-06 | 요청 헤더 정보를 메타데이터로 전달 (`headers`, `method`, `query`) | 권장 |
+| WH-EP-07 | 비활성 트리거로의 요청은 `410 Gone` 응답 반환 | 필수 |
+
+#### 3.2 인증 및 보안
+
+| ID | 요구사항 | 우선순위 |
+|----|----------|----------|
+| WH-SC-01 | 인증 없음(공개) 옵션 | 필수 |
+| WH-SC-02 | HMAC 서명 검증 (Secret 기반) | 필수 |
+| WH-SC-03 | Bearer Token 검증 | 필수 |
+| WH-SC-04 | 인증 실패 시 `401 Unauthorized` 응답 | 필수 |
+| WH-SC-05 | Rate limiting (트리거당 분당 최대 요청 수) | 권장 |
+
+#### 3.3 응답 및 피드백
+
+| ID | 요구사항 | 우선순위 |
+|----|----------|----------|
+| WH-RS-01 | 요청 수신 즉시 `202 Accepted` + `executionId` 반환 (비

... (truncated due to prompt size limit) ...

---

### 파일 15: review/consistency/2026/05/16/10_01_06/_prompts/cross_spec.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 16: review/consistency/2026/05/16/10_01_06/_prompts/naming_collision.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 17: review/consistency/2026/05/16/10_01_06/_prompts/plan_coherence.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 18: review/consistency/2026/05/16/10_01_06/_prompts/rationale_continuity.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 19: review/consistency/2026/05/16/10_01_06/_retry_state.json
- 변경 유형: Review
- 언어: json

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/10_01_06/_retry_state.json b/review/consistency/2026/05/16/10_01_06/_retry_state.json
new file mode 100644
index 00000000..b081a5ae
--- /dev/null
+++ b/review/consistency/2026/05/16/10_01_06/_retry_state.json
@@ -0,0 +1,52 @@
+{
+  "session_dir": "/Volumes/project/private/clemvion/.claude/worktrees/ai-thread-source-mark-7c4f2a/review/consistency/2026/05/16/10_01_06",
+  "summary_subagent_type": "consistency-summary",
+  "summary_output_file": "/Volumes/project/private/clemvion/.claude/worktrees/ai-thread-source-mark-7c4f2a/review/consistency/2026/05/16/10_01_06/SUMMARY.md",
+  "subagent_invocations": [
+    {
+      "name": "cross_spec",
+      "subagent_type": "cross-spec-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/ai-thread-source-mark-7c4f2a/review/consistency/2026/05/16/10_01_06/_prompts/cross_spec.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/ai-thread-source-mark-7c4f2a/review/consistency/2026/05/16/10_01_06/cross_spec/review.md"
+    },
+    {
+      "name": "rationale_continuity",
+      "subagent_type": "rationale-continuity-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/ai-thread-source-mark-7c4f2a/review/consistency/2026/05/16/10_01_06/_prompts/rationale_continuity.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/ai-thread-source-mark-7c4f2a/review/consistency/2026/05/16/10_01_06/rationale_continuity/review.md"
+    },
+    {
+      "name": "convention_compliance",
+      "subagent_type": "convention-compliance-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/ai-thread-source-mark-7c4f2a/review/consistency/2026/05/16/10_01_06/_prompts/convention_compliance.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/ai-thread-source-mark-7c4f2a/review/consistency/2026/05/16/10_01_06/convention_compliance/review.md"
+    },
+    {
+      "name": "plan_coherence",
+      "subagent_type": "plan-coherence-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/ai-thread-source-mark-7c4f2a/review/consistency/2026/05/16/10_01_06/_prompts/plan_coherence.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/ai-thread-source-mark-7c4f2a/review/consistency/2026/05/16/10_01_06/plan_coherence/review.md"
+    },
+    {
+      "name": "naming_collision",
+      "subagent_type": "naming-collision-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/ai-thread-source-mark-7c4f2a/review/consistency/2026/05/16/10_01_06/_prompts/naming_collision.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/ai-thread-source-mark-7c4f2a/review/consistency/2026/05/16/10_01_06/naming_collision/review.md"
+    }
+  ],
+  "agents_pending": [],
+  "agents_success": ["cross_spec", "rationale_continuity", "convention_compliance", "plan_coherence", "naming_collision"],
+  "agents_fatal": [],
+  "agent_history": {
+    "cross_spec": [{"status": "success", "issues": 9}],
+    "rationale_continuity": [{"status": "success", "issues": 7}],
+    "convention_compliance": [{"status": "success", "issues": 10}],
+    "plan_coherence": [{"status": "success", "issues": 7}],
+    "naming_collision": [{"status": "success", "issues": 6}]
+  },
+  "rate_limit_episodes": 0,
+  "total_wait_sec": 0,
+  "wake_history": [],
+  "last_reset_hint_sec": null,
+  "loop_mode": false
+}
\ No newline at end of file

```

---

### 파일 20: review/consistency/2026/05/16/10_01_06/convention_compliance/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/10_01_06/convention_compliance/review.md b/review/consistency/2026/05/16/10_01_06/convention_compliance/review.md
new file mode 100644
index 00000000..1a1c93de
--- /dev/null
+++ b/review/consistency/2026/05/16/10_01_06/convention_compliance/review.md
@@ -0,0 +1,105 @@
+# 정식 규약 준수 검토 — spec/5-system/
+
+검토 일시: 2026-05-16  
+검토 범위: `spec/5-system/` (1-auth.md, 10-graph-rag.md, 11-mcp-client.md, 12-webhook.md, 13-replay-rerun.md) 및 `spec/conventions/` (cafe24-api-metadata.md, conversation-thread.md, migrations.md)  
+검토 모드: --impl-prep (구현 착수 전)
+
+---
+
+## 발견사항
+
+### 문서 구조 규약
+
+- **[WARNING]** `spec/5-system/1-auth.md` — Rationale 섹션 존재하나 Overview 섹션 누락
+  - target 위치: `spec/5-system/1-auth.md` 전체 (파일 최상단 ~ §1)
+  - 위반 규약: CLAUDE.md "프로젝트 스펙 문서" — 권장 3섹션 구성 (Overview / 본문 / Rationale). 단일 spec 파일 영역은 본문 상단에 직접 `## Overview` 섹션을 둔다
+  - 상세: 파일은 제목 줄 아래 바로 `## 1. 인증 (Authentication)` 본문으로 시작하며 `## Overview` 또는 `## Overview (제품 정의)` 섹션이 없다. `## Rationale` 는 존재한다. 단일 파일 영역에서 Overview 누락은 구조 규약 위반이다.
+  - 제안: 파일 상단(관련 문서 링크 아래)에 `## Overview (제품 정의)` 섹션을 추가하고, 인증 시스템의 사용자 가치·목표를 간략히 기술한다.
+
+- **[WARNING]** `spec/5-system/11-mcp-client.md` — Overview 섹션 없이 `## 1. 개요` 로 시작
+  - target 위치: `spec/5-system/11-mcp-client.md` 파일 최상단 ~ §1
+  - 위반 규약: CLAUDE.md "프로젝트 스펙 문서" 권장 3섹션 구성
+  - 상세: `## Overview (제품 정의)` 섹션 없이 바로 `## 1. 개요`(기술 개요)로 시작한다. `## Rationale` 섹션도 보이지 않는다. 단일 파일 영역임에도 권장 3섹션 구성이 모두 빠져있다.
+  - 제안: 파일 상단에 `## Overview (제품 정의)` 섹션(사용자 가치·목표)을 추가하고, 파일 말미에 `## Rationale` 섹션을 추가한다.
+
+- **[WARNING]** `spec/5-system/12-webhook.md` — Overview 와 본문 섹션이 혼재 (번호 충돌)
+  - target 위치: `spec/5-system/12-webhook.md` §Overview 안의 "### 1. 개요" ~ 본문 "## 1. 아키텍처 개요"
+  - 위반 규약: CLAUDE.md 권장 3섹션 구성 및 `## Overview (제품 정의)` 패턴
+  - 상세: 파일은 `## Overview (제품 정의)` 섹션 안에 `### 1. 개요` / `### 2. 사용 시나리오` / `### 3. 요구사항` / `### 4. 비기능 요구사항` 소절을 두고, 그 뒤에 다시 `## 1. 아키텍처 개요` / `## 2. 데이터 모델` ... 로 이어진다. Overview 섹션이 PRD 내용을 모두 담아 지나치게 길어지고, `## Rationale` 섹션이 없다. 형식 자체가 혼재되어 있다.
+  - 제안: Overview 섹션은 사용자 가치·목적 정도로 압축하고, 요구사항·비기능 요구사항은 본문 섹션으로 옮기거나 별도 `_product-overview.md` 로 분리를 검토한다. 파일 말미에 `## Rationale` 섹션을 추가한다.
+
+- **[INFO]** `spec/5-system/10-graph-rag.md` — `## Overview (제품 정의)` 내부에 `### 1.` / `### 2.` 소절이 있고 본문 `## 1. 개요`와 번호가 중복됨
+  - target 위치: `spec/5-system/10-graph-rag.md` Overview 섹션
+  - 위반 규약: CLAUDE.md 권장 3섹션 구성 (형식 일관성)
+  - 상세: Overview 섹션 안에서 `### 1. 목표` / `### 2. 범위` / `### 3. 요구사항` 등 상세 소절이 있고, 이후 본문이 다시 `## 1. 개요`로 시작해 번호 체계가 중복된다. 단일 파일 규모가 커진 경우 `_product-overview.md` 분리를 권장하는 패턴과 맞지 않는다. 분리 구조이긴 하지만 단일 파일 안에서 혼재되어 있다.
+  - 제안: Overview 와 본문 번호 충돌을 해소하거나 (Overview 소절 번호 제거), 콘텐츠 규모가 충분히 크면 `_product-overview.md` 로 분리하는 방향을 검토한다.
+
+### 금지 항목 — 옛 prd/ 경로 참조
+
+- **[CRITICAL]** `spec/5-system/10-graph-rag.md` — Rationale 섹션이 `memory/` 폴더를 직접 참조
+  - target 위치: `spec/5-system/10-graph-rag.md` Rationale 섹션 — "Graph RAG 도메인 모델 결정의 배경·근거. memory/ 에 남아있던 작업 메모를 inline 흡수한 것이며..." / "_원본 메모: memory/graph-rag-decisions.md_"
+  - 위반 규약: CLAUDE.md "폴더 구조" — "옛 `prd/`, `memory/`, `user_memo/` 폴더는 docs-consolidation(2026-05-12)으로 모두 `spec/` 또는 `plan/complete/archive/`로 흡수되었다. 신규 문서를 옛 경로 컨벤션으로 만들지 않는다."
+  - 상세: Rationale 섹션 본문이 `memory/graph-rag-decisions.md` 를 원본 참조로 명시하고, 도입부에서 "memory/ 에 남아있던 작업 메모" 라고 경로를 그대로 노출한다. docs-consolidation 이후 `memory/` 경로는 더 이상 유효하지 않으며 구현자·독자가 이 경로로 접근하면 문서를 찾을 수 없다.
+  - 제안: Rationale 내 `memory/` 경로 참조를 실제 이관 경로(`plan/complete/archive/from-memory/`) 로 수정하거나, 이미 inline 흡수되었다면 원본 경로 참조 문장 자체를 삭제한다.
+
+- **[CRITICAL]** `spec/5-system/10-graph-rag.md` Rationale 내 — `prd/9-graph-rag.md` 등 옛 `prd/` 경로 참조
+  - target 위치: `spec/5-system/10-graph-rag.md` Rationale §"영향 범위" 항목
+  - 위반 규약: CLAUDE.md "폴더 구조" — `prd/` 폴더는 docs-consolidation 으로 `spec/` 에 흡수됨, 신규 문서를 옛 경로 컨벤션으로 만들지 않음
+  - 상세: Rationale 내 "영향 범위" 표에서 `prd/9-graph-rag.md`, `prd/0-overview.md`, `prd/4-integration.md`, `prd/6-phase2-ai.md` 를 여전히 영향 범위 파일로 나열하고 있다. 이 파일들은 이미 `spec/` 으로 이관되었거나 폐기되었으므로 이 경로를 spec 문서 안에 남겨두면 구현자가 잘못된 경로로 안내된다.
+  - 제안: 해당 참조를 이관 후 실제 `spec/` 경로로 갱신하거나, 역사적 메모로만 남긴다면 명시적으로 "현재 경로가 아님(역사적 기록)" 이라는 주석을 부기한다.
+
+- **[WARNING]** `spec/5-system/12-webhook.md` — Overview 내 `prd/8-webhook.md` 출처 표기가 미완
+  - target 위치: `spec/5-system/12-webhook.md` Overview 섹션 첫 번째 blockquote
+  - 위반 규약: CLAUDE.md "폴더 구조" 금지 항목
+  - 상세: `> 출처: prd/8-webhook.md — docs-consolidation(2026-05-12)으로 본 문서에 흡수.` 라고만 기재되어 있고 내용은 흡수되어 있는 상태다. `prd/` 참조 자체는 "흡수했다"는 이력 표기이므로 critical 은 아니나, 문서 구조 내에서 옛 경로가 그대로 노출된다. 10-graph-rag.md 의 동일 패턴과 일관성 측면에서 경고 수준으로 분류한다.
+  - 제안: "출처: `prd/8-webhook.md` — docs-consolidation(2026-05-12)으로 본 문서에 흡수" 표기는 이력 정보로 허용 가능하지만, 독자가 이 경로를 실제 파일로 오해하지 않도록 "현재 해당 파일은 존재하지 않음" 문구나 별도 스타일(취소선 등)을 덧붙이는 것이 좋다.
+
+### API 엔드포인트 명명 규약
+
+- **[WARNING]** `spec/5-system/1-auth.md` §5 — API 엔드포인트에 `/api/v1/` prefix 없이 `/api/` 만 사용
+  - target 위치: `spec/5-system/1-auth.md` §5 API 엔드포인트 표 전체
+  - 위반 규약: `spec/5-system/13-replay-rerun.md` §8 및 `spec/5-system/10-graph-rag.md` §5 에서는 `/api/v1/` prefix 를 사용하는 반면, 1-auth.md 는 `/api/auth/...`, `/api/audit-logs`, `/api/invitations/:token` 형태로 버전 prefix 가 없음 — 동일 시스템 내 endpoint 명명 일관성 결여
+  - 상세: `spec/5-system/13-replay-rerun.md` 는 `POST /api/v1/executions/:executionId/re-run` 형태를 사용하고, `spec/5-system/10-graph-rag.md` 도 `GET /api/knowledge-bases/...` (버전 없음)을 사용해 영역 간 일관성이 없다. 1-auth.md 는 `/api/` 직접 사용.
+  - 제안: API versioning 정책을 `spec/5-system/2-api-convention.md` 에서 명확히 정의하고 모든 spec 문서가 같은 패턴을 따르도록 통일한다. 현재 일부 spec 은 `/api/v1/`, 일부는 `/api/` 를 사용하는 혼재 상태이다.
+
+- **[WARNING]** `spec/5-system/1-auth.md` §1.5.2, §1.5.3 — 흐름 내 API 경로가 버전 prefix 불일치
+  - target 위치: `spec/5-system/1-auth.md` §1.5.2 흐름 1단계: `POST /api/v1/workspaces/:id/invitations`, 3단계: `GET /api/invitations/:token`, §1.5.3 3단계: `POST /api/workspaces/invitations/accept`
+  - 위반 규약: 동일 문서 내에서 `/api/v1/` 과 `/api/` 가 혼재
+  - 상세: §1.5.2 1단계는 `POST /api/v1/workspaces/:id/invitations` (버전 있음), 3단계는 `GET /api/invitations/:token` (버전 없음). §1.5.3 3단계는 `POST /api/workspaces/invitations/accept` (버전 없음). 같은 문서 내에서도 버전 prefix 가 일관되지 않다.
+  - 제안: 동일 문서 내 endpoint 버전 prefix 를 통일한다. API versioning 정책 확정 후 일괄 정정.
+
+### 출력 포맷 규약
+
+- **[INFO]** `spec/5-system/13-replay-rerun.md` §7.2 — dry-run mock 출력 객체의 필드명이 node-output conventions 와 교차 검증 필요
+  - target 위치: `spec/5-system/13-replay-rerun.md` §7.2 dry-run 동작 명세
+  - 위반 규약: `spec/conventions/node-output.md` Principle 0 — NodeHandlerOutput 5필드 불변 / Principle 1 — `output` 은 비즈니스 결과물만
+  - 상세: dry-run 시 mock 출력으로 `{ "_dryRun": true, "skippedReason": "...", "wouldHaveCalled": { ... } }` 를 `output` 에 담도록 명세한다. `_dryRun` 이라는 실행 메타 정보가 `output` 에 포함되어 있어 Principle 1 (output 은 비즈니스 결과물만)과 충돌 가능성이 있다. 다만 dry-run 에서 실제 외부 호출 없이 mock 을 반환하는 것이 의도이므로 완전한 위반이라 보기 어려우나, `meta.dryRun: true` 에도 동일 정보를 두고 `output` 의 `_dryRun` 은 선택적으로 취급하는 방향이 Principles 에 더 정합하다.
+  - 제안: `meta.dryRun: true` 를 primary 마커로 정의하고, `output._dryRun: true` 는 UI/하위 노드에서의 self-contained 감지용 보조 마커로 명시하는 문장을 추가한다. 또는 node-output conventions 에 dry-run 모드 예외 항목을 명시한다.
+
+- **[INFO]** `spec/5-system/12-webhook.md` §5.2 — 400 에러 응답 형태가 `spec/conventions` 또는 `spec/5-system/3-error-handling.md` 규약과 교차 검증 필요
+  - target 위치: `spec/5-system/12-webhook.md` §5.2 400 응답 형식
+  - 위반 규약: `spec/conventions/node-output.md` Principle 3.2 `output.error` 표준 형태 및 `spec/5-system/3-error-handling.md` (API 에러 shape)
+  - 상세: §5.2 는 `{ statusCode, message, errors: [{ field, reason }] }` 형태를 정의하고 있다. 이 형태가 `spec/5-system/3-error-handling.md` 의 표준 에러 envelope 와 일치하는지 확인이 필요하다. spec 이 직접 에러 shape 를 정의한 경우 표준 규약과의 정합을 명시적으로 언급해야 한다.
+  - 제안: `spec/5-system/12-webhook.md` §5.2 에 "본 응답 형태는 `spec/5-system/3-error-handling.md` §X 의 표준 에러 envelope 를 따른다" 또는 편차가 있다면 그 이유를 명시한다.
+
+### API 문서 규약 (Swagger/DTO)
+
+- **[INFO]** `spec/conventions/swagger.md` — DTO 명명 패턴이 target spec 문서와 직접 교차 검증 어려움 (spec 문서는 구현 파일이 아님)
+  - target 위치: 해당 없음 (spec 문서 레벨에서 DTO 실제 명명은 구현 파일에 존재)
+  - 위반 규약: `spec/conventions/swagger.md` §1 DTO 패턴
+  - 상세: Swagger/DTO 규약은 `backend/` 구현 코드에 적용되며 spec 문서 자체에는 직접 위반이 발생하지 않는다. spec 문서 내 API 명세 표(1-auth.md §5, 13-replay-rerun.md §8.1 등)는 DTO 명을 노출하지 않아 이 규약의 점검 대상이 되지 않는다.
+  - 제안: 구현 착수 시 각 API endpoint 의 Request/Response DTO 가 `spec/conventions/swagger.md` 패턴(JSDoc, `@ApiProperty`, `@ApiTags`)을 따르도록 개발자에게 명시적으로 안내한다.
+
+---
+
+## 요약
+
+`spec/5-system/` 영역의 target 문서들은 전반적으로 spec 본문의 기술 명세 수준은 높으나, **정식 규약에서 명시한 권장 3섹션 구성(Overview / 본문 / Rationale)** 을 일부 파일에서 지키지 않고 있다. 가장 심각한 문제는 `spec/5-system/10-graph-rag.md` 의 Rationale 섹션이 **docs-consolidation 으로 폐기된 `memory/` 및 `prd/` 경로를 직접 참조**한다는 점으로, 이는 CLAUDE.md 금지 항목을 직접 위반한다. API endpoint 버전 prefix(`/api/v1/` vs `/api/`) 혼재 문제는 동일 문서 내에서도 관찰되어, 구현 착수 전 `spec/5-system/2-api-convention.md` 에서 versioning 정책을 명확히 결정하고 모든 관련 spec 에 반영해야 한다. `spec/conventions/` 파일들(cafe24-api-metadata, conversation-thread, migrations)은 자체 규약으로서 구조 면에서 특별한 위반이 없다.
+
+---
+
+## 위험도
+
+**MEDIUM**
+
+CRITICAL 항목 2건(옛 `memory/`·`prd/` 경로 직접 참조)이 구현 방향에는 직접 영향을 주지 않지만 구현자가 잘못된 경로로 안내될 수 있고, API 버전 prefix 혼재는 구현 시 인터페이스 불일치로 이어질 수 있다. 문서 구조 위반(Overview 누락)은 구현 가드를 깨지는 않으나 규약 drift 의 누적 위험이 있다.

```

---

### 파일 21: review/consistency/2026/05/16/10_01_06/cross_spec/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/10_01_06/cross_spec/review.md b/review/consistency/2026/05/16/10_01_06/cross_spec/review.md
new file mode 100644
index 00000000..a8ebd6c3
--- /dev/null
+++ b/review/consistency/2026/05/16/10_01_06/cross_spec/review.md
@@ -0,0 +1,91 @@
+# Cross-Spec 일관성 검토 결과
+
+**검토 모드**: 구현 착수 전 검토 (--impl-prep, scope=spec/5-system/)
+**검토 대상**: `spec/5-system/` 전체 (1-auth, 10-graph-rag, 11-mcp-client, 12-webhook, 13-replay-rerun)
+**보조 코퍼스**: spec/0-overview.md, spec/1-data-model.md, spec/2-navigation/0-dashboard.md, spec/2-navigation/1-workflow-list.md, spec/2-navigation/10-auth-flow.md
+
+---
+
+### 발견사항
+
+---
+
+- **[CRITICAL]** `spec/5-system/13-replay-rerun.md` — `re_run_of` / `chain_id` 컬럼이 `spec/1-data-model.md §2.13` 에 누락
+  - target 위치: `spec/5-system/13-replay-rerun.md §9.1 "executions 테이블 컬럼 추가"`
+  - 충돌 대상: `spec/1-data-model.md §2.13 Execution` 엔티티 정의
+  - 상세: re-run spec 은 `re_run_of UUID NULL` (self-FK) 과 `chain_id UUID NOT NULL` 두 컬럼을 executions 테이블에 추가한다고 명세하고, 인덱스 `(re_run_of)` / `(chain_id, started_at)` 도 정의한다. 그러나 `spec/1-data-model.md §2.13` 의 Execution 필드 목록에는 이 두 컬럼이 존재하지 않으며, `§3 인덱스 전략` 테이블에도 해당 인덱스가 없다. 구현 팀이 데이터 모델 spec 만 보면 두 컬럼을 인지할 수 없고, 데이터 모델과 re-run spec 간 단일 진실이 깨진다.
+  - 제안: `spec/1-data-model.md §2.13` Execution 필드 목록에 `re_run_of` / `chain_id` 를 추가하고, §3 인덱스 전략 테이블에도 두 인덱스를 추가한다. re-run spec 은 현재 표현("본 spec 은 컬럼·인덱스·불변식만 명세한다")을 유지하고 데이터 모델 spec 을 primary SoT 로 삼도록 cross-reference 를 명시한다.
+
+---
+
+- **[CRITICAL]** `spec/5-system/10-graph-rag.md §2.2` — `graph_extraction_status` Enum 값 목록이 `spec/1-data-model.md §2.12` 와 불일치
+  - target 위치: `spec/5-system/10-graph-rag.md §2.2 Document 추가 컬럼` — 열거값을 `pending / processing / completed / error` 로 기술
+  - 충돌 대상: `spec/1-data-model.md §2.12 Document` — `graph_extraction_status` 를 `pending / processing / completed / error / failed` 5종으로 정의
+  - 상세: 데이터 모델 spec 은 `failed` 상태("최대 재시도 소진 또는 비재시도성 오류로 인한 최종 실패")를 명시하지만, graph-rag spec §2.2 의 설명에는 `failed` 가 없다. §3.2 GraphExtractionProcessor 의 처리 단계와 §7 에러 처리에서는 `failed` 상태를 사용함에도 §2.2 의 Enum 목록과 일치하지 않는다. 구현 시 `failed` 상태의 존재 여부가 혼동될 수 있고, 상태 머신이 영역마다 다르게 기술된 상태다.
+  - 제안: `spec/5-system/10-graph-rag.md §2.2` 의 `graph_extraction_status` 값 목록에 `failed` 를 추가하고, 각 상태의 의미(embedding_status 와 동일)를 명시한다. `spec/1-data-model.md §2.12` 가 정의하는 5종이 canonical 값이다.
+
+---
+
+- **[WARNING]** `spec/5-system/13-replay-rerun.md §8` — API 경로에 `/api/v1/` 버전 접두사 사용, 다른 spec 과 불일치
+  - target 위치: `spec/5-system/13-replay-rerun.md §8.1 POST /api/v1/executions/:executionId/re-run`, `§8.2 GET /api/v1/executions/:executionId/chain`
+  - 충돌 대상: `spec/5-system/1-auth.md §5` (예: `POST /api/auth/register`), `spec/5-system/12-webhook.md §3.1` (`POST /api/hooks/:endpointPath`), `spec/5-system/10-graph-rag.md §5` (`POST /api/knowledge-bases/:kbId/...`), `spec/2-navigation/1-workflow-list.md §3` (`GET /api/workflows`) 등 전체 API spec
+  - 상세: 다른 모든 spec 의 API 경로는 `/api/` prefix 만 사용하며 버전 세그먼트가 없다. re-run spec 만 `/api/v1/` 을 명시해 API 규약 불일치가 발생한다. 구현 시 라우터에서 충돌하거나, 실제로 v1 prefix 가 없으면 경로 자체가 동작하지 않는다.
+  - 제안: `spec/5-system/2-api-convention.md` 에 버전 접두사 정책(예: 버전 없음 또는 `/api/v1/` 통일)이 있다면 그에 맞춰 re-run spec 또는 다른 spec 전체를 일치시킨다. 없다면 re-run spec 의 경로를 `/api/executions/:executionId/re-run` 으로 수정해 기존 spec 패턴에 맞춘다.
+
+---
+
+- **[WARNING]** `spec/5-system/1-auth.md §5` — 초대 수락 엔드포인트 경로 모호성 (`/api/workspaces/invitations/accept` vs. `/api/v1/workspaces/:id/invitations/accept`)
+  - target 위치: `spec/5-system/1-auth.md §1.5.3` 흐름 step 3 (`POST /api/workspaces/invitations/accept { token }`) 및 §5 엔드포인트 목록 ("초대 발송·재발송·취소·수락 엔드포인트는 사용자 프로필 spec §6.1 에 정의")
+  - 충돌 대상: `spec/5-system/1-auth.md §1.5.2` 흐름 step 1 (`POST /api/v1/workspaces/:id/invitations { email, role }` — `/api/v1/` 버전 세그먼트 포함 + `:id` 경로 파라미터)
+  - 상세: §1.5.2 의 초대 발송 엔드포인트는 `/api/v1/workspaces/:id/invitations` 형식이지만, §1.5.3 의 수락 엔드포인트는 `/api/workspaces/invitations/accept` (워크스페이스 ID 없음, v1 없음)로 형식이 다르다. 사용자 프로필 spec 에 위임한다고만 명시하고 경로가 일치하는지 불확실하다.
+  - 제안: auth spec §1.5.2 와 §1.5.3 의 엔드포인트 경로 형식을 동일하게 통일한다. 또한 사용자 프로필 spec §6.1 에서 정의한 경로와 대조해 일치시키고, auth spec 에 "cross-reference 확인" 주석을 추가한다.
+
+---
+
+- **[WARNING]** `spec/5-system/13-replay-rerun.md §RR-PL-06` — Re-run 권한 규칙이 `spec/5-system/1-auth.md §3.2` RBAC 매트릭스에 미반영
+  - target 위치: `spec/5-system/13-replay-rerun.md §RR-PL-06` — "원본 실행 시작자 + Editor+ (Owner/Admin/Editor) 조합" 규칙
+  - 충돌 대상: `spec/5-system/1-auth.md §3.2 리소스별 권한 매트릭스` — Workflow 실행 행: `Owner/Admin/Editor: ✅, Viewer: —`
+  - 상세: RBAC 매트릭스의 "Workflow 실행" 항목은 Editor+ 권한이면 실행 가능하다고 명시한다. Re-run 은 실행의 파생 동작임에도 매트릭스에 별도 행이 없고, "원본 실행 시작자 여부"라는 추가 조건이 숨어 있다. 즉, Admin 이 다른 사람의 실행을 Re-run 할 수 있는지가 매트릭스만 보면 알 수 없다(re-run spec 은 "Owner/Admin 이면 OK"라고 하지만 매트릭스에는 없음).
+  - 제안: `spec/5-system/1-auth.md §3.2` 권한 매트릭스에 "Workflow Re-run" 행을 추가하거나, Workflow 실행 항목의 비고에 RR-PL-06 을 참조 표시한다.
+
+---
+
+- **[WARNING]** `spec/5-system/11-mcp-client.md §8.3` — 존재하지 않는 "§14 핸들러 실행 세멘틱" 참조
+  - target 위치: `spec/5-system/11-mcp-client.md §8.3 IntegrationUsageLog` — "[Spec 통합 §14 핸들러 실행 세멘틱](../2-navigation/4-integration.md#14-연관-동작)"
+  - 충돌 대상: `spec/2-navigation/4-integration.md` — 제공된 코퍼스에서 §14 섹션이 확인되지 않음
+  - 상세: MCP 클라이언트 spec 이 integration spec 의 §14 를 참조하지만, integration spec 에 §14 섹션("핸들러 실행 세멘틱")이 존재하는지 코퍼스에서 확인할 수 없다. 앵커(`#14-연관-동작`)가 실제로 없다면 dead-link 이며, 구현 팀이 usage 로그 작성 정책을 파악할 수 없다.
+  - 제안: `spec/2-navigation/4-integration.md` 에 §14(또는 해당 섹션)가 실제로 존재하는지 확인하고, 없다면 mcp-client spec 의 참조를 올바른 앵커로 수정하거나 mcp-client spec 안에 usage 로그 정책을 직접 기술한다.
+
+---
+
+- **[INFO]** `spec/5-system/13-replay-rerun.md §9.2` — `dryRun` 필드가 API 응답에 포함되지만 DB 컬럼으로는 v2+ 로 유예
+  - target 위치: `spec/5-system/13-replay-rerun.md §8.1 Response 201` — `dryRun: boolean` 필드 포함, §9.2 — "Execution 단위 dry_run 컬럼은 v2+ 검토"
+  - 충돌 대상: `spec/1-data-model.md §2.13 Execution` — `dry_run` 컬럼 없음
+  - 상세: API 응답은 `dryRun: boolean` 을 반환하지만 DB 에는 해당 컬럼이 없다. v1 에서는 NodeExecution._dryRun 을 집계해 도출한다는 방침이나, 집계 로직이 spec 에 기술되지 않아 구현 시 해석이 달라질 수 있다. 중요성은 낮지만 "API 응답에 있는 값의 SoT 가 불명확"하다는 점에서 동기화 필요.
+  - 제안: re-run spec §8.1 응답 섹션에 `dryRun` 필드의 도출 방법("NodeExecution.outputData._dryRun 이 하나라도 true 이면 true")을 한 줄 주석으로 명시한다.
+
+---
+
+- **[INFO]** `spec/5-system/10-graph-rag.md §6` — WebSocket 채널 명칭 `kb:{documentId}` 가 직관적이지 않음
+  - target 위치: `spec/5-system/10-graph-rag.md §6 WebSocket 이벤트` — "채널은 `kb:{documentId}` (spec/5-system/8-embedding-pipeline.md §8 과 동일)"
+  - 충돌 대상: 채널 이름이 KB ID 가 아닌 Document ID 를 키로 사용함. 명칭이 `kb:` prefix 이지만 실제로 documentId 를 구독 단위로 한다.
+  - 상세: 직접적인 명세 충돌은 아니지만, `kb:{documentId}` 라는 채널 이름은 혼동을 유발한다 — `kb:` prefix 가 KB 단위를 암시하지만 실제 값은 Document ID 다. embedding-pipeline spec 과 동일 채널을 사용한다고 명시되어 있으므로 일관성 자체는 있지만, 프론트엔드 구현 시 잘못된 구독 대상(KB ID)을 사용할 위험이 있다.
+  - 제안: `spec/5-system/10-graph-rag.md §6` 에 채널 이름 옆에 `{documentId}` 임을 강조하는 주석을 추가한다. 장기적으로는 embedding-pipeline spec 과 함께 채널 네이밍 규약을 `spec/conventions/` 에 정식화하는 것을 권장한다.
+
+---
+
+- **[INFO]** `spec/5-system/1-auth.md §4.1` — AuditLog 조회 권한 표기 불일치
+  - target 위치: `spec/5-system/1-auth.md §4.2` — "관리자(Admin+)만 조회 가능"
+  - 충돌 대상: `spec/5-system/1-auth.md §3.2 RBAC 매트릭스` — `Audit Log: R(Owner), R(Admin), —(Editor), —(Viewer)`
+  - 상세: §4.2 의 "Admin+" 표현은 매트릭스와 실질적으로 동일하지만, 매트릭스는 `R` 로 표기하고 §4.2 는 `관리자(Admin+)만` 이라 명시해 표기 방식이 다르다. Owner 가 포함되는지 여부가 모호하게 읽힐 수 있다(Owner 는 암묵적으로 Admin 이상이지만 "Admin+" 표현이 Owner 를 포함하는지 오해 여지 있음).
+  - 제안: §4.2 표현을 "Owner 또는 Admin (§3.2 Audit Log 권한 행 참조)"으로 수정해 명시적으로 일치시킨다.
+
+---
+
+### 요약
+
+`spec/5-system/` 의 4개 주요 문서를 교차 검토한 결과, **CRITICAL 2건, WARNING 4건, INFO 3건** 총 9개 이슈가 발견되었다. 가장 시급한 문제는 `spec/5-system/13-replay-rerun.md` 가 추가하는 `re_run_of` / `chain_id` 컬럼이 `spec/1-data-model.md §2.13` 에 반영되지 않아 데이터 모델의 단일 진실이 깨진 것과, `spec/5-system/10-graph-rag.md §2.2` 의 `graph_extraction_status` Enum 목록에서 `failed` 상태가 누락된 것이다. 두 CRITICAL 은 구현 팀이 각 spec 을 독립적으로 읽을 경우 서로 다른 스키마를 구현하거나 상태 머신이 불완전하게 구현될 직접적 위험을 내포한다. WARNING 4건은 API 버전 prefix 불통일, 초대 엔드포인트 경로 모호성, Re-run 권한의 RBAC 매트릭스 미반영, dead-link 참조로 구성되어 있으며, 구현 착수 전에 정책 결정 또는 spec 동기화가 필요하다.
+
+### 위험도
+
+HIGH

```

---

### 파일 22: review/consistency/2026/05/16/10_01_06/meta.json
- 변경 유형: Review
- 언어: json

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/10_01_06/meta.json b/review/consistency/2026/05/16/10_01_06/meta.json
new file mode 100644
index 00000000..05ec2eff
--- /dev/null
+++ b/review/consistency/2026/05/16/10_01_06/meta.json
@@ -0,0 +1,12 @@
+{
+  "timestamp": "2026-05-16T10:01:06.265651",
+  "mode": "구현 착수 전 검토 (--impl-prep, scope=spec/5-system/)",
+  "target_path": "spec/5-system/",
+  "checkers": [
+    "cross_spec",
+    "rationale_continuity",
+    "convention_compliance",
+    "plan_coherence",
+    "naming_collision"
+  ]
+}
\ No newline at end of file

```

---

### 파일 23: review/consistency/2026/05/16/10_01_06/naming_collision/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/10_01_06/naming_collision/review.md b/review/consistency/2026/05/16/10_01_06/naming_collision/review.md
new file mode 100644
index 00000000..bd70a299
--- /dev/null
+++ b/review/consistency/2026/05/16/10_01_06/naming_collision/review.md
@@ -0,0 +1,80 @@
+# 신규 식별자 충돌 검토 — spec/5-system/
+
+검토 모드: 구현 착수 전 (--impl-prep, scope=spec/5-system/)
+
+---
+
+## 발견사항
+
+### [INFO] `graph_extraction_status` Enum 값 집합 불일치
+
+- **target 신규 식별자**: `spec/5-system/10-graph-rag.md §2.2` — `graph_extraction_status` Enum: `pending / processing / completed / error / failed`
+- **기존 사용처**: `spec/1-data-model.md §2.12` — `Document.graph_extraction_status` Enum: `pending / processing / completed / error / failed` 와 주석 "의미는 `embedding_status` 와 동일"
+- **상세**: target의 `§2.2` 에 명시된 값 집합(`pending / processing / completed / error`) 은 `failed` 를 빠뜨리고 있다. 실제 데이터 모델(`spec/1-data-model.md §2.12`)에는 `failed` 가 포함되어 5개 상태로 기술되어 있고, target 문서의 다른 섹션(§7 에러 처리, §3.2 GraphExtractionProcessor)에서도 `graph_extraction_status = 'failed'` 를 언급한다. target §2.2 의 나열이 단순 탈락인지, 실제 다른 설계인지 불명확하다.
+- **제안**: `spec/5-system/10-graph-rag.md §2.2` 의 Enum 나열을 `pending / processing / completed / error / failed` 로 통일한다.
+
+---
+
+### [INFO] WebSocket 채널 표기의 모호한 키 참조
+
+- **target 신규 식별자**: `spec/5-system/10-graph-rag.md §6` — "채널은 `kb:{documentId}`"
+- **기존 사용처**: `spec/5-system/8-embedding-pipeline.md §8` (참조만 나타나고 코퍼스에 본문이 없음)
+- **상세**: target이 참조하는 채널 명칭 `kb:{documentId}` 가 기존 embedding-pipeline spec에서도 동일하게 사용하는지 코퍼스에서 직접 검증할 수 없다. target 내에서 "embedding-pipeline §8 과 동일" 이라고 자체 언급하지만, 임베딩 이벤트는 `document:{documentId}` 패턴을 사용하는 경우가 많아 실제로 `kb:` prefix 인지 `document:` prefix 인지 혼동 가능성이 있다.
+- **제안**: `spec/5-system/8-embedding-pipeline.md §8` 의 채널 정의를 직접 참조해 `kb:{documentId}` vs `document:{documentId}` 를 명시적으로 비교하고, 두 spec 에서 동일 표기임을 확인·기재한다.
+
+---
+
+### [INFO] `re_run_of` / `chain_id` 컬럼이 `spec/1-data-model.md §2.13` 에 미반영
+
+- **target 신규 식별자**: `spec/5-system/13-replay-rerun.md §9.1` — `executions` 테이블에 `re_run_of UUID NULL`, `chain_id UUID NOT NULL` 컬럼 추가
+- **기존 사용처**: `spec/1-data-model.md §2.13 Execution` — 해당 컬럼이 목록에 없음
+- **상세**: target 이 정의하는 두 신규 컬럼은 기존 데이터 모델 spec 에 등재되지 않은 식별자다. 충돌이 아니라 누락이지만, 단일 진실 원칙상 `spec/1-data-model.md` 가 Execution 의 최종 컬럼 목록 SoT 이므로, 구현 착수 전에 두 문서의 일치가 필요하다. 미반영 상태로 구현이 시작되면 spec 과 코드 사이의 drift 가 발생한다.
+- **제안**: `spec/1-data-model.md §2.13 Execution` 에 `re_run_of` / `chain_id` 컬럼을 추가하고, `spec/5-system/13-replay-rerun.md §9.1` 과 동기화한다.
+
+---
+
+### [INFO] Re-run API 경로 버전 prefix 불일치
+
+- **target 신규 식별자**: `spec/5-system/13-replay-rerun.md §8` — `POST /api/v1/executions/:executionId/re-run`, `GET /api/v1/executions/:executionId/chain`
+- **기존 사용처**: `spec/5-system/1-auth.md §5` — `POST /api/auth/register`, `GET /api/audit-logs` 등 `/api/` prefix (v1 없음). `spec/5-system/12-webhook.md §3.1` — `POST /api/hooks/:endpointPath` (v1 없음). `spec/5-system/10-graph-rag.md §5` — `POST /api/knowledge-bases/:kbId/...` (v1 없음)
+- **상세**: 프로젝트 내 대부분의 API 경로가 `/api/<resource>` 형식을 사용하는 반면, Re-run spec 은 `/api/v1/executions/...` 처럼 `v1` prefix 를 명시적으로 삽입하고 있다. 동일 `executions` 리소스를 다루는 기존 경로가 `v1` 없이 정의되어 있다면 라우팅 혼선 및 클라이언트 구현 오류 위험이 있다.
+- **제안**: `spec/5-system/2-api-convention.md` 에서 API 버전 prefix 정책을 확인하고, 기존 경로와 통일한다. 기존이 `/api/` 무버전이라면 Re-run spec 도 `/api/executions/:executionId/re-run` 으로 수정하거나, 전체 경로에 v1 적용을 공식 결정해 spec 에 반영한다.
+
+---
+
+### [INFO] `RERUN_PERMISSION_DENIED` 에러 코드 — 기존 `forbidden` 코드와 충돌 가능성
+
+- **target 신규 식별자**: `spec/5-system/13-replay-rerun.md §8.1` — 에러 코드 `RERUN_PERMISSION_DENIED`
+- **기존 사용처**: `spec/5-system/1-auth.md §1.5.4` — 권한 부족 상황에 대해 `forbidden` (소문자) 를 사용. `spec/5-system/3-error-handling.md` 는 코퍼스에서 본문이 직접 제공되지 않았으나 본 리소스 코드는 `UPPER_SNAKE_CASE`.
+- **상세**: target 이 도입하는 `RERUN_PERMISSION_DENIED` 는 UPPER_SNAKE_CASE 로 명명됐다. 기존 invitation spec 은 동일 권한 거부 상황에서 `forbidden` (lowercase) 를 사용한다. 두 코드가 같은 `error.code` 필드에 들어가는 값이라면 스타일이 불일치해 클라이언트 처리 패턴이 갈라진다.
+- **제안**: `spec/5-system/3-error-handling.md` 의 에러 코드 컨벤션(UPPER_SNAKE_CASE vs lowercase)을 확인하고, `1-auth.md` 의 `forbidden` 또는 `13-replay-rerun.md` 의 `RERUN_PERMISSION_DENIED` 중 하나를 규약에 맞게 통일한다.
+
+---
+
+### [INFO] `MCP_ALLOW_INSECURE_URL` 환경변수 — 기존 ENV 목록과의 검증 필요
+
+- **target 신규 식별자**: `spec/5-system/11-mcp-client.md §3.2` — 환경변수 `MCP_ALLOW_INSECURE_URL` (기본 `false`)
+- **기존 사용처**: `spec/0-overview.md §2.7` — `S3_BUCKET` 환경변수 언급. `backend/.env.example` (코퍼스에 미포함).
+- **상세**: target 이 도입하는 `MCP_ALLOW_INSECURE_URL` 과 `MCP_MAX_CONCURRENT_CONNECTIONS` (§4.3) 는 코퍼스에 포함된 다른 ENV 목록에서 충돌을 발견하지 못했다. 그러나 `backend/.env.example` 이 코퍼스에 없어 실제 기존 코드와의 중복을 직접 검증할 수 없다.
+- **제안**: `backend/.env.example` 을 대조해 `MCP_ALLOW_INSECURE_URL`, `MCP_MAX_CONCURRENT_CONNECTIONS` 가 기존 ENV 와 겹치지 않음을 구현 착수 전에 확인한다.
+
+---
+
+### [INFO] `document:graph_error` 이벤트 의미 변경 — 소비자 코드 호환성 위험
+
+- **target 신규 식별자**: `spec/5-system/10-graph-rag.md §6` — `document:graph_error` 의 의미가 2026-05-11 변경됨 ("영구 실패 신호로 사용하지 말 것", 대신 `document:graph_failed` 를 사용)
+- **기존 사용처**: 변경 이전 소비자가 `document:graph_error` 를 최종 실패로 처리했을 가능성 (frontend 코드, graph-rag 관련 UI 컴포넌트)
+- **상세**: spec 자체에 "(의미 변경, 2026-05-11)" 주석이 있어 기존 동작과 현재 정의가 다르다는 것이 명시되어 있다. 이는 식별자 충돌보다는 breaking change 이지만, 기존 클라이언트 코드가 이미 이 이벤트를 영구 실패 신호로 처리하고 있다면 재정의된 spec 에 맞춰 전면 업데이트가 필요하다.
+- **제안**: frontend의 `document:graph_error` 핸들러를 검색(`frontend/`)해 여전히 이를 최종 실패로 처리하는 코드가 있는지 확인하고, 있다면 `document:graph_failed` 로 마이그레이션한다.
+
+---
+
+## 요약
+
+`spec/5-system/` 의 6개 파일(1-auth, 10-graph-rag, 11-mcp-client, 12-webhook, 13-replay-rerun)과 보조 코퍼스(`spec/0-overview.md`, `spec/1-data-model.md`) 를 대조한 결과, **동일 식별자가 다른 의미로 이미 사용 중인 직접 충돌(CRITICAL)은 발견되지 않았다.** 신규 도입된 엔티티명(Entity, Relation, ChunkEntity), API 경로, 이벤트명, 환경변수, 에러 코드는 모두 기존 식별자와 다른 이름을 사용하고 있다. 다만 INFO 등급의 개선 사항 6건이 발견되었다: (1) target §2.2의 `graph_extraction_status` Enum 값 탈락, (2) WebSocket 채널 prefix 검증 필요, (3) Execution 데이터 모델의 신규 컬럼 미반영, (4) Re-run API의 `/api/v1/` 버전 prefix 불일치, (5) 에러 코드 케이싱 불일치, (6) 신규 ENV 변수의 기존 코드 대조 필요. 이들은 구현 착수 전에 정비하면 코드-spec 간 drift 와 클라이언트 혼선을 예방할 수 있다.
+
+---
+
+## 위험도
+
+LOW

```

---

### 파일 24: review/consistency/2026/05/16/10_01_06/plan_coherence/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/10_01_06/plan_coherence/review.md b/review/consistency/2026/05/16/10_01_06/plan_coherence/review.md
new file mode 100644
index 00000000..196224c5
--- /dev/null
+++ b/review/consistency/2026/05/16/10_01_06/plan_coherence/review.md
@@ -0,0 +1,63 @@
+# Plan 정합성 Review — spec/5-system/ 구현 착수 전 검토
+
+검토 모드: `--impl-prep`  
+대상 영역: `spec/5-system/` (1-auth.md, 10-graph-rag.md, 11-mcp-client.md, 12-webhook.md, 13-replay-rerun.md)  
+검토 일시: 2026-05-16
+
+---
+
+## 발견사항
+
+- **[WARNING]** `replay-rerun.md` — PR2(구현) 착수 전 선행 조건 미합의
+  - target 위치: `spec/5-system/13-replay-rerun.md` 전체 (§8 API, §9 데이터 모델, §7.2 dry-run 명세)
+  - 관련 plan: `plan/in-progress/replay-rerun.md` §3 백엔드 구현 ~ §5 검증 (모두 미체크 `[ ]`)
+  - 상세: spec/5-system/13-replay-rerun.md 는 PR1(Spec)이 완료됐고 spec 자체는 확정됐으나, plan 에서 PR2(구현) 의 모든 백엔드·프론트엔드·e2e 항목이 아직 미완(`[ ]`)이다. "PR1 완료, 머지 대기 / 본 plan 은 PR2 구현 머지 후 closure" 표기가 있어, 해당 plan 이 여전히 in-progress 상태다. impl-prep 관점에서 spec 자체는 확정됐으므로 구현 착수 자체는 허용되지만, plan 에 선행 의존으로 명시된 `plan/complete/engine-raw-config-exposure.md` 가 완료 폴더에 있음을 확인해야 한다 (plan 본문에서 이미 ✅ 표기). 문제 없음 — 그러나 PR1 머지 상태(브랜치 머지 여부) 가 plan 에 명확히 표기되지 않아 구현 팀이 잘못된 base 를 잡을 위험이 있다.
+  - 제안: `plan/in-progress/replay-rerun.md` 에 "PR1 머지 완료 날짜 / base commit" 한 줄을 추가해 PR2 착수 기점을 명확히 한다.
+
+- **[WARNING]** `2fa-webauthn.md` — `spec/5-system/1-auth.md` 미결 결정과의 충돌 가능성
+  - target 위치: `spec/5-system/1-auth.md` §1.4 2FA (TOTP 정의), §2 세션 관리
+  - 관련 plan: `plan/in-progress/2fa-webauthn.md` §1 디자인 결정 (모든 항목 `[ ]` 미합의)
+  - 상세: 1-auth.md 는 현재 2FA 를 TOTP 전용으로 정의하고 있다. `2fa-webauthn.md` plan 은 WebAuthn 추가를 목표로 하지만 §1 디자인 결정(라이브러리 선택, rpID/origin, 사용자 흐름, 다중 등록, 복구 코드 정책)이 모두 미합의 상태다. 만약 impl-prep 범위가 1-auth.md 의 현 TOTP 구현(이미 ✅)을 포함하는 구현을 건드린다면, WebAuthn plan 의 미결 결정(복구 코드 통합 vs. 분리 등)이 구현 범위와 교차될 수 있다. 현재 1-auth.md 에 WebAuthn 흐름이 명시되지 않은 상태에서 auth 관련 구현을 확장하면 spec 와 코드가 불일치할 위험이 있다.
+  - 제안: impl-prep 범위가 1-auth.md 기반 auth 구현을 포함한다면, `2fa-webauthn.md` 의 디자인 결정이 완료되기 전까지 auth 모듈의 2FA 관련 확장은 직렬화(defer)할 것을 plan 에 명시한다. 현재 TOTP 이외의 auth 구현이 아닐 경우 영향 없음.
+
+- **[WARNING]** `ai-agent-tool-connection-rewrite.md` — `spec/5-system/` 와 간접 교차 (MCP client 관련)
+  - target 위치: `spec/5-system/11-mcp-client.md` 전체 (MCP 도구 연결 명세)
+  - 관련 plan: `plan/in-progress/ai-agent-tool-connection-rewrite.md` §1 디자인 결정 (모든 항목 `[ ]` 미합의), §4 백엔드 구현 (`[ ]`)
+  - 상세: 11-mcp-client.md 는 `mcp_*` 도구의 완전한 명세를 포함하며 현재 spec 으로 확정되어 있다. `ai-agent-tool-connection-rewrite.md` plan 은 일반 도구(`tool_*`) 재설계를 대상으로 하지만, 미결 결정인 "도구 호출 시 실행 컨텍스트 (sub-execution vs inline)" 와 "ND-AG-21 우선순위 규칙" 은 MCP 도구 실행 흐름(§7 실행 흐름 요약)과 연계된다. plan 에서 "MCP 도구는 영향 없다"고 명시하지만, 일반 도구의 실행 컨텍스트 결정에 따라 MCP 도구의 `AgentToolProvider` 인터페이스 계층에 영향이 생길 수 있다. 또한 `conversation-thread.md` 과의 순서 의존성이 plan 에 명시돼 있으나 (`conversation-thread-e509c5` worktree merge 이후 착수) 해당 plan 의 spec 갱신이 이미 완료됐으므로 이 블로커는 해소됐다.
+  - 제안: 11-mcp-client.md 를 impl-prep 범위로 구현 착수할 경우, `ai-agent-tool-connection-rewrite.md` 의 ND-AG-21 우선순위 결정이 MCP 도구 실행 흐름과 충돌하지 않는지 plan 에 확인 항목을 추가한다.
+
+- **[INFO]** `spec/5-system/1-auth.md` §1.1 Rate Limit 미결 값
+  - target 위치: `spec/5-system/1-auth.md` §1.5.1 토큰 정책 표 — `Rate Limit: 워크스페이스·invited_by 단위 분당 N회 (구현 시 결정)` 
+  - 관련 plan: 해당 항목을 명시적으로 추적하는 in-progress plan 없음
+  - 상세: 초대 Rate Limit 의 구체 값("N회")이 spec 에서 "구현 시 결정"으로 열려 있다. 이는 미해결 결정이므로 구현 시 개발자가 임의로 값을 결정할 경우 spec 와 코드 불일치가 생긴다.
+  - 제안: 구현 착수 전 Rate Limit N 값을 결정해 spec 에 확정하거나, 구현 담당자가 결정 후 spec 을 갱신하도록 plan 에 후속 항목으로 추가한다.
+
+- **[INFO]** `replay-rerun.md` — worktree 명 미기재
+  - target 위치: `plan/in-progress/replay-rerun.md` frontmatter
+  - 관련 plan: `plan/in-progress/replay-rerun.md` (worktree 필드 없음)
+  - 상세: plan 문서에 frontmatter 의 `worktree` 필드가 없다. PR1 작업이 완료돼 어느 worktree 인지 알 수 없어, PR2 구현 worktree 를 신규 생성 시 혼선이 생길 수 있다.
+  - 제안: PR2 착수 시 frontmatter 에 신규 worktree 이름을 추가한다.
+
+- **[INFO]** `spec/5-system/10-graph-rag.md` — 후속 항목(P2+) 추적 plan 부재
+  - target 위치: `spec/5-system/10-graph-rag.md` §6 Phase Plan — P2+ (community detection / Neo4j 등) ❌
+  - 관련 plan: P2+ 후속 항목을 추적하는 in-progress plan 없음 (§3.7 "미결/후속 검토" 로만 spec 에 기록됨)
+  - 상세: Graph RAG P0~P2 는 구현 완료됐으나 P2+ 항목(community detection, Neo4j 검토, KB 단위 prompt override 등)이 spec 에 "별도 PRD 로 검토" 로만 표기되고 plan 으로 추적되지 않는다. 구현 착수 시 이 항목들에 대한 작업이 우발적으로 포함될 위험은 낮으나, 중기 로드맵 추적 공백이다.
+  - 제안: 명시적 추적이 필요하다면 별도 plan 을 생성하거나, 0-unimplemented-overview.md 에 항목을 추가해 가시성을 확보한다.
+
+- **[INFO]** `spec/5-system/12-webhook.md` §8 비밀 키 암호화 미결
+  - target 위치: `spec/5-system/12-webhook.md` §8 보안 고려사항 — `config.secret`, `config.bearerToken`은 DB에 저장 (향후 암호화 적용)
+  - 관련 plan: 암호화 적용을 추적하는 in-progress plan 없음
+  - 상세: Webhook 비밀 키의 DB 암호화가 "향후 적용" 으로 열려 있다. 구현 착수 시 암호화 없이 평문 저장이 코드에 고착될 위험이 있다.
+  - 제안: 구현 착수 전 암호화 정책을 결정해 spec 에 확정하거나, 별도 plan 항목으로 추적한다.
+
+---
+
+## 요약
+
+`spec/5-system/` 의 5개 파일 전반은 spec 으로서 잘 확정돼 있고, 진행 중인 plan 과의 직접적인 CRITICAL 충돌(미해결 결정 우회, 동시 worktree 경합)은 발견되지 않았다. 주요 위험은 두 가지 WARNING 으로 좁혀진다: (1) `replay-rerun.md` PR2 구현의 PR1 머지 기점이 plan 에 명시되지 않아 구현 팀이 잘못된 base 에서 시작할 수 있고, (2) `2fa-webauthn.md` 의 미결 디자인 결정이 `1-auth.md` 구현 범위 설정에 모호함을 남긴다. `ai-agent-tool-connection-rewrite.md` 의 미결 사항은 MCP client spec 과 간접적으로 연계되어 WARNING 수준으로 추적이 필요하다. INFO 항목들(Rate Limit N값 미결, Webhook 암호화 미결, P2+ 로드맵 추적 공백, replay-rerun frontmatter 누락)은 즉각 차단 사안은 아니나 구현 단계에서 임의 결정이 발생할 수 있어 사전 합의를 권장한다.
+
+---
+
+## 위험도
+
+MEDIUM

```

---

### 파일 25: review/consistency/2026/05/16/10_01_06/rationale_continuity/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/10_01_06/rationale_continuity/review.md b/review/consistency/2026/05/16/10_01_06/rationale_continuity/review.md
new file mode 100644
index 00000000..91db2adc
--- /dev/null
+++ b/review/consistency/2026/05/16/10_01_06/rationale_continuity/review.md
@@ -0,0 +1,81 @@
+# Rationale 연속성 검토 결과
+
+검토 범위: `spec/5-system/` (impl-prep 모드)
+대상 파일: `1-auth.md`, `10-graph-rag.md`, `11-mcp-client.md`, `12-webhook.md`, `13-replay-rerun.md`
+
+---
+
+## 발견사항
+
+### 1. INFO — 초대 토큰 저장 방식: Rationale 에 해시 저장 기각 기록 부재
+
+- **target 위치**: `spec/5-system/1-auth.md` §1.5.1 "저장 형태" 행 — "DB 에는 토큰 자체를 저장 (`WorkspaceInvitation.token`, UNIQUE)"
+- **과거 결정 출처**: `spec/5-system/1-auth.md` 의 `## Rationale` §1.5.A~C 는 (a) 이메일 일치 강제, (b) 시스템 SMTP 사용, (c) 7일 만료 세 가지 결정만 기록한다. 토큰을 해시 없이 평문(raw value)으로 DB에 저장하기로 한 결정에 대한 Rationale 항목이 없다.
+- **상세**: 보안 민감 토큰(비밀번호 재설정, 초대 등)의 저장 방식은 "평문 저장 vs bcrypt/SHA-256 해시 저장" 두 대안이 공식적으로 검토되는 설계 결정점이다. 사양은 평문 저장을 선택했지만, 그 이유(예: URL lookup 성능, 토큰 길이가 48바이트 random 이라 노출 리스크를 허용 수준으로 판단)가 Rationale 에 기재되어 있지 않다. 나중에 "왜 bcrypt 를 쓰지 않았느냐"는 질문이 나올 때 대답을 추적할 수 없다.
+- **제안**: `## Rationale §1.5.D — 초대 토큰 평문 저장` 항목 추가. 예: "48바이트 cryptographically random token 은 URL 직접 lookup 으로 O(1) 조회가 가능하고, bcrypt 해시 대비 DB UNIQUE 제약 적용이 간단하다. 토큰 자체의 엔트로피(384-bit)가 충분해 DB 침해 시의 추가 위협이 제한적이라고 판단했다."
+
+---
+
+### 2. INFO — Graph RAG: KB 모드 사후 변경 기각 이유가 두 곳에 분산 기재
+
+- **target 위치**: `spec/5-system/10-graph-rag.md` §2.1 KnowledgeBase 추가 컬럼 표 (`rag_mode` 행, "생성 시에만 결정, 사후 변경 불가"), §4 기술 결정 사항 표 ("KB 모드 선택: 사후 변경의 마이그레이션·UX 부담이 점진 도입의 가치를 넘어섬"), `## Rationale §6 사후 결정 (2026-05-02)` 표 항목 6
+- **과거 결정 출처**: `spec/5-system/10-graph-rag.md § Rationale` "사후 변경 불가" 근거
+- **상세**: 기각 근거("vector→graph 전환 시 기존 chunk 에 대한 추출 트리거 필요, 마이그레이션 무거움; graph→vector 는 entity/relation 폐기; 새 KB 가 더 단순")가 기술 결정 표(§4), Overview §2.2 비목표 표, Rationale 메모 세 곳에 분산 서술되어 있다. 결정 자체는 일관되나 근거를 한 곳에서 찾기 어렵다.
+- **제안**: `## Rationale` 의 해당 메모 항목(결정 근거 요약 표)에 §4 및 §2.2 를 교차 참조(cross-reference) 링크로 통합. 또는 §4 표의 "근거" 컬럼에서 Rationale 섹션으로 앵커 링크를 추가.
+
+---
+
+### 3. INFO — MCP Client: stdio 미지원 사유가 Rationale 섹션이 아닌 본문에만 기재
+
+- **target 위치**: `spec/5-system/11-mcp-client.md` §2.2 "stdio 미지원 사유" (본문 섹션으로 기재됨)
+- **과거 결정 출처**: `spec/5-system/11-mcp-client.md` 에는 `## Rationale` 섹션 자체가 없음
+- **상세**: stdio 미지원("멀티테넌트 SaaS 프로세스·보안 격리 부담, 임의 명령 실행 권한 노출 위험, 워크스페이스 공용 모델 부정합")은 명시적으로 기각된 대안이다. 이 내용이 §2.2 에 본문 설명으로 들어가 있는데, spec 컨벤션("폐기된 대안은 `## Rationale` 에 기록")에 따르면 Rationale 섹션에 있어야 한다. 본 spec 에 Rationale 섹션 자체가 부재하다.
+- **제안**: `spec/5-system/11-mcp-client.md` 끝에 `## Rationale` 섹션을 신설하고, (a) stdio 미지원 근거, (b) WebSocket transport 미포함 근거, (c) 도구 평탄화(세 capability 를 단일 LLM tool call 인터페이스로 통합) 선택 이유 를 이전. §2.2 본문은 "사유는 §Rationale 참조" 한 줄로 대체하거나 그대로 두되 Rationale 에 병행 기록.
+
+---
+
+### 4. INFO — Webhook: 향후 암호화 계획이 "TODO" 형태로 남아 있음
+
+- **target 위치**: `spec/5-system/12-webhook.md` §8 보안 고려사항 표 — "비밀 키 저장: `config.secret`, `config.bearerToken`은 DB에 저장 (향후 암호화 적용)"
+- **과거 결정 출처**: 없음 — Webhook spec 에는 `## Rationale` 섹션이 없다
+- **상세**: `(향후 암호화 적용)` 표현은 현재 평문 저장을 인식하고 있지만 암호화 미구현 이유나 적용 시점이 기록되어 있지 않다. Integration credentials 의 AES-256-GCM 암호화 정책(`spec/5-system/11-mcp-client.md §3.2`, `spec/2-navigation/4-integration.md §5.6`)과 Webhook secret 의 미암호화 사이에 불일치가 존재하며, 그 결정 근거가 없다. 구현자가 "Integration 은 암호화하는데 Webhook secret 은 왜 안 하지?" 라고 물을 때 답이 없는 상태.
+- **제안**: `## Rationale` 섹션 신설(또는 §8 에 각주) 로 "현재 평문 저장 이유 + 향후 암호화 전환 조건"을 기록. 또는 Integration credentials 암호화 정책을 Webhook 에도 즉시 확장하고 spec 에 반영.
+
+---
+
+### 5. WARNING — Re-run: `dry_run` 컬럼 추가를 "v2+ 검토"로 연기했으나 Rationale 미기재
+
+- **target 위치**: `spec/5-system/13-replay-rerun.md` §9.2 "NodeExecution dry-run 표기" — "부모 Execution row 자체에 `dry_run: boolean` 컬럼을 추가하는 것은 v2+ 에서 검토 — v1 은 NodeExecution 마다의 `_dryRun` 만으로도 충분하고..."
+- **과거 결정 출처**: `spec/5-system/13-replay-rerun.md` §5 "결정 사항 (사용자 확정)" 표, §Rationale(본문 참조 언급만 있고 Rationale 섹션이 존재하나 payload 에서 잘려 확인 불가)
+- **상세**: `dry_run: boolean` 컬럼을 Execution 수준에 두지 않고 NodeExecution 의 `outputData._dryRun` 로 대신하는 결정은, Execution 단위 필터링(`WHERE dry_run = true`)이 불가능해지는 trade-off 를 수반한다. "v1 은 NodeExecution 집계로 도출 가능"이라는 근거가 §9.2 본문에 인라인으로만 적혀 있다. 이 결정이 spec 의 `## Rationale` 에 항목으로 올라가 있지 않으면, 향후 구현자가 "편의를 위해" 컬럼을 슬며시 추가할 때 이전 번복 근거를 찾을 수 없다.
+- **제안**: `## Rationale` 에 "E3-variant — dry_run Execution 컬럼 v2+ 연기" 항목 추가. 내용: (a) v1 에서 단일 NodeExecution `_dryRun` 키로 식별하는 이유, (b) Execution 수준 컬럼 부재로 인한 쿼리 제약, (c) v2 에서 도입 조건. 이 결정이 이미 `§5 결정 사항` 표에 부분적으로 나타나 있다면 해당 표에서 Rationale 섹션으로 앵커 참조.
+
+---
+
+### 6. WARNING — Re-run: Multi-turn 입력 자동 재사용(D2) 기각 이유가 Rationale 섹션에 부재
+
+- **target 위치**: `spec/5-system/13-replay-rerun.md` §RR-PL-04 끝 "이유는 §Rationale 참조 — multi-turn 입력 재사용 (D2) 은 별도 plan 으로 분리"
+- **과거 결정 출처**: `spec/5-system/13-replay-rerun.md` `## Rationale` (payload 크기 제한으로 전체 내용 미확인)
+- **상세**: §RR-PL-04 본문이 "이유는 §Rationale 참조"로 명시 위임하고 있다. 해당 Rationale 내용이 실제로 존재하고 D2 기각 이유(예: 사용자 응답 재현의 결정론적 보장 어려움, UX 오해 위험 등)를 설명하는지 확인이 필요하다. 만약 Rationale 섹션이 D2 를 언급하지 않는다면, 본문의 위임이 dangling reference 가 된다.
+- **제안**: `spec/5-system/13-replay-rerun.md` 의 `## Rationale` 섹션에서 D2 항목("multi-turn 입력 자동 재사용 기각 이유")을 직접 확인한다. 없으면 "D2 기각 — multi-turn 사용자 응답 자동 재사용의 UX 결정론 문제" 항목을 명시 추가. 있으면 §RR-PL-04 에 해당 Rationale 앵커(`#d2-multi-turn-자동-재사용-기각` 등) 링크를 추가.
+
+---
+
+### 7. WARNING — MCP Client: Internal Bridge 서비스 확장 화이트리스트 정책이 Rationale 없이 암묵적으로 결정됨
+
+- **target 위치**: `spec/5-system/11-mcp-client.md` §3.1 표 "Internal Bridge 적용 service_type (현재): cafe24"
+- **과거 결정 출처**: MCP spec 에 Rationale 섹션 없음. 연관 spec `spec/4-nodes/4-integration/4-cafe24.md` 및 `spec/conventions/cafe24-api-metadata.md`
+- **상세**: "현재 `cafe24` — 향후 first-party 통합(예: Shopify, Naver Smartstore)이 같은 패턴 사용 가능"이라고 기재되어 있으나, Internal Bridge 대상이 되는 service_type 을 누가 어떤 기준으로 결정하는지(whitelist 관리 주체, 기준, 승인 프로세스)가 정의되어 있지 않다. §12 확장 포인트에 "서비스 타입 화이트리스트(§3.1)에 추가"라고만 되어 있어, 구현자가 임의로 whitelist 를 확장할 수 있는 구조다.
+- **제안**: Rationale 섹션에 "Internal Bridge 대상 service_type 결정 원칙" 항목 추가. 예: "first-party Integration 이 (a) 외부 HTTP fetch 없이 in-process 로 완결 가능하고, (b) 동일 Integration 이 workflow 노드와 AI Agent 양쪽에서 사용되며, (c) 도구 목록이 정적 메타데이터 테이블로 관리 가능한 경우 Internal Bridge 채택". 기준이 명문화되지 않으면 Shopify/Naver Smartstore 추가 시 동일한 아키텍처 논쟁이 반복된다.
+
+---
+
+## 요약
+
+`spec/5-system/` 의 다섯 문서를 Rationale 연속성 관점에서 검토한 결과, **명시적으로 기각된 대안의 재도입이나 합의된 invariant 의 직접 위반은 발견되지 않았다**. 주요 설계 결정(KB 모드 불변, 이메일 일치 강제, 시스템 SMTP 단일 채널, stdio 미지원, Re-run 전체 워크플로 단위 등)은 모두 기존 Rationale 에 부합하거나 새 Rationale 를 동반하고 있다. 다만 **MCP Client spec 의 Rationale 섹션 부재**, **Webhook spec 의 Rationale 섹션 부재**, **Re-run spec 의 일부 결정이 Rationale 에 명시적으로 기록되지 않았거나 dangling reference 상태**, **Webhook secret 의 미암호화 결정이 Integration 암호화 정책과의 불일치를 설명하는 Rationale 가 없는 것** 이 WARNING 수준의 공백으로 남아 있다. INFO 항목들은 문서 정합성·추적 가능성 개선 제안으로, 구현 차단 수준은 아니다.
+
+---
+
+## 위험도
+
+LOW

```
