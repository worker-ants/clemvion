import { z } from 'zod';
import { evaluateWarnings } from '@workflow/node-summary';
import {
  aiAgentNodeConfigSchema,
  aiAgentNodeMetadata,
  aiAgentNodeOutputSchema,
  validateAiAgentConfig,
} from './ai-agent.schema';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';
import { PRESENTATION_TYPES } from '../../../shared/conversation-thread/conversation-thread.types';

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
    expect(result.maxTurns).toBe(20);
    // Conversation Context (spec/conventions/conversation-thread.md §5).
    // Defaults preserve existing workflow behaviour: contextScope='none' so
    // no auto-injection; opt-out flags off; tool turns excluded from thread.
    expect(result.contextScope).toBe('none');
    expect(result.contextScopeN).toBe(20);
    expect(result.contextInjectionMode).toBe('messages');
    expect(result.includeToolTurns).toBe(false);
    expect(result.excludeFromConversationThread).toBe(false);
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

  it('applies Memory strategy defaults (manual / 8000 / 5 / 0.7)', () => {
    const result = aiAgentNodeConfigSchema.parse({});
    // 하위호환 불변식 — 기존 워크플로는 memoryStrategy 키가 없으며 default 는
    // manual (기존 contextScope 5필드 동작 그대로).
    expect(result.memoryStrategy).toBe('manual');
    expect(result.memoryTokenBudget).toBe(8000);
    expect(result.memoryTopK).toBe(5);
    expect(result.memoryThreshold).toBe(0.7);
    // memoryKey 는 optional (default 없음).
    expect(result.memoryKey).toBeUndefined();
  });

  it('accepts summary_buffer and persistent memory strategies', () => {
    expect(
      aiAgentNodeConfigSchema.parse({ memoryStrategy: 'summary_buffer' })
        .memoryStrategy,
    ).toBe('summary_buffer');
    expect(
      aiAgentNodeConfigSchema.parse({ memoryStrategy: 'persistent' })
        .memoryStrategy,
    ).toBe('persistent');
  });

  it('rejects an unknown memory strategy enum value', () => {
    const result = aiAgentNodeConfigSchema.safeParse({
      memoryStrategy: 'auto',
    });
    expect(result.success).toBe(false);
  });

  it('serialises Memory field visibleWhen + group metadata to JSON Schema', () => {
    const jsonSchema = z.toJSONSchema(aiAgentNodeConfigSchema) as unknown as {
      properties?: Record<string, { ui?: Record<string, unknown> }>;
    };
    expect(jsonSchema.properties?.memoryStrategy?.ui).toMatchObject({
      widget: 'select',
      group: 'Memory',
    });
    // Token Budget — summary_buffer/persistent 둘 다에서 노출 (oneOf 화이트리스트,
    // 단일-필드 평가기라 복합 AND 불가).
    expect(jsonSchema.properties?.memoryTokenBudget?.ui).toMatchObject({
      group: 'Memory',
      visibleWhen: {
        field: 'memoryStrategy',
        oneOf: ['summary_buffer', 'persistent'],
      },
    });
    // Memory Key / Top-K / Threshold — persistent 전용.
    expect(jsonSchema.properties?.memoryKey?.ui).toMatchObject({
      visibleWhen: { field: 'memoryStrategy', equals: 'persistent' },
    });
    expect(jsonSchema.properties?.memoryTopK?.ui).toMatchObject({
      visibleWhen: { field: 'memoryStrategy', equals: 'persistent' },
    });
    expect(jsonSchema.properties?.memoryThreshold?.ui).toMatchObject({
      visibleWhen: { field: 'memoryStrategy', equals: 'persistent' },
    });
  });

  it('hides Conversation Context fields when memoryStrategy != manual (visibleWhen)', () => {
    const jsonSchema = z.toJSONSchema(aiAgentNodeConfigSchema) as unknown as {
      properties?: Record<string, { ui?: Record<string, unknown> }>;
    };
    // contextScope / contextInjectionMode / includeToolTurns 는 manual 일 때만
    // 노출 (자동 전략이 5필드를 대체 — spec §1 비고).
    expect(jsonSchema.properties?.contextScope?.ui).toMatchObject({
      visibleWhen: { field: 'memoryStrategy', equals: 'manual' },
    });
    expect(jsonSchema.properties?.contextInjectionMode?.ui).toMatchObject({
      visibleWhen: { field: 'memoryStrategy', equals: 'manual' },
    });
    expect(jsonSchema.properties?.includeToolTurns?.ui).toMatchObject({
      visibleWhen: { field: 'memoryStrategy', equals: 'manual' },
    });
  });

  it('exposes the presentationTools item type default in JSON Schema', () => {
    // buildNewItem (frontend) reads JSON Schema `default` to pre-fill new rows
    // so the displayed first option is committed instead of saved as `{}`.
    const jsonSchema = z.toJSONSchema(aiAgentNodeConfigSchema) as unknown as {
      properties?: {
        presentationTools?: {
          items?: { properties?: { type?: { default?: unknown } } };
        };
      };
    };
    expect(
      jsonSchema.properties?.presentationTools?.items?.properties?.type
        ?.default,
    ).toBe(PRESENTATION_TYPES[0]);
  });
});

