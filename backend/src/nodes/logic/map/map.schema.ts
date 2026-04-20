import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

/**
 * Map handler returns the resolved source array; the body subgraph's `emit`
 * outputs are collected by ForEachExecutor and flow through the `done` port
 * — not visible on this node's output envelope at handler tick. Items are
 * source-array-shaped (unknown).
 */
export const mapNodeOutputSchema = z
  .object({
    config: z
      .object({
        inputField: z.unknown().optional(),
        errorPolicy: z.enum(['stop', 'skip', 'continue']).optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    output: z.array(z.unknown()).optional(),
    port: z.string().optional(),
    status: z.string().optional(),
  })
  .passthrough();

export const mapNodeConfigSchema = z
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
    errorPolicy: z
      .enum(['stop', 'skip', 'continue'])
      .default('stop')
      .meta({ ui: { label: 'Error Policy', widget: 'select' } }),
  })
  .passthrough();
export type MapConfig = z.infer<typeof mapNodeConfigSchema>;

export const mapNodePorts: NodePorts = {
  inputs: [
    { id: 'in', label: 'Input', type: 'data' },
    { id: 'emit', label: 'Emit', type: 'data' },
  ],
  outputs: [
    { id: 'body', label: 'Body', type: 'data' },
    { id: 'done', label: 'Done', type: 'data' },
  ],
};

export const mapNodeMetadata: NodeComponentMetadata = {
  type: 'map',
  category: 'logic',
  label: 'Map',
  description: 'Transform array items via body subgraph',
  icon: 'Map',
  color: '#3B82F6',
  isContainer: true,
  summaryTemplate: {
    template: '{{inputField}}',
    warnWhen: '!inputField',
    warnMessage: 'Input field not set',
  },
};
