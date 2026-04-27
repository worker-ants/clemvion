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

/**
 * Imperative escape hatch — `timeout` numeric range (1..120) needs a `>=`
 * AND `<=` AND finite-check combination plus a non-numeric guard the mini-DSL
 * cannot express in a single rule. Per-field "is code written?" lives in
 * `warningRules` below so it fires the canvas badge.
 */
const MIN_TIMEOUT_SEC = 1;
const MAX_TIMEOUT_SEC = 120;
export function validateCodeConfig(config: unknown): string[] {
  const c = (config ?? {}) as Record<string, unknown>;
  const errors: string[] = [];
  if (c.timeout !== undefined) {
    const t = c.timeout;
    if (
      typeof t !== 'number' ||
      !Number.isFinite(t) ||
      t < MIN_TIMEOUT_SEC ||
      t > MAX_TIMEOUT_SEC
    ) {
      errors.push(
        `timeout must be a number between ${MIN_TIMEOUT_SEC} and ${MAX_TIMEOUT_SEC} seconds`,
      );
    }
  }
  return errors;
}

export const codeNodeMetadata: NodeComponentMetadata = {
  type: 'code',
  category: 'data',
  label: 'Code',
  description: 'Run JavaScript code',
  icon: 'Code',
  color: '#06B6D4',
  // SSOT for warnings (frontend canvas + backend handler.validate).
  // Mirror points:
  //  - frontend `codeSummary` warning ("Code not written")
  //  - backend handler.validate's "code is required" rule.
  // `language` is bounded by the zod enum (`javascript` only) so no rule
  // is needed there. `timeout` numeric range lives in `validateConfig`.
  warningRules: [
    {
      id: 'code:no-code',
      when: '!code',
      message: '실행할 코드를 입력해야 합니다.',
    },
  ],
  validateConfig: validateCodeConfig,
};
