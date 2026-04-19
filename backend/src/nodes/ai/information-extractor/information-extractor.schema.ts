import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

const fieldDefSchema = z.object({
  name: z.string().meta({ ui: { label: 'Name', widget: 'text' } }),
  type: z
    .enum(['string', 'number', 'boolean', 'array', 'object'])
    .meta({ ui: { label: 'Type', widget: 'select' } }),
  description: z
    .string()
    .meta({ ui: { label: 'Description', widget: 'textarea' } }),
  required: z
    .boolean()
    .default(true)
    .meta({ ui: { label: 'Required', widget: 'checkbox' } }),
  enumValues: z
    .array(z.string())
    .optional()
    .meta({ ui: { label: 'Enum Values', widget: 'field-array' } }),
});

const exampleDefSchema = z.object({
  input: z.string().meta({ ui: { label: 'Input', widget: 'textarea' } }),
  output: z
    .record(z.string(), z.unknown())
    .meta({ ui: { label: 'Output', widget: 'code', language: 'json' } }),
});

export const informationExtractorNodeConfigSchema = z
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
    inputField: z
      .string()
      .optional()
      .meta({
        ui: {
          label: 'Input Field',
          widget: 'expression',
          order: 3,
          visibleWhen: { field: 'mode', equals: 'single_turn' },
        },
      }),
    outputSchema: z
      .array(fieldDefSchema)
      .default([])
      .meta({
        ui: {
          label: 'Output Schema',
          widget: 'field-array',
          itemLabel: 'Field',
          order: 4,
        },
      }),
    examples: z
      .array(exampleDefSchema)
      .default([])
      .meta({
        ui: {
          label: 'Examples',
          widget: 'field-array',
          itemLabel: 'Example',
          order: 5,
        },
      }),
    instructions: z
      .string()
      .optional()
      .meta({ ui: { label: 'Instructions', widget: 'textarea', order: 6 } }),
    mode: z
      .enum(['single_turn', 'multi_turn'])
      .default('single_turn')
      .meta({ ui: { label: 'Mode', widget: 'select', order: 7 } }),
    maxTurns: z
      .number()
      .int()
      .default(10)
      .meta({
        ui: {
          label: 'Max Turns',
          widget: 'number',
          order: 8,
          visibleWhen: { field: 'mode', equals: 'multi_turn' },
        },
      }),
    maxCollectionRetries: z
      .number()
      .int()
      .min(0)
      .default(3)
      .meta({
        ui: {
          label: 'Max Collection Retries',
          widget: 'number',
          order: 9,
          group: 'Retry Settings',
          visibleWhen: { field: 'mode', equals: 'multi_turn' },
          description:
            'How many times to re-prompt the LLM when it reports completion but required fields are still missing. 0 = unlimited.',
        },
      }),
  })
  .passthrough();
export type InformationExtractorConfig = z.infer<
  typeof informationExtractorNodeConfigSchema
>;

/**
 * AUTOCOMPLETE HINT SCHEMA — not used for runtime validation.
 *
 * Runtime `$node["X"]` matches the unified `NodeHandlerOutput` contract
 * (`{ config, output, meta, port, status }`). The LLM-category convention
 * (`output.result.*`) is shared across `ai_agent`, `text_classifier`, and
 * `information_extractor` so downstream expressions like
 * `$node["Extractor"].output.result.extracted.<name>` are uniform.
 *
 * User-defined extraction fields are enriched into `.output.result.extracted`
 * from each node instance's `config.outputSchema` on the frontend (see
 * `enrichInfoExtractorOutputSchema`).
 */
export const informationExtractorNodeOutputSchema = z
  .object({
    config: z
      .object({
        mode: z.enum(['single_turn', 'multi_turn']).optional(),
        model: z.string().optional(),
        schema: z.array(fieldDefSchema).optional(),
        maxTurns: z.number().optional(),
        maxCollectionRetries: z.number().optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    output: z
      .object({
        result: z
          .object({
            extracted: z.record(z.string(), z.unknown()).optional(),
            endReason: z.string().optional(),
            turnCount: z.number().optional(),
            messages: z.array(z.record(z.string(), z.unknown())).optional(),
            originalInput: z.string().optional(),
          })
          .partial()
          .passthrough()
          .optional(),
        error: z
          .object({
            code: z.string(),
            message: z.string(),
            details: z.record(z.string(), z.unknown()).optional(),
          })
          .partial()
          .passthrough()
          .optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    meta: z
      .object({
        durationMs: z.number(),
        model: z.string(),
        inputTokens: z.number(),
        outputTokens: z.number(),
        totalTokens: z.number(),
        thinkingTokens: z.number(),
        collectionRetryCount: z.number().optional(),
        turnDebug: z.array(z.record(z.string(), z.unknown())).optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    // Waiting shape exposes `status:'waiting_for_input'` alongside the
    // live conversation snapshot. The internal continuation state lives
    // on `_resumeState` (renamed from the legacy `_multiTurnState` in
    // Stage 2 — engine keeps a dual-read fallback until the next
    // release). `output.messages` and `output.partial.*` are the
    // canonical runtime fields (CONVENTIONS §4.3); `conversationConfig`
    // is retained for WebSocket event-payload backward compatibility.
    // Expression resolvers intentionally do not surface `_resumeState`.
    status: z.string().optional(),
    port: z.string().optional(),
    interactionType: z.string().optional(),
    conversationConfig: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export const informationExtractorNodePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [
    { id: 'out', label: 'Output', type: 'data' },
    { id: 'error', label: 'Error', type: 'error' },
  ],
};

export const informationExtractorNodeMetadata: NodeComponentMetadata = {
  type: 'information_extractor',
  category: 'ai',
  label: 'Information Extractor',
  description: 'Extract structured data from text',
  icon: 'FileSearch',
  color: '#10B981',
  isDynamicPorts: true,
  dynamicPorts: {
    kind: 'info-extractor-mode',
    modeField: 'mode',
    multiTurnValue: 'multi_turn',
  },
};
