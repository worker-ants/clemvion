import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';
import { conditionGroupSchema } from '../if-else/if-else.schema';

/**
 * Loop handler returns `output: null` at execute tick — iteration state
 * lives on `$loop` context, not on the node's output envelope. body nodes
 * reference `$loop.index` / `$loop.iteration` directly.
 */
export const loopNodeOutputSchema = z
  .object({
    config: z
      .object({
        count: z.number().optional(),
        maxIterations: z.number().optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    output: z.null().optional(),
    port: z.string().optional(),
    status: z.string().optional(),
  })
  .passthrough();

export const loopNodeConfigSchema = z
  .object({
    count: z
      .string()
      .default('1')
      .meta({
        ui: {
          label: 'Count',
          widget: 'expression',
          placeholder: '10 or {{ $var.count }}',
          hint: 'Integer literal or expression',
        },
      }),
    maxIterations: z
      .number()
      .int()
      .default(1000)
      .meta({
        ui: {
          label: 'Max Iterations',
          widget: 'number',
          hint: 'Safety cap on loop iterations',
        },
      }),
    breakCondition: conditionGroupSchema.optional().meta({
      ui: {
        label: 'Break Condition',
        widget: 'condition-builder',
        hint: 'Exit loop when condition is met',
      },
    }),
  })
  .passthrough();
export type LoopConfig = z.infer<typeof loopNodeConfigSchema>;

export const loopNodePorts: NodePorts = {
  inputs: [
    { id: 'in', label: 'Input', type: 'data' },
    { id: 'emit', label: 'Emit', type: 'data' },
  ],
  outputs: [
    { id: 'body', label: 'Body', type: 'data' },
    { id: 'done', label: 'Done', type: 'data' },
  ],
};

export const loopNodeMetadata: NodeComponentMetadata = {
  type: 'loop',
  category: 'logic',
  label: 'Loop',
  description: 'Repeat N times',
  icon: 'Repeat',
  color: '#3B82F6',
  isContainer: true,
};
