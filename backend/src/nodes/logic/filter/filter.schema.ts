import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';
import { conditionGroupSchema } from '../if-else/if-else.schema';

const filterConditionSchema = z.record(z.string(), z.unknown());

export const filterNodeOutputSchema = z
  .object({
    config: z
      .object({
        inputField: z.unknown().optional(),
        conditions: z.array(filterConditionSchema).optional(),
        combineMode: z.enum(['and', 'or']).optional(),
        strictComparison: z.boolean().optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    output: z
      .object({
        match: z.array(z.unknown()).optional(),
        unmatched: z.array(z.unknown()).optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    port: z.string().optional(),
    status: z.string().optional(),
  })
  .passthrough();

export const filterNodeConfigSchema = z
  .object({
    inputField: z
      .string()
      .default('')
      .meta({
        ui: {
          label: 'Input Field',
          widget: 'expression',
          placeholder: '$input.items',
          hint: 'Dot-path or inline expression returning an array',
        },
      }),
    conditions: z
      .array(conditionGroupSchema)
      .default([])
      .meta({
        ui: {
          label: 'Conditions',
          widget: 'condition-builder',
          itemLabel: 'Condition',
          hint: 'Use {{ $item.* }} to reference the current array item',
        },
      }),
    combineMode: z
      .enum(['and', 'or'])
      .default('and')
      .meta({ ui: { label: 'Combine Mode', widget: 'select' } }),
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
export type FilterConfig = z.infer<typeof filterNodeConfigSchema>;

export const filterNodePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [
    { id: 'match', label: 'Match', type: 'data' },
    { id: 'unmatched', label: 'Unmatched', type: 'data' },
  ],
};

export const filterNodeMetadata: NodeComponentMetadata = {
  type: 'filter',
  category: 'logic',
  label: 'Filter',
  description: 'Filter array by conditions',
  icon: 'Filter',
  color: '#3B82F6',
};
