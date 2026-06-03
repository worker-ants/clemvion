import { describe, it, expect, vi } from "vitest";
import {
  parseHistoryMessages,
  messagesToConversationItems,
  mergeOrphanToolItems,
  groupToolCallItems,
  threadTurnsToConversationItems,
  toolStatusMapFromItems,
  stripInlineMarkers,
  inferInteractionTypeFromData,
  type ConversationTurn,
} from "../conversation-utils";
import type { ConversationItem } from "@/lib/stores/execution-store";

function tool(
  toolCallId: string,
  overrides: Partial<ConversationItem> = {},
): ConversationItem {
  return {
    type: "tool",
    content: "kb_search",
    turnIndex: 1,
    toolCallId,
    toolStatus: "success",
    ...overrides,
  } as ConversationItem;
}

function assistant(
  overrides: Partial<ConversationItem> = {},
): ConversationItem {
  return {
    type: "assistant",
    content: "답변",
    turnIndex: 1,
    ...overrides,
  } as ConversationItem;
}

function user(content: string, turnIndex = 1): ConversationItem {
  return { type: "user", content, turnIndex } as ConversationItem;
}

describe("messagesToConversationItems", () => {
  it("converts user → assistant(no tools) sequence into 2 items with shared turnIndex", () => {
    const items = messagesToConversationItems([
      { role: "user", content: "안녕" },
      { role: "assistant", content: "안녕하세요!" },
    ]);

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ type: "user", content: "안녕", turnIndex: 1 });
    expect(items[1]).toMatchObject({
      type: "assistant",
      content: "안녕하세요!",
      turnIndex: 1,
    });
  });

  it("emits a tool item between assistant(toolCalls) and assistant(final)", () => {
    const items = messagesToConversationItems([
      { role: "user", content: "오늘 날씨" },
      {
        role: "assistant",
        content: "",
        toolCalls: [
          { id: "call_1", name: "get_weather", arguments: '{"city":"Seoul"}' },
        ],
      },
      {
        role: "tool",
        toolCallId: "call_1",
        content: '{"temperature":12.3,"humidity":69}',
      },
      { role: "assistant", content: "기온 12.3도, 습도 69%입니다." },
    ]);

    expect(items.map((i) => i.type)).toEqual([
      "user",
      "assistant",
      "tool",
      "assistant",
    ]);
    expect(items[2]).toMatchObject({
      type: "tool",
      content: "get_weather",
      turnIndex: 1,
      toolCallId: "call_1",
    });
    expect(items[2].toolArgs).toEqual({ city: "Seoul" });
    expect(items[2].toolResult).toEqual({ temperature: 12.3, humidity: 69 });
    expect(items[1].assistantToolCalls).toEqual([
      { name: "get_weather", arguments: '{"city":"Seoul"}' },
    ]);
  });

  it("falls back to '(unknown tool)' when toolCallId has no matching assistant call", () => {
    const items = messagesToConversationItems([
      { role: "user", content: "x" },
      {
        role: "tool",
        toolCallId: "orphan",
        content: '{"ok":true}',
      },
    ]);

    expect(items[1]).toMatchObject({
      type: "tool",
      content: "(unknown tool)",
      toolCallId: "orphan",
    });
  });

  it("skips system messages", () => {
    const items = messagesToConversationItems([
      { role: "system", content: "you are helpful" },
      { role: "user", content: "hi" },
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].type).toBe("user");
  });

  it("populates toolStatus / durationMs / error from toolStatusByCallId", () => {
    const items = messagesToConversationItems(
      [
        { role: "user", content: "x" },
        {
          role: "assistant",
          content: "",
          toolCalls: [
            { id: "call_a", name: "kb_search", arguments: "{}" },
            { id: "call_b", name: "mcp_x", arguments: "{}" },
          ],
        },
        { role: "tool", toolCallId: "call_a", content: '{"ok":1}' },
        {
          role: "tool",
          toolCallId: "call_b",
          content: '{"error":"timeout"}',
        },
        { role: "assistant", content: "done" },
      ],
      {
        toolStatusByCallId: new Map([
          ["call_a", { status: "success", durationMs: 12 }],
          [
            "call_b",
            { status: "error", durationMs: 30000, error: "timeout" },
          ],
        ]),
      },
    );

    const tools = items.filter((i) => i.type === "tool");
    expect(tools[0]).toMatchObject({
      toolStatus: "success",
      durationMs: 12,
    });
    expect(tools[1]).toMatchObject({
      toolStatus: "error",
      durationMs: 30000,
      error: "timeout",
    });
  });

  it("matches assistant LLM call debug payloads via debugByTurn", () => {
    const items = messagesToConversationItems(
      [
        { role: "user", content: "x" },
        {
          role: "assistant",
          content: "",
          toolCalls: [{ id: "c1", name: "kb", arguments: "{}" }],
        },
        { role: "tool", toolCallId: "c1", content: "{}" },
        { role: "assistant", content: "final" },
      ],
      {
        debugByTurn: new Map([
          [
            1,
            {
              turnIndex: 1,
              llmCalls: [
                {
                  requestPayload: { m: 1 },
                  responsePayload: {
                    model: "gpt-5",
                    usage: { inputTokens: 100, outputTokens: 50 },
                  },
                  durationMs: 100,
                },
                {
                  requestPayload: { m: 2 },
                  responsePayload: {
                    model: "gpt-5",
                    usage: { inputTokens: 120, outputTokens: 30 },
                  },
                  durationMs: 80,
                },
              ],
            },
          ],
        ]),
      },
    );

    const assistants = items.filter((i) => i.type === "assistant");
    expect(assistants[0].durationMs).toBe(100);
    expect(assistants[1].durationMs).toBe(80);
    expect(assistants[0].metadata?.inputTokens).toBe(100);
    expect(assistants[1].metadata?.outputTokens).toBe(30);
  });

  // spec/conventions/conversation-thread.md §9.12 — 요소별 절대 발생 시각.
  it("populates assistant timestamp from llmCalls[].startedAt (tool-only response included)", () => {
    const items = messagesToConversationItems(
      [
        { role: "user", content: "x" },
        {
          // tool-call 만 있는 (content blank) 어시스턴트 응답도 발생 시각을 가진다.
          role: "assistant",
          content: "",
          toolCalls: [{ id: "c1", name: "kb", arguments: "{}" }],
        },
        { role: "tool", toolCallId: "c1", content: "{}" },
        { role: "assistant", content: "final" },
      ],
      {
        debugByTurn: new Map([
          [
            1,
            {
              turnIndex: 1,
              llmCalls: [
                {
                  requestPayload: {},
                  responsePayload: {},
                  durationMs: 100,
                  startedAt: "2026-05-10T06:42:01.500Z",
                  finishedAt: "2026-05-10T06:42:01.600Z",
                },
                {
                  requestPayload: {},
                  responsePayload: {},
                  durationMs: 80,
                  startedAt: "2026-05-10T06:42:02.000Z",
                  finishedAt: "2026-05-10T06:42:02.080Z",
                },
              ],
            },
          ],
        ]),
      },
    );

    const assistants = items.filter((i) => i.type === "assistant");
    expect(assistants[0].timestamp).toBe("2026-05-10T06:42:01.500Z");
    expect(assistants[1].timestamp).toBe("2026-05-10T06:42:02.000Z");
  });

  it("populates tool timestamp from toolStatusByCallId.startedAt (history rebuild)", () => {
    const items = messagesToConversationItems(
      [
        { role: "user", content: "x" },
        {
          role: "assistant",
          content: "",
          toolCalls: [{ id: "call_a", name: "kb_search", arguments: "{}" }],
        },
        { role: "tool", toolCallId: "call_a", content: '{"ok":1}' },
        { role: "assistant", content: "done" },
      ],
      {
        toolStatusByCallId: new Map([
          [
            "call_a",
            {
              status: "success",
              durationMs: 12,
              startedAt: "2026-05-10T06:42:03.100Z",
            },
          ],
        ]),
      },
    );

    const tool = items.find((i) => i.type === "tool");
    expect(tool?.timestamp).toBe("2026-05-10T06:42:03.100Z");
    expect(tool?.durationMs).toBe(12);
  });

  // §9.12 W2 회귀 — live carry-over map (toolStatusMapFromItems) 이 startedAt 을
  // 보존하지 않으면 ai_message 스냅샷 REPLACE 시 tool 발생 시각이 유실된다.
  it("preserves tool timestamp across ai_message REPLACE via toolStatusMapFromItems", () => {
    const prevItems: ConversationItem[] = [
      {
        type: "tool",
        content: "kb_search",
        turnIndex: 1,
        toolCallId: "call_a",
        toolStatus: "success",
        durationMs: 12,
        timestamp: "2026-05-10T06:42:03.100Z",
      },
    ];
    const carry = toolStatusMapFromItems(prevItems);
    expect(carry.get("call_a")?.startedAt).toBe("2026-05-10T06:42:03.100Z");

    // 스냅샷 REPLACE 재구성 시 carry-over map 을 통해 timestamp 가 복원돼야 한다.
    const rebuilt = messagesToConversationItems(
      [
        { role: "user", content: "x" },
        {
          role: "assistant",
          content: "",
          toolCalls: [{ id: "call_a", name: "kb_search", arguments: "{}" }],
        },
        { role: "tool", toolCallId: "call_a", content: '{"ok":1}' },
        { role: "assistant", content: "done" },
      ],
      { toolStatusByCallId: carry },
    );
    const tool = rebuilt.find((i) => i.type === "tool");
    expect(tool?.timestamp).toBe("2026-05-10T06:42:03.100Z");
  });

  it("turnIndex increments per user message across multiple turns", () => {
    const items = messagesToConversationItems([
      { role: "user", content: "q1" },
      { role: "assistant", content: "a1" },
      { role: "user", content: "q2" },
      { role: "assistant", content: "a2" },
    ]);

    expect(items.map((i) => i.turnIndex)).toEqual([1, 1, 2, 2]);
  });

  it("returns empty array when messages is empty", () => {
    expect(messagesToConversationItems([])).toEqual([]);
  });
});

