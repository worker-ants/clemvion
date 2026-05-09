import { z } from 'zod';
import { evaluateWarnings } from '@workflow/node-summary';
import {
  aiAgentNodeConfigSchema,
  aiAgentNodeMetadata,
  aiAgentNodeOutputSchema,
  validateAiAgentConfig,
} from './ai-agent.schema';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';

describe('aiAgentNodeConfigSchema', () => {
  it('applies defaults for empty input', () => {
    const result = aiAgentNodeConfigSchema.parse({});
    expect(result.mode).toBe('single_turn');
    expect(result.responseFormat).toBe('text');
    expect(result.knowledgeBases).toEqual([]);
    expect(result.ragTopK).toBe(5);
    expect(result.ragThreshold).toBe(0.7);
    expect(result.conditions).toEqual([]);
    expect(result.maxToolCalls).toBe(10);
    expect(result.conversationHistory).toBe('none');
    expect(result.maxTurns).toBe(20);
  });

  it('accepts multi_turn mode', () => {
    const result = aiAgentNodeConfigSchema.parse({ mode: 'multi_turn' });
    expect(result.mode).toBe('multi_turn');
  });

  it('mode.clearFields includes userPrompt to prevent leak across mode switch', () => {
    // single_turn 에서 입력한 userPrompt 가 multi_turn 으로 전환될 때 frontend
    // auto-form 의 applyClearFields 로 자동 제거되어야 한다. visibleWhen 만으로는
    // 화면에서 숨겨질 뿐 config 값은 남아 backend 가 의도치 않은 첫 LLM 호출을
    // trigger 한다.
    const jsonSchema = z.toJSONSchema(aiAgentNodeConfigSchema) as unknown as {
      properties?: { mode?: { ui?: { clearFields?: string[] } } };
    };
    const clearFields = jsonSchema.properties?.mode?.ui?.clearFields ?? [];
    expect(clearFields).toContain('userPrompt');
  });

  it('accepts valid conditions with required id', () => {
    const cond = { id: 'cond-1', label: 'Refund', prompt: 'About refunds' };
    const result = aiAgentNodeConfigSchema.parse({ conditions: [cond] });
    expect(result.conditions).toEqual([cond]);
  });

  it('rejects conditions without id', () => {
    const result = aiAgentNodeConfigSchema.safeParse({
      conditions: [{ label: 'x', prompt: 'y' }],
    });
    expect(result.success).toBe(false);
  });

  it('surfaces `ui` metadata on fields in JSON Schema output', () => {
    const jsonSchema = z.toJSONSchema(aiAgentNodeConfigSchema) as unknown as {
      properties?: Record<string, { ui?: Record<string, unknown> }>;
    };
    expect(jsonSchema.properties?.mode?.ui).toMatchObject({
      widget: 'select',
    });
    expect(jsonSchema.properties?.userPrompt?.ui).toMatchObject({
      visibleWhen: { field: 'mode', notEquals: 'multi_turn' },
    });
    expect(jsonSchema.properties?.knowledgeBases?.ui).toMatchObject({
      widget: 'kb-selector',
      group: 'Knowledge Base (RAG)',
    });
    expect(jsonSchema.properties?.maxTurns?.ui).toMatchObject({
      group: 'Multi Turn Settings',
      visibleWhen: { field: 'mode', equals: 'multi_turn' },
    });
    expect(jsonSchema.properties?.systemPrompt?.ui).toMatchObject({
      widget: 'expression',
      multiline: true,
    });
  });
});

