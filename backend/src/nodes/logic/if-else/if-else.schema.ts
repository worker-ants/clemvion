import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

export const conditionOperatorSchema = z.enum([
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'contains',
  'not_contains',
  'starts_with',
  'ends_with',
  'is_empty',
  'is_not_empty',
  'regex',
  'is_null',
  'is_type',
]);

export const conditionGroupSchema = z
  .object({
    field: z
      .string()
      .default('')
      .meta({
        ui: {
          label: 'Field',
          widget: 'expression',
          placeholder: '{{ $input.value }}',
        },
      }),
    operator: conditionOperatorSchema.default('eq').meta({
      ui: { label: 'Operator', widget: 'select' },
    }),
    value: z
      .unknown()
      .optional()
      .meta({
        ui: { label: 'Value', widget: 'expression' },
      }),
  })
  .passthrough();

export const ifElseOutputSchema = z
  .object({
    config: z
      .object({
        conditions: z.array(conditionGroupSchema).optional(),
        combineMode: z.enum(['and', 'or']).optional(),
        strictComparison: z.boolean().optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    output: z.unknown().optional(),
    port: z.enum(['true', 'false']).optional(),
    status: z.string().optional(),
  })
  .passthrough();

export const ifElseConfigSchema = z
  .object({
    conditions: z
      .array(conditionGroupSchema)
      .default([])
      .meta({
        ui: {
          label: 'Conditions',
          widget: 'condition-builder',
          itemLabel: 'Condition',
        },
      }),
    combineMode: z
      .enum(['and', 'or'])
      .default('and')
      .meta({
        ui: { label: 'Combine Mode', widget: 'select' },
      }),
    strictComparison: z
      .boolean()
      .default(false)
      .meta({
        ui: {
          label: 'Strict Comparison',
          widget: 'checkbox',
          hint: 'Compare without type coercion',
        },
      }),
  })
  .passthrough();
export type IfElseConfig = z.infer<typeof ifElseConfigSchema>;

export const ifElsePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [
    { id: 'true', label: 'True', type: 'data' },
    { id: 'false', label: 'False', type: 'data' },
  ],
};

export const ifElseMetadata: NodeComponentMetadata = {
  type: 'if_else',
  category: 'logic',
  label: 'If/Else',
  description: 'Conditional branching',
  icon: 'GitBranch',
  color: '#3B82F6',
};
