import { informationExtractorNodeOutputSchema } from './information-extractor.schema';

describe('informationExtractorNodeOutputSchema', () => {
  // Post Stage 1 of the node-specs-improvement rollout the handler emits the
  // canonical `NodeHandlerOutput` shape directly — `output.result.*` for
  // successes, `output.error.{code,message,details}` for runtime failures,
  // and tokens / debug traces on `meta.*`.
  it('accepts a successful single-turn extraction', () => {
    const fixture = {
      config: {
        mode: 'single_turn',
        model: 'gpt-4o',
        schema: [
          { name: 'orderId', type: 'string', description: '', required: true },
        ],
      },
      output: {
        result: {
          extracted: { orderId: 'ORD-123' },
          endReason: 'out',
          turnCount: 1,
          originalInput: 'Email…',
        },
      },
      meta: {
        durationMs: 810,
        model: 'gpt-4o',
        inputTokens: 20,
        outputTokens: 5,
        totalTokens: 25,
        thinkingTokens: 0,
      },
      port: 'out',
      status: 'ended',
    };
    const result = informationExtractorNodeOutputSchema.safeParse(fixture);
    expect(result.success).toBe(true);
  });

  it('accepts an error-port output with structured error', () => {
    const fixture = {
      config: { mode: 'single_turn' },
      output: {
        error: {
          code: 'LLM_RESPONSE_INVALID',
          message: 'Failed to parse JSON after 3 attempts',
          details: { attempts: 3, originalInput: 'garbage' },
        },
      },
      meta: { durationMs: 3200 },
      port: 'error',
      status: 'ended',
    };
    const result = informationExtractorNodeOutputSchema.safeParse(fixture);
    expect(result.success).toBe(true);
  });

  it('accepts multi-turn waiting output (legacy resume fields retained for Stage 2)', () => {
    const fixture = {
      status: 'waiting_for_input',
      interactionType: 'ai_conversation',
      conversationConfig: { message: 'need more info', turnCount: 1 },
    };
    const result = informationExtractorNodeOutputSchema.safeParse(fixture);
    expect(result.success).toBe(true);
  });

  it('accepts multi-turn completion with endReason + messages', () => {
    const fixture = {
      config: { mode: 'multi_turn', maxTurns: 10, maxCollectionRetries: 3 },
      output: {
        result: {
          extracted: { orderId: 'ORD-123' },
          endReason: 'completed',
          turnCount: 3,
          messages: [{ role: 'user', content: 'hi' }],
        },
      },
      meta: {
        durationMs: 950,
        model: 'gpt-4o',
        inputTokens: 200,
        outputTokens: 50,
        totalTokens: 250,
        collectionRetryCount: 0,
        turnDebug: [],
      },
      port: 'completed',
      status: 'ended',
    };
    const result = informationExtractorNodeOutputSchema.safeParse(fixture);
    expect(result.success).toBe(true);
  });

  it('preserves unknown keys via passthrough', () => {
    const fixture = { output: {}, unexpectedFutureKey: 42 };
    const result = informationExtractorNodeOutputSchema.safeParse(fixture);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({ unexpectedFutureKey: 42 });
    }
  });

  it('rejects meta with wrong numeric field type', () => {
    const fixture = {
      output: { result: { extracted: {} } },
      meta: { model: 'gpt-4o', inputTokens: 'bogus' },
    };
    const result = informationExtractorNodeOutputSchema.safeParse(fixture);
    expect(result.success).toBe(false);
  });
});
