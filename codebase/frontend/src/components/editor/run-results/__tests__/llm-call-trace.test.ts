import { describe, it, expect } from "vitest";
import {
  countCallsPerTurn,
  extractLlmCalls,
  labelForCall,
} from "../llm-call-trace";

describe("extractLlmCalls", () => {
  it("returns [] for a non-AI payload", () => {
    expect(extractLlmCalls({ rows: [] })).toEqual([]);
    expect(extractLlmCalls(null)).toEqual([]);
  });

  it("flattens _turnDebugHistory from legacy AI Agent flat shape", () => {
    const raw = {
      interactionType: "ai_conversation",
      response: "hi",
      _turnDebugHistory: [
        {
          turnIndex: 1,
          llmCalls: [
            { requestPayload: { m: 1 }, responsePayload: { r: 1 }, durationMs: 10 },
            { requestPayload: { m: 2 }, responsePayload: { r: 2 }, durationMs: 20 },
          ],
          totalDurationMs: 30,
        },
        {
          turnIndex: 2,
          llmCalls: [
            { requestPayload: { m: 3 }, responsePayload: { r: 3 }, durationMs: 15 },
          ],
          totalDurationMs: 15,
        },
      ],
    };
    const calls = extractLlmCalls(raw);
    expect(calls).toHaveLength(3);
    expect(calls[0]).toMatchObject({ turnIndex: 1, callIndexInTurn: 0 });
    expect(calls[1]).toMatchObject({ turnIndex: 1, callIndexInTurn: 1 });
    expect(calls[2]).toMatchObject({ turnIndex: 2, callIndexInTurn: 0 });
  });

  it("reads output._turnDebugHistory from Info Extractor new shape", () => {
    const raw = {
      config: { schema: [] },
      output: {
        extracted: { a: 1 },
        _turnDebugHistory: [
          {
            turnIndex: 1,
            llmCalls: [
              { requestPayload: { p: 1 }, responsePayload: { r: 1 }, durationMs: 5 },
            ],
            totalDurationMs: 5,
          },
        ],
      },
      meta: { model: "gpt-5" },
    };
    const calls = extractLlmCalls(raw);
    expect(calls).toHaveLength(1);
    expect(calls[0].turnIndex).toBe(1);
  });

  it("reads output._llmCalls from Text Classifier", () => {
    const raw = {
      config: {},
      output: {
        category: "a",
        _llmCalls: [
          { requestPayload: { m: 1 }, responsePayload: { r: 1 }, durationMs: 7 },
        ],
      },
      meta: {},
    };
    const calls = extractLlmCalls(raw);
    expect(calls).toHaveLength(1);
    expect(calls[0].durationMs).toBe(7);
  });

  it("returns [] for single-turn AI Agent flat shape without debug history", () => {
    // This is a legacy shape that predates the trace. The LlmInformationTab
    // should render its 'no calls' placeholder in this case.
    const raw = { response: "hello", metadata: { model: "gpt-5" } };
    expect(extractLlmCalls(raw)).toEqual([]);
  });

  it("falls back to conversationMessages when outputData has no trace", () => {
    const raw = {
      type: "ai_conversation",
      status: "waiting_for_input",
      conversationConfig: { messages: [], turnCount: 2 },
    };
    const fallback = [
      { type: "user", content: "hi", turnIndex: 1 },
      {
        type: "assistant",
        content: "hello",
        turnIndex: 1,
        requestPayload: { m: "req-1" },
        responsePayload: { m: "resp-1" },
        durationMs: 42,
      },
      { type: "user", content: "more?", turnIndex: 2 },
      {
        type: "assistant",
        content: "",
        turnIndex: 2,
        requestPayload: { m: "req-2" },
        responsePayload: { m: "resp-2" },
        durationMs: 55,
      },
    ] as Parameters<typeof extractLlmCalls>[1];
    const calls = extractLlmCalls(raw, fallback);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({
      turnIndex: 1,
      callIndexInTurn: 0,
      durationMs: 42,
    });
    expect(calls[1].turnIndex).toBe(2);
  });

  it("assigns sequential callIndexInTurn to same-turn assistant items in fallbackMessages (tool loop)", () => {
    // Tool loop: multiple assistant items in one turn must get distinct
    // call indices so labels render "Turn 1 · 호출 1/2" / "Turn 1 · 호출 2/2".
    const raw = {
      type: "ai_conversation",
      status: "waiting_for_input",
    };
    const fallback = [
      { type: "user", content: "hi", turnIndex: 1 },
      {
        type: "assistant",
        content: "",
        turnIndex: 1,
        requestPayload: { m: "first call" },
        responsePayload: { toolCalls: [{ id: "t1" }] },
        durationMs: 30,
      },
      {
        type: "tool",
        content: "tool result",
        turnIndex: 1,
        toolCallId: "t1",
      },
      {
        type: "assistant",
        content: "final answer",
        turnIndex: 1,
        requestPayload: { m: "second call" },
        responsePayload: { content: "final answer" },
        durationMs: 40,
      },
    ] as Parameters<typeof extractLlmCalls>[1];
    const calls = extractLlmCalls(raw, fallback);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({
      turnIndex: 1,
      callIndexInTurn: 0,
      durationMs: 30,
    });
    expect(calls[1]).toMatchObject({
      turnIndex: 1,
      callIndexInTurn: 1,
      durationMs: 40,
    });

    const counts = countCallsPerTurn(calls);
    expect(labelForCall(calls[0], counts)).toBe("Turn 1 · 호출 1/2");
    expect(labelForCall(calls[1], counts)).toBe("Turn 1 · 호출 2/2");
  });

  it("assigns sequential indices for ≥3 calls in a single turn (deeper tool loop)", () => {
    const raw = {};
    const fallback = [
      { type: "user", content: "go", turnIndex: 1 },
      ...[0, 1, 2].map((i) => ({
        type: "assistant" as const,
        content: "",
        turnIndex: 1,
        requestPayload: { i },
        responsePayload: { i },
        durationMs: 10 + i,
      })),
    ] as Parameters<typeof extractLlmCalls>[1];
    const calls = extractLlmCalls(raw, fallback);
    expect(calls.map((c) => c.callIndexInTurn)).toEqual([0, 1, 2]);
    const counts = countCallsPerTurn(calls);
    expect(labelForCall(calls[2], counts)).toBe("Turn 1 · 호출 3/3");
  });

  it("skips assistant items with no payload without breaking the per-turn counter", () => {
    // A null-payload assistant (e.g. UI shell still loading) sandwiched
    // between two valid traces must not advance the counter — the next
    // valid trace continues at index 1, not 2.
    const raw = {};
    const fallback = [
      {
        type: "assistant",
        content: "",
        turnIndex: 1,
        requestPayload: { i: 0 },
        responsePayload: { i: 0 },
      },
      {
        type: "assistant",
        content: "",
        turnIndex: 1,
        requestPayload: null,
        responsePayload: null,
      },
      {
        type: "assistant",
        content: "",
        turnIndex: 1,
        requestPayload: { i: 1 },
        responsePayload: { i: 1 },
      },
    ] as Parameters<typeof extractLlmCalls>[1];
    const calls = extractLlmCalls(raw, fallback);
    expect(calls).toHaveLength(2);
    expect(calls.map((c) => c.callIndexInTurn)).toEqual([0, 1]);
  });

  it("resets callIndexInTurn independently per turn", () => {
    const raw = {};
    const fallback = [
      {
        type: "assistant",
        content: "",
        turnIndex: 1,
        requestPayload: { t: 1, i: 0 },
        responsePayload: {},
      },
      {
        type: "assistant",
        content: "",
        turnIndex: 1,
        requestPayload: { t: 1, i: 1 },
        responsePayload: {},
      },
      {
        type: "assistant",
        content: "",
        turnIndex: 2,
        requestPayload: { t: 2, i: 0 },
        responsePayload: {},
      },
    ] as Parameters<typeof extractLlmCalls>[1];
    const calls = extractLlmCalls(raw, fallback);
    expect(calls.map((c) => ({ t: c.turnIndex, i: c.callIndexInTurn }))).toEqual(
      [
        { t: 1, i: 0 },
        { t: 1, i: 1 },
        { t: 2, i: 0 },
      ],
    );
  });

  it("prefers outputData trace over fallbackMessages when both are present", () => {
    const raw = {
      _turnDebugHistory: [
        {
          turnIndex: 1,
          llmCalls: [
            {
              requestPayload: { from: "outputData" },
              responsePayload: {},
              durationMs: 10,
            },
          ],
        },
      ],
    };
    const fallback = [
      {
        type: "assistant",
        content: "",
        turnIndex: 1,
        requestPayload: { from: "fallback" },
        responsePayload: {},
      },
    ] as Parameters<typeof extractLlmCalls>[1];
    const calls = extractLlmCalls(raw, fallback);
    expect(calls).toHaveLength(1);
    expect(
      (calls[0].requestPayload as Record<string, string>).from,
    ).toBe("outputData");
  });
});

describe("labelForCall / countCallsPerTurn", () => {
  it("omits the call-index suffix when only one call per turn", () => {
    const calls = extractLlmCalls({
      _turnDebugHistory: [
        { turnIndex: 1, llmCalls: [{ requestPayload: {}, responsePayload: {} }] },
      ],
    });
    const counts = countCallsPerTurn(calls);
    expect(labelForCall(calls[0], counts)).toBe("Turn 1 · 응답");
  });

  it("includes the call-index suffix when multiple calls share a turn", () => {
    const calls = extractLlmCalls({
      _turnDebugHistory: [
        {
          turnIndex: 1,
          llmCalls: [
            { requestPayload: {}, responsePayload: {} },
            { requestPayload: {}, responsePayload: {} },
          ],
        },
      ],
    });
    const counts = countCallsPerTurn(calls);
    expect(labelForCall(calls[0], counts)).toContain("Turn 1 · 호출 1/2");
    expect(labelForCall(calls[1], counts)).toContain("Turn 1 · 호출 2/2");
  });
});