describe("parseHistoryMessages — tool message integration", () => {
  it("parses tool messages from output.result.messages with meta.turnDebug.toolCalls", () => {
    const outputData = {
      config: { mode: "multi_turn" },
      output: {
        result: {
          messages: [
            { role: "user", content: "오늘 날씨" },
            {
              role: "assistant",
              content: "",
              toolCalls: [
                {
                  id: "call_1",
                  name: "get_weather",
                  arguments: '{"city":"Seoul"}',
                },
              ],
            },
            {
              role: "tool",
              toolCallId: "call_1",
              content: '{"temperature":12.3}',
            },
            { role: "assistant", content: "기온 12.3도입니다." },
          ],
          turnCount: 1,
        },
      },
      meta: {
        model: "gpt-5",
        turnDebug: [
          {
            turnIndex: 1,
            llmCalls: [
              { durationMs: 100 },
              { durationMs: 80 },
            ],
            toolCalls: [
              {
                toolCallId: "call_1",
                name: "get_weather",
                providerKey: "weather",
                status: "success",
                durationMs: 1240,
              },
            ],
          },
        ],
      },
    };

    const items = parseHistoryMessages(outputData);
    expect(items.map((i) => i.type)).toEqual([
      "user",
      "assistant",
      "tool",
      "assistant",
    ]);
    expect(items[2]).toMatchObject({
      type: "tool",
      content: "get_weather",
      toolStatus: "success",
      durationMs: 1240,
      toolCallId: "call_1",
    });
  });

  it("marks tool item as 'error' when turnDebug.toolCalls reports error status", () => {
    const outputData = {
      config: {},
      output: {
        result: {
          messages: [
            { role: "user", content: "x" },
            {
              role: "assistant",
              content: "",
              toolCalls: [{ id: "c1", name: "mcp_foo", arguments: "{}" }],
            },
            {
              role: "tool",
              toolCallId: "c1",
              content: '{"error":"timeout"}',
            },
            { role: "assistant", content: "sorry" },
          ],
        },
      },
      meta: {
        turnDebug: [
          {
            turnIndex: 1,
            llmCalls: [],
            toolCalls: [
              {
                toolCallId: "c1",
                name: "mcp_foo",
                status: "error",
                durationMs: 30000,
                error: "timeout",
              },
            ],
          },
        ],
      },
    };

    const items = parseHistoryMessages(outputData);
    const tool = items.find((i) => i.type === "tool");
    expect(tool).toMatchObject({
      toolStatus: "error",
      error: "timeout",
      durationMs: 30000,
    });
  });

  it("returns empty array when outputData has no messages", () => {
    expect(parseHistoryMessages({})).toEqual([]);
    expect(parseHistoryMessages(null)).toEqual([]);
  });

  it("preserves backward compatibility with legacy flat output.messages", () => {
    const outputData = {
      messages: [
        { role: "user", content: "hi" },
        { role: "assistant", content: "hello" },
      ],
    };
    const items = parseHistoryMessages(outputData);
    expect(items).toHaveLength(2);
  });
});