describe('aiAgentNodeOutputSchema', () => {
  // The autocomplete-hint schema is permissive — real handler returns must
  // parse successfully, and parseless fields (unknown keys) must pass through.
  it('accepts a single-turn success return', () => {
    const fixture = {
      response: 'Hello from the agent',
      metadata: {
        model: 'gpt-4o',
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
        toolCalls: 0,
        ragSources: [],
      },
    };
    const result = aiAgentNodeOutputSchema.safeParse(fixture);
    expect(result.success).toBe(true);
  });

  it('accepts a multi-turn waiting return', () => {
    const fixture = {
      status: 'waiting_for_input',
      interactionType: 'ai_conversation',
      conversationConfig: {
        message: '',
        messages: [],
        turnCount: 0,
        maxTurns: 20,
      },
    };
    const result = aiAgentNodeOutputSchema.safeParse(fixture);
    expect(result.success).toBe(true);
  });

  it('accepts a multi-turn final return with endReason', () => {
    const fixture = {
      interactionType: 'ai_conversation',
      response: 'Goodbye',
      messages: [{ role: 'assistant', content: 'Goodbye' }],
      turnCount: 3,
      endReason: 'user_ended',
      metadata: {
        model: 'gpt-4o',
        totalTokens: 100,
      },
    };
    const result = aiAgentNodeOutputSchema.safeParse(fixture);
    expect(result.success).toBe(true);
  });

  it('accepts condition-route output', () => {
    const fixture = {
      condition: {
        id: 'refund',
        label: 'Refund',
        reason: 'user asked for refund',
      },
      response: 'Routing to refund handler',
    };
    const result = aiAgentNodeOutputSchema.safeParse(fixture);
    expect(result.success).toBe(true);
  });

  it('preserves unknown keys via passthrough', () => {
    const fixture = {
      response: 'x',
      futureField: { arbitrary: true },
    };
    const result = aiAgentNodeOutputSchema.safeParse(fixture);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({ futureField: { arbitrary: true } });
    }
  });

  it('rejects metadata with wrong numeric field type', () => {
    const fixture = {
      response: 'x',
      metadata: { model: 'gpt-4o', inputTokens: 'not-a-number' },
    };
    const result = aiAgentNodeOutputSchema.safeParse(fixture);
    expect(result.success).toBe(false);
  });
});

describe('aiAgentNodeMetadata.warningRules', () => {
  const firedIds = (config: unknown) =>
    evaluateWarnings(
      config as Record<string, unknown>,
      aiAgentNodeMetadata.warningRules,
    ).map((w) => w.id);

  describe('ai_agent:no-llm-provider', () => {
    it('fires when both model and llmConfigId are missing', () => {
      expect(firedIds({})).toContain('ai_agent:no-llm-provider');
    });

    it('does NOT fire when model is set', () => {
      expect(firedIds({ model: 'gpt-4o' })).not.toContain(
        'ai_agent:no-llm-provider',
      );
    });

    it('does NOT fire when llmConfigId is set', () => {
      expect(firedIds({ llmConfigId: 'cfg-1' })).not.toContain(
        'ai_agent:no-llm-provider',
      );
    });
  });

  describe('ai_agent:multi-turn-needs-system-prompt', () => {
    it('fires when mode=multi_turn and systemPrompt is missing', () => {
      expect(firedIds({ mode: 'multi_turn' })).toContain(
        'ai_agent:multi-turn-needs-system-prompt',
      );
    });

    it('does NOT fire when systemPrompt is set', () => {
      expect(
        firedIds({ mode: 'multi_turn', systemPrompt: 'You are a bot' }),
      ).not.toContain('ai_agent:multi-turn-needs-system-prompt');
    });

    it('does NOT fire when mode is single_turn', () => {
      expect(firedIds({ mode: 'single_turn' })).not.toContain(
        'ai_agent:multi-turn-needs-system-prompt',
      );
    });
  });

  describe('ai_agent:single-turn-needs-prompt', () => {
    it('fires for default (single_turn) mode when both prompts are missing', () => {
      expect(firedIds({})).toContain('ai_agent:single-turn-needs-prompt');
    });

    it('does NOT fire when systemPrompt is set', () => {
      expect(firedIds({ systemPrompt: 'sys' })).not.toContain(
        'ai_agent:single-turn-needs-prompt',
      );
    });

    it('does NOT fire when userPrompt is set', () => {
      expect(firedIds({ userPrompt: '{{ $input.q }}' })).not.toContain(
        'ai_agent:single-turn-needs-prompt',
      );
    });

    it('does NOT fire in multi_turn mode', () => {
      expect(firedIds({ mode: 'multi_turn' })).not.toContain(
        'ai_agent:single-turn-needs-prompt',
      );
    });
  });

  describe('ai_agent:too-many-conditions', () => {
    it('fires when more than 20 conditions are added', () => {
      const conditions = Array.from({ length: 21 }, (_, i) => ({
        id: `c${i}`,
        label: 'l',
        prompt: 'p',
      }));
      expect(firedIds({ conditions })).toContain(
        'ai_agent:too-many-conditions',
      );
    });

    it('does NOT fire at exactly 20 conditions', () => {
      const conditions = Array.from({ length: 20 }, (_, i) => ({
        id: `c${i}`,
        label: 'l',
        prompt: 'p',
      }));
      expect(firedIds({ conditions })).not.toContain(
        'ai_agent:too-many-conditions',
      );
    });
  });
});

