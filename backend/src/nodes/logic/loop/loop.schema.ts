import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

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
    breakCondition: z
      .string()
      .optional()
      .meta({
        ui: {
          label: 'Break Condition',
          widget: 'expression',
          placeholder: '{{ $loop.index >= 5 }}',
          hint: 'Boolean expression — loop exits when truthy. Re-evaluated after every iteration.',
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

/**
 * Imperative escape hatch — `count` accepts numeric strings, raw numbers,
 * AND `{{ ... }}` expressions, and the cross-field rule "count must be ≤
 * maxIterations" needs both to parse cleanly. The mini-DSL can't express the
 * "looks like an expression" carve-out, so the parsing logic stays here.
 * Single-field "is count set?" check lives in `warningRules` below.
 */
function loopParseNumeric(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    if (/\{\{.*\}\}/.test(trimmed)) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
function loopLooksLikeExpression(value: unknown): boolean {
  return typeof value === 'string' && /\{\{.*\}\}/.test(value.trim());
}
export function validateLoopConfig(config: unknown): string[] {
  const c = (config ?? {}) as Record<string, unknown>;
  const errors: string[] = [];
  const { count, maxIterations } = c as {
    count?: unknown;
    maxIterations?: unknown;
  };

  if (count !== undefined && count !== null && count !== '') {
    if (!loopLooksLikeExpression(count)) {
      const parsed = loopParseNumeric(count);
      if (parsed === null) {
        errors.push('count must be a number or expression');
      } else if (parsed <= 0) {
        errors.push('count must be greater than 0');
      }
    }
  }

  if (maxIterations !== undefined && maxIterations !== null) {
    if (!loopLooksLikeExpression(maxIterations)) {
      const parsedMax = loopParseNumeric(maxIterations);
      if (parsedMax === null) {
        errors.push('maxIterations must be a number');
      } else if (
        typeof count === 'number' &&
        !loopLooksLikeExpression(count) &&
        count > parsedMax
      ) {
        errors.push(
          `count must be less than or equal to maxIterations (${parsedMax})`,
        );
      }
    }
  }

  return errors;
}

export const loopNodeMetadata: NodeComponentMetadata = {
  type: 'loop',
  category: 'logic',
  label: 'Loop',
  description: 'Repeat N times',
  icon: 'Repeat',
  color: '#3B82F6',
  isContainer: true,
  executionMetadata: { kind: 'container' },
  // SSOT for warnings (frontend canvas + backend handler.validate).
  // Mirror points:
  //  - frontend `loopSummary` warning ("Count not set")
  //  - backend handler.validate's "count is required" structural rule.
  // The numeric-parse / cross-field "count ≤ maxIterations" lives in
  // `validateConfig` because the mini-DSL can't express the
  // "looks-like-{{expression}}" carve-out.
  warningRules: [
    {
      id: 'loop:no-count',
      when: '!count',
      message: 'Count 를 입력해야 합니다.',
    },
  ],
  validateConfig: validateLoopConfig,
};