describe('aiAgentNodeOutputSchema', () => {
  // The autocomplete-hint schema is permissive — real handler returns must
  // parse successfully, and parseless fields (unknown keys) must pass through.
  // Phase 1 (D) — fixtures now describe the inner `output` namespace of the
  // canonical 5-field NodeHandlerOutput. Single-turn / multi-turn ended /
  // condition all expose `output.result.*`; errors expose `output.error.*`.
  // D6 (2026-05-17) — multi-turn waiting/resumed snapshots 도 `output.result.*`
  // 단일 경로로 통일 (옛 top-level `output.messages` / `message` / `turnCount`
  // / `maxTurns` 폐기).
  it('accepts a single-turn success `output.result.*` return', () => {
    const fixture = {
      result: {
        response: 'Hello from the agent',
        endReason: 'out',
        turnCount: 1,
      },
    };
    const result = aiAgentNodeOutputSchema.safeParse(fixture);
    expect(result.success).toBe(true);
  });

  it('accepts a multi-turn waiting `output.result.*` return (D6)', () => {
    const fixture = {
      result: {
        messages: [],
        message: '',
        turnCount: 0,
        maxTurns: 20,
      },
    };
    const result = aiAgentNodeOutputSchema.safeParse(fixture);
    expect(result.success).toBe(true);
  });

  it('accepts a multi-turn final `output.result.*` return with endReason', () => {
    const fixture = {
      result: {
        response: 'Goodbye',
        messages: [{ role: 'assistant', content: 'Goodbye' }],
        turnCount: 3,
        endReason: 'user_ended',
      },
    };
    const result = aiAgentNodeOutputSchema.safeParse(fixture);
    expect(result.success).toBe(true);
  });

  it('accepts condition-route `output.result.condition.*` output', () => {
    const fixture = {
      result: {
        response: 'Routing to refund handler',
        endReason: 'condition',
        turnCount: 1,
        condition: {
          id: 'refund',
          label: 'Refund',
          reason: 'user asked for refund',
        },
      },
    };
    const result = aiAgentNodeOutputSchema.safeParse(fixture);
    expect(result.success).toBe(true);
  });

  it('accepts an `output.error.*` return', () => {
    const fixture = {
      error: {
        code: 'LLM_CALL_FAILED',
        message: 'OpenAI API returned 503 after 3 retries',
        details: { provider: 'openai', statusCode: 503 },
      },
    };
    const result = aiAgentNodeOutputSchema.safeParse(fixture);
    expect(result.success).toBe(true);
  });

  it('accepts a multi-turn resumed `output.interaction.*` snapshot', () => {
    const fixture = {
      messages: [{ role: 'user', content: '환불 문의입니다' }],
      interaction: {
        type: 'message_received',
        data: { content: '환불 문의입니다', role: 'user' },
        receivedAt: '2026-05-10T06:42:01.123Z',
      },
    };
    const result = aiAgentNodeOutputSchema.safeParse(fixture);
    expect(result.success).toBe(true);
  });

  it('preserves unknown keys via passthrough', () => {
    const fixture = {
      result: { response: 'x' },
      futureField: { arbitrary: true },
    };
    const result = aiAgentNodeOutputSchema.safeParse(fixture);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({ futureField: { arbitrary: true } });
    }
  });

  it('rejects result with wrong type for turnCount', () => {
    // Type guard: the autocomplete schema still rejects obvious mismatches
    // on the few stable fields it enumerates (turnCount must be a number).
    const fixture = {
      result: { response: 'x', turnCount: 'not-a-number' },
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

  // ── presentationTools (spec/4-nodes/3-ai/1-ai-agent.md §1, §4.1) ──
  it('defaults presentationTools to empty array (feature OFF)', () => {
    const result = aiAgentNodeConfigSchema.parse({});
    expect(result.presentationTools).toEqual([]);
  });

  it('accepts presentationTools with 5 types', () => {
    const tools = [
      { type: 'table' },
      { type: 'chart' },
      { type: 'carousel' },
      { type: 'template' },
      { type: 'form' },
    ];
    const result = aiAgentNodeConfigSchema.parse({ presentationTools: tools });
    expect(result.presentationTools).toHaveLength(5);
  });

  it('defaults a presentationTool row with missing type to the first enum value', () => {
    // Regression: the frontend field-array "add row" widget persisted `{}`
    // because the native <select> showed the first option (table) without
    // committing it to form state. The zod `.default` now coerces an absent
    // type → first PRESENTATION_TYPES value so a stale `{}` row hydrates as a
    // valid tool instead of triggering `RenderToolProvider: Skipping ... type:
    // undefined` at runtime.
    const result = aiAgentNodeConfigSchema.parse({ presentationTools: [{}] });
    expect(result.presentationTools[0].type).toBe(PRESENTATION_TYPES[0]);
  });

  it('accepts presentationTool with description and defaults overlay', () => {
    const result = aiAgentNodeConfigSchema.parse({
      presentationTools: [
        {
          type: 'table',
          description: '주문 표 — 컬럼은 정의되어 있고 rows만 채워라',
          defaults: { columns: [{ field: 'id', label: 'ID' }] },
        },
      ],
    });
    expect(result.presentationTools[0].description).toContain('주문 표');
    expect(result.presentationTools[0].defaults).toMatchObject({
      columns: [{ field: 'id', label: 'ID' }],
    });
  });

  it('rejects unknown presentationTool type', () => {
    const result = aiAgentNodeConfigSchema.safeParse({
      presentationTools: [{ type: 'unknown' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects duplicate presentationTool type within a node', () => {
    const errors = validateAiAgentConfig({
      presentationTools: [{ type: 'table' }, { type: 'table' }],
    });
    expect(errors).toContain(
      "presentationTools: duplicate type 'table' — each presentation tool type may be registered at most once",
    );
  });

  // ai-review SUMMARY #6 — defaults 자체의 바이트 크기 상한 검증 (256KB).
  it('rejects presentationTool defaults > 256KB (PRESENTATION_DEFAULTS_MAX_BYTES)', () => {
    // 빅 string 으로 300KB 짜리 defaults 만들기.
    const big = 'A'.repeat(300 * 1024);
    const errors = validateAiAgentConfig({
      presentationTools: [{ type: 'table', defaults: { padding: big } }],
    });
    expect(
      errors.some((e) =>
        e.startsWith('presentationTools[0]: defaults must be ≤'),
      ),
    ).toBe(true);
  });

  it('accepts presentationTool defaults under 256KB cap', () => {
    const small = 'B'.repeat(1024); // 1KB
    const errors = validateAiAgentConfig({
      presentationTools: [{ type: 'table', defaults: { padding: small } }],
    });
    expect(errors.some((e) => e.startsWith('presentationTools['))).toBe(false);
  });
});

describe('evaluateMetadataBlockingErrors integration (ai_agent)', () => {
  it('emits the expected warnings on a freshly-created node', () => {
    const errors = evaluateMetadataBlockingErrors(aiAgentNodeMetadata, {});
    // both "no provider" and "single-turn needs prompt" should fire
    expect(errors.some((e) => e.includes('LLM provider'))).toBe(true);
    expect(errors).toContain(
      'Either System Prompt or User Prompt must be entered.',
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
