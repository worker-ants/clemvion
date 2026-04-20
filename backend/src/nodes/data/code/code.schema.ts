import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

/**
 * Code node's `output` is whatever the user-written script returns —
 * intentionally opaque. Only the error envelope, logs, and control fields are
 * declared. Tier 3 per node-jazzy-liskov plan.
 */
export const codeNodeOutputSchema = z
  .object({
    config: z
      .object({
        language: z.enum(['javascript']).optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    output: z.unknown().optional(),
    meta: z
      .object({
        success: z.boolean().optional(),
        logs: z.array(z.string()).optional(),
        error: z.string().optional(),
        errorCode: z.string().optional(),
        stack: z.string().optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    port: z.string().optional(),
    status: z.string().optional(),
  })
  .passthrough();

export const codeNodeConfigSchema = z
  .object({
    language: z
      .enum(['javascript'])
      .default('javascript')
      .meta({
        ui: { label: 'Language', widget: 'select' },
      }),
    code: z
      .string()
      .default('')
      .meta({
        ui: {
          label: 'Code',
          widget: 'code',
          language: 'javascript',
          hint: 'Use return to produce output. $input, $vars, $helpers are injected.',
        },
      }),
  })
  .passthrough();
export type CodeConfig = z.infer<typeof codeNodeConfigSchema>;

export const codeNodePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [{ id: 'out', label: 'Output', type: 'data' }],
};

export const codeNodeMetadata: NodeComponentMetadata = {
  type: 'code',
  category: 'data',
  label: 'Code',
  description: 'Run JavaScript code',
  icon: 'Code',
  color: '#06B6D4',
};
