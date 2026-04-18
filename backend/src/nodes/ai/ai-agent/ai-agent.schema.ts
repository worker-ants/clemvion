import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

const toolOverrideSchema = z.object({
  nodeId: z.string().meta({
    ui: { label: 'Node ID', widget: 'text' },
  }),
  toolName: z
    .string()
    .optional()
    .meta({ ui: { label: 'Tool Name', widget: 'text' } }),
  toolDescription: z
    .string()
    .optional()
    .meta({ ui: { label: 'Tool Description', widget: 'textarea' } }),
  inputMapping: z
    .array(z.record(z.string(), z.unknown()))
    .optional()
    .meta({ ui: { label: 'Input Mapping', widget: 'field-array' } }),
});

const conditionDefSchema = z.object({
  id: z.string().meta({ ui: { label: 'ID', widget: 'text', hidden: true } }),
  label: z
    .string()
    .default('')
    .meta({
      ui: {
        label: 'Label',
        widget: 'text',
        placeholder: 'Label (e.g. Refund Request)',
      },
    }),
  prompt: z
    .string()
    .default('')
    .meta({
      ui: {
        label: 'Prompt',
        widget: 'text',
        placeholder: 'Prompt (when to trigger this condition)',
      },
    }),
});

export const aiAgentNodeConfigSchema = z
  .object({
    mode: z
      .enum(['single_turn', 'multi_turn'])
      .default('single_turn')
      .meta({
        ui: {
          label: 'Mode',
          widget: 'select',
          order: 0,
          options: [
            { value: 'single_turn', label: 'Single Turn' },
            { value: 'multi_turn', label: 'Multi Turn (Conversation)' },
          ],
        },
      }),
    llmConfigId: z
      .string()
      .optional()
      .meta({
        ui: {
          label: 'LLM Provider',
          widget: 'llm-config-selector',
          order: 1,
        },
      }),
    model: z
      .string()
      .optional()
      .meta({
        ui: {
          label: 'Model Override',
          widget: 'expression',
          placeholder: 'Leave empty for provider default',
          order: 2,
        },
      }),
    systemPrompt: z
      .string()
      .optional()
      .meta({
        ui: {
          label: 'System Prompt',
          widget: 'expression',
          placeholder: 'You are a helpful assistant...',
          hint: 'Supports markdown and expressions',
          order: 3,
        },
      }),
    userPrompt: z
      .string()
      .optional()
      .meta({
        ui: {
          label: 'User Prompt',
          widget: 'expression',
          placeholder: '{{ $input.question }}',
          hint: 'Expression to build the user message',
          order: 4,
          visibleWhen: { field: 'mode', notEquals: 'multi_turn' },
        },
      }),
    responseFormat: z
      .enum(['text', 'json'])
      .default('text')
      .meta({ ui: { label: 'Response Format', widget: 'select', order: 5 } }),
    jsonSchema: z
      .record(z.string(), z.unknown())
      .optional()
      .meta({
        ui: {
          label: 'JSON Schema',
          widget: 'code',
          language: 'json',
          placeholder: '{"type": "object", "properties": {...}}',
          order: 6,
          visibleWhen: { field: 'responseFormat', equals: 'json' },
        },
      }),

    // ── Knowledge Base (RAG) ──
    knowledgeBases: z
      .array(z.string())
      .default([])
      .meta({
        ui: {
          label: 'Knowledge Bases',
          widget: 'kb-selector',
          order: 10,
          group: 'Knowledge Base (RAG)',
        },
      }),
    ragTopK: z
      .number()
      .int()
      .default(5)
      .meta({
        ui: {
          label: 'RAG Top-K',
          widget: 'number',
          hint: 'Number of chunks to retrieve',
          order: 11,
          group: 'Knowledge Base (RAG)',
        },
      }),
    ragThreshold: z
      .number()
      .default(0.7)
      .meta({
        ui: {
          label: 'RAG Threshold',
          widget: 'number',
          hint: 'Minimum similarity score (0-1)',
          order: 12,
          group: 'Knowledge Base (RAG)',
        },
      }),

    // ── Conditions ──
    conditions: z
      .array(conditionDefSchema)
      .default([])
      .meta({
        ui: {
          label: 'Conditions',
          widget: 'field-array',
          itemLabel: 'Condition',
          order: 20,
          group: 'Conditions',
        },
      }),

    // ── Advanced ──
    temperature: z
      .number()
      .optional()
      .meta({
        ui: {
          label: 'Temperature',
          widget: 'number',
          hint: '0 = deterministic, 2 = creative',
          order: 30,
          group: 'Advanced',
        },
      }),
    maxTokens: z
      .number()
      .int()
      .optional()
      .meta({
        ui: {
          label: 'Max Tokens',
          widget: 'number',
          order: 31,
          group: 'Advanced',
        },
      }),
    maxToolCalls: z
      .number()
      .int()
      .default(10)
      .meta({
        ui: {
          label: 'Max Tool Calls',
          widget: 'number',
          order: 32,
          group: 'Advanced',
        },
      }),
    toolNodeIds: z
      .array(z.string())
      .default([])
      .meta({
        ui: {
          label: 'Tool Node IDs',
          widget: 'field-array',
          order: 33,
          group: 'Advanced',
        },
      }),
    toolOverrides: z
      .array(toolOverrideSchema)
      .default([])
      .meta({
        ui: {
          label: 'Tool Overrides',
          widget: 'field-array',
          itemLabel: 'Tool',
          order: 34,
          group: 'Advanced',
        },
      }),
    conversationHistory: z
      .enum(['none', 'last_n', 'full'])
      .default('none')
      .meta({
        ui: {
          label: 'Conversation History',
          widget: 'select',
          order: 35,
          group: 'Advanced',
          options: [
            { value: 'none', label: 'None' },
            { value: 'last_n', label: 'Last N Messages' },
            { value: 'full', label: 'Full History' },
          ],
        },
      }),
    historyCount: z
      .number()
      .int()
      .optional()
      .meta({
        ui: {
          label: 'History Count',
          widget: 'number',
          order: 36,
          group: 'Advanced',
          visibleWhen: { field: 'conversationHistory', equals: 'last_n' },
        },
      }),

    // ── Multi Turn Settings ──
    maxTurns: z
      .number()
      .int()
      .default(20)
      .meta({
        ui: {
          label: 'Max Turns',
          widget: 'number',
          hint: '0 = unlimited',
          order: 40,
          group: 'Multi Turn Settings',
          visibleWhen: { field: 'mode', equals: 'multi_turn' },
        },
      }),
  })
  .passthrough();
