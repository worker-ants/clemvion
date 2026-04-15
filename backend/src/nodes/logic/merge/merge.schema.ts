import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

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