describe("messagesToConversationItems — source marker (spec/5-system/6-websocket-protocol.md §4.4.6)", () => {
  it("does not increment currentTurn for injected user messages so assistant turnIndex matches backend turnCount", () => {
    // Scenario from the regression that motivated source markers: a
    // ConversationThread injection from an upstream Template node prepends
    // `role: 'user'` with source='injected'. Without the marker, the
    // converter would assign turnIndex=2 to the assistant message even
    // though backend's turnCount=1 — breaking llmCalls lookup in the
    // debugging timeline.
    const debugByTurn = new Map([
      [
        1,
        {
          turnIndex: 1,
          llmCalls: [
            {
              requestPayload: { messages: ["..."] },
              responsePayload: { content: "응답", usage: {} },
              durationMs: 100,
            },
          ],
        },
      ],
    ]);
    const items = messagesToConversationItems(
      [
        {
          role: "user",
          content: "[from Template] clicked: 시작",
          source: "injected",
        },
        { role: "user", content: "어떤 상품이 있는지 알려줘", source: "live" },
        { role: "assistant", content: "죄송합니다...", source: "live" },
      ],
      { debugByTurn },
    );

    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({
      type: "user",
      content: "[from Template] clicked: 시작",
      turnIndex: 1,
      isInjected: true,
    });
    expect(items[1]).toMatchObject({
      type: "user",
      content: "어떤 상품이 있는지 알려줘",
      turnIndex: 1,
      isInjected: false,
    });
    expect(items[2]).toMatchObject({
      type: "assistant",
      content: "죄송합니다...",
      turnIndex: 1,
      isInjected: false,
    });
    // Debug payload now attaches because debugByTurn.get(1) matches.
    expect(items[2].requestPayload).toEqual({ messages: ["..."] });
    expect(items[2].responsePayload).toMatchObject({ content: "응답" });
  });

  it("treats missing source as 'live' for backward compatibility with older payloads", () => {
    const items = messagesToConversationItems([
      { role: "user", content: "안녕" },
      { role: "assistant", content: "안녕하세요!" },
    ]);
    expect(items[0]).toMatchObject({ turnIndex: 1, isInjected: false });
    expect(items[1]).toMatchObject({ turnIndex: 1, isInjected: false });
  });

  it("handles multiple injected user messages followed by a live turn (multi-thread injection)", () => {
    const items = messagesToConversationItems([
      { role: "user", content: "[from Form] name=Alice", source: "injected" },
      { role: "user", content: "[from AI Agent] 안녕", source: "injected" },
      {
        role: "assistant",
        content: "[from AI Agent] 안녕하세요",
        source: "injected",
      },
      { role: "user", content: "실제 사용자 메시지", source: "live" },
      { role: "assistant", content: "응답", source: "live" },
    ]);
    const liveAssistant = items.find(
      (i) => i.type === "assistant" && !i.isInjected,
    );
    expect(liveAssistant?.turnIndex).toBe(1);
    // Two injected user messages do not bump turn.
    const liveUser = items.find((i) => i.type === "user" && !i.isInjected);
    expect(liveUser?.turnIndex).toBe(1);
  });

  it("tool message inherits turnIndex of its originating assistant call (injected vs live aware)", () => {
    const items = messagesToConversationItems([
      { role: "user", content: "[from Template] start", source: "injected" },
      { role: "user", content: "오늘 날씨", source: "live" },
      {
        role: "assistant",
        content: "",
        toolCalls: [
          { id: "call_1", name: "get_weather", arguments: '{"city":"Seoul"}' },
        ],
        source: "live",
      },
      {
        role: "tool",
        toolCallId: "call_1",
        content: '{"temperature":12.3}',
      },
      { role: "assistant", content: "기온 12.3도입니다.", source: "live" },
    ]);
    const tool = items.find((i) => i.type === "tool");
    expect(tool).toMatchObject({ turnIndex: 1, isInjected: false });
    const finalAssistant = items.filter((i) => i.type === "assistant").at(-1);
    expect(finalAssistant?.turnIndex).toBe(1);
  });

  it("matches live assistant to debug payload when an injected assistant precedes it in the same turn", () => {
    // Regression coverage for W13: injected assistant → live tool call →
    // live assistant. assistantIdxInTurn must only advance on live entries,
    // so the live assistant maps to debugByTurn.get(1).llmCalls[0]
    // (not [1]) — the injected assistant has no corresponding llmCall.
    const debugByTurn = new Map([
      [
        1,
        {
          turnIndex: 1,
          llmCalls: [
            {
              requestPayload: { messages: ["live-only"] },
              responsePayload: { content: "기온 12.3도입니다.", usage: {} },
              durationMs: 200,
            },
          ],
        },
      ],
    ]);
    const items = messagesToConversationItems(
      [
        {
          role: "assistant",
          content: "[from PrevAgent] 이전 응답",
          source: "injected",
        },
        { role: "user", content: "오늘 날씨", source: "live" },
        {
          role: "assistant",
          content: "",
          toolCalls: [
            {
              id: "call_1",
              name: "get_weather",
              arguments: '{"city":"Seoul"}',
            },
          ],
          source: "live",
        },
        {
          role: "tool",
          toolCallId: "call_1",
          content: '{"temperature":12.3}',
        },
        { role: "assistant", content: "기온 12.3도입니다.", source: "live" },
      ],
      { debugByTurn },
    );

    const injectedAssistant = items.find(
      (i) => i.type === "assistant" && i.isInjected,
    );
    expect(injectedAssistant).toBeDefined();
    // Injected assistant must NOT claim a debug payload slot.
    expect(injectedAssistant?.requestPayload).toBeUndefined();
    expect(injectedAssistant?.responsePayload).toBeUndefined();

    // The two live assistants land in callIdx 0 then 1; debug has 1 entry
    // so callIdx 0 matches and callIdx 1 stays undefined. The matched one
    // (the tool-calling assistant in this case) must carry the payload.
    const liveAssistants = items.filter(
      (i) => i.type === "assistant" && !i.isInjected,
    );
    expect(liveAssistants).toHaveLength(2);
    expect(liveAssistants[0].requestPayload).toEqual({ messages: ["live-only"] });
    expect(liveAssistants[1].requestPayload).toBeUndefined();
  });
});

