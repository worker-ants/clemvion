import { evaluateWarnings } from '@workflow/node-summary';
import {
  informationExtractorNodeMetadata,
  informationExtractorNodeOutputSchema,
  validateInformationExtractorConfig,
} from './information-extractor.schema';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';

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

describe('informationExtractorNodeMetadata.warningRules', () => {
  const firedIds = (config: unknown) =>
    evaluateWarnings(
      config as Record<string, unknown>,
      informationExtractorNodeMetadata.warningRules,
    ).map((w) => w.id);

  describe('information_extractor:no-llm-provider', () => {
    it('fires when both model and llmConfigId are missing', () => {
      expect(firedIds({})).toContain('information_extractor:no-llm-provider');
    });

    it('does NOT fire when model is set', () => {
      expect(firedIds({ model: 'gpt-4o' })).not.toContain(
        'information_extractor:no-llm-provider',
      );
    });
  });

  describe('information_extractor:no-output-schema', () => {
    it('fires when outputSchema is missing', () => {
      expect(firedIds({})).toContain('information_extractor:no-output-schema');
    });

    it('fires when outputSchema is empty array', () => {
      expect(firedIds({ outputSchema: [] })).toContain(
        'information_extractor:no-output-schema',
      );
    });

    it('does NOT fire when at least one field is defined', () => {
      expect(
        firedIds({ outputSchema: [{ name: 'orderId', type: 'string' }] }),
      ).not.toContain('information_extractor:no-output-schema');
    });
  });

  describe('information_extractor:single-turn-needs-input-field', () => {
    it('fires for default mode (single_turn) when inputField is missing', () => {
      expect(firedIds({})).toContain(
        'information_extractor:single-turn-needs-input-field',
      );
    });

    it('does NOT fire when inputField is set', () => {
      expect(firedIds({ inputField: '$input.text' })).not.toContain(
        'information_extractor:single-turn-needs-input-field',
      );
    });

    it('does NOT fire in multi_turn mode', () => {
      expect(firedIds({ mode: 'multi_turn' })).not.toContain(
        'information_extractor:single-turn-needs-input-field',
      );
    });
  });
});

describe('validateInformationExtractorConfig (imperative)', () => {
  it('returns [] for a fully valid single_turn config', () => {
    expect(
      validateInformationExtractorConfig({
        outputSchema: [{ name: 'orderId', type: 'string' }],
      }),
    ).toEqual([]);
  });

  it('flags missing field name / type', () => {
    const errors = validateInformationExtractorConfig({
      outputSchema: [{ description: 'x' }, { name: 'orderId' }],
    });
    expect(errors).toContain('Field 1: name is required');
    expect(errors).toContain('Field 1: type is required');
    expect(errors).toContain('Field 2: type is required');
  });

  it('rejects negative maxTurns in multi_turn mode', () => {
    expect(
      validateInformationExtractorConfig({
        mode: 'multi_turn',
        maxTurns: -1,
      }),
    ).toContain('maxTurns must be 0 (unlimited) or a positive integer');
  });

  it('skips maxTurns validation in single_turn mode', () => {
    expect(
      validateInformationExtractorConfig({ maxTurns: -5 as never }),
    ).toEqual([]);
  });
});

describe('evaluateMetadataBlockingErrors integration (information_extractor)', () => {
  it('emits warnings on a freshly-created node', () => {
    const errors = evaluateMetadataBlockingErrors(
      informationExtractorNodeMetadata,
      {},
    );
    expect(errors.some((e) => e.includes('LLM provider'))).toBe(true);
    expect(errors).toContain('At least one extraction field must be defined.');
    expect(errors).toContain(
      'In Single Turn mode, Input Field must be entered.',
    );
  });

  it('returns [] when fully configured', () => {
    expect(
      evaluateMetadataBlockingErrors(informationExtractorNodeMetadata, {
        model: 'gpt-4o',
        outputSchema: [{ name: 'orderId', type: 'string' }],
        inputField: '$input.text',
      }),
    ).toEqual([]);
  });
});
