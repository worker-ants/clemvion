import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

/**
 * ForEach outputs the resolved array as `output` (items). Body branch
 * receives each item via `$item` at runtime — not projected through the
 * ForEach node's output envelope. Shape varies by source array, so items
 * are `unknown`.
 */
export const foreachNodeOutputSchema = z
  .object({
    config: z
      .object({
        arrayField: z.unknown().optional(),
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

export const foreachNodeConfigSchema = z
  .object({
    arrayField: z
      .string()
      .default('')
      .meta({
        ui: {
          label: 'Array Field',
          widget: 'expression',
          placeholder: '$input.items',
          hint: 'Dot-path or inline expression returning an array',
          // warningRule `foreach:no-array-field` 와 정렬.
          required: true,
        },
      }),
    errorPolicy: z
      .enum(['stop', 'skip', 'continue'])
      .default('stop')
      .meta({ ui: { label: 'Error Policy', widget: 'select' } }),
  })
  .passthrough();
export type ForEachConfig = z.infer<typeof foreachNodeConfigSchema>;

export const foreachNodePorts: NodePorts = {
  inputs: [
    { id: 'in', label: 'Input', type: 'data' },
    { id: 'emit', label: 'Emit', type: 'data' },
  ],
  outputs: [
    { id: 'body', label: 'Body', type: 'data' },
    { id: 'done', label: 'Done', type: 'data' },
  ],
};

export const foreachNodeMetadata: NodeComponentMetadata = {
  type: 'foreach',
  category: 'logic',
  label: 'ForEach',
  description: 'Iterate over array',
  icon: 'ListOrdered',
  color: '#3B82F6',
  isContainer: true,
  executionMetadata: { kind: 'container' },
  // SSOT for warnings (frontend canvas + backend handler.validate).
  // Mirror points:
  //  - frontend `foreachSummary` warning ("Array field not set")
  //  - backend handler.validate's "arrayField is required" rule.
  // `errorPolicy` is bounded by the zod enum, so no extra rule is needed.
  warningRules: [
    {
      id: 'foreach:no-array-field',
      when: '!arrayField',
      message: 'Array field must be entered.',
    },
  ],
};