describe("messagesToConversationItems — inline marker strip (§9.5)", () => {
  it("strips [user-input]…[/user-input] markers from user / assistant content", () => {
    const items = messagesToConversationItems([
      { role: "user", content: "[user-input]질문[/user-input]" },
      { role: "assistant", content: "응답 [user-input]X[/user-input]" },
    ]);
    expect(items[0].content).toBe("질문");
    expect(items[1].content).toBe("응답 X");
  });
});

describe("stripInlineMarkers", () => {
  it("removes opening and closing [user-input] tags but keeps label", () => {
    expect(stripInlineMarkers("[user-input]AI와 대화하기[/user-input]")).toBe(
      "AI와 대화하기",
    );
  });

  it("is idempotent for strings without markers", () => {
    expect(stripInlineMarkers("plain text")).toBe("plain text");
  });

  it("handles undefined / empty input gracefully", () => {
    expect(stripInlineMarkers(undefined)).toBe("");
    expect(stripInlineMarkers("")).toBe("");
  });

  it("strips multiple marker pairs in one string (legacy stacked input)", () => {
    expect(
      stripInlineMarkers("[user-input]a[/user-input] / [user-input]b[/user-input]"),
    ).toBe("a / b");
  });
});

describe("threadTurnsToConversationItems", () => {
  function makeTurn(partial: Partial<ConversationTurn>): ConversationTurn {
    return {
      seq: 0,
      nodeId: "node-1",
      nodeLabel: "Node",
      nodeType: "ai_agent",
      source: "ai_user",
      text: "",
      ...partial,
    };
  }

  it("returns empty array for empty / non-array input", () => {
    expect(threadTurnsToConversationItems([])).toEqual([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(threadTurnsToConversationItems(null as any)).toEqual([]);
  });

  it("maps the 5 ConversationTurnSource values to the correct ConversationItem.type", () => {
    const turns: ConversationTurn[] = [
      makeTurn({
        seq: 0,
        source: "presentation_user",
        nodeLabel: "Template",
        nodeType: "template",
        text: "clicked: AI와 대화하기",
        data: { buttonId: "open_chat", buttonLabel: "AI와 대화하기" },
      }),
      makeTurn({ seq: 1, source: "ai_user", text: "어떤 상품이 있는지 알려줘" }),
      makeTurn({ seq: 2, source: "ai_assistant", text: "현재 상품은…" }),
      makeTurn({
        seq: 3,
        source: "ai_tool",
        text: '{"status":200}',
        toolCallId: "call_1",
      }),
      makeTurn({ seq: 4, source: "system", text: "안내 메시지" }),
    ];

    const items = threadTurnsToConversationItems(turns);
    expect(items.map((i) => i.type)).toEqual([
      "presentation",
      "user",
      "assistant",
      "tool",
      "system",
    ]);
  });

  // spec/4-nodes/3-ai/1-ai-agent.md §7.10 — `render_*` payloads ride along
  // with the assistant turn so the chat UI can inline-render them.
  it("picks up presentations[] on ai_assistant turns (render_* family)", () => {
    const turns: ConversationTurn[] = [
      makeTurn({ seq: 0, source: "ai_user", text: "hi" }),
      makeTurn({
        seq: 1,
        source: "ai_assistant",
        text: "Here is your table",
        presentations: [
          {
            type: "table",
            toolCallId: "call_t1",
            renderedAt: "2026-05-22T00:00:00Z",
            payload: { rows: [{ id: "1" }] },
          },
        ],
      }),
    ];
    const items = threadTurnsToConversationItems(turns);
    expect(items[1].type).toBe("assistant");
    expect(items[1].presentations).toEqual([
      {
        type: "table",
        toolCallId: "call_t1",
        renderedAt: "2026-05-22T00:00:00Z",
        payload: { rows: [{ id: "1" }] },
      },
    ]);
  });

  it("omits presentations field on ai_assistant turn without payloads", () => {
    const turns: ConversationTurn[] = [
      makeTurn({ seq: 0, source: "ai_assistant", text: "plain" }),
    ];
    const items = threadTurnsToConversationItems(turns);
    expect(items[0].presentations).toBeUndefined();
  });

  it("ignores presentations on ai_user turns — spec §7.10 (only ai_assistant may carry them)", () => {
    const turns: ConversationTurn[] = [
      makeTurn({
        seq: 0,
        source: "ai_user",
        text: "hello",
        presentations: [
          {
            type: "table",
            toolCallId: "tc_user",
            renderedAt: "2026-05-22T00:00:00Z",
            payload: {},
          },
        ],
      }),
    ];
    const items = threadTurnsToConversationItems(turns);
    // ai_user turns map to type:'user' which never carries presentations
    expect(items[0].type).toBe("user");
    expect((items[0] as { presentations?: unknown }).presentations).toBeUndefined();
  });

  it("advances turnIndex only on ai_user — presentation and system items get turnIndex 0", () => {
    const turns: ConversationTurn[] = [
      makeTurn({
        seq: 0,
        source: "presentation_user",
        data: { buttonId: "b", buttonLabel: "L" },
      }),
      makeTurn({ seq: 1, source: "ai_user", text: "first" }),
      makeTurn({ seq: 2, source: "ai_assistant", text: "reply" }),
      makeTurn({
        seq: 3,
        source: "ai_tool",
        text: "{}",
        toolCallId: "c1",
      }),
      makeTurn({ seq: 4, source: "ai_user", text: "second" }),
    ];

    const items = threadTurnsToConversationItems(turns);
    expect(items[0]).toMatchObject({ type: "presentation", turnIndex: 0 });
    expect(items[1]).toMatchObject({ type: "user", turnIndex: 1 });
    expect(items[2]).toMatchObject({ type: "assistant", turnIndex: 1 });
    expect(items[3]).toMatchObject({ type: "tool", turnIndex: 1 });
    expect(items[4]).toMatchObject({ type: "user", turnIndex: 2 });
  });

  it("infers interactionType from data shape (button_click / button_continue / form_submitted)", () => {
    const items = threadTurnsToConversationItems([
      makeTurn({
        source: "presentation_user",
        nodeLabel: "Carousel",
        nodeType: "carousel",
        text: "clicked: Buy",
        data: { buttonId: "buy", buttonLabel: "Buy", selectedItem: { id: 1 } },
      }),
      makeTurn({
        source: "presentation_user",
        nodeLabel: "Link",
        nodeType: "template",
        text: "continued: https://example.com",
        data: { buttonId: "go", buttonLabel: "Open", url: "https://example.com" },
      }),
      makeTurn({
        source: "presentation_user",
        nodeLabel: "Form",
        nodeType: "form",
        text: "name=Alice, age=30",
        data: { name: "Alice", age: 30 },
      }),
    ]);

    expect(items[0].presentation?.interactionType).toBe("button_click");
    expect(items[1].presentation?.interactionType).toBe("button_continue");
    expect(items[2].presentation?.interactionType).toBe("form_submitted");
  });

  it("snapshots nodeLabel and data so renderer can compose chip header without parsing text", () => {
    const items = threadTurnsToConversationItems([
      makeTurn({
        source: "presentation_user",
        nodeLabel: "MyTemplate",
        nodeType: "template",
        text: "clicked: AI와 대화하기",
        data: { buttonId: "chat", buttonLabel: "AI와 대화하기" },
      }),
    ]);

    expect(items[0].presentation).toEqual({
      nodeLabel: "MyTemplate",
      nodeType: "template",
      interactionType: "button_click",
      data: { buttonId: "chat", buttonLabel: "AI와 대화하기" },
    });
  });

  it("strips [user-input]…[/user-input] markers from text bodies (§9.5 compat)", () => {
    const items = threadTurnsToConversationItems([
      makeTurn({
        source: "presentation_user",
        text: "clicked: [user-input]AI와 대화하기[/user-input]",
        data: { buttonId: "chat", buttonLabel: "AI와 대화하기" },
      }),
      makeTurn({
        source: "ai_user",
        text: "[user-input]질문[/user-input]",
      }),
    ]);

    expect(items[0].content).toBe("clicked: AI와 대화하기");
    expect(items[1].content).toBe("질문");
  });

  it("carries assistantToolCalls from turn.toolCalls when present", () => {
    const items = threadTurnsToConversationItems([
      makeTurn({
        source: "ai_assistant",
        text: "",
        toolCalls: [
          { id: "c1", name: "get_weather", arguments: '{"city":"Seoul"}' },
        ],
      }),
    ]);

    expect(items[0].assistantToolCalls).toEqual([
      { name: "get_weather", arguments: '{"city":"Seoul"}' },
    ]);
  });

  it("ai_assistant before any ai_user gets turnIndex 1 fallback (edge case)", () => {
    // Transient snapshot mid-execution where only assistant has been pushed
    // — turnIndex must be a stable non-zero so renderer key paths stay valid.
    const items = threadTurnsToConversationItems([
      makeTurn({ source: "ai_assistant", text: "first reply" }),
    ]);
    expect(items[0]).toMatchObject({
      type: "assistant",
      turnIndex: 1,
    });
  });

  it("ai_tool before any ai_user also gets turnIndex 1 fallback", () => {
    const items = threadTurnsToConversationItems([
      makeTurn({
        source: "ai_tool",
        text: "{}",
        toolCallId: "c1",
      }),
    ]);
    expect(items[0]).toMatchObject({ type: "tool", turnIndex: 1 });
  });

  it("presentation_user with undefined data falls back to form_submitted", () => {
    const items = threadTurnsToConversationItems([
      makeTurn({ source: "presentation_user", data: undefined }),
    ]);
    expect(items[0].presentation?.interactionType).toBe("form_submitted");
  });

  it("prefers explicit turn.interactionType over data shape inference", () => {
    // Backend may eventually populate interactionType directly; honour it
    // even when data shape would suggest otherwise.
    const items = threadTurnsToConversationItems([
      makeTurn({
        source: "presentation_user",
        // data has buttonId but no url — would infer button_click
        data: { buttonId: "x", buttonLabel: "X" },
        interactionType: "form_submitted",
      }),
    ]);
    expect(items[0].presentation?.interactionType).toBe("form_submitted");
  });

  it("unknown source values are silently skipped with a console.warn", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const items = threadTurnsToConversationItems([
      // Forward-compat: backend ships a value the frontend doesn't know yet
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeTurn({ source: "future_source" as any, text: "x" }),
      makeTurn({ source: "ai_user", text: "real user" }),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe("user");
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("unknown ConversationTurnSource"),
      expect.anything(),
    );
    warnSpy.mockRestore();
  });
});

// PR follow-up: includeToolTurns:false thread snapshot 적용 시 live tool 아이템이
// 사라지는 회귀 (PR #206 후속) 차단. merge 헬퍼는 spec §1.1 의 의도된 lean
// thread 와 UI transparency 요구 사이의 다리 역할을 한다.
describe("mergeOrphanToolItems", () => {
  it("includeToolTurns:false 시 누락된 tool 아이템을 final assistant 직전으로 끼워넣는다", () => {
    const threadItems: ConversationItem[] = [
      user("질문"),
      assistant({ content: "최종 답변" }),
    ];
    const prev: ConversationItem[] = [
      user("질문"),
      assistant({
        content: "",
        assistantToolCalls: [{ name: "kb_search", arguments: "{}" }],
      }),
      tool("call_1"),
      assistant({ content: "최종 답변" }),
    ];
    const merged = mergeOrphanToolItems(threadItems, prev);
    // intermediate assistant + tool 모두 보존돼야 한다.
    expect(merged.map((i) => i.type)).toEqual([
      "user",
      "assistant",
      "tool",
      "assistant",
    ]);
    // tool 아이템은 final assistant 바로 앞.
    expect(merged[2].type).toBe("tool");
    expect((merged[2] as ConversationItem).toolCallId).toBe("call_1");
    // intermediate assistant 는 user 바로 뒤.
    expect((merged[1] as ConversationItem).assistantToolCalls).toEqual([
      { name: "kb_search", arguments: "{}" },
    ]);
  });

  it("thread 가 이미 같은 toolCallId 를 들고 있으면 (includeToolTurns:true) no-op", () => {
    const threadItems: ConversationItem[] = [
      user("질문"),
      assistant({
        content: "",
        assistantToolCalls: [{ name: "kb_search", arguments: "{}" }],
      }),
      tool("call_1"),
      assistant({ content: "최종" }),
    ];
    const prev: ConversationItem[] = [...threadItems];
    const merged = mergeOrphanToolItems(threadItems, prev);
    expect(merged).toHaveLength(threadItems.length);
    expect(merged).toEqual(threadItems);
  });

  it("multi-turn: 각 turn 의 tool 은 그 turn 의 final assistant 직전에 배치된다", () => {
    const threadItems: ConversationItem[] = [
      user("Q1", 1),
      assistant({ content: "A1", turnIndex: 1 }),
      user("Q2", 2),
      assistant({ content: "A2", turnIndex: 2 }),
    ];
    const prev: ConversationItem[] = [
      user("Q1", 1),
      tool("c1", { turnIndex: 1 }),
      assistant({ content: "A1", turnIndex: 1 }),
      user("Q2", 2),
      tool("c2", { turnIndex: 2 }),
      assistant({ content: "A2", turnIndex: 2 }),
    ];
    const merged = mergeOrphanToolItems(threadItems, prev);
    expect(merged.map((i) => `${i.type}:${i.turnIndex}`)).toEqual([
      "user:1",
      "tool:1",
      "assistant:1",
      "user:2",
      "tool:2",
      "assistant:2",
    ]);
  });

  it("같은 turn 에 tool 이 여러 개면 prev 의 상대 순서를 유지해 final assistant 직전에 일괄 삽입", () => {
    const threadItems: ConversationItem[] = [
      user("질문"),
      assistant({ content: "최종" }),
    ];
    const prev: ConversationItem[] = [
      user("질문"),
      tool("call_A"),
      tool("call_B"),
      assistant({ content: "최종" }),
    ];
    const merged = mergeOrphanToolItems(threadItems, prev);
    expect(
      merged.map((i) => (i.type === "tool" ? `tool:${i.toolCallId}` : i.type)),
    ).toEqual(["user", "tool:call_A", "tool:call_B", "assistant"]);
  });

  it("prev 가 비어있으면 thread 를 그대로 반환", () => {
    const threadItems: ConversationItem[] = [
      user("질문"),
      assistant({ content: "답변" }),
    ];
    expect(mergeOrphanToolItems(threadItems, [])).toEqual(threadItems);
  });

  it("content 가 있는 intermediate assistant (LLM 이 thinking 텍스트 emit) 는 보수적으로 orphan 에 포함하지 않는다", () => {
    const threadItems: ConversationItem[] = [
      user("질문"),
      assistant({ content: "최종" }),
    ];
    const prev: ConversationItem[] = [
      user("질문"),
      assistant({
        content: "Let me check the products.",
        assistantToolCalls: [{ name: "kb", arguments: "{}" }],
      }),
      tool("call_1"),
      assistant({ content: "최종" }),
    ];
    // content 있는 assistant 는 보존되지 않고 (heuristic 한계), tool 만 보존.
    const merged = mergeOrphanToolItems(threadItems, prev);
    expect(merged.map((i) => i.type)).toEqual(["user", "tool", "assistant"]);
  });

  it("whitespace-only content + toolCalls 인 intermediate assistant 는 orphan 으로 보존 (PR #206 회귀 케이스)", () => {
    const threadItems: ConversationItem[] = [
      user("질문"),
      assistant({ content: "최종" }),
    ];
    const prev: ConversationItem[] = [
      user("질문"),
      assistant({
        content: " \n ",
        assistantToolCalls: [{ name: "kb", arguments: "{}" }],
      }),
      tool("call_1"),
      assistant({ content: "최종" }),
    ];
    const merged = mergeOrphanToolItems(threadItems, prev);
    expect(merged.map((i) => i.type)).toEqual([
      "user",
      "assistant",
      "tool",
      "assistant",
    ]);
  });
});

// spec §9.6 + §9.9 Inv-5 — 단일 결정 함수 회귀 테스트. SummaryView 와 좌측
// ResultTimeline 양 surface 가 동일 결과를 사용해야 함을 보장.
describe("groupToolCallItems (§9.6 단일 결정 함수, Inv-5)", () => {
  it("blank intermediate assistant + 후행 1 tool → parent 1개 + child 1개", () => {
    const items: ConversationItem[] = [
      assistant({
        content: " \n ",
        assistantToolCalls: [{ name: "kb_search", arguments: "{}" }],
      }),
      tool("c1"),
    ];
    const { claimedToolIndices, childrenByParent } = groupToolCallItems(items);
    expect(Array.from(claimedToolIndices)).toEqual([1]);
    expect(childrenByParent.get(0)).toEqual([1]);
    expect(childrenByParent.size).toBe(1);
  });

  it("intermediate 2개 + tool 3개 (사용자 보고 시나리오) — 각 parent 가 자기 toolCalls.length 만큼 sequence-claim", () => {
    const items: ConversationItem[] = [
      user("질문"),
      assistant({
        content: "",
        assistantToolCalls: [
          { name: "tA", arguments: "{}" },
          { name: "tB", arguments: "{}" },
        ],
      }),
      assistant({
        content: "",
        assistantToolCalls: [{ name: "tC", arguments: "{}" }],
      }),
      tool("c1"),
      tool("c2"),
      tool("c3"),
      assistant({ content: "최종" }),
    ];
    const { claimedToolIndices, childrenByParent } = groupToolCallItems(items);
    // tool 인덱스 3,4 → parent 1 의 child / tool 인덱스 5 → parent 2 의 child.
    expect(childrenByParent.get(1)).toEqual([3, 4]);
    expect(childrenByParent.get(2)).toEqual([5]);
    expect(Array.from(claimedToolIndices).sort()).toEqual([3, 4, 5]);
    // final assistant 는 parent 아님.
    expect(childrenByParent.has(6)).toBe(false);
  });

  it("content 가 blank 가 아닌 intermediate 는 parent 아님 (heuristic 한계)", () => {
    const items: ConversationItem[] = [
      assistant({
        content: "Let me check",
        assistantToolCalls: [{ name: "kb", arguments: "{}" }],
      }),
      tool("c1"),
    ];
    const { claimedToolIndices, childrenByParent } = groupToolCallItems(items);
    expect(claimedToolIndices.size).toBe(0);
    expect(childrenByParent.size).toBe(0);
  });

  it("CT-S8 — 양 surface 가 같은 items 에서 동일 결과 (Inv-5)", () => {
    const items: ConversationItem[] = [
      user("질문"),
      assistant({
        content: "",
        assistantToolCalls: [{ name: "kb", arguments: "{}" }],
      }),
      tool("c1"),
      assistant({ content: "답변" }),
    ];
    // 두 surface 가 같은 입력을 두 번 호출해도 동일 결과 (deterministic).
    const a = groupToolCallItems(items);
    const b = groupToolCallItems(items);
    expect(Array.from(a.claimedToolIndices)).toEqual(
      Array.from(b.claimedToolIndices),
    );
    expect(Array.from(a.childrenByParent.entries())).toEqual(
      Array.from(b.childrenByParent.entries()),
    );
  });

  it("tool 가 부족하면 가능한 만큼만 claim", () => {
    const items: ConversationItem[] = [
      assistant({
        content: "",
        assistantToolCalls: [
          { name: "tA", arguments: "{}" },
          { name: "tB", arguments: "{}" },
        ],
      }),
      tool("c1"),
      // tB 짝이 되는 tool 미도착.
    ];
    const { childrenByParent } = groupToolCallItems(items);
    // toolCalls.length=2 인데 tool 1개만 있어도 그만큼만 claim.
    expect(childrenByParent.get(0)).toEqual([1]);
  });
});

describe("inferInteractionTypeFromData (§9.1 data shape rules)", () => {
  it("button_click when data has buttonId but no url", () => {
    expect(
      inferInteractionTypeFromData({ buttonId: "x", buttonLabel: "X" }),
    ).toBe("button_click");
  });

  it("button_continue requires BOTH buttonId AND url (stray url in form payload doesn't mis-classify)", () => {
    expect(
      inferInteractionTypeFromData({ buttonId: "x", buttonLabel: "X", url: "u" }),
    ).toBe("button_continue");
    // url alone without buttonId is treated as form_submitted (a form may
    // legitimately submit a 'url' field).
    expect(
      inferInteractionTypeFromData({ url: "https://example.com" }),
    ).toBe("form_submitted");
  });

  it("form_submitted for plain field maps and missing data", () => {
    expect(inferInteractionTypeFromData({ name: "A", age: 3 })).toBe(
      "form_submitted",
    );
    expect(inferInteractionTypeFromData(undefined)).toBe("form_submitted");
  });
});

// spec/conventions/conversation-thread.md §1.1 + §9.1 + §9.10 CT-S9
describe("system_error source — threadTurnsToConversationItems + parseHistoryMessages", () => {
  it("threadTurnsToConversationItems maps system_error turn to ConversationItem with structured systemError payload", () => {
    const turns = [
      {
        seq: 0,
        nodeId: "agent-1",
        nodeLabel: "CS Bot",
        nodeType: "ai_agent",
        source: "ai_user" as const,
        text: "주문 확인",
      },
      {
        seq: 1,
        nodeId: "agent-1",
        nodeLabel: "CS Bot",
        nodeType: "ai_agent",
        source: "system_error" as const,
        text: "Anthropic 429",
        data: {
          code: "LLM_RATE_LIMIT",
          message: "Anthropic 429",
          retryable: true,
          retryAfterSec: 30,
          nodeId: "agent-1",
          nodeLabel: "CS Bot",
        },
      },
    ];
    const items = threadTurnsToConversationItems(turns);
    expect(items).toHaveLength(2);
    expect(items[1].type).toBe("system_error");
    expect(items[1].systemError).toMatchObject({
      code: "LLM_RATE_LIMIT",
      retryable: true,
      retryAfterSec: 30,
      nodeId: "agent-1",
      nodeLabel: "CS Bot",
    });
  });

  it("threadTurnsToConversationItems falls back on missing data fields gracefully", () => {
    const turns = [
      {
        seq: 0,
        nodeId: "agent-1",
        nodeLabel: "CS Bot",
        nodeType: "ai_agent",
        source: "system_error" as const,
        text: "fallback message",
        // data 누락 — fallback shape
      },
    ];
    const items = threadTurnsToConversationItems(turns);
    expect(items[0].type).toBe("system_error");
    expect(items[0].systemError).toMatchObject({
      code: "UNKNOWN_ERROR",
      message: "fallback message",
      retryable: false,
      nodeId: "agent-1",
      nodeLabel: "CS Bot",
    });
  });

  // CT-S9 (history view branch — OQ3 decision)
  it("parseHistoryMessages synthesizes system_error at the end when output.error is set", () => {
    const outputData = {
      config: {},
      output: {
        result: {
          messages: [
            { role: "user", content: "환불" },
            { role: "assistant", content: "" },
          ],
          turnCount: 1,
        },
        error: {
          code: "LLM_RATE_LIMIT",
          message: "Rate limited (after 1 turn)",
          details: { retryable: true, retryAfterSec: 60 },
        },
      },
      meta: { interactionType: "ai_conversation" },
    };
    const items = parseHistoryMessages(outputData);
    expect(items.length).toBeGreaterThan(0);
    const last = items[items.length - 1];
    expect(last.type).toBe("system_error");
    expect(last.systemError?.code).toBe("LLM_RATE_LIMIT");
    expect(last.systemError?.retryable).toBe(true);
    expect(last.systemError?.retryAfterSec).toBe(60);
  });

  // CT-S10 — non-retryable, no retry signal
  it("parseHistoryMessages synthesizes system_error with retryable=false when details.retryable is false", () => {
    const outputData = {
      config: {},
      output: {
        result: { messages: [{ role: "user", content: "x" }], turnCount: 1 },
        error: {
          code: "LLM_CALL_FAILED",
          message: "401 unauthorized",
          details: { retryable: false },
        },
      },
    };
    const items = parseHistoryMessages(outputData);
    const last = items[items.length - 1];
    expect(last.type).toBe("system_error");
    expect(last.systemError?.retryable).toBe(false);
    expect(last.systemError?.retryAfterSec).toBeUndefined();
  });

  it("parseHistoryMessages does NOT synthesize system_error when output.error is absent", () => {
    const outputData = {
      config: {},
      output: {
        result: { messages: [{ role: "user", content: "x" }], turnCount: 1 },
      },
    };
    const items = parseHistoryMessages(outputData);
    expect(items.every((i) => i.type !== "system_error")).toBe(true);
  });

  // §9.6 (Inv-5 보조): system_error 는 tool-call group 분류 대상 외
  it("groupToolCallItems does not absorb system_error into parent/child grouping", () => {
    const items: ConversationItem[] = [
      user("question"),
      assistant({
        content: "",
        assistantToolCalls: [{ name: "kb_search", arguments: "{}" }],
      }),
      tool("c1"),
      // system_error 는 후행 위치 — parent 의 child 로 흡수되지 않음
      {
        type: "system_error",
        content: "error",
        turnIndex: 0,
        systemError: {
          code: "LLM_RATE_LIMIT",
          message: "error",
          retryable: true,
          nodeId: "n",
          nodeLabel: "L",
        },
      },
    ];
    const { claimedToolIndices, childrenByParent } = groupToolCallItems(items);
    // index 2 (tool) 만 claim, index 3 (system_error) 은 unclaim
    expect(Array.from(claimedToolIndices)).toEqual([2]);
    // system_error index 가 childrenByParent 의 어느 array 에도 등장하지 않음
    for (const [, children] of childrenByParent) {
      expect(children.includes(3)).toBe(false);
    }
  });
});