describe('validateAiAgentConfig (imperative)', () => {
  it('returns [] for a fully valid single_turn config', () => {
    expect(
      validateAiAgentConfig({
        mode: 'single_turn',
        systemPrompt: 'sys',
        model: 'gpt-4o',
      }),
    ).toEqual([]);
  });

  it('rejects negative maxTurns in multi_turn mode', () => {
    expect(
      validateAiAgentConfig({ mode: 'multi_turn', maxTurns: -1 }),
    ).toContain('maxTurns must be 0 (unlimited) or a positive integer');
  });

  it('rejects non-numeric maxTurns in multi_turn mode', () => {
    expect(
      validateAiAgentConfig({ mode: 'multi_turn', maxTurns: '20' as never }),
    ).toContain('maxTurns must be 0 (unlimited) or a positive integer');
  });

  it('skips maxTurns validation in single_turn mode', () => {
    expect(
      validateAiAgentConfig({ mode: 'single_turn', maxTurns: -5 as never }),
    ).toEqual([]);
  });

  it('rejects condition with missing id', () => {
    expect(
      validateAiAgentConfig({
        conditions: [{ label: 'l', prompt: 'p' }],
      }),
    ).toContain('conditions[0]: id is required');
  });

  it('rejects condition with reserved port id', () => {
    expect(
      validateAiAgentConfig({
        conditions: [{ id: 'out', label: 'l', prompt: 'p' }],
      }),
    ).toContain("conditions[0]: id 'out' conflicts with reserved port name");
  });

  it('rejects condition with missing label / prompt', () => {
    const errors = validateAiAgentConfig({
      conditions: [{ id: 'c1' }],
    });
    expect(errors).toContain('conditions[0]: label is required');
    expect(errors).toContain('conditions[0]: prompt is required');
  });

  it('rejects condition with prompt > 2000 chars', () => {
    const longPrompt = 'a'.repeat(2001);
    expect(
      validateAiAgentConfig({
        conditions: [{ id: 'c1', label: 'l', prompt: longPrompt }],
      }),
    ).toContain('conditions[0]: prompt must be 2000 characters or less');
  });
});

describe('evaluateMetadataBlockingErrors integration (ai_agent)', () => {
  it('emits the expected warnings on a freshly-created node', () => {
    const errors = evaluateMetadataBlockingErrors(aiAgentNodeMetadata, {});
    // both "no provider" and "single-turn needs prompt" should fire
    expect(errors.some((e) => e.includes('LLM provider'))).toBe(true);
    expect(errors).toContain(
      'System Prompt 또는 User Prompt 중 하나는 입력해야 합니다.',
    );
  });

  it('returns [] when fully configured', () => {
    expect(
      evaluateMetadataBlockingErrors(aiAgentNodeMetadata, {
        mode: 'single_turn',
        model: 'gpt-4o',
        systemPrompt: 'sys',
      }),
    ).toEqual([]);
  });
});
