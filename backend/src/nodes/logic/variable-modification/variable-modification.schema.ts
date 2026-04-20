import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

export const modOperationSchema = z.enum([
  'set',
  'increment',
  'decrement',
  'append',
  'push',
  'pop',
  'set_field',
  'delete_field',
]);

export const modDefSchema = z
  .object({
    variable: z
      .string()
      .default('')
      .meta({
        ui: {
          label: 'Variable',
          widget: 'text',
          placeholder: 'variableName',
        },
      }),
    operation: modOperationSchema.default('set').meta({
      ui: { label: 'Operation', widget: 'select' },
    }),
    value: z
      .unknown()
      .optional()
      .meta({
        ui: { label: 'Value', widget: 'expression' },
      }),
  })
  .passthrough();

/**
 * Variable Modification mutates `context.variables` in place and passes the
 * input through as output. Like Variable Declaration, modified variables
 * surface through `$var.<name>` — not the node's output envelope.
 */
export const variableModificationNodeOutputSchema = z
  .object({
    config: z
      .object({
        modifications: z.array(modDefSchema).optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    output: z.unknown().optional(),
    port: z.string().optional(),
    status: z.string().optional(),
  })
  .passthrough();

export const variableModificationNodeConfigSchema = z
  .object({
    modifications: z
      .array(modDefSchema)
      .default([])
      .meta({
        ui: {
          label: 'Modifications',
          widget: 'field-array',
          itemLabel: 'Modification',
        },
      }),
  })
  .passthrough();
export type VariableModificationConfig = z.infer<
  typeof variableModificationNodeConfigSchema
>;

export const variableModificationNodePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [{ id: 'out', label: 'Output', type: 'data' }],
};

export const variableModificationNodeMetadata: NodeComponentMetadata = {
  type: 'variable_modification',
  category: 'logic',
  label: 'Set Variable',
  description: 'Modify variables',
  icon: 'PenLine',
  color: '#3B82F6',
};
