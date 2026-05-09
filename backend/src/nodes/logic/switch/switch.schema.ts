import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';
import { conditionGroupSchema } from '../if-else/if-else.schema';

export const caseDefSchema = z
  .object({
    // spec §8 stable port id — 비면 resolver 가 `case_${i}` fallback.
    // slug 형식(ASCII 영숫자/`_`/`-`, 최대 64) 만 허용 — 포트 라우팅 키로 그대로
    // 전파되므로 공백·특수문자·엔티티 삽입을 스키마 단계에서 차단 (review W-5/W-9).
    id: z
      .string()
      .regex(/^[a-zA-Z0-9_-]+$/)
      .max(64)
      .optional()
      .meta({ ui: { label: 'ID', widget: 'text', hidden: true } }),
    label: z
      .string()
      .default('')
      .meta({ ui: { label: 'Label', widget: 'text' } }),
    value: z
      .unknown()
      .optional()
      .meta({
        ui: {
          label: 'Value',
          widget: 'expression',
          visibleWhen: { field: 'mode', equals: 'value' },
        },
      }),
    condition: conditionGroupSchema.optional().meta({
      ui: {
        label: 'Condition',
        widget: 'condition-builder',
        visibleWhen: { field: 'mode', equals: 'expression' },
      },
    }),
  })
  .passthrough();

export const switchNodeOutputSchema = z
  .object({
    config: z
      .object({
        switchValue: z.unknown().optional(),
        cases: z.array(caseDefSchema).optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    output: z.unknown().optional(),
    meta: z
      .object({
        expression: z.string().optional(),
        value: z.unknown().optional(),
        matchedCase: z.string().optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    port: z.string().optional(),
    status: z.string().optional(),
  })
  .passthrough();

export const switchNodeConfigSchema = z
  .object({
    mode: z
      .enum(['value', 'expression'])
      .default('value')
      .meta({ ui: { label: 'Mode', widget: 'select' } }),
    switchValue: z
      .string()
      .default('')
      .meta({
        ui: {
          label: 'Switch Value',
          widget: 'expression',
          placeholder: '{{ $input.value }}',
          visibleWhen: { field: 'mode', equals: 'value' },
        },
      }),
    cases: z
      .array(caseDefSchema)
      .default([])
      .meta({
        ui: {
          label: 'Cases',
          widget: 'field-array',
          itemLabel: 'Case',
        },
      }),
    hasDefault: z
      .boolean()
      .default(false)
      .meta({
        ui: { label: 'Has Default', widget: 'checkbox' },
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
export type SwitchConfig = z.infer<typeof switchNodeConfigSchema>;

// Case-specific output ports are generated dynamically from config.cases.
// The `default` port is static and acts as the fallthrough.
export const switchNodePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [{ id: 'default', label: 'Default', type: 'data' }],
};

/**
 * Imperative escape hatch — per-case validation needs array iteration the
 * mini-DSL can't express:
 *  - duplicate id detection (Set tracking)
 *  - per-case `condition` required when mode === 'expression'
 *  - per-case `valueType` enum whitelist
 * Single-field "is switchValue set?" / "is cases empty?" checks live in
 * `warningRules` below so they fire the canvas badge.
 */
const VALID_CASE_VALUE_TYPES = new Set(['string', 'number', 'boolean']);
export function validateSwitchConfig(config: unknown): string[] {
  const c = (config ?? {}) as Record<string, unknown>;
  const errors: string[] = [];
  const cases = c.cases;
  const mode = ((c.mode as string) ?? 'value') as 'value' | 'expression';

  if (Array.isArray(cases)) {
    const seenIds = new Set<string>();
    for (let i = 0; i < cases.length; i++) {
      const item = (cases[i] ?? {}) as Record<string, unknown>;
      if (!item.id || typeof item.id !== 'string') {
        errors.push(`cases[${i}].id is required and must be a string`);
      } else if (seenIds.has(item.id)) {
        errors.push(`cases[${i}].id '${item.id}' is duplicated`);
      } else {
        seenIds.add(item.id);
      }
      if (
        item.valueType !== undefined &&
        !VALID_CASE_VALUE_TYPES.has(item.valueType as string)
      ) {
        errors.push(
          `cases[${i}].valueType must be one of: string, number, boolean`,
        );
      }
      if (
        mode === 'expression' &&
        (item.condition === undefined || item.condition === null)
      ) {
        errors.push(
          `cases[${i}].condition is required when mode is "expression"`,
        );
      }
    }
  }

  return errors;
}

export const switchNodeMetadata: NodeComponentMetadata = {
  type: 'switch',
  category: 'logic',
  label: 'Switch',
  description: 'Multi-path branching',
  icon: 'Route',
  color: '#3B82F6',
  executionMetadata: { kind: 'standard' },
  isDynamicPorts: true,
  dynamicPorts: { kind: 'switch-cases' },
  // `summaryTemplate.warnWhen` retained for backward compat — `warningRules`
  // is the new SSOT (richer set + stable ids + assistant gate integration).
  summaryTemplate: {
    template: '{{switchValue}} → {{cases.length}} cases',
    warnWhen: '!switchValue',
    warnMessage: 'Switch value not set',
  },
  // SSOT for warnings (frontend canvas + backend handler.validate).
  // Mirror points:
  //  - legacy `summaryTemplate.warnWhen` (switchValue missing in value mode)
  //  - backend handler.validate's structural rules: cases non-empty,
  //    switchValue required when mode='value'. Per-case rules (id uniqueness,
  //    valueType whitelist, condition required in expression mode) live in
  //    `validateConfig` because they need array iteration.
  warningRules: [
    {
      // Default mode is 'value' (zod default), so the rule must also fire
      // when `mode` is missing from a freshly-created config — using
      // `mode != expression` instead of `mode == value` covers both.
      id: 'switch:value-mode-needs-switch-value',
      when: 'mode != expression && !switchValue',
      message: 'Value 모드에서는 Switch Value 를 입력해야 합니다.',
    },
    {
      id: 'switch:no-cases',
      when: 'length(cases) == 0',
      message: '최소 1개 이상의 case 를 추가해야 합니다.',
    },
  ],
  validateConfig: validateSwitchConfig,
};
