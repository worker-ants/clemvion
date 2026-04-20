import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

const triggerParameterSchema = z
  .object({
    name: z
      .string()
      .default('')
      .meta({ ui: { label: 'Name', widget: 'text' } }),
    type: z
      .enum(['string', 'number', 'boolean', 'object', 'array'])
      .default('string')
      .meta({ ui: { label: 'Type', widget: 'select' } }),
    required: z
      .boolean()
      .optional()
      .meta({ ui: { label: 'Required', widget: 'checkbox' } }),
    defaultValue: z.unknown().optional(),
    description: z
      .string()
      .optional()
      .meta({ ui: { label: 'Description', widget: 'text' } }),
  })
  .passthrough();

export const manualTriggerOutputSchema = z
  .object({
    config: z
      .object({
        parameters: z.array(triggerParameterSchema).optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    output: z
      .object({
        parameters: z.record(z.string(), z.unknown()).optional(),
      })
      .passthrough()
      .optional(),
    port: z.string().optional(),
    status: z.string().optional(),
  })
  .passthrough();

export const manualTriggerConfigSchema = z
  .object({
    parameters: z
      .array(triggerParameterSchema)
      .default([])
      .meta({
        ui: {
          label: 'Parameters',
          widget: 'field-array',
          itemLabel: 'Parameter',
        },
      }),
  })
  .passthrough();
export type ManualTriggerConfig = z.infer<typeof manualTriggerConfigSchema>;

export const manualTriggerPorts: NodePorts = {
  inputs: [],
  outputs: [{ id: 'out', label: 'Output', type: 'data' }],
};

export const manualTriggerMetadata: NodeComponentMetadata = {
  type: 'manual_trigger',
  category: 'trigger',
  label: 'Manual Trigger',
  description: 'Start point for manual workflow execution',
  icon: 'Zap',
  color: '#F59E0B',
};
