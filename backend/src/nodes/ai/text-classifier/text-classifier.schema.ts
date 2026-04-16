import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

const categoryDefSchema = z.object({
  name: z.string().meta({ ui: { label: 'Name', widget: 'text' } }),
  description: z
    .string()
    .meta({ ui: { label: 'Description', widget: 'textarea' } }),
  examples: z
    .array(z.string())
    .default([])
    .meta({ ui: { label: 'Examples', widget: 'field-array' } }),
});

export const textClassifierNodeConfigSchema = z
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
      .meta({ ui: { label: 'Input Field', widget: 'expression', order: 3 } }),
    categories: z
      .array(categoryDefSchema)
      .default([])
      .meta({
        ui: {
          label: 'Categories',
          widget: 'field-array',
          itemLabel: 'Category',
          order: 4,
        },
      }),
    instructions: z
      .string()
      .optional()
      .meta({ ui: { label: 'Instructions', widget: 'textarea', order: 5 } }),
    includeConfidence: z
      .boolean()
      .default(false)
      .meta({
        ui: { label: 'Include Confidence', widget: 'checkbox', order: 6 },
      }),
    multiLabel: z
      .boolean()
      .default(false)
      .meta({
        ui: {
          label: 'Multi-label Classification',
          widget: 'checkbox',
          order: 7,
        },
      }),
  })
  .passthrough();
export type TextClassifierConfig = z.infer<
  typeof textClassifierNodeConfigSchema
>;

export const textClassifierNodePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [],
};

export const textClassifierNodeMetadata: NodeComponentMetadata = {
  type: 'text_classifier',
  category: 'ai',
  label: 'Text Classifier',
  description: 'Classify text into categories',
  icon: 'Tags',
  color: '#10B981',
};
