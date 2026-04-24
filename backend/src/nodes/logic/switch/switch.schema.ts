import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';
import { conditionGroupSchema } from '../if-else/if-else.schema';

export const caseDefSchema = z
  .object({
    // Dynamic-ports port id (spec §8 "Dynamic-ports — stable ids"). 비어있으면
    // `resolve-dynamic-ports.ts` 의 `switchPorts` 가 `case_${i}` fallback 을
    // 발행하지만, label 수정·케이스 재배치 시 index 가 밀려 기존 edge 가
    // 깨질 위험이 있어 custom slug 를 권장. ai_agent/information_extractor 의
    // `conditionDefSchema.id` 와 동일 패턴으로 `hidden: true` — LLM 과 edge
    // 라우팅이 참조하지만 UI 상단 settings 패널에서는 노출하지 않는다.
    id: z
      .string()
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
