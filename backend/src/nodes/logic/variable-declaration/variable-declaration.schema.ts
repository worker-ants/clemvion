import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

export const varDefSchema = z
  .object({
    name: z
      .string()
      .default('')
      .meta({
        ui: {
          label: 'Name',
          widget: 'text',
          placeholder: 'variableName',
        },
      }),
    type: z
      .enum(['string', 'number', 'boolean', 'array', 'object'])
      .default('string')
      .meta({ ui: { label: 'Type', widget: 'select' } }),
    defaultValue: z
      .unknown()
      .optional()
      .meta({
        ui: { label: 'Default Value', widget: 'expression' },
      }),
  })
  .passthrough();

/**
 * Variable Declaration passes input through and only mutates the execution
 * variable pool (`context.variables.<name>`) — the declared variables are
 * surfaced to expressions via `$var.<name>`, NOT through this node's output.
 * Hence the `output` schema mirrors the passthrough input with `unknown`.
 */
export const variableDeclarationNodeOutputSchema = z
  .object({
    config: z
      .object({
        variables: z.array(varDefSchema).optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    output: z.unknown().optional(),
    port: z.string().optional(),
    status: z.string().optional(),
  })
  .passthrough();

export const variableDeclarationNodeConfigSchema = z
  .object({
    variables: z
      .array(varDefSchema)
      .default([])
      .meta({
        ui: {
          label: 'Variables',
          widget: 'field-array',
          itemLabel: 'Variable',
        },
      }),
  })
  .passthrough();
export type VariableDeclarationConfig = z.infer<
  typeof variableDeclarationNodeConfigSchema
>;

export const variableDeclarationNodePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [{ id: 'out', label: 'Output', type: 'data' }],
};

export const variableDeclarationNodeMetadata: NodeComponentMetadata = {
  type: 'variable_declaration',
  category: 'logic',
  label: 'Variable',
  description: 'Declare variables',
  icon: 'Variable',
  color: '#3B82F6',
};
