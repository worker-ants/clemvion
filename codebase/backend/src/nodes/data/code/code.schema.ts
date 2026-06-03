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
        code: z.string().optional(),
        timeout: z.number().optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    output: z.unknown().optional(),
    meta: z
      .object({
        success: z.boolean().optional(),
        logs: z.array(z.string()).optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    port: z.string().optional(),
    status: z.string().optional(),
  })
  .passthrough();

// Single source of truth for the default timeout value — also exported so
// code.handler.ts can reference it without maintaining a separate copy (INFO-6).
export const DEFAULT_TIMEOUT_SEC = 30;

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
          hint: 'Use return to produce output. $input, $vars, $execution, $node, $helpers are injected.',
        },
      }),
    // Declared field (spec §1: 1–120s, default 30). Range *enforcement* stays
    // in `validateCodeConfig` (spec §6 SoT — it owns the custom error message
    // + non-numeric guard); the zod field declares the type/default and the
    // UI slider bounds so the editor renders `Timeout [30] sec (1–120)`.
    timeout: z
      .number()
      .default(DEFAULT_TIMEOUT_SEC)
      .meta({
        ui: { label: 'Timeout (sec)', widget: 'number', min: 1, max: 120 },
      }),
  })
  .passthrough();
export type CodeConfig = z.infer<typeof codeNodeConfigSchema>;

export const codeNodePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [
    { id: 'success', label: 'Success', type: 'data' },
    { id: 'error', label: 'Error', type: 'data' },
  ],
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
  executionMetadata: { kind: 'standard' },
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
      message: 'Body of the code to run must be entered.',
    },
  ],
  validateConfig: validateCodeConfig,
};
