import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

/**
 * Transform operation item. The detailed per-type params are handled by a
 * custom override form in the frontend — the schema only describes the base
 * `type` discriminator plus a passthrough params bag.
 */
export const transformOperationSchema = z
  .object({
    type: z
      .string()
      .default('rename_field')
      .meta({
        ui: { label: 'Type', widget: 'select' },
      }),
  })
  .passthrough();

/**
 * Transform output is the input object mutated by `config.operations` in
 * order. Its concrete shape depends on the operation sequence (rename /
 * remove / set / array_* / object_* / type_convert / ...), so the static
 * schema keeps `output` open and leaves per-instance field projection to
 * the frontend enricher `enrichTransformOutputSchema` (which picks up
 * top-level `set_field` / `rename_field` targets — nested paths are
 * skipped).
 */
export const transformNodeOutputSchema = z
  .object({
    config: z
      .object({
        operations: z.array(transformOperationSchema).optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    output: z.unknown().optional(),
    port: z.string().optional(),
    status: z.string().optional(),
  })
  .passthrough();

export const transformNodeConfigSchema = z
  .object({
    operations: z
      .array(transformOperationSchema)
      .default([])
      .meta({
        ui: {
          label: 'Operations',
          widget: 'field-array',
          itemLabel: 'Operation',
          hint: 'Transform operations applied in order',
        },
      }),
  })
  .passthrough();
export type TransformConfig = z.infer<typeof transformNodeConfigSchema>;

export const transformNodePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [{ id: 'out', label: 'Output', type: 'data' }],
};

/**
 * Whitelists shared with the handler — kept in lockstep with `TransformHandler`'s
 * private constants so the schema-side imperative validation enforces the same
 * surface that the runtime executes. Mini-DSL can express only the top-level
 * "is operations array empty?" check (see `warningRules`); per-item structural
 * validation (which fields are required for each `type`, which `operation`
 * sub-enum is allowed for `string_op` / `math_op` / `date_op`, etc.) needs
 * array iteration + per-row branching that the DSL doesn't model.
 */
const VALID_TRANSFORM_TYPES = new Set([
  'rename_field',
  'remove_field',
  'set_field',
  'type_convert',
  'string_op',
  'math_op',
  'date_op',
  'array_filter',
  'array_sort',
  'object_pick',
  'object_omit',
]);
const STRING_OPS = new Set([
  'trim',
  'uppercase',
  'lowercase',
  'replace',
  'split',
  'join',
]);
const MATH_OPS = new Set([
  'add',
  'subtract',
  'multiply',
  'divide',
  'round',
  'ceil',
  'floor',
]);
const DATE_OPS = new Set(['format', 'add', 'subtract', 'diff']);
const CONVERT_TYPES = new Set([
  'string',
  'number',
  'boolean',
  'array',
  'object',
]);
const VALID_CONDITION_OPERATORS = new Set([
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'contains',
  'not_contains',
  'starts_with',
  'ends_with',
  'is_empty',
  'is_not_empty',
  'regex',
  'is_null',
]);
export function validateTransformConfig(config: unknown): string[] {
  const c = (config ?? {}) as Record<string, unknown>;
  const errors: string[] = [];
  const ops = c.operations;
  if (ops !== undefined && !Array.isArray(ops)) {
    errors.push('operations is required and must be an array');
    return errors;
  }
  if (!Array.isArray(ops)) return errors;

  for (let i = 0; i < ops.length; i++) {
    const op = ops[i] as Record<string, unknown>;
    const prefix = `operations[${i}]`;
    if (!op || typeof op !== 'object' || !('type' in op)) {
      errors.push(`${prefix} is invalid`);
      continue;
    }
    const type = op.type as string;
    if (!VALID_TRANSFORM_TYPES.has(type)) {
      errors.push(
        `${prefix}.type must be one of: ${Array.from(VALID_TRANSFORM_TYPES).join(', ')}`,
      );
      continue;
    }

    switch (type) {
      case 'rename_field':
        if (!op.from || typeof op.from !== 'string')
          errors.push(`${prefix}.from is required`);
        if (!op.to || typeof op.to !== 'string')
          errors.push(`${prefix}.to is required`);
        break;
      case 'remove_field':
      case 'set_field':
        if (!op.field || typeof op.field !== 'string')
          errors.push(`${prefix}.field is required`);
        break;
      case 'type_convert':
        if (!op.field) errors.push(`${prefix}.field is required`);
        if (!CONVERT_TYPES.has(op.targetType as string))
          errors.push(`${prefix}.targetType is invalid`);
        break;
      case 'string_op':
        if (!op.field) errors.push(`${prefix}.field is required`);
        if (!STRING_OPS.has(op.operation as string))
          errors.push(`${prefix}.operation is invalid`);
        break;
      case 'math_op':
        if (!op.field) errors.push(`${prefix}.field is required`);
        if (!MATH_OPS.has(op.operation as string))
          errors.push(`${prefix}.operation is invalid`);
        break;
      case 'date_op':
        if (!op.field) errors.push(`${prefix}.field is required`);
        if (!DATE_OPS.has(op.operation as string))
          errors.push(`${prefix}.operation is invalid`);
        break;
      case 'array_filter': {
        if (!op.field) errors.push(`${prefix}.field is required`);
        const cond = op.condition as Record<string, unknown> | undefined;
        if (
          !cond ||
          typeof cond !== 'object' ||
          !cond.field ||
          !VALID_CONDITION_OPERATORS.has(cond.operator as string)
        ) {
          errors.push(`${prefix}.condition is invalid`);
        }
        break;
      }
      case 'array_sort':
        if (!op.field) errors.push(`${prefix}.field is required`);
        if (op.order !== 'asc' && op.order !== 'desc')
          errors.push(`${prefix}.order must be "asc" or "desc"`);
        break;
      case 'object_pick':
      case 'object_omit':
        if (!Array.isArray(op.keys) || op.keys.length === 0)
          errors.push(`${prefix}.keys must be a non-empty array`);
        break;
    }
  }

  return errors;
}

export const transformNodeMetadata: NodeComponentMetadata = {
  type: 'transform',
  category: 'data',
  label: 'Transform',
  description: 'Transform data',
  icon: 'ArrowRightLeft',
  color: '#06B6D4',
  // `summaryTemplate.warnWhen` retained for backward compat — `warningRules`
  // is the new SSOT.
  summaryTemplate: {
    template: '{{operations.length}} operations',
    warnWhen: '!operations.length',
    warnMessage: 'No operations defined',
  },
  // SSOT for warnings (frontend canvas + backend handler.validate).
  // Mirror points:
  //  - legacy `summaryTemplate.warnWhen` (operations array empty)
  //  - backend handler.validate's "operations is required" rule.
  // Per-operation structural validation (type whitelist, per-type required
  // fields, sub-operation enums) lives in `validateConfig` because the
  // mini-DSL cannot model array iteration + per-item discriminated branching.
  warningRules: [
    {
      id: 'transform:no-operations',
      when: 'length(operations) == 0',
      message: '하나 이상의 변환 작업을 추가해야 합니다.',
    },
  ],
  validateConfig: validateTransformConfig,
};
