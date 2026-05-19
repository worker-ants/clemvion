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
          // warningRule `switch:value-mode-needs-switch-value` 와 정렬.
          // 화이트리스트 — mode 가 'value' 일 때 필수 (현재 'value' / 'expression'
          // 두 mode 중 'value' 만 switchValue 입력 필요). mode 가 향후 추가될
          // 때 신규 mode 에 자동으로 적용되지 않도록 명시적 whitelist 사용
          // (2026-05-19 정준화, requiredwhen-dsl-whitelist).
          requiredWhen: { field: 'mode', equals: ['value'] },
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
          // warningRule `switch:no-cases` 와 정렬.
          required: true,
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
 *  - reserved port name collision check
 *  - per-case `condition` required when mode === 'expression'
 *  - per-case `valueType` enum whitelist
 * Single-field "is switchValue set?" / "is cases empty?" checks live in
 * `warningRules` below so they fire the canvas badge.
 */
const VALID_CASE_VALUE_TYPES = new Set(['string', 'number', 'boolean']);
/**
 * Port ids reserved by the engine / spec — case ids that match one of these
 * collide with the static `default` fallthrough port and the conventional
 * `out` / `error` port names used by other node categories. The schema regex
 * only checks slug syntax; this set blocks the semantic collision (D7 of
 * logic-node-followups).
 */
const RESERVED_CASE_IDS = new Set(['default', 'out', 'error']);
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
      } else if (RESERVED_CASE_IDS.has(item.id)) {
        errors.push(
          `cases[${i}].id '${item.id}' is a reserved port name (default / out / error)`,
        );
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
      //
      // **신규 mode 추가 시 동기화 필요** — 이 표현식은 블랙리스트 (`!=`)
      // 형태로 유지된다. 반면 `switchValue.requiredWhen.equals` (line 88)
      // 는 화이트리스트 (`['value']`). 신규 mode 추가 시:
      //   1) `requiredWhen.equals` 배열에 신규 mode 가 switchValue 필요한지
      //      검토 후 명시 추가 (자동 opt-out)
      //   2) 본 `warningRule.when` 표현식도 `mode != expression && mode != <new>`
      //      형태로 명시 갱신 (자동 발화되지 않도록)
      // spec/4-nodes/1-logic/2-switch.md §8.2 신규 mode 추가 가이드라인 step 4.
      id: 'switch:value-mode-needs-switch-value',
      when: 'mode != expression && !switchValue',
      message: 'In Value mode, Switch Value must be entered.',
    },
    {
      id: 'switch:no-cases',
      when: 'length(cases) == 0',
      message: 'At least one case must be added.',
    },
  ],
  validateConfig: validateSwitchConfig,
};
