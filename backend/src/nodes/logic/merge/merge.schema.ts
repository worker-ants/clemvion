import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

export const mergeNodeOutputSchema = z
  .object({
    config: z
      .object({
        strategy: z.enum(['wait_all', 'first', 'append']).optional(),
        outputFormat: z.enum(['array', 'merge_object', 'indexed']).optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    // Shape varies by `config.outputFormat`:
    //  - array         → unknown[]
    //  - merge_object  → Record<string, unknown> (shallow-merged)
    //  - indexed       → { in_0, in_1, ... }
    output: z.unknown().optional(),
    port: z.string().optional(),
    status: z.string().optional(),
  })
  .passthrough();

export const mergeNodeConfigSchema = z
  .object({
    strategy: z
      .enum(['wait_all', 'first', 'append'])
      .default('wait_all')
      .meta({ ui: { label: 'Strategy', widget: 'select' } }),
    outputFormat: z
      .enum(['array', 'merge_object', 'indexed'])
      .default('array')
      .meta({ ui: { label: 'Output Format', widget: 'select' } }),
    timeout: z
      .number()
      .int()
      .default(300)
      .meta({
        ui: {
          label: 'Timeout (seconds)',
          widget: 'number',
          hint: '0 = no timeout (wait indefinitely)',
        },
      }),
    partialOnTimeout: z
      .boolean()
      .default(false)
      .meta({
        ui: {
          label: 'Partial on Timeout',
          widget: 'checkbox',
          hint: 'Merge arrived inputs when timeout elapses',
        },
      }),
  })
  .passthrough();
export type MergeConfig = z.infer<typeof mergeNodeConfigSchema>;

export const mergeNodePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [{ id: 'out', label: 'Output', type: 'data' }],
};

export const mergeNodeMetadata: NodeComponentMetadata = {
  type: 'merge',
  category: 'logic',
  label: 'Merge',
  description: 'Combine inputs',
  icon: 'Merge',
  color: '#3B82F6',
};
