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
          // `default('1')` + `ui.required: true` = "최소 반복 1회" 정책.
          // 빈 값 발생 경로가 zod default 로 닫혀 있어 별도 warningRule
          // 불필요. spec/4-nodes/1-logic/3-loop.md §8 Rationale 참고.
          required: true,
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
 *
 * "Is count set?" check is intentionally absent — zod `default('1')` on the
 * `count` field fills empty/undefined values at parse time ("최소 반복 1회"
 * policy, spec/4-nodes/1-logic/3-loop.md §8). Empty input that bypasses
 * schema parsing is the engine's runtime safety net (INVALID_CONTAINER_PARAM
 * in coerceContainerNumber), not this validator's concern.
 *
 * Cross-field "count > maxIterations" comparison is intentionally gated on
 * `typeof count === 'number'` — user-entered numeric strings (`'200'`) are
 * preserved as raw and only coerced at engine evaluation time. This keeps the
 * schema layer free of premature string-to-number conversion semantics.
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
  // `warningRules: []` — **intentionally empty**. "count missing" 같은 빈 값
  // 발화 rule 을 두지 않는 이유는 `count` zod schema 가 `default('1')` 이라
  // 빈 값 발생 경로가 storage 단계에서 닫혀 있기 때문이며, 결과적으로 어떤
  // warningRule 도 발화 경로가 없다. 정책 배경: spec/4-nodes/1-logic/3-loop.md
  // §8 Rationale "최소 반복 1회". 숫자 파싱 / "count ≤ maxIterations" 등
  // cross-field 검증은 `validateConfig` 에 둠 (mini-DSL 표현력 한계).
  warningRules: [],
  validateConfig: validateLoopConfig,
};
