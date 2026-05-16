import { describe, it, expect } from "vitest";
import {
  parseHistoryMessages,
  messagesToConversationItems,
} from "../conversation-utils";

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
    expect(tool).toMatchObject({ turnIndex: 1 });
    const finalAssistant = items.filter((i) => i.type === "assistant").at(-1);
    expect(finalAssistant?.turnIndex).toBe(1);
  });
});
