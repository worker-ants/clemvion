import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';
import { conditionGroupSchema } from '../if-else/if-else.schema';

const filterConditionSchema = z.record(z.string(), z.unknown());

export const filterNodeOutputSchema = z
  .object({
    config: z
      .object({
        inputField: z.unknown().optional(),
        conditions: z.array(filterConditionSchema).optional(),
        combineMode: z.enum(['and', 'or']).optional(),
        strictComparison: z.boolean().optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    output: z
      .object({
        match: z.array(z.unknown()).optional(),
        unmatched: z.array(z.unknown()).optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    port: z.string().optional(),
    status: z.string().optional(),
  })
  .passthrough();

export const filterNodeConfigSchema = z
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
          // warningRule `filter:no-input-field` 와 정렬.
          required: true,
        },
      }),
    conditions: z
      .array(conditionGroupSchema)
      .default([])
      .meta({
        ui: {
          label: 'Conditions',
          widget: 'condition-builder',
          itemLabel: 'Condition',
          hint: 'Dot-path (e.g. "name", "address.city") or expression ("{{ $item.name }}"). Leave empty or use "$item" to compare against the item itself.',
          // warningRule `filter:no-conditions` 와 정렬.
          required: true,
        },
      }),
    combineMode: z
      .enum(['and', 'or'])
      .default('and')
      .meta({ ui: { label: 'Combine Mode', widget: 'select' } }),
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
export type FilterConfig = z.infer<typeof filterNodeConfigSchema>;

export const filterNodePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [
    { id: 'match', label: 'Match', type: 'data' },
    { id: 'unmatched', label: 'Unmatched', type: 'data' },
  ],
};

/**
 * Imperative escape hatch — per-condition operator/field validation needs
 * array iteration the mini-DSL can't express. Single-field "is inputField
 * set?" / "is conditions empty?" checks live in `warningRules` below so they
 * fire the canvas badge.
 *
 * Imported lazily inside the function to avoid a top-level circular hint with
 * the shared condition util — the schema file is loaded by both the
 * frontend bundle (via @workflow/node-summary) and the backend.
 */
export function validateFilterConfig(config: unknown): string[] {
  // Local copy of the operator whitelist — keeping it inline avoids a
  // schema → handler-shared import which would pull server-side modules.
  const VALID_OPS = new Set([
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
  const c = (config ?? {}) as Record<string, unknown>;
  const errors: string[] = [];
  const conditions = c.conditions;

  if (Array.isArray(conditions)) {
    for (let i = 0; i < conditions.length; i++) {
      const cond = (conditions[i] ?? {}) as Record<string, unknown>;
      // `field` is optional: missing/empty/"$item" all map to the item-self
      // sentinel handled in evaluateCondition. Reject only when an explicit
      // non-string value was authored (e.g. number/object) — that almost
      // certainly indicates a UX mistake.
      if (cond.field !== undefined && typeof cond.field !== 'string') {
        errors.push(`conditions[${i}].field must be a string`);
      }
      if (!cond.operator || !VALID_OPS.has(cond.operator as string)) {
        errors.push(
          `conditions[${i}].operator must be one of: ${[...VALID_OPS].join(', ')}`,
        );
      }
    }
  }

  return errors;
}

export const filterNodeMetadata: NodeComponentMetadata = {
  type: 'filter',
  category: 'logic',
  label: 'Filter',
  description: 'Filter array by conditions',
  icon: 'Filter',
  color: '#3B82F6',
  executionMetadata: { kind: 'standard' },
  // SSOT for warnings (frontend canvas + backend handler.validate).
  // Mirror points:
  //  - frontend `filterSummary` warning ("Input field not set")
  //  - backend handler.validate's "inputField required" + "conditions
  //    non-empty" structural checks. Per-condition field/operator validation
  //    iterates `conditions[]`, so it lives in `validateConfig`.
  warningRules: [
    {
      id: 'filter:no-input-field',
      when: '!inputField',
      message: 'Input field must be entered.',
    },
    {
      id: 'filter:no-conditions',
      when: 'length(conditions) == 0',
      message: 'At least one condition must be added.',
    },
  ],
  validateConfig: validateFilterConfig,
};
