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

export const switchNodeMetadata: NodeComponentMetadata = {
  type: 'switch',
  category: 'logic',
  label: 'Switch',
  description: 'Multi-path branching',
  icon: 'Route',
  color: '#3B82F6',
  isDynamicPorts: true,
  dynamicPorts: { kind: 'switch-cases' },
  summaryTemplate: {
    template: '{{switchValue}} \u2192 {{cases.length}} cases',
    warnWhen: '!switchValue',
    warnMessage: 'Switch value not set',
  },
};
