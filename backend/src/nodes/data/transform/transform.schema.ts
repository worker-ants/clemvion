import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

/**
 * Transform operation item. The detailed per-type params are handled by a
 * custom override form in the frontend — the schema only describes the base
 * `type` discriminator plus a passthrough params bag.
 */
export const transformOperationSchema = z
  .object({
    type: z
      .string()
      .default('rename_field')
      .meta({
        ui: { label: 'Type', widget: 'select' },
      }),
  })
  .passthrough();

export const transformNodeConfigSchema = z
  .object({
    operations: z
      .array(transformOperationSchema)
      .default([])
      .meta({
        ui: {
          label: 'Operations',
          widget: 'field-array',
          itemLabel: 'Operation',
          hint: 'Transform operations applied in order',
        },
      }),
  })
  .passthrough();
export type TransformConfig = z.infer<typeof transformNodeConfigSchema>;

export const transformNodePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [{ id: 'out', label: 'Output', type: 'data' }],
};

export const transformNodeMetadata: NodeComponentMetadata = {
  type: 'transform',
  category: 'data',
  label: 'Transform',
  description: 'Transform data',
  icon: 'ArrowRightLeft',
  color: '#06B6D4',
};