export type AiAgentConfig = z.infer<typeof aiAgentNodeConfigSchema>;

/**
 * AUTOCOMPLETE HINT SCHEMA — not used for runtime validation.
 *
 * Serialised via `z.toJSONSchema()` and sent to the frontend where it drives
 * `$node["X"].output.<field>` suggestions. The AI Agent handler returns a
 * legacy bare object (no `config/output` wrapper) so this schema describes a
 * FLAT output — contrast with `information-extractor` whose handler returns
 * `{ port, data: { config, output, meta } }` and surfaces a NESTED schema.
 *
 * The schema is a superset of every mode's return shape (single-turn, multi-
 * turn waiting, multi-turn final, condition route) and is intentionally
 * permissive (`.passthrough()` + `.optional()`) — we only need to enumerate
 * stable keys for autocomplete, not reject runtime data.
 */
export const aiAgentNodeOutputSchema = z
  .object({
    response: z.unknown().optional(),
    interactionType: z.string().optional(),
    status: z.string().optional(),
    messages: z.array(z.unknown()).optional(),
    turnCount: z.number().optional(),
    endReason: z.string().optional(),
    conversationConfig: z
      .object({
        message: z.string(),
        messages: z.array(z.unknown()),
        turnCount: z.number(),
        maxTurns: z.number(),
      })
      .partial()
      .passthrough()
      .optional(),
    condition: z
      .object({
        id: z.string(),
        label: z.string(),
        reason: z.string(),
      })
      .partial()
      .optional(),
    metadata: z
      .object({
        model: z.string(),
        inputTokens: z.number(),
        outputTokens: z.number(),
        totalTokens: z.number(),
        thinkingTokens: z.number(),
        toolCalls: z.number(),
        ragSources: z.array(z.unknown()),
      })
      .partial()
      .passthrough()
      .optional(),
  })
  .passthrough();

export const aiAgentNodePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [{ id: 'out', label: 'Output', type: 'data' }],
};

export const aiAgentNodeMetadata: NodeComponentMetadata = {
  type: 'ai_agent',
  category: 'ai',
  label: 'AI Agent',
  description: 'Chat with LLM using RAG context',
  icon: 'Brain',
  color: '#10B981',
  isDynamicPorts: true,
  dynamicPorts: {
    kind: 'ai-agent-conditional',
    modeField: 'mode',
    conditionsField: 'conditions',
    multiTurnValue: 'multi_turn',
  },
};
