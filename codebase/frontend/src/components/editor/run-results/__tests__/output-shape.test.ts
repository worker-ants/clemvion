import { describe, it, expect } from "vitest";
import {
  extractAiMetadata,
  extractIeSnapshot,
  extractTurnDebug,
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
      ragSources: [],
      ragDiagnostics: null,
      turnDebug: [],
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
      ragSources: [],
      ragDiagnostics: null,
      turnDebug: [],
    });
  });

  it("extracts ragSources and ragDiagnostics from AI Agent meta", () => {
    const raw = {
      config: {},
      output: { result: { response: "ok" } },
      meta: {
        model: "openai/gpt-5",
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
        ragSources: [
          {
            chunkId: "c1",
            documentId: "d1",
            documentName: "환불 정책.md",
            content: "환불은 7일 이내…",
            score: 0.83,
            origin: "seed",
          },
          {
            chunkId: "c2",
            documentId: "d2",
            documentName: "교환 정책.md",
            content: "교환은 14일…",
            score: 0.78,
          },
        ],
        ragDiagnostics: {
          attempted: true,
          searchedKbCount: 1,
          queriesUsed: ["환불 정책", "교환 정책"],
          resultCount: 2,
        },
      },
    };
    const meta = extractAiMetadata(raw);
    expect(meta?.ragSources).toHaveLength(2);
    expect(meta?.ragSources[0]?.documentName).toBe("환불 정책.md");
    expect(meta?.ragSources[0]?.origin).toBe("seed");
    expect(meta?.ragDiagnostics?.attempted).toBe(true);
    expect(meta?.ragDiagnostics?.queriesUsed).toEqual([
      "환불 정책",
      "교환 정책",
    ]);
  });

  it("preserves skipReason in ragDiagnostics when search returns no chunks", () => {
    const raw = {
      config: {},
      output: { result: { response: "ok" } },
      meta: {
        model: "openai/gpt-5",
        inputTokens: 5,
        outputTokens: 5,
        ragDiagnostics: {
          attempted: true,
          searchedKbCount: 1,
          queriesUsed: ["주문 취소"],
          resultCount: 0,
          skipReason: "no_results",
        },
      },
    };
    const meta = extractAiMetadata(raw);
    expect(meta?.ragDiagnostics?.skipReason).toBe("no_results");
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

  it("extracts per-turn ragSources from meta.turnDebug", () => {
    const raw = {
      config: {},
      output: { result: { response: "ok" } },
      meta: {
        model: "openai/gpt-5",
        inputTokens: 10,
        outputTokens: 5,
        ragSources: [],
        turnDebug: [
          {
            turnIndex: 1,
            llmCalls: [],
            totalDurationMs: 100,
            ragSources: [
              {
                chunkId: "c1",
                documentId: "d1",
                documentName: "환불.md",
                content: "환불은 7일",
                score: 0.9,
              },
            ],
            ragDiagnostics: {
              attempted: true,
              searchedKbCount: 1,
              queriesUsed: ["환불"],
              resultCount: 1,
            },
          },
          {
            turnIndex: 2,
            llmCalls: [],
            totalDurationMs: 80,
            ragSources: [],
            ragDiagnostics: {
              attempted: false,
              searchedKbCount: 0,
              queriesUsed: [],
              resultCount: 0,
            },
          },
        ],
      },
    };
    const meta = extractAiMetadata(raw);
    expect(meta?.turnDebug).toHaveLength(2);
    expect(meta?.turnDebug[0]?.turnIndex).toBe(1);
    expect(meta?.turnDebug[0]?.ragSources).toHaveLength(1);
    expect(meta?.turnDebug[0]?.ragSources[0]?.chunkId).toBe("c1");
    expect(meta?.turnDebug[0]?.ragDiagnostics?.attempted).toBe(true);
    expect(meta?.turnDebug[1]?.ragSources).toEqual([]);
    expect(meta?.turnDebug[1]?.ragDiagnostics?.attempted).toBe(false);
  });

  it("falls back to empty turnDebug array when payload omits the field (legacy)", () => {
    const raw = {
      config: {},
      output: { result: { response: "ok" } },
      meta: {
        model: "openai/gpt-5",
        inputTokens: 10,
        outputTokens: 5,
      },
    };
    expect(extractAiMetadata(raw)?.turnDebug).toEqual([]);
  });
});

