import { z } from 'zod';
import { aiAgentNodeConfigSchema } from './ai-agent.schema';

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
