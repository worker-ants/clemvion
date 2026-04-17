import { describe, it, expect } from "vitest";
import {
  extractAiMetadata,
  extractIeSnapshot,
  isConversationOutput,
  unwrapNodeOutput,
} from "../output-shape";

describe("extractAiMetadata", () => {
  it("returns null for non-AI output (generic legacy payload)", () => {
    expect(extractAiMetadata({ rows: [1, 2, 3], rowCount: 3 })).toBeNull();
  });

  it("returns null when meta exists but has no AI token fields", () => {
    expect(
      extractAiMetadata({
        config: {},
        output: { rows: [] },
        meta: { statusCode: 200, duration: 12 },
      }),
    ).toBeNull();
  });

  it("extracts AI Agent legacy multi-turn metadata", () => {
    const raw = {
      interactionType: "ai_conversation",
      response: "hi",
      messages: [{ role: "user", content: "ping" }],
      turnCount: 2,
      endReason: "max_turns",
      metadata: {
        model: "openai/gpt-5",
        totalInputTokens: 100,
        totalOutputTokens: 50,
        totalTokens: 150,
        thinkingTokens: 10,
        toolCalls: 2,
        ragSources: [],
      },
    };
    expect(extractAiMetadata(raw)).toEqual({
      model: "openai/gpt-5",
      totalTokens: 150,
      requestTokens: 100,
      responseTokens: 50,
      thinkingTokens: 10,
      turnCount: 2,
      toolCalls: 2,
    });
  });

  it("extracts Text Classifier new-shape meta (no turnCount/toolCalls)", () => {
    const raw = {
      config: { categories: [], inputField: "x", multiLabel: false },
      output: { category: "a", originalInput: "x" },
      meta: {
        model: "openai/gpt-5-mini",
        inputTokens: 20,
        outputTokens: 5,
        totalTokens: 25,
      },
      port: "class_0",
    };
    expect(extractAiMetadata(raw)).toEqual({
      model: "openai/gpt-5-mini",
      totalTokens: 25,
      requestTokens: 20,
      responseTokens: 5,
      thinkingTokens: null,
      turnCount: null,
      toolCalls: null,
    });
  });

  it("extracts Information Extractor single-turn meta", () => {
    const raw = {
      config: { schema: [] },
      output: { extracted: { name: "bob" } },
      meta: {
        model: "gemini-2.5-pro",
        inputTokens: 80,
        outputTokens: 12,
        totalTokens: 92,
        thinkingTokens: 7,
      },
    };
    expect(extractAiMetadata(raw)?.thinkingTokens).toBe(7);
    expect(extractAiMetadata(raw)?.turnCount).toBeNull();
  });

  it("extracts Information Extractor multi-turn meta with turnCount from output", () => {
    const raw = {
      config: { schema: [], mode: "multi_turn" },
      output: {
        extracted: { name: "bob" },
        messages: [],
        endReason: "completed",
        turnCount: 3,
      },
      meta: {
        model: "gpt-5",
        inputTokens: 200,
        outputTokens: 80,
        totalTokens: 280,
        thinkingTokens: 15,
        interactionType: "ai_conversation",
      },
    };
    const meta = extractAiMetadata(raw);
    expect(meta?.turnCount).toBe(3);
    expect(meta?.model).toBe("gpt-5");
    expect(meta?.requestTokens).toBe(200);
    expect(meta?.responseTokens).toBe(80);
    expect(meta?.thinkingTokens).toBe(15);
  });

  it("leaves thinkingTokens null when provider doesn't report it (Anthropic)", () => {
    const raw = {
      metadata: {
        model: "claude-sonnet-4-6",
        totalInputTokens: 100,
        totalOutputTokens: 50,
        totalTokens: 150,
        toolCalls: 0,
      },
    };
    expect(extractAiMetadata(raw)?.thinkingTokens).toBeNull();
  });
});

