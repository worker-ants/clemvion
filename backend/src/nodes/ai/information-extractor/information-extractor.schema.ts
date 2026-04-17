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
