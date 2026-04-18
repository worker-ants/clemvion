import { z } from 'zod';
import {
  aiAgentNodeConfigSchema,
  aiAgentNodeOutputSchema,
} from './ai-agent.schema';

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
    const jsonSchema = z.toJSONSchema(aiAgentNodeConfigSchema) as {
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