describe("extractIeSnapshot", () => {
  it("reads conversationConfig.extracted from waiting shape with retry info", () => {
    const raw = {
      type: "ai_conversation",
      status: "waiting_for_input",
      interactionType: "ai_conversation",
      conversationConfig: {
        message: "What is your order id?",
        messages: [],
        turnCount: 1,
        maxTurns: 10,
        extracted: { orderId: null, product: "A123" },
        missingFields: ["orderId"],
        collectionRetryCount: 1,
        maxCollectionRetries: 3,
      },
    };
    const snapshot = extractIeSnapshot(raw);
    expect(snapshot?.inProgress).toBe(true);
    expect(snapshot?.fields).toEqual({ orderId: null, product: "A123" });
    expect(snapshot?.retry).toEqual({ count: 1, max: 3 });
  });

  it("reads output.extracted from completed {port, data} envelope after unwrap", () => {
    // In practice the engine strips the outer {port, data} wrapper before
    // persisting — downstream code sees data.* shape. We model that here.
    const raw = {
      config: {
        schema: [
          { name: "orderId", type: "string", required: true },
          { name: "amount", type: "number", required: false },
        ],
        mode: "multi_turn",
      },
      output: {
        extracted: { orderId: "O-1", amount: 10 },
        endReason: "completed",
        turnCount: 2,
      },
      meta: { model: "gpt-5", interactionType: "ai_conversation" },
    };
    const snapshot = extractIeSnapshot(raw);
    expect(snapshot?.inProgress).toBe(false);
    expect(snapshot?.fields.orderId).toBe("O-1");
    expect(snapshot?.schema).toHaveLength(2);
    expect(snapshot?.schema?.[0].name).toBe("orderId");
  });

  it("returns null for non-IE output (no extracted field anywhere)", () => {
    expect(extractIeSnapshot({ rows: [] })).toBeNull();
    expect(extractIeSnapshot({ response: "hi" })).toBeNull();
  });
});

describe("unwrapNodeOutput waiting shape (config echo)", () => {
  it("treats config-only waiting shape as structured with config populated", () => {
    const raw = {
      type: "ai_conversation",
      status: "waiting_for_input",
      interactionType: "ai_conversation",
      config: {
        schema: [{ name: "orderId", type: "string", required: true }],
        mode: "multi_turn",
        maxCollectionRetries: 3,
      },
      conversationConfig: { messages: [], turnCount: 0, maxTurns: 10 },
    };
    const u = unwrapNodeOutput(raw);
    expect(u.isStructured).toBe(true);
    expect(u.output).toBeNull();
    expect(u.config).not.toBeNull();
    expect((u.config as Record<string, unknown>).mode).toBe("multi_turn");
    expect(u.status).toBe("waiting_for_input");
  });

  it("still treats completed shape (config + output) as full new shape", () => {
    const raw = {
      config: { schema: [] },
      output: { extracted: {} },
      meta: { model: "gpt-5" },
    };
    const u = unwrapNodeOutput(raw);
    expect(u.isStructured).toBe(true);
    expect(u.output).not.toBeNull();
    expect(u.config).not.toBeNull();
  });
});

describe("isConversationOutput / unwrapNodeOutput regression", () => {
  it("still detects conversation output after metadata shape changes", () => {
    const raw = {
      interactionType: "ai_conversation",
      messages: [{ role: "user", content: "x" }],
      metadata: { model: "gpt-5" },
    };
    expect(isConversationOutput(raw)).toBe(true);
  });

  it("detects waiting shape with config echo as conversation", () => {
    // Regression: when the handler adds `config` to the waiting shape, the
    // unwrapped `output` becomes null. isConversationOutput must still
    // recognise it as a conversation via top-level interactionType/config.
    const raw = {
      type: "ai_conversation",
      status: "waiting_for_input",
      interactionType: "ai_conversation",
      config: { mode: "multi_turn", maxTurns: 10 },
      conversationConfig: {
        message: "",
        messages: [{ role: "user", content: "안녕" }],
        turnCount: 1,
        maxTurns: 10,
      },
    };
    expect(isConversationOutput(raw)).toBe(true);
  });

  it("detects waiting shape without config echo (legacy waiting)", () => {
    const raw = {
      type: "ai_conversation",
      status: "waiting_for_input",
      interactionType: "ai_conversation",
      conversationConfig: { messages: [], turnCount: 0 },
    };
    expect(isConversationOutput(raw)).toBe(true);
  });

  it("passes non-wrapped payload through as legacy", () => {
    const u = unwrapNodeOutput({ response: "hi" });
    expect(u.isStructured).toBe(false);
  });
});