describe("extractTurnDebug", () => {
  it("returns [] for non-array input", () => {
    expect(extractTurnDebug(null)).toEqual([]);
    expect(extractTurnDebug(undefined)).toEqual([]);
    expect(extractTurnDebug({})).toEqual([]);
    expect(extractTurnDebug("nope")).toEqual([]);
  });

  it("skips entries without a numeric turnIndex", () => {
    expect(
      extractTurnDebug([
        { turnIndex: "1", ragSources: [], ragDiagnostics: null },
        null,
        { ragSources: [] },
        {
          turnIndex: 2,
          ragSources: [
            {
              chunkId: "c",
              documentId: "d",
              documentName: "name",
              content: "x",
              score: 0.5,
            },
          ],
          ragDiagnostics: null,
        },
      ]),
    ).toEqual([
      {
        turnIndex: 2,
        ragSources: [
          {
            chunkId: "c",
            documentId: "d",
            documentName: "name",
            content: "x",
            score: 0.5,
          },
        ],
        ragDiagnostics: null,
      },
    ]);
  });

  it("treats missing ragSources / ragDiagnostics as empty / null (legacy turn entries)", () => {
    expect(
      extractTurnDebug([
        { turnIndex: 1, llmCalls: [], totalDurationMs: 12 },
      ]),
    ).toEqual([{ turnIndex: 1, ragSources: [], ragDiagnostics: null }]);
  });

  it("preserves turnIndex: 0 (falsy but valid)", () => {
    // typeof 0 === "number" 이라 turnIndex == null 가드를 통과해야 한다.
    // 단일턴이 turnIndex=1 부터 시작하긴 하지만 future-proof 차원에서 0 도 보존.
    expect(
      extractTurnDebug([
        { turnIndex: 0, ragSources: [], ragDiagnostics: null },
      ]),
    ).toEqual([{ turnIndex: 0, ragSources: [], ragDiagnostics: null }]);
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

  it("reads output.result.extracted from the post-Stage-1 shape", () => {
    const raw = {
      config: {
        schema: [
          { name: "orderId", type: "string", required: true },
          { name: "amount", type: "number", required: false },
        ],
        mode: "multi_turn",
      },
      output: {
        result: {
          extracted: { orderId: "O-1", amount: 10 },
          endReason: "completed",
          turnCount: 2,
        },
      },
      meta: { durationMs: 120, model: "gpt-5" },
      port: "completed",
      status: "ended",
    };
    const snapshot = extractIeSnapshot(raw);
    expect(snapshot?.inProgress).toBe(false);
    expect(snapshot?.fields.orderId).toBe("O-1");
    expect(snapshot?.schema).toHaveLength(2);
    expect(snapshot?.schema?.[0].name).toBe("orderId");
  });

  it("falls back to legacy output.extracted for pre-migration executions", () => {
    // Historical run-history rows may still carry the pre-Stage-1 shape.
    const raw = {
      config: { schema: [{ name: "orderId", type: "string", required: true }], mode: "multi_turn" },
      output: {
        extracted: { orderId: "O-2" },
        endReason: "completed",
        turnCount: 1,
      },
      meta: { model: "gpt-5", interactionType: "ai_conversation" },
    };
    const snapshot = extractIeSnapshot(raw);
    expect(snapshot?.inProgress).toBe(false);
    expect(snapshot?.fields.orderId).toBe("O-2");
  });

  it("returns null for non-IE output (no extracted field anywhere)", () => {
    expect(extractIeSnapshot({ rows: [] })).toBeNull();
    expect(extractIeSnapshot({ response: "hi" })).toBeNull();
  });

  it("reads output.partial.extracted from the canonical waiting shape", () => {
    // CONVENTIONS §4.3 — Information Extractor multi-turn waiting now emits
    // `output: { messages, message, turnCount, maxTurns, partial: { extracted,
    // missingFields, collectionRetryCount } }` inside the canonical envelope.
    const raw = {
      config: {
        schema: [{ name: "orderId", type: "string", required: true }],
        mode: "multi_turn",
        maxCollectionRetries: 3,
      },
      output: {
        messages: [],
        message: "주문번호를 알려주세요",
        turnCount: 1,
        maxTurns: 5,
        partial: {
          extracted: { orderId: null, product: "A123" },
          missingFields: ["orderId"],
          collectionRetryCount: 1,
        },
      },
      meta: { interactionType: "ai_conversation" },
      status: "waiting_for_input",
      _resumeState: { partialResult: {}, turnCount: 1 },
    };
    const snapshot = extractIeSnapshot(raw);
    expect(snapshot?.inProgress).toBe(true);
    expect(snapshot?.fields).toEqual({ orderId: null, product: "A123" });
    expect(snapshot?.retry).toEqual({ count: 1, max: 3 });
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

  it("detects canonical waiting shape (post-migration persisted outputData)", () => {
    // After CONVENTIONS §4.3 migration, persisted waiting payloads carry
    // `meta.interactionType: 'ai_conversation'` and `output.messages`.
    // No top-level `interactionType` or `conversationConfig`.
    const raw = {
      config: { mode: "multi_turn", maxTurns: 0, maxToolCalls: 100 },
      output: {
        messages: [{ role: "user", content: "안녕" }],
        message: "",
        turnCount: 1,
        maxTurns: 10,
      },
      meta: { interactionType: "ai_conversation" },
      status: "waiting_for_input",
      _resumeState: { messages: [], turnCount: 1 },
    };
    expect(isConversationOutput(raw)).toBe(true);
  });

  it("detects canonical waiting shape via status + output.messages alone", () => {
    // Defensive fallback: even if meta.interactionType is somehow stripped,
    // `status === 'waiting_for_input'` + `output.messages` array is enough.
    const raw = {
      config: { mode: "multi_turn" },
      output: {
        messages: [{ role: "user", content: "x" }],
        message: "",
        turnCount: 1,
      },
      status: "waiting_for_input",
    };
    expect(isConversationOutput(raw)).toBe(true);
  });

  it("passes non-wrapped payload through as legacy", () => {
    const u = unwrapNodeOutput({ response: "hi" });
    expect(u.isStructured).toBe(false);
  });

  it("detects post-Stage-5 ai_agent terminal via output.result.messages + endReason", () => {
    // `looksLikeConversationEnd` branch — new LLM shape wraps everything
    // under `output.result.*` and drops `meta.interactionType`.
    const raw = {
      config: { mode: "multi_turn", model: "gpt-5" },
      output: {
        result: {
          response: "bye",
          messages: [
            { role: "user", content: "hi" },
            { role: "assistant", content: "bye" },
          ],
          turnCount: 1,
          endReason: "completed",
        },
      },
      meta: { durationMs: 120, model: "gpt-5", inputTokens: 10 },
      port: "out",
      status: "ended",
    };
    expect(isConversationOutput(raw)).toBe(true);
  });

  it("accepts every unified endReason as a conversation terminal", () => {
    const endReasons = ["completed", "user_ended", "max_turns", "max_retries"] as const;
    for (const endReason of endReasons) {
      const raw = {
        config: {},
        output: {
          result: {
            messages: [{ role: "user", content: "x" }],
            endReason,
            turnCount: 1,
          },
        },
        meta: { model: "m" },
      };
      expect(isConversationOutput(raw)).toBe(true);
    }
  });

  it("rejects non-conversation shapes that happen to carry a result key", () => {
    // A plain Information Extractor single-turn (no messages, no endReason)
    // should not be mistaken for a conversation.
    const raw = {
      config: {},
      output: { result: { extracted: { orderNumber: "ORD-1" } } },
      meta: { model: "gpt-5" },
    };
    expect(isConversationOutput(raw)).toBe(false);
  });
});
