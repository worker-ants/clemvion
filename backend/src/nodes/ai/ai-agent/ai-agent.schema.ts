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
  id: z.string().meta({ ui: { label: 'ID', widget: 'text' } }),
  label: z.string().meta({ ui: { label: 'Label', widget: 'text' } }),
  prompt: z.string().meta({ ui: { label: 'Prompt', widget: 'textarea' } }),
});

export const aiAgentNodeConfigSchema = z
  .object({
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
      .meta({ ui: { label: 'Model', widget: 'text', order: 2 } }),
    mode: z
      .enum(['single_turn', 'multi_turn'])
      .default('single_turn')
      .meta({ ui: { label: 'Mode', widget: 'select', order: 3 } }),
    systemPrompt: z
      .string()
      .optional()
      .meta({
        ui: {
          label: 'System Prompt',
          widget: 'expression',
          order: 4,
        },
      }),
    userPrompt: z
      .string()
      .optional()
      .meta({
        ui: { label: 'User Prompt', widget: 'expression', order: 5 },
      }),
    temperature: z
      .number()
      .optional()
      .meta({ ui: { label: 'Temperature', widget: 'number', order: 6 } }),
    maxTokens: z
      .number()
      .int()
      .optional()
      .meta({ ui: { label: 'Max Tokens', widget: 'number', order: 7 } }),
    responseFormat: z
      .enum(['text', 'json'])
      .default('text')
      .meta({ ui: { label: 'Response Format', widget: 'select', order: 8 } }),
    jsonSchema: z
      .record(z.string(), z.unknown())
      .optional()
      .meta({
        ui: {
          label: 'JSON Schema',
          widget: 'code',
          language: 'json',
          order: 9,
          visibleWhen: { field: 'responseFormat', equals: 'json' },
        },
      }),
    knowledgeBases: z
      .array(z.string())
      .default([])
      .meta({
        ui: { label: 'Knowledge Bases', widget: 'kb-selector', order: 10 },
      }),
    ragTopK: z
      .number()
      .int()
      .default(5)
      .meta({ ui: { label: 'RAG Top K', widget: 'number', order: 11 } }),
    ragThreshold: z
      .number()
      .default(0.7)
      .meta({ ui: { label: 'RAG Threshold', widget: 'number', order: 12 } }),
    toolNodeIds: z
      .array(z.string())
      .default([])
      .meta({
        ui: { label: 'Tool Node IDs', widget: 'field-array', order: 13 },
      }),
    toolOverrides: z
      .array(toolOverrideSchema)
      .default([])
      .meta({
        ui: {
          label: 'Tool Overrides',
          widget: 'field-array',
          itemLabel: 'Tool',
          order: 14,
        },
      }),
    maxToolCalls: z
      .number()
      .int()
      .default(10)
      .meta({ ui: { label: 'Max Tool Calls', widget: 'number', order: 15 } }),
    conversationHistory: z
      .enum(['none', 'last_n', 'full'])
      .default('none')
      .meta({
        ui: {
          label: 'Conversation History',
          widget: 'select',
          order: 16,
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
          order: 17,
          visibleWhen: { field: 'conversationHistory', equals: 'last_n' },
        },
      }),
    maxTurns: z
      .number()
      .int()
      .default(20)
      .meta({
        ui: {
          label: 'Max Turns',
          widget: 'number',
          order: 18,
          visibleWhen: { field: 'mode', equals: 'multi_turn' },
        },
      }),
    conditions: z
      .array(conditionDefSchema)
      .default([])
      .meta({
        ui: {
          label: 'Conditions',
          widget: 'field-array',
          itemLabel: 'Condition',
          order: 19,
        },
      }),
  })
  .passthrough();
export type AiAgentConfig = z.infer<typeof aiAgentNodeConfigSchema>;

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
};
