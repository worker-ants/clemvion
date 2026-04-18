import { informationExtractorNodeOutputSchema } from './information-extractor.schema';

describe('informationExtractorNodeOutputSchema', () => {
  // Autocomplete-hint schema. The handler returns a legacy port-selector that
  // the adapter unwraps into a nested `{ config, output, meta }` value, so the
  // fixtures here mirror that nested shape.
  it('accepts a successful single-turn extraction', () => {
    const fixture = {
      config: {
        schema: [
          { name: 'orderId', type: 'string', description: '', required: true },
        ],
      },
      output: {
        extracted: { orderId: 'ORD-123' },
      },
      meta: {
        model: 'gpt-4o',
        inputTokens: 20,
        outputTokens: 5,
        totalTokens: 25,
      },
    };
    const result = informationExtractorNodeOutputSchema.safeParse(fixture);
    expect(result.success).toBe(true);
  });

  it('accepts an error-port output', () => {
    const fixture = {
      output: {
        error: 'LLM failed to extract',
        originalInput: 'garbage',
      },
    };
    const result = informationExtractorNodeOutputSchema.safeParse(fixture);
    expect(result.success).toBe(true);
  });

  it('accepts multi-turn waiting output', () => {
    const fixture = {
      status: 'waiting_for_input',
      interactionType: 'ai_conversation',
      conversationConfig: { message: 'need more info', turnCount: 1 },
      turnCount: 1,
      partialResult: { orderId: 'ORD-123' },
    };
    const result = informationExtractorNodeOutputSchema.safeParse(fixture);
    expect(result.success).toBe(true);
  });

  it('accepts completion with endReason', () => {
    const fixture = {
      output: { extracted: { orderId: 'ORD-123' } },
      turnCount: 3,
      endReason: 'completed',
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
      output: { extracted: {} },
      meta: { model: 'gpt-4o', inputTokens: 'bogus' },
    };
    const result = informationExtractorNodeOutputSchema.safeParse(fixture);
    expect(result.success).toBe(false);
  });
});
