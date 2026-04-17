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

  it("reads _multiTurnState.turnDebugHistory from waiting shape", () => {
    const raw = {
      status: "waiting_for_input",
      conversationConfig: { messages: [] },
      _multiTurnState: {
        turnDebugHistory: [
          {
            turnIndex: 1,
            llmCalls: [
              { requestPayload: { p: 1 }, responsePayload: { r: 1 }, durationMs: 4 },
            ],
            totalDurationMs: 4,
          },
        ],
      },
    };
    const calls = extractLlmCalls(raw);
    expect(calls).toHaveLength(1);
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
