import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

export const conditionOperatorSchema = z.enum([
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
  'is_type',
]);

export const conditionGroupSchema = z
  .object({
    field: z
      .string()
      .default('')
      .meta({
        ui: {
          label: 'Field',
          widget: 'expression',
          placeholder: '{{ $input.value }}',
        },
      }),
    operator: conditionOperatorSchema.default('eq').meta({
      ui: { label: 'Operator', widget: 'select' },
    }),
    value: z
      .unknown()
      .optional()
      .meta({
        ui: { label: 'Value', widget: 'expression' },
      }),
  })
  .passthrough();

export const ifElseOutputSchema = z
  .object({
    config: z
      .object({
        conditions: z.array(conditionGroupSchema).optional(),
        combineMode: z.enum(['and', 'or']).optional(),
        strictComparison: z.boolean().optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    output: z.unknown().optional(),
    port: z.enum(['true', 'false']).optional(),
    status: z.string().optional(),
  })
  .passthrough();

export const ifElseConfigSchema = z
  .object({
    conditions: z
      .array(conditionGroupSchema)
      .default([])
      .meta({
        ui: {
          label: 'Conditions',
          widget: 'condition-builder',
          itemLabel: 'Condition',
          // warningRule `if_else:no-conditions` 와 정렬 — zod 의 default([]) 는
          // 신규 노드의 저장 관용성을 위해 유지하고 필수성은 ui.required 로
          // 표면화 (node-component.interface.ts:222-226).
          required: true,
        },
      }),
    combineMode: z
      .enum(['and', 'or'])
      .default('and')
      .meta({
        ui: { label: 'Combine Mode', widget: 'select' },
      }),
    strictComparison: z
      .boolean()
      .default(false)
      .meta({
        ui: {
          label: 'Strict Comparison',
          widget: 'checkbox',
          hint: 'Compare without type coercion',
        },
      }),
  })
  .passthrough();
export type IfElseConfig = z.infer<typeof ifElseConfigSchema>;

export const ifElsePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [
    { id: 'true', label: 'True', type: 'data' },
    { id: 'false', label: 'False', type: 'data' },
  ],
};

/**
 * Imperative escape hatch — per-condition validation (operator whitelist,
 * field presence) needs array iteration the mini-DSL can't express.
 * Single-field "is conditions empty?" / "first condition.field set?" checks
 * live in `warningRules` below so they fire the canvas badge.
 */
export function validateIfElseConfig(config: unknown): string[] {
  const c = (config ?? {}) as Record<string, unknown>;
  const errors: string[] = [];
  const conditions = c.conditions;

  if (Array.isArray(conditions)) {
    for (let i = 0; i < conditions.length; i++) {
      const cond = (conditions[i] ?? {}) as Record<string, unknown>;
      if (!cond.field || typeof cond.field !== 'string') {
        errors.push(`conditions[${i}].field is required and must be a string`);
      }
      if (
        !cond.operator ||
        !(conditionOperatorSchema.options as readonly string[]).includes(
          cond.operator as string,
        )
      ) {
        errors.push(
          `conditions[${i}].operator must be one of: ${conditionOperatorSchema.options.join(', ')}`,
        );
      }
    }
  }

  return errors;
}

export const ifElseMetadata: NodeComponentMetadata = {
  type: 'if_else',
  category: 'logic',
  label: 'If/Else',
  description: 'Conditional branching',
  icon: 'GitBranch',
  color: '#3B82F6',
  executionMetadata: { kind: 'standard' },
  // SSOT for warnings (frontend canvas + backend handler.validate).
  // Mirror points:
  //  - frontend `ifElseSummary` warning ("Condition not set" — fires when
  //    conditions[] is empty OR conditions[0].field is blank).
  //  - backend handler.validate's structural checks: conditions must be
  //    non-empty + each condition needs field + operator. Per-item operator
  //    whitelist iterates `conditions[]`, so it lives in `validateConfig`.
  warningRules: [
    {
      id: 'if_else:no-conditions',
      when: 'length(conditions) == 0',
      message: 'At least one condition must be added.',
    },
    {
      id: 'if_else:first-condition-field-empty',
      when: 'length(conditions) > 0 && !conditions.0.field',
      message: "First condition's field must be entered.",
    },
  ],
  validateConfig: validateIfElseConfig,
};
